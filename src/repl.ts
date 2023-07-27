/* Copyright © 2015-2023 Richard Rodger and other contributors, MIT License. */

// TODO: make listener start flag controlled, useful tests

// NOTE: vorpal is not used server-side to keep things lean


import { PassThrough } from 'node:stream'

import Net, { Server } from 'node:net'
import Repl from 'node:repl'
import Vm from 'node:vm'

import { Open } from 'gubu'
import Hoek from '@hapi/hoek'

const Inks = require('inks')


import type { Cmd } from './types'

import { Cmds } from './cmds'

import { makeInspect } from './utils'


const intern = (repl.intern = make_intern())

const default_cmds: any = {}

for (let cmd of Object.values(Cmds)) {
  default_cmds[cmd.name.toLowerCase().replace(/cmd$/, '')] = cmd
}


function repl(this: any, options: any) {
  let seneca = this
  let mark = Math.random()

  let server: any = null
  let export_address: Record<string, any> = {}
  let replMap: Record<string, any> = {}
  let cmdMap: Record<string, any> = Object.assign({}, default_cmds, options.cmds)


  seneca.add('sys:repl,use:repl', use_repl)
  seneca.add('sys:repl,send:cmd', send_cmd)

  seneca.add('sys:repl,add:cmd', add_cmd)
  seneca.add('sys:repl,echo:true', (msg: any, reply: any) => reply(msg))

  seneca.message('role:seneca,cmd:close', cmd_close)


  seneca.prepare(async function () {
    if (options.listen) {

      server = Net.createServer(function (socket) {
        socket.on('error', function (err) {
          seneca.log.error('repl-socket', err)
        })

        let address: any = server.address()

        seneca.act('sys:repl,use:repl', {
          id: address.address + '~' + address.port,
          server,
          input: socket,
          output: socket,
        })
      })

      server.listen(options.port, options.host)

      let pres = new Promise<void>((resolve, reject) => {
        server.on('error', function (err: any) {
          seneca.log.error('repl-server', err)
          reject(err)
        })

        server.on('listening', function () {
          let address: any = server.address()

          export_address.port = address.port
          export_address.host = address.address
          export_address.family = address.family

          seneca.log.info({
            kind: 'notice',
            notice: 'REPL listening on ' + address.address + ':' + address.port,
          })

          resolve()
        })
      })

      return pres
    }
  })


  async function cmd_close(this: any, msg: any) {
    const seneca = this

    if (options.listen && server) {
      server.close((err: any) => {
        if (err) {
          seneca.log.error('repl-close-server', err)
        }
      })
    }

    for (let replInst of Object.values(replMap)) {
      await replInst.destroy()
    }

    return seneca.prior(msg)
  }


  function use_repl(this: any, msg: any, reply: any) {
    let seneca = this
    let replID = msg.id || (options.host + '~' + options.port)

    let replInst: ReplInstance = replMap[replID]

    if (replInst) {
      return reply({
        ok: true,
        repl: replInst
      })
    }

    let server = msg.server
    let input = msg.input || new PassThrough()
    let output = msg.output || new PassThrough()

    let replSeneca = seneca.root.delegate({ repl$: true, fatal$: false })

    replMap[replID] = replInst = new ReplInstance({
      id: replID,
      options,
      cmdMap,
      input,
      output,
      server,
      seneca: replSeneca
    })

    replInst.update('open')

    return reply({
      ok: true,
      repl: replInst
    })
  }


  function send_cmd(this: any, msg: any, reply: any) {
    let seneca = this

    // lookup repl by id, using steams to submit cmd and send back response

    let replID = msg.id || (options.host + ':' + options.port)
    let replInst = replMap[replID]

    if (null == replInst) {
      seneca.fail('unknown-repl', { id: replID })
    }
    else if ('open' !== replInst.status) {
      seneca.fail('invalid-status', { id: replID, status: replInst.status })
    }

    let cmd = msg.cmd

    let out: any = []

    // TODO: dedup this
    // use a FILO queue
    replInst.output.on('data', (chunk: Buffer) => {
      if (0 === chunk[0]) {
        reply({ out: out.join('') })
      }

      out.push(chunk.toString())
    })

    replInst.input.write(cmd)

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


  return {
    name: 'repl',
    exportmap: {
      address: export_address,
    },
  }
}


function updateStatus(replInst: any, newStatus: string) {
  replInst.status = newStatus
  replInst.log.push({
    kind: 'status',
    status: newStatus,
    when: Date.now()
  })
}


function make_intern() {
  return {
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
      return function on_act_out(_actdef: any, out: any, meta: any) {
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
  }
}


repl.defaults = {
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
    tree: 'seneca.root.private$.actrouter',
  }),
  inspect: Open({}),
  cmds: Open({
    // custom cmds
  }),
}


repl.Cmds = Cmds



class ReplInstance {
  id: string
  repl: any
  status: string = 'init'
  log: any[] = []
  input: any
  output: any
  server: Server | undefined
  seneca: any
  options: any
  cmdMap: any

  constructor(spec: any) {
    this.id = spec.id
    this.cmdMap = spec.cmdMap
    this.server = spec.server

    const options = this.options = spec.options
    const input = this.input = spec.input
    const output = this.output = spec.output
    const seneca = this.seneca = spec.seneca

    const repl = this.repl = Repl.start({
      prompt: 'seneca ' + seneca.version + ' ' + seneca.id + '> ',
      input,
      output,
      terminal: false,
      useGlobal: false,
      eval: this.evaluate.bind(this),
    })

    repl.on('exit', () => {
      this.update('closed')
      input.end()
      output.end()
    })

    repl.on('error', (err: any) => {
      seneca.log.error('repl', err)
    })


    Object.assign(repl.context, {
      // NOTE: don't trigger funnies with a .inspect property
      inspekt: makeInspect(repl.context, {
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
    })

    seneca.on_act_in = intern.make_on_act_in(repl.context)
    seneca.on_act_out = intern.make_on_act_out(repl.context)
    seneca.on_act_err = intern.make_on_act_err(repl.context)

    seneca.on('log', intern.make_log_handler(repl.context))
  }


  update(status: string) {
    this.status = status
  }


  evaluate(cmdtext: any, context: any, filename: any, respond: any) {
    const seneca = this.seneca
    const repl = this.repl
    const options = this.options
    const alias = options.alias
    const output = this.output
    let cmd_history = context.history

    cmdtext = cmdtext.trim()

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

    let argstr =
      'string' === typeof cmd ? cmdtext.substring(cmd.length) : ''

    // NOTE: alias can also apply just to command
    if (alias[cmd]) {
      cmd = alias[cmd]
    }

    let cmd_func: Cmd = this.cmdMap[cmd]

    if (cmd_func) {
      return cmd_func({ name: cmd, argstr, context, options, respond })
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
        let m = msg.split(/\s*~>\s*/)
        if (2 === m.length) {
          msg = m[0]
        }

        let injected_msg = Inks(msg, context)
        let args = seneca.util.Jsonic(injected_msg)

        if (null == args || Array.isArray(args) || 'object' !== typeof args) {
          return false
        }

        context.s.act(args, function (err: any, out: any) {
          context.err = err
          context.out = out

          if (m[1]) {
            let ma = m[1].split(/\s*=\s*/)
            if (2 === ma.length) {
              context[ma[0]] = Hoek.reach({ out: out, err: err }, ma[1])
            }
          }

          if (out && !repl.context.act_trace) {
            out =
              out && out.entity$
                ? out
                : context.inspekt(seneca.util.clean(out))
            output.write(out + '\n')
            output.write(new Uint8Array([0]))

          }
          else if (err) {
            output.write(context.inspekt(err) + '\n')
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


  async destroy(this: any) {
    const seneca = this.seneca

    try {
      this.input?.destroy && this.input.destroy()
    }
    catch (err) {
      seneca.log.error('repl-close-input', err, { id: this.id })
    }

    try {
      this.output?.destroy && this.output.destroy()
    }
    catch (err) {
      seneca.log.error('repl-close-output', err, { id: this.id })
    }

    if (this.server?.close && this.server.listening) {
      return new Promise<void>((resolve) => {
        this.server.close((err: any) => {
          if (err) {
            seneca.log.error('repl-close-server', err, { id: this.id })
          }
          resolve()
        })
      })
    }
  }
}

module.exports = repl
