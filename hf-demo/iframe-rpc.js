/**
 * iframe RPC 类
 * 对 message 机制进行了封装，可在 宿主页面 和 iframe 页面里 使用以实现两者之间的通讯和互相调用方法
 */
export class IframeRpc {
  /** @param {IframeChannel} [channel] */
  constructor (channel) {
    this._channels = {}
    this._callbacks = {}
    this._actions = {}

    this._callbackId = 0
    this.CALLBACK_ACTION =  '__CALLBACK__'

    if (channel) {
      this.addChannel(channel)
    }
  }

  /**
   * 添加一个信道
   * @param {IframeChannel} channel 单信道对象
   */
  addChannel (channel) {
    this._actions[channel.name] = {}
    this._channels[channel.name] = channel
  }

  getChannelByName (channelName) {
    return this._channels[channelName]
  }

  /**
   * 给某个信道 Channel 添加监听函数 Action
   * @param {string}   channelName 信道名称
   * @param {string}   actionName  动作名称
   * @param {Function} listener    监听函数 `(data, callback) => { }` // 原先为 `(callback, data) => { }`
   */
  setAction (channelName, actionName, listener) {
    if (!this._actions[channelName]) {
      return console.error(`信道${channelName}不存在, 无法设置监听函数${actionName}`)
    }
    if (listener) {
      this._actions[channelName][actionName] = listener
    } else {
      delete this._actions[channelName][actionName]
    }
  }

  /** 设置某个信道的监听器 */
  setActions (channelName, actions) {
    if (!this._actions[channelName]) {
      return console.error(`信道${channelName}不存在, 无法注册监听函数`)
    }
    Object.assign(this._actions[channelName], actions)
  }

  listen (win) {
    if (win !== window) {
      win.addEventListener('message', e => this._recv(e))
    }
  }

  /**
   * 发送数据(即任务指令)
   * @param {string}  channelName 信道名称
   * @param {string}  actionName  动作名称
   * @param {Object}  data        数据体
   * @param {Function|number}  callback  回调函数 或 回调ID
   * @param {boolean} keepListen  是否一直监听
   */
  call (channelName, actionName, data, callback, keepListen=false) {
    const channel = this.getChannelByName(channelName)
    if (!channel) {
      console.error('没有注册该信道:' + channelName + ':' + actionName, 'ERR_IRPC_NO_CHANNEL')
    }
    if (!channel.target) {
      console.error('没有Window无法发送:' + channelName + ':' + actionName, 'ERR_IRPC_NO_WINDOW')
    }
    const json = {
      channel: channelName,
      action: actionName,
      data
    }
    if (callback) {
      if (typeof callback === 'function') {
        this._callbacks[++this._callbackId] = {callback, keepListen}
        json.callback = this._callbackId
      } else {
        json.callback = callback
      }
    }
    channel.send(json)
  }

  /**
   * RPC 消息体格式
   * ```js
   * {
    *   channel: channelName,
    *   action: actionName,
    *   data: params,
    *   callback: callbackId
    * }
    * ```
    */
  _recv (e) {
    if (typeof e.data !== 'object') return
    const {channel: channelName, action: actionName, callback: callbackId, data: params} = e.data
    if (actionName === this.CALLBACK_ACTION) { // 回调
      const cdata = this._callbacks[callbackId]
      const rdata = params || {}
      if (cdata) {
        if (!cdata.keepListen) { // 持久监听
          delete this._callbacks[callbackId]
        }
        cdata.callback(rdata.error, rdata.data)
      }
    } else if (channelName && actionName) { // 调用
      const channel = this.getChannelByName(channelName)
      const action = channel && channel.actions[actionName]
      if (action) {
        action(params, (err, val) => {
          if (callbackId) {
            this.call(channelName, this.CALLBACK_ACTION, {error: err, data: val}, callbackId)
          }
        })
      } else {
        console.error('没有注册该方法:' + channelName +  ':' + actionName, 'ERR_IRPC_NO_ACTION');
      }
    }
  }
}

/**
 * 信道对象
 */
export class IframeChannel {
  /**
   * @param {Object} opts  配置信息
   * @param {string} opts.name      信道名称
   * @param {Window} [opts.target]  消息接收方
   * @param {string} [opts.origin]  允许的域名源
   * @param {IframeRpc} [rpc]       rpc 对象
   */
  constructor (opts, rpc) {
    this.name = opts.name
    this.origin = opts.origin
    this.target = opts.target
    this.rpc = rpc = rpc || new IframeRpc()
    rpc.addChannel(this)
    window.addEventListener('message', e => {
      debug('RECV', e.data)
      rpc._recv(e)
    });
  }

  send (data) {
    debug('SEND', data)
    this.target.postMessage(data, this.origin)
  }

  call (action, params, callback) {
    this.rpc.call(this.name, action, params, callback)
  }

  on (actionName, listener) {
    this.rpc.setAction(this.name, actionName, listener)
  }

  /** @param {HTMLFrameElement} frame */
  setFrame (frame) { this.target = frame.contentWindow }
  setTarget (window) { this.target = window }
  setOrigin (origin) { this.origin = origin }
}

function debug (...args) {
  console.log('[IFRAME RPC]', ...args)
}
