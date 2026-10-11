/**
 * 应用根组件
 *
 * 负责挂载 antd 全局配置（中文本地化 + 主题 Token）与路由。
 */
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import router from '@/router'
import { antdTheme } from '@agri/shared'
import { bootstrapAuthRefresh, installAuthRefreshInterceptor } from '@/api/auth'
import '@agri/shared/styles/global.less'

/**
 * 令牌续期：请求拦截器在访问令牌临近过期时用刷新令牌静默换新；
 * 刷新页面后若令牌已过期但刷新令牌仍在，启动时先换一组再渲染业务请求。
 */
installAuthRefreshInterceptor()
void bootstrapAuthRefresh()

/**
 * 应用根组件
 * @returns 应用根节点
 */
export default function App(): JSX.Element {
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  )
}
