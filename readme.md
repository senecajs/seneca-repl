![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] plugin

# seneca-repl

[![Build Status][travis-badge]][travis-url]
[![Gitter][gitter-badge]][gitter-url]


## install

To install, simply use npm. Remember you will need to install [Seneca.js][] if you haven't already.

```sh
> npm install seneca
> npm install seneca-repl
```


## usage

```js
var Seneca = require('seneca')
var SenecaRepl = require('seneca-repl')

var seneca = Seneca().use(SenecaRepl, {})

seneca.ready(function () {
  // access plugin features
})
```


## test

To run tests, simply use npm:

```sh
> npm run test
```


[Seneca.js]: https://www.npmjs.com/package/seneca
[travis-badge]: https://travis-ci.org/senecajs/seneca-repl.svg
[travis-url]: https://travis-ci.org/senecajs/seneca-repl
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/senecajs/seneca
