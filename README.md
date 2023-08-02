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

To install, simply use npm. Remember you will need to install [Seneca.js][] if you haven't already.

```sh
> npm install seneca
> npm install @seneca/repl
```

## Usage

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
module. Install this as a global module for easy access:

```
$ npm install -g @seneca/repl
```

Provide the host (default `localhost`) and port (default `30303`):

```
$ seneca-repl remote-host 12345
```

The `seneca-repl` command provides a convenient REPL interface including line editing and history. In production settings you'll want to create an SSH tunnel or similar
for this purpose.


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

The repl evaluates JavaScript directly. See the
[Node.js repl docs](https://nodejs.org/dist/latest-v6.x/docs/api/repl.html)
for more. You also have a `seneca` instance available:

```
seneca x.y.z [seneca-id] -> seneca.toString()
```

You can submit messages directly using
[jsonic](https://github.com/rjrodger/jsonic) format:

```
seneca x.y.z [seneca-id] -> role:seneca,cmd:stats
IN  000000: { role: 'seneca', cmd: 'stats' } # ftlbto0vvizm/6qt4gg83fylm cmd:stats,role:seneca (4aybxhxseldu) action_seneca_stats 
OUT 000000: { start: '2017-03-15T13:15:36.016Z',
  act: { calls: 3, done: 3, fails: 0, cache: 0 },
  actmap: undefined,
  now: '2017-03-15T13:17:15.313Z',
  uptime: 99297 }
```

The message and response are printed, along with a sequence number. If
the Seneca instance is a client of other Seneca services, the message
will be sent to the other services, and marked as transported.

It is often convenient to run a Seneca repl as a separate service,
acting as a client to all the other Seneca services. This gives you a
central point of control for your system.

There are some command aliases for common actions:

* `list <pin>`: list local patterns, optionally narrowed by `pin`
* `tree`: show local patterns in tree format
* `stats`: print local statistics
* `stats full`: print full local statistics
* `exit` or `quit`: exit the repl session
* `last`: run last command again
* `history`: print command history
* `set <path> <value>`: set a seneca option, e.g: `set debug.deprecation true`
* `get <path>`: get a seneca option
* `alias <name> <cmd>`: define a new alias
* `trace`: toggle IN/OUT tracing of submitted messages
* `log`: toggle printing of remote log entries in test format (NOTE: these are unfiltered)
* `log match <literal>`: when logging is enabled, only print lines matching the provided literal string
* `depth <number>`: set depth of Util.inspect printing



<!--START:options-->


## Options

* `test` : boolean <i><small>false</small></i>


Set plugin options when loading with:
```js


seneca.use('doc', { name: value, ... })


```


<small>Note: <code>foo.bar</code> in the list above means 
<code>{ foo: { bar: ... } }</code></small> 



<!--END:options-->


<!--START:action-list-->


## Action Patterns

* [add:cmd,sys:repl](#-addcmdsysrepl-)


<!--END:action-list-->

<!--START:action-desc-->


## Action Descriptions

### &laquo; `add:cmd,sys:repl` &raquo;

Add a REPL command dynamically



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

## Quick Example
## More Examples
## Motivation
## Support
## API
## Background

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
