/**
 * 页面级加载中占位
 *
 * 用于路由懒加载（React.lazy）时的 Suspense fallback。
 */
import { Spin } from 'antd'

/**
 * 页面加载中
 * @returns 居中的 Spin 组件
 */
export default function PageLoading(): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
      <Spin size="large" tip="页面加载中">
        <div style={{ height: 80, width: '100%' }} />
      </Spin>
    </div>
  )
}
