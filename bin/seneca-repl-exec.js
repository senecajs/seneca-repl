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

const { minify_sync } = require('terser')

const JP = (arg) => JSON.parse(arg)
const JS = (a0, a1) => JSON.stringify(a0, a1)

const state = {
  connection: {
    mode: 'cmd',
  },
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
}

let historyFile = null

let spec = {
  log: console.log,
  url,
  host,
  port,
  id,
  delay: 111,
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
            let res = JSON.parse(data)

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
  } catch (err) {
    return done && done({ err })
  }

  state.connection.sock.on('connect', function () {
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
    if (state.connection.open) {
      return done && done({ event: 'error', err })
    }
  })

  state.connection.sock.on('close', function (err) {
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
        Readline.emitKeypressEvents(process.stdin)

        state.connection.readline = Readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          completer: (linep) => {
            return [history.filter((n) => n.startsWith(linep)), linep]
          },
          terminal: true,
          history,
          historySize: Number.MAX_SAFE_INTEGER,
          prompt: state.connection.prompt,
        })

        process.stdin.on('keypress', function (key, spec) {
          if ('g' == spec.name && spec.ctrl) {
            Readline.cursorTo(process.stdin, 0)
            Readline.clearLine(process.stdin, 1)
            state.connection.readline.setPrompt(state.connection.prompt)
            state.connection.readline.prompt()
            state.connection.found = ''
            state.connection.mode = 'cmd'
            state.connection.readline.resume()
            return
          }

          if ('search' === state.connection.mode) {
            let cc = key.charCodeAt(0)
            if (31 < cc || 8 === cc) {
              if (127 === cc || 8 === cc) {
                // state.connection.search =
                //  state.connection.search.substring(0,state.connection.search.length-1)
                // state.connection.offset = 0
              } else {
                state.connection.search += key
              }
            } else if ('r' == spec.name && spec.ctrl) {
              state.connection.offset++
            }

            let search = state.connection.search

            Readline.cursorTo(process.stdout, 0, () => {
              Readline.clearLine(process.stdout, 1)

              const searchprompt = 'search: [' + search + '] '
              // state.connection.readline.write(searchprompt)

              state.connection.found = ''
              if ('' != search) {
                let offset = state.connection.offset
                for (let i = 0; i < history.length; i++) {
                  if (history[i].includes(search)) {
                    if (0 === offset) {
                      state.connection.readline.write(searchprompt + history[i])
                      state.connection.found = history[i]
                      break
                    } else {
                      offset--
                    }
                  }
                }
              }

              if ('' === state.connection.found) {
                state.connection.readline.write(searchprompt)
              }
            })
          } else if ('r' == spec.name && spec.ctrl) {
            state.connection.readline.pause()
            state.connection.readline.setPrompt('search: [] ')
            state.connection.readline.prompt()
            state.connection.mode = 'search'
            state.connection.search = ''
            state.connection.offset = 0
          }
        })

        state.connection.readline
          .on('line', (line) => {
            if ('search' === state.connection.mode) {
              Readline.cursorTo(process.stdin, 0)
              Readline.clearLine(process.stdin, 1)
              state.connection.readline.setPrompt(state.connection.prompt)
              state.connection.readline.prompt()
              state.connection.mode = 'cmd'
              state.connection.readline.write(state.connection.found)
              state.connection.readline.resume()
              return
            }

            if (state.connection.closed) {
              return setImmediate(() => {
                operate(spec)
              })
            }

            if ('quit' === line || 'exit' === line) {
              process.exit(0)
            }

            const send = buildSend(line, state)

            if (send.ok) {
              if (null != historyFile) {
                try {
                  FS.appendFileSync(historyFile, line + OS.EOL)
                } catch (e) {
                  // Don't save history
                }
              }

              state.connection.sock.write(send.line + '\n')
            } else {
              console.log('# ERROR:', send.errmsg)
            }
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

function buildSend(origline, state) {
  let line = origline
  let out = { ok: false, line }

  const directiveRE = /<%(.*?)%>/g
  const parts = []
  let m = null
  let last = 0
  while ((m = directiveRE.exec(origline))) {
    // console.log('D:',m[0],m[1], last, m.index, directiveRE.lastIndex)
    parts.push(origline.substring(last, m.index))
    last = directiveRE.lastIndex

    let dirout = expr({ src: m[1], fn: DirectiveMap, fixed: DirectiveFixed })
    parts.push(dirout)
  }
  parts.push(origline.substring(last, origline.length))

  // console.log(parts)

  out.line = parts.join('')
  out.ok = true

  return out
}

const DirectiveFixed = {
  VXGACT:
    /.*module\.exports\s*=\s*function\s+make_\w+_\w+\s*\(.*?\)\s*\{.*?return\s*(.*)\}[^}]*$/s,
}

const DirectiveMap = {
  Load: (path) => {
    let fullpath = Path.isAbsolute(path) ? path : Path.join(process.cwd(), path)
    if (FS.existsSync(fullpath)) {
      let text = FS.readFileSync(fullpath).toString()
      return JS(text)
    } else {
      throw new Error('Unable to read file: ' + fullpath)
    }
  },
  Match: (jstr, re, mI) => {
    let txt = '' + JP(jstr)
    let m = re.exec(txt)
    let out = m ? (null == mI ? m[0] : m[mI]) : ''
    out = JS(null == out ? '' : '' + out)
    return out
  },
  VxgAction: (pat, act, defstr) => {
    let def = minify_sync(JP(defstr), {
      mangle: false,
    }).code
    let func = def.startsWith('async')
      ? 'function(msg,reply,meta){const actfunc=' +
        def +
        ';actfunc.call(this, msg, meta).then(reply).catch(reply)}'
      : def
    return `seneca.find('${pat}',{exact:true,action:'${act}'}).func=` + func
  },
}

// TODO: unify with Gubu version
/*
  spec: {
  src: string
  fn: {}
  fixed: {}
  err: { prefix: '' }
  }
  state: {
  tokens?: string[]
  i?: number
  val: any

  }
  */
function expr(spec, exprState) {
  exprState = exprState || { i: 0, val: undefined }
  let top = false

  if (null == exprState.tokens) {
    top = true
    exprState.tokens = []
    let tre =
      /\s*,?\s*([)(\.]|"(\\.|[^"\\])*"|\/(\\.|[^\/\\])*\/[a-z]?|[^)(,\s]+)\s*/g
    let t = null
    while ((t = tre.exec(spec.src))) {
      exprState.tokens.push(t[1])
    }
  }

  exprState.i = exprState.i || 0

  let head = exprState.tokens[exprState.i]

  let fn = spec.fn[head]

  if (')' === exprState.tokens[exprState.i]) {
    exprState.i++
    return exprState.val
  }

  exprState.i++

  if (null == fn) {
    let m = null
    try {
      let val = spec.fixed[head]
      if (val) {
        return val
      } else if ('undefined' === head) {
        return undefined
      } else if ('NaN' === head) {
        return NaN
      } else if ((m = head.match(/^\/(.+)\/([a-z])?$/))) {
        // return new RegExp(head.substring(1, head.length - 1))
        let re = new RegExp(m[1], m[2])
        return re
      } else {
        return JP(head)
      }
    } catch (je) {
      throw new SyntaxError(
        `${spec.err?.prefix || ''}` +
          `Unexpected token ${head} in expression ${spec.src}: ${je.message}`,
      )
    }
  }

  if ('(' === exprState.tokens[exprState.i]) {
    exprState.i++
  }

  let args = []
  let t = null
  while (null != (t = exprState.tokens[exprState.i]) && ')' !== t) {
    let ev = expr(spec, exprState)
    args.push(ev)
  }
  exprState.i++

  exprState.val = fn.call(spec.val, ...args)

  if ('.' === exprState.tokens[exprState.i]) {
    exprState.i++
    return expr(exprState)
  } else if (top && exprState.i < exprState.tokens.length) {
    return expr(exprState)
  }

  return exprState.val
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
      const makeProtocol = require(
        __dirname + '/protocol-' + protocol.replace(/[^a-z0-9-_]/g, '') + '.js',
      )
      return makeProtocol(spec)
    } catch (e) {
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
