# Commands reference

What you can type in a REPL session: the built in commands, messages,
JavaScript, and the session variables. The order in which a line is
interpreted is explained in
[How the REPL evaluates input](../explanation/how-the-repl-evaluates-input.md).

Commands that have nothing to print print `undefined`. Errors in
command arguments print as `Uncaught 'ERROR: ...'`.

## Input forms

| Form | Example | Effect |
| ---- | ------- | ------ |
| Alias | `stats` | A line equal to an alias name is replaced by the alias text. See [`alias`](#alias). |
| Command | `list role:shop` | A built in or custom command: the first word is the command name, the rest of the line its argument. |
| Message | `role:shop,cmd:price,item:apple` | A line that parses as a [Jsonic](https://github.com/jsonicjs/jsonic) object is sent as a message through the session's delegate. The reply is printed and stored in `out`, an error in `err`. |
| Message with a result variable | `role:shop,cmd:price,item:apple ~> p` | As above, and the reply is also stored in the variable `p`. |
| Message with a result path | `role:shop,cmd:price,item:apple ~> p=out.price` | Stores the value at the path `out.price` of `{ out, err }` in `p`. |
| Message with templates | ``role:shop,cmd:order,item:`$.p.item`,quantity:2`` | Backquoted parts are replaced before parsing, using [inks](https://github.com/rjrodger/inks): `` `$.<path>` `` is a value from the session variables (`$`), `` `<name>:<path>` `` is the value at `<path>` inside the variable `<name>`. |
| JavaScript | `basket = ['apple', 'pear']` | Anything else runs as JavaScript in the session context. `await` works at the start of a line and in a plain assignment (`x = await seneca.post(...)`). |
| Node.js REPL command | `.help` | Handled by the Node.js REPL; see [Node.js REPL commands](#nodejs-repl-commands). |

A JavaScript expression with `name:value` text and no space before the
colon can also parse as a Jsonic object: `seneca.list("role:shop")` is
sent as a message. Write the pattern as an object,
`seneca.list({ role: 'shop' })`, add a space (`seneca.list( "role:shop" )`),
or use the `list` command.

## Session variables

| Variable | Value |
| -------- | ----- |
| `seneca`, `s` | The current Seneca delegate. It starts as the session's own delegate, which fixes `repl$: true` and `fatal$: false` on every message; [`delegate`](#delegate) changes it. A result that is this delegate prints as `null`. |
| `out`, `err` | The reply and the error of the last message. |
| `_` | The last result (a Node.js REPL feature). |
| `history` | The lines this session received. |
| `alias` | The alias map (shared by all sessions of the plugin instance). |
| `cmdMap` | The command map, name to function. |
| `delegate` | Named delegates: `repl$` (the session's own), `root$` (the root instance) and those created with `delegate`. |
| `input`, `output` | The session's streams (for TCP, the socket). |
| `inspekt` | The function that formats trace and log lines. |
| `plain`, `act_trace`, `log_capture`, `log_match` | The state of `plain`, `trace` and `log`. |

The context also has the Node.js globals and `require`, `module` and
`process`. Variables you create stay until the session ends, or until
`.clear`.

## Built in commands

### `hello`

Print a JSON string with the Seneca `version`, the instance `id`, the
time (`when`) and, for TCP sessions, the local `address`. `seneca-repl`
sends it when it connects.

### `help`

Print the command map: every command name with its function.

### `list`

`list [pattern]` prints the patterns that match, with `seneca.list`.
Without a pattern, all patterns. `list plugins` (or `list plugin`)
prints the full names of the loaded plugins.

### `find`

`find <pattern>` prints the action definition that handles the pattern
(`seneca.find`). `find <name>`, with a plain plugin name, prints the
plugin record (`seneca.find_plugin`).

### `prior`

`prior <pattern>` prints the action for the pattern and every action it
overrides, newest first, as `{ id, plugin, pattern, callpoint }`.

### `get`

`get <path>` prints the Seneca option at the dotted path, for example
`get plugin.repl.port`.

### `set`

`set <path> <value>` sets a Seneca option with `seneca.options(...)`.
The value is parsed with Jsonic, so `set timeout 5000` sets a number.
When the path starts with `repl.`, the plugin options are changed too;
sessions created afterwards use them. Without both arguments:
`ERROR: expected set <path> <value>`.

### `alias`

`alias <name> <text>` adds an alias to the plugin instance's alias map.
A line equal to `<name>` is replaced by `<text>`. If the first word of a
line is an alias whose text is a command name, that command runs with
the rest of the line. Without both arguments:
`ERROR: expected alias <name> <command>`.

### `depth`

`depth <n>` sets the inspection depth of this session's trace and log
lines and prints `Inspection depth set to <n>`. Without a number, the
depth is unlimited (`null`). The starting value is the `depth` option.

### `plain`

Toggle plain mode: trace and log values are converted to plain JSON data
before they are printed (so class names such as `Entity` and functions
are left out).

### `trace`

Toggle message tracing for this session. While it is on, each message
sent from the session, and each message its actions send, prints:

```
IN  <n>: <message> # <message id> <pattern> <action id> <callpoint>
OUT <n>: <reply>
ERR <n>: <error message>
```

`<n>` pairs the lines. The reply of the message you typed is not printed
again.

### `log`

Toggle printing of the instance's log entries, as `LOG: <entry>` lines.
Entries of all levels are passed, before Seneca's level filtering.
`log match <text>` turns printing on and prints only entries whose
formatted text contains `<text>` (the rest of the line, taken
literally). `log` while printing is on turns it off and clears the
match.

### `history`

Print the lines this session received, oldest first.

### `last`

Run the previous line again. `last` itself is not added to the history.

### `data`

`data <variable>` prints the variable as JSON (with
[json-stringify-safe](https://github.com/moll/json-stringify-safe), so
circular references do not fail). In `seneca-repl`,
`data <variable> <file>` saves the JSON to `<file>` on the client's
machine instead of printing it. Without a variable:
`ERROR: expected: data <var> [local-file]`.

### `delegate`

Switch `seneca` (and `s`) to a named delegate, or create one. The
argument is parsed with Jsonic, as a list:

| Form | Effect |
| ---- | ------ |
| `delegate <name>` | Switch to an existing delegate: `repl$`, `root$`, or one you created. |
| `delegate <name> <fixedargs> [<fixedmeta>]` | Create a delegate of the current one, with the fixed message properties `<fixedargs>` (and fixed meta data), store it as `<name>` and switch to it. Example: `delegate ops {channel:ops}`. |
| `delegate <name> <from> <fixedargs> [<fixedmeta>]` | As above, but derive the new delegate from the named delegate `<from>`. |

Errors: `ERROR: delegate not found: <name>`,
`ERROR: delegate name reserved: <name>` (`repl$` and `root$` cannot be
created), `ERROR: delegate already exists: <name>`,
`ERROR: unknown delegate: <from>`.

### Entity commands

These need [seneca-entity](https://github.com/senecajs/seneca-entity).
`<canon>` is an entity name: `name`, `base/name` or `zone/base/name`.
The optional query or data is Jsonic.

| Command | Same as |
| ------- | ------- |
| `list$ <canon> [query]` | `seneca.entity(canon).list$(query)` |
| `load$ <canon> [query]` | `seneca.entity(canon).load$(query)` |
| `save$ <canon> [data]` | `seneca.entity(canon).save$(data)` |
| `remove$ <canon> [query]` | `seneca.entity(canon).remove$(query)` |
| `entity$ <canon>` | `seneca.entity(canon)`: an empty entity of that kind |

Without a canon: `ERROR: expected: list$ [[zone/]base/]name [query]`
(and the same for the others). When the entity operation fails:
`ERROR: entity <command>: <message>`.

### `stats` and `stats full`

Default aliases for `seneca.stats()` and `seneca.stats({summary:false})`
(the per pattern statistics). `stats/full` is a deprecated spelling of
`stats full`. See [Options: default aliases](options.md#default-aliases).

## Commands of the seneca-repl client

The client handles these lines itself; they are not sent to the service:

| Line | Effect |
| ---- | ------ |
| `quit`, `exit` | End the client. |
| `data <variable> <file>` | Sent as `data <variable>`; the client writes the reply to `<file>`. |
| `<% ... %>` anywhere in a line | A directive, replaced before the line is sent. See [Command line client: directives](cli.md#directives). |

## Node.js REPL commands

A session is a Node.js REPL, so its own commands work: `.break`,
`.clear`, `.exit`, `.help`, `.load <file>` and `.save <file>` (`.load`
and `.save` use files on the service's machine). They do not go through
the plugin, so they do not send the end of response marker:
`seneca-repl` prints their output together with the response to the next
line, and `sys:repl,send:cmd` gets no reply for them. `.exit` ends the
session (over TCP the client reconnects with a new session). `.clear`
removes your variables and starts the session variables afresh.
