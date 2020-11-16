#!/usr/bin/env node

import ws from 'ws'
import net from 'net'
import http from 'http'
import { WebSocketMessageReader, WebSocketMessageWriter, IWebSocket } from 'vscode-ws-jsonrpc'
import parseArgs from 'minimist'
import fetch from 'isomorphic-fetch'

type Connection = {
  id: string,
  reader: WebSocketMessageReader,
  writer: WebSocketMessageWriter
}

const args = parseArgs(process.argv.slice(2))

const SERVERS = [
  {
    language: 'ruby',
    host: process.env.RUBY_LANGUAGE_SERVER_HOST,
    port: Number(process.env.RUBY_LANGUAGE_SERVER_PORT)
  },
  {
    language: 'javascript',
    host: process.env.JAVASCRIPT_LANGUAGE_SERVER_HOST,
    port: Number(process.env.JAVASCRIPT_LANGUAGE_SERVER_PORT)
  },
]
let CONNECTIONS: Connection[] = []

if (args.help) {
  console.log('Usage: index.js --websocketPort 3000 --httpPort 4444')
  process.exit(1)
}

const websocketPort = parseInt(args.websocketPort) || 3000
const httpPort = parseInt(args.httpPort) || 4444

const websocketServer = new ws.Server({
  port: websocketPort,
  perMessageDeflate: false
}, () => {
  console.log(`WebSocket server listening on ${websocketPort}`)
})

websocketServer.on('connection', (client, request) => {
  if (!request.url) {
    client.close()
    return
  }

  const [_, language, id] = request.url.split('/')

  if (!language || !id) {
    console.error('Invalid URL format', request.url)
    client.close()
    return
  }

  const server = SERVERS.find((server) => { return server.language === language })

  if (!server) {
    console.error('Invalid language server', request.url)
    client.close()
    return
  }

  const socket: IWebSocket = {
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
    dispose: () => {
      console.log(`#${id}: Disconnecting`)
      fetch(`http://${server.host}:${server.port}/${id}/disconnect`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        }
      })
        .then(() => {
          CONNECTIONS = CONNECTIONS.filter((connection) => { return connection.id !== id })

          console.log('Current connections:', CONNECTIONS)
        })

      return client.close()
    }
  }

  const reader = new WebSocketMessageReader(socket)
  const writer = new WebSocketMessageWriter(socket)
  reader.onClose(() => { socket.dispose() })
  writer.onClose(() => { socket.dispose() })

  const connection = CONNECTIONS.find((connection) => {
    return connection.id === id
  })

  if (connection) {
    reader.listen((input) => {
      console.log(`#${id}: Message received`)

      fetch(`http://${server.host}:${server.port}/${id}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(input)
      })
    })

    return
  }

  console.log(`#${id}: WebSocket registered`)

  fetch(`http://${server.host}:${server.port}/${id}/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  })
    .then(() => {
      console.log(`#${id}: Connected to language server`)
      CONNECTIONS.push({ id: id, reader: reader, writer: writer })

      reader.listen((message) => {
        console.log(`#${id}: Message received`)
        console.log(message)

        fetch(`http://${server.host}:${server.port}/${id}/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(message)
        })
      })
    })
})

const httpServer: http.Server = http.createServer((req, res) => {
  if (!req.url) {
    return
  }

  const [_, id, action] = req.url.split('/')

  if (!id || action !== 'messages') {
    return
  }

  res.setHeader('Content-Type', 'application/json')

  let body = ''

  req.on('data', (data) => {
    body += data
  })

  req.on('end', () => {
    const message = JSON.parse(body)
    const connection = CONNECTIONS.find((connection) => {
      return connection.id === id
    })

    if (connection) {
      console.log(`#${id}: Writing to WS`)
      console.log(message)
      connection.writer.write(message)
    }

    res.writeHead(200)
    res.end()
  })
})

httpServer.listen(httpPort, () => {
  console.log(`HTTP server listening to ${httpPort}`)
})
