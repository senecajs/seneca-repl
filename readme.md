![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] plugin

# seneca-repl
[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Dependency Status][david-badge]][david-url]
[![Gitter][gitter-badge]][gitter-url]

### Seneca compatibility
Supports Seneca versions **3.x** and higher.

## Install

To install, simply use npm. Remember you will need to install [Seneca.js][] if you haven't already.

```sh
> npm install seneca
> npm install seneca-repl
```

## Usage

```js
var Seneca = require('seneca')

var seneca = Seneca()
  // open repl on default port 30303
  .use('seneca-repl') 

  // open another repl on port 10001
  .use('seneca-repl', {port: 10001})
```

To access the repl, telnet to the port.

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

* `list`: list local patterns
* `tree`: show local patterns in tree format
* `stats`: print local statistics
* `stats/full`: print full local statistics
* `exit` or `quit`: exit the repl session
* `last`: run last command again
* `history`: print command history
* `set <path> <value>`: set a seneca option, e.g: `set debug.deprecation true`. Use `seneca.options()` to get options
* `alias <name> <cmd>`: define a new alias



## Contributing
The [Senecajs org][] encourage open participation. If you feel you can help in any way, be it with
documentation, examples, extra testing, or new features please get in touch.

## Test

To run tests, simply use npm:

```sh
> npm run test
```

## License
Copyright (c) 2015-2016, Senecajs and other contributors.
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
