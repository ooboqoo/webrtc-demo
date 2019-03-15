/**
 * 此文件同时用于页面及其内嵌 iframe 中
 */

import { IframeChannel } from './iframe-rpc'

const CHANNEL_NAME = 'webrtc'

/** 用于宿主页面的 Channel */
export class RtcChannelParent extends IframeChannel {
  constructor () {
    super({name: CHANNEL_NAME, origin: '*'})
  }

  /** 静音 */
  mute () {
    this.call('mute', {mute: true})
  }

  /** 取消静音 */
  unmute () {
    this.call('mute', {mute: false})
  }
}

/** 用于 iframe 中的 Channel */
export class RtcChannelChild extends IframeChannel {
  constructor () {
    super({name: CHANNEL_NAME, origin: '*'})
  }

  /**
   * 获取配置信息并建立连接
   * @param {string} type  服务商类型 artc|zego
   * @param {(err, config: Config, callback: function) => void} callback  回调
   */
  getRtcService (type, callback) {
    this.call('config', type, (err, config) => {
      callback(err, config, (error, data) => {
        this.call('startup', {error: serializeError(error), data})
      })
    })
  }

  /** 有用户加入(或有新的流,房间内至少有两个人了) */
  userJoined () {
    this.call('userJoined')
  }
}

/**
 * 服务端下发的音视频服务配置信息
 * @typedef {Object<string, any>} Config
 * @property {string} key  
 * @property {number} postfix  
 * @property {boolean} publish  
 * @property {string} roomId  房间ID/频道ID
 * @property {number} status  音视频设备状态 0 无 1 仅音频设备 2 有音视频设备
 * @property {string} type  
 * @property {string} userId    用户ID
 * @property {number} userType  用户类型  // 目前又没有传了
 * @property {sting[]} videoDevices  
 *
 * @property {string} [zegoId]   即构 ID
 * @property {string} [zegokey]  即构 KEY
 *
 * @example
 * {
 *   key: '03184c57582b4dd54e2187d85d714cd82b6ea6f544ded1b44a3449178a2f8721620d69b61552544140480fdb31',
 *   postfix: 1552342676,
 *   publish: true,
 *   roomId: '3615754_1552342676',
 *   status: 2,
 *   type: 'artc',
 *   userId: '26851',
 *   videoDevices: ['魔力秀']
 * }
 */

function serializeError(error) {
  return error ? {message: error.message, stack: error.stack, error: error.error} : ''
}
