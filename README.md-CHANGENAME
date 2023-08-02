![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] plugin


## NOTE: [Version 2 Plan](doc/version-2.md)


# seneca-repl
[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Dependency Status][david-badge]][david-url]
[![Gitter][gitter-badge]][gitter-url]

| ![Voxgig](https://www.voxgig.com/res/img/vgt01r.png) | This open source module is sponsored and supported by [Voxgig](https://www.voxgig.com). |
|---|---|


### Seneca compatibility
Supports Seneca versions **3.x** and higher.


## Install

This is Seneca plugin, so you'll also need the Seneca framework installed to use the REPL.

```sh
$ npm install seneca
$ npm install @seneca/repl
```

To use the REPL client on the command line, you should install globally:

```
$ npm i -g seneca @seneca/repl
$ seneca-repl # now works!
```

### Installing optional components

This plugin can provide a REPL for AWS Lambda functions (via
`invoke`). You will need to install the AWS SDK so the REPL client can
use it to connect to your lambda function.

```
$ npm i -g @aws-sdk/client-lambda
```


## Usage

Add the REPL as a plugin to your Seneca instance. By default the
plugin will listen on localhost port 30303.

```js
var Seneca = require('seneca')

var seneca = Seneca()
  // open repl on default port 30303
  .use('repl') 

  // open another repl on port 10001
  .use('repl', {port: 10001})

  // open yet another repl on a free port chosen by your OS
  // look at the INFO level logs for the host and port
  // or get them from seneca.export('repl/address')
  .use('repl', {port: 0})
```

To access the REPL, run the `seneca-repl` command provided by this
plugin.

```
$ seneca-repl
```

You can specify the target Seneca server using a URI

```
$ seneca-repl telnet://localhost:30303 # same as default
```


NOTE: If the connection drops, the `seneca-repl` client will attempt
to reconnect at regular intervals. This means you can stop and start
your development server without needing to restart the REPL.


Skip ahead to the [Commands](#commands) section if this is all you
need.


### REPL over Seneca Message

You can submit REPL commands using the message
`sys:repl,send:cmd`. This message requires an `id` property to
indicate the REPL instance to use:

```
const Seneca = require('seneca')

const seneca = Seneca()
  .use('promisify')  // npm install @seneca/promisify
  .use('repl')
  .act('sys:repl,use:repl,id:foo')
  
await seneca.ready()

let res = await seneca.post('sys:repl,send:cmd,id:foo', {
  cmd: '1+1'
})

// Prints { ok: true, out:'4\n' }
console.log(res)

```

You can use this to expose a REPL connector in custom
environments. This plugin provides a REPL over HTTP, and over AWS
Lambda invocations. Review the implementation code for these if you
want to write your own REPL connector.


### REPL over HTTP(S)

Opening a local port is usually only possible for local development,
so you can also expose the REPL via a HTTP endpoint. This can be
useful to debug build or staging systems. This is **NOT** recommended
for production.

> **WARNING**
> This is a security risk. Your app will need to apply additional
> constraints to prevent arbitrary message submission via the REPL.

On the server, use the `sys:repl,use:repl` message to start a new REPL
inside the Seneca instance. Do this on startup (without a REPL
instance, a REPL connection will not operate). You will need to
special an identifier for this REPL.


```js
seneca.act('sys:repl,use:repl,id:web')
```

Next you will need to call the `sys:repl,send:cmd` message when your
chosen HTTP endpoint for the REPL is called. For _express_, this might look like:

```
const Express = require('express')
const BodyParser = require('body-parser')
const Seneca = require('seneca')

const app = express()
const seneca = Seneca()

seneca
  .use('repl')
  .act('sys:repl,use:repl,id:web')
    
app.use(bodyParser.json())

// Accepts body = {cmd:'...repl cmd goes here...'}
app.post('/seneca-repl', (req, res) => {
  const body = req.body

  seneca.act(
    { sys: 'repl', send: 'cmd', id: 'web', cmd: body.cmd }, 
    function (err, result) {
      if (err) {
        return res.status(500).json({ ok: false, error: err.message })
      }

      return res.json(result.out)
    })
})

app.listen(8080)
```

On the command line, access the REPL using a HTTP URL:

```
$ seneca-repl http://localhost:8888/seneca-repl?id=web
```

By default, HTTP URLs with use `web` as the identifier.


# REPL over AWS Lambda Invoke

To expose a REPL from an AWS Lambda function using Seneca, use the set
up code for the HTTP example in the Lambda itself.

For the REPL client, you will need to install the
[@aws-sdk/client-lambda](https://www.npmjs.com/package/@aws-sdk/client-lambda)
package, and correctly configure your AWS access using the
`$AWS_PROFILE` environment variable.

Connect to your Lambda function REPL using:

```
seneca-repl "aws://lambda/FUNCTION?region=REGION&id=invoke"
```

where `FUNCTION` is the name of the Lambda function,`REGION` is the
AWS region, such as `us-east-1` (the default). The default REPL id
value is _invoke_. NOTE: make sure to quote or escape the `&`.


This mechanism uses AWS Lambda invocation mechanism and thus relies on
AWS for security. Special care should be taken with Lambdas that are
externally exposed to prevent external requests from calling the
Seneca REPL messages.

> **WARNING**
> This is a security risk. Your app will need to apply additional
> constraints to prevent arbitrary message submission via the REPL.

This can be useful to debug build or staging systems, but is **NOT**
recommended for production, unless used with specifically access
controlled Lambda functions.


## Interactive Interface


The `seneca-repl` command provides a convenient REPL interface
including line editing and history. In remote settings you'll want
to create an SSH tunnel or similar for this purpose.


Alternatively you can telnet to the port:

```
$ telnet localhost 30303
```

Replace `localhost` if remote with the address of the remote system.

For more comfortable
experience with working cursor keys, use
[rlwrap](https://github.com/hanslub42/rlwrap)

```
$ rlwrap telnet localhost 30303
```


## Commands

The repl evaluates JavaScript directly:

```
> 1+1
2
```

You also have a `seneca` instance available:

```
> seneca.id
'SENECA-ID'
```

You can submit messages directly using
[jsonic](https://github.com/rjrodger/jsonic) format (JSON, but not strict!):

```
> role:seneca,cmd:stats
{
  start: '2023-08-01T17:37:39.880Z',
  act: { calls: 122, done: 121, fails: 8, cache: 0 },
  actmap: undefined,
  now: '2023-08-01T17:49:17.316Z',
  uptime: 697436
}
```

This is *very* useful for local debugging.

To access entity data, use the `list$`, `load$`, `save$` and `remove$`
commands:

```
> list$ foo
[
  { entity$: '-/-/foo', ...},
  { entity$: '-/-/foo', ...},
  ...
]
```

These all accept the parameters:
* entity canon (required): `zone/base/name`
* query (optional): `{field:value,...}`


NOTE: this is a Node.js REPL, so you also get some of the features of a Node.js REPL:
* The value of the last response is placed into the `_` variable
* You can use standard movement shortcuts like `Ctrl-A`, `Ctrl-E`, etc
* Command history

### Available Commands

* `list <pin>|plugin`: 
  * `<pin>`: list local message patterns, optionally narrowed by `pin` (e.g. `foo:1`)
  * `plugin`: list all plugins by full name
* `find <pin>|<plugin-name>`:
  * `<pin`: find an _exact_ matching message pattern definition (e.g. `sys:entity,cmd:load`)
  * `<plugin-name>`: find a plugin definition
* `list$ canon <query>`: list entity data (like `seneca.entity(canon).list$(query)`)
* `load$ canon <query>`: load entity data (like `seneca.entity(canon).load$(query)`)
* `save$ canon <data>`: save entity data (like `seneca.entity(canon).save$(data)`)
* `remove$ canon <query>`: remove entity data (like `seneca.entity(canon).remove$(query)`)
* `entity$ canon`: describe an entity (like `seneca.entity(canon)`)
* `stats`: print local statistics
* `stats full`: print full local statistics
* `exit` or `quit`: exit the repl session
* `last`: run last command again
* `set <path> <value>`: set a seneca option, e.g: `set debug.deprecation true`
* `get <path>`: get a seneca option
* `alias <name> <cmd>`: define a new alias
* `log`: toggle printing of remote log entries in test format (NOTE: these are unfiltered)
* `log match <literal>`: when logging is enabled, only print lines matching the provided literal string
* `depth <number>`: set depth of Util.inspect printing


### History

The command history is saved to text files in a `.seneca` in your home
folder.  History is unique to each target server. You can also add
additional URL parameters to isolate a server history:

```
$ seneca-repl localhost?project=foo # separate history for foo server
$ seneca-repl localhost?project=bar # separate history for bar server
```

<!--START:options-->


## Options

* `test` : boolean <i><small>false</small></i>


Set plugin options when loading with:
```js


seneca.use('repl', { name: value, ... })


```


<small>Note: <code>foo.bar</code> in the list above means 
<code>{ foo: { bar: ... } }</code></small> 



<!--END:options-->


<!--START:action-list-->


## Action Patterns

* [add:cmd,sys:repl](#-addcmdsysrepl-)
* [echo:true,sys:repl](#-echotruesysrepl-)
* [send:cmd,sys:repl](#-sendcmdsysrepl-)
* [sys:repl,use:repl](#-sysrepluserepl-)


<!--END:action-list-->

<!--START:action-desc-->


## Action Descriptions

### &laquo; `add:cmd,sys:repl` &raquo;

Add a REPL command dynamically



----------
### &laquo; `echo:true,sys:repl` &raquo;

No description provided.



----------
### &laquo; `send:cmd,sys:repl` &raquo;

No description provided.



----------
### &laquo; `sys:repl,use:repl` &raquo;

No description provided.



----------


<!--END:action-desc-->



## Contributing
The [Senecajs org][] encourages open participation. If you feel you
can help in any way, be it with documentation, examples, extra
testing, or new features please get in touch.

## Test

To run tests, simply use npm:

```sh
> npm run test
```

## License
Copyright (c) 2015-2020, Richard Rodger and other contributors.
Licensed under [MIT][].

[MIT]: ./LICENSE
[Seneca.js]: https://www.npmjs.com/package/seneca
[Senecajs org]: https://github.com/senecajs/
[travis-badge]: https://travis-ci.org/senecajs/seneca-repl.svg
[travis-url]: https://travis-ci.org/senecajs/seneca-repl
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/senecajs/seneca
[npm-badge]: https://img.shields.io/npm/v/seneca-repl.svg
[npm-url]: https://npmjs.com/package/seneca-repl
[david-badge]: https://david-dm.org/senecajs/seneca-repl.svg
[david-url]: https://david-dm.org/senecajs/seneca-repl
