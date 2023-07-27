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
const default_cmds = {
// get: intern.cmd_get,
// depth: intern.cmd_depth,
// plain: intern.cmd_plain,
// quit: intern.cmd_quit,
// list: intern.cmd_list,
// find: intern.cmd_find,
// prior: intern.cmd_prior,
// history: intern.cmd_history,
// log: intern.cmd_log,
// set: intern.cmd_set,
// alias: intern.cmd_alias,
// trace: intern.cmd_trace,
// help: intern.cmd_help,
};
for (let cmd of Object.values(cmds_1.Cmds)) {
    default_cmds[cmd.name.toLowerCase().replace(/cmd$/, '')] = cmd;
}
// console.log(default_cmds)
function repl(options) {
    let seneca = this;
    // console.log('OPTS', options)
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
        // console.log('PREP', options)
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
            server.on('listening', function () {
                let address = server.address();
                export_address.port = address.port;
                export_address.host = address.address;
                export_address.family = address.family;
                seneca.log.info({
                    kind: 'notice',
                    notice: 'REPL listening on ' + address.address + ':' + address.port,
                });
            });
            server.on('error', function (err) {
                seneca.log.error('repl-server', err);
            });
        }
    });
    /*
    seneca.init(function (reply: any) {
      // TODO: replace with sys:repl,use:repl call
      // try {
      let server = intern.start_repl(seneca, options, cmdMap, export_address, () => {
        // console.log('START-REPL done')
        reply()
      })
  
      let replID = (options.host + ':' + options.port)
  
      replMap[replID] = {
        id: replID,
        server,
        status: 'server'
      }
    })
    */
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
    //   let count = 0
    //   let needed = 0
    //   Object.values(replMap).forEach((replDesc: any) => {
    //     try {
    //       replDesc.input?.destroy && replDesc.input.destroy()
    //     }
    //     catch (err) {
    //       seneca.log.error('repl-close-input', err, { id: replDesc.id })
    //     }
    //     try {
    //       replDesc.output?.destroy && replDesc.output.destroy()
    //     }
    //     catch (err) {
    //       seneca.log.error('repl-close-output', err, { id: replDesc.id })
    //     }
    //     if (replDesc.server?.close) {
    //       needed++
    //       replDesc.server.close((err: any) => {
    //         if (err) {
    //           seneca.log.error('repl-close-server', err, { id: replDesc.id })
    //         }
    //         setImmediate(() => {
    //           count++
    //           done()
    //         })
    //       })
    //     }
    //   })
    //   if (0 === needed) {
    //     done()
    //   }
    //   function done() {
    //     if (needed <= count) {
    //       seneca.prior(msg, reply)
    //     }
    //   }
    // }
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
    // let alias = options.alias
    // let r = Repl.start({
    //   prompt: 'seneca ' + replSeneca.version + ' ' + replSeneca.id + '> ',
    //   input,
    //   output,
    //   terminal: false,
    //   useGlobal: false,
    //   eval: evaluate,
    // })
    // replInst.repl = r
    // r.on('exit', function () {
    //   updateStatus(replInst, 'closed')
    //   input.end()
    //   output.end()
    // })
    // r.on('error', function (err) {
    //   replSeneca.log.error('repl', err)
    // })
    // Object.assign(r.context, {
    //   // NOTE: don't trigger funnies with a .inspect property
    //   inspekt: makeInspect(r.context, {
    //     ...options.inspect,
    //     depth: options.depth,
    //   }),
    //   // socket: socket,
    //   input,
    //   output,
    //   s: replSeneca,
    //   seneca: replSeneca,
    //   plain: false,
    //   history: [],
    //   log_capture: false,
    //   log_match: null,
    //   alias: alias,
    //   act_trace: false,
    //   act_index_map: {},
    //   act_index: 1000000,
    //   cmdMap: cmdMap,
    // })
    // replSeneca.on_act_in = intern.make_on_act_in(r.context)
    // replSeneca.on_act_out = intern.make_on_act_out(r.context)
    // replSeneca.on_act_err = intern.make_on_act_err(r.context)
    // replSeneca.on('log', intern.make_log_handler(r.context))
    // function evaluate(cmdtext: any, context: any, filename: any, respond: any) {
    //     // const inspect = context.inspekt
    //     let cmd_history = context.history
    //     cmdtext = cmdtext.trim()
    //     // console.log('CMDTEXT', cmdtext)
    //     if ('last' === cmdtext && 0 < cmd_history.length) {
    //       cmdtext = cmd_history[cmd_history.length - 1]
    //     }
    //     else {
    //       cmd_history.push(cmdtext)
    //     }
    //     if (alias[cmdtext]) {
    //       cmdtext = alias[cmdtext]
    //     }
    //     let m = cmdtext.match(/^(\S+)/)
    //     let cmd = m && m[1]
    //     let argstr =
    //       'string' === typeof cmd ? cmdtext.substring(cmd.length) : ''
    //     // NOTE: alias can also apply just to command
    //     if (alias[cmd]) {
    //       cmd = alias[cmd]
    //     }
    //     let cmd_func: Cmd = cmdMap[cmd]
    //     // console.log('CMD', cmd, !!cmd_func)
    //     if (cmd_func) {
    //       if (1 === cmd_func.length) {
    //         return cmd_func({ name: cmd, argstr, context, options, respond })
    //       }
    //       else {
    //         return (cmd_func as any)(cmd, argstr, context, options, respond)
    //       }
    //     }
    //     if (!execute_action(cmdtext)) {
    //       context.s.ready(() => {
    //         execute_script(cmdtext)
    //       })
    //     }
    //     function execute_action(cmdtext: string) {
    //       try {
    //         let msg = cmdtext
    //         // TODO: use a different operator! will conflict with => !!!
    //         let m = msg.split(/\s*=>\s*/)
    //         if (2 === m.length) {
    //           msg = m[0]
    //         }
    //         let injected_msg = Inks(msg, context)
    //         let args = replSeneca.util.Jsonic(injected_msg)
    //         // console.log('JSONIC: ',injected_msg,args)
    //         if (null == args || Array.isArray(args) || 'object' !== typeof args) {
    //           return false
    //         }
    //         // console.log('MSG IN', args)
    //         // context.s.ready(() => {
    //         // console.log('ACT', args)
    //         context.s.act(args, function (err: any, out: any) {
    //           // console.log('ACTRES', err, out)
    //           context.err = err
    //           context.out = out
    //           if (m[1]) {
    //             let ma = m[1].split(/\s*=\s*/)
    //             if (2 === ma.length) {
    //               context[ma[0]] = Hoek.reach({ out: out, err: err }, ma[1])
    //             }
    //           }
    //           if (out && !r.context.act_trace) {
    //             out =
    //               out && out.entity$
    //                 ? out
    //                 : context.inspekt(replSeneca.util.clean(out))
    //             // socket.write(out + '\n')
    //             output.write(out + '\n')
    //             output.write(new Uint8Array([0]))
    //           } else if (err) {
    //             // socket.write(context.inspekt(err) + '\n')
    //             output.write(context.inspekt(err) + '\n')
    //           }
    //         })
    //         // })
    //         return true
    //       } catch (e) {
    //         // Not jsonic format, so try to execute as a script
    //         // TODO: check actual jsonic parse error so we can give better error
    //         // message if not
    //         return false
    //       }
    //     }
    //     function execute_script(cmdtext: any) {
    //       try {
    //         let script = (Vm as any).createScript(cmdtext, {
    //           filename: filename,
    //           displayErrors: false,
    //         })
    //         let result = script.runInContext(context, {
    //           displayErrors: false,
    //         })
    //         result = result === replSeneca ? null : result
    //         return respond(null, result)
    //       }
    //       catch (e: any) {
    //         if ('SyntaxError' === e.name && e.message.startsWith('await')) {
    //           let wrapper = '(async () => { return (' + cmdtext + ') })()'
    //           try {
    //             let script = (Vm as any).createScript(wrapper, {
    //               filename: filename,
    //               displayErrors: false,
    //             })
    //             let out = script.runInContext(context, {
    //               displayErrors: false,
    //             })
    //             out
    //               .then((result: any) => {
    //                 result = result === replSeneca ? null : result
    //                 respond(null, result)
    //               })
    //               .catch((e: any) => {
    //                 return respond(e.message)
    //               })
    //           }
    //           catch (e: any) {
    //             return respond(e.message)
    //           }
    //         }
    //         else {
    //           return respond(e.message)
    //         }
    //       }
    //     }
    //   }
    //   return reply({
    //     id: replInst.id,
    //     status: replInst.status,
    //     desc: replInst,
    //   })
    // }
    function send_cmd(msg, reply) {
        let seneca = this;
        // lookup repl by id, using steams to submit cmd and send back response
        let replID = msg.id || (options.host + ':' + options.port);
        let replInst = replMap[replID];
        // console.log(replID, replMap)
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
            // console.log('OUT', chunk, out)
        });
        // console.log('WRITE', cmd)
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
        // // TODO: separate Net server construction from repl setup
        // start_repl: function (
        //   seneca: any,
        //   options: any,
        //   _cmdMap: any,
        //   export_address: any,
        //   done: any
        // ) {
        //   let server = Net.createServer(function (socket) {
        //     // console.log('CREATE')
        //     // TODO: pass this up to init so it can fail properly
        //     socket.on('error', function (err) {
        //       seneca.log.error('repl-socket', err)
        //     })
        //     seneca.act('sys:repl,use:repl', {
        //       // id: options.host+':'+options.port,
        //       input: socket,
        //       output: socket,
        //     }, function (err: any, res: any) {
        //       // console.log(err)
        //       if (err) {
        //         return done(err)
        //       }
        //       // console.log('RES', res)
        //       res.desc.status = 'open'
        //     })
        //   })
        //   server.listen(options.port, options.host)
        //   server.on('listening', function () {
        //     let address: any = server.address()
        //     export_address.port = address.port
        //     export_address.host = address.address
        //     export_address.family = address.family
        //     seneca.log.info({
        //       kind: 'notice',
        //       notice: 'REPL listening on ' + address.address + ':' + address.port,
        //     })
        //     // console.log('LISTENING')
        //     done()
        //   })
        //   server.on('error', function (err) {
        //     seneca.log.error(err)
        //   })
        //   return server
        // },
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
        // cmd_get: function (
        //   _cmd: any, argstr: any, context: any, _options: any, respond: any
        // ) {
        //   let option_path = argstr.trim()
        //   let sopts = context.seneca.options()
        //   let out = Hoek.reach(sopts, option_path)
        //   return respond(null, out)
        // },
        // cmd_depth: function (
        //   _cmd: any, argstr: any, context: any, options: any, respond: any
        // ) {
        //   let depth: any = parseInt(argstr, 10)
        //   depth = isNaN(depth) ? null : depth
        //   context.inspekt = intern.make_inspect(context, {
        //     ...options.inspect,
        //     depth: depth,
        //   })
        //   return respond(null, 'Inspection depth set to ' + depth)
        // },
        // cmd_plain: function (
        //   _cmd: any, _argstr: any, context: any, _options: any, respond: any
        // ) {
        //   context.plain = !context.plain
        //   return respond()
        // },
        // cmd_quit: function (
        //   _cmd: any, _argstr: any, context: any, _options: any, _respond: any
        // ) {
        //   context.socket.end()
        // },
        // cmd_list: function (
        //   _cmd: any, argstr: any, context: any, _options: any, respond: any
        // ) {
        //   let narrow = context.seneca.util.Jsonic(argstr)
        //   respond(null, context.seneca.list(narrow))
        // },
        // cmd_find: function (
        //   _cmd: any, argstr: any, context: any, _options: any, respond: any
        // ) {
        //   let narrow = context.seneca.util.Jsonic(argstr)
        //   respond(null, context.seneca.find(narrow))
        // },
        // cmd_prior: function (
        //   _cmd: any, argstr: any, context: any, _options: any, respond: any
        // ) {
        //   let pdesc = (actdef: any) => {
        //     let d = {
        //       id: actdef.id,
        //       plugin: actdef.plugin_fullname,
        //       pattern: actdef.pattern,
        //       callpoint: undefined
        //     }
        //     if (actdef.callpoint) {
        //       d.callpoint = actdef.callpoint
        //     }
        //     return d
        //   }
        //   let narrow = context.seneca.util.Jsonic(argstr)
        //   let actdef = context.seneca.find(narrow)
        //   let priors = [pdesc(actdef)]
        //   let pdef = actdef
        //   while (null != (pdef = pdef.priordef)) {
        //     priors.push(pdesc(pdef))
        //   }
        //   respond(null, priors)
        // },
        // cmd_history: function (
        //   _cmd: any, _argstr: any, context: any, _options: any, respond: any
        // ) {
        //   return respond(null, context.history.join('\n'))
        // },
        // cmd_log: function (
        //   _cmd: any, argstr: any, context: any, _options: any, respond: any
        // ) {
        //   context.log_capture = !context.log_capture
        //   let m = null
        //   if (!context.log_capture) {
        //     context.log_match = null
        //   }
        //   if ((m = argstr.match(/^\s*match\s+(.*)/))) {
        //     context.log_capture = true // using match always turns logging on
        //     context.log_match = m[1]
        //   }
        //   return respond()
        // },
        // cmd_set: function (
        //   _cmd: any, argstr: any, context: any, options: any, respond: any
        // ) {
        //   let m = argstr.match(/^\s*(\S+)\s+(\S+)/)
        //   if (m) {
        //     let setopt: any = intern.parse_option(
        //       m[1],
        //       context.seneca.util.Jsonic('$:' + m[2]).$
        //     )
        //     context.seneca.options(setopt)
        //     if (setopt.repl) {
        //       options = context.seneca.util.deepextend(options, setopt.repl)
        //     }
        //     return respond()
        //   } else {
        //     return respond('ERROR: expected set <path> <value>')
        //   }
        // },
        // cmd_alias: function (
        //   _cmd: any, argstr: any, context: any, _options: any, respond: any
        // ) {
        //   let m = argstr.match(/^\s*(\S+)\s+(.+)[\r\n]?/)
        //   if (m) {
        //     context.alias[m[1]] = m[2]
        //     return respond()
        //   } else {
        //     return respond('ERROR: expected alias <name> <command>')
        //   }
        // },
        // cmd_trace: function (
        //   _cmd: any, _argstr: any, context: any, _options: any, respond: any
        // ) {
        //   context.act_trace = !context.act_trace
        //   return respond()
        // },
        // cmd_help: function (
        //   _cmd: any, _argstr: any, context: any, _options: any, respond: any
        // ) {
        //   return respond(null, context.cmdMap)
        // },
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
        // console.log('CMD', cmd, !!cmd_func)
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
                let m = msg.split(/\s*=>\s*/);
                if (2 === m.length) {
                    msg = m[0];
                }
                let injected_msg = Inks(msg, context);
                let args = seneca.util.Jsonic(injected_msg);
                // console.log('JSONIC: ',injected_msg,args)
                if (null == args || Array.isArray(args) || 'object' !== typeof args) {
                    return false;
                }
                // console.log('MSG IN', args)
                // context.s.ready(() => {
                // console.log('ACT', args)
                context.s.act(args, function (err, out) {
                    // console.log('ACTRES', err, out)
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
                        // socket.write(out + '\n')
                        output.write(out + '\n');
                        output.write(new Uint8Array([0]));
                    }
                    else if (err) {
                        // socket.write(context.inspekt(err) + '\n')
                        output.write(context.inspekt(err) + '\n');
                    }
                });
                // })
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