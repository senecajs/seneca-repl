const { Duplex } = require('stream')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')

// seneca-repl aws://lambda/my-function-name?region=eu-west-1

class LambdaInvokeStream extends Duplex {
  constructor(def, options) {
    super(options)

    let region = def.region || 'us-east-1'
    let name = def.name

    this.lambdaClient = new LambdaClient({ region })
    this.lambdaFunctionName = name
    this.buffer = []
    this.processing = false
  }

  _write(chunk, encoding, done) {
    // console.log('write', chunk)
    this.processing = true
    const cmd = chunk.toString()

    if (!cmd.endsWith('\n')) {
      cmd += '\n'
    }

    const params = {
      FunctionName: this.lambdaFunctionName,
      Payload: JSON.stringify({
        body: {
          sys: 'repl',
          send: 'cmd',
          id: 'invoke',
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

          this.buffer.push(body.out + String.fromCharCode(0))
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
        // console.log('err', err)
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

    duplex = new LambdaInvokeStream({
      name,
      region,
      // region: 'eu-west-1'
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
