const { Duplex } = require('stream')

let AWS_SDK_CLIENT_LAMBDA = null
try {
  AWS_SDK_CLIENT_LAMBDA = require('@aws-sdk/client-lambda')
}
catch(e) {
  console.error(e.message)
  console.error('Install the module @aws-sdk/client-lambda to access AWS Lambda REPLs.')
  process.exit(1)
}

// TODO: try catch and print error if not found
const { LambdaClient, InvokeCommand } = AWS_SDK_CLIENT_LAMBDA

// seneca-repl aws://lambda/my-function-name?region=eu-west-1

class LambdaInvokeStream extends Duplex {
  constructor(def, options) {
    super(options)

    let region = def.region || 'us-east-1'
    let id = def.id || 'invoke'
    let name = def.name

    this.lambdaClient = new LambdaClient({ region })
    this.lambdaFunctionName = name
    this.buffer = []
    this.processing = false
    this.id = id
  }

  _write(chunk, encoding, done) {
    // console.log('write', chunk)
    this.processing = true
    let cmd = chunk.toString()

    if (!cmd.endsWith('\n')) {
      cmd += '\n'
    }

    const params = {
      FunctionName: this.lambdaFunctionName,
      Payload: JSON.stringify({
        body: {
          sys: 'repl',
          send: 'cmd',
          id: this.id,
          cmd,
        },
      }),
    }

    // console.log('params',params)

    const command = new InvokeCommand(params)

    this.lambdaClient.send(command).then(
      (data) => {
        // console.log('data', data)
        if (200 === data.StatusCode) {
          let json = Buffer.from(data.Payload).toString()
          // console.log('json', json)
          const res = JSON.parse(json)
          // console.log('res', res)
          const body = JSON.parse(res.body)
          // console.log('body', body)

          let out = ''

          if (500 === res.statusCode) {
            out =
              '# ERROR: ' +
              (body.error$
                ? body.error$.code + ' ' + (body.error$?.message || '')
                : 'unknown')
          } else {
            out = body.out
          }

          this.buffer.push(out + String.fromCharCode(0))
        } else {
          this.buffer.push(
            '# ERROR: ' + JSON.stringify(data) + String.fromCharCode(0),
          )
        }

        this.processing = false
        this._read()
        done()
      },
      (err) => {
        console.log('err', err)
        this.buffer.push(
          `# ERROR invoking Lambda function: ${err}` + String.fromCharCode(0),
        )
        this.processing = false
        this._read()
        done()
      },
    )
  }

  _read(size) {
    // console.log('read', this.processing, this.buffer)

    if (this.processing) {
      return
    }

    let chunk
    while ((chunk = this.buffer.shift())) {
      if (!this.push(chunk)) {
        break
      }
    }

    // if (this.buffer.length === 0) {
    //  this.push(null)
    // }
  }
}

module.exports = function makeProtocol(spec) {
  // console.log('MP AWS', spec)

  let duplex = null

  const service = spec.url.hostname
  if ('lambda' === service) {
    const name = spec.url.pathname.substring(1).split('/')[0]

    const region = spec.url.searchParams.get('region')
    const id = spec.url.searchParams.get('id')

    duplex = new LambdaInvokeStream({
      name,
      region,
      id,
    })

    setImmediate(() => {
      duplex.emit('connect')
    })

    // console.log(duplex)
  } else {
    throw new Error('Unknown AWS service: ' + service)
  }

  // console.log('PAWS', !!duplex)
  return duplex
}
