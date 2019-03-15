import AgoraRTC from 'agora-rtc-sdk'

AgoraRTC.Logger.setLogLevel(4)  // 0 DEBUG | 1 INFO | 2 WARNING | 3 ERROR | 4 NONE

/**
 * 声网 WebRTC 接口兼容层
 */
export default class ArtcController {
  /**
   * @param {Object}   [opts]  初始化选项
   * @param {string}   [opts.key]             连接秘钥，即声网 SDK 中的 APP_ID
   * @param {string}   [opts.localElementId]  本地音视频容器ID
   * @param {string}   [opts.remoteElementId] 远端音视频容器ID
   * @param {Function} [opts.onRecvStream]    新加入流回调 (有人加入并发送流请求时触发)
   */
  constructor (opts={}) {
    this._opts = opts
    this._mute = false     // 是否静音

    this._userId = null    // 传入的用户ID
    this._userType = null  // 0 学生 1老师 4家长 5销售

    this._client = null       //
    this._stream = null       // 本地流, 即 Agora Demo 中的 localStream
    this._streamHandlers = {} // 远端流, 存储远端的流引用 {[streamId]: stream}
    this._devices = null      // 设备列表
    this._uid = undefined     // 加入房间(即声网的频道)后声网返回的用户ID
    this._roomId = undefined  // 房间ID, 即声网 SDK 中的频道 CHANNEL

    this._createClient()      // 创建客户端实例
  }

  _createClient () {
    const client = this._client = AgoraRTC.createClient({mode: 'live', codec: 'h264'})

    client.on('stream-added', evt => {
      const stream = evt.stream
      const streamId = stream.getId()
      const onRecvStream = this._opts.onRecvStream
      const next = (err) => {
        if (err) {
          debug('同意接收流', streamId)
          client.subscribe(stream, err => debug('订阅流失败'))
        } else {
          debug('拒绝接收流')
        }
      }
      debug('成功添加流', streamId)
      if (onRecvStream) {
        onRecvStream(next, stream)
      } else {
        next()
      }
    })

    client.on('stream-subscribed', evt => {
    })

    client.on('stream-removed', (evt) => {
    })

    client.on('peer-leave', evt => {
    })
  }

  /**
   * 初始化连接
   * @param {(err?: Error) => void} callback  初始化成功或失败后的回调
   */
  init (callback) {
    this._client.init(this._opts.key, () => {
      debug('初始化完成')
      callback()
    }, err => {
      callback(err)
    })
  }

  /**
   * 进入房间
   * @param {string} roomId    房间号
   * @param {string} userId    用户 id
   * @param {number} userType  用户类型
   * @param {Function} [callback]
   */
  enterRoom (roomId, userId, userType, callback) {
    this._client.join(null, roomId, +userId, uid => {  // uid = +userId
      this._roomId = roomId
      this._userId = userId
      this._userType = userType
      this._uid = uid
    }, err => {
      callback(err)
    })
  }

  /** 获取音视频设备列表 */
  enumDevices (callback) {
    AgoraRTC.getDevices(devices => {
      this._devices = devices || []
      if (callback) { callback(null, this._devices) }
    })
  }

  /** 开启设备(开启流) */
  openDevice (opts, callback) {
    // 创建音视频流
    this._stream = AgoraRTC.createStream({
      streamID: this._uid,
      audio: opts.audio,  // 音频
      video: opts.video,  // 视频
      screen: false // 屏幕共享
    })
    if (opts.video) {
      this._stream.setVideoProfile('480p_1')
    }
    this._stream.init(() => {
      if (this._opts.localElementId) {
        this._stream.play(this._opts.localElementId)
        callback()
      }
    }, err => {
      callback(err)
    })
  }

  /**
   * @param {(err?: Error) => void} callback  发布成功或失败后的回调
   */
  publish (callback) {
    this._client.on('stream-published', () => {
      debug('发布本地流成功')
      callback()
    })
    this._client.publish(this._stream, err => {
      debug.error('发布本地流失败')
      callback(err)
    })
  }

  unpublise (onFailure) {
    this._client.unpublish(this._stream, onFailure)
  }

  /** 关闭设备(关闭流) */
  closeDevice () {
    if (this._stream) {
      this._stream.close()
      this._stream = null
    }
  }

  /** 离开房间 */
  leaveRoom (callback) {
    this._client.leave(callback, callback)
  }

  // 以下都是处理静音的代码-------------------------------------------------

  isMuted () {
    return this._mute
  }

  mute () {
    this._mute = true
    this._applyMute()
  }

  unmute () {
    this._mute = false
    this._applyMute()
  }

  _applyMute () {
    for (let streamId in this._streamHandlers) {
      if (this._mute) {
        this._streamHandlers[streamId].disableAudio()
        debug('禁用本地声音流')
      } else {
        this._streamHandlers[streamId].enableAudio()
        debug('恢复本地声音流')
      }
    }
  }

  _apply () {
    this._applyMute()
  }
}

function debug (...args) {
  console.log('[ARTC]', ...args)
}

debug.error = function (...args) {
  console.error('[ARTC]', ...args)
}
