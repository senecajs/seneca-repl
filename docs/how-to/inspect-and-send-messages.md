# Inspect and send messages

How to use a REPL session to send messages, keep their results, follow
them through the service, and look at patterns, logs and entities. The
outputs below come from [docs/examples/inspect.js](../examples/inspect.js),
which runs these lines in a session:

```sh
node inspect.js
```

The example service has the `shop` plugin from the tutorials, a
`discount` plugin that overrides `role:shop,cmd:price` (so the original
action becomes its *prior*), and seneca-entity.

## Send a message

Type the message in [Jsonic](https://github.com/jsonicjs/jsonic) form:
JSON without the outer braces, with quotes only where needed.

```
> role:shop,cmd:price,item:apple
```

The reply is printed and kept in the session variable `out`; an error is
kept in `err`. `last` runs the previous line again.

A line is sent as a message only when it parses as a Jsonic object.
Some JavaScript with a `name:value` string and no space before the colon
parses as an object too: `seneca.list("role:shop")` is sent as a
message. Write the pattern as an object instead,
`seneca.list({ role: 'shop' })`. See
[How the REPL evaluates input](../explanation/how-the-repl-evaluates-input.md).

## Keep a result and reuse it

`~> name` stores the reply in a session variable. Backquoted
expressions inside a message are replaced with values from the session
before the message is parsed; `$` is the session context:

```
> role:shop,cmd:price,item:pear ~> pear
{ item: 'pear', price: 2.025 }

> pear.price
2.025

> role:shop,cmd:order,item:`$.pear.item`,quantity:2
{ item: 'pear', quantity: 2, total: 4.05 }
```

`~> name=path` stores part of the result instead: the path is read from
`{ out, err }`, so `role:shop,cmd:price,item:pear ~> p=out.price` stores
the price only.

In JavaScript, `await` works at the start of a line and in a plain
assignment:

```
> await seneca.post('role:shop,cmd:price,item:apple')
> x = await seneca.post('role:shop,cmd:price,item:apple')
```

Declarations such as `const x = await ...` and other placements such as
`(await ...).price` fail with a syntax error; assign first, then use the
variable.

## Find patterns and their priors

```
> list role:shop
[ { cmd: 'price', role: 'shop' }, { cmd: 'order', role: 'shop' } ]

> prior role:shop,cmd:price
[
  {
    id: 'discount/action/29',
    plugin: 'discount',
    pattern: 'cmd:price,role:shop',
    callpoint: undefined
  },
  {
    id: 'shop/action/27',
    plugin: 'shop',
    pattern: 'cmd:price,role:shop',
    callpoint: undefined
  }
]
```

* `list [pattern]` lists the patterns that match; `list plugins` lists
  the loaded plugins.
* `find <pattern>` prints the action definition that handles the
  pattern (its id, plugin, function and rules); `find <plugin>` prints a
  plugin record.
* `prior <pattern>` prints the action and the chain of actions it
  overrides. `callpoint` is set when Seneca records call points (in test
  mode).

## Trace messages

`trace` turns tracing on or off for the session. While it is on, every
message sent from the session, and every message those actions send,
prints an `IN` line and an `OUT` (or `ERR`) line, numbered so that you
can pair them:

```
> trace
undefined

> role:shop,cmd:order,item:apple,quantity:2
IN  000000: { role: 'shop', cmd: 'order', item: 'apple', quantity: 2 } # q9zxrhi35kg2/lue8t4eulzso cmd:order,role:shop shop/action/28 
IN  000001: { item: 'apple', role: 'shop', cmd: 'price' } # 5tbh0fpgszd6/lue8t4eulzso cmd:price,role:shop discount/action/29 
IN  000002: { item: 'apple', role: 'shop', cmd: 'price' } # 9skn34hs6xyf/lue8t4eulzso cmd:price,role:shop shop/action/27 
OUT 000002: { item: 'apple', price: 1.5 }
OUT 000001: { item: 'apple', price: 1.35 }
OUT 000000: { item: 'apple', quantity: 2, total: 2.7 }
undefined
```

An `IN` line shows the message, its id (`message/transaction`), the
pattern and the action id. While tracing, the reply itself is not
printed again (the last line is `undefined`). Type `trace` again to stop.

## See log entries

`log` turns on printing of the service's log entries in the session,
as `LOG:` lines; `log match <text>` turns it on and prints only entries
that contain the text. Entries of every level are passed, including
debug entries, so use a match. Each entry is printed on one line at the
session's inspection depth, so lower the depth first:

```
> depth 0
'Inspection depth set to 0'

> log match case: 'OUT'
undefined

> role:shop,cmd:price,item:apple
LOG: {   actid: 'qpivw2tfcv76/7o6pdcvd0qi7',   msg: [Object],   meta: [Meta],   entry: undefined,   prior: undefined,   gate: undefined,   caller: undefined,   actdef: [Object],   client: false,   listen: false,   transport: {},   kind: 'act',   case: 'OUT',   duration: 0,   res: [Object],   did: 'n0xw~repl$/rwei/gw0c',   level: 200,   isot: '2026-10-08T07:09:35.666Z',   when: 1791443375666,   level_name: 'debug',   seneca_id: 'rlrj89wfan75/1791443375445/21569/4.0.0-rc5/-',   seneca_did: 'n0xw~repl$/rwei/gw0c',   plugin_name: 'discount',   plugin_tag: '-',   pattern: 'cmd:price,role:shop',   action: 'shop/action/27',   idpath: '7o6pd.xrbom.qpivw' }
LOG: {   actid: 'xrbomgebkxk2/7o6pdcvd0qi7',   ... }
{ item: 'apple', price: 1.35 }

> log
undefined
```

(The second `LOG:` line is shortened here.) `log` on its own turns
printing off again. The match is the literal rest of the line, quotes
included.

## Send messages with fixed properties

A *delegate* adds fixed properties to every message sent through it.
`delegate <name> <properties>` creates one from the current delegate and
makes it the session's `seneca`; `delegate repl$` returns to the
session's own delegate, and `delegate root$` switches to the root
instance:

```
> delegate ops {channel:ops}
{
  isSeneca: true,
  id: 'rlrj89wfan75/1791443375445/21569/4.0.0-rc5/-',
  did: 'n0xw~repl$/dy8j~ops',
  fixedargs: { 'repl$': true, 'fatal$': false, channel: 'ops' },
  fixedmeta: {},
  start_time: 1791443375445,
  version: '4.0.0-rc5'
}

> sys:repl,echo:true,x:1
{
  sys: 'repl',
  echo: true,
  x: 1,
  'repl$': true,
  'fatal$': false,
  channel: 'ops'
}

> delegate repl$
```

`sys:repl,echo:true` replies with the message it received, which shows
the fixed properties. `repl$: true` and `fatal$: false` are always fixed
by the session. The full syntax is in
[Commands: delegate](../reference/commands.md#delegate).

## Work with entities

With [seneca-entity](https://github.com/senecajs/seneca-entity) loaded,
`list$`, `load$`, `save$` and `remove$` take an entity name
(`name`, `base/name` or `zone/base/name`) and an optional Jsonic query
or data; `entity$ <name>` prints an empty entity of that kind:

```
> save$ fruit name:apple,stock:10
Entity {
  'entity$': '-/-/fruit',
  name: 'apple',
  stock: 10,
  id: 'k20vj3'
}

> list$ fruit
[
  Entity {
    'entity$': '-/-/fruit',
    name: 'apple',
    stock: 10,
    id: 'k20vj3'
  }
]
```

## Check statistics and options

* `stats` and `stats full` print `seneca.stats()` and
  `seneca.stats({summary:false})` (the per pattern counts).
* `get <path>` prints an option, for example `get plugin.repl.port`.
* `set <path> <value>` changes an option at runtime, for example
  `set debug.deprecation false`.

## Copy data to your machine

In `seneca-repl`, `data <variable> <file>` writes the variable as JSON to
a file on the machine where the client runs (relative to the client's
working directory). Without a file name, the JSON is printed. This works
for large values too:

```
> data pear pear.json
```

## See also

* [Commands](../reference/commands.md): every command and variable.
* [Debug and inspect](https://github.com/senecajs/seneca/blob/master/docs/how-to/debug-and-inspect.md)
  in the Seneca documentation: the Seneca methods behind these commands.
