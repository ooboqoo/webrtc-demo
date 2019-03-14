import ArtcController from './controller'
import rtcChannel from '../channel'

// @ts-ignore
rtcChannel.getRtcService('artc', function (err, config, callback) {
  const controller = new ArtcController({
    localElementId: 'artc_local',
    remoteElementId: 'artc_view',
    key: config.key,
    onRecvStream: function (next) {
      // @ts-ignore
      rtcChannel.userJoined()
      next()
    }
  })

  // @ts-ignore
  rtcChannel.on('mute', function (cb, data) {
    if (data.mute) {
      controller.mute()
    } else {
      controller.unmute()
    }
  })

  controller.init(err => {
    if (err) { return debug('初始化失败') }
    controller.enterRoom(config.roomId, config.userId, config.userType, err => {
      if (err) { return debug('加入频道失败') }
      if (config.status !== 0) {
        controller.openDevice({audio: true, video: config.status === 2}, err => {
          if (err) { return debug('开启摄像头失败') }
          if (config.userType !== 5 && config.publish) {
            controller.publish(err => {
              if (err) { return debug('发布本地流失败') }
              callback()
            })
          }
        })
      }
    })
  })

  function debug (...args) {
    console.error('[ARTC]', ...args)
  }
})
