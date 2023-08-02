# @seneca/repl Version 6 Released!

I've released a substantial update to the [@seneca/repl](https://github.com/senecajs/seneca-repl) plugin!

The [@seneca/repl](https://github.com/senecajs/seneca-repl) plugin provides a [REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop) for the Seneca microservices framework. As one of the earliest plugins, it has proven to be incredibly useful. A REPL (Read-Execute-Print-Loop) offers an interactive space to write code and execute it instantly. If you've ever used the browser console or run the command `node` in Node.js, you've used a REPL.

To learn more about the plan for this release, refer to my previous post: [@seneca/repl version 2.x plan](http://www.richardrodger.com/2023/07/26/seneca-repl-version-2-x-plan/) (Yes, I did say 2.x - that was a brain glitch!). Read that post to understand what the Seneca REPL can do for you.

## New Feature: Entity Commands

The Seneca REPL allows you to send messages directly to a running Seneca instance, just by entering the JSON source of the message. In fact, it's even simpler than that, as the REPL accepts a relaxed form of JSON called [Jsonic](https://github.com/jsonicjs/jsonic), which lets you avoid most strict JSON syntax rules.

Here's an example of using the REPL to get the status of a Seneca instance:

```shell
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

In this interaction, the full JSON message was submitted:

```json
{ "role":"seneca", "stats":true }
```

This is equivalent to the Seneca API call:

```javascript
seneca.act({ "role":"seneca", "stats":true })
```

Also, since Seneca accepts Jsonic too:

```javascript
seneca.act('role:seneca,stats:true')
```

When working with Seneca data entities that provide a simple [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) to access your database, you can interact with them using standard Seneca messages. For example:

```javascript
seneca.entity('foo').list$() // lists all rows in the table "foo"
```

In the REPL, this would be the equivalent message:

```shell
> sys:entity,cmd:load,name:foo
```

The REPL itself also provides a Seneca instance, allowing you to write standard Seneca code.

However, adhering to [Larry Wall's programming virtues: Laziness, Impatience, and Hubris](https://thethreevirtues.com/), I've introduced a REPL shortcut for data entities, as they are empirically the most common use case for the REPL.

Each entity operation (`list$, load$, save$, remove$`) gets its own REPL command, all following the same syntax:

```shell
CMD$ CANON [QUERY]
```

Here are some examples:

```shell
> list$ sys/user
> list$ sys/user group:foo
> save$ sys/user id:aaa,group:bar
> load$ sys/user aaa
```

The REPL commands provide various functions to manage data entities, and details and examples can be found in the article.

## New Feature: Auto Reconnection

To enhance developer experience, the REPL client now automatically reconnects to the server if disconnected, using a backoff mechanism. You can also hit the return key to reconnect instantly.

## New Feature: REPL Tunnels

Configuring REPL tunnels has been simplified, and it's now possible to drive the REPL using Seneca messages. We've introduced HTTP and AWS Lambda tunnels, and detailed instructions are provided in the article.

> **WARNING:** This feature is a security risk! Don't expose your production systems without additional access controls.

## New Feature: Isolated History

This release improves command history storage, now saved locally in a hidden `.seneca` folder in your home folder. It keeps a separate history for each unique connection URL, and histories are not truncated.

```shell
$ seneca-repl localhost?project=foo # unique command history for the "foo" project
$ seneca-repl localhost?project=bar # unique command history for the "bar" project
```

# Done!

With this new, eagerly anticipated release of the @seneca/repl plugin, there are many features to explore and enjoy. As it's open-source, you can find it on [GitHub](https://github.com/senecajs/seneca-repl), where you're welcome to submit bugs, issues, and feature requests. Enjoy!
