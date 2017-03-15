'use strict'

// Load modules
var Net = require('net')
var Code = require('code')
var Lab = require('lab')
var Seneca = require('seneca')
var SenecaRepl = require('..')

// Shortcuts
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var expect = Code.expect

var internals = {}

internals.availablePort = function (callback) {
  var server = Net.createServer()
  server.listen(0, function () {
    var port = server.address().port
    server.close(function () {
      callback(port)
    })
  })
}

describe('seneca-repl', function () {
  lab.beforeEach(function (done) {
    process.removeAllListeners('SIGHUP')
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGBREAK')
    done()
  })

  it('happy', function (done) {
    var seneca = Seneca({ log: 'silent', default_plugins: { repl: false } })

    var fn = function () {
      seneca
        // .use(SenecaRepl, {host: '0.0.0.0', port: 60606, depth: 1})
        .use('..', {host: '0.0.0.0', port: 60606, depth: 1})
        .use('..', {host: '0.0.0.0', port: 50505, depth: 1})
        .ready(function () {
          done()
        })
    }

    expect(fn).to.not.throw()
  })

  it('simple test - accepts local connections and responds to commands', function (done) {
    internals.availablePort(function (port) {
      function replTest (si) {
        var result = ''

        setTimeout(function () {
          var sock = Net.connect(port)
          var first = true

          sock.on('data', function (data) {
            result += data.toString('ascii')

            expect(result).to.contain('seneca')
            if (first) {
              setTimeout(function () {
                first = false
                expect(result).to.contain('->')
                sock.write('this\n')
              }, 50)
            }
            else {
              expect(result).to.contain('->')
              sock.write('seneca.quit\n')
              sock.destroy()
              sock.removeAllListeners('data')
              done()
            }
          }, 100)
        })
      }

      var seneca = Seneca().test(done)
      seneca.use(SenecaRepl, { port: port })
        .ready(function () {
          replTest(seneca)
        })
    })
  })

  it('accepts local connections and responds to commands', {timeout: 9999}, function (done) {
    internals.availablePort(function (port) {
      var seneca = Seneca()
      seneca
      .test(done)
      .use(SenecaRepl, { port: port })
      .ready(function () {
        setTimeout(function () {
          var sock = Net.connect(port)

          var result
          sock.on('data', function (buffer) {
            result += buffer.toString('ascii')
          })

          setTimeout(step00, 222)

          function step00 () {
            expect(result).to.contain('seneca')
            sock.write('console.log(this)\n')
            setTimeout(step01, 222)
          }

          function step01 () {
            expect(result).to.contain('{')
            sock.write('set foo.bar 1\n')
            sock.write('seneca.options().foo\n')
            setTimeout(step02, 222)
          }

          function step02 () {
            expect(result).to.contain('bar')
            sock.write('list\n')
            setTimeout(step03, 222)
          }

          function step03 () {
            expect(result).to.contain("{ cmd: 'close', role: 'seneca' }")
            sock.write('stats\n')
            setTimeout(step04, 222)
          }

          function step04 () {
            expect(result).to.contain('start')
            sock.write('seneca.quit()\n')
            setTimeout(step05, 222)
          }

          function step05 () {
            expect(result).to.contain('seneca')
            done()
          }
        }, 1111)
      })
    })
  })
})
