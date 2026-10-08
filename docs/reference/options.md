# Options reference

Every option of the plugin, with its type, default and effect.

## Setting options

```js
seneca.use('repl', { port: 0, depth: 4 })
```

Other ways, as for any Seneca plugin:

* The Seneca option `plugin.repl`:
  `Seneca({ plugin: { repl: { port: 0 } } })`.
* The command line: `node service.js --seneca.options.plugin.repl.port=0`.
* For a tagged instance, the tag: `seneca.use('repl$admin', { port: 0 })`,
  or `plugin['repl$admin']`.

The values are checked against the types of the defaults when the plugin
loads; a value of the wrong type (for example `port: '30303'`) is a
fatal `invalid_plugin_option` error. Seneca 4 does not read a top level
`repl` option (see [Migrate from Seneca 3](../how-to/migrate-from-seneca-3.md)).

## Options

| Option | Type | Default | Effect |
| ------ | ---- | ------- | ------ |
| `listen` | boolean | `true` | Open a TCP server while the plugin initializes. Each connection gets its own session. With `false` there is no port; create sessions with [`sys:repl,use:repl`](messages.md#sysrepluserepl). |
| `host` | string | `'127.0.0.1'` | Address the TCP server binds to. Also part of the default session id, `<host>~<port>`, used by `sys:repl,use:repl` and `sys:repl,send:cmd` when the message has no `id`. |
| `port` | number | `30303` | TCP port. `0` lets the operating system choose a free port; read the port from the [`repl/address`](exports.md#repladdress) export. A port that is in use makes initialization fail with `EADDRINUSE`, which is fatal. |
| `depth` | number | `11` | Inspection depth of `trace` and `log` lines. Each session starts with this value; the [`depth`](commands.md#depth) command changes it for one session. Replies to the commands you type are printed with the Node.js default depth (2). |
| `alias` | object | see below | Map of alias name to replacement text. Your aliases are added to the defaults. |
| `inspect` | object | `{}` | Extra [`util.inspect`](https://nodejs.org/api/util.html#utilinspectobject-options) options for `trace` and `log` lines, for example `{ colors: true }`. `depth` takes precedence over `inspect.depth`. |
| `cmds` | object | `{}` | Custom commands: map of command name to command function. They are added to the built in commands and replace a built in command of the same name. See [Add custom commands and aliases](../how-to/add-custom-commands-and-aliases.md). |

### Default aliases

| Alias | Replacement |
| ----- | ----------- |
| `stats` | `seneca.stats()` |
| `stats full` | `seneca.stats({summary:false})` |
| `stats/full` | `seneca.stats({summary:false})` (deprecated; use `stats full`) |

The alias map belongs to the plugin instance: all of its sessions share
it, and the [`alias`](commands.md#alias) command adds to it.

## Changing options at runtime

In a session, `set repl.<option> <value>` sets the Seneca option and
also changes the plugin options; sessions created afterwards use the new
values (see [`set`](commands.md#set)).

## Several instances

Load the plugin more than once with tags to get several ports:

```js
seneca
  .use('repl')                     // port 30303
  .use('repl$admin', { port: 0 })  // a second REPL, on a free port
```

Each instance has its own sessions, aliases and commands. Read each
address with the tagged export key, `repl$admin/address`; see
[Exports](exports.md#repladdress).
