# Drive a REPL over HTTP

A TCP port is fine on your own machine, but a service in a container, a
staging cluster or a serverless platform is often reachable only over
HTTP. In this tutorial you add an HTTP endpoint that runs REPL commands,
then use it with `seneca-repl` and with curl. It takes about fifteen
minutes and assumes you have done [Getting started](getting-started.md).
The program is [docs/examples/http-endpoint.js](../examples/http-endpoint.js).

An HTTP endpoint that runs REPL commands lets anyone who can call it run
any code in your service. Keep it on the loopback interface while you
follow this tutorial, and read [Secure the REPL](../how-to/secure-the-repl.md)
before you expose one anywhere else.

## 1. How it fits together

The `seneca-repl` client, given an `http://` or `https://` URL, sends
each line you type as an HTTP POST with the JSON body `{ "id": ..., "cmd": ... }`.
Your endpoint passes those two values to the plugin's
`sys:repl,send:cmd` message, and returns the reply, `{ ok, out }`, as
JSON. The plugin keeps a REPL session for each `id`, so the session's
variables survive from one request to the next.

The plugin does not include an HTTP server. You write the endpoint with
whatever your service already uses; this tutorial uses `node:http`.

## 2. Create the session and the endpoint

The start of `http-endpoint.js`:

```js
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
```

Four things matter:

* `listen: false` stops the plugin from opening its TCP port.
* `sys:repl,use:repl` with `id: 'web'` creates the session. Commands
  for an id that has no session fail with the error `unknown-repl`.
* The endpoint replies with the whole `sys:repl,send:cmd` result. The
  client prints `out` when `ok` is true, and `err` otherwise.
* If the HTTP server cannot start, Seneca is closed before the error is
  passed on, so the process does not keep running half started.

`seneca.post` is the promise form of `seneca.act`, built into Seneca 4.

## 3. Run the scripted requests

The rest of the file sends a few commands with `fetch` and prints the
replies. Run it:

```sh
node http-endpoint.js
```

```
REPL endpoint: http://127.0.0.1:8080/seneca-repl
{ ok: true, out: "{ item: 'apple', price: 1.5 }\n" }
{ ok: true, out: '4.5\n' }
{ ok: true, out: '5.5\n' }
{"notice":"seneca: REPL instance not found: nope.","code":"unknown-repl", ...}
{ ok: false, err: '# ERROR: seneca: REPL instance not found: nope.' }
closed
```

(The fourth line is Seneca's error log entry, shortened here.)

The second request set `total = 3 * 1.5` and the third read it back:
both ran in the `web` session. The last request used the id `nope`,
which has no session.

## 4. Use the endpoint with seneca-repl

Start the service and leave it running:

```sh
node http-endpoint.js --serve
```

Connect with the client by giving it the endpoint URL:

```sh
npx seneca-repl http://127.0.0.1:8080/seneca-repl
```

```
Connected to Seneca: {
  version: '4.0.0-rc5',
  id: 'jzuq2vvg9v2r/1791442914365/15712/4.0.0-rc5/-',
  when: 1791442915826
}
jzuq2vvg9v2r/1791442914365/15712/4.0.0-rc5/-> role:shop,cmd:price,item:pear

{ item: 'pear', price: 2.25 }

jzuq2vvg9v2r/1791442914365/15712/4.0.0-rc5/-> seen = (typeof seen === "number" ? seen : 0) + 1

1

jzuq2vvg9v2r/1791442914365/15712/4.0.0-rc5/-> seen

1

jzuq2vvg9v2r/1791442914365/15712/4.0.0-rc5/-> quit
```

The banner has no `address`: the session is not attached to a network
connection. To use another session, add `?id=<id>` to the URL. An id
with no session ends the client at once:

```
$ npx seneca-repl 'http://127.0.0.1:8080/seneca-repl?id=other'
# ERROR: seneca: REPL instance not found: other.
```

## 5. Use the endpoint with curl

Any HTTP client works. The session is shared: the variable `seen` set
from `seneca-repl` is still there.

```sh
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"id":"web","cmd":"seen + 10"}' http://127.0.0.1:8080/seneca-repl
```

```
{"ok":true,"out":"11\n"}
```

```sh
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"id":"other","cmd":"1"}' http://127.0.0.1:8080/seneca-repl
```

```
{"ok":false,"err":"# ERROR: seneca: REPL instance not found: other."}
```

Stop the service with Ctrl-C.

## What you learned

* The plugin runs REPL sessions without a network connection;
  `sys:repl,use:repl` creates one and `sys:repl,send:cmd` runs a line in
  it.
* An HTTP endpoint is a few lines that pass `{ id, cmd }` to
  `sys:repl,send:cmd` and return the reply as JSON.
* Everyone who uses the same id shares the session.

## Next steps

* [Use the REPL over messages or a gateway](../how-to/use-the-repl-over-messages.md):
  the messages in detail, custom connectors, gateways.
* [Connect to AWS Lambda](../how-to/connect-to-aws-lambda.md): the same
  idea for functions that are invoked rather than called over HTTP.
* [Protocols](../reference/protocols.md): the exact request and reply
  formats.
