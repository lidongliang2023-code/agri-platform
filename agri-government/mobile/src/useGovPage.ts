import { onShow } from '@dcloudio/uni-app'
import { getGovToken, handleGovUnauthorized } from './auth'

/** 每次进入业务页校验本机登录态；角色和辖区仍由原接口判定。 */
export function useGovPage(): void {
  onShow(() => {
    if (!getGovToken()) handleGovUnauthorized()
  })
}
