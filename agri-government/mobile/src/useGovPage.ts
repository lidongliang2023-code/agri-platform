import { onReady, onShow } from '@dcloudio/uni-app'
import { getGovToken, handleGovUnauthorized } from './auth'

/** 每次进入业务页校验本机登录态；角色和辖区仍由原接口判定。 */
export function useGovPage(): void {
  const checkSession = () => {
    if (!getGovToken()) handleGovUnauthorized()
  }
  onShow(checkSession)
  // 首次直接打开业务页时，在页面栈和视图就绪后再兜底检查。
  onReady(checkSession)
}
