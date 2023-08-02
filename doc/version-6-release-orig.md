# @seneca/repl version 6 released!

I;'ve released a big update to the
[@seneca/repl](https://github.com/senecajs/seneca-repl) plugin! 

The [@seneca/repl](https://github.com/senecajs/seneca-repl) plugin
provides a
[REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop)
for the seneca microservices framework. It is one of the earliest
plugins, and has proven to be one of the most useful. A REPL
(Read-Execute-Print-Loop) is an interactive space to write code and
get it executed right away. If you've used the browser console, you've
used a REPL. With Node.js, you also get a REPL, just run the command
`node` by itself and off you go!

You can read more about the plan for the release in my previous post:
[@seneca/repl version 2.x
plan](http://www.richardrodger.com/2023/07/26/seneca-repl-version-2-x-plan/)
(Yeah, I did say 2.x - some sort of brain glitch!). Read that post to
understand what the Seneca REPL does for you exactly.


## New Feature: Entity Commands

The Seneca REPL lets you submit messages directly to a running Seneca
instance, just by entering the JSON source of the message
directly. Actually, it's even easier than that, as the REPL accepts a
easy-going form of JSON called
[Jsonic](https://github.com/jsonicjs/jsonic) that lets you skip most
of the strict JSON syntax. Here's an example of using the REPL to get
the status of a Seneca instance:

```
$ seneca-repl
> role:seneca,stats:true
{
  start: '2023-08-01T19:23:23.274Z',
  act: { calls: 105, done: 104, fails: 0, cache: 0 },
  actmap: undefined,
  now: '2023-08-01T19:29:00.108Z',
  uptime: 336834
}
```

In the above interaction, this full JOSN message was submitted:

```
{ "role":"seneca", "stats":true }
```

And this is equivalent to the Seneca API call:

```
seneca.act({ "role":"seneca", "stats":true })
```

And also, since Seneca accepts Jsonic too:

```
seneca.act('role:seneca,stats:true')
```

When it comes to Seneca data entities that provide a simple
[ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping)
to access your database, you could always interact with them using
their standard Seneca messages (which is one the main points of using
Seneca: everything is a message!).

Thus, the equivalent of:

```
seneca.entity('foo').list$() // list all rows in the table "foo"
```

is the REPL message:

```
> sys:entity,cmd:load,name:foo
```

The REPL itself also provides a Seneca instance, so you could also
always just write some standard Seneca code, as above.

But this is too much work, and since I have always held to [Larry
Wall's programming virtues: Laziness, Impatience, and
Hubris](https://thethreevirtues.com/), it is high time we got a REPL
shortcut for data entities (since, empirically, this is the *most*
common use case for the REPL!).

Each entity operation, `list$, load$, save$, remove$`, gets its own
REPL command, and they all follow the same syntax:

```
CMD$ CANON [QUERY]
```

Where:

* CMD$ is one of `list$, load$, save$, remove$`
* CANON is an entity canon specifier (i.e. table name) in the form: `[zone/[base/]]name`
* QUERY is an optional JSON object defining a query, or entity data.

Let's look at some examples!

Let's say you are using the
[@seneca/user](https://github.com/senecajs/seneca-user) plugin to
provide user management for your app. This defines the `sys/user` and
`sys/login` data entities to store user details, and login
sessions. To list all your users in the REPL, use:

```
> list$ sys/user
[
  { id:'aaa', name:'Alice', group:'foo' },
  { id:'bbb', name:'Bob', group:'foo' },
  { id:'ccc', name:'Cathy', group:'bar' }
]
```

To list only users in the "foo" group, add a query:

```
> list$ sys/user group:foo
[
  { id:'aaa', name:'Alice', group:'foo' },
  { id:'bbb', name:'Bob', group:'foo' },
]
```

Since the REPL is just a normal Node.js REPL, the value of the last
response is available in the `_` variable, so you can save it to a
local variable.

```
> foo__users = _
```

The `load$` command operates in the same way, and you can also load a single 
entity directly by the `id` field with:

```
> load$ sys/user aaa
{ id:'aaa', name:'Alice', group:'foo' }
```

The `save$` command accepts data instead of a query as its second parameter:

```
> save$ sys/user id:aaa,group:bar
> load$ sys/user aaa
{ id:'aaa', name:'Alice', group:'bar' }
```

Finally, the `entity$ CANON` command gives you meta data about an
entity (not much for now, more to come in a future release).


## New Feature: Auto Reconnection

The most common way to use the REPL is for quick debugging and testing
during local development sessions (Developer Experience FTW!). Since
this often involves restarting your server (well, not if you use
[@seneca/reload](https://github.com/senecajs/seneca-reload), but that
is a post for another day), the REPL connection gets lost and you can
to reconnect manually. Again, invoking Larry Wall, I am too lazy to do
this!

The REPL client will keep trying to reconnect (using a backoff) to the
server, so that it "just works" of you do a restart of the server. YOu
can also just hit the return key to try to reconnect right away.

A small feature, but kind of a big deal for everyday development.


## New Feature: REPL Tunnels

While it is always possible to expose the REPL port using an SSH
Tunnel, in practice this is usually quite painful to set
up. Separately, it has not been possible to drive the REPL using
Seneca messages, which is a shocking omission and goes somewhat
against the basic principles of the Seneca framework.

We can solve both these problems together! First, you can use the new
`sys:repl,send:cmd` message to submit commands, and get their response
(as text). Second, you can provide a custom Duplex stream that
abstracts the actual mechanism for passing commands ands responses
into and out of the REPL.

The new version provides a HTTP tunnel, and an AWS Lamdba tunnel, so
that you can keep talking to your microservices even as they get
further and further away from you. It's nice to be able to debug
staging and build systems directly using a live REPL.

> # WARNING 
> This feature is a security risk! Don't expose your
> production systems by using it without additional access controls.

To submit a command, or use a REPL tunnel, you must first create a
REPL instance to connect to. The traditional direct REPL connection
does this automatically, but for tunnels, you have to do it yourself.

Create a REPL instance with a specific id using:

```
seneca.act('sys:repl,use:repl,id:foo')
```

The `id` can be any string. As a convenience, the HTTP and Lambda
tunnels on the client side use `web` and `invoke` by default, so if
you use those `ids`, you have less to type when connecting on the
command line (again, Lazy!).

To submit a command message programatically, provide the id and
command text as parameters with properties `id` and `cmd` respectively:

```
let result = await seneca.post('sys:repl,send:cmd', {id:'foo', cmd:'1+1'})
// result === '2\n'
```

To use the tunnels, follow the instructions in the README to get them
set up on the server side. From the client side, you will need to
install the `seneca-repl` command as a global npm module:

```
npm i -g seneca @seneca/repl
```

The HTTP tunnel is built in. To use the AWS Lambda tunnel, also
install the AWS SDK:

```
npm i -g @aws-sdk/client-lambda
```

To make this all extensible and controllable, the first argument to
the `seneca-repl` client can now be proper URL, which you can use as
follows:

```
$ seneca-repl                # connects to default localhost:30303
$ seneca-repl myserver       # connects to  myserver:30303
$ seneca-repl myserver:40404 # connects to  myserver:40404
$ seneca-repl telnet://myserver:40404 # the "official" URL
```

For the HTTP tunnel (assuming you've configured path `/seneca-repl`) use:

```
$ seneca-repl http://localhost:8080/seneca-repl?id=foo # custom id
```

The AWS Lambda tunnel uses the normal AWS access controls, so set up
your `AWS_PROFILE` environment variable, and then use:

```
$ seneca-repl aws://lambda/function-name?region=eu-west-1 # default region is us-east-1
```

Let's just say that with this lovely new feature you'll be losing your
hard-earned [WOMM&trade;
certification](https://blog.codinghorror.com/the-works-on-my-machine-certification-program/) -
sorry!


## New Feature: Isolated History

Keeping a history of your previous REPL commands is a pretty vital
part of good developer experience. And Seneca REAL sucked at
this. Your history was transient and lived in-memory on the server.

In this new release, your history is stored locally in a hidden
`.seneca` folder in your home folder, and a separate history is kept
for each unique connection URL. The history is not truncated, which is
also important for long running projects.

Since you may be running multiple Seneca servers for multiple
projects, you can add an extra URL parameter to keep project-specific
histories. You can use whatever you like, but may I suggest `project`?

```
$ seneca-repl locahost?project=foo # unique command history for the "foo" project
$ seneca-repl locahost?project=bar # unique command history for the "bar" project
```

# Done!

And now we have a new, long awaited, release of the @seneca/repl plugin. Enjoy!

Oh, it's a open source, and on github:
https://github.com/senecajs/seneca-repl so this is the place to submit
bugs, issues, and feature requests!




