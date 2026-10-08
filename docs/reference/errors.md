# Errors reference

## Plugin error codes

The plugin defines these codes (exported as `errors`, see
[Exports](exports.md)). The messages are Seneca errors: `err.code` is
the code, `err.message` starts with `seneca: `, and `err.details` has
the values in the message.

| Code | Message | Raised by |
| ---- | ------- | --------- |
| `unknown-repl` | `REPL instance not found: <id>.` | [`sys:repl,send:cmd`](messages.md#sysreplsendcmd) when no session has the id. `details: { id }`. |
| `invalid-status` | `REPL instance <id> is not open: <status>.` | [`sys:repl,send:cmd`](messages.md#sysreplsendcmd) when the session has closed. `details: { id, status }`. |
| `invalid-cmd` | `A REPL command needs a string name and a function action.` | [`sys:repl,add:cmd`](messages.md#sysrepladdcmd) with a missing name or a value that is not a function. |

For example, with `seneca.post`:

```js
try {
  await seneca.post('sys:repl,send:cmd', { id: 'nope', cmd: '1' })
} catch (err) {
  console.log(err.code, err.message)
  // unknown-repl seneca: REPL instance not found: nope.
}
```

Seneca also logs these failures as error entries.

## Errors from Seneca while the plugin loads

| Code | When |
| ---- | ---- |
| `invalid_plugin_option` | An option has the wrong type, for example `port: '30303'`. Fatal. |
| `EADDRINUSE` (and other `listen` errors) | The TCP port cannot be opened. The plugin's initialization fails, which is fatal. |

## Errors inside a session

Errors in what you type do not fail any message; they are printed in the
session:

| Output | Cause |
| ------ | ----- |
| `Uncaught Error: <message>` with a stack trace | A message you sent failed, or JavaScript threw. The error is also stored in `err` (for messages). |
| `Uncaught ReferenceError: ...`, `Uncaught SyntaxError: ...` | JavaScript errors. |
| `Uncaught 'ERROR: expected ...'` | A command was used with missing or wrong arguments, for example `set` without a value. The text says what was expected. |
| `Uncaught 'ERROR: delegate ...'` | The [`delegate`](commands.md#delegate) command could not find, create or reuse a delegate name. |

Errors printed by the `seneca-repl` client itself start with `#`, for
example `# CONNECTION ERROR:`; see
[Command line client: messages and exit codes](cli.md#messages-and-exit-codes).
