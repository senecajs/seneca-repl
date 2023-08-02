# @seneca/repl version 2.x plan

I'm updating the
[@seneca/repl](https://github.com/senecajs/seneca-repl) plugin! Here
is the basic plan.

NOTE: There's a [`@seneca/repl dev` Github Project](https://github.com/orgs/senecajs/projects/2) to track this work.

The [@seneca/repl](https://github.com/senecajs/seneca-repl) plugin
provides a
[REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop)
for the seneca microservices framework. It is one of the earliest
plugins, and has proven to be one of the most useful. A REPL
(Read-Execute-Print-Loop) is an interactive space to write code and
get it executed right away. If you've used the browser console, you've
used a REPL. With Node.js, you also get a REPL, just run the command
`node` by itself and off you go!

The big thing about a REPL is the speed boost it gives your
development process. You just type stuff in and it works right
away. You can directly inspect objects to see what they are made
of. Debugging is much easier.

The Seneca REPL provides you with the standard Node.js REPL -- you can
execute arbitrary JavaScript. But it also provides you with access to
the root Seneca instance, and with shortcuts to post Seneca messages,
and examine the running Seneca system.

For example, if you have a message `foo:bar,zed:qaz`, then you can
post that message directly in the REPL:

```
> foo:bar,zed:qaz
```

The REPL accepts any valid JSON (or the equivalent Jsonic form of
abbreviated JSON) as an input and attempts to post the input as a
message, printing the result. Combine this with hot-reloading from the
[@seneca/reload](https://github.com/senecajs/seneca-reload) plugin and
you have a lovely little high speed local development environment for
your microservice system.

An update for [@seneca/repl](https://github.com/senecajs/seneca-repl)
is long overdue. I've created a Github project to track the main
tasks. The most important new feature is the ability to interact with
the REPL when your microservice is running in a serverless context.

A traditional REPL exposes a network port and you cannot do that over
the network. This is fine for local development, but it is not
supported in a serverless context. However most serverless
environments provide an invocation mechanism so you can send messages
to your deployed function. I'm extending
[@seneca/repl](https://github.com/senecajs/seneca-repl) so that it can
support this interaction pathway by providing a special message:
`sys:repl,send:cmd` that can run REPL commands and collect their
output.

To implement this some refactoring is required. The old codebase is
pretty old. As in, callback-hell old. It also assumes a network
socket. So this all has to be pulled apart and abstracted a
little. The code is very much streams-based, and that also makes it
fun, as the streams have to be marshalled to operate via a
request/response interaction.

One issue in the existing code is the lack of a delimiter for the
command result. It all sort of works by accident! I'm going to use NUL
as the delimiter to mark the end of command response text. This should
also clear up some bizarro bugs.

The other new feature is more direct support for Seneca entities with
an extended set of special commands: `list$`, `save$`, `load$`,
etc. that mirror the Seneca entity operations. This is a pretty big
use case and we've been putting up with the kludgy workaround of using
entity messages directly for ... too many years, sigh.

On the command-line side, the REPL client needs to be extended to
perform serverless invocations. A stream overlay will be used for this
to preserve streams as the basic abstraction for REPL communication.

The other tasks are housekeeping to move to the new Seneca standard
test runner, [Jest](https://jestjs.io/), and convert the codebase to
[Typescript](https://www.typescriptlang.org/).

Once this release is out, the
[@seneca/gateway](https://github.com/senecajs/seneca-gateway) plugins
will need to be updated to handle security more generally when
exposing a REPL. At the moment we tend to use a `monitor` serverless
function that has no external exposure, and can only be called by
invocation with appropriate credentials. This `monitor` function also
uses our little trick of embedding all the other microservices as a
modular monolith so that you can use the REPL to post any
message. While this is mostly sufficient in practice, it would be nice
to also be able to invoke any function directly via the REPL.
