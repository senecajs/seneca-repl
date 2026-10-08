// Tutorial: Getting started. A service with a REPL on port 30303.
//
//   node getting-started.js          talk to the REPL over TCP, print, exit
//   node getting-started.js --serve  keep running; connect with seneca-repl
const Net = require('node:net')
const Seneca = require('seneca')
const Repl = require('../..') // in your project: require('@seneca/repl')
const Shop = require('./shop')

const seneca = Seneca({ log: 'warn' })
  .use(Shop)
  // Default options: listen on 127.0.0.1, port 30303.
  .use(Repl)

seneca.ready(function () {
  const address = seneca.export('repl/address')
  console.log('REPL listening on ' + address.host + ':' + address.port)

  if (process.argv.includes('--serve')) {
    // Stop with Ctrl-C: close Seneca, which also closes the REPL port.
    process.on('SIGINT', () => seneca.close(() => process.exit(0)))
    return
  }

  session(address, [
    'role:shop,cmd:price,item:apple',
    'role:shop,cmd:order,item:pear,quantity:2',
    'list role:shop',
    'basket = ["apple", "pear"]',
    'basket.length',
  ])
})

// Send each command the way seneca-repl does: one line per command. The
// REPL ends each response with a NUL character.
function session(address, commands) {
  const socket = Net.connect(address.port, address.host)
  let received = ''
  let index = -1

  socket.on('data', (chunk) => {
    received += chunk.toString('utf8')
    let end
    while (-1 !== (end = received.indexOf('\0'))) {
      const response = received.substring(0, end)
      received = received.substring(end + 1)
      if (-1 < index) {
        console.log('> ' + commands[index] + '\n' + response)
      }
      next()
    }
  })

  // Close Seneca on every path: done, failed, or closed by the service.
  socket.on('error', (err) => {
    console.error('Connection failed:', err.message)
    finish()
  })
  socket.on('close', finish)

  // seneca-repl sends hello first; the response describes the instance.
  socket.write('hello\n')

  function next() {
    index++
    if (index < commands.length) {
      socket.write(commands[index] + '\n')
    } else {
      finish()
    }
  }

  let finished = false
  function finish() {
    if (finished) return
    finished = true
    socket.destroy()
    seneca.close(() => console.log('closed'))
  }
}
