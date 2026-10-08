# Why several ways to connect

The plugin can be reached over a TCP port, over HTTP through your own
endpoint, through AWS Lambda invocations, and with plain Seneca
messages. This page explains why, and how one design serves all of
them.

## Where services run

A REPL on a local TCP port is perfect while you develop: start the
service, connect, type. It stops working as soon as the service runs
somewhere you cannot connect to: a container that publishes only an
HTTP port, a staging cluster behind a load balancer, a serverless
function that is invoked rather than connected to. Those are the places
where looking inside a running service is most useful, and hardest.

## Sessions do not care about the network

The plugin separates the session from the way it is reached. A session
is a Node.js REPL bound to an input stream and an output stream, and
nothing else. The TCP server is a small adapter: for each connection it
creates a session with the socket as both streams.

Without a connection, `sys:repl,use:repl` creates a session on streams
that only exist inside the process, and `sys:repl,send:cmd` turns the
stream conversation into request and reply: it writes one line to the
session's input and collects its output up to the NUL that ends each
response (see [How the REPL evaluates input](how-the-repl-evaluates-input.md#why-a-nul-at-the-end)).
Anything that can carry a request and a reply can now carry REPL
commands: an HTTP endpoint, a Lambda invocation, a gateway route, a
chat bot, a test.

## The client does the same in reverse

The `seneca-repl` client has the same shape. Its interactive part
(prompt, history, search, directives, `data` files) talks to a duplex
stream. Each protocol provides one: a TCP socket for `telnet:`, a stream
that turns each line into an HTTP POST for `http:` and `https:`, and a
stream that turns each line into a Lambda invocation for `aws:`. A
protocol is a module, `bin/protocol-<scheme>.js`, so adding one does not
change the rest of the client. The AWS module loads the AWS SDK only
when it is used, which is why the SDK is not a dependency.

## Why the plugin has no HTTP server

A service that can be reached over HTTP already has an HTTP server, with
its routing, its authentication and its deployment rules. A second
server opened by a debugging plugin would bypass all of them. So the
plugin provides the message, and the endpoint is a few lines in the
service's own server, protected like the rest of it. The same goes for
gateways and Lambda handlers.

## What each way costs

| Way | Session | Cost |
| --- | ------- | ---- |
| TCP port | One per connection; ends when the connection closes. | Needs network access to the port; no authentication or encryption, so keep it on the loopback interface. |
| HTTP endpoint | One per id, shared by every client that uses the id, kept between requests. | You write and protect the endpoint. |
| AWS Lambda | One per id in each warm container; a new container has a fresh session. | Every command is an invocation; state can disappear between commands. |
| Seneca messages | One per id, created by your code. | You choose how the commands arrive. |

## See also

* [Protocols](../reference/protocols.md): the formats.
* [Use the REPL over messages or a gateway](../how-to/use-the-repl-over-messages.md).
* [Secure the REPL](../how-to/secure-the-repl.md).
