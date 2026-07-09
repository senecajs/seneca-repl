const Http = require('node:http')

const Seneca = require('seneca')

async function run() {
  try {
    let si = Seneca({
      legacy: false,
      // debug:{undead:true},
      death_delay: 555,
    })

    si.context.getGlobal = () => global

    si.test()
      // .error((err)=>{
      //   console.log('=======ERROR', err.message)
      // })
      .use('promisify')
      .use('entity')
      // .use('..', {listen:false})
      .use('..')
      // .use('..', {listen:false})
      // .use('..$a',{ host: '0.0.0.0', port: 50505, depth: 1 })
      // .use('..$b',{ host: '0.0.0.0', port: 60606, depth: 1 })
      //.use('..$c',{ host: '0.0.0.0', port: 60606, depth: 1 })
      .message('a:1', async (msg) => ({ x: msg.x }))
      .message('b:1', async function b1(msg) {
        return { y: msg.y }
      })
    //console.log('AAAA')
    await si.ready()

    si.entity('foo').save$({ x: 1 })
    si.entity('foo').save$({ x: 2 })

    si.entity('foo/bar').save$({ n: 'A', y: 100 })
    si.entity('foo/bar').save$({ n: 'B', y: 200 })
    si.entity('foo/bar').save$({ n: 'C', y: 300 })

    let ri = await si.post('sys:repl,use:repl,id:web')
    // console.log(ri)

    let res = await si.post('sys:repl,send:cmd', {
      id: 'web',
      cmd: '2+2\n',
    })
    console.log('SEND CMD RES', res)

    await si.ready()

    web(si)
    //console.log('BBBB')

    // .ready(function () {
    //   console.log('READY')
    //   console.log(this.export('repl/address'))
    // })
  } catch (e) {
    console.log('RUNERR', e)
  }
}

run()

// To get an automatic port assignment, run with
// node smoke.js --seneca.options.plugin.repl.port=0

// Accept REPL commands over HTTP POST JSON
// curl -X POST -H "Content-Type: application/json" -d '{"cmd":"1+1"}' http://localhost:8888/seneca-repl

function web(seneca) {
  const server = Http.createServer((req, res) => {
    // console.log(req)

    if (req.method === 'POST' && req.url.startsWith('/seneca-repl')) {
      let body = ''

      req.setEncoding('utf8')
      req.on('data', (chunk) => {
        body += chunk
      })

      req.on('end', () => {
        try {
          const data = JSON.parse(body)

          let cmd = data.cmd
          cmd = cmd.endsWith('\n') ? cmd : cmd + '\n'

          let id = data.id || 'web'

          const msg = {
            sys: 'repl',
            send: 'cmd',
            id,
            cmd,
          }

          // console.log('MSG', msg)

          seneca.delegate().act(msg, function (err, out) {
            let data = err ? { ok: false, err: err.message } : out
            let jsonout = JSON.stringify(data)
            // console.log('JSONOUT', jsonout)

            // Respond with the received JSON
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(jsonout)
          })
        } catch (err) {
          // If there's an error in JSON parsing, respond with an error
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
    } else {
      // Respond with a method not allowed error if not a POST request
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method Not Allowed')
    }
  })

  server.listen(8888)
}
