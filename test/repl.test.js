/* Copyright (c) 2012-2019 Richard Rodger, Wyatt Preul, and other contributors, MIT License */
'use strict'

const tmx = parseInt(process.env.TIMEOUT_MULTIPLIER, 10) || 1

const Util = require('util')
const Net = require('net')

// const Lab = require('@hapi/lab')
// const Code = require('@hapi/code')
// const PluginValidator = require('seneca-plugin-validator')

const Plugin = require('..')

const Seneca = require('seneca')

// const lab = (exports.lab = Lab.script())
// const describe = lab.describe
// const it = lab.it
// const expect = Code.expect

const { Cmds } = Plugin


describe('repl', function () {
  it('start', async function () {
    const si = Seneca().use('promisify').test()

    await si
      .use(Plugin)
      .ready()

    await si.close()
  })

  
  it('multiple', async function () {
    const si = Seneca().use('promisify').test()
    
    await si
      .use({tag:'a',init:Plugin}, { host: '0.0.0.0', port: 60606, depth: 1 })
      .use({tag:'b',init:Plugin}, { host: '0.0.0.0', port: 50505, depth: 1 })
      .ready()

    await si.close()
  })


  it('cmd_get', async function () {
    const si = await Seneca({ tag: 'foo' }).test()
    Cmds.GetCmd({
      name: 'get',
      argstr: 'tag',
      context: { seneca: si },
      options: {},
      respond: (err, out) => {
        expect(err).toBeNull()
        expect(out).toEqual('foo')
      }
    })
  })

  
  it('cmd_depth', async function () {
    const si = await Seneca().test()
    // Plugin.intern.cmd_depth('depth', '4', { seneca: si }, {}, (err, out) => {
    Cmds.DepthCmd({
      name: 'depth',
      argstr: '4',
      context: { seneca: si },
      options: {},
      respond: (err, out) => {
        expect(err).toBeNull()
        expect(out).toEqual('Inspection depth set to 4')
      }
    })
  })

  
  it('happy', async function () {
    var si = await Seneca()
      .use('promisify')
      .test()
      .use(Plugin, { port: 0 })
      .ready()

    var port = si.export('repl/address').port

    var result = ''
    var sock = Net.connect(port)
    var first = true

    return new Promise((good, bad) => {
      sock.on('data', function (data) {
        result += data.toString('ascii')

        expect(result).toContain('seneca')
        if (first) {
          setTimeout(function () {
            first = false

            expect(result).toContain('->')
            
            sock.write('this\n')
          }, 50 * tmx)
        } else {
          expect(result).toContain('->')
          sock.write('seneca.quit\n')
          sock.destroy()
          sock.removeAllListeners('data')
          si.close(good)
        }
      })
    })
  })
  


  it('cmd-msg', async function () {
    let si = await Seneca()
      .use('promisify')
      .test()
      .use(Plugin, { port: 0 })
      .ready()

    let replres = await si.post('sys:repl,use:repl',
                             {id:'foo'}
                            )

    // TODO: fix!
    // replres.desc.status = 'open'
    // console.log('DESC',replres.desc)
    
    let res = await si.post('sys:repl,send:cmd',{
      id: 'foo',
      cmd: 'sys:repl,echo:true,x:1\n'
    })

    // console.log('RES0',res)

    res = await si.post('sys:repl,send:cmd',{
      id: 'foo',
      cmd: 'sys:repl,echo:true,x:2\n'
    })

    // console.log('RES1',res)

    await si.close()
  })

    
  it('interaction', async function () {
    return new Promise((good, bad) => {
      Seneca({legacy:false})
      // .test()
        .quiet()
        .use('promisify')
        .add('a:1', function (msg, reply) {
          reply({ x: msg.x })
        })
        .add('e:1', function (msg, reply) {
          reply(new Error('eek'))
        })
        .use('..', { port: 0 })

        .act('sys:repl,add:cmd', {
          name: 'foo',
          // action: function (cmd, argtext, context, options, respond) {
          action: function (spec) {
            return spec.respond(null, 'FOO:' + spec.argstr)
          },
        })
      
        .ready(function () {
          let si = this
          
          var addr = this.export('repl/address')
          var port = addr.port

          var sock = Net.connect(port)

          var result
          sock.on('data', function (buffer) {
            result += buffer.toString('ascii')
          })

          // NOTE: \n needed at end
          var conversation = [
            {
              send: 'console.log(this)\n',
              expect: '{',
            },

            {
              send: 'set foo.bar 1\nseneca.options().foo\n',
              expect: 'bar',
            },
            {
              send: 'set zed qazwsxedcrfv\n',
              expect: '',
            },
            {
              send: 'get zed\n',
              expect: 'qazwsxedcrfv',
            },
            {
              send: 'list\n',
              expect: "{ cmd: 'close', role: 'seneca' }",
            },
            {
              send: 'stats\n',
              expect: 'start',
            },
            {
              send: 'list\n',
              expect: "role: 'seneca'",
            },
            {
              send: 'a:1,x:2\n',
              expect: 'x: 2',
            },
            {
              send: 'last\n',
              expect: 'x: 2',
            },
            {
              send: 'alias a1x3 a:1,x:3\n',
              expect: 'seneca',
            },
            {
              send: 'a1x3\n',
              expect: 'x: 3',
            },
            {
              send: 'e:1\n',
              expect: 'eek',
            },
            {
              send: 'foo bar\n',
              expect: 'FOO: bar',
            },
            {
              send: 'a=1\n',
              expect: '1',
            },
            {
              send: 'a:`$.a`,x:2\n',
              expect: 'x: 2',
            },
            {
              send: '1+1\n',
              expect: '2',
            },
          ]

          // console.log('QUIT')
          sock.write('seneca.quit()\n')

          function nextStep() {
            var step = conversation.shift()
            if (!step) {
              // return good()
              return si.close(good)
            }

            result = ''

            // console.log('SEND: '+step.send)
            sock.write(step.send)
            setTimeout(function () {
              // console.log('RESULT: '+result)
              // console.log('EXPECT: '+step.expect)
              if (step.expect) {
                expect(result).toContain(step.expect)
              }
              nextStep()
            }, 222 * tmx)
          }

          setTimeout(function () {
            expect(result).toContain('seneca')
            nextStep()
          }, 222 * tmx)
        })
    })
  }, 9999 * tmx)
})
