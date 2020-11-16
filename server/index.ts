#!/usr/bin/env node

import http from 'http'
import cp from 'child_process'
import { StreamMessageReader, StreamMessageWriter, createMessageConnection } from 'vscode-jsonrpc'
import parseArgs from 'minimist'
import fetch from 'isomorphic-fetch'

type Connection = {
  id: string
  reader: StreamMessageReader
  writer: StreamMessageWriter
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log('Usage: index.js --command=solargraph --commandArgs=--stdio --port=3000')
  process.exit(1)
}

const port = parseInt(args.port) || 7658

let CONNECTIONS: Connection[] = []

const proxy = { host: process.env.PROXY_HOST, port: process.env.PROXY_PORT }

const server: http.Server = http.createServer((req, res) => {
  if (!req.url) {
    return
  }

  const [_, id, action] = req.url.split('/')

  if (!id || !['messages', 'init', 'disconnect'].includes(action)) {
    console.error('Invalid URL format', req.url)
    return
  }

  res.setHeader('Content-Type', 'application/json')

  let body = ''

  req.on('data', (data) => {
    body += data
  })

  req.on('end', () => {
    switch(action) {
      case 'init':
        const langServer = cp.spawn(args.command, [].concat(args.commandArgs))
        const reader = new StreamMessageReader(langServer.stdout)
        const writer = new StreamMessageWriter(langServer.stdin)

        console.log(`#${id}: Language server started`)

        reader.listen((message) => {
          console.log(`#${id}: Message received`)
          console.log(message)

          fetch(`http://${proxy.host}:${proxy.port}/${id}/messages`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify(message)
          })
        })

        CONNECTIONS.push({ id: id, reader: reader, writer: writer })

        res.writeHead(200)
        res.end()

        break
      case 'disconnect':
        console.log(`#${id}: Disconnecting`)
        CONNECTIONS = CONNECTIONS.filter((connection) => { return connection.id !== id })
        console.log('Current connections:', CONNECTIONS)

        res.writeHead(200)
        res.end()

        break
      case 'messages':
        const message = JSON.parse(body)
        const connection = CONNECTIONS.find((connection) => {
          return connection.id === id
        })

        if (connection) {
          console.log(`#${id}: Writing to language server`)
          console.log(message)
          connection.writer.write(message)
        }

        res.writeHead(200)
        res.end()

        break
    }
  })
})

server.listen(port, () => {
  console.log(`Listening to ${port}`)
})
