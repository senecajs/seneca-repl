# Use the REPL over messages or a gateway

How to run REPL commands from your own code, with Seneca messages and no
TCP port, and how to build your own connector on top of that: an HTTP
endpoint, a gateway route, a WebSocket, a chat bot. The complete program
is [docs/examples/message-session.js](../examples/message-session.js).

## 1. Load the plugin without the TCP port

```js
const seneca = Seneca({ log: 'warn' })
  .use('repl', { listen: false })
```

`listen: false` is optional; the messages below work with the port open
too.

## 2. Create a session

```js
const created = await seneca.post('sys:repl,use:repl', { id: 'ops' })
```

The reply is `{ ok: true, repl }`, where `repl` is the session object
(`repl.id`, `repl.status`, `repl.input`, `repl.output`). If an open
session with that id exists, it is returned instead of a new one. Without
an `id`, the id is `<host>~<port>` from the plugin options
(`127.0.0.1~30303` by default).

## 3. Send commands

```js
const reply = await seneca.post('sys:repl,send:cmd', {
  id: 'ops',
  cmd: 'role:shop,cmd:price,item:apple ~> apple',
})
// { ok: true, out: "{ item: 'apple', price: 1.5 }\n" }
```

`cmd` is one line of REPL input; a newline is added when missing. `out`
is everything the session printed for it. A command that fails (a
JavaScript error, a message error) still replies `ok: true`, with the
error text in `out`.

The message itself fails, with a Seneca error, when there is no session
with that id (`unknown-repl`) or the session is not open
(`invalid-status`). See [Errors](../reference/errors.md).

## 4. Attach a session to your own streams

A session is a Node.js REPL reading from `input` and writing to
`output`. By default both are new `PassThrough` streams; pass your own
to connect the session to anything that is a stream:

```js
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
```

Write one line per command and read until the NUL character. This is how
the TCP port works: each connection's socket is both `input` and
`output`. When `input` ends, the session closes.

## The result

```sh
node message-session.js
```

prints (Seneca's error log entry for the unknown id is left out):

```
session ops open
"role:shop,cmd:price,item:apple ~> apple" -> {"ok":true,"out":"{ item: 'apple', price: 1.5 }\n"}
"apple.price * 4" -> {"ok":true,"out":"6\n"}
"seneca.list({ role: 'shop' }).length" -> {"ok":true,"out":"2\n"}
same session: true
error: unknown-repl seneca: REPL instance not found: nope.
stream -> "{ item: 'pear', quantity: 4, total: 9 }\n"
closed
```

## 5. Expose a session through an endpoint or a gateway

Whatever carries the commands, the pattern is the same: create the
session at startup, then turn each request into `sys:repl,send:cmd` and
send back the reply.

* For the `seneca-repl` client over HTTP, the request body is
  `{ id, cmd }` and the response must be the reply as JSON. The
  tutorial [Drive a REPL over HTTP](../tutorials/drive-a-repl-over-http.md)
  builds one with `node:http`.
* For the client's `aws:` protocol, the Lambda event body is the
  complete message `{ sys: 'repl', send: 'cmd', id, cmd }`; see
  [Connect to AWS Lambda](connect-to-aws-lambda.md).
* A gateway that turns request bodies into Seneca messages can carry
  these too. Let it accept `sys:repl,send:cmd` and nothing else from
  REPL clients.

Build the message from `id` and `cmd` yourself rather than passing a
request body on as a message, and protect the endpoint: see
[Secure the REPL](secure-the-repl.md). The exact formats are in
[Protocols](../reference/protocols.md).

## Lifetime

Sessions live until their input stream ends (for example `.exit`, or a
TCP client disconnecting) or the Seneca instance closes; then they are
removed. `seneca.close()` closes every session and the TCP port.

## See also

* [Messages](../reference/messages.md): every parameter and reply.
* [Why several ways to connect](../explanation/why-several-ways-to-connect.md).
