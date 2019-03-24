// https://github.com/mdn/samples-server/tree/master/s/webrtc-from-chat

const WEBSOCKET_PORT = '9090'
const HOST_NAME = window.location.hostname

// WebSocket chat/signaling channel variables.
let connection = null
let clientID = 0

const mediaConstraints = {audio: true, video: true}

let myUsername = null
let targetUsername = null
let myPeerConnection = null  // RTCPeerConnection

let hasAddTrack = false

function log (...args) {
  console.log(...args)
}

function logError (...args) {
  console.error(...args)
}

function sendToServer (msg) {
  connection.send(JSON.stringify(msg))
}

/**
 * 上报用户名
 *
 * 跟服务器建立连接后，服务器会下发 clientID，此时客户端需要上报 username
 */
function setUsername () {
  myUsername = document.getElementById('name').value
  sendToServer({
    type: 'username',
    id: clientID,
    name: myUsername,
    date: Date.now()
  })
}

function connect () {
  const scheme = document.location.protocol === 'https:' ? 'wss' : 'ws'
  const serverUrl = scheme + '://' + HOST_NAME + ':' + WEBSOCKET_PORT

  connection = new WebSocket(serverUrl)

  connection.onopen = function (evt) {
    document.getElementById('text').disabled = false
    document.getElementById('send').disabled = false
  }

  connection.onerror = logError

  connection.onmessage = function (evt) {
    const msg = JSON.parse(evt.data)
    var chatFrameDocument = document.getElementById('chatbox').contentDocument
    var text = ''
    log('Message received:', msg)
    var time = new Date(msg.date)
    var timeStr = time.toLocaleTimeString()

    switch (msg.type) {
      case 'id':
        clientID = msg.id
        setUsername()
        break
      case 'username':
        text = '<b>User <em>' + msg.name + '</em> signed in at ' + timeStr + '</b><br>'
        break
      case 'message':
        text = '(' + timeStr + ') <b>' + msg.name + '</b>: ' + msg.text + '<br>'
        break
      case 'rejectusername':
        myUsername = msg.name
        text = '<b>Your username has been set to <em>' + myUsername +
          '</em> because the name you chose is in use.</b><br>'
        break
      case 'userlist':      // Received an updated user list
        handleUserlistMsg(msg)
        break
        // Signaling messages: these messages are used to trade WebRTC
        // signaling information during negotiations leading up to a video call.

      case 'video-offer':  // Invitation and offer to chat
        handleVideoOfferMsg(msg)
        break
      case 'video-answer':  // Callee has answered our offer
        handleVideoAnswerMsg(msg)
        break
      case 'new-ice-candidate': // A new ICE candidate has been received
        handleNewICECandidateMsg(msg)
        break
      case 'hang-up': // The other peer has hung up the call
        handleHangUpMsg(msg)
        break
      default:
        logError('Unknown message received:')
        logError(msg)
    }

    // If there's text to insert into the chat buffer, do so now, then
    // scroll the chat panel so that the new text is visible.
    if (text.length) {
      chatFrameDocument.write(text)
      document.getElementById('chatbox').contentWindow.scrollByPages(1)
    }
  }
}

// Handles a click on the Send button (or pressing return/enter) by
// building a "message" object and sending it to the server.
function handleSendButton () {
  sendToServer({
    text: document.getElementById('text').value,
    type: 'message',
    id: clientID,
    date: Date.now()
  })
  document.getElementById('text').value = ''
}

// Handler for keyboard events. This is used to intercept the return and
// enter keys so that we can call send() to transmit the entered text to the server.
function handleKey (evt) {
  if (evt.keyCode === 13 || evt.keyCode === 14) {
    if (!document.getElementById('send').disabled) {
      handleSendButton()
    }
  }
}

// Create the RTCPeerConnection which knows how to talk to our
// selected STUN/TURN server and then uses getUserMedia() to find
// our camera and microphone and add that stream to the connection for
// use in our video call. Then we configure event handlers to get
// needed notifications on the call.
function createPeerConnection () {
  log('Setting up a connection...')
  // Create an RTCPeerConnection which knows to use our chosen STUN server.
  myPeerConnection = new RTCPeerConnection({
    iceServers: [{
      urls: 'turn:' + HOST_NAME,  // A TURN server
      username: 'webrtc',
      credential: 'turnserver'
    }]
  })

  // Do we have addTrack()? If not, we will use streams instead.
  hasAddTrack = (myPeerConnection.addTrack !== undefined)

  // Set up event handlers for the ICE negotiation process.
  myPeerConnection.onicecandidate = handleICECandidateEvent
  myPeerConnection.onremovestream = handleRemoveStreamEvent
  myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent
  myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent
  myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent

  // Because the deprecation of addStream() and the addstream event is recent,
  // we need to use those if addTrack() and track aren't available.
  if (hasAddTrack) {
    myPeerConnection.ontrack = handleTrackEvent
  } else {
    myPeerConnection.onaddstream = handleAddStreamEvent
  }
}

// Called by the WebRTC layer to let us know when it's time to
// begin (or restart) ICE negotiation. Starts by creating a WebRTC
// offer, then sets it as the description of our local media
// (which configures our local media stream), then sends the
// description to the callee as an offer. This is a proposed media
// format, codec, resolution, etc.
function handleNegotiationNeededEvent () {
  log('*** Negotiation needed')
  log('---> Creating offer')
  myPeerConnection.createOffer().then((offer) => {
    log('---> Creating new description object to send to remote peer')
    return myPeerConnection.setLocalDescription(offer)
  }).then(function () {
    log('---> Sending offer to remote peer')
    sendToServer({
      name: myUsername,
      target: targetUsername,
      type: 'video-offer',
      sdp: myPeerConnection.localDescription
    })
  }).catch(reportError)
}

// Called by the WebRTC layer when events occur on the media tracks
// on our WebRTC call. This includes when streams are added to and
// removed from the call.
//
// track events include the following fields:
//
// RTCRtpReceiver       receiver
// MediaStreamTrack     track
// MediaStream[]        streams
// RTCRtpTransceiver    transceiver
function handleTrackEvent (event) {
  log('*** Track event')
  document.getElementById('received_video').srcObject = event.streams[0]
  document.getElementById('hangup-button').disabled = false
}

// Called by the WebRTC layer when a stream starts arriving from the
// remote peer. We use this to update our user interface, in this example.
function handleAddStreamEvent (event) {
  log('*** Stream added')
  document.getElementById('received_video').srcObject = event.stream
  document.getElementById('hangup-button').disabled = false
}

// An event handler which is called when the remote end of the connection
// removes its stream. We consider this the same as hanging up the call.
// It could just as well be treated as a "mute".
//
// Note that currently, the spec is hazy on exactly when this and other
// "connection failure" scenarios should occur, so sometimes they simply
// don't happen.
function handleRemoveStreamEvent (event) {
  log('*** Stream removed')
  closeVideoCall()
}

// Handles |icecandidate| events by forwarding the specified
// ICE candidate (created by our local ICE agent) to the other
// peer through the signaling server.
function handleICECandidateEvent (event) {
  if (event.candidate) {
    log('Outgoing ICE candidate: ' + event.candidate.candidate)
    sendToServer({
      type: 'new-ice-candidate',
      target: targetUsername,
      candidate: event.candidate
    })
  }
}

// Handle |iceconnectionstatechange| events. This will detect
// when the ICE connection is closed, failed, or disconnected.
//
// This is called when the state of the ICE agent changes.
function handleICEConnectionStateChangeEvent (event) {
  log('*** ICE connection state changed to ' + myPeerConnection.iceConnectionState)
  switch (myPeerConnection.iceConnectionState) {
    case 'closed':
    case 'failed':
    case 'disconnected':
      closeVideoCall()
      break
  }
}

// Set up a |signalingstatechange| event handler. This will detect when
// the signaling connection is closed.
//
// NOTE: This will actually move to the new RTCPeerConnectionState enum
// returned in the property RTCPeerConnection.connectionState when
// browsers catch up with the latest version of the specification!
function handleSignalingStateChangeEvent (event) {
  log('*** WebRTC signaling state changed to: ' + myPeerConnection.signalingState)
  switch (myPeerConnection.signalingState) {
    case 'closed':
      closeVideoCall()
      break
  }
}

// Handle the |icegatheringstatechange| event. This lets us know what the
// ICE engine is currently working on: "new" means no networking has happened
// yet, "gathering" means the ICE engine is currently gathering candidates,
// and "complete" means gathering is complete. Note that the engine can
// alternate between "gathering" and "complete" repeatedly as needs and
// circumstances change.
//
// We don't need to do anything when this happens, but we log it to the
// console so you can see what's going on when playing with the sample.
function handleICEGatheringStateChangeEvent (event) {
  log('*** ICE gathering state changed to: ' + myPeerConnection.iceGatheringState)
}

// Given a message containing a list of usernames, this function
// populates the user list box with those names, making each item
// clickable to allow starting a video call.

function handleUserlistMsg (msg) {
  const listElem = document.getElementById('userlistbox')

  // Remove all current list members. We could do this smarter,
  // by adding and updating users instead of rebuilding from
  // scratch but this will do for this sample.
  while (listElem.firstChild) {
    listElem.removeChild(listElem.firstChild)
  }

  // Add member names from the received list
  for (let i = 0; i < msg.users.length; i++) {
    var item = document.createElement('li')
    item.appendChild(document.createTextNode(msg.users[i]))
    item.addEventListener('click', invite, false)
    listElem.appendChild(item)
  }
}

// Close the RTCPeerConnection and reset variables so that the user can
// make or receive another call if they wish. This is called both
// when the user hangs up, the other user hangs up, or if a connection
// failure is detected.
function closeVideoCall () {
  var remoteVideo = document.getElementById('received_video')
  var localVideo = document.getElementById('local_video')

  log('Closing the call')

  // Close the RTCPeerConnection
  if (myPeerConnection) {
    log('--> Closing the peer connection')

    // Disconnect all our event listeners; we don't want stray events
    // to interfere with the hangup while it's ongoing.
    myPeerConnection.onaddstream = null  // For older implementations
    myPeerConnection.ontrack = null      // For newer ones
    myPeerConnection.onremovestream = null
    myPeerConnection.onnicecandidate = null
    myPeerConnection.oniceconnectionstatechange = null
    myPeerConnection.onsignalingstatechange = null
    myPeerConnection.onicegatheringstatechange = null
    myPeerConnection.onnotificationneeded = null

    // Stop the videos
    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop())
    }
    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach(track => track.stop())
    }
    remoteVideo.src = null
    localVideo.src = null

    // Close the peer connection
    myPeerConnection.close()
    myPeerConnection = null
  }

  // Disable the hangup button
  document.getElementById('hangup-button').disabled = true

  targetUsername = null
}

function handleHangUpMsg (msg) {
  log('*** Received hang up notification from other peer')
  closeVideoCall()
}

function hangUpCall () {
  closeVideoCall()
  sendToServer({
    type: 'hang-up',
    name: myUsername,
    target: targetUsername
  })
}

// Handle a click on an item in the user list by inviting the clicked
// user to video chat. Note that we don't actually send a message to
// the callee here -- calling RTCPeerConnection.addStream() issues
// a |notificationneeded| event, so we'll let our handler for that
// make the offer.
function invite (evt) {
  log('Starting to prepare an invitation')
  if (myPeerConnection) {
    alert("You can't start a call because you already have one open!")
  } else {
    var clickedUsername = evt.target.textContent

    // Don't allow users to call themselves, because weird.
    if (clickedUsername === myUsername) {
      alert("I'm afraid I can't let you talk to yourself. That would be weird.")
      return
    }

    // Record the username being called for future reference
    targetUsername = clickedUsername
    log('Inviting user ' + targetUsername)

    // Call createPeerConnection() to create the RTCPeerConnection.
    log('Setting up connection to invite user: ' + targetUsername)
    createPeerConnection()

    // Now configure and create the local stream, attach it to the
    // "preview" box (id "local_video"), and add it to the RTCPeerConnection.
    log('Requesting webcam access...')

    navigator.mediaDevices.getUserMedia(mediaConstraints).then(localStream => {
      log('-- Local video stream obtained')
      document.getElementById('local_video').srcObject = localStream

      if (hasAddTrack) {
        log('-- Adding tracks to the RTCPeerConnection')
        localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream))
      } else {
        log('-- Adding stream to the RTCPeerConnection')
        myPeerConnection.addStream(localStream)
      }
    }).catch(handleGetUserMediaError)
  }
}

// Accept an offer to video chat. We configure our local settings,
// create our RTCPeerConnection, get and attach our local camera
// stream, then create and send an answer to the caller.
function handleVideoOfferMsg (msg) {
  var localStream = null

  targetUsername = msg.name

  // Call createPeerConnection() to create the RTCPeerConnection.

  log('Starting to accept invitation from ' + targetUsername)
  createPeerConnection()

  // We need to set the remote description to the received SDP offer
  // so that our local WebRTC layer knows how to talk to the caller.

  var desc = new RTCSessionDescription(msg.sdp)

  myPeerConnection.setRemoteDescription(desc).then(() => {
    log('Setting up the local media stream...')
    return navigator.mediaDevices.getUserMedia(mediaConstraints)
  }).then(function (stream) {
    log('-- Local video stream obtained')
    localStream = stream
    document.getElementById('local_video').srcObject = localStream
    if (hasAddTrack) {
      log('-- Adding tracks to the RTCPeerConnection')
      localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream))
    } else {
      log('-- Adding stream to the RTCPeerConnection')
      myPeerConnection.addStream(localStream)
    }
  }).then(function () {
    log('------> Creating answer')
    // Now that we've successfully set the remote description, we need to
    // start our stream up locally then create an SDP answer. This SDP
    // data describes the local end of our call, including the codec
    // information, options agreed upon, and so forth.
    return myPeerConnection.createAnswer()
  }).then(function (answer) {
    log('------> Setting local description after creating answer')
    // We now have our answer, so establish that as the local description.
    // This actually configures our end of the call to match the settings
    // specified in the SDP.
    return myPeerConnection.setLocalDescription(answer)
  }).then(() => {
    // We've configured our end of the call now. Time to send our answer back to the caller
    // so they know that we want to talk and how to talk to us.
    sendToServer({
      name: myUsername,
      target: targetUsername,
      type: 'video-answer',
      sdp: myPeerConnection.localDescription
    })
    log('Sending answer packet back to other peer')
  }).catch(handleGetUserMediaError)
}

// Responds to the "video-answer" message sent to the caller
// once the callee has decided to accept our request to talk.
function handleVideoAnswerMsg (msg) {
  log('Call recipient has accepted our call')
  // Configure the remote description, which is the SDP payload in our "video-answer" message.
  const desc = new RTCSessionDescription(msg.sdp)
  myPeerConnection.setRemoteDescription(desc).catch(reportError)
}

function handleNewICECandidateMsg (msg) {
  const candidate = new RTCIceCandidate(msg.candidate)
  myPeerConnection.addIceCandidate(candidate).catch(reportError)
  log('Adding received ICE candidate: ' + JSON.stringify(candidate))
}

function handleGetUserMediaError (err) {
  switch (err.name) {
    case 'NotFoundError':
      alert('缺少摄像头或麦克风')
      break
    case 'SecurityError':
    case 'PermissionDeniedError':
      // Do nothing; this is the same as the user canceling the call.
      break
    default:
      alert('无法开启摄像头或麦克风:' + err.message)
      break
  }
  closeVideoCall()
}

// Handles reporting errors. Currently, we just dump stuff to console but
// in a real-world application, an appropriate (and user-friendly)
// error message should be displayed.
function reportError (errMessage) {
  logError('Error ' + errMessage.name + ': ' + errMessage.message)
}
