import { channelApi } from './index'

/**
 * 当前账号的渠道 ID。
 *
 * <p>渠道 ID 不再写死（原来三个页面都传 channelId: 1，等于所有人共用渠道 1）；
 * 从 /channel/profile 取一次并缓存，未入驻返回 null，由页面提示去入驻。</p>
 */
let pending = null

export function currentChannelId() {
  if (!pending) {
    pending = channelApi.getProfile()
      .then((res) => (res && res.applied ? res.id : null))
      .catch(() => null)
  }
  return pending
}

/** 入驻后重新读取（例如从入驻页返回工作台）。 */
export function resetChannelSession() {
  pending = null
}
