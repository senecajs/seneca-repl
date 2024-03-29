function rep(n, c) {
  var b = []
  // for (var i = n; 0 < n; n--) {
  for (; 0 < n; n--) {
    b.push(c)
  }
  return b.join('')
}

const Seneca = require('seneca')

Seneca({ legacy: false })
  .test('print')
  .use('promisify')
  .use('..', { port: 20202 })
  .use('entity', {
    // hide: {
    //   '-/-/foo': ['c'],
    // },
  })
  .use('user')
  .use('gateway-auth')

  .use('owner', {
    ownerprop: 'principal.user',
    fields: ['id:owner_id'],
    annotate: ['sys:entity'],
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
  .act('sys:user,register:user,nick:alice,email:alice@example.com')
  .act('sys:user,register:user,nick:bob,email:bob@example.com')
  .ready(async function () {
    console.log(await this.entity('foo').list$())
  })
