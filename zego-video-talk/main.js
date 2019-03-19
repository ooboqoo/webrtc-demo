import { ZegoController } from './controller'
import { createToken } from './mock'

// 即构分配的账户信息
const APPID = 4004573812
const SERVER = 'wss://wsliveroom-test.zego.im:8282/ws'
const LOGURL = 'wss://wslogger-test.zego.im:8282/log'

const localVideoElementId = 'video_local'
const remoteVideoElementId = 'video_remote'

const roomId = '123456'
const userId = getParamByName('user_id') || '' + (Math.random() * 100000 | 0)
const role = /** @type {1|2} */(+getParamByName('role')) || 1

const controller = new ZegoController({
  appid: APPID,
  idName: userId,  // 用户ID
  nickName: 'u' + new Date().getTime(),  // 用户昵称
  server: SERVER,  // 服务器地址
  logUrl: LOGURL,   // 远程日志服务器 websocket 地址
  logLevel: 0,      // 日志级别  0:debug 1:info 2:warn 3:error 98:report 100:disable
  remoteLogLevel: 3,
  audienceCreateRoom: true  // 观众是否可以创建房间
})
// window.ctrl = controller

controller.setLocalVideoElement(localVideoElementId)
controller.setRemoteVideoElement(remoteVideoElementId)

getToken(APPID, userId, (err, token) => {
  if (err) {
    return debug.error('获取登录信息(TOKEN)失败', err)
  } else {
    debug(`获取登录信息(TOKEN)成功 ${token}`)
  }
  controller.enterRoom(roomId, role, token, err => {
    if (err) {
      return debug.error('登录房间失败', err)
    } else {
      debug('登录房间成功', roomId)
    }
    controller.playLocalVideo(localVideoElementId, err => {
      if (err) {
        return debug.error('打开设备失败', err)
      } else {
        debug(`打开设备成功`)
      }
      controller.publish()
    })
  })
})

/** 从后端获取登录信息(TOKEN) */
function getToken (appId, userId, callback) {
  const token = createToken(appId, userId, 3600)
  callback(null, token)
}

/** 获取 URL 中的参数信息 */
function getParamByName (key) {
  const search = location.search
  if (search.length < 2) { return null }
  const paramArr = search.substring(1).split('&')
  const paramMap = {}
  paramArr.forEach(item => {
    const entry = item.split('=')
    paramMap[entry[0]] = entry[1]
  })
  return paramMap[key]
}

function debug (...args) {
  console.log('[Zego]', ...args)
}
debug.error = function (...args) {
  console.error('[Zego]', ...args)
}
