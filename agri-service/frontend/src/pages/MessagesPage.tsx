import { useEffect, useState } from 'react'
import { BellOutlined, CheckOutlined, MessageOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { serviceApi } from '../api'
import type { ServiceMessage } from '../types'
import { EmptyState, LoadingBlock, PageTitle } from '../components/ui'

const ICONS: Record<string, JSX.Element> = {
  order: <BellOutlined />,
  policy: <SafetyCertificateOutlined />,
  insurance: <SafetyCertificateOutlined />,
  course: <MessageOutlined />,
}

export function MessagesPage(): JSX.Element {
  const { message } = App.useApp()
  const [items, setItems] = useState<ServiceMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = (): void => {
    setLoading(true)
    serviceApi.messages().then(setItems).catch((reason: Error) => message.error(reason.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const markAll = async (): Promise<void> => {
    try {
      await serviceApi.readAllMessages()
      setItems((current) => current.map((item) => ({ ...item, read: true })))
      message.success('消息已全部标记为已读')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '操作失败')
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="NOTIFICATIONS"
        title="消息中心"
        description="同步订单履约、政策审核、查勘进度与学习提醒。"
        actions={<Button icon={<CheckOutlined />} onClick={() => void markAll()}>全部已读</Button>}
      />
      <section className="surface-card message-center">
        <div className="message-summary"><span><BellOutlined /></span><div><b>{items.filter((item) => !item.read).length} 条未读消息</b><small>重要服务节点会同步短信提醒</small></div></div>
        {loading ? <LoadingBlock rows={4} /> : items.length === 0 ? <EmptyState icon="📭" title="暂无消息" /> : (
          <div className="message-list">
            {items.map((item) => (
              <article key={item.id} className={item.read ? 'read' : 'unread'}>
                <span className={`message-icon tone-${item.type}`}>{ICONS[item.type] ?? <MessageOutlined />}</span>
                <div><h3>{item.title}{!item.read && <i />}</h3><p>{item.content}</p><small>{item.createdAt}</small></div>
                <Button type="text" onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))}>查看</Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
