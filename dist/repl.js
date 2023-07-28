"use strict";
/* Copyright © 2015-2023 Richard Rodger and other contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: make listener start flag controlled, useful tests
// NOTE: vorpal is not used server-side to keep things lean
const node_stream_1 = require("node:stream");
const node_net_1 = __importDefault(require("node:net"));
const node_repl_1 = __importDefault(require("node:repl"));
const node_vm_1 = __importDefault(require("node:vm"));
const gubu_1 = require("gubu");
const hoek_1 = __importDefault(require("@hapi/hoek"));
const Inks = require('inks');
const cmds_1 = require("./cmds");
const utils_1 = require("./utils");
const intern = (repl.intern = make_intern());
const default_cmds = {};
for (let cmd of Object.values(cmds_1.Cmds)) {
    default_cmds[cmd.name.toLowerCase().replace(/cmd$/, '')] = cmd;
}
function repl(options) {
    let seneca = this;
    let mark = Math.random();
    let server = null;
    let export_address = {};
    let replMap = {};
    let cmdMap = Object.assign({}, default_cmds, options.cmds);
    seneca.add('sys:repl,use:repl', use_repl);
    seneca.add('sys:repl,send:cmd', send_cmd);
    seneca.add('sys:repl,add:cmd', add_cmd);
    seneca.add('sys:repl,echo:true', (msg, reply) => reply(msg));
    seneca.message('role:seneca,cmd:close', cmd_close);
    seneca.prepare(async function () {
        if (options.listen) {
            server = node_net_1.default.createServer(function (socket) {
                socket.on('error', function (err) {
                    seneca.log.error('repl-socket', err);
                });
                let address = server.address();
                seneca.act('sys:repl,use:repl', {
                    id: address.address + '~' + address.port,
                    server,
                    input: socket,
                    output: socket,
                });
            });
            server.listen(options.port, options.host);
            let pres = new Promise((resolve, reject) => {
                server.on('error', function (err) {
                    seneca.log.error('repl-server', err);
                    reject(err);
                });
                server.on('listening', function () {
                    let address = server.address();
                    export_address.port = address.port;
                    export_address.host = address.address;
                    export_address.family = address.family;
                    seneca.log.info({
                        kind: 'notice',
                        notice: 'REPL listening on ' + address.address + ':' + address.port,
                    });
                    resolve();
                });
            });
            return pres;
        }
    });
    async function cmd_close(msg) {
        const seneca = this;
        if (options.listen && server) {
            server.close((err) => {
                if (err) {
                    seneca.log.error('repl-close-server', err);
                }
            });
        }
        for (let replInst of Object.values(replMap)) {
            await replInst.destroy();
        }
        return seneca.prior(msg);
    }
    function use_repl(msg, reply) {
        let seneca = this;
        let replID = msg.id || (options.host + '~' + options.port);
        let replInst = replMap[replID];
        if (replInst) {
            return reply({
                ok: true,
                repl: replInst
            });
        }
        let server = msg.server;
        let input = msg.input || new node_stream_1.PassThrough();
        let output = msg.output || new node_stream_1.PassThrough();
        let replSeneca = seneca.root.delegate({ repl$: true, fatal$: false });
        replMap[replID] = replInst = new ReplInstance({
            id: replID,
            options,
            cmdMap,
            input,
            output,
            server,
            seneca: replSeneca
        });
        replInst.update('open');
        return reply({
            ok: true,
            repl: replInst
        });
    }
    function send_cmd(msg, reply) {
        let seneca = this;
        // lookup repl by id, using steams to submit cmd and send back response
        let replID = msg.id || (options.host + ':' + options.port);
        let replInst = replMap[replID];
        if (null == replInst) {
            seneca.fail('unknown-repl', { id: replID });
        }
        else if ('open' !== replInst.status) {
            seneca.fail('invalid-status', { id: replID, status: replInst.status });
        }
        let cmd = msg.cmd;
        let out = [];
        // TODO: dedup this
        // use a FILO queue
        replInst.output.on('data', (chunk) => {
            if (0 === chunk[0]) {
                reply({ out: out.join('') });
            }
            out.push(chunk.toString());
        });
        replInst.input.write(cmd);
    }
    function add_cmd(msg, reply) {
        let name = msg.name;
        let action = msg.action;
        if ('string' === typeof name && 'function' === typeof action) {
            cmdMap[name] = action;
        }
        else {
            this.fail('invalid-cmd');
        }
        reply();
    }
    add_cmd.desc = 'Add a REPL command dynamically';
    return {
        name: 'repl',
        exportmap: {
            address: export_address,
        },
    };
}
function updateStatus(replInst, newStatus) {
    replInst.status = newStatus;
    replInst.log.push({
        kind: 'status',
        status: newStatus,
        when: Date.now()
    });
}
function make_intern() {
    return {
        fmt_index: function (i) {
            return ('' + i).substring(1);
        },
        make_log_handler: function (context) {
            return function log_handler(data) {
                if (context.log_capture) {
                    let seneca = context.seneca;
                    let out = seneca.__build_test_log__$$
                        ? seneca.__build_test_log__$$(seneca, 'test', data)
                        : context.inspekt(data).replace(/\n/g, ' ');
                    if (null == context.log_match ||
                        -1 < out.indexOf(context.log_match)) {
                        context.socket.write('LOG: ' + out);
                    }
                }
            };
        },
        make_on_act_in: function (context) {
            return function on_act_in(actdef, args, meta) {
                if (!context.act_trace)
                    return;
                let actid = (meta || args.meta$ || {}).id;
                context.socket.write('IN  ' +
                    intern.fmt_index(context.act_index) +
                    ': ' +
                    context.inspekt(context.seneca.util.clean(args)) +
                    ' # ' +
                    actid +
                    ' ' +
                    actdef.pattern +
                    ' ' +
                    actdef.id +
                    ' ' +
                    actdef.action +
                    ' ' +
                    (actdef.callpoint ? actdef.callpoint : '') +
                    '\n');
                context.act_index_map[actid] = context.act_index;
                context.act_index++;
            };
        },
        make_on_act_out: function (context) {
            return function on_act_out(_actdef, out, meta) {
                if (!context.act_trace)
                    return;
                let actid = (meta || out.meta$ || {}).id;
                out =
                    out && out.entity$
                        ? out
                        : context.inspekt(context.seneca.util.clean(out));
                let cur_index = context.act_index_map[actid];
                context.socket.write('OUT ' + intern.fmt_index(cur_index) + ': ' + out + '\n');
            };
        },
        make_on_act_err: function (context) {
            return function on_act_err(_actdef, err, meta) {
                if (!context.act_trace)
                    return;
                let actid = (meta || err.meta$ || {}).id;
                if (actid) {
                    let cur_index = context.act_index_map[actid];
                    context.socket.write('ERR ' + intern.fmt_index(cur_index) + ': ' + err.message + '\n');
                }
            };
        },
    };
}
repl.defaults = {
    listen: true,
    port: 30303,
    host: '127.0.0.1',
    depth: 11,
    alias: (0, gubu_1.Open)({
        stats: 'seneca.stats()',
        'stats full': 'seneca.stats({summary:false})',
        // DEPRECATED
        'stats/full': 'seneca.stats({summary:false})',
        // TODO: there should be a seneca.tree()
        tree: 'seneca.root.private$.actrouter',
    }),
    inspect: (0, gubu_1.Open)({}),
    cmds: (0, gubu_1.Open)({
    // custom cmds
    }),
};
repl.Cmds = cmds_1.Cmds;
class ReplInstance {
    constructor(spec) {
        this.status = 'init';
        this.log = [];
        this.id = spec.id;
        this.cmdMap = spec.cmdMap;
        this.server = spec.server;
        const options = this.options = spec.options;
        const input = this.input = spec.input;
        const output = this.output = spec.output;
        const seneca = this.seneca = spec.seneca;
        const repl = this.repl = node_repl_1.default.start({
            prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
            input,
            output,
            terminal: false,
            useGlobal: false,
            eval: this.evaluate.bind(this),
        });
        repl.on('exit', () => {
            this.update('closed');
            input.end();
            output.end();
        });
        repl.on('error', (err) => {
            seneca.log.error('repl', err);
        });
        Object.assign(repl.context, {
            // NOTE: don't trigger funnies with a .inspect property
            inspekt: (0, utils_1.makeInspect)(repl.context, {
                ...options.inspect,
                depth: options.depth,
            }),
            input,
            output,
            s: seneca,
            seneca,
            plain: false,
            history: [],
            log_capture: false,
            log_match: null,
            alias: options.alias,
            act_trace: false,
            act_index_map: {},
            act_index: 1000000,
            cmdMap: this.cmdMap,
        });
        seneca.on_act_in = intern.make_on_act_in(repl.context);
        seneca.on_act_out = intern.make_on_act_out(repl.context);
        seneca.on_act_err = intern.make_on_act_err(repl.context);
        seneca.on('log', intern.make_log_handler(repl.context));
    }
    update(status) {
        this.status = status;
    }
    evaluate(cmdtext, context, filename, respond) {
        const seneca = this.seneca;
        const repl = this.repl;
        const options = this.options;
        const alias = options.alias;
        const output = this.output;
        let cmd_history = context.history;
        cmdtext = cmdtext.trim();
        if ('last' === cmdtext && 0 < cmd_history.length) {
            cmdtext = cmd_history[cmd_history.length - 1];
        }
        else {
            cmd_history.push(cmdtext);
        }
        if (alias[cmdtext]) {
            cmdtext = alias[cmdtext];
        }
        let m = cmdtext.match(/^(\S+)/);
        let cmd = m && m[1];
        let argstr = 'string' === typeof cmd ? cmdtext.substring(cmd.length) : '';
        // NOTE: alias can also apply just to command
        if (alias[cmd]) {
            cmd = alias[cmd];
        }
        let cmd_func = this.cmdMap[cmd];
        if (cmd_func) {
            return cmd_func({ name: cmd, argstr, context, options, respond });
        }
        if (!execute_action(cmdtext)) {
            context.s.ready(() => {
                execute_script(cmdtext);
            });
        }
        function execute_action(cmdtext) {
            try {
                let msg = cmdtext;
                // TODO: use a different operator! will conflict with => !!!
                let m = msg.split(/\s*~>\s*/);
                if (2 === m.length) {
                    msg = m[0];
                }
                let injected_msg = Inks(msg, context);
                let args = seneca.util.Jsonic(injected_msg);
                if (null == args || Array.isArray(args) || 'object' !== typeof args) {
                    return false;
                }
                context.s.act(args, function (err, out) {
                    context.err = err;
                    context.out = out;
                    if (m[1]) {
                        let ma = m[1].split(/\s*=\s*/);
                        if (2 === ma.length) {
                            context[ma[0]] = hoek_1.default.reach({ out: out, err: err }, ma[1]);
                        }
                    }
                    if (out && !repl.context.act_trace) {
                        out =
                            out && out.entity$
                                ? out
                                : context.inspekt(seneca.util.clean(out));
                        output.write(out + '\n');
                        output.write(new Uint8Array([0]));
                    }
                    else if (err) {
                        output.write(context.inspekt(err) + '\n');
                    }
                });
                return true;
            }
            catch (e) {
                // Not jsonic format, so try to execute as a script
                // TODO: check actual jsonic parse error so we can give better error
                // message if not
                return false;
            }
        }
        function execute_script(cmdtext) {
            try {
                let script = node_vm_1.default.createScript(cmdtext, {
                    filename: filename,
                    displayErrors: false,
                });
                let result = script.runInContext(context, {
                    displayErrors: false,
                });
                result = result === seneca ? null : result;
                return respond(null, result);
            }
            catch (e) {
                if ('SyntaxError' === e.name && e.message.startsWith('await')) {
                    let wrapper = '(async () => { return (' + cmdtext + ') })()';
                    try {
                        let script = node_vm_1.default.createScript(wrapper, {
                            filename: filename,
                            displayErrors: false,
                        });
                        let out = script.runInContext(context, {
                            displayErrors: false,
                        });
                        out
                            .then((result) => {
                            result = result === seneca ? null : result;
                            respond(null, result);
                        })
                            .catch((e) => {
                            return respond(e.message);
                        });
                    }
                    catch (e) {
                        return respond(e.message);
                    }
                }
                else {
                    return respond(e.message);
                }
            }
        }
    }
    async destroy() {
        var _a, _b, _c;
        const seneca = this.seneca;
        try {
            ((_a = this.input) === null || _a === void 0 ? void 0 : _a.destroy) && this.input.destroy();
        }
        catch (err) {
            seneca.log.error('repl-close-input', err, { id: this.id });
        }
        try {
            ((_b = this.output) === null || _b === void 0 ? void 0 : _b.destroy) && this.output.destroy();
        }
        catch (err) {
            seneca.log.error('repl-close-output', err, { id: this.id });
        }
        if (((_c = this.server) === null || _c === void 0 ? void 0 : _c.close) && this.server.listening) {
            return new Promise((resolve) => {
                this.server.close((err) => {
                    if (err) {
                        seneca.log.error('repl-close-server', err, { id: this.id });
                    }
                    resolve();
                });
            });
        }
    }
}
module.exports = repl;
//# sourceMappingURL=repl.js.map