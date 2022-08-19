require('seneca')()
  .test()
  .use('promisify')
  .use('entity')
  .use('..')
  .message('a:1', async (msg) => ({ x: msg.x }))
  .ready(function () {
    console.log(this.export('repl/address'))
  })

// To get an automatic port assignment, run with
// node smoke.js --seneca.options.plugin.repl.port=0
