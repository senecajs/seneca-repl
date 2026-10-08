# Command line client reference

`seneca-repl` (the file `bin/seneca-repl-exec.js`) is an interactive
client for REPL sessions. It is installed with the package:
`npx seneca-repl` in a project, or `seneca-repl` after
`npm install -g @seneca/repl`.

## Usage

```
seneca-repl
seneca-repl <host> <port>
seneca-repl <address>
```

| Form | Connects to |
| ---- | ----------- |
| no arguments | `telnet://127.0.0.1:30303` |
| `<host> <port>` | `telnet://<host>:<port>`, for example `seneca-repl 127.0.0.1 30310` |
| `<address>` without `://` | `telnet://<address>`, for example `seneca-repl localhost:30303` |
| `<address>` with a scheme | The address as given; the scheme selects the protocol. |

A TCP address without a port uses 30303. An address that is not a valid
URL stops the client with `# CONNECTION URL ERROR:`.

## Protocols

| Scheme | Protocol | Query parameters |
| ------ | -------- | ---------------- |
| `telnet:` | TCP connection to the plugin's port. | Ignored (but part of the history file name). |
| `http:`, `https:` | One POST request per line to the URL, for an endpoint you provide. User and password in the URL are sent as HTTP Basic authentication. | `id`: the session id, default `web`. All parameters stay in the URL that is posted to. |
| `aws:` | One AWS Lambda invocation per line, for `aws://lambda/<function name>`. Needs `@aws-sdk/client-lambda`. | `region`: default `us-east-1`. `id`: the session id, default `invoke`. |

Other schemes are looked up as `bin/protocol-<scheme>.js`; an unknown
scheme stops the client with `# CONNECTION ERROR: unknown protocol`.
The formats are in [Protocols](protocols.md).

## Session

On connecting, the client sends `hello`, prints
`Connected to Seneca: { version, id, when, address }`, and shows the
prompt `<instance id>> `. Then:

* Each line you type is sent as one command, in order, and each
  response is printed when it arrives. Over HTTP and AWS Lambda, a line
  is sent when the request for the previous one has finished.
* `quit` or `exit` ends the client (exit code 0), and so does Ctrl-D.
* `data <variable> <file>` saves the variable as JSON to `<file>`,
  relative to the client's working directory; `data <variable>` prints
  the JSON.
* `<% ... %>` directives are expanded before the line is sent (below).

## Keys

| Key | Effect |
| --- | ------ |
| Up, Down | Step through the history. |
| Tab | Complete the line from history entries that start with it. |
| Ctrl-R | Search the history: type part of a command; Ctrl-R again for the next older match; Enter puts the match on the prompt; Backspace and Ctrl-U edit the search. |
| Ctrl-G | Cancel the search. |

## History

Each address has its own history file:
`~/.seneca/repl-<URL encoded address>.history`. See
[Keep and clear history](../how-to/keep-and-clear-history.md).

## Reconnecting

If an established connection closes (for example, the service
restarts), the client prints `Connection closed.` and reconnects, first
after about 0.1 seconds and then with a delay that grows by 10% per
attempt, up to about 33 seconds. Typing a line while disconnected
starts a reconnection at once (the line is not sent). After
reconnecting it prints the `Connected to Seneca` banner again: the new
connection is a new session.

If the first connection fails, the client prints
`# CONNECTION ERROR: <reason>` and exits with code 1.

## Directives

A directive is an expression between `<%` and `%>`, replaced by its
value before the line is sent. Directives are evaluated by the client,
so files are read from the client's machine.

| Function | Value |
| -------- | ----- |
| `Load(path)` | The contents of the file, as a JSON string literal. A relative path is relative to the client's working directory. |
| `Match(text, regexp, [group])` | The first match of `regexp` in `text` (a JSON string, such as the value of `Load`), or the given group, as a JSON string literal; `""` when there is no match. |
| `VxgAction(pattern, name, source)` | JavaScript that replaces the function of the action for `pattern` (exact match) with the function in `source`. An `async function (msg, meta)` is wrapped so that its return value is the reply. `name` is not used by Seneca 4's `find`. |
| `VXGACT` | A regular expression that extracts the returned function from a module of the form `module.exports = function make_<x>_<y>(...) { ... return <function> }`. |

Arguments are JSON values (strings in double quotes, numbers, `true`,
`false`, `null`), `undefined`, `NaN`, regular expressions `/.../`
(with at most one flag letter), `VXGACT`, or nested calls.

Examples, with files from the repository's `test` folder:

```
> t = <% Load("test/hello.txt") %>
'Hello\n'

> m = <% Match(Load("test/hello.txt"), /H(el+)o/, 1) %>
'ell'

> <% VxgAction("vxg:1", "foo_bar", Match(Load("test/vxg-action.js"), VXGACT, 1)) %>
[Function (anonymous)]
```

After the last line, the action for `vxg:1` runs the function from
`test/vxg-action.js`. Use this to try a new version of an action without
restarting the service.

## Messages and exit codes

| Output | Meaning | Exit code |
| ------ | ------- | --------- |
| `# CONNECTION URL ERROR: <message> <address>` | The address is not a valid URL. | 1 |
| `# CONNECTION ERROR: <reason>` | The first connection failed, or the protocol is unknown. | 1 |
| `# ERROR: <text>` on connecting | The reply to `hello` was an error (for example an unknown session id over HTTP or Lambda, or an endpoint that does not return JSON). | 1 |
| `# ERROR: <text>` later | A request failed or the endpoint returned an error; the client keeps running. | |
| `Connection closed.` | An established connection closed; the client reconnects. | |
| `# ERROR: invalid JSON recieved: <message>` | `data` received something that is not JSON. | |
| `# ERROR: unable to save JSON data to <file>: <message>` | `data` could not write the file. | |

`quit`, `exit` and Ctrl-D exit with code 0.
