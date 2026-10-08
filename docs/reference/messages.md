# Messages reference

The action patterns the plugin adds, with their parameters, replies and
errors. For a guide, see
[Use the REPL over messages or a gateway](../how-to/use-the-repl-over-messages.md).

## `sys:repl,use:repl`

Create a REPL session, or get the open session with the same id.

| Parameter | Type | Default | Meaning |
| --------- | ---- | ------- | ------- |
| `id` | string | `<host>~<port>` from the plugin options | Session id. |
| `input` | readable stream | a new `PassThrough` | Where the session reads its input, one command per line. |
| `output` | writable stream | a new `PassThrough` | Where the session writes its responses. |
| `server` | `net.Server` | none | Set by the plugin for TCP connections; not for your own use. |

Reply: `{ ok: true, repl }`. `repl` is the session object; its useful
properties are `id`, `status` (`'open'`, then `'closed'`), `input` and
`output`.

* If a session with the id exists and is open, it is returned and the
  other parameters are ignored.
* A new session is a Node.js REPL on the streams, with a Seneca delegate
  of the root instance that fixes `repl$: true` and `fatal$: false` on
  every message (its `did` ends with `~repl$`).
* The session closes when its input ends (a TCP client disconnects,
  `.exit`) and is removed about one second later; `seneca.close()`
  closes all sessions.

The TCP server calls this message for every connection, with the
socket as `input` and `output` and the id `<client address>~<client port>`.

## `sys:repl,send:cmd`

Run one line of input in a session and reply with what it printed.

| Parameter | Type | Default | Meaning |
| --------- | ---- | ------- | ------- |
| `id` | string | `<host>~<port>` from the plugin options | Session id. |
| `cmd` | string | none | One line of REPL input. A newline is added when missing. |

Reply: `{ ok: true, out }`. `out` is the text the session wrote for the
command, up to the end of response marker (which is not included). When
the command itself fails, for example with a JavaScript error or a
message error, the reply is still `ok: true` and `out` has the error
text.

Errors:

| Code | When |
| ---- | ---- |
| `unknown-repl` | No session has this id. |
| `invalid-status` | The session exists but is not open (it has closed and is about to be removed). |

The reply comes when the session writes the end of response marker.
Lines that never produce one, such as the Node.js REPL's own commands
(`.help`, `.exit` and the others), leave the message waiting until it
times out. See [Errors](errors.md).

## `sys:repl,add:cmd`

Add a REPL command to this plugin instance.

| Parameter | Type | Meaning |
| --------- | ---- | ------- |
| `name` | string | The command name. |
| `action` | function | The command function, called with `{ name, argstr, context, options, respond }`. |

Reply: none (`null` with `seneca.post`). The command is available at
once in every session of the instance, including open ones, and
replaces a command of the same name. Error: `invalid-cmd` when `name` is
not a string or `action` is not a function. See
[Add custom commands and aliases](../how-to/add-custom-commands-and-aliases.md).

## `sys:repl,echo:true`

Reply with the message itself. Sent from a session, it shows the
properties the session's delegate adds:

```
> sys:repl,echo:true,x:1
{ sys: 'repl', echo: true, x: 1, 'repl$': true, 'fatal$': false }
```

## Lifecycle actions

The plugin also takes part in two Seneca lifecycle actions:

| Pattern | What the plugin does |
| ------- | -------------------- |
| `role:seneca,plugin:init,init:repl` | Its init function opens the TCP server when `listen` is true and replies when the server is listening. A listen error (such as `EADDRINUSE`) is a fatal plugin initialization error. |
| `sys:seneca,cmd:close` (Seneca 4), `role:seneca,cmd:close` (Seneca 3) | A prior that closes every session and then the TCP server, and then continues the close. Called by `seneca.close()`. |

The plugin chooses the close pattern from `seneca.version`. See
[Seneca 3 and Seneca 4](../explanation/seneca-3-and-4.md).
