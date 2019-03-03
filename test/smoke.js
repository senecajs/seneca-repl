require('seneca')()
  .use('..')
  .ready(function() {
    console.log(this.export('repl/address'))
  })

// To get an automatic port assignment, run with
// node smoke.js --seneca.options.repl.port=0
