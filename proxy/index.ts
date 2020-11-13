#!/usr/bin/env node

import ws from 'ws'
import net from 'net'
import * as rpcServer from 'vscode-ws-jsonrpc/lib/server'
import parseArgs from 'minimist'

const args = parseArgs(process.argv.slice(2))

const SERVERS = [
  { language: 'ruby', host: process.env.RUBY_LANGUAGE_SERVER_HOST, port: Number(process.env.RUBY_LANGUAGE_SERVER_PORT) },
  { language: 'javascript', host: process.env.JAVASCRIPT_LANGUAGE_SERVER_HOST, port: Number(process.env.JAVASCRIPT_LANGUAGE_SERVER_PORT) }
]

if (args.help) {
  console.log('Usage: server.js --port 3000')
  process.exit(1)
}

const serverPort = parseInt(args.port) || 3000

const wss = new ws.Server({
  port: serverPort,
  perMessageDeflate: false
}, () => {
  console.log("Listening on port " + serverPort);
})

wss.on('connection', (client, request) =>{
  const server = SERVERS.find((server) => { return request.url === '/' + server.language })

  if (!server) {
    console.error('Invalid language server', request.url);
    client.close();
    return;
  }

  const serverSocket = net.connect({ host: server.host, port: server.port })
  const serverConnection = rpcServer.createSocketConnection(serverSocket, serverSocket, () => { })
  const socketConnection = rpcServer.createWebSocketConnection({
    send: (content) => {
      client.send(content)
    },
    onMessage: (cb) => {
      client.onmessage = (event) => {
        cb(event.data)
      }
    },
    onError: (cb) => {
      client.onerror = (event) => {
        if (event.message) {
          cb(event.message)
        }
      }
    },
    onClose: (cb) => {
      client.onclose = (event) => {
        cb(event.code, event.reason)
      }
    },
    dispose: () => { return client.close() }
  })

  rpcServer.forward(socketConnection, serverConnection, (message) => {
    console.log(message)

    return message
  })

  socketConnection.onClose(() => {
    serverConnection.dispose()
  })
})

