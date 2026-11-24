# Seneca 3 and Seneca 4

Version 10 of the plugin runs on Seneca 4 only. Version 9.1 and earlier
run on Seneca 3, and Seneca 3 users stay on version 9. This page
explains how the plugin works on Seneca 4, why earlier versions do not,
and what changes for people using the REPL. For the steps, see
[Migrate from Seneca 3](../how-to/migrate-from-seneca-3.md).

## Closing

When `seneca.close()` runs, the plugin must close its sessions and its
TCP server, or the process stays alive. It does that in a prior of the
close action, `sys:seneca,cmd:close`. Seneca 3 closed through
`role:seneca,cmd:close`. Version 9.1 of the plugin used that pattern
only, so on Seneca 4.0.0-rc5, which never calls it, its port stayed
open. Seneca 4.0.0 still calls hooks on the old pattern, with a
deprecation warning.

The close prior first destroys every session's streams and then closes
the server. In that order, closing does not wait for clients: closing
the server first would wait for every open connection to end.

## Starting

The plugin opens its TCP port in a callback style init function
(`this.init(done)`), and adds its actions with `seneca.add`. Seneca 4
also has promise based `prepare` and `message`; the callback forms
work the same and need no extra plugin. The plugin does not need
seneca-promisify, whose features are built into Seneca 4.

## Option shapes

The plugin's options are checked by Seneca against a shape. Seneca 4.0.0
validates with [shape](https://github.com/rjrodger/shape) 11, the renamed
successor of [Gubu](https://github.com/rjrodger/gubu), and rejects option
defaults built with Gubu (the fatal error `plugin_gubu_shape`). So the
plugin's `defaults` is a function that receives the loading instance's
builders (`{ valid }`) and builds the shape with them. Earlier versions
built the shape with their own import of `gubu`, which they did not
declare as a dependency; Seneca 4.0.0 rejects that shape, so those
versions do not load on it.

Seneca 4 reads plugin options only from `use` and `options.plugin`; a
top level `repl` option is an error there.

## What you see at the REPL

* **Builtin messages** are `sys:seneca,...` on Seneca 4
  (`sys:seneca,cmd:stats`), where Seneca 3 had `role:seneca,...`. `list`
  shows the `sys:seneca` names. The `stats` aliases work as before.
* **Errors** are the original errors on Seneca 4: a failed message
  prints the error the action replied with, and `err.message` is its
  message. Seneca 3 wrapped it (`seneca: Action ... failed: ...`).
* **Promises** are built into Seneca 4: `await seneca.post(...)` works
  in any session, without seneca-promisify.
* **Delegates** print their fixed message properties as `fixedmsg`,
  the Seneca 4 name.

Everything else is the same: the commands, the messages, the client and
the protocols.

## Node.js

Seneca 4 and version 10 of the plugin need Node.js 24 or later
(`engines.node` `>=24`).

## See also

* The Seneca [migration guide](https://github.com/senecajs/seneca/blob/master/docs/how-to/migrate-from-seneca-3.md).
* [Change log](../../CHANGES.md).
