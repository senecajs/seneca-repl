# Secure the REPL

How to keep the REPL from becoming a way into your service.

A REPL session runs any JavaScript inside the service process, with the
same privileges: `require`, `process` and the Seneca instance are all
available. The TCP port has no authentication and no encryption. Treat
access to the REPL as shell access to the machine.

## 1. Keep the TCP port on the loopback interface

The default `host` is `127.0.0.1`, so only programs on the same machine
can connect. Leave it. Do not set `host: '0.0.0.0'` or a public address.
Check where the port is with the `repl/address` export:

```js
seneca.ready(function () {
  console.log(seneca.export('repl/address'))
  // { port: 30303, host: '127.0.0.1', family: 'IPv4' }
})
```

`port: 0` picks a free port. That avoids clashes between services; it is
not a protection.

## 2. Turn the port off where you do not need it

With `listen: false` the plugin opens no port. Sessions then exist only
when your own code creates them with `sys:repl,use:repl`:

```js
seneca.use('repl', { listen: false })
```

## 3. Load the plugin only where you want it

```js
const seneca = Seneca()

if ('production' !== process.env.NODE_ENV) {
  seneca.use('repl')
}
```

## 4. Reach a remote REPL through SSH

To use the REPL of a service on another machine, keep its port on
`127.0.0.1` and forward it over SSH:

```sh
ssh -N -L 30303:127.0.0.1:30303 user@service-host
```

Then, on your machine, `npx seneca-repl` connects through the tunnel.

## 5. Protect HTTP and Lambda endpoints

The plugin has no HTTP server; the endpoint is your code (see
[Drive a REPL over HTTP](../tutorials/drive-a-repl-over-http.md)), so its
protection is your code too.

* Require authentication. The `seneca-repl` client sends no custom
  headers, but it sends the user and password of the URL as an HTTP
  Basic `Authorization` header:
  `npx seneca-repl 'https://alice:secret@staging.example.com/seneca-repl'`.
  Check that header in the endpoint. The client also keeps the query
  string, so a token parameter works too.
* Use HTTPS outside your own machine. The client supports `https://`
  URLs.
* Build the message yourself from `id` and `cmd`, as the examples do,
  so that the endpoint cannot be used to send any other message.
* Consider ignoring the `id` from the request and always using the one
  session you created.
* For AWS Lambda, control who may invoke the function with IAM; see
  [Connect to AWS Lambda](connect-to-aws-lambda.md).

The address you give `seneca-repl`, including any user, password or
token in it, is part of the name of its history file in `~/.seneca`
(see [Keep and clear history](keep-and-clear-history.md)).

## What the plugin does for you

Messages sent from a session go through a delegate that fixes the
directive `fatal$: false`, so an error in a message typed at the REPL is
never treated as fatal (a fatal error stops the service). That protects
the service from mistakes, not from people.

## See also

* [Options](../reference/options.md): `listen`, `host`, `port`.
* [Protocols](../reference/protocols.md): what travels over each
  connection.
