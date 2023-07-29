#!/usr/bin/env node

/* Copyright (c) 2019-2023 voxgig and other contributors, MIT License */
'use strict'

const OS = require('node:os')
const FS = require('node:fs')
const Path = require('node:path')
const Net = require('node:net')
const Readline = require('node:readline');


const state = {
  connection: {}
}


let host = '127.0.0.1'
let port = 30303

let uri = process.argv[2]

let m = uri.match(/^(.*):(\d+)$/)

if(m) {
  host = m[1]
  port = m[2]
}


const history = []

const scope = 'default'

const senecaFolder = Path.join(OS.homedir(),'.seneca')

if(!FS.existsSync(senecaFolder)) {
  FS.mkdirSync(senecaFolder)
}

const historyPath = Path.join(senecaFolder,'repl-'+scope+'.history')

if(FS.existsSync(historyPath)) {
  const lines = FS.readFileSync(historyPath).toString()
  lines
    .split(/[\r\n]+/)
    .map(line=>(null!=line&&''!=line)?history.push(line):null)
}

let historyFile = null
try {
  historyFile = FS.openSync(historyPath,'a')
}
catch(e) {
  // Don't save history
}


reconnect({
  log: console.log,
  uri,
  host,
  port,
  delay: 1111
})


function reconnect(spec) {
  telnet(spec, function(result) {
    if(result) {
      if(false === result.connect && !spec.quit) {
        setTimeout(()=>{
          spec.delay = Math.min(spec.delay * 1.1, 33333)
          reconnect(spec)
        }, spec.delay)
      }
      else if(result.err) {
        console.log('# CONNECTION ERROR:', result.err)
      }
    }
    else {
      console.log('# CONNECTION ERROR: no-result')
    }
  })
}


function telnet(spec, done) {
  state.connection.first = true
  state.connection.quit = false
  state.connection.sock = Net.connect(spec.port, spec.host)

  state.connection.sock.on('connect', function() {
    state.connection.open = true
    delete state.connection.closed

    state.connection.sock.write('hello\n')
    done({connect:true,event:'connect'})
  })

  state.connection.sock.on('error', function(err) {
    if(state.connection.open) {
      return done({event:'error',err})
    }
  })

  state.connection.sock.on('close', function(err) {
    if(state.connection.open) {
      spec.log('\n\nConnection closed.')
    }
    state.connection.open = false
    state.connection.closed = true

    return done({
      connect:false,
      event:'close',
      quit:!!state.connection.quit
    })
  })

  
  const responseChunks = []
  
  state.connection.sock.on('data', function(chunk) {
    const str = chunk.toString('ascii')

    if (0 < str.length && 0 === str.charCodeAt(str.length-1) ) {
      responseChunks.push(str)
      let received = responseChunks
          .join('')
      received = received.substring(0,received.length-1)
      responseChunks.length = 0
      handleResponse(received)
    }
    else if (0 < str.length) {
      responseChunks.push(str)
    }
  })    


  function handleResponse(received) {
    if(state.connection.first) {
      state.connection.first = false

      let jsonstr = received
          .trim()
          .replace(/[\r\n]/g,'')

      jsonstr = jsonstr.substring(1,jsonstr.length-1)
      state.connection.remote = JSON.parse(jsonstr)
      
      state.connection.prompt = state.connection.remote.id+'> ' 
      
      spec.log('Connected to: ', state.connection.remote)


      if(null == state.connection.readline) {
        state.connection.readline = Readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          // prompt: 'QQQ',
          terminal: true,
          history,
          historySize: Number.MAX_SAFE_INTEGER,
          prompt: state.connection.prompt,
        })
      
        state.connection.readline
          .on('line', (line) => {
            if('quit' === line) {
              process.exit(0)
            }

            if(null != historyFile) {
              try {
                FS.appendFileSync(historyFile,line+OS.EOL)
              }
              catch(e) {
                // Don't save history
              }
            }
            
            state.connection.sock.write(line+'\n')
            // state.connection.readline.prompt()
          })
          .on('error', (err) => {
            console.log('# READLINE ERROR:', err)
            process.exit(0)
          })
          .on('close', () => {
            process.exit(0)
          })
      }
      else {
        state.connection.readline.setPrompt(state.connection.prompt)
      }
      
      state.connection.readline.prompt()
    }
    else {
      received = received.replace(/\n+$/, '\n')
      spec.log(received)

      state.connection.readline.prompt()
    }
  }
}



/*
function repl(vorpal) {
  vorpal
    .mode('repl')
    .delimiter('-> ')
    .init(function(args, cb) {
      if(!state.connection.open) {
        this.log('No connection. Type `exit` and use `connect`.')
      }
      cb()
    })
    .action(function(args, callback) {
      if(this.session && state.connection.remote_seneca) {
        this.session._modeDelimiter = state.connection.remote_seneca + '-> '
      }

      var cmd = args+'\n'

      state.connection.sock.write(cmd)
      callback()
    })
}

function connect(vorpal) {
  vorpal
    .command('connect [host] [port]')
    .action(function(args, callback) {
      var host = args.host || 'localhost'
      var port = parseInt(args.port || 30303, 10)
      this.log('Connecting to '+host+':'+port+' ...')
      var log = this.log.bind(this)
      state.connection = {}
      
      telnet({log:log, host:host, port:port},function(err) {
        if(err) {
          log(err)
        }
        else {
          vorpal.history('seneca~'+host+'~'+port)
          vorpal.exec('repl')
        }
        callback()
      })
    })
}

vorpal
  .delimiter('seneca: ')
  .use(repl)
  .use(connect)

vorpal
  .show()

if(2 < process.argv.length) {
  launchConnect()

  setInterval(()=>{
    if(state.connection.closed) {
      launchConnect()
    }
  },1111)
}


function launchConnect() {  
  vorpal
    .exec(['connect'].concat(process.argv.slice(2)).join(' '))
}


function telnet(spec, done) {
  state.connection.first = true
  state.connection.sock = Net.connect(spec.port, spec.host)

  state.connection.sock.on('connect', function() {
    state.connection.open = true
    delete state.connection.closed
    done()
  })

  state.connection.sock.on('error', function(err) {
    if(!state.connection.closed) {
      done(err)
    }
  })

  state.connection.sock.on('close', function(err) {
    state.connection.open = false
    state.connection.closed = true
    spec.log('Connection closed.')
    vorpal.execSync('exit')
  })

  state.connection.sock.on('data', function(buffer) {
    var received = buffer.toString('ascii')

    if(state.connection.first) {
      state.connection.first = false

      state.connection.remote_prompt = received
      
      state.connection.remote_seneca = received
        .replace(/^seneca\s+/,'')
        .replace(/->.*$/,'')

      spec.log('Connected to '+state.connection.remote_seneca)
    }
    else {
      var rp = received.indexOf(state.connection.remote_prompt)
      if(-1 != rp) {
        received = received.substring(0,rp)
      }
      received = received.replace(/\n+$/, '\n')
      spec.log(received)
    }
  })
}
*/
