import ArtcController from './controller'
import rtcChannel from './channel'

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

  controller.init()
  controller.enterRoom(config.roomId, config.userId, config.userType)
  if (config.status !== 0) {
    controller.openDevice({audio: true, video: config.status === 2})
    if (config.userType !== 5 && config.publish) {
      controller.publish()
    }
  }
  callback()
})
