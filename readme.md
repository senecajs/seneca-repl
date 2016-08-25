![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] plugin

# seneca-repl
[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Dependency Status][david-badge]][david-url]
[![Gitter][gitter-badge]][gitter-url]

### Seneca compatibility
Supports Seneca versions **1.x** - **3.x**

## Install

To install, simply use npm. Remember you will need to install [Seneca.js][] if you haven't already.

```sh
> npm install seneca
> npm install seneca-repl
```

## Usage

```js
var Seneca = require('seneca')
var SenecaRepl = require('seneca-repl')

var seneca = Seneca().use(SenecaRepl, {})

seneca.ready(function () {
  // access plugin features
})
```

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

[MIT]: ./LICENSE.txt
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
