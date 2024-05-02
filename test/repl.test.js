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

    await si.use(Plugin).ready()

    await si.close()
  })

  it('multiple', async function () {
    const si = Seneca().use('promisify').test()

    await si
      .use(
        { tag: 'a', init: Plugin },
        { host: '0.0.0.0', port: 60606, depth: 1 },
      )
      .use(
        { tag: 'b', init: Plugin },
        { host: '0.0.0.0', port: 50505, depth: 1 },
      )
      .ready()

    await si.close()
  })

  it('fail-port', async function () {
    const si = Seneca({
      timeout: 555,
      error: {
        identify: function identifyError(e) {
          return (
            e instanceof Error ||
            Object.prototype.toString.call(e) === '[object Error]'
          )
        },
      },
      legacy: false,
      debug: { undead: true },
    })
      // .test('print')
      .quiet()

    try {
      await new Promise((resolve, reject) => {
        si.error((err) => {
          expect(err.code).toEqual('EADDRINUSE')
          resolve()
        })
          .use('promisify')
          .use(
            { tag: 'a', init: Plugin },
            { host: '0.0.0.0', port: 60606, depth: 1 },
          )
          .use(
            { tag: 'b', init: Plugin },
            { host: '0.0.0.0', port: 60606, depth: 1 },
          )
          // .use('..$a', { host: '0.0.0.0', port: 60606, depth: 1 })
          // .use('..$b', { host: '0.0.0.0', port: 60606, depth: 1 })
          .ready(reject)
      })
    } finally {
      await si.close()
    }
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
      },
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
      },
    })
  })

  it('cmd_data', async function () {
    const si = await Seneca({ tag: 'foo' }).test()
    Cmds.DataCmd({
      name: 'get',
      argstr: 'foo',
      context: { seneca: si, foo: { x: 1 } },
      options: {},
      respond: (err, out) => {
        expect(err).toBeNull()
        expect(out).toEqual('{"x":1}')
      },
    })
  })

  it('happy', async function () {
    const si = await Seneca()
      .use('promisify')
      .test()
      .use(Plugin, { port: 0 })
      .ready()

    const addr = si.export('repl/address')
    // console.log('ADDR', addr)

    let concheck = (good, bad) => {
      let result = ''
      let first = true
      const sock = Net.connect(addr.port, addr.host)
      sock
        .on('error', (err) => {
          // console.log('QQQ bad', err)
          bad(err)
        })
        .on('connect', () => {
          // console.log('QQQ connect')
          sock.write('hello\n')
        })
        .on('data', function (data) {
          // console.log('QQQ data')
          result = data.toString('ascii')
          // console.log('R=',result)
          expect(result).toContain('version')

          if (first) {
            setTimeout(function () {
              first = false
              sock.write('this\n')
            }, 50 * tmx)
          } else {
            // console.log(result)
            expect(result).toContain('seneca')
            // sock.write('seneca.quit\n')
            sock.destroy()
            sock.removeAllListeners('data')
            good()
          }
        })
    }

    return new Promise((good, bad) => {
      concheck(() => {
        // console.log('AAA')
        concheck(() => {
          // console.log('BBB')
          si.close(good)
        }, bad)
      }, bad)
    })
  })

  it('cmd-msg', async function () {
    let si = await Seneca()
      .use('promisify')
      .test()
      .use(Plugin, { port: 0 })
      .ready()

    let replres0 = await si.post('sys:repl,use:repl', { id: 'foo' })

    // console.log(replres0)
    expect(replres0.ok).toEqual(true)

    let res = await si.post('sys:repl,send:cmd', {
      id: 'foo',
      cmd: '1+2', // newline not required
    })

    expect(res.out).toEqual('3\n')

    res = await si.post('sys:repl,send:cmd', {
      id: 'foo',
      cmd: 'sys:repl,echo:true,x:1\n',
    })

    // console.log('RES0',res)
    expect(res.out).toEqual(
      "{ sys: 'repl', echo: true, x: 1, 'repl$': true, 'fatal$': false }\n",
    )

    res = await si.post('sys:repl,send:cmd', {
      id: 'foo',
      cmd: 'sys:repl,echo:true,x:2\n',
    })

    // console.log('RES1',res)
    expect(res.out).toEqual(
      "{ sys: 'repl', echo: true, x: 2, 'repl$': true, 'fatal$': false }\n",
    )

    let replres1 = await si.post('sys:repl,use:repl', { id: 'foo' })

    // console.log(replres1)
    expect(replres1.ok).toEqual(true)

    res = await si.post('sys:repl,send:cmd', {
      id: 'foo',
      cmd: 'sys:repl,echo:true,x:11\n',
    })

    // console.log('RES2',res)
    expect(res.out).toEqual(
      "{ sys: 'repl', echo: true, x: 11, 'repl$': true, 'fatal$': false }\n",
    )

    res = await si.post('sys:repl,send:cmd', {
      id: 'foo',
      cmd: 'sys:repl,echo:true,x:22\n',
    })

    // console.log('RES3',res)
    expect(res.out).toEqual(
      "{ sys: 'repl', echo: true, x: 22, 'repl$': true, 'fatal$': false }\n",
    )

    let replres2 = await si.post('sys:repl,use:repl', { id: 'bar' })

    // console.log(replres1)
    expect(replres2.ok).toEqual(true)

    res = await si.post('sys:repl,send:cmd', {
      id: 'bar',
      cmd: 'sys:repl,echo:true,x:111\n',
    })

    // console.log('RES2',res)
    expect(res.out).toEqual(
      "{ sys: 'repl', echo: true, x: 111, 'repl$': true, 'fatal$': false }\n",
    )

    res = await si.post('sys:repl,send:cmd', {
      id: 'bar',
      cmd: 'sys:repl,echo:true,x:222\n',
    })

    // console.log('RES3',res)
    expect(res.out).toEqual(
      "{ sys: 'repl', echo: true, x: 222, 'repl$': true, 'fatal$': false }\n",
    )

    await si.close()
  })

  it(
    'interaction',
    async function () {
      return new Promise((good, bad) => {
        Seneca({ legacy: false })
          // .test()
          .quiet()
          .use('promisify')
          .use('entity')
          .use('entity-util', { when: { active: true } })
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
            var sock = Net.connect(addr.port, addr.host)

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
                // expect: 'seneca',
                expect: '',
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
              {
                send: 'save$ foo x:1\n',
                expect: /Entity.*x: 1/s,
              },
              {
                send: 'save$ foo x:2\n',
                expect: /Entity.*x: 2/s,
              },
              {
                send: 'list$ foo\n',
                expect: /Entity.*x: 1.*x: 2/s,
              },
              {
                send: 'b={x:1}\n',
                expect: '{ x: 1 }',
              },
              {
                send: 'data b\n',
                expect: '{"x":1}',
              },
              {
                send: 'a:1,x:2\n',
                expect: 'x: 2',
              },
            ]

            // console.log('QUIT')
            // sock.write('seneca.quit()\n')

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
                if (null != step.expect) {
                  if ('string' === typeof step.expect) {
                    expect(result).toContain(step.expect)
                  } else if (step.expect instanceof RegExp) {
                    expect(result).toMatch(step.expect)
                  }
                }
                nextStep()
              }, 222 * tmx)
            }

            sock.write('hello\n')
            setTimeout(function () {
              expect(result).toContain('version')
              nextStep()
            }, 222 * tmx)
          })
      })
    },
    9999 * tmx,
  )
})
