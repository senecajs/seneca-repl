/* Copyright © 2015-2023 Richard Rodger and other contributors, MIT License. */

// TODO: make listener start flag controlled, useful tests

// NOTE: vorpal is not used server-side to keep things lean


import { PassThrough } from 'node:stream'

import Net from 'node:net'
import Repl from 'node:repl'
import Util from 'node:util'
import Vm from 'node:vm'

import Hoek from '@hapi/hoek'

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



function repl(this: any, options: any) {
  let seneca = this

  let export_address: Record<string, any> = {}
  let replMap: Record<string, any> = {}
  let cmdMap: Record<string, any> = Object.assign({}, default_cmds, options.cmds)


  seneca.add('sys:repl,use:repl', use_repl)
  seneca.add('sys:repl,send:cmd', send_cmd)

  seneca.add('sys:repl,add:cmd', add_cmd)
  seneca.add('sys:repl,echo:true', (msg: any, reply: any) => reply(msg))

  seneca.add('role:seneca,cmd:close', cmd_close)


  function cmd_close(this: any, msg: any, reply: any) {
    const seneca = this
    // console.log('CMD-CLOSE', replMap)

    let count = 0
    let needed = 0

    Object.values(replMap).forEach((replDesc: any) => {
      try {
        replDesc.input?.destroy && replDesc.input.destroy()
      }
      catch (err) {
        seneca.log.error('repl-close-input', err, { id: replDesc.id })
      }

      try {
        replDesc.output?.destroy && replDesc.output.destroy()
      }
      catch (err) {
        seneca.log.error('repl-close-output', err, { id: replDesc.id })
      }

      if (replDesc.server?.close) {
        needed++
        replDesc.server.close((err: any) => {
          if (err) {
            seneca.log.error('repl-close-server', err, { id: replDesc.id })
          }
          setImmediate(() => {
            count++
            done()
          })
        })
      }
    })

    if (0 === needed) {
      done()
    }

    function done() {
      if (needed <= count) {
        seneca.prior(msg, reply)
      }
    }
  }


  function use_repl(msg: any, reply: any) {
    let replID = msg.id || (options.host + ':' + options.port)

    let replDesc = replMap[replID]

    // console.log('USE-REPL', replID, replDesc)

    let server = null

    if (replDesc) {
      if ('open' === replDesc.status) {
        return reply({
          id: replDesc.id,
          status: replDesc.status,
          desc: replDesc
        })
      }
      else if ('init' === replDesc.status) {
        // TODO: queue
        seneca.fail('concurrent-init', { id: replID })
      }

      // TODO: define proper life cycle for replDesc
      else if ('server' === replDesc.status) {
        server = replDesc.server
      }
    }


    let input = msg.input || new PassThrough()
    let output = msg.output || new PassThrough()

    replMap[replID] = replDesc = {
      id: replID,
      input,
      output,
      server,
      log: [],
    }

    updateStatus(replDesc, 'init')

    // NEXT: store repl instance using replID, incl streams
    // use the sreams to send cmds

    let sd = seneca.root.delegate({ repl$: true, fatal$: false })
    replDesc.instance = sd


    let alias = options.alias

    let r = Repl.start({
      prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
      input,
      output,
      terminal: false,
      useGlobal: false,
      eval: evaluate,
    })

    replDesc.repl = r


    r.on('exit', function () {
      updateStatus(replDesc, 'closed')
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
      cmdMap: cmdMap,
    })

    sd.on_act_in = intern.make_on_act_in(r.context)
    sd.on_act_out = intern.make_on_act_out(r.context)
    sd.on_act_err = intern.make_on_act_err(r.context)

    sd.on('log', intern.make_log_handler(r.context))


    function evaluate(cmdtext: any, context: any, filename: any, respond: any) {
      // const inspect = context.inspekt

      let cmd_history = context.history

      cmdtext = cmdtext.trim()
      // console.log('CMDTEXT', cmdtext)

      if ('last' === cmdtext && 0 < cmd_history.length) {
        cmdtext = cmd_history[cmd_history.length - 1]
      }
      else {
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

      let cmd_func = cmdMap[cmd]
      // console.log('CMD', cmd, !!cmd_func)

      if (cmd_func) {
        return cmd_func(cmd, argtext, context, options, respond)
      }

      if (!execute_action(cmdtext)) {
        context.s.ready(() => {
          execute_script(cmdtext)
        })
      }

      function execute_action(cmdtext: string) {
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
          if (null == args || Array.isArray(args) || 'object' !== typeof args) {
            return false
          }

          // console.log('MSG IN', args)

          // context.s.ready(() => {
          // console.log('ACT', args)
          context.s.act(args, function (err: any, out: any) {
            // console.log('ACTRES', err, out)

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
              output.write(new Uint8Array([0]))

            } else if (err) {
              // socket.write(context.inspekt(err) + '\n')
              output.write(context.inspekt(err) + '\n')
            }
          })
          // })
          return true
        } catch (e) {
          // Not jsonic format, so try to execute as a script
          // TODO: check actual jsonic parse error so we can give better error
          // message if not
          return false
        }
      }

      function execute_script(cmdtext: any) {
        try {
          let script = (Vm as any).createScript(cmdtext, {
            filename: filename,
            displayErrors: false,
          })

          let result = script.runInContext(context, {
            displayErrors: false,
          })

          result = result === seneca ? null : result
          return respond(null, result)
        }
        catch (e: any) {
          if ('SyntaxError' === e.name && e.message.startsWith('await')) {
            let wrapper = '(async () => { return (' + cmdtext + ') })()'

            try {
              let script = (Vm as any).createScript(wrapper, {
                filename: filename,
                displayErrors: false,
              })

              let out = script.runInContext(context, {
                displayErrors: false,
              })

              out
                .then((result: any) => {
                  result = result === seneca ? null : result
                  respond(null, result)
                })
                .catch((e: any) => {
                  return respond(e.message)
                })
            }
            catch (e: any) {
              return respond(e.message)
            }
          }
          else {
            return respond(e.message)
          }
        }
      }
    }

    return reply({
      id: replDesc.id,
      status: replDesc.status,
      desc: replDesc
    })
  }


  function send_cmd(this: any, msg: any, reply: any) {
    let seneca = this

    // lookup repl by id, using steams to submit cmd and send back response

    let replID = msg.id || (options.host + ':' + options.port)
    let replDesc = replMap[replID]

    // console.log(replID, replMap)

    if (null == replDesc) {
      seneca.fail('unknown-repl', { id: replID })
    }
    else if ('open' !== replDesc.status) {
      seneca.fail('invalid-status', { id: replID, status: replDesc.status })
    }

    let cmd = msg.cmd

    let out: any = []

    // TODO: dedup this
    // use a FILO queue
    replDesc.output.on('data', (chunk: Buffer) => {
      if (0 === chunk[0]) {
        reply({ out: out.join('') })
      }

      out.push(chunk.toString())
      // console.log('OUT', chunk, out)
    })

    // console.log('WRITE', cmd)
    replDesc.input.write(cmd)

  }


  function add_cmd(this: any, msg: any, reply: any) {
    let name = msg.name
    let action = msg.action

    if ('string' === typeof name && 'function' === typeof action) {
      cmdMap[name] = action
    } else {
      this.fail('invalid-cmd')
    }

    reply()
  }
  add_cmd.desc = 'Add a REPL command dynamically'

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

    /*
    let server = intern.start_repl(seneca, options, cmdMap)

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
    */

    // } catch (e) {
    // console.log(e)
    // TODO: throw
    // }
  })

  return {
    name: 'repl',
    exportmap: {
      address: export_address,
    },
  }
}


function updateStatus(replDesc: any, newStatus: string) {
  replDesc.status = newStatus
  replDesc.log.push({
    kind: 'status',
    status: newStatus,
    when: Date.now()
  })
}


function make_intern() {
  return {
    // TODO: separate Net server construction from repl setup
    start_repl: function (
      seneca: any,
      options: any,
      _cmdMap: any,
      export_address: any,
      done: any
    ) {

      let server = Net.createServer(function (socket) {
        // console.log('CREATE')

        // TODO: pass this up to init so it can fail properly
        socket.on('error', function (err) {
          seneca.log.error('repl-socket', err)
        })

        seneca.act('sys:repl,use:repl', {
          // id: options.host+':'+options.port,
          input: socket,
          output: socket,
        }, function (err: any, res: any) {
          // console.log(err)
          if (err) {
            return done(err)
          }
          // console.log('RES', res)
          res.desc.status = 'open'
        })

      })

      server.listen(options.port, options.host)

      server.on('listening', function () {
        let address: any = server.address()

        export_address.port = address.port
        export_address.host = address.address
        export_address.family = address.family

        seneca.log.info({
          kind: 'notice',
          notice: 'REPL listening on ' + address.address + ':' + address.port,
        })

        // console.log('LISTENING')
        done()
      })

      server.on('error', function (err) {
        seneca.log.error(err)
      })


      return server
    },

    parse_option: function (optpath: any, val: any) {
      optpath += '.'

      let part = /([^.]+)\.+/g
      let m
      let out = {}
      let cur: any = out
      let po: any = out
      let pn: any

      while (null != (m = part.exec(optpath))) {
        cur[m[1]] = {}
        po = cur
        pn = m[1]
        cur = cur[m[1]]
      }
      po[pn] = val
      return out
    },

    make_inspect: function (context: any, inspect_options: any) {
      return (x: any) => {
        if (context.plain) {
          x = JSON.parse(JSON.stringify(x))
        }
        return Util.inspect(x, inspect_options)
      }
    },

    fmt_index: function (i: any) {
      return ('' + i).substring(1)
    },

    make_log_handler: function (context: any) {
      return function log_handler(data: any) {
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

    make_on_act_in: function (context: any) {
      return function on_act_in(actdef: any, args: any, meta: any) {
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

    make_on_act_out: function (context: any) {
      return function on_act_out(actdef: any, out: any, meta: any) {
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

    make_on_act_err: function (context: any) {
      return function on_act_err(_actdef: any, err: any, meta: any) {
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

    cmd_get: function (
      _cmd: any, argtext: any, context: any, _options: any, respond: any
    ) {
      let option_path = argtext.trim()
      let sopts = context.seneca.options()
      let out = Hoek.reach(sopts, option_path)
      return respond(null, out)
    },

    cmd_depth: function (
      _cmd: any, argtext: any, context: any, options: any, respond: any
    ) {
      let depth: any = parseInt(argtext, 10)
      depth = isNaN(depth) ? null : depth
      context.inspekt = intern.make_inspect(context, {
        ...options.inspect,
        depth: depth,
      })
      return respond(null, 'Inspection depth set to ' + depth)
    },

    cmd_plain: function (
      _cmd: any, _argtext: any, context: any, _options: any, respond: any
    ) {
      context.plain = !context.plain
      return respond()
    },

    cmd_quit: function (
      _cmd: any, _argtext: any, context: any, _options: any, _respond: any
    ) {
      context.socket.end()
    },

    cmd_list: function (
      _cmd: any, argtext: any, context: any, _options: any, respond: any
    ) {
      let narrow = context.seneca.util.Jsonic(argtext)
      respond(null, context.seneca.list(narrow))
    },

    cmd_find: function (
      _cmd: any, argtext: any, context: any, _options: any, respond: any
    ) {
      let narrow = context.seneca.util.Jsonic(argtext)
      respond(null, context.seneca.find(narrow))
    },

    cmd_prior: function (
      _cmd: any, argtext: any, context: any, _options: any, respond: any
    ) {
      let pdesc = (actdef: any) => {
        let d = {
          id: actdef.id,
          plugin: actdef.plugin_fullname,
          pattern: actdef.pattern,
          callpoint: undefined
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

    cmd_history: function (
      _cmd: any, _argtext: any, context: any, _options: any, respond: any
    ) {
      return respond(null, context.history.join('\n'))
    },

    cmd_log: function (
      _cmd: any, argtext: any, context: any, _options: any, respond: any
    ) {
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

    cmd_set: function (
      _cmd: any, argtext: any, context: any, options: any, respond: any
    ) {
      let m = argtext.match(/^\s*(\S+)\s+(\S+)/)

      if (m) {
        let setopt: any = intern.parse_option(
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

    cmd_alias: function (
      _cmd: any, argtext: any, context: any, _options: any, respond: any
    ) {
      let m = argtext.match(/^\s*(\S+)\s+(.+)[\r\n]?/)

      if (m) {
        context.alias[m[1]] = m[2]
        return respond()
      } else {
        return respond('ERROR: expected alias <name> <command>')
      }
    },

    cmd_trace: function (
      _cmd: any, _argtext: any, context: any, _options: any, respond: any
    ) {
      context.act_trace = !context.act_trace
      return respond()
    },

    cmd_help: function (
      _cmd: any, _argtext: any, context: any, _options: any, respond: any
    ) {
      return respond(null, context.cmdMap)
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
