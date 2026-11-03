import { useEffect, useState } from 'react'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { App, Button, Input, Modal, Rate } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { ServiceOrder } from '../types'
import { EmptyState, LoadingBlock, MiniProgress, Money, PageTitle, StatusTag } from '../components/ui'

const TABS = [
  { key: 'all', label: '全部订单' },
  { key: 'pending_payment', label: '待付定金' },
  { key: 'confirmed', label: '待服务' },
  { key: 'in_progress', label: '服务中' },
  { key: 'completed', label: '待评价/已完成' },
  { key: 'cancelled', label: '已取消' },
]

export function OrdersPage(): JSX.Element {
  const { navigate, page } = useApp()
  const { message } = App.useApp()
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState<ServiceOrder | null>(null)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = (): void => {
    setLoading(true)
    serviceApi.orders({ status: status === 'all' ? undefined : status, keyword: keyword || undefined })
      .then(setOrders)
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [status, page])

  const submitReview = async (): Promise<void> => {
    if (!reviewTarget) return
    setSubmitting(true)
    try {
      await serviceApi.reviewOrder(reviewTarget.id, { rating, review })
      message.success('评价已提交，感谢您的真实反馈')
      setReviewTarget(null)
      setReview('')
      load()
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '评价提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="MY SERVICES"
        title="我的服务订单"
        description="从预约确认、现场作业到验收结算，每一步都有记录。"
        actions={<Button type="primary" onClick={() => navigate('demand')}>+ 发布服务需求</Button>}
      />

      <section className="surface-card order-filter">
        <div className="order-tabs">
          {TABS.map((tab) => (
            <button type="button" key={tab.key} className={status === tab.key ? 'on' : ''} onClick={() => setStatus(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="inline-search">
          <Input
            value={keyword}
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索订单号、服务或服务商"
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={load}
          />
          <Button onClick={load}>查询</Button>
        </div>
      </section>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📋"
          title="当前筛选下没有订单"
          description="您可以调整订单状态，或去服务超市寻找合适的服务。"
          action={<Button type="primary" onClick={() => navigate('services')}>去服务超市</Button>}
        />
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-card surface-card" key={order.id}>
              <header>
                <div>
                  <span className="order-category">{order.category}</span>
                  <b>{order.serviceName}</b>
                  <small>{order.orderNo} · {order.createdAt}</small>
                </div>
                <StatusTag status={order.status} />
              </header>
              <div className="order-card-body">
                <div className="order-provider">
                  <span>{order.providerName.slice(0, 1)}</span>
                  <div><b>{order.providerName}</b><small>平台认证服务商</small></div>
                </div>
                <div className="order-info-grid">
                  <span><CalendarOutlined /><small>预约</small><b>{order.appointmentDate} {order.appointmentSlot}</b></span>
                  <span><EnvironmentOutlined /><small>服务地点</small><b>{order.location}</b></span>
                  <span><ClockCircleOutlined /><small>服务进度</small><b>{order.progress}%</b></span>
                </div>
                <div className="order-amount"><small>订单金额</small><Money value={order.totalAmount} /></div>
              </div>
              {order.status === 'in_progress' && (
                <div className="order-progress-strip"><MiniProgress value={order.progress} /><span>服务商正在作业，预计今天 18:00 前完成</span></div>
              )}
              <footer>
                <span>{order.quantity} {order.unit} × ¥{order.unitPrice}</span>
                <div>
                  <Button onClick={() => navigate('order-detail', order.id)}>查看详情</Button>
                  {order.status === 'completed' && !order.rating && <Button type="primary" onClick={() => setReviewTarget(order)}>去评价</Button>}
                  {order.status === 'in_progress' && <Button type="primary" onClick={() => navigate('order-detail', order.id)}>查看进度</Button>}
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}

      <Modal title="服务评价" open={Boolean(reviewTarget)} onCancel={() => setReviewTarget(null)} onOk={() => void submitReview()} confirmLoading={submitting} okText="提交评价">
        {reviewTarget && (
          <div className="review-form">
            <div className="review-order-summary">
              <span>{reviewTarget.serviceName}</span><small>{reviewTarget.providerName} · {reviewTarget.orderNo}</small>
            </div>
            <label>服务评分</label>
            <Rate value={rating} onChange={setRating} />
            <label>服务体验</label>
            <Input.TextArea value={review} onChange={(event) => setReview(event.target.value)} rows={4} placeholder="说说作业质量、服务时效与价格透明情况…" />
            <div className="booking-form-tip">评价将进行真实性校验，并可公开展示给其他用户。</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
