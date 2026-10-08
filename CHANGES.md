# Change log

## 9.2.0 2026-10-08

Seneca 4 support. Tested with seneca@4.0.0-rc5, the unreleased 4.0.0
(Seneca master) and 3.38, on Node.js 24 and 22.

### Seneca 4

* `seneca` is a peer dependency: `>=3 || >=4.0.0-rc5`.
* The close hook is registered on `sys:seneca,cmd:close` on Seneca 4
  (`role:seneca,cmd:close` on Seneca 3), so `seneca.close()` closes the
  REPL sessions and the TCP port. With 9.1.0 on Seneca 4.0.0-rc5 the
  hook was never called: the port stayed open and the process did not
  exit.
* The TCP port is opened in a callback style init function, and the
  close hook is a callback style action, so the plugin no longer needs
  seneca-promisify on Seneca 3.
* The option shape is built with the Gubu builders of the Seneca
  instance that loads the plugin (`defaults` is a function of
  `{ valid }`), instead of an import of `gubu`, which was not a declared
  dependency. Seneca 4 uses Gubu 9, Seneca 3.38 Gubu 8.
* The plugin error codes `unknown-repl`, `invalid-status` and
  `invalid-cmd` have messages.

### Fixes

* Each TCP connection gets its own session. Before, every connection
  used the id of the server address, so a second client connected at
  the same time got no session. Closing does not wait for connected
  clients.
* `trace` and `log` wrote to a stream that does not exist, which broke
  the session. They now write to the session's output. `log` toggles
  printing again (as in 5.x), so `log` and `log match` work.
* A message typed while `trace` is on, or one whose reply is empty, now
  ends its response, so neither the client nor `sys:repl,send:cmd`
  waits forever.
* `sys:repl,send:cmd` without an `id` uses the same default id as
  `sys:repl,use:repl` (`<host>~<port>`).
* The Node.js REPL command `.clear` no longer breaks the session: the
  session variables are set up again on the new context.
* Entity command errors include the reason.
* A closed session removes its log listener, and the timer that removes
  it no longer keeps the process alive.
* `seneca-repl`:
  * Responses that arrive in several chunks are joined correctly. The
    client put commas between chunks, which on Node.js 24 made it fail
    to connect (`# ERROR: '{"version":...}',`).
  * A failed first connection and an unknown protocol print
    `# CONNECTION ERROR: <reason>` and exit with code 1; the client used
    to exit silently with code 0.
  * An invalid address prints `# CONNECTION URL ERROR:` instead of
    crashing with a ReferenceError.
  * HTTP request errors are printed (they were lost), and an endpoint
    response that is not JSON is reported instead of crashing the
    client.

### Development

* Tests use jest 29, on Node.js 24 and 22. New tests for concurrent
  TCP sessions, close with connected clients, the default id, the error
  codes, `trace`, `log` and `.clear`. Tests listen on `127.0.0.1` only
  and close every instance they create.
* TypeScript 5.9 and @types/node 24 (TypeScript 5.4 cannot compile with
  the current Node.js types).
* devDependencies: seneca@^4.0.0-rc5, seneca-entity@^28.1.0 (26 did not
  install next to @seneca/entity-util 3). Removed the packages that no
  build, test or example uses: @aws-sdk/client-lambda (still loaded by
  the client for `aws:` addresses when installed), @seneca/gateway-auth,
  @seneca/owner, @seneca/user, seneca-doc and seneca-mem-store. Removed
  the `doc` script.
* `npm run maintain` runs the @seneca/maintain checks.
* Removed `.travis.yml`. The GitHub Actions change (a Node.js 24 and 22
  matrix) is provided as a patch in `.patches/`.
* The published package includes `docs/` and `CHANGES.md`.

### Documentation

* Reorganized following [Diátaxis](https://diataxis.fr/): the README is a
  short landing page, and `docs/` has tutorials, how-to guides,
  reference pages, explanations and runnable examples.

## 9.1.0 and earlier

See the [commit history](https://github.com/senecajs/seneca-repl/commits/main)
and the [version 6 release notes](doc/version-6-release-pub.md).
