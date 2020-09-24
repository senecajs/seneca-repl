/* Copyright © 2015-2020 Richard Rodger and other contributors, MIT License. */
'use strict'

// TODO: make listener start flag controlled, useful tests

// NOTE: vorpal is not used server-side to keep things lean

const Net = require('net')
const Repl = require('repl')
const Util = require('util')
const Vm = require('vm')

const Hoek = require('@hapi/hoek')

const Inks = require('inks')

module.exports = repl
module.exports.defaults = {
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

const intern = (repl.intern = make_intern())

const default_cmds = {
  get: intern.cmd_get,
  depth: intern.cmd_depth,
  plain: intern.cmd_plain,
  quit: intern.cmd_quit,
  list: intern.cmd_list,
  history: intern.cmd_history,
  log: intern.cmd_log,
  set: intern.cmd_set,
  alias: intern.cmd_alias,
  trace: intern.cmd_trace,
  help: intern.cmd_help,
}

function repl(options) {
  var seneca = this
  var export_address = {}

  var cmd_map = Object.assign({}, default_cmds, options.cmds)

  seneca.add('sys:repl,add:cmd', add_cmd)
  seneca.add('sys:repl,echo:true', (msg, reply) => reply(msg))

  function add_cmd(msg, reply) {
    var name = msg.name
    var action = msg.action

    if ('string' === typeof name && 'function' === typeof action) {
      cmd_map[name] = action
    } else {
      this.fail('invalid-cmd')
    }

    reply()
  }
  add_cmd.desc = 'Add a REPL command dynamically'

  seneca.init(function (reply) {
    var server = intern.start_repl(seneca, options, cmd_map)

    server.on('listening', function () {
      var address = server.address()

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
      var alias = options.alias

      var server = Net.createServer(function (socket) {
        socket.on('error', function (err) {
          sd.log.debug('repl-socket', err)
        })

        var sd = seneca.root.delegate({ repl$: true, fatal$: false })

        var r = Repl.start({
          prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
          input: socket,
          output: socket,
          terminal: false,
          useGlobal: false,
          eval: evaluate,
        })

        r.on('exit', function () {
          socket.end()
        })

        r.on('error', function (err) {
          sd.log.debug('repl', err)
        })

        Object.assign(r.context, {
          // NOTE: don't trigger funnies with a .inspect property
          inspekt: intern.make_inspect(r.context, {
            ...options.inspect,
            depth: options.depth,
          }),
          socket: socket,
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
          var cmd_history = context.history

          cmdtext = cmdtext.trim()

          if ('last' === cmdtext && 0 < cmd_history.length) {
            cmdtext = cmd_history[cmd_history.length - 1]
          } else {
            cmd_history.push(cmdtext)
          }

          if (alias[cmdtext]) {
            cmdtext = alias[cmdtext]
          }

          var m = cmdtext.match(/^(\S+)/)
          var cmd = m && m[1]

          var argtext =
            'string' === typeof cmd ? cmdtext.substring(cmd.length) : ''

          // NOTE: alias can also apply just to command
          if (alias[cmd]) {
            cmd = alias[cmd]
          }

          var cmd_func = cmd_map[cmd]
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
              var msg = cmdtext
              var m = msg.split(/\s*=>\s*/)
              if (2 === m.length) {
                msg = m[0]
              }

              var injected_msg = Inks(msg, context)
              var args = seneca.util.Jsonic(injected_msg)
              context.s.ready(() => {
                context.s.act(args, function (err, out) {
                  context.err = err
                  context.out = out

                  if (m[1]) {
                    var ma = m[1].split(/\s*=\s*/)
                    if (2 === ma.length) {
                      context[ma[0]] = Hoek.reach({ out: out, err: err }, ma[1])
                    }
                  }

                  if (out && !r.context.act_trace) {
                    out =
                      out && out.entity$
                        ? out
                        : context.inspekt(sd.util.clean(out))
                    socket.write(out + '\n')
                  } else if (err) {
                    socket.write(context.inspekt(err) + '\n')
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
              var script = Vm.createScript(cmdtext, {
                filename: filename,
                displayErrors: false,
              })
              var result = script.runInContext(context, {
                displayErrors: false,
              })

              result = result === seneca ? null : result
              respond(null, result)
            } catch (e) {
              return respond(e.message)
            }
          }
        }
      }).listen(options.port, options.host)

      return server
    },

    parse_option: function (optpath, val) {
      optpath += '.'

      var part = /([^.]+)\.+/g
      var m
      var out = {}
      var cur = out
      var po = out
      var pn

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
          var seneca = context.seneca
          var out = seneca.__build_test_log__$$
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

        var actid = (meta || args.meta$ || {}).id
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

        var actid = (meta || out.meta$ || {}).id

        out =
          out && out.entity$
            ? out
            : context.inspekt(context.seneca.util.clean(out))

        var cur_index = context.act_index_map[actid]
        context.socket.write(
          'OUT ' + intern.fmt_index(cur_index) + ': ' + out + '\n'
        )
      }
    },

    make_on_act_err: function (context) {
      return function on_act_err(actdef, err, meta) {
        if (!context.act_trace) return

        var actid = (meta || err.meta$ || {}).id

        if (actid) {
          var cur_index = context.act_index_map[actid]
          context.socket.write(
            'ERR ' + intern.fmt_index(cur_index) + ': ' + err.message + '\n'
          )
        }
      }
    },

    cmd_get: function (cmd, argtext, context, options, respond) {
      var option_path = argtext.trim()
      var options = context.seneca.options()
      var out = Hoek.reach(options, option_path)
      return respond(null, out)
    },

    cmd_depth: function (cmd, argtext, context, options, respond) {
      var depth = parseInt(argtext, 10)
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
      var narrow = context.seneca.util.Jsonic(argtext)
      respond(null, context.seneca.list(narrow))
    },

    cmd_history: function (cmd, argtext, context, options, respond) {
      return respond(null, context.history.join('\n'))
    },

    cmd_log: function (cmd, argtext, context, options, respond) {
      context.log_capture = !context.log_capture
      var m = null

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
      var m = argtext.match(/^\s*(\S+)\s+(\S+)/)

      if (m) {
        var setopt = intern.parse_option(
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
      var m = argtext.match(/^\s*(\S+)\s+(.+)[\r\n]?/)

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
