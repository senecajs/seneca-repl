function rep(n, c) {
  var b = []
  for (var i = n; 0 < n; n--) {
    b.push(c)
  }
  return b.join('')
}

require('seneca')
  .use('promisify')
  .use('..', { port: 20202 })
  .use('entity', {
    hide: {
      '-/-/foo': ['c'],
    },
  })
  .use(function foo() {
    this.message('make:foo', async function (msg) {
      return await this.entity('foo').data$(msg.foo).save$()
    })
      .message('get:foo', async function (msg) {
        return await this.entity('foo').load$(msg.id)
      })
      .message('list:foo', async function (msg) {
        return await this.entity('foo').list$()
      })
      .message('bad:foo', async function (msg) {
        throw new Error('Bad Foo!')
      })
      .prepare(async function () {
        var foo = this.entity('foo')
        await foo
          .make$()
          .data$({ id$: 'i0', a: 1, b: 'red', c: 9, d: rep(1, 'q') })
          .save$()
        await foo
          .make$()
          .data$({ id$: 'i1', a: 2, b: 'green', c: 99, d: rep(2, 'q') })
          .save$()
        await foo
          .make$()
          .data$({ id$: 'i2', a: 3, b: 'blue', c: 999, d: rep(1111, 'q') })
          .save$()
      })
  })
  .ready(async function () {
    console.log(await this.entity('foo').list$())
  })
