/**
 * uni-app 内嵌模式下的本地存储隔离（必须是入口文件的第一个 import）。
 *
 * uni-app H5 与内嵌的生产业务页同源，两边共用同一个 localStorage，而且键名相同
 * （agri_token、agri_current_farm 等）。不隔离时，业务页启动会清掉客户端的登录凭证、
 * 用另一种格式改写当前农场 —— 用户点返回后客户端判定未登录，被送回登录页。
 *
 * 只在内嵌模式下生效：把本窗口对 localStorage 的读写统一加上 agri_ws: 前缀。
 * 补丁装在 iframe 自己的 Storage.prototype 上，不影响外层 uni-app；PC 端不进入此分支。
 * sessionStorage 不改：uni-app 不用它，且内嵌标志本身存放在那里。
 */
import { mobileWorkspace } from './mobile-workspace'

const PREFIX = 'agri_ws:'

function isolateEmbeddedStorage(): void {
  let local: Storage
  try {
    local = window.localStorage
  } catch {
    return // 隐私模式等存储不可用的环境，业务代码自身已做降级
  }
  const proto = Storage.prototype
  const { getItem, setItem, removeItem, clear } = proto
  const scoped = (storage: Storage, key: string): string => (storage === local ? PREFIX + key : key)
  proto.getItem = function (this: Storage, key: string) { return getItem.call(this, scoped(this, String(key))) }
  proto.setItem = function (this: Storage, key: string, value: string) { setItem.call(this, scoped(this, String(key)), value) }
  proto.removeItem = function (this: Storage, key: string) { removeItem.call(this, scoped(this, String(key))) }
  // clear 只清本业务页自己的键，不能连带清掉客户端的登录信息
  proto.clear = function (this: Storage) {
    if (this !== local) { clear.call(this); return }
    const own: string[] = []
    for (let i = 0; i < local.length; i += 1) {
      const key = local.key(i)
      if (key && key.startsWith(PREFIX)) own.push(key)
    }
    own.forEach(key => removeItem.call(local, key))
  }
}

if (mobileWorkspace()) isolateEmbeddedStorage()
