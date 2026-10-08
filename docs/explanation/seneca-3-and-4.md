# Seneca 3 and Seneca 4

Version 9.2 of the plugin runs on Seneca 4 (tested with 4.0.0-rc5 and
4.0.0) and on Seneca 3 (tested with 3.38). This page explains what the
plugin does differently on each, and what changes for people using the
REPL. For the steps, see [Migrate from Seneca 3](../how-to/migrate-from-seneca-3.md).

## Closing

When `seneca.close()` runs, the plugin must close its sessions and its
TCP server, or the process stays alive. It does that in a prior of the
close action. Seneca 3 closes through `role:seneca,cmd:close`; Seneca 4
through `sys:seneca,cmd:close`. Seneca 4.0.0 also calls hooks on the old
pattern, for compatibility, but 4.0.0-rc5 does not. Version 9.1 of the
plugin used the old pattern only, so on rc5 its port stayed open.

The plugin picks the pattern from `seneca.version`. Asking Seneca
whether `sys:seneca,cmd:close` exists would not work: Seneca 3 accepts
`sys:seneca` patterns by translating them to `role:seneca`.

The close prior first destroys every session's streams and then closes
the server. In that order, closing does not wait for clients: closing
the server first would wait for every open connection to end.

## Starting

The plugin opens its TCP port in a callback style init function
(`this.init(done)`), and adds its actions with `seneca.add`. Seneca 4
also has promise based `prepare` and `message`, but on Seneca 3 those
come from seneca-promisify. Using the callback forms means the plugin
needs no extra plugin on either version.

## Option shapes

The plugin's options are checked by Seneca with
[Gubu](https://github.com/rjrodger/gubu). Seneca 4 uses Gubu 9 and
Seneca 3.38 uses Gubu 8, and a shape built by one copy of Gubu should
not be handed to another. So the plugin's `defaults` is a function that
receives the loading instance's builders (`{ valid }`) and builds the
shape with them. Earlier versions imported `gubu` themselves, without
declaring it as a dependency.

Seneca 4 reads plugin options only from `use` and `options.plugin`; a
top level `repl` option is an error there.

## What you see at the REPL

* **Builtin messages** are `sys:seneca,...` on Seneca 4
  (`sys:seneca,cmd:stats`), `role:seneca,...` on Seneca 3. `list` shows
  the names of the version you run. The `stats` aliases work on both.
* **Errors** are the original errors on Seneca 4: a failed message
  prints the error the action replied with, and `err.message` is its
  message. Seneca 3 wrapped it (`seneca: Action ... failed: ...`).
* **Promises** are built into Seneca 4: `await seneca.post(...)` works
  in any session. On Seneca 3 it needs seneca-promisify in the service.

Everything else is the same on both: the commands, the messages, the
client and the protocols.

## Node.js

Seneca 4 needs Node.js 22 or later. The plugin and its client are
tested on Node.js 24 and 22.

## See also

* The Seneca [migration guide](https://github.com/senecajs/seneca/blob/master/docs/how-to/migrate-from-seneca-3.md).
* [Change log](../../CHANGES.md).
