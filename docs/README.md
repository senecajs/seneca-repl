# @seneca/repl documentation

The documentation follows the [Diátaxis](https://diataxis.fr/)
structure: four sections with four different jobs. Start with the
tutorials if you are new to the plugin; use the how-to guides for
specific tasks; look things up in the reference; read the explanations
to understand the design.

The plugin gives a running Seneca service an interactive REPL. It works
with Seneca 4 (4.0.0-rc5 and later) and Seneca 3 (3.38 tested), on
Node.js 24 and 22.

## Tutorials

Learning oriented lessons that take you through building something,
step by step.

| Tutorial | What you build |
| -------- | -------------- |
| [Getting started](tutorials/getting-started.md) | A service with a REPL on a local port, used with the `seneca-repl` client. |
| [Drive a REPL over HTTP](tutorials/drive-a-repl-over-http.md) | An HTTP endpoint for REPL commands, used with `seneca-repl` and curl. |

The programs from the tutorials and the how-to guides are in
[examples](examples/README.md).

## How-to guides

Task oriented recipes for people who already know the basics.

| Guide | Covers |
| ----- | ------ |
| [Secure the REPL](how-to/secure-the-repl.md) | Loopback only, turning the port off, SSH tunnels, protecting endpoints. |
| [Inspect and send messages](how-to/inspect-and-send-messages.md) | Messages, result variables, templates, `list`, `prior`, `trace`, `log`, delegates, entities, `data`. |
| [Add custom commands and aliases](how-to/add-custom-commands-and-aliases.md) | The `cmds` and `alias` options, `sys:repl,add:cmd`, the `alias` command. |
| [Use the REPL over messages or a gateway](how-to/use-the-repl-over-messages.md) | `sys:repl,use:repl`, `sys:repl,send:cmd`, sessions on your own streams, endpoints and gateways. |
| [Connect to AWS Lambda](how-to/connect-to-aws-lambda.md) | The handler, the AWS SDK for the client, `aws://lambda/...` addresses, sessions on Lambda. |
| [Keep and clear history](how-to/keep-and-clear-history.md) | History files, separate histories, search, clearing, the session history. |
| [Migrate from Seneca 3](how-to/migrate-from-seneca-3.md) | Versions, plugin options, builtin message names, errors, promises. |

## Reference

Information oriented descriptions of every part of the plugin.

| Reference | Describes |
| --------- | --------- |
| [Options](reference/options.md) | Every option with its type, default and effect. |
| [Commands](reference/commands.md) | Every REPL command, the input forms and the session variables. |
| [Messages](reference/messages.md) | Every action pattern: parameters, replies, errors; the lifecycle actions. |
| [Command line client](reference/cli.md) | `seneca-repl` arguments, protocols, keys, directives, reconnection, exit codes. |
| [Protocols](reference/protocols.md) | The end of response marker, and the TCP, message, HTTP and AWS Lambda formats. |
| [Exports](reference/exports.md) | `repl/address`, the module exports, the TypeScript types. |
| [Errors](reference/errors.md) | The plugin's error codes and the errors shown in sessions. |

## Explanation

Understanding oriented discussions of how the plugin works and why.

| Explanation | Topic |
| ----------- | ----- |
| [How the REPL evaluates input](explanation/how-the-repl-evaluates-input.md) | Sessions, the order in which a line is read, messages before JavaScript, delegates, the NUL marker, limits. |
| [Why several ways to connect](explanation/why-several-ways-to-connect.md) | Sessions independent of the network, the client's protocols, why there is no HTTP server, costs. |
| [Seneca 3 and Seneca 4](explanation/seneca-3-and-4.md) | Closing, starting, option shapes, and what REPL users notice. |

## Feature index

Every option, action pattern, export, error code, command, client
argument and protocol of the plugin, with the page that documents it.
The plugin adds no decorations to the Seneca instance.

| Feature | Kind | Documented in |
| ------- | ---- | ------------- |
| `listen` | option | [Options](reference/options.md#options) |
| `host` | option | [Options](reference/options.md#options) |
| `port` | option | [Options](reference/options.md#options) |
| `depth` | option | [Options](reference/options.md#options) |
| `alias` | option | [Options](reference/options.md#options), [default aliases](reference/options.md#default-aliases) |
| `inspect` | option | [Options](reference/options.md#options) |
| `cmds` | option | [Options](reference/options.md#options), [Add custom commands](how-to/add-custom-commands-and-aliases.md) |
| `sys:repl,use:repl` | action pattern | [Messages](reference/messages.md#sysrepluserepl) |
| `sys:repl,send:cmd` | action pattern | [Messages](reference/messages.md#sysreplsendcmd) |
| `sys:repl,add:cmd` | action pattern | [Messages](reference/messages.md#sysrepladdcmd) |
| `sys:repl,echo:true` | action pattern | [Messages](reference/messages.md#sysreplechotrue) |
| `role:seneca,plugin:init,init:repl` | init action (opens the TCP port) | [Messages: lifecycle](reference/messages.md#lifecycle-actions) |
| `sys:seneca,cmd:close`, `role:seneca,cmd:close` | close prior | [Messages: lifecycle](reference/messages.md#lifecycle-actions), [Seneca 3 and 4](explanation/seneca-3-and-4.md#closing) |
| `repl/address`, `repl$<tag>/address` | export | [Exports](reference/exports.md#repladdress) |
| Plugin function, `defaults`, `errors`, `Cmds`, `intern` | module exports | [Exports](reference/exports.md#module-exports) |
| `CmdSpec`, `Cmd` | TypeScript types | [Exports](reference/exports.md#typescript) |
| `unknown-repl` | error code | [Errors](reference/errors.md#plugin-error-codes) |
| `invalid-status` | error code | [Errors](reference/errors.md#plugin-error-codes) |
| `invalid-cmd` | error code | [Errors](reference/errors.md#plugin-error-codes) |
| `invalid_plugin_option`, `EADDRINUSE` | errors while loading | [Errors](reference/errors.md#errors-from-seneca-while-the-plugin-loads) |
| Messages, `~>`, templates, JavaScript, `await` | input forms | [Commands](reference/commands.md#input-forms), [How input is evaluated](explanation/how-the-repl-evaluates-input.md) |
| `seneca`, `s`, `out`, `err`, `_`, `history`, `alias`, `cmdMap`, `delegate`, `input`, `output` | session variables | [Commands](reference/commands.md#session-variables) |
| `hello` | command | [Commands](reference/commands.md#hello) |
| `help` | command | [Commands](reference/commands.md#help) |
| `list`, `list plugins` | command | [Commands](reference/commands.md#list) |
| `find` | command | [Commands](reference/commands.md#find) |
| `prior` | command | [Commands](reference/commands.md#prior) |
| `get` | command | [Commands](reference/commands.md#get) |
| `set` | command | [Commands](reference/commands.md#set) |
| `alias` | command | [Commands](reference/commands.md#alias) |
| `depth` | command | [Commands](reference/commands.md#depth) |
| `plain` | command | [Commands](reference/commands.md#plain) |
| `trace` | command | [Commands](reference/commands.md#trace) |
| `log`, `log match` | command | [Commands](reference/commands.md#log) |
| `history` | command | [Commands](reference/commands.md#history) |
| `last` | command | [Commands](reference/commands.md#last) |
| `data` | command | [Commands](reference/commands.md#data) |
| `delegate` | command | [Commands](reference/commands.md#delegate) |
| `list$`, `load$`, `save$`, `remove$`, `entity$` | entity commands | [Commands](reference/commands.md#entity-commands) |
| `stats`, `stats full`, `stats/full` | default aliases | [Commands](reference/commands.md#stats-and-stats-full) |
| `.break`, `.clear`, `.exit`, `.help`, `.load`, `.save` | Node.js REPL commands | [Commands](reference/commands.md#nodejs-repl-commands) |
| `seneca-repl`, `seneca-repl <host> <port>`, `seneca-repl <address>` | client arguments | [Command line client](reference/cli.md#usage) |
| `telnet:`, `http:`, `https:`, `aws:` | client protocols | [Command line client](reference/cli.md#protocols), [Protocols](reference/protocols.md) |
| `id`, `region` | address query parameters | [Command line client](reference/cli.md#protocols) |
| `bin/protocol-<scheme>.js` | client protocol modules | [Command line client](reference/cli.md#protocols) |
| `quit`, `exit`, Ctrl-D | client commands | [Command line client](reference/cli.md#session), [Commands](reference/commands.md#commands-of-the-seneca-repl-client) |
| `data <variable> <file>` | client command | [Command line client](reference/cli.md#session) |
| Up, Down, Tab, Ctrl-R, Ctrl-G | client keys | [Command line client](reference/cli.md#keys) |
| `~/.seneca/repl-<address>.history` | client history files | [Command line client](reference/cli.md#history), [Keep and clear history](how-to/keep-and-clear-history.md) |
| Reconnection | client behaviour | [Command line client](reference/cli.md#reconnecting) |
| `<% %>`, `Load`, `Match`, `VxgAction`, `VXGACT` | client directives | [Command line client](reference/cli.md#directives) |
| Client messages and exit codes | client output | [Command line client](reference/cli.md#messages-and-exit-codes) |
| NUL end of response marker | protocol | [Protocols](reference/protocols.md#the-end-of-response-marker) |
| TCP session protocol | protocol | [Protocols](reference/protocols.md#tcp) |
| HTTP request and response | protocol | [Protocols](reference/protocols.md#http), [Drive a REPL over HTTP](tutorials/drive-a-repl-over-http.md) |
| AWS Lambda payload and response | protocol | [Protocols](reference/protocols.md#aws-lambda), [Connect to AWS Lambda](how-to/connect-to-aws-lambda.md) |

## Other documents

* [Change log](../CHANGES.md)
* [Version 6 release notes](../doc/version-6-release-pub.md) and the
  [version 6 plan](../doc/version-6-pub.md) (2023)
* [Code of conduct](../CODE_OF_CONDUCT.md)
* [License](../LICENSE)
