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

let replAddr = process.argv[2]
let portArg = process.argv[3]

let url = 'telnet:'+host+':'+port
let scope = 'default'

// NOTE: backwards compatibility: seneca-repl localhost 30303

if(null == replAddr) {
  replAddr = 'telnet://'+host+':'+port
}

else if(null != portArg) {
  host = replAddr
  port = parseInt(portArg)
  replAddr = 'telnet://'+host+':'+port
}

else {
  if(!replAddr.includes('://')) {
    replAddr = 'telnet://'+replAddr
  }
}

// TODO: support other protocals - http endpoint,
// lambda invoke (via sub plugin @seneca/repl-aws)

try {
  url = new URL(replAddr)
  // console.log('URL', url)
  
  host = url.hostname || host
  port = '' === url.port ? port : parseInt(url.port)
  
  // NOTE: use URL params for additional args
  scope = url.searchParams.get('scope')
  scope = (null == scope || '' === scope) ? 'default' : scope
}
catch(e) {
  console.log('# CONNECTION URL ERROR: ', e.message, replAddr)
  process.exit(1)
}


const history = []

const senecaFolder = Path.join(OS.homedir(),'.seneca')

if(!FS.existsSync(senecaFolder)) {
  FS.mkdirSync(senecaFolder)
}

const historyName = encodeURIComponent(replAddr)
const historyPath = Path.join(senecaFolder,'repl-'+historyName+'.history')

if(FS.existsSync(historyPath)) {
  const lines = FS.readFileSync(historyPath).toString()
  lines
    .split(/[\r\n]+/)
    .map(line=>(null!=line&&''!=line)?history.push(line):null)
}

let historyFile = null


reconnect({
  log: console.log,
  url,
  host,
  port,
  scope,
  delay: 1111,
  first: true
})


function reconnect(spec) {
  telnet(spec, function(result) {
    if(result) {
      if(false === result.connect && !spec.quit && !spec.first) {
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
      process.exit(1)
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

    try {
      historyFile = FS.openSync(historyPath,'a')
    }
    catch(e) {
      // Don't save history
    }
    
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
      spec.first = false
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
      
      spec.log('Connected to Seneca:', state.connection.remote)


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

