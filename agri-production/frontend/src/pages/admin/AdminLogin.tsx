/** 运营端只通过统一认证中心登录；旧地址继续兼容。 */
import SsoHandoff from '@/pages/sso/SsoHandoff'
import { SSO_CLIENT_ID } from '@/api/sso'
export default function AdminLogin(): JSX.Element {
  return <SsoHandoff clientId={SSO_CLIENT_ID} />
}
