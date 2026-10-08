# Migrate from Seneca 3

How to move a service that uses the REPL from Seneca 3 to Seneca 4, and
what changes for people typing at the REPL. The Seneca 4 changes
themselves are described in the Seneca
[migration guide](https://github.com/senecajs/seneca/blob/master/docs/how-to/migrate-from-seneca-3.md).

## 1. Update Node.js and the packages

Seneca 4 needs Node.js 22 or later. Use `@seneca/repl` 9.2 or later:

```sh
npm install seneca@4 @seneca/repl@latest
```

While Seneca 4 is a prerelease, install `seneca@4.0.0-rc5` (or later)
instead of `seneca@4`.

Earlier versions of the plugin register their close hook on the
Seneca 3 pattern `role:seneca,cmd:close`. Seneca 4.0.0-rc5 never calls
it, so `seneca.close()` leaves the REPL port open and the process does
not exit. Version 9.2 uses `sys:seneca,cmd:close` on Seneca 4.

The plugin does not need seneca-transport or seneca-promisify on either
Seneca version: its TCP port is its own server.

## 2. Pass plugin options the Seneca 4 way

Seneca 3 also read plugin options from a top level key named after the
plugin. Seneca 4 reads them only from `use` and from `options.plugin`,
and rejects the top level key when the instance is created
(`GubuError: Validation failed for object ... because the property
"repl" is not allowed.`):

```js
// Seneca 3 only
Seneca({ repl: { port: 0 } }).use('repl')

// Seneca 3 and 4
Seneca().use('repl', { port: 0 })
Seneca({ plugin: { repl: { port: 0 } } }).use('repl')
```

On the command line: `node service.js --seneca.options.plugin.repl.port=0`.

## 3. Use the new names of the builtin messages

Seneca 4 calls its builtin actions `sys:seneca,...` instead of
`role:seneca,...`. Messages typed at the REPL change accordingly:

| Seneca 3 | Seneca 4 |
| -------- | -------- |
| `role:seneca,cmd:stats` | `sys:seneca,cmd:stats` |
| `role:seneca,cmd:ping` | `sys:seneca,cmd:ping` |
| `role:seneca,get:options` | `sys:seneca,get:options` |

The `stats` and `stats full` aliases call `seneca.stats()`, which works
on both. `list` shows the `sys:seneca` patterns on Seneca 4. Set the
Seneca option `legacy: { builtin_actions: true }` to keep the old names
while you change scripts and habits.

## 4. Expect the original errors

When a message typed at the REPL fails, Seneca 4 hands the REPL the
error the action replied with. The REPL prints it and stores it in
`err`; `err.message` is the action's own message. Seneca 3 wrapped it in
a Seneca error (`seneca: Action ... failed: ...`, with the original in
`err.orig`). Change any REPL scripts or aliases that read `err.orig`.

## 5. Use promises without a plugin

`seneca.post`, `seneca.message` and promise returning `ready` and
`close` are built into Seneca 4, so `await seneca.post(...)` works in a
session without seneca-promisify. On Seneca 3 it needs seneca-promisify
loaded in the service.

## 6. Check

1. Start the service and connect with `npx seneca-repl`.
2. Run `list` and a message of your own.
3. Stop the service with `seneca.close()` (or Ctrl-C if your service
   closes on SIGINT) and check that the process exits.

## See also

* [Seneca 3 and Seneca 4](../explanation/seneca-3-and-4.md): what the
  plugin does differently on each version.
* [Change log](../../CHANGES.md).
