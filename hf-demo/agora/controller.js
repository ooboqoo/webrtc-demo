import AgoraRTC from 'agora-rtc-sdk'

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

  /** 开启设备(开启流) */
  openDevice (opts, fn) {

  }

  _openDevice (opts, fn) { }

  publish (fn) { }

  unpublise (fn) { }

  /** 关闭设备(关闭流) */
  closeDevice () {
    if (this._stream) {
      this._stream.close()
      this._stream = null
    }
  }

  /**
   * 进入房间
   * @param {string} roomId    房间号
   * @param {string} userId    用户 id
   * @param {number} userType  用户类型
   * @param {Function} [callback]
   */
  enterRoom (roomId, userId, userType, callback) {
    this._client.join(null, roomId, null, uid => {
      this._roomId = roomId
      this._userId = userId
      this._userType = userType
      this._uid = uid
    }, err => {
      callback(err)
    })
  }

  /** 离开房间 */
  leaveRoom (callback) {
    this._client.leave(callback, callback)
  }

  /** 初始化连接 */
  init (callback) {
    this._client.init(this._opts.key, () => {
      debug('初始化完成')
      callback()
    }, err => {
      callback(err)
    })
  }

  /** 获取音视频设备列表 */
  enumDevices (fn) {
    AgoraRTC.getDevices(devices => {
      this._devices = devices || []
      if (fn) { fn(null, this._devices) }
    })
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
