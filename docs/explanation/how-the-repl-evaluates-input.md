# How the REPL evaluates input

A REPL session looks like the Node.js REPL, and it is one: the plugin
starts a Node.js REPL server (`node:repl`) for each session, with its
own evaluation function. This page follows one line of input through
that function, and explains the choices behind it.

## A session

A session is a Node.js REPL server bound to two streams: it reads lines
from `input` and writes to `output`. For a TCP connection both are the
socket; for sessions created with `sys:repl,use:repl` they are
`PassThrough` streams, or streams you supply. The REPL is started
without a prompt (the client shows its own) and with its own context
object, not the global one.

The context starts with the session variables: `seneca` and `s` (the
session's Seneca delegate), `history`, `alias`, the command map, the
named delegates, and the state of `trace`, `log`, `depth` and `plain`.
The Node.js globals are there too, including `require` and `process`.

## One line, step by step

1. **Repeat or record.** The line is trimmed. `last` is replaced by the
   previous line; any other line is added to the session history.
2. **Aliases.** If the whole line is an alias name, it is replaced by
   the alias text.
3. **Commands.** The first word is looked up in the command map, after
   alias replacement of that word alone (so `alias p price` makes
   `p apple` run `price apple`). A command function gets the rest of the
   line and a `respond` callback.
4. **Messages.** The line is split at `~>`. Backquoted templates in the
   message part are filled in from the session variables, and the result
   is parsed with Jsonic. If that gives an object, it is sent with
   `seneca.act` through the current delegate. The reply goes into `out`,
   an error into `err`, and the part after `~>` names a variable for the
   result.
5. **JavaScript.** Anything else is compiled as a script and run in the
   session context. If Node.js rejects the script because `await` is
   not allowed there, the line is run again inside an `async` function
   and the promise is awaited.
6. **Print.** The result is formatted with `util.inspect` (the `data`
   command asks for a full, single line format for its JSON), and the
   session writes it followed by a NUL character.

Every path ends in the same `respond` function, which is what writes the
NUL. Lines that the Node.js REPL handles itself (`.help`, `.clear` and
the other dot commands) never reach this function, so they produce no
NUL.

## Why messages come before JavaScript

The main thing you do at a Seneca REPL is send messages, so they get the
shortest form: `role:shop,cmd:price,item:apple` instead of
`seneca.act({ role: 'shop', cmd: 'price', item: 'apple' }, ...)`. Jsonic
accepts that form, and also full JSON.

The price is ambiguity. Jsonic is permissive, and some JavaScript is
valid Jsonic: `seneca.list("role:shop")` parses as an object with the
key `seneca.list("role` and the value `shop")`, so it is sent as a
message (and fails as an unknown pattern). Text with a space before the
first colon is not taken as a key, which is why `x = seneca.list("role:shop")`
and `seneca.list( "role:shop" )` run as JavaScript. When in doubt, write
patterns as objects in JavaScript (`seneca.list({ role: 'shop' })`), or
use the commands (`list role:shop`).

## Why a delegate

Messages from a session go through a delegate that fixes `repl$: true`
and `fatal$: false` on every message. `repl$` lets actions, logs and
traces tell REPL traffic apart from normal traffic. `fatal$: false`
means an error in a message you typed is never fatal to the service.

The delegate also carries the trace hooks: Seneca calls a delegate's
`on_act_in`, `on_act_out` and `on_act_err` functions for the actions
run through it, and through the delegates those actions use. That is
why `trace` shows the messages you send and the messages their actions
send, but not unrelated traffic. The `delegate` command swaps in other
delegates, with other fixed properties, in the same way.

`log` uses a different mechanism: a listener on the instance's `log`
event, which receives every entry of every level before Seneca filters
them. That is why `log` shows debug entries even when the service logs
at `warn`, and why `log match` is the useful form.

## Why a NUL at the end

A REPL is a conversation over a stream, with no built in notion of where
a response ends. Over a local terminal that does not matter. To run
commands as request and reply, over HTTP, Lambda or Seneca messages,
the plugin needs to know when the response to one line is complete.
Since version 6, every response ends with a NUL character, which cannot
appear in normal output. `sys:repl,send:cmd` collects output up to the
NUL, and the `seneca-repl` client splits what it receives on it.

## Limits that follow

* Each line is evaluated on its own: a function or block split over
  several lines fails at the first line. Write it on one line.
* Results are printed with the default `util.inspect` depth; the
  `depth` option and command change trace and log lines only.
* A result that is the session's own delegate prints as `null`, so that
  evaluating `seneca` does not print the whole instance.
* The REPL is not a sandbox. The context is separate from the global
  object, but `require` and `process` are available, and messages act
  on the live service. See [Secure the REPL](../how-to/secure-the-repl.md).

## See also

* [Commands](../reference/commands.md).
* [Why several ways to connect](why-several-ways-to-connect.md).
