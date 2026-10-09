/**
 * 404 页面
 */
import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

/**
 * 未匹配路由时展示的 404 页面
 * @returns 结果页组件
 */
export default function NotFound(): JSX.Element {
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在或已被移除。"
      extra={
        <Button type="primary" onClick={() => navigate('/production/dashboard')}>
          返回首页
        </Button>
      }
    />
  )
}
