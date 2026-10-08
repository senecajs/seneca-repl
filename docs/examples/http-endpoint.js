// Tutorial: Drive a REPL over HTTP. An HTTP endpoint for REPL commands.
//
//   node http-endpoint.js          send commands with fetch, print, exit
//   node http-endpoint.js --serve  keep running; connect with
//                                  seneca-repl http://127.0.0.1:8080/seneca-repl
const Http = require('node:http')
const Seneca = require('seneca')
const Repl = require('../..') // in your project: require('@seneca/repl')
const Shop = require('./shop')

async function start() {
  const seneca = Seneca({ log: 'warn' })
    .use(Shop)
    // No TCP port: this REPL is only reachable through the endpoint.
    .use(Repl, { listen: false })

  await new Promise((resolve) => seneca.ready(resolve))

  // Create the REPL session the endpoint uses. seneca-repl sends the
  // id "web" unless the URL has an id parameter.
  await seneca.post('sys:repl,use:repl', { id: 'web' })

  const server = Http.createServer((req, res) => {
    if ('POST' !== req.method || !req.url.startsWith('/seneca-repl')) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, err: 'Not found' }))
    }

    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
      let reply
      try {
        // The body is { id, cmd }. Reply with the whole result: { ok, out }.
        const { id, cmd } = JSON.parse(body)
        reply = await seneca.post('sys:repl,send:cmd', { id, cmd })
      } catch (err) {
        reply = { ok: false, err: '# ERROR: ' + err.message }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(reply))
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject) // for example, port 8080 is in use
      server.listen(8080, '127.0.0.1', resolve)
    })
  } catch (err) {
    await seneca.close()
    throw err
  }
  console.log('REPL endpoint: http://127.0.0.1:8080/seneca-repl')

  return { seneca, server }
}

async function send(id, cmd) {
  const res = await fetch('http://127.0.0.1:8080/seneca-repl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, cmd }),
  })
  return res.json()
}

async function main() {
  const { seneca, server } = await start()

  const stop = () =>
    new Promise((resolve) => server.close(() => seneca.close(resolve)))

  if (process.argv.includes('--serve')) {
    process.on('SIGINT', () => stop().then(() => process.exit(0)))
    return
  }

  try {
    console.log(await send('web', 'role:shop,cmd:price,item:apple'))
    console.log(await send('web', 'total = 3 * 1.5'))
    console.log(await send('web', 'total + 1'))
    console.log(await send('nope', '1 + 1'))
  } finally {
    await stop()
    console.log('closed')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
