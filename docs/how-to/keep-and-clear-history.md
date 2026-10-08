# Keep and clear history

How `seneca-repl` remembers the commands you type, how to keep separate
histories, and how to clear them.

## Where history is kept

The client keeps one history file per address, in the folder `.seneca`
in your home directory (created when it does not exist):

```
~/.seneca/repl-<address>.history
```

`<address>` is the address you gave the client, URL encoded, after the
client added the defaults: `seneca-repl` alone and `seneca-repl
127.0.0.1 30303` both use `telnet://127.0.0.1:30303`. For example:

| Command | History file |
| ------- | ------------ |
| `seneca-repl` | `repl-telnet%3A%2F%2F127.0.0.1%3A30303.history` |
| `seneca-repl 127.0.0.1 30310` | `repl-telnet%3A%2F%2F127.0.0.1%3A30310.history` |
| `seneca-repl http://127.0.0.1:8080/seneca-repl` | `repl-http%3A%2F%2F127.0.0.1%3A8080%2Fseneca-repl.history` |
| `seneca-repl 'aws://lambda/shop-repl?region=eu-west-1'` | `repl-aws%3A%2F%2Flambda%2Fshop-repl%3Fregion%3Deu-west-1.history` |

Each line you send is added to the file as you typed it (`<% %>`
directives are stored unexpanded). `quit` and `exit` are not stored. The
file is never trimmed.

## Use the history

When the client starts, it loads the file:

* Up and Down step through earlier commands.
* Tab completes the current line from history entries that start with
  what you typed.
* Ctrl-R starts a search: type part of a command to find the most recent
  match, press Ctrl-R again for older matches, Enter to put the match on
  the prompt (press Enter again to run it), Ctrl-G to cancel.

## Keep separate histories for one address

The query string is part of the address, and the TCP protocol ignores
it, so a query parameter gives a separate history for the same service:

```sh
npx seneca-repl 'localhost:30303?project=shop'
npx seneca-repl 'localhost:30303?project=billing'
```

(`localhost:30303` without a scheme is a TCP address.)

## Clear history

Quit the client, then delete the file for one address, or all of them:

```sh
rm ~/.seneca/repl-telnet%3A%2F%2F127.0.0.1%3A30303.history
rm ~/.seneca/repl-*.history
```

The client keeps its file open while it runs, so delete files only when
no client is running.

Because the address is part of the file name, a user name, password or
token in the address is stored in the file name too. Delete those files
when you no longer need them.

## The session's own history

Separately, each REPL session in the service remembers the lines it
received, in memory:

* `history` prints them.
* `last` runs the previous line again.

This list belongs to the session and is lost when the session ends.

## See also

* [Command line client](../reference/cli.md).
* [Commands: history and last](../reference/commands.md#history).
