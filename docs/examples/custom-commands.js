// How-to: Add custom commands and aliases.
const Seneca = require('seneca')
const Repl = require('../..') // in your project: require('@seneca/repl')
const Shop = require('./shop')

// A command receives { name, argstr, context, options, respond }.
// Call respond(err, result) exactly once.
function price(spec) {
  const item = spec.argstr.trim()
  spec.context.seneca.act('role:shop,cmd:price', { item }, function (err, out) {
    if (err) return spec.respond('ERROR: ' + err.message)
    spec.respond(null, item + ' costs ' + out.price)
  })
}

async function main() {
  const seneca = Seneca({ log: 'warn' })
    .use(Shop)
    .use(Repl, {
      listen: false,
      cmds: { price },
      alias: { apple: 'role:shop,cmd:price,item:apple' },
    })

  await new Promise((resolve) => seneca.ready(resolve))

  try {
    // Add a command while the service is running.
    await seneca.post('sys:repl,add:cmd', {
      name: 'items',
      action: (spec) => spec.respond(null, ['apple', 'pear']),
    })

    await seneca.post('sys:repl,use:repl', { id: 'demo' })

    for (const cmd of [
      'price pear',
      'price kiwi',
      'items',
      'apple',
      'alias pp price pear',
      'pp',
      'alias p price',
      'p apple',
    ]) {
      const reply = await seneca.post('sys:repl,send:cmd', { id: 'demo', cmd })
      console.log('> ' + cmd + '\n' + reply.out)
    }
  } finally {
    await seneca.close()
    console.log('closed')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
