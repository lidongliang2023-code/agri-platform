/**
 * 应用根组件
 *
 * 负责挂载 antd 全局配置（中文本地化 + 主题 Token）与路由。
 */
import { App as AntdApp, ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import router from '@/router'
import { bootstrapAuthRefresh, installAuthRefreshInterceptor } from '@/api/auth'
import useAuthStore from '@/store/auth'
import { productionTheme } from '@/styles/productionTheme'
import '@agri/shared/styles/global.less'
import '@/styles/production-member-theme.css'

/**
 * 令牌续期装配：请求拦截器在访问令牌临近过期时用 HttpOnly Cookie 里的刷新令牌静默换新；
 * 启动时先做一次续签（访问令牌只在内存，刷新页面后必须换回来）。
 */
installAuthRefreshInterceptor()
void bootstrapAuthRefresh()

/**
 * 应用根组件
 *
 * <p>渲染压在 `authReady` 之后。访问令牌只存内存，刷新页面后要用 HttpOnly Cookie 换回来；
 * 换回来之前 `token` 必为 null，此时若就渲染路由，已登录用户会被守卫误判成未登录而
 * 弹回登录页（表现为"一刷新就掉登录"）。</p>
 *
 * @returns 应用根节点
 */
export default function App(): JSX.Element {
  const authReady = useAuthStore((state) => state.authReady)
  return (
    <ConfigProvider locale={zhCN} theme={productionTheme}>
      <AntdApp>
        {authReady ? (
          <RouterProvider router={router} />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
            }}
          >
            <Spin size="large" />
          </div>
        )}
      </AntdApp>
    </ConfigProvider>
  )
}
