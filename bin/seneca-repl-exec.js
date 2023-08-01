#!/usr/bin/env node

/* Copyright (c) 2019-2023 voxgig and other contributors, MIT License */
'use strict'

const OS = require('node:os')
const FS = require('node:fs')
const Path = require('node:path')
const Net = require('node:net')
const Readline = require('node:readline')
const Http = require('node:http')
const Https = require('node:https')
const { Duplex } = require('node:stream')

const state = {
  connection: {},
}

let host = '127.0.0.1'
let port = 30303

let replAddr = process.argv[2]
let portArg = process.argv[3]

let url = 'telnet:' + host + ':' + port
let id = 'default'

// NOTE: backwards compatibility: seneca-repl localhost 30303

if (null == replAddr) {
  replAddr = 'telnet://' + host + ':' + port
} else if (null != portArg) {
  host = replAddr
  port = parseInt(portArg)
  replAddr = 'telnet://' + host + ':' + port
} else {
  if (!replAddr.includes('://')) {
    replAddr = 'telnet://' + replAddr
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
  id = url.searchParams.get('id')
  id = null == id || '' === id ? 'web' : id
} catch (e) {
  console.log('# CONNECTION URL ERROR: ', e.message, replAddr)
  process.exit(1)
}

const history = []

const senecaFolder = Path.join(OS.homedir(), '.seneca')

if (!FS.existsSync(senecaFolder)) {
  FS.mkdirSync(senecaFolder)
}

const historyName = encodeURIComponent(replAddr)
const historyPath = Path.join(senecaFolder, 'repl-' + historyName + '.history')

if (FS.existsSync(historyPath)) {
  const lines = FS.readFileSync(historyPath).toString()
  lines
    .split(/[\r\n]+/)
    .reverse()
    .map((line) => (null != line && '' != line ? history.push(line) : null))
  console.log('H', history)
}

let historyFile = null

let spec = {
  log: console.log,
  url,
  host,
  port,
  id,
  delay: 31111,
  first: true,
}

class RequestStream extends Duplex {
  constructor(spec, options) {
    super(options)
    this.spec = spec
    this.buffer = []
    this.processing = false
  }

  _write(chunk, encoding, callback) {
    this.processing = true
    const cmd = chunk.toString().trim()
    const url = this.spec.url

    // Determine whether to use http or https based on the URL
    const httpClient = url.href.startsWith('https://') ? Https : Http

    const postData = JSON.stringify({
      id: this.spec.id,
      cmd,
    })

    // console.log('PD', postData)

    let req = httpClient
      .request(
        url.href,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (response) => {
          let data = ''

          response.on('data', (chunk) => {
            data += chunk
          })

          response.on('end', () => {
            // console.log('DATA', data)
            let res = JSON.parse(data)
            // console.log('res', res)

            // console.log('HE', data, res)
            if (res.ok) {
              this.buffer.push(res.out + String.fromCharCode(0))
            } else {
              this.buffer.push(
                (res.err || '# ERROR: unknown') + String.fromCharCode(0),
              )
            }

            this.processing = false
            this._read()
            callback()
          })
        },
      )
      .on('error', (err) => {
        // console.log('HE', err)
        this.buffer.push(`# ERROR: ${err}\n` + String.fromCharCode(0))
        this._read()
        callback()
      })

    req.write(postData)
    req.end()
  }

  _read(size) {
    if (this.processing) {
      return
    }

    let chunk
    while ((chunk = this.buffer.shift())) {
      if (!this.push(chunk)) {
        break
      }
    }
  }
}

reconnect(spec)

function reconnect(spec) {
  operate(spec, function (result) {
    if (result) {
      if (false === result.connect && !spec.quit && !spec.first) {
        setTimeout(() => {
          spec.delay = Math.min(spec.delay * 1.1, 33333)
          reconnect(spec)
        }, spec.delay)
      } else if (result.err) {
        console.log('# CONNECTION ERROR:', result.err)
      }
    } else {
      console.log('# CONNECTION ERROR: no-result')
      process.exit(1)
    }
  })
}

function operate(spec, done) {
  state.connection.first = true
  state.connection.quit = false

  // state.connection.sock = Net.connect(spec.port, spec.host)
  try {
    state.connection.sock = connect(spec)
    // console.log('SOCK', !!state.connection.sock)
  } catch (err) {
    // console.log('CA', err)
    return done && done({ err })
  }

  state.connection.sock.on('connect', function () {
    // console.log('SOCK connect')

    state.connection.open = true
    delete state.connection.closed

    try {
      historyFile = FS.openSync(historyPath, 'a')
    } catch (e) {
      // Don't save history
    }

    state.connection.sock.write('hello\n')
    done && done({ connect: true, event: 'connect' })
  })

  state.connection.sock.on('error', function (err) {
    // console.log('CE', err)
    if (state.connection.open) {
      return done && done({ event: 'error', err })
    }
  })

  state.connection.sock.on('close', function (err) {
    // console.log('CC', err)
    if (state.connection.open) {
      spec.log('\n\nConnection closed.')
    }
    state.connection.open = false
    state.connection.closed = true

    return (
      done &&
      done({
        connect: false,
        event: 'close',
        quit: !!state.connection.quit,
      })
    )
  })

  const responseChunks = []

  state.connection.sock.on('data', function (chunk) {
    const str = chunk.toString('ascii')
    // console.log('SOCK DATA', str)

    if (0 < str.length && 0 === str.charCodeAt(str.length - 1)) {
      responseChunks.push(str)
      let received = responseChunks.join('')
      received = received.substring(0, received.length - 1)
      responseChunks.length = 0
      spec.first = false
      handleResponse(received)
    } else if (0 < str.length) {
      responseChunks.push(str)
    }
  })

  function handleResponse(received) {
    if (state.connection.first) {
      let first = true
      state.connection.first = false

      let jsonstr = received.trim().replace(/[\r\n]/g, '')

      jsonstr = jsonstr.substring(1, jsonstr.length - 1)

      try {
        state.connection.remote = JSON.parse(jsonstr)
      } catch (err) {
        if (received.startsWith('# ERROR') || first) {
          received = received.startsWith('# ERROR')
            ? received
            : '# ERROR: ' + received
          console.log(received)
        } else {
          console.log('# HELLO ERROR: ', err.message, 'hello:', received)
        }

        process.exit(1)
      }

      state.connection.prompt = state.connection.remote.id + '> '

      spec.log('Connected to Seneca:', state.connection.remote)

      if (null == state.connection.readline) {
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
            // console.log('LINE', line)

            if (state.connection.closed) {
              return setImmediate(() => {
                operate(spec)
              })
            }

            if ('quit' === line || 'exit' === line) {
              process.exit(0)
            }

            if (null != historyFile) {
              try {
                FS.appendFileSync(historyFile, line + OS.EOL)
              } catch (e) {
                // Don't save history
              }
            }

            state.connection.sock.write(line + '\n')
            // state.connection.readline.prompt()
          })
          .on('error', (err) => {
            console.log('# READLINE ERROR:', err)
            process.exit(1)
          })
          .on('close', () => {
            process.exit(0)
          })
      } else {
        state.connection.readline.setPrompt(state.connection.prompt)
      }

      state.connection.readline.prompt()
    } else {
      received = received.replace(/\n+$/, '\n')
      spec.log(received)

      state.connection.readline.prompt()
    }
  }
}

// Create a duplex stream to operate the REPL
function connect(spec) {
  let duplex = null
  let protocol = spec.url.protocol

  if ('telnet:' === protocol) {
    duplex = Net.connect(spec.port, spec.host)
  } else if ('http:' === protocol || 'https:' === protocol) {
    duplex = makeHttpDuplex(spec)
  } else {
    try {
      const makeProtocol = require(__dirname +
        '/protocol-' +
        protocol.replace(/[^a-z0-9-_]/g, '') +
        '.js')
      return makeProtocol(spec)
    } catch (e) {
      // console.log(e)
      throw new Error(
        'unknown protocol: ' + protocol + ' for url: ' + spec.url.href,
      )
    }
  }

  return duplex
}

// Assumes endpoint will call sys:repl,send:cmd
// POST Body is: {cmd}
function makeHttpDuplex(spec) {
  let reqstream = new RequestStream(spec)
  setImmediate(() => {
    reqstream.emit('connect')
  })
  return reqstream
}
