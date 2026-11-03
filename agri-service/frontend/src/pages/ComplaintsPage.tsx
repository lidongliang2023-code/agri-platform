import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileTextOutlined, MessageOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Complaint, ServiceMessage } from '../types'
import { EmptyState, LoadingBlock, PageTitle } from '../components/ui'

const STATUS_TEXT: Record<string, string> = {
  pending: '待受理',
  processing: '平台处理中',
  resolved: '已办结',
}

const STAGE_TEXT: Record<number, string> = {
  15: '已提交，等待受理',
  35: '受理与事实核验',
  55: '双方协调中',
  65: '调解方案拟定',
  100: '已办结',
}

export function ComplaintsPage(): JSX.Element {
  const { message } = App.useApp()
  const { navigate } = useApp()
  const [items, setItems] = useState<Complaint[]>([])
  const [messages, setMessages] = useState<ServiceMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((): void => {
    setLoading(true)
    Promise.all([serviceApi.complaints(), serviceApi.messages()])
      .then(([tickets, inbox]) => {
        setItems(tickets)
        setMessages(inbox)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const openCount = useMemo(() => items.filter((item) => item.status !== 'resolved').length, [items])

  /** 处理结论是通过站内信推给投诉方的，这里按工单号把真实回执找出来。 */
  const noticeFor = (complaintNo: string): ServiceMessage | undefined =>
    messages.find((item) => item.content.includes(complaintNo))

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AFTER-SALES SERVICE"
        title="售后与投诉"
        description="投诉由平台质量仲裁员受理，处理结论会同步写入消息中心；本页只展示属于当前主体的工单。"
        actions={<Button icon={<MessageOutlined />} onClick={() => navigate('messages')}>消息中心（{messages.filter((item) => !item.read).length} 未读）</Button>}
      />
      <section className="service-commitment">
        <div><FileTextOutlined /><span><b>{openCount}</b><small>未办结工单</small></span></div>
        <div><FileTextOutlined /><span><b>{items.length}</b><small>累计工单</small></span></div>
        <div><FileTextOutlined /><span><b>{items.filter((item) => item.status === 'resolved').length}</b><small>已办结</small></span></div>
      </section>
      <section className="surface-card detail-section">
        <div className="section-heading compact">
          <div><span className="section-kicker">MY TICKETS</span><h2>我的售后工单</h2></div>
          <span className="section-note">在订单详情发起售后</span>
        </div>
        {loading ? <LoadingBlock rows={2} /> : items.length === 0 ? (
          <EmptyState icon="💬" title="暂无售后工单" description="如订单出现质量、履约或结算问题，可在订单详情发起售后。" action={<Button onClick={() => navigate('orders')}>去我的订单</Button>} />
        ) : (
          <div className="complaint-list">
            {items.map((item) => {
              const notice = noticeFor(item.complaintNo)
              return (
                <article key={item.id}>
                  <div className="complaint-head">
                    <span>{item.category}</span>
                    <h3>{item.complaintNo}</h3>
                    <small>关联订单 {item.orderNo} · {item.createdAt}</small>
                    <em>{STATUS_TEXT[item.status] ?? item.status}</em>
                  </div>
                  <div className="complaint-progress"><i style={{ width: `${item.progress}%` }} /></div>
                  <p>{item.description}</p>
                  <div className="complaint-demand"><b>诉求</b><span>{item.demand || '未填写'}</span></div>
                  <div className="complaint-foot">
                    <span>
                      当前进度：{STAGE_TEXT[item.progress] ?? `${item.progress}%`}
                      {item.handler ? ` · 处理人 ${item.handler}` : ''}
                    </span>
                    {item.resolution && <b className="complaint-resolution">处理结论：{item.resolution}</b>}
                    {notice && <small>通知回执：{notice.title}（{notice.createdAt}）</small>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
