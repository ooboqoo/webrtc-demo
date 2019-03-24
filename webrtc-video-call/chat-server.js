// #!/usr/bin/env node

// https://github.com/mdn/samples-server/tree/master/s/webrtc-from-chat

//
// WebSocket chat server
// Implemented using Node.js
//
// Requires the websocket module.
//
// WebSocket and WebRTC based multi-user chat sample with two-way video
// calling, including use of TURN if applicable or necessary.
//
// This file contains the JavaScript code that implements the server-side
// functionality of the chat system, including user ID management, message
// reflection, and routing of private messages, including support for
// sending through unknown JSON objects to support custom apps and signaling
// for WebRTC.

// const http = require('http')
const https = require('https')
const fs = require('fs')
const { Server: WebSocketServer } = require('ws')

const PORT = 9090

const connectionList = []
let nextID = Date.now()
let appendToMakeUnique = 1

function log (...args) {
  console.log(...args)
}

function isUsernameUnique (name) {
  return !connectionList.find(conn => conn.username === name)
}

function sendToOneUser (target, msgString) {
  const conn = getConnectionByUsername(target)
  return conn ? conn.send(msgString) : false
}

function getConnectionByUsername (username) {
  return connectionList.find(conn => conn.username === username)
}

function getConnectionByID (id) {
  return connectionList.find(conn => conn.clientID === id)
}

// Builds a message object of type "userlist" which contains the names of
// all connected users. Used to ramp up newly logged-in users and,
// inefficiently, to handle name change notifications.
function makeUserListMessage () {
  var userListMsg = {
    type: 'userlist',
    users: []
  }

  // Add the users to the list
  for (var i = 0; i < connectionList.length; i++) {
    userListMsg.users.push(connectionList[i].username)
  }

  return userListMsg
}

// Sends a "userlist" message to all chat members. This is a cheesy way
// to ensure that every join/drop is reflected everywhere. It would be more
// efficient to send simple join/drop messages to each user, but this is
// good enough for this simple example.
function sendUserListToAll () {
  var userListMsg = makeUserListMessage()
  var userListMsgStr = JSON.stringify(userListMsg)

  for (let i = 0; i < connectionList.length; i++) {
    connectionList[i].send(userListMsgStr)
  }
}

const httpsOptions = {
  key: fs.readFileSync('/etc/pki/tls/private/mdn-samples.mozilla.org.key'),
  cert: fs.readFileSync('/etc/pki/tls/certs/mdn-samples.mozilla.org.crt')
}

const httpsServer = https.createServer(httpsOptions, (request, response) => {
  if (request.url) {
    response.writeHead(200)
  } else {
    response.writeHead(404)
  }
  response.end()
}).listen(PORT, () => {
  log(`Server is listening on port ${PORT}`)
})

const wsServer = new WebSocketServer({server: httpsServer})

wsServer.on('connection', (socket) => {
  log('Connection accepted from', socket)
  connectionList.push(socket)

  socket.clientID = nextID
  nextID++

  // 下发 ID, 然后后面 Client 会上报 username
  socket.send({type: 'id', id: socket.clientID})

  socket.on('message', function (message) {
    if (message.type === 'utf8') {
      log('Received Message: ' + message.utf8Data)

      // Process incoming data.

      var sendToClients = true
      const msg = JSON.parse(message.utf8Data)
      var connect = getConnectionByID(msg.id)

      // Take a look at the incoming object and act on it based
      // on its type. Unknown message types are passed through,
      // since they may be used to implement client-side features.
      // Messages with a "target" property are sent only to a user
      // by that name.

      switch (msg.type) {
        // Public, textual message
        case 'message':
          msg.name = connect.username
          msg.text = msg.text.replace(/(<([^>]+)>)/ig, '')
          break

        // Username change
        case 'username':
          var nameChanged = false
          var origName = msg.name

          // Ensure the name is unique by appending a number to it
          // if it's not; keep trying that until it works.
          while (!isUsernameUnique(msg.name)) {
            msg.name = origName + appendToMakeUnique
            appendToMakeUnique++
            nameChanged = true
          }

          // If the name had to be changed, we send a "rejectusername"
          // message back to the user so they know their name has been
          // altered by the server.
          if (nameChanged) {
            var changeMsg = {
              id: msg.id,
              type: 'rejectusername',
              name: msg.name
            }
            connect.send(changeMsg)
          }

          // Set this connection's final username and send out the
          // updated user list to all users. Yeah, we're sending a full
          // list instead of just updating. It's horribly inefficient
          // but this is a demo. Don't do this in a real app.
          connect.username = msg.name
          sendUserListToAll()
          sendToClients = false  // We already sent the proper responses
          break
      }

      // Convert the revised message back to JSON and send it out
      // to the specified client or all clients, as appropriate. We
      // pass through any messages not specifically handled
      // in the select block above. This allows the clients to
      // exchange signaling and other control objects unimpeded.

      if (sendToClients) {
        var msgString = JSON.stringify(msg)
        var i

        // If the message specifies a target username, only send the
        // message to them. Otherwise, send it to every user.
        if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
          sendToOneUser(msg.target, msgString)
        } else {
          for (i=0; i<connectionList.length; i++) {
            connectionList[i].send(msgString)
          }
        }
      }
    }
  })

  socket.on('close', function (reason, description) {
    // First, remove the connection from the list of connections.
    connectionList = connectionList.filter(function (el, idx, ar) {
      return el.connected
    })

    // Now send the updated user list. Again, please don't do this in a
    // real application. Your users won't like you very much.
    sendUserListToAll()

    // Build and output log output for close information.

    var logMessage = 'Connection closed: ' + socket.remoteAddress + ' (' +
                     reason
    if (description !== null && description.length !== 0) {
      logMessage += ': ' + description
    }
    logMessage += ')'
    log(logMessage)
  })
})
