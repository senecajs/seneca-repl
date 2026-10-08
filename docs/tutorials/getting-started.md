# Getting started

In this tutorial you add a REPL to a small Seneca service, connect to it
with the `seneca-repl` client, send it messages, and look around. It
takes about fifteen minutes. The programs are in
[docs/examples](../examples/README.md): `shop.js` and
`getting-started.js`.

## 1. Install

You need Node.js 22 or later (24 is recommended). In a new directory:

```sh
npm init -y
npm install seneca @seneca/repl
```

## 2. Write a service

The service is a plugin with two actions. Save it as `shop.js`:

```js
// A small plugin used by the examples: prices and orders.
module.exports = function shop(options) {
  const prices = { apple: 1.5, pear: 2.25 }

  this.add('role:shop,cmd:price', function (msg, reply) {
    const price = prices[msg.item]
    if (null == price) {
      return reply(new Error('Unknown item: ' + msg.item))
    }
    reply({ item: msg.item, price })
  })

  this.add('role:shop,cmd:order', function (msg, reply) {
    this.act('role:shop,cmd:price', { item: msg.item }, function (err, out) {
      if (err) return reply(err)
      reply({
        item: msg.item,
        quantity: msg.quantity,
        total: out.price * msg.quantity,
      })
    })
  })
}
```

Now the program that runs it with a REPL. This is the start of
`getting-started.js`:

```js
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
```

In your own project, change the `require('../..')` line as the comment
says, or write `.use('repl')`: Seneca finds the `@seneca/repl` package
by that name.

The rest of the file is the `session` function, a small TCP client that
sends each command the way `seneca-repl` does and prints the responses.
It is there so that you can check the service without a second terminal.

## 3. Run the scripted session

```sh
node getting-started.js
```

```
REPL listening on 127.0.0.1:30303
> role:shop,cmd:price,item:apple
{ item: 'apple', price: 1.5 }

> role:shop,cmd:order,item:pear,quantity:2
{ item: 'pear', quantity: 2, total: 4.5 }

> list role:shop
[ { cmd: 'price', role: 'shop' }, { cmd: 'order', role: 'shop' } ]

> basket = ["apple", "pear"]
[ 'apple', 'pear' ]

> basket.length
2

closed
```

Each line was evaluated inside the running service:

* `role:shop,cmd:price,item:apple` is a message in Jsonic form (JSON
  without the braces and quotes). The REPL sent it to the service and
  printed the reply.
* `list role:shop` is a REPL command: it lists the patterns that match
  `role:shop`.
* `basket = ["apple", "pear"]` is JavaScript. The variable stays in the
  session, so the next line can use it.

The REPL plugin opened a TCP port on `127.0.0.1:30303` while the service
started, and `seneca.close()` closed it again, so the program exited.

## 4. Connect with seneca-repl

Start the service and leave it running:

```sh
node getting-started.js --serve
```

In a second terminal, start the client. With no arguments it connects to
`127.0.0.1:30303`:

```sh
npx seneca-repl
```

Type the messages and commands after the prompt. A session looks like
this (the stack trace is shortened here):

```
Connected to Seneca: {
  version: '4.0.0-rc5',
  id: 'i30uqutul25s/1791442827602/14841/4.0.0-rc5/-',
  when: 1791442829099,
  address: { address: '127.0.0.1', family: 'IPv4', port: 30303 }
}
i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> role:shop,cmd:price,item:apple

{ item: 'apple', price: 1.5 }

i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> role:shop,cmd:order,item:pear,quantity:2

{ item: 'pear', quantity: 2, total: 4.5 }

i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> list role:shop

[ { cmd: 'price', role: 'shop' }, { cmd: 'order', role: 'shop' } ]

i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> role:shop,cmd:price,item:kiwi

Uncaught Error: Unknown item: kiwi
    at Seneca.<anonymous> (/home/user/seneca-repl/docs/examples/shop.js:8:20)
    ...
  callpoint: 'at Seneca.<anonymous> (/home/user/seneca-repl/docs/examples/shop.js:8:20)'
}

i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> err.message

'Unknown item: kiwi'

i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> stats

{
  start: '2026-10-08T07:00:27.591Z',
  act: { calls: 9, done: 9, fails: 1, cache: 0 },
  actmap: undefined,
  now: '2026-10-08T07:00:35.491Z',
  uptime: 7900
}

i30uqutul25s/1791442827602/14841/4.0.0-rc5/-> quit
```

What you see:

* The client sent the `hello` command first and printed the reply: the
  Seneca version, the instance identifier, the time and the address. The
  prompt is the instance identifier.
* The `kiwi` message failed. The REPL printed the error, and saved it in
  the session variable `err` (the last reply is in `out`). The service
  also logged the failed action in its own terminal.
* `stats` is an alias for `seneca.stats()`.
* `quit` (or `exit`) ends the client. The service keeps running.

Leave the client running and restart the service: the client prints
`Connection closed.`, reconnects when the service is back, and prints
the new `Connected to Seneca` banner. Your command history is kept in
`~/.seneca` (see [Keep and clear history](../how-to/keep-and-clear-history.md)).

Stop the service with Ctrl-C.

## 5. What happened

* Loading the plugin with `.use(Repl)` (or `.use('repl')`) added the
  `sys:repl` messages to the service and, during plugin initialization,
  opened a TCP server. Options such as `port` and `host` change that;
  see the [options reference](../reference/options.md).
* Each connection got its own *session*: a Node.js REPL whose `seneca`
  variable is a delegate of the service's Seneca instance. Messages you
  type go through that delegate.
* Each line is checked in order: aliases, REPL commands, messages, and
  finally JavaScript. See
  [How the REPL evaluates input](../explanation/how-the-repl-evaluates-input.md).
* `seneca.close()` closed the sessions and the TCP server.

## Next steps

* [Drive a REPL over HTTP](drive-a-repl-over-http.md), for services you
  cannot reach on a local port.
* [Inspect and send messages](../how-to/inspect-and-send-messages.md):
  tracing, logs, priors, delegates and entities.
* [Secure the REPL](../how-to/secure-the-repl.md) before you run it
  anywhere other than your own machine.
* The [commands reference](../reference/commands.md) lists every
  command.
