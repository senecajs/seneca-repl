# Exports reference

## Plugin exports

### `repl/address`

```js
seneca.export('repl/address')
// { port: 30303, host: '127.0.0.1', family: 'IPv4' }
```

The address the TCP server is listening on: `port`, `host` and `family`
(`'IPv4'` or `'IPv6'`). It is filled in when the server is listening,
before `seneca.ready()` fires, so read it in a `ready` callback. With
`port: 0` this is how you find the port the system chose. With
`listen: false` it is an empty object.

For a tagged instance, use the tag: `seneca.export('repl$admin/address')`.
Seneca also registers every instance's exports under the untagged key,
so with several instances `repl/address` gives the address of the
instance that loaded last.

## Module exports

```js
const Repl = require('@seneca/repl')
```

`Repl` is the plugin definition function, named `repl`; pass it to
`seneca.use(Repl, options)`, or load the plugin by name with
`seneca.use('repl', options)`. Its properties:

| Property | Value |
| -------- | ----- |
| `Repl.defaults` | A function `({ valid }) => shape` that returns the option shape, built with the Gubu builders of the Seneca instance that loads the plugin. See [Options](options.md). |
| `Repl.errors` | The error code map: `unknown-repl`, `invalid-status`, `invalid-cmd`. See [Errors](errors.md). |
| `Repl.Cmds` | The built in command functions, by function name: `HelloCmd`, `GetCmd`, `DepthCmd`, `PlainCmd`, `ListCmd`, `FindCmd`, `PriorCmd`, `HistoryCmd`, `LogCmd`, `SetCmd`, `AliasCmd`, `TraceCmd`, `HelpCmd`, `DelegateCmd`, `DataCmd`, `List$Cmd`, `Load$Cmd`, `Save$Cmd`, `Remove$Cmd`, `Entity$Cmd`. The command name is the function name without `Cmd`, in lower case. |
| `Repl.intern` | Internal helpers used by the sessions. Not a stable API. |

The command functions can be called directly, which is how the tests
check them:

```js
Repl.Cmds.GetCmd({
  name: 'get',
  argstr: 'tag',
  context: { seneca },
  options: {},
  respond: (err, out) => console.log(out),
})
```

## TypeScript

The package is compiled with declarations. The command types are in
`dist/types.d.ts`:

```ts
import type { Cmd, CmdSpec } from '@seneca/repl/dist/types'
```

`CmdSpec` is `{ name, argstr, context, options, respond }` and `Cmd` is
`(spec: CmdSpec) => void`.
