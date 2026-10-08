// How-to: Connect to AWS Lambda. A handler for seneca-repl aws://lambda/...
//
// Deploy `handler` as the function handler. Running this file directly
// calls the handler with the same events seneca-repl sends, then exits.
const Seneca = require('seneca')
const Repl = require('../..') // in your project: require('@seneca/repl')
const Shop = require('./shop')

let started = null

// Start Seneca once per Lambda container, on the first invocation.
function start() {
  started =
    started ||
    (async () => {
      const seneca = Seneca({ log: 'warn' })
        .use(Shop)
        // A Lambda function cannot accept TCP connections.
        .use(Repl, { listen: false })
      await new Promise((resolve) => seneca.ready(resolve))

      // seneca-repl uses the session id "invoke" unless the URL has an
      // id parameter.
      await seneca.post('sys:repl,use:repl', { id: 'invoke' })
      return seneca
    })()
  return started
}

// The event is { body: { sys: 'repl', send: 'cmd', id, cmd } }.
// Return { statusCode, body } where body is the JSON reply.
async function handler(event) {
  const seneca = await start()
  const { id, cmd } = event.body || {}
  try {
    // Only REPL commands are accepted, whatever else the event contains.
    const reply = await seneca.post('sys:repl,send:cmd', { id, cmd })
    return { statusCode: 200, body: JSON.stringify(reply) }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error$: { code: err.code, message: err.message },
      }),
    }
  }
}

module.exports = { handler }

if (require.main === module) {
  const invoke = (id, cmd) =>
    handler({ body: { sys: 'repl', send: 'cmd', id, cmd: cmd + '\n' } })

  ;(async () => {
    try {
      console.log(await invoke('invoke', 'hello'))
      console.log(await invoke('invoke', 'role:shop,cmd:price,item:apple'))
      console.log(await invoke('other', '1 + 1'))
    } finally {
      await (await start()).close()
      console.log('closed')
    }
  })().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
