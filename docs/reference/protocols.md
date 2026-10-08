# Protocols reference

How commands and responses travel between a client and a REPL session.
Use this page to write your own client or endpoint.

## The end of response marker

A session writes the response to each line of input, then a NUL
character (code 0). Clients read until the NUL to know that the response
is complete.

* A response can arrive in several chunks, and one chunk can contain the
  end of one response and the start of the next. Collect bytes and split
  on NUL.
* `log` and `trace` lines are written when the log entries and messages
  happen, so they arrive before the response they belong to, or between
  responses.
* The Node.js REPL's own commands (`.help`, `.exit` and the others) do
  not write a NUL.

## TCP

The plugin's TCP server (option `listen`, at `host`:`port`) speaks the
session protocol directly:

| Direction | Content |
| --------- | ------- |
| Client to service | Lines of UTF-8 text, one command per line, ending with `\n`. |
| Service to client | The response text, then NUL. |

Each connection is its own session, with the id
`<client address>~<client port>`. There is no handshake; `seneca-repl`
starts by sending `hello` and reads the instance details from its reply.
Closing the connection closes the session. `seneca.close()` closes all
connections and the server.

The `getting-started.js` example has a minimal client
([docs/examples/getting-started.js](../examples/getting-started.js)).

## Seneca messages

Your code, or an endpoint, sends
[`sys:repl,send:cmd`](messages.md#sysreplsendcmd) with `{ id, cmd }` and
gets `{ ok: true, out }`. The plugin writes the line to the session and
collects the output up to the NUL, which is not included in `out`.

## HTTP

Used by `seneca-repl` for `http://` and `https://` addresses. The plugin
provides no HTTP server: the endpoint is yours, and must do this:

Request, one per line typed:

```
POST <the URL given to seneca-repl, with its query string>
Content-Type: application/json

{"id":"web","cmd":"role:shop,cmd:price,item:apple"}
```

`id` is the URL's `id` parameter, or `web`. `cmd` is the line, without
its newline. The first request is `{"id":...,"cmd":"hello"}`. User and
password in the URL are sent as an `Authorization: Basic` header.

Response: a JSON body (the status code is not checked).

| Body | The client prints |
| ---- | ----------------- |
| `{ "ok": true, "out": "<text>" }` | `<text>` |
| `{ "ok": false, "err": "<text>" }` | `<text>`, or `# ERROR: unknown` without `err` |
| not JSON | `# ERROR: invalid response (HTTP <status>): <parse error>` |

A request that fails (for example, connection refused) prints
`# ERROR: <error>`. An error in reply to `hello` ends the client. The
simplest endpoint passes `id` and `cmd` to `sys:repl,send:cmd` and
returns its reply as the body; see
[Drive a REPL over HTTP](../tutorials/drive-a-repl-over-http.md).

## AWS Lambda

Used by `seneca-repl` for `aws://lambda/<function name>` addresses, with
the AWS SDK `@aws-sdk/client-lambda`.

Invocation, one per line typed: an `InvokeCommand` with
`FunctionName: <function name>` and this payload (`cmd` keeps its
newline):

```json
{ "body": { "sys": "repl", "send": "cmd", "id": "invoke", "cmd": "role:shop,cmd:price,item:apple\n" } }
```

`id` is the URL's `id` parameter, or `invoke`. The client is created
with the URL's `region` parameter, or `us-east-1`.

Response: the function must return `{ statusCode, body }`, with `body` a
JSON string:

| Function result | The client prints |
| --------------- | ----------------- |
| `statusCode: 200`, body `{ "ok": true, "out": "<text>" }` | `<text>` |
| `statusCode: 500`, body `{ "error$": { "code": "<code>", "message": "<message>" } }` | `# ERROR: <code> <message>` |
| An invocation whose SDK response does not have `StatusCode` 200 | `# ERROR: ` and the SDK response as JSON |
| An invocation that fails in the SDK | `# ERROR invoking Lambda function: <error>` |

See [Connect to AWS Lambda](../how-to/connect-to-aws-lambda.md) for a
handler.
