'use strict'

// Load modules
var Net = require('net')
var Code = require('code')
var Lab = require('lab')
var Seneca = require('seneca')

// Shortcuts
var lab = (exports.lab = Lab.script())
var describe = lab.describe
var it = lab.it
var expect = Code.expect

var tmx = parseInt(process.env.TIMEOUT_MULTIPLIER, 10) || 1

describe('seneca-repl', function() {
  it('start', function(done) {
    var seneca = Seneca().test(done)

    var fn = function() {
      seneca
        .use('..', { host: '0.0.0.0', port: 60606, depth: 1 })
        .use('..', { host: '0.0.0.0', port: 50505, depth: 1 })
        .ready(function() {
          done()
        })
    }

    expect(fn).to.not.throw()
  })

  it('happy', function(done) {
    Seneca().test(done).use('..', { port: 0 }).ready(function() {
      var port = this.export('repl/address').port

      var result = ''
      var sock = Net.connect(port)
      var first = true

      sock.on('data', function(data) {
        result += data.toString('ascii')

        expect(result).to.contain('seneca')
        if (first) {
          setTimeout(function() {
            first = false
            expect(result).to.contain('->')
            sock.write('this\n')
          }, 50 * tmx)
        } else {
          expect(result).to.contain('->')
          sock.write('seneca.quit\n')
          sock.destroy()
          sock.removeAllListeners('data')
          done()
        }
      })
    })
  })

  it('interaction', { timeout: 9999 * tmx }, function(done) {
    Seneca({ log: 'silent' })
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
            return done()
          }

          result = ''

          console.log('SEND: ' + step.send)
          sock.write(step.send)
          setTimeout(function() {
            console.log('RESULT: ' + result)
            console.log('EXPECT: ' + step.expect)
            if (step.expect) {
              expect(result).to.contain(step.expect)
            }
            nextStep()
          }, 22 * tmx)
        }

        setTimeout(function() {
          expect(result).to.contain('seneca')
          nextStep()
        }, 222 * tmx)
      })
  })
})
