/**
 * API         https://doc.zego.im/CN/306.html
 * 功能实现流程 https://doc.zego.im/CN/400.html
 */

import { ZegoClient } from 'webrtc-zego'

export class ZegoController {
  /**
   * @param {Object}  config 初始化配置参数
   * @param {number}  config.appid    应用ID
   * @param {string}  config.server   服务器地址
   * @param {string}  config.idName   用户ID, 同时也是本地流ID
   * @param {string}  config.nickName 用户昵称
   * @param {boolean} config.audienceCreateRoom  观众是否可以创建房间
   * @param {string}  config.logUrl              日志服务器地址
   * @param {number}  config.logLevel            日志输出级别设置
   * @param {number}  config.remoteLogLevel      日志输出级别设置
   */
  constructor (config) {
    this._client = new ZegoClient()
    this._config = config
    this._localVideo = null
    // this._remoteVideo = null
    this._remoteVideoMap = {}

    this._client.config(config)
    this._client.setUserStateUpdate(true)
    this._client.onGetTotalUserList = this.onGetTotalUserList.bind(this)
    this._client.onStreamUpdated = this.onStreamUpdated.bind(this)
    this._client.onPublishStateUpdate = this.onPublishStateUpdate.bind(this)
    this._client.onPlayStateUpdate = this.onPlayStateUpdate.bind(this)
  }

  /**
   * 创建/登录房间
   * @param {string} roomId  房间号/频道号
   * @param {1|2}    role    用户角色  1:主播 2:观众
   * @param {string} token   从后端获取的 TOKEN
   */
  enterRoom (roomId, role, token, callback) {
    this._client.login(roomId, role, token, streamList => callback(null, streamList), err => callback(err))
  }

  /** 预览 */
  playLocalVideo (videoElementId, callback) {
    var previewConfig = {
      "audio": true,
      "audioInput": null,
      "video": true,
      "videoInput": null,
      "videoQuality": 2,
      "horizontal": true
    };
    this._localVideo = document.getElementById(videoElementId)
    this._client.startPreview(this._localVideo, previewConfig, callback, callback)
  }

  /** 推流 */
  publish () {
    this._client.startPublishingStream(this._config.idName, this._localVideo)
  }

  /** 直播状态回调 */
  onPublishStateUpdate (type, streamId, error) {
    if (type === 0) {
      debug('推流成功', streamId)
    } else if (type == 2) {
      debug('推流 retry', + streamId)
    } else {
      debug.error('推流失败', streamId, error)
    }
  }

  unpublish () {
    this._client.stopPublishingStream(this._config.idName)
  }

  onGetTotalUserList (roomId, userList) {
    debug('房间成员列表', userList)
  }

  /**
   * 流更新回调
   * @param {0|1} type        变更类型  0 添加 1 删除
   * @param {*[]}   streamList  变更流列表
   */
  onStreamUpdated (type, streamList) {
    const streamId = streamList[0].stream_id
    debug(['用户加入房间', '用户离开房间'][type], streamId, streamList)
    if (type === 0) {
      this.playRemoteVideo(streamId, 'video_remote')
    }
  }

  /** 拉流并播放 */
  playRemoteVideo (streamId, videoElementId) {
    debug(`play ${streamId}`)

    const remoteVideo = document.createElement('video')
    remoteVideo.setAttribute('autoplay', '')
    remoteVideo.setAttribute('webkit-playsinine', '')

    const videos = document.getElementById(videoElementId)
    videos.appendChild(remoteVideo)

    this._remoteVideoMap[streamId] = remoteVideo
    setTimeout(() => {
      this._client.startPlayingStream(streamId, remoteVideo)
    }, 1000);
  }

  /** 拉流状态回调 */
  onPlayStateUpdate (type, streamId, error) {
    if (type === 0) {
      debug('拉流成功', streamId)
    } else if (type == 2) {
      debug('拉流 retry', + streamId)
    } else {
      debug.error('拉流失败', streamId, error)
    }
  }

  /** 退出房间 */
  leaveRoom () {
    this._client.release()
  }
}

function debug (...args) {
  console.log('[Zego]', ...args)
}

debug.error = function (...args) {
  console.error('[Zego]', ...args)
}
