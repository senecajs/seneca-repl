'use strict'

// Load modules
var Net = require('net')
var Repl = require('repl')
var Util = require('util')
var Vm = require('vm')
var _ = require('lodash')
var Jsonic = require('jsonic')

// Declare internals
var internals = {
  name: 'seneca-repl',
  defaults: {
    port: 30303,
    host: '127.0.0.1',
    depth: 11,
    alias: {
      list: 'seneca.list()'
    }
  }
}

module.exports = function repl (opts) {
  var seneca = this

  var options = seneca.util.deepextend(internals.defaults, opts)
  var repl = internals.repl(seneca, options)

  seneca.decorate('repl', repl)       // Open a REPL on a local port.

  // REMOVE in Seneca 2.x.x
  seneca.decorate('startrepl', repl)

  return {
    name: internals.name,
    options: options
  }
}

internals.repl = function (seneca, options) {
  return function api_repl () {
    var self = this

    var in_opts = _.isObject(arguments[0]) ? arguments[0] : {}
    in_opts.port = _.isNumber(arguments[0]) ? arguments[0] : in_opts.port
    in_opts.host = _.isString(arguments[1]) ? arguments[1] : in_opts.host

    var alias = _.extend(options.alias || {}, in_opts.alias)

    var repl_opts = seneca.util.deepextend(options, in_opts)
    Net.createServer(function (socket) {
      socket.on('error', function (err) {
        sd.log.error('repl-socket', err)
      })

      var r = Repl.start({
        prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
        input: socket,
        output: socket,
        terminal: false,
        useGlobal: false,
        eval: evaluate
      })

      r.on('exit', function () {
        socket.end()
      })

      var act_index_map = {}
      var act_index = 1000000
      function fmt_index (i) {
        return ('' + i).substring(1)
      }

      var sd = seneca.delegate({ repl$: true })

      r.on('error', function (err) {
        sd.log.error('repl', err)
      })

      sd.on_act_in = function on_act_in (actmeta, args) {
        socket.write('IN  ' + fmt_index(act_index) +
                     ': ' + Util.inspect(sd.util.clean(args)) +
                     ' # ' +
                     args.meta$.id + ' ' +
                     actmeta.pattern + ' ' +
                     actmeta.id + ' ' +
                     actmeta.func.name + ' ' +
                     (actmeta.callpoint ? actmeta.callpoint : '') +
                     '\n')
        act_index_map[actmeta.id] = act_index
        act_index++
      }

      sd.on_act_out = function on_act_out (actmeta, out) {
        out = (out && out.entity$) ? out
          : Util.inspect(sd.util.clean(out), {depth: options.depth})

        var cur_index = act_index_map[actmeta.id]
        socket.write('OUT ' + fmt_index(cur_index) +
          ': ' + out + '\n')
      }

      sd.on_act_err = function on_act_err (actmeta, err) {
        var cur_index = act_index_map[actmeta.id]
        socket.write('ERR ' + fmt_index(cur_index) +
          ': ' + err.message + '\n')
      }

      r.context.s = r.context.seneca = sd

      function evaluate (cmdtext, context, filename, callback) {
        var result

        var m = cmdtext.match(/^(\S+)/)
        var cmd = m && m[1]
        if ('quit' === cmd || 'exit' === cmd) {
          socket.end()
        }
        else if ('set' === cmd) {
          m = cmdtext.match(/^(\S+)\s+(\S+)\s+(\S+)/)

          if (m) {
            var setopt = parse_option(m[2], Jsonic('$:' + m[3]).$)
            context.s.options(setopt)

            if (setopt.repl) {
              options = context.s.util.deepextend(options, setopt.repl)
            }

            return callback()
          }
          else {
            return callback('ERROR: expected set <option> <value>')
          }
        }
        else if ('alias' === cmd) {
          m = cmdtext.match(/^(\S+)\s+(\S+)\s+(.+)[\r\n]+$/)

          if (m) {
            alias[m[2]] = m[3]
            return callback()
          }
          else {
            return callback('ERROR: expected alias <name> <command>')
          }
        }
        else if (alias[cmd]) {
          cmd = alias[cmd]
        }

        if (!execute_action(cmd)) {
          execute_script(cmd)
        }


        function execute_action (cmd) {
          try {
            var args = Jsonic(cmd)
            context.s.act(args, function (err, out) {
              callback(err ? err.message : null)
            })
            return true
          }
          catch (e) {
            return false
          }
        }

        function execute_script (cmd) {
          try {
            var script = Vm.createScript(cmd, {
              filename: filename,
              displayErrors: false
            })
            result = script.runInContext(context, { displayErrors: false })

            result = (result === seneca) ? null : result
            callback(null, result)
          }
          catch (e) {
            return callback(e.message)
          }
        }
      }
    }).listen(repl_opts.port, repl_opts.host)

    return self
  }
}

function parse_option (optpath, val) {
  optpath += '.'

  var part = /([^\.]+)\.+/g
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
}
