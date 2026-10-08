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
const node_util_1 = __importDefault(require("node:util"));
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
    // let mark = Math.random()
    let server = null;
    let export_address = {};
    let replMap = {};
    let cmdMap = Object.assign({}, default_cmds, options.cmds);
    seneca.add('sys:repl,use:repl', use_repl);
    seneca.add('sys:repl,send:cmd', send_cmd);
    seneca.add('sys:repl,add:cmd', add_cmd);
    seneca.add('sys:repl,echo:true', (msg, reply) => reply(msg));
    // Seneca 3 closes via role:seneca,cmd:close; Seneca 4 via sys:seneca,cmd:close.
    const close_pattern = seneca.version.startsWith('3.')
        ? 'role:seneca,cmd:close'
        : 'sys:seneca,cmd:close';
    seneca.add(close_pattern, cmd_close);
    // Callback style init so that the plugin works on Seneca 3 without
    // seneca-promisify, and on Seneca 4.
    seneca.init(function (done) {
        if (!options.listen) {
            return done();
        }
        let finished = false;
        const finish = (err) => {
            if (!finished) {
                finished = true;
                done(err);
            }
        };
        server = node_net_1.default.createServer(function (socket) {
            socket.on('error', function (err) {
                seneca.log.error('repl-socket', err);
            });
            // Each connection gets its own REPL instance.
            seneca.act('sys:repl,use:repl', {
                id: socket.remoteAddress + '~' + socket.remotePort,
                server,
                input: socket,
                output: socket,
            });
        });
        server.on('error', function (err) {
            seneca.log.error('repl-server', err);
            finish(err);
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
            finish();
        });
        server.listen(options.port, options.host);
    });
    function cmd_close(msg, reply) {
        const seneca = this;
        close_repls()
            .catch((err) => {
            seneca.log.error('repl-close', err);
        })
            .then(() => {
            seneca.prior(msg, reply);
        });
    }
    async function close_repls() {
        for (let replInst of Object.values(replMap)) {
            await replInst.destroy();
        }
        if (server && server.listening) {
            await new Promise((resolve) => {
                server.close((err) => {
                    if (err) {
                        seneca.log.error('repl-close-server', err);
                    }
                    resolve();
                });
            });
        }
    }
    function use_repl(msg, reply) {
        let seneca = this;
        let replID = msg.id || options.host + '~' + options.port;
        let replInst = replMap[replID];
        if (replInst && 'open' === replInst.status) {
            return reply({
                ok: true,
                repl: replInst,
            });
        }
        let server = msg.server;
        let input = msg.input || new node_stream_1.PassThrough();
        let output = msg.output || new node_stream_1.PassThrough();
        let replSeneca = seneca.root.delegate({ repl$: true, fatal$: false });
        replSeneca.did = replSeneca.did + '~repl$';
        replMap[replID] = replInst = new ReplInstance({
            id: replID,
            options,
            cmdMap,
            input,
            output,
            server,
            seneca: replSeneca,
            event: (name) => {
                if ('exit' === name) {
                    setTimeout(() => {
                        delete replMap[replID];
                    }, 1111).unref();
                }
            },
        });
        replInst.update('open');
        return reply({
            ok: true,
            repl: replInst,
        });
    }
    // TODO: fix: append newline id needed, otherwise times out!
    function send_cmd(msg, reply) {
        let seneca = this;
        // lookup repl by id, using steams to submit cmd and send back response
        // Same default identifier as sys:repl,use:repl.
        let replID = msg.id || options.host + '~' + options.port;
        let replInst = replMap[replID];
        if (null == replInst) {
            return seneca.fail('unknown-repl', { id: replID });
        }
        else if ('open' !== replInst.status) {
            return seneca.fail('invalid-status', {
                id: replID,
                status: replInst.status,
            });
        }
        let cmd = msg.cmd;
        if (!cmd.endsWith('\n')) {
            cmd += '\n';
        }
        let out = [];
        // TODO: dedup this
        // use a FILO queue
        let listener = (chunk) => {
            if (0 === chunk[0]) {
                replInst.output.removeListener('data', listener);
                reply({ ok: true, out: out.join('') });
            }
            out.push(chunk.toString());
        };
        replInst.output.on('data', listener);
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
/*
function updateStatus(replInst: any, newStatus: string) {
  replInst.status = newStatus
  replInst.log.push({
    kind: 'status',
    status: newStatus,
    when: Date.now()
  })
}
*/
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
                        context.output.write('LOG: ' + out + '\n');
                    }
                }
            };
        },
        make_on_act_in: function (context) {
            return function on_act_in(actdef, args, meta) {
                if (!context.act_trace)
                    return;
                let actid = (meta || args.meta$ || {}).id;
                context.output.write('IN  ' +
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
                context.output.write('OUT ' + intern.fmt_index(cur_index) + ': ' + out + '\n');
            };
        },
        make_on_act_err: function (context) {
            return function on_act_err(_actdef, err, meta) {
                if (!context.act_trace)
                    return;
                let actid = (meta || err.meta$ || {}).id;
                if (actid) {
                    let cur_index = context.act_index_map[actid];
                    context.output.write('ERR ' + intern.fmt_index(cur_index) + ': ' + err.message + '\n');
                }
            };
        },
    };
}
// Use the Gubu shape builders of the Seneca instance that loads the plugin,
// so that the shape is always built by the Gubu version Seneca itself uses.
repl.defaults = function (spec) {
    const { Open } = spec.valid;
    return {
        listen: true,
        port: 30303,
        host: '127.0.0.1',
        depth: 11,
        alias: Open({
            stats: 'seneca.stats()',
            'stats full': 'seneca.stats({summary:false})',
            // DEPRECATED
            'stats/full': 'seneca.stats({summary:false})',
            // TODO: there should be a seneca.tree()
            // tree: 'seneca.root.private$.actrouter',
        }),
        inspect: Open({}),
        cmds: Open({
        // custom cmds
        }),
    };
};
repl.errors = {
    'unknown-repl': 'REPL instance not found: <%=id%>.',
    'invalid-status': 'REPL instance <%=id%> is not open: <%=status%>.',
    'invalid-cmd': 'A REPL command needs a string name and a function action.',
};
repl.Cmds = cmds_1.Cmds;
class ReplInstance {
    constructor(spec) {
        this.status = 'init';
        this.log = [];
        this.state = {
            data: false,
        };
        this.id = spec.id;
        this.cmdMap = spec.cmdMap;
        this.server = spec.server;
        this.event = spec.event;
        this.options = spec.options;
        const input = (this.input = spec.input);
        const output = (this.output = spec.output);
        const seneca = (this.seneca = spec.seneca);
        const repl = (this.repl = node_repl_1.default.start({
            // prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
            prompt: '',
            input,
            output,
            terminal: false,
            useGlobal: false,
            eval: this.evaluate.bind(this),
            writer: this.writer.bind(this),
        }));
        repl.on('exit', () => {
            this.update('closed');
            this.stop_log();
            input.end();
            output.end();
            this.event('exit');
        });
        repl.on('error', (err) => {
            seneca.log.error('repl', err);
            this.event('error');
        });
        // The .clear command of the Node.js REPL replaces the context, so
        // set up the session variables again on the new one.
        repl.on('reset', (context) => {
            this.setup(context);
        });
        this.setup(repl.context);
    }
    setup(context) {
        const seneca = this.seneca;
        const options = this.options;
        Object.assign(context, {
            // NOTE: don't trigger funnies with a .inspect property
            inspekt: (0, utils_1.makeInspect)(context, {
                ...options.inspect,
                depth: options.depth,
            }),
            input: this.input,
            output: this.output,
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
            delegate: {
                repl$: seneca,
                root$: seneca.root,
            },
        });
        seneca.on_act_in = intern.make_on_act_in(context);
        seneca.on_act_out = intern.make_on_act_out(context);
        seneca.on_act_err = intern.make_on_act_err(context);
        this.stop_log();
        this.log_handler = intern.make_log_handler(context);
        seneca.on('log', this.log_handler);
    }
    update(status) {
        this.status = status;
    }
    stop_log() {
        if (this.log_handler) {
            this.seneca.removeListener('log', this.log_handler);
            this.log_handler = null;
        }
    }
    writer(val) {
        if (this.state.data) {
            this.state.data = false;
            return node_util_1.default.inspect(val, {
                depth: null,
                maxArrayLength: null,
                maxStringLength: null,
                breakLength: Infinity,
                compact: true,
            });
        }
        else {
            return node_util_1.default.inspect(val);
        }
    }
    evaluate(cmdtext, context, filename, origRespond) {
        const seneca = this.seneca;
        const repl = this.repl;
        const options = this.options;
        const alias = options.alias;
        const output = this.output;
        const respond = (err, res, opts = {}) => {
            if (true === opts.data) {
                this.state.data = true;
            }
            origRespond(err, res);
            output.write(String.fromCharCode(0));
            // output.write(new Uint8Array([0]))
            // output.write('Z')
        };
        try {
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
                // context.s.ready(() => {
                execute_script(cmdtext);
                //})
            }
            function execute_action(cmdtext) {
                try {
                    let msg = cmdtext;
                    let m = msg.split(/\s*~>\s*/);
                    if (2 === m.length) {
                        msg = m[0];
                    }
                    let injected_msg = Inks(msg, context);
                    let args = seneca.util.Jsonic(injected_msg);
                    let notmsg = null == args || Array.isArray(args) || 'object' !== typeof args;
                    if (notmsg) {
                        return false;
                    }
                    context.s.act(args, function (err, out) {
                        context.err = err;
                        context.out = out;
                        // EXPERIMENTAL! msg ~> x saves msg result into x
                        if (m[1]) {
                            let ma = m[1].split(/\s*=\s*/);
                            if (2 === ma.length) {
                                context[ma[0]] = hoek_1.default.reach({ out: out, err: err }, ma[1]);
                            }
                            else {
                                context[m[1]] = out;
                            }
                        }
                        // Always respond, so that the end-of-response marker is sent.
                        if (err) {
                            respond(err);
                        }
                        else if (repl.context.act_trace) {
                            // The trace hooks have already written the IN and OUT lines.
                            respond(null);
                        }
                        else {
                            respond(null, out);
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
                                return respond(e);
                            });
                        }
                        catch (e) {
                            return respond(e);
                        }
                    }
                    else {
                        // return respond(e.message)
                        return respond(e);
                    }
                }
            }
        }
        catch (e) {
            return respond(e);
        }
    }
    async destroy() {
        var _a, _b;
        const seneca = this.seneca;
        this.stop_log();
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
        // NOTE: the TCP server is shared by all sessions, and is closed by the
        // plugin once every session has been destroyed. Closing it here would
        // wait for the connections of the other sessions to end.
    }
}
module.exports = repl;
//# sourceMappingURL=repl.js.map