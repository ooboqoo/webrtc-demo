/**
 * 要与其他端互动，需要其他端配置参数 https://docs.agora.io/en/Interactive%20Broadcast/interop_web
 */

;(function (AgoraRTC) {
  const APP_ID = 'fda5f9b5149547e8a1c921ed699a8b81'
  const CHANNEL = '1000'  // 频道
  const TOKEN = null      // 如安全要求高，传入从你的服务端获得的 Token 或 Channel Key
  const DEBUG = true

  let client, localStream

  getDevices()
  window.addEventListener('message', function ({data}) {
    if (data === null || data === undefined) { return }
    console.log('iframe [IPC]', data)
    if (data.operation && ['join', 'leave'].includes(data.operation)) {
      eval(data.operation)(data)
    }
  })

  function join (data) {
    client = AgoraRTC.createClient({mode: 'live', codec: "h264"})
    client.init(APP_ID, function () {
      log('Info', 'client initialized')
      // 加入频道
      client.join(TOKEN, CHANNEL, null, function (uid) {
        log('Info', '用户 ' + uid + ' 加入频道')

        // 创建音视频流
        localStream = AgoraRTC.createStream({
          streamID: uid,
          audio: true,  // 音频
          video: true,  // 视频
          screen: false // 屏幕共享
        })

        if (data.video) {
          localStream.setVideoProfile('720p_3')
        }

        // 用户授权使用摄像头和麦克风
        localStream.on('accessAllowed', function() { })
        // 用户拒绝授权使用摄像头和麦克风(Electron 下不会询问)
        localStream.on('accessDenied', function () {
          alert('课堂中需要使用您的摄像头和麦克风，请重启客户端，并授权！')
        })

        localStream.init(function () {
          log('Info', 'getUserMedia successfully')
          localStream.play('video_local')
          client.publish(localStream, function (err) {
            log('Error', 'Publish local stream error: ', err)
          })
          client.on('stream-published', function (evt) {
            log('Info', 'Publish local stream successfully')
          })
        }, function (err) {
          log('Error', 'getUserMedia failed', err)
        })
      }, function (err) {
        log('Error', 'Join channel failed', err)
      })
    }, function (err) {
      log('Error', "client init failed", err)
    })

    client.on('error', function (err) {
      log('Error', 'Got error msg:', err.reason)
    })

    client.on('stream-added', function (evt) {
      console.log('New stream added: ' + evt.stream.getId())
      client.subscribe(evt.stream, function (err) {
        console.log('Subscribe stream failed', err)
      })
    })

    client.on('stream-subscribed', function (evt) {
      evt.stream.play('video_remote')
    })

    client.on('stream-removed', function (evt) {
      evt.stream.stop()
    })

    client.on('peer-leave', function (evt) {
      if (evt.stream) {
        evt.stream.stop()
      }
    })
  }

  function leave () {
    client.leave(function () {
      log('Info', 'Leavel channel successfully')
      localStream.stop()
    }, function (err) {
      log('Error', 'Leave channel failed')
    })
  }

  function getDevices () {
    AgoraRTC.getDevices(function (devices) {
      console.log(devices)
      window.parent.postMessage({
        devices: devices.map(({kind, deviceId, label}) => ({kind, deviceId, label}))
      }, '*')
    })
  }

  function log (level, text, ...args) {
    if (DEBUG) {
      console.log('[AgoraRTC]', '[' + level + ']', text, ...args)
    }
  }
})(window.AgoraRTC);
