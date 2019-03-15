import { ZegoClient } from 'webrtc-zego'

/**
 * @typedef {import('../rtc-channel').Config} Config
 */

/**
 * 即构 WebRTC 接口兼容层
 */
export default class ZegoController {
  /**
   * @param {Object}   [opts]  初始化选项
   * @param {Config}   [opts.config]          连接用配置信息
   * @param {string}   [opts.localElementId]  本地音视频容器ID
   * @param {string}   [opts.remoteElementId] 远端音视频容器ID
   * @param {Function} [opts.onRecvStream]    新加入流回调 (有人加入并发送流请求时触发)
   */
  constructor (opts) {
    this._opts = opts
    this._config = opts.config
    this._mute = false     // 是否静音

    this._userId = null    // 传入的用户ID
    this._userType = null  // 0 学生 1老师 4家长 5销售

    this._client = new ZegoClient()
    this._stream = null       // 本地流, 即 Agora Demo 中的 localStream
    this._streamHandlers = {} // 远端流, 存储远端的流引用 {[streamId]: stream}
    this._devices = null      // 设备列表
    this._uid = undefined     // 加入房间(即声网的频道)后声网返回的用户ID
    this._roomId = undefined  // 房间ID, 即声网 SDK 中的频道 CHANNEL
  }

  /**
   * 初始化配置
   * @param {(err?: Error) => void} callback  初始化成功或失败后的回调
   */
  init (callback) {
    this._client.config({
      appid: 229059616,  // 必填，应用id，由即构分配
      idName: new Date().getTime() + '',  // 必填，用户自定义id，全局唯一
      nickName: 'u' + new Date().getTime(),  // 必填，用户自定义昵称
      server: 'wss://wsliveroom229059616-api.zego.im:8282/ws',
      logUrl: '',  // 必填，logServer 地址，由即构分配
      logLevel: 1,  // 日志级别 debug:0,info:1,warn:2,error:3,report:99,disable:100
      remoteLogLevel: 1,
      audienceCreateRoom: true
    })
  }

  /**
   * 登录房间
   * @param {string} roomId    房间号
   * @param {string} userId    用户 id
   * @param {number} userType  用户类型
   * @param {(err?) => void} callback  登录成功或失败后的回调
   */
  enterRoom (roomId, userId, userType, callback) {
    const onSucess = (streamList) => {
      this._stream = streamList[0]  // todo
      callback()
    }
    const onError = callback
    this._client.login(roomId, 1, this._config.zegoId, onSucess, onError)
  }

  /**
   * 获取音视频设备列表
   * @param {(err?, devices?) => void} [callback]  获取列表成功或失败后的回调
   */
  enumDevices (callback) {
    this._client.enumDevices(devices => {
      this._devices = devices || []
      if (callback) { callback(null, this._devices) }
    }, err => {
      debug.error('无法获取媒体设备信息')
      if (callback) { callback(err) }
    })
  }

  openDevice() {

  }

  /**
   * 推流
   * @param {(err?: Error) => void} callback  发布成功或失败后的回调
   */
  publish (callback) {
  }

  /**
   * 登出房间
   */
  leaveRoom () {
    this._client.logout()
  }

  /** 静音 */
  mute () {
    this._mute = true
  }

  /** 取消静音 */
  unmute () {
    this._mute = false
  }
}

function debug (...args) {
  console.log('[Zego]', ...args)
}

debug.error = function (...args) {
  console.error('[Zego]', ...args)
}

