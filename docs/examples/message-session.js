// How-to: Use the REPL over Seneca messages. Sessions without a TCP port.
const { PassThrough } = require('node:stream')
const Seneca = require('seneca')
const Repl = require('../..') // in your project: require('@seneca/repl')
const Shop = require('./shop')

async function main() {
  const seneca = Seneca({ log: 'warn' }).use(Shop).use(Repl, { listen: false })

  await new Promise((resolve) => seneca.ready(resolve))

  try {
    // 1. Create a session with an id of your choice.
    const created = await seneca.post('sys:repl,use:repl', { id: 'ops' })
    console.log('session', created.repl.id, created.repl.status)

    // 2. Send commands to it. Each reply is { ok: true, out: <text> }.
    for (const cmd of [
      'role:shop,cmd:price,item:apple ~> apple',
      'apple.price * 4',
      "seneca.list({ role: 'shop' }).length",
    ]) {
      const reply = await seneca.post('sys:repl,send:cmd', { id: 'ops', cmd })
      console.log(JSON.stringify(cmd), '->', JSON.stringify(reply))
    }

    // 3. Asking for the same id again returns the open session.
    const again = await seneca.post('sys:repl,use:repl', { id: 'ops' })
    console.log('same session:', again.repl === created.repl)

    // 4. An unknown id is an error.
    try {
      await seneca.post('sys:repl,send:cmd', { id: 'nope', cmd: '1' })
    } catch (err) {
      console.log('error:', err.code, err.message)
    }

    // 5. Attach a session to your own streams, as a custom connector does.
    const input = new PassThrough()
    const output = new PassThrough()
    await seneca.post('sys:repl,use:repl', { id: 'stream', input, output })

    let text = ''
    const response = new Promise((resolve) => {
      output.on('data', (chunk) => {
        text += chunk.toString()
        // The end of each response is marked with a NUL character.
        if (text.includes('\0')) resolve(text.replace('\0', ''))
      })
    })
    input.write('role:shop,cmd:order,item:pear,quantity:4\n')
    console.log('stream ->', JSON.stringify(await response))
  } finally {
    await seneca.close()
    console.log('closed')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
