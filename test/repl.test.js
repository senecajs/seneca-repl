/* Copyright (c) 2012-2019 Richard Rodger, Wyatt Preul, and other contributors, MIT License */
'use strict'


var tmx = parseInt(process.env.TIMEOUT_MULTIPLIER,10) || 1


const Util = require('util')
const Net = require('net')

const Lab = require('lab')
const Code = require('code')

const PluginValidator = require('seneca-plugin-validator')
const Plugin = require('..')

const  Seneca = require('seneca')

const lab = (exports.lab = Lab.script())
const describe = lab.describe
const it = lab.it
const expect = Code.expect



describe('repl', function() {
  it('start', async function() {
    var si = Seneca().use('promisify').test()

    await si
      .use(Plugin, { host: '0.0.0.0', port: 60606, depth: 1 })
      .use(Plugin, { host: '0.0.0.0', port: 50505, depth: 1 })
      .ready()

    await si.close()
  })
  

  it('happy', async function() {
    var si = await Seneca()
        .use('promisify')
        .test()
        .use(Plugin, { port: 0 })
        .ready()

    var port = si.export('repl/address').port

    var result = ''
    var sock = Net.connect(port)
    var first = true
    
    return new Promise((good,bad)=>{
      sock.on('data', function(data) {
        result += data.toString('ascii')
        
        expect(result).to.contain('seneca')
        if (first) {
          setTimeout(function() {
            first = false
            expect(result).to.contain('->')
            sock.write('this\n')
          }, 50*tmx)
        } else {
          expect(result).to.contain('->')
          sock.write('seneca.quit\n')
          sock.destroy()
          sock.removeAllListeners('data')
          good()
        }
      })
    })
  })

  it('interaction', { timeout: 9999*tmx }, async function() {
    return new Promise((good,bad)=>{
      Seneca({log:'silent'})
        .add('a:1', function(msg, reply) {
          reply({ x: msg.x })
        })
        .add('e:1', function(msg, reply) {
          reply(new Error('eek'))
        })
        .use('..', { port: 0 })
        .ready(function() {
          var port = this.export('repl/address').port

          var sock = Net.connect(port)

          var result
          sock.on('data', function(buffer) {
            result += buffer.toString('ascii')
          })

          var conversation = [
            {
              send: 'console.log(this)\n',
              expect: '{'
            },
            {
              send: 'set foo.bar 1\nseneca.options().foo\n',
              expect: 'bar'
            },
            {
              send: 'list\n',
              expect: "{ cmd: 'close', role: 'seneca' }"
            },
            {
              send: 'stats\n',
              expect: 'start'
            },
            {
              send: 'list\n',
              expect: "role: 'seneca'"
            },
            {
              send: 'a:1,x:2\n',
              expect: 'x: 2'
            },
            {
              send: 'last\n',
              expect: 'x: 2'
            },
            {
              send: 'alias a1x3 a:1,x:3\n',
              expect: 'seneca'
            },
            {
              send: 'a1x3\n',
              expect: 'x: 3'
            },
            {
              send: 'e:1\n',
              expect: 'eek'
            }
          ]

          sock.write('seneca.quit()\n')

          function nextStep() {
            var step = conversation.shift()
            if (!step) {
              return good()
            }

            result = ''

            //console.log('SEND: '+step.send)
            sock.write(step.send)
            setTimeout(function() {
              //console.log('RESULT: '+result)
              //console.log('EXPECT: '+step.expect)
              if (step.expect) {
                expect(result).to.contain(step.expect)
              }
              nextStep()
            }, 22*tmx)
          }

          setTimeout(function() {
            expect(result).to.contain('seneca')
            nextStep()
          }, 222*tmx)
        })
    })
  })
})
