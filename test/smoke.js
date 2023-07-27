require('seneca')({legacy:false})
  .test()
  .use('promisify')
  .use('entity')
  .use('..', {listen:false})
  // .use('..$a',{ host: '0.0.0.0', port: 50505, depth: 1 })
  // .use('..$b',{ host: '0.0.0.0', port: 60606, depth: 1 })
  .message('a:1', async (msg) => ({ x: msg.x }))
  .ready(function () {
    console.log(this.export('repl/address'))
  })

// To get an automatic port assignment, run with
// node smoke.js --seneca.options.plugin.repl.port=0
