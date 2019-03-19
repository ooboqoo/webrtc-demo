import md5 from './md5.js'

const appSign = '0xcb,0x32,0xc7,0xbf,0x4c,0x76,0xe8,0x5e,0xc9,0x92,0x23,0xc7,0xc6,0x3b,0xf5,0x0c,0x03,0xfa,0xbb,0x2b,0xa9,0x7b,0x1c,0x19,0xc9,0xae,0x10,0xe6,0x15,0x30,0x62,0xe1'
const appSign32 = appSign.replace(/0x|,/g, '').substring(0, 32)

export function createToken (appId, idName, expired=3600) {
  expired = (Date.now() / 1000 | 0) + expired
  const nonce = uuidv4().replace(/-/g, '')
  const hash = md5(appId + appSign32 + idName + nonce + expired)
  const token = {ver: 1, hash, nonce, expired}
  return btoa(JSON.stringify(token))
}

function uuidv4 () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
