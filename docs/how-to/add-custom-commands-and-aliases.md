# Add custom commands and aliases

How to give the REPL your own commands and shortcuts. The complete
program is [docs/examples/custom-commands.js](../examples/custom-commands.js).

## Write a command

A command is a function. It receives one object, `spec`, and must call
`spec.respond` exactly once:

| Property | Value |
| -------- | ----- |
| `name` | The command name as typed. |
| `argstr` | The rest of the line after the name (with its leading space). |
| `context` | The session context: `context.seneca` is the session's Seneca delegate; your own variables are there too. |
| `options` | The plugin options. |
| `respond(err, result)` | Print `result`, or the error `err`. A string error prints as `Uncaught '<text>'`; the built in commands use strings that start with `ERROR:`. |

```js
function price(spec) {
  const item = spec.argstr.trim()
  spec.context.seneca.act('role:shop,cmd:price', { item }, function (err, out) {
    if (err) return spec.respond('ERROR: ' + err.message)
    spec.respond(null, item + ' costs ' + out.price)
  })
}
```

A command that never calls `respond` leaves the client waiting, because
the end of response marker is only sent by `respond`.

## Add commands with the `cmds` option

```js
seneca.use('repl', {
  cmds: { price },
})
```

The key is the command name. A name that is also a built in command
replaces the built in one.

## Add a command while the service runs

Send `sys:repl,add:cmd` with the name and the function:

```js
await seneca.post('sys:repl,add:cmd', {
  name: 'items',
  action: (spec) => spec.respond(null, ['apple', 'pear']),
})
```

The command is available at once in every session of that plugin
instance, including open ones. The function travels in the message, so
send it from the same process. A missing name or a value that is not a
function fails with `invalid-cmd`.

## Add aliases with the `alias` option

An alias replaces a whole line with other input:

```js
seneca.use('repl', {
  alias: { apple: 'role:shop,cmd:price,item:apple' },
})
```

Your aliases are added to the built in ones (`stats`, `stats full`), so
those keep working.

## Add aliases in a session

```
> alias pp price pear
```

The first word is the alias name; the rest of the line is the
replacement. If the first word of a line is an alias whose replacement
is a command name, that command runs with the rest of the line:

```
> alias p price
> p apple
```

Aliases added this way belong to the plugin instance: every session of
that instance sees them until the process exits. They are not saved.

## The result

Running the example:

```sh
node custom-commands.js
```

prints (Seneca's error log entry for the `kiwi` lookup is left out):

```
> price pear
'pear costs 2.25'

> price kiwi
Uncaught 'ERROR: Unknown item: kiwi'

> items
[ 'apple', 'pear' ]

> apple
{ item: 'apple', price: 1.5 }

> alias pp price pear
undefined

> pp
'pear costs 2.25'

> alias p price
undefined

> p apple
'apple costs 1.5'

closed
```

Commands that have nothing to print, such as `alias`, print `undefined`.

## See also

* [Commands](../reference/commands.md): the built in commands.
* [Messages: sys:repl,add:cmd](../reference/messages.md#sysrepladdcmd).
* [Options: cmds and alias](../reference/options.md).
* The built in commands are exported as `Cmds`
  (see [Exports](../reference/exports.md)); their source in `src/cmds.ts`
  is a good starting point for your own.
