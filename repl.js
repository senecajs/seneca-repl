/* Copyright © 2015-2021 Richard Rodger and other contributors, MIT License. */
'use strict'

// TODO: make listener start flag controlled, useful tests

// NOTE: vorpal is not used server-side to keep things lean

// https://stackoverflow.com/questions/67518218/custom-node-js-repl-input-output-stream

const Net = require('net')
const Repl = require('repl')
const Util = require('util')
const Vm = require('vm')

const Hoek = require('@hapi/hoek')

const Inks = require('inks')


const intern = (repl.intern = make_intern())

const default_cmds = {
  get: intern.cmd_get,
  depth: intern.cmd_depth,
  plain: intern.cmd_plain,
  quit: intern.cmd_quit,
  list: intern.cmd_list,
  find: intern.cmd_find,
  prior: intern.cmd_prior,
  history: intern.cmd_history,
  log: intern.cmd_log,
  set: intern.cmd_set,
  alias: intern.cmd_alias,
  trace: intern.cmd_trace,
  help: intern.cmd_help,
}



function repl(options) {
  let seneca = this
  let export_address = {}

  let cmd_map = Object.assign({}, default_cmds, options.cmds)

  seneca.add('sys:repl,use:repl', use_repl)
  seneca.add('sys:repl,send:cmd', send_cmd)
  
  seneca.add('sys:repl,add:cmd', add_cmd)
  seneca.add('sys:repl,echo:true', (msg, reply) => reply(msg))

  
  function use_repl(msg, reply) {
    let repl_id = msg.id
    let input = msg.input
    let output = msg.output

    // NEXT: store repl instance using repl_id, incl streams
    // use the sreams to send cmds
    
    let sd = seneca.root.delegate({ repl$: true, fatal$: false })

    let alias = options.alias
    
    let r = Repl.start({
      prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
      input,
      output,
      terminal: false,
      useGlobal: false,
      eval: evaluate,
    })

    r.on('exit', function () {
      // socket.end()
      input.end()
      output.end()
    })

    r.on('error', function (err) {
      sd.log.error('repl', err)
    })

    Object.assign(r.context, {
      // NOTE: don't trigger funnies with a .inspect property
      inspekt: intern.make_inspect(r.context, {
        ...options.inspect,
        depth: options.depth,
      }),
      // socket: socket,
      input,
      output,
      s: sd,
      seneca: sd,
      plain: false,
      history: [],
      log_capture: false,
      log_match: null,
      alias: alias,
      act_trace: false,
      act_index_map: {},
      act_index: 1000000,
      cmd_map: cmd_map,
    })

    sd.on_act_in = intern.make_on_act_in(r.context)
    sd.on_act_out = intern.make_on_act_out(r.context)
    sd.on_act_err = intern.make_on_act_err(r.context)

    sd.on('log', intern.make_log_handler(r.context))

    function evaluate(cmdtext, context, filename, respond) {
      const inspect = context.inspekt
      let cmd_history = context.history

      cmdtext = cmdtext.trim()

      if ('last' === cmdtext && 0 < cmd_history.length) {
        cmdtext = cmd_history[cmd_history.length - 1]
      } else {
        cmd_history.push(cmdtext)
      }

      if (alias[cmdtext]) {
        cmdtext = alias[cmdtext]
      }

      let m = cmdtext.match(/^(\S+)/)
      let cmd = m && m[1]

      let argtext =
          'string' === typeof cmd ? cmdtext.substring(cmd.length) : ''

      // NOTE: alias can also apply just to command
      if (alias[cmd]) {
        cmd = alias[cmd]
      }

      let cmd_func = cmd_map[cmd]
      // console.log('CMD', cmd, !!cmd_func)

      if (cmd_func) {
        return cmd_func(cmd, argtext, context, options, respond)
      }

      if (!execute_action(cmdtext)) {
        context.s.ready(() => {
          execute_script(cmdtext)
        })
      }

      function execute_action(cmdtext) {
        try {
          let msg = cmdtext

          // TODO: use a different operator! will conflict with => !!!
          let m = msg.split(/\s*=>\s*/)
          if (2 === m.length) {
            msg = m[0]
          }

          let injected_msg = Inks(msg, context)
          let args = seneca.util.Jsonic(injected_msg)

          // console.log('JSONIC: ',injected_msg,args)
          if( null == args || Array.isArray(args) || 'object' !== typeof args) {
            return false
          }
          
          context.s.ready(() => {
            context.s.act(args, function (err, out) {
              context.err = err
              context.out = out

              if (m[1]) {
                let ma = m[1].split(/\s*=\s*/)
                if (2 === ma.length) {
                  context[ma[0]] = Hoek.reach({ out: out, err: err }, ma[1])
                }
              }

              if (out && !r.context.act_trace) {
                out =
                  out && out.entity$
                  ? out
                  : context.inspekt(sd.util.clean(out))
                // socket.write(out + '\n')
                output.write(out + '\n')
              } else if (err) {
                // socket.write(context.inspekt(err) + '\n')
                output.write(context.inspekt(err) + '\n')
              }
            })
          })
          return true
        } catch (e) {
          // Not jsonic format, so try to execute as a script
          // TODO: check actual jsonic parse error so we can give better error
          // message if not
          return false
        }
      }

      function execute_script(cmdtext) {
        try {
          let script = Vm.createScript(cmdtext, {
            filename: filename,
            displayErrors: false,
          })

          let result = script.runInContext(context, {
            displayErrors: false,
          })

          result = result === seneca ? null : result
          respond(null, result)
        } catch (e) {
          if ('SyntaxError' === e.name && e.message.startsWith('await')) {
            let wrapper = '(async () => { return (' + cmdtext + ') })()'

            try {
              let script = Vm.createScript(wrapper, {
                filename: filename,
                displayErrors: false,
              })

              let out = script.runInContext(context, {
                displayErrors: false,
              })

              out
                .then((result) => {
                  result = result === seneca ? null : result
                  respond(null, result)
                })
                .catch((e) => {
                  return respond(e.message)
                })
            } catch (e) {
              return respond(e.message)
            }
          } else {
            return respond(e.message)
          }
        }

        //   // let out = script.runInContext(context, {

        //   // out
        //   //  .then(result=>{
        //   //  })
        //   //  .catch(e => {
        //   //    return respond(e.message)
        //   //  })
        // } catch (e) {
        //   console.log(e)
        //   return respond(e.message)
        // }
      }
    }
    
    reply()
  }


  function send_cmd(msg, reply) {

    // lookup repl by id, using steams to submit cmd and send back response
    
    reply()
  }
  
  
  function add_cmd(msg, reply) {
    let name = msg.name
    let action = msg.action

    if ('string' === typeof name && 'function' === typeof action) {
      cmd_map[name] = action
    } else {
      this.fail('invalid-cmd')
    }

    reply()
  }
  add_cmd.desc = 'Add a REPL command dynamically'

  seneca.init(function (reply) {
    try {
      let server = intern.start_repl(seneca, options, cmd_map)

      server.on('listening', function () {
        let address = server.address()

        export_address.port = address.port
        export_address.host = address.address
        export_address.family = address.family

        seneca.log.info({
          kind: 'notice',
          notice: 'REPL listening on ' + address.address + ':' + address.port,
        })

        reply()
      })

      server.on('error', function (err) {
        seneca.log.error(err)
      })
    } catch (e) {
      console.log(e)
    }
  })

  return {
    name: 'repl',
    exportmap: {
      address: export_address,
    },
  }
}

function make_intern() {
  return {
    start_repl: function (seneca, options, cmd_map) {
      // let alias = options.alias

      let server = Net.createServer(function (socket) {

        // TODO: pass this up to init so it can fail properly
        socket.on('error', function (err) {
          seneca.log.error('repl-socket', err)
        })

        seneca.act('sys:repl,use:repl',{
          id: options.host+':'+options.port,
          input: socket,
          output: socket,
        })
        
      }).listen(options.port, options.host)

      return server
    },

    parse_option: function (optpath, val) {
      optpath += '.'

      let part = /([^.]+)\.+/g
      let m
      let out = {}
      let cur = out
      let po = out
      let pn

      while (null != (m = part.exec(optpath))) {
        cur[m[1]] = {}
        po = cur
        pn = m[1]
        cur = cur[m[1]]
      }
      po[pn] = val
      return out
    },

    make_inspect: function (context, inspect_options) {
      return (x) => {
        if (context.plain) {
          x = JSON.parse(JSON.stringify(x))
        }
        return Util.inspect(x, inspect_options)
      }
    },

    fmt_index: function (i) {
      return ('' + i).substring(1)
    },

    make_log_handler: function (context) {
      return function log_handler(data) {
        if (context.log_capture) {
          let seneca = context.seneca
          let out = seneca.__build_test_log__$$
            ? seneca.__build_test_log__$$(seneca, 'test', data)
            : context.inspekt(data).replace(/\n/g, ' ')

          if (
            null == context.log_match ||
            -1 < out.indexOf(context.log_match)
          ) {
            context.socket.write('LOG: ' + out)
          }
        }
      }
    },

    make_on_act_in: function (context) {
      return function on_act_in(actdef, args, meta) {
        if (!context.act_trace) return

        let actid = (meta || args.meta$ || {}).id
        context.socket.write(
          'IN  ' +
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
            '\n'
        )
        context.act_index_map[actid] = context.act_index
        context.act_index++
      }
    },

    make_on_act_out: function (context) {
      return function on_act_out(actdef, out, meta) {
        if (!context.act_trace) return

        let actid = (meta || out.meta$ || {}).id

        out =
          out && out.entity$
            ? out
            : context.inspekt(context.seneca.util.clean(out))

        let cur_index = context.act_index_map[actid]
        context.socket.write(
          'OUT ' + intern.fmt_index(cur_index) + ': ' + out + '\n'
        )
      }
    },

    make_on_act_err: function (context) {
      return function on_act_err(actdef, err, meta) {
        if (!context.act_trace) return

        let actid = (meta || err.meta$ || {}).id

        if (actid) {
          let cur_index = context.act_index_map[actid]
          context.socket.write(
            'ERR ' + intern.fmt_index(cur_index) + ': ' + err.message + '\n'
          )
        }
      }
    },

    cmd_get: function (cmd, argtext, context, options, respond) {
      let option_path = argtext.trim()
      let sopts = context.seneca.options()
      let out = Hoek.reach(sopts, option_path)
      return respond(null, out)
    },

    cmd_depth: function (cmd, argtext, context, options, respond) {
      let depth = parseInt(argtext, 10)
      depth = isNaN(depth) ? null : depth
      context.inspekt = intern.make_inspect(context, {
        ...options.inspect,
        depth: depth,
      })
      return respond(null, 'Inspection depth set to ' + depth)
    },

    cmd_plain: function (cmd, argtext, context, options, respond) {
      context.plain = !context.plain
      return respond()
    },

    cmd_quit: function (cmd, argtext, context, options, respond) {
      context.socket.end()
    },

    cmd_list: function (cmd, argtext, context, options, respond) {
      let narrow = context.seneca.util.Jsonic(argtext)
      respond(null, context.seneca.list(narrow))
    },

    cmd_find: function (cmd, argtext, context, options, respond) {
      let narrow = context.seneca.util.Jsonic(argtext)
      respond(null, context.seneca.find(narrow))
    },

    cmd_prior: function (cmd, argtext, context, options, respond) {
      let pdesc = (actdef) => {
        let d = {
          id: actdef.id,
          plugin: actdef.plugin_fullname,
          pattern: actdef.pattern,
        }
        if (actdef.callpoint) {
          d.callpoint = actdef.callpoint
        }
        return d
      }

      let narrow = context.seneca.util.Jsonic(argtext)
      let actdef = context.seneca.find(narrow)
      let priors = [pdesc(actdef)]
      let pdef = actdef
      while (null != (pdef = pdef.priordef)) {
        priors.push(pdesc(pdef))
      }

      respond(null, priors)
    },

    cmd_history: function (cmd, argtext, context, options, respond) {
      return respond(null, context.history.join('\n'))
    },

    cmd_log: function (cmd, argtext, context, options, respond) {
      context.log_capture = !context.log_capture
      let m = null

      if (!context.log_capture) {
        context.log_match = null
      }

      if ((m = argtext.match(/^\s*match\s+(.*)/))) {
        context.log_capture = true // using match always turns logging on
        context.log_match = m[1]
      }

      return respond()
    },

    cmd_set: function (cmd, argtext, context, options, respond) {
      let m = argtext.match(/^\s*(\S+)\s+(\S+)/)

      if (m) {
        let setopt = intern.parse_option(
          m[1],
          context.seneca.util.Jsonic('$:' + m[2]).$
        )
        context.seneca.options(setopt)

        if (setopt.repl) {
          options = context.seneca.util.deepextend(options, setopt.repl)
        }

        return respond()
      } else {
        return respond('ERROR: expected set <path> <value>')
      }
    },

    cmd_alias: function (cmd, argtext, context, options, respond) {
      let m = argtext.match(/^\s*(\S+)\s+(.+)[\r\n]?/)

      if (m) {
        context.alias[m[1]] = m[2]
        return respond()
      } else {
        return respond('ERROR: expected alias <name> <command>')
      }
    },

    cmd_trace: function (cmd, argtext, context, options, respond) {
      context.act_trace = !context.act_trace
      return respond()
    },

    cmd_help: function (cmd, argtext, context, options, respond) {
      return respond(null, context.cmd_map)
    },
  }
}


repl.defaults = {
  port: 30303,
  host: '127.0.0.1',
  depth: 11,
  alias: {
    stats: 'seneca.stats()',
    'stats full': 'seneca.stats({summary:false})',

    // DEPRECATED
    'stats/full': 'seneca.stats({summary:false})',

    // TODO: there should be a seneca.tree()
    tree: 'seneca.root.private$.actrouter',
  },
  inspect: {},
  cmds: {
    // custom cmds
  },
}


module.exports = repl
