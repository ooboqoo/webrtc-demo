/**
 * 此文件同时用于页面及其内嵌 iframe 中
 */

import { IframeChannel } from '../util/iframe-rpc'

const CHANNEL_NAME = 'artc'
const isIframe = window.parent !== window

const channel = new IframeChannel({name: CHANNEL_NAME, origin: '*'})

if (isIframe) {
  /**
   * 连接
   * @param  {string} type  服务商类型 artc|zego
   */
  // @ts-ignore
  channel.getRtcService = function (type, callback) {
    channel.call('config', type, function (err, config) {
      callback(err, config, function (error, data) {
        channel.call('startup', {error: serializeError(error), data})
      })
    })
  }

  /** 有用户加入(或有新的流,房间内至少有两个人了) */
  // @ts-ignore
  channel.userJoined = function () {
    channel.call('userJoined')
  }
} else {
  /** 静音 */
  // @ts-ignore
  channel.mute = function () {
    channel.call('mute', {mute: true})
  }

  /** 取消静音 */
  // @ts-ignore
  channel.unmute = function () {
    channel.call('mute', {mute: false})
  }
}

function serializeError(error) {
  return error ? {message: error.message, stack: error.stack, error: error.error} : ''
}

export default channel
