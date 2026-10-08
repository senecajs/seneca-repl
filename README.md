# @seneca/repl

A [Seneca](https://senecajs.org) plugin that gives a running service an
interactive REPL (read, evaluate, print loop). In a REPL session you can
send messages to the service by typing them in
[Jsonic](https://github.com/jsonicjs/jsonic) form, inspect patterns,
plugins and options, trace messages, work with data entities, and run
JavaScript against the live Seneca instance. Sessions are reached over a
local TCP port with the `seneca-repl` command line client, over HTTP or
AWS Lambda through your own endpoint, or directly with Seneca messages.
Works with Seneca 4 (tested with 4.0.0-rc5 and 4.0.0) and Seneca 3
(tested with 3.38).

[![npm version](https://img.shields.io/npm/v/@seneca/repl.svg)](https://npmjs.com/package/@seneca/repl)
[![build](https://github.com/senecajs/seneca-repl/actions/workflows/build.yml/badge.svg)](https://github.com/senecajs/seneca-repl/actions/workflows/build.yml)

| ![Voxgig](https://www.voxgig.com/res/img/vgt01r.png) | This open source module is sponsored and supported by [Voxgig](https://www.voxgig.com). |
|---|---|

## Install

```sh
npm install seneca @seneca/repl
```

`seneca` is a peer dependency (`>=3 || >=4.0.0-rc5`). Seneca 4 needs
Node.js 22 or later; the tests run on Node.js 24 and 22.

The package also installs the `seneca-repl` client. Run it with
`npx seneca-repl` in your project, or install it globally:

```sh
npm install -g @seneca/repl
```

To reach a REPL inside an AWS Lambda function, the client also needs the
AWS SDK Lambda client, which is not installed by default:

```sh
npm install -g @aws-sdk/client-lambda
```

## Quick Example

```js
const Seneca = require('seneca')

const seneca = Seneca({ log: 'warn' })
  .use('repl') // listens on 127.0.0.1:30303
  .add('role:shop,cmd:price', function (msg, reply) {
    reply({ item: msg.item, price: 1.5 })
  })

seneca.ready(function () {
  console.log('REPL address:', seneca.export('repl/address'))
})
```

Start the service, then connect from another terminal:

```
$ npx seneca-repl
Connected to Seneca: {
  version: '4.0.0-rc5',
  id: 'ckp1pf27feju/1791443560863/22827/4.0.0-rc5/-',
  when: 1791443562678,
  address: { address: '127.0.0.1', family: 'IPv4', port: 30303 }
}
ckp1pf27feju/1791443560863/22827/4.0.0-rc5/-> role:shop,cmd:price,item:apple

{ item: 'apple', price: 1.5 }

ckp1pf27feju/1791443560863/22827/4.0.0-rc5/-> quit
```

The prompt is the identifier of the Seneca instance. Type `quit` to
leave. The REPL listens on the loopback interface only; anyone who can
connect can run any code in your process, so read
[Secure the REPL](docs/how-to/secure-the-repl.md) before you change the
host.

## More Examples

* [Getting started](docs/tutorials/getting-started.md): start a REPL
  inside a service and use it with `seneca-repl`.
* [Drive a REPL over HTTP](docs/tutorials/drive-a-repl-over-http.md):
  an HTTP endpoint for REPL commands, used with `seneca-repl` and curl.
* How-to guides:
  [secure the REPL](docs/how-to/secure-the-repl.md),
  [inspect and send messages](docs/how-to/inspect-and-send-messages.md),
  [add custom commands and aliases](docs/how-to/add-custom-commands-and-aliases.md),
  [use the REPL over messages or a gateway](docs/how-to/use-the-repl-over-messages.md),
  [connect to AWS Lambda](docs/how-to/connect-to-aws-lambda.md),
  [keep and clear history](docs/how-to/keep-and-clear-history.md),
  [migrate from Seneca 3](docs/how-to/migrate-from-seneca-3.md).
* All runnable programs: [docs/examples](docs/examples/README.md).

The full documentation index is [docs/README.md](docs/README.md).

## Motivation

A REPL is the quickest way to find out what a running service is doing:
you type a message and see the reply, without writing a test or a client.
This plugin makes that work for Seneca services everywhere they run, from
a local development process to a serverless function that cannot accept
connections. See
[How the REPL evaluates input](docs/explanation/how-the-repl-evaluates-input.md)
and [Why several ways to connect](docs/explanation/why-several-ways-to-connect.md).

## Support

* Questions and bug reports: [GitHub issues](https://github.com/senecajs/seneca-repl/issues).
* Seneca documentation: [senecajs.org](https://senecajs.org) and the
  [Seneca 4 documentation](https://github.com/senecajs/seneca/blob/master/docs/README.md).
* Commercial support: [Voxgig](https://www.voxgig.com).

## API

Plugin options. Details in the [options reference](docs/reference/options.md).

| Option | Default | Purpose |
| ------ | ------- | ------- |
| `listen` | `true` | Open the TCP port when the plugin starts. |
| `host` | `'127.0.0.1'` | Interface the TCP port binds to. |
| `port` | `30303` | TCP port; `0` picks a free port. |
| `depth` | `11` | Inspection depth of trace and log lines. |
| `alias` | `stats`, `stats full` | Shortcuts that expand to other input. |
| `inspect` | `{}` | `util.inspect` options for trace and log lines. |
| `cmds` | `{}` | Custom REPL commands. |

Messages. Details in the [messages reference](docs/reference/messages.md).

| Pattern | Purpose |
| ------- | ------- |
| `sys:repl,use:repl` | Create (or get) a REPL session with an id. |
| `sys:repl,send:cmd` | Run one line of input in a session and reply with the output. |
| `sys:repl,add:cmd` | Add a custom command at runtime. |
| `sys:repl,echo:true` | Reply with the message itself. |

More reference pages:

| Reference | Describes |
| --------- | --------- |
| [Commands](docs/reference/commands.md) | Every REPL command, message input, JavaScript input and the session variables. |
| [Command line client](docs/reference/cli.md) | `seneca-repl` arguments, keys, directives, history and exit codes. |
| [Protocols](docs/reference/protocols.md) | The TCP, HTTP and AWS Lambda protocols and the end of response marker. |
| [Exports](docs/reference/exports.md) | `repl/address` and the module exports. |
| [Errors](docs/reference/errors.md) | The plugin's error codes. |

## Contributing

The [Senecajs org](https://github.com/senecajs/) encourages open
participation. If you feel you can help in any way, be it with
documentation, examples, extra testing, or new features, please get in
touch.

The plugin is written in TypeScript (`src/`) and compiled to `dist/`,
which is committed. The tests use jest and run against the Seneca 4
prerelease (devDependency `seneca@^4.0.0-rc5`). Node.js 24 is the
default target; Node.js 22 is also tested.

```sh
npm install
npm run build
npm test
```

To test against another Seneca version, install it without saving, for
example `npm install --no-save seneca@3`, run `npm test`, then run
`npm install` again. `npm run maintain` runs the Seneca repository
hygiene checks.

The continuous integration workflow change (Node.js 24 and 22) is
provided as a patch in [.patches](.patches/README.md), because workflow
files cannot be pushed without extra permissions. Apply it with
`git am .patches/*.patch`.

## Background

The REPL is one of the oldest Seneca plugins. Version 6 (2023) rebuilt
it around Node.js streams, marked the end of each response with a NUL
character, and added the entity commands and the HTTP and AWS Lambda
connections; the release notes are in [doc/](doc/version-6-release-pub.md).
Version 9.2 adds support for Seneca 4. See the [change log](CHANGES.md).

| @seneca/repl | Seneca | Node.js |
| ------------ | ------ | ------- |
| 9.2 | 4 (4.0.0-rc5 and later) and 3 (3.38 tested) | 24, 22 |
| 9.1 and earlier | 3 | |

Seneca 4 needs Node.js 22 or later. See
[Seneca 3 and Seneca 4](docs/explanation/seneca-3-and-4.md) for the
differences that matter to REPL users.

Licensed under [MIT](LICENSE).
