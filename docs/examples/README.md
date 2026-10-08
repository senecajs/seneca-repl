# Examples

Runnable programs that accompany the tutorials and how-to guides. Each
file loads the plugin from this repository (`require('../..')`); in your
own project use `require('@seneca/repl')`, or `seneca.use('repl')`.

Run them with Node.js 22 or later after `npm install` in the repository
(seneca-entity, used by `inspect.js`, is a development dependency):

```sh
node docs/examples/getting-started.js
```

Every program runs to completion and exits. The two marked `--serve`
can also keep running so that you can connect with `seneca-repl`; stop
them with Ctrl-C.

| File | Shows | Used in |
| ---- | ----- | ------- |
| [shop.js](shop.js) | The small plugin the other examples use. | |
| [getting-started.js](getting-started.js) | A service with the REPL on port 30303 and a minimal TCP client. `--serve` keeps it running. | [Getting started](../tutorials/getting-started.md) |
| [http-endpoint.js](http-endpoint.js) | An HTTP endpoint for REPL commands, called with `fetch`. `--serve` keeps it running on port 8080. | [Drive a REPL over HTTP](../tutorials/drive-a-repl-over-http.md) |
| [message-session.js](message-session.js) | Sessions created and used with `sys:repl,use:repl` and `sys:repl,send:cmd`, and a session on your own streams. | [Use the REPL over messages or a gateway](../how-to/use-the-repl-over-messages.md) |
| [custom-commands.js](custom-commands.js) | The `cmds` and `alias` options, `sys:repl,add:cmd` and the `alias` command. | [Add custom commands and aliases](../how-to/add-custom-commands-and-aliases.md) |
| [inspect.js](inspect.js) | `list`, `prior`, `trace`, `log match`, `~>`, templates, `delegate` and the entity commands. | [Inspect and send messages](../how-to/inspect-and-send-messages.md) |
| [lambda-handler.js](lambda-handler.js) | An AWS Lambda handler for `seneca-repl aws://lambda/...`, called locally. | [Connect to AWS Lambda](../how-to/connect-to-aws-lambda.md) |
