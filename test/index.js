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
      seneca.use(SenecaRepl)
    }

    expect(fn).to.not.throw()
    done()
  })

  it('accepts local connections and responds to commands', function (done) {
    internals.availablePort(function (port) {
      var seneca = Seneca({ log: 'silent', default_plugins: { repl: false } })
      seneca.use(SenecaRepl, { port: port })
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
            sock.write('seneca.quit\n')
          }
          else if (state === 2) {
            expect(result).to.contain('seneca')
            done()
          }

          state++
        }, 100)
      })
    })
  })
})
