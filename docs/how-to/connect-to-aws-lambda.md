# Connect to AWS Lambda

How to use `seneca-repl` with a Seneca service that runs as an AWS
Lambda function. A function cannot accept connections, so the client
invokes it once per command. The handler is
[docs/examples/lambda-handler.js](../examples/lambda-handler.js).

## 1. Install the AWS SDK for the client

The client loads `@aws-sdk/client-lambda` only for `aws:` addresses. It
is not a dependency of `@seneca/repl`; install it where the client can
find it, globally next to a global `seneca-repl`, or in your project:

```sh
npm install -g @aws-sdk/client-lambda
```

Without it the client stops with:

```
Cannot find module '@aws-sdk/client-lambda'
...
Install the module @aws-sdk/client-lambda to access AWS Lambda REPLs.
```

The SDK takes credentials from its usual sources (environment
variables, `~/.aws` profiles, and so on). The caller needs permission to
invoke the function (`lambda:InvokeFunction`).

## 2. Write the handler

The client invokes the function with the event
`{ body: { sys: 'repl', send: 'cmd', id, cmd } }` and expects the
response `{ statusCode, body }`, with the reply of `sys:repl,send:cmd`
as JSON in `body`. For an error, it expects status code 500 and
`{ error$: { code, message } }`:

```js
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
```

The handler must not throw: return the 500 response instead.

## 3. Check it locally

Run the file directly. It calls the handler with the same events the
client sends:

```sh
node lambda-handler.js
```

```
{
  statusCode: 200,
  body: `{"ok":true,"out":"'{\\"version\\":\\"4.0.0-rc5\\",\\"id\\":\\"s3nwl1okpsah/1791443375956/21578/4.0.0-rc5/-\\",\\"when\\":1791443376129}'\\n"}`
}
{
  statusCode: 200,
  body: `{"ok":true,"out":"{ item: 'apple', price: 1.5 }\\n"}`
}
{
  statusCode: 500,
  body: '{"error$":{"code":"unknown-repl","message":"seneca: REPL instance not found: other."}}'
}
closed
```

(Seneca's error log entry for the unknown id is left out.)

## 4. Deploy and connect

Deploy `handler` as the function handler, then connect with the function
name and region:

```sh
npx seneca-repl 'aws://lambda/my-function?region=eu-west-1'
```

The address is `aws://lambda/<function name>`, with the query
parameters `region` (default `us-east-1`) and `id` (the session id,
default `invoke`). An error reply is printed as
`# ERROR: <code> <message>`; if it is the reply to the first command
(`hello`), the client exits.

## How sessions behave on Lambda

* Every command is a separate invocation. The session lives in the
  container that ran `start()`, so variables survive between commands
  only while the same warm container handles them.
* Several containers mean several independent sessions. A new container
  starts with a fresh session.
* The client waits for each invocation to finish before it sends the
  next command.

## See also

* [Protocols: AWS Lambda](../reference/protocols.md#aws-lambda): the
  exact payloads.
* [Secure the REPL](secure-the-repl.md).
* [Use the REPL over messages or a gateway](use-the-repl-over-messages.md).
