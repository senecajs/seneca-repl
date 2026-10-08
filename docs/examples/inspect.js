// How-to: Inspect and send messages. A scripted session using the
// inspection commands, message shortcuts and entity commands.
const Seneca = require('seneca')
const Repl = require('../..') // in your project: require('@seneca/repl')
const Shop = require('./shop')

// Overrides role:shop,cmd:price; the original action becomes its prior.
function discount(options) {
  this.add('role:shop,cmd:price', function (msg, reply) {
    this.prior(msg, function (err, out) {
      if (err) return reply(err)
      reply({ ...out, price: out.price * 0.9 })
    })
  })
}

async function main() {
  const seneca = Seneca({ log: 'warn' })
    .use('entity') // seneca-entity, for the list$, save$, load$ commands
    .use(Shop)
    .use(discount)
    .use(Repl, { listen: false })

  await new Promise((resolve) => seneca.ready(resolve))

  try {
    await seneca.post('sys:repl,use:repl', { id: 'inspect' })

    for (const cmd of [
      'list role:shop',
      'prior role:shop,cmd:price',
      'trace',
      'role:shop,cmd:order,item:apple,quantity:2',
      'trace',
      'role:shop,cmd:price,item:pear ~> pear',
      'pear.price',
      'role:shop,cmd:order,item:`$.pear.item`,quantity:2',
      'depth 0',
      "log match case: 'OUT'",
      'role:shop,cmd:price,item:apple',
      'log',
      'depth 11',
      'save$ fruit name:apple,stock:10',
      'list$ fruit',
      'delegate ops {channel:ops}',
      'sys:repl,echo:true,x:1',
      'delegate repl$',
    ]) {
      const reply = await seneca.post('sys:repl,send:cmd', {
        id: 'inspect',
        cmd,
      })
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
