#!/usr/bin/env node

/* Copyright (c) 2019 voxgig and other contributors, MIT License */
'use strict'

const Net = require('net')

const Vorpal = require('vorpal')

const vorpal = Vorpal()

const connection = {}


function repl(vorpal) {
  vorpal
    .mode('repl')
    .delimiter('-> ')
    .init(function(args, cb) {
      if(!connection.open) {
        this.log('No connection. Type `exit` and use `connect`.')
      }
      cb()
    })
    .action(function(args, callback) {
      if(this.session && connection.remote_seneca) {
        this.session._modeDelimiter = connection.remote_seneca + '-> '
      }

      var cmd = args+'\n'
      connection.sock.write(cmd)
      callback()
    })
}

function connect(vorpal) {
  vorpal
    .command('connect [host] [port]')
    .action(function(args, callback) {
      var host = args.host || 'localhost'
      var port = parseInt(args.port || 30303, 10)
      this.log('Connecting to '+host+':'+port+' ...')
      var log = this.log.bind(this)
      telnet({log:log, host:host, port:port},function(err) {
        if(err) {
          log(err)
        }
        else {
          vorpal.exec('repl')
        }
        callback()
      })
    })
}

vorpal
  .delimiter('seneca: ')
  .use(repl)
  .use(connect)

vorpal
  .show()

if(2 < process.argv.length) {
  vorpal
    .exec(['connect'].concat(process.argv.slice(2)).join(' '))
}





function telnet(spec, done) {
  connection.first = true
  connection.sock = Net.connect(spec.port, spec.host)

  connection.sock.on('connect', function() {
    connection.open = true
    delete connection.closed
    done()
  })

  connection.sock.on('error', function(err) {
    if(!connection.closed) {
      done(err)
    }
  })

  connection.sock.on('close', function(err) {
    connection.open = false
    connection.closed = true
    spec.log('Connection closed.')
    vorpal.execSync('exit')
  })

  connection.sock.on('data', function(buffer) {
    var received = buffer.toString('ascii')

    if(connection.first) {
      connection.first = false

      connection.remote_prompt = received
      
      connection.remote_seneca = received
        .replace(/^seneca\s+/,'')
        .replace(/->.*$/,'')

      spec.log('Connected to '+connection.remote_seneca)
    }
    else {
      var rp = received.indexOf(connection.remote_prompt)
      if(-1 != rp) {
        received = received.substring(0,rp)
      }
      received = received.replace(/\n+$/, '\n')
      spec.log(received)
    }
  })
}
