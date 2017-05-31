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
      list: 'seneca.list()',
      stats: 'seneca.stats()',
      'stats/full': 'seneca.stats({summary:false})',

      // TODO: there should be a seneca.tree()
      tree: 'seneca.root.private$.actrouter'
    }
  }
}


module.exports = function repl (opts) {
  var seneca = this

  var options = seneca.util.deepextend(internals.defaults, opts)
  internals.repl(seneca, options)

  return {
    name: internals.name,
    options: options
  }
}


internals.repl = function (seneca, options) {
  var in_opts = _.isObject(arguments[0]) ? arguments[0] : {}
  in_opts.port = _.isNumber(arguments[0]) ? arguments[0] : in_opts.port
  in_opts.host = _.isString(arguments[1]) ? arguments[1] : in_opts.host

  var alias = _.extend(options.alias || {}, in_opts.alias)

  var repl_opts = seneca.util.deepextend(options, in_opts)
  Net.createServer(function (socket) {
    socket.on('error', function (err) {
      sd.log.debug('repl-socket', err)
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

    var sd = seneca.root.delegate({repl$: true, fatal$: false})

    r.on('error', function (err) {
      sd.log.debug('repl', err)
    })

    sd.on_act_in = function on_act_in (actdef, args, meta) {
      var actid = (meta || args.meta$ || {}).id
      socket.write('IN  ' + fmt_index(act_index) +
                   ': ' + Util.inspect(sd.util.clean(args)) +
                   ' # ' +
                   actid + ' ' +
                   actdef.pattern + ' ' +
                   actdef.id + ' ' +
                   actdef.action + ' ' +
                   (actdef.callpoint ? actdef.callpoint : '') +
                   '\n')
      act_index_map[actid] = act_index
      act_index++
    }

    sd.on_act_out = function on_act_out (actdef, out, meta) {
      var actid = (meta || out.meta$ || {}).id

      out = (out && out.entity$) ? out
        : Util.inspect(sd.util.clean(out), {depth: options.depth})

      var cur_index = act_index_map[actid]
      socket.write('OUT ' + fmt_index(cur_index) +
                   ': ' + out + '\n')
    }

    sd.on_act_err = function on_act_err (actdef, err, meta) {
      var actid = (meta || err.meta$ || {}).id

      if (actid) {
        var cur_index = act_index_map[actid]
        socket.write('ERR ' + fmt_index(cur_index) +
                     ': ' + err.message + '\n')
      }
    }

    r.context.s = r.context.seneca = sd


    var cmd_history = []

    function evaluate (cmdtext, context, filename, callback) {
      var m = cmdtext.match(/^(\S+)/)
      var cmd = m && m[1]

      if ('last' === cmd) {
        cmd = cmd_history[cmd_history.length - 1]
      }
      else {
        cmd_history.push(cmd)
      }


      if ('quit' === cmd || 'exit' === cmd) {
        socket.end()
      }
      else if ('history' === cmd) {
        return callback(cmd_history.join('\n'))
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
          return callback('ERROR: expected set <path> <value>')
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
          var result = script.runInContext(context, { displayErrors: false })

          result = (result === seneca) ? null : result
          callback(null, result)
        }
        catch (e) {
          return callback(e.message)
        }
      }
    }
  }).listen(repl_opts.port, repl_opts.host)
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
