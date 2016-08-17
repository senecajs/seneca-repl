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
  it('can be used by seneca', function (done) {
    var seneca = Seneca({ log: 'silent', default_plugins: { repl: false } })

    var fn = function () {
      seneca
        .use(SenecaRepl, {port: 60606, depth: 1})
        .ready(function () {
          this.repl(60606)
          this.repl({port: 50505})
        })
    }

    expect(fn).to.not.throw()
    done()
  })

  it('accepts local connections and responds to commands', function (done) {
    internals.availablePort(function (port) {
      var seneca = Seneca({ log: 'silent', default_plugins: { repl: false } })
      seneca
        .use(SenecaRepl, { port: port })
        .ready(function () {
          seneca.repl()

          setTimeout(function () {
            var sock = Net.connect(port)
            var state = 0

            sock.on('readable', function () {
              var buffer = sock.read()
              if (!buffer) {
                return
              }

              var result = buffer.toString('ascii')

              if (state === 0) {
                expect(result).to.contain('seneca')
                sock.write('console.log(this)\n')
              }
              else if (state === 1) {
                expect(result).to.contain('{')
                sock.write('set foo.bar 1\n')
                sock.write('seneca.options().foo\n')
              }
              else if (state === 2) {
                expect(result).to.contain('bar')
                sock.write('list\n')
              }
              else if (state === 3) {
                expect(result).to.contain("{ role: 'seneca', stats: 'true' }")
                sock.write('role:seneca,stats:true\n')
              }
              else if (state === 4) {
                expect(result).to.contain('OUT 000000')
                sock.write('seneca.quit\n')
              }
              else if (state === 5) {
                expect(result).to.contain('seneca')
                done()
              }

              state++
            }, 3000)
          })
        })
    })
  })
})
