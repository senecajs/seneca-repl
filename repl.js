/* Copyright © 2020 Richard Rodger and other contributors, MIT License. */
'use strict'

// NOTE: vorpal is not used server-side to keep things lean

// TODO: implement cmd for seneca.make('core/fixture').load$('qazwsx',(e,x)=>console.log(x.data$())) to show ent data



const Net = require('net')
const Repl = require('repl')
const Util = require('util')
const Vm = require('vm')

const Hoek = require('@hapi/hoek')

module.exports = repl
module.exports.defaults = {
  port: 30303,
  host: '127.0.0.1',
  depth: 11,
  alias: {
    list: 'seneca.list()',
    stats: 'seneca.stats()',
    'stats/full': 'seneca.stats({summary:false})',

    // TODO: there should be a seneca.tree()
    tree: 'seneca.root.private$.actrouter'
  },
  inspect: {
  },
  cmds: {
    // custom cmds
  }
}

const intern = repl.intern = make_intern()

const default_cmds = {
  get: intern.cmd_get,
  depth: intern.cmd_depth,
  plain: intern.cmd_plain
}


function repl(options) {
  var seneca = this
  var export_address = {}

  var cmd_map = Object.assign({},default_cmds,options.cmds)
  
  seneca.init(function(reply) {

    var server = intern.start_repl(seneca, options, cmd_map)
    
    server.on('listening', function() {
      var address = server.address()
      
      export_address.port = address.port
      export_address.host = address.address
      export_address.family = address.family
      
      seneca.log.info({
        kind: 'notice',
        notice: 'REPL listening on ' + address.address + ':' + address.port
      })
      
      reply()
    })
    
    server.on('error', function(err) {
      seneca.log.error(err)
    })
  })

  return {
    name: 'repl',
    exportmap: {
      address: export_address
    }
  }
}

function make_intern() {
  return {
    start_repl: function (seneca, options, cmd_map) {
      var alias = options.alias

      var server = Net.createServer(function(socket) {
        socket.on('error', function(err) {
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

        // NOTE: don't trigger funnies with a .inspect property
        r.context.inspekt = 
          intern.make_inspect(r.context,{...options.inspect, depth:options.depth})
        
        r.on('exit', function() {
          socket.end()
        })

        var act_trace = false
        var act_index_map = {}
        var act_index = 1000000
        function fmt_index(i) {
          return ('' + i).substring(1)
        }

        var sd = seneca.root.delegate({ repl$: true, fatal$: false })

        r.on('error', function(err) {
          sd.log.debug('repl', err)
        })

        sd.on_act_in = function on_act_in(actdef, args, meta) {
          if(!act_trace) return;
          
          var actid = (meta || args.meta$ || {}).id
          socket.write(
            'IN  ' +
              fmt_index(act_index) +
              ': ' +
              r.context.inspekt(sd.util.clean(args)) +
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
          act_index_map[actid] = act_index
          act_index++
        }

        sd.on_act_out = function on_act_out(actdef, out, meta) {
          if(!act_trace) return;
          
          var actid = (meta || out.meta$ || {}).id

          out = out && out.entity$
            ? out
            : r.context.inspekt(sd.util.clean(out))

          var cur_index = act_index_map[actid]
          socket.write('OUT ' + fmt_index(cur_index) + ': ' + out + '\n')
        }

        sd.on_act_err = function on_act_err(actdef, err, meta) {
          if(!act_trace) return;
          
          var actid = (meta || err.meta$ || {}).id

          if (actid) {
            var cur_index = act_index_map[actid]
            socket.write('ERR ' + fmt_index(cur_index) + ': ' + err.message + '\n')
          }
        }

        var log_capture = false
        var log_match = null
        
        sd.on('log',function(data) {
          if(log_capture) {
            var out = sd.__build_test_log__$$ ?
                sd.__build_test_log__$$(this,'test',data) :
                r.context.inspekt(data).replace(/\n/g, ' ')

            if(null == log_match || -1 < out.indexOf(log_match)) {
              socket.write('LOG: '+out)
            }
          }
        })

        r.context.s = r.context.seneca = sd;
        r.context.plain = false
        
        var cmd_history = []

        function evaluate(cmdtext, context, filename, respond) {
          const inspect = context.inspekt

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

          var argtext = 'string' === typeof(cmd) ? cmdtext.substring(cmd.length) : ''
          
          // NOTE: alias can also apply just to command
          if (alias[cmd]) {
            cmd = alias[cmd]
          }
          
          var cmd_func = cmd_map[cmd]
          
          if(cmd_func) {
            return cmd_func(cmd, argtext, context, options, respond)
          }
          
          if ('quit' === cmd || 'exit' === cmd) {
            socket.end()
          } else if ('trace' === cmd) {
            act_trace = !act_trace
            return respond()
          } else if ('log' === cmd) {
            log_capture = !log_capture

            if(!log_capture) {
              log_match = null
            }
            else if(m = cmdtext.match(/^log\s+match\s+(.*)/)) {
              log_match = m[1]
            }
            
            return respond()
            
          } else if ('history' === cmd) {
            return respond(null,cmd_history.join('\n'))
          } else if ('set' === cmd) {
            m = cmdtext.match(/^(\S+)\s+(\S+)\s+(\S+)/)

            if (m) {
              var setopt = intern.parse_option(m[2], seneca.util.Jsonic('$:' + m[3]).$)
              context.s.options(setopt)

              if (setopt.repl) {
                options = context.s.util.deepextend(options, setopt.repl)
              }

              return respond()
            } else {
              return respond('ERROR: expected set <path> <value>')
            }
          } else if ('alias' === cmd) {
            m = cmdtext.match(/^(\S+)\s+(\S+)\s+(.+)[\r\n]?/)
            
            if (m) {
              alias[m[2]] = m[3]
              return respond()
            } else {
              return respond('ERROR: expected alias <name> <command>')
            }
          }

          if (!execute_action(cmdtext)) {
            execute_script(cmdtext)
          }

          function execute_action(cmdtext) {
            try {
              var args = seneca.util.Jsonic(cmdtext)
              context.s.act(args, function(err, out) {
                if(out && !act_trace) {
                  out = out && out.entity$
                    ? out
                    : context.inspekt(sd.util.clean(out))
                  socket.write(out + '\n')
                }
                else if(err) {
                  socket.write(context.inspekt(err) + '\n')
                }
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
                displayErrors: false
              })
              var result = script.runInContext(context, { displayErrors: false })

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
    
    parse_option: function(optpath, val) {
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

    make_inspect: function(context, inspect_options) {
      return (x) => {
        if(context.plain) {
          x = JSON.parse(JSON.stringify(x))
        }
        return Util.inspect(x, inspect_options)
      }
    },
    
    cmd_get: function(cmd, argtext, context, options, respond) {
      var option_path = argtext.trim()
      var options = context.seneca.options()
      var out = Hoek.reach(options,option_path)
      return respond(null,out)
    },

    cmd_depth: function(cmd, argtext, context, options, respond) {
      var depth = parseInt(argtext,10)
      depth = isNaN(depth) ? null : depth
      context.inspekt =
        intern.make_inspect(context, {...options.inspect, depth:depth})
      return respond(null,'Inspection depth set to '+depth)
    },

    cmd_plain: function(cmd, argtext, context, options, respond) {
      context.plain = !context.plain
      return respond()
    }

  }
}
