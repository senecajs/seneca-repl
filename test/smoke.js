const Seneca = require('seneca')

async function run() {
  try {
    let si = Seneca({legacy:false,
                     debug:{undead:true},
                     death_delay:555})
  .test()
  .error((err)=>{
    console.log('=======ERROR', err.message)
  })
  .use('promisify')
  // .use('entity')
  // .use('..', {listen:false})
  // .use('..$a',{ host: '0.0.0.0', port: 50505, depth: 1 })
  .use('..$b',{ host: '0.0.0.0', port: 60606, depth: 1 })
  .use('..$c',{ host: '0.0.0.0', port: 60606, depth: 1 })
      .message('a:1', async (msg) => ({ x: msg.x }))

  console.log('AAAA')
  await si.ready()
  console.log('BBBB')
  
  // .ready(function () {
  //   console.log('READY')
  //   console.log(this.export('repl/address'))
    // })
  }
  catch(e) {
    console.log('RUNERR',e)
  }
}


run()

// To get an automatic port assignment, run with
// node smoke.js --seneca.options.plugin.repl.port=0
