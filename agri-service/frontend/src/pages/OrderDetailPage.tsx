import { useEffect, useState } from 'react'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { App, Button, Input, Modal, Rate } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { ServiceOrder } from '../types'
import { EmptyState, LoadingBlock, MiniProgress, Money, StatusTag } from '../components/ui'

export function OrderDetailPage(): JSX.Element {
  const { id, navigate } = useApp()
  const { message } = App.useApp()
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [complaint, setComplaint] = useState('')

  const load = (): void => {
    if (!id) return
    serviceApi.order(id).then(setOrder).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [id])

  if (!id) return <EmptyState title="缺少订单编号" action={<Button onClick={() => navigate('orders')}>返回订单</Button>} />
  if (!order && !error) return <LoadingBlock rows={5} />
  if (!order) return <EmptyState icon="📡" title="订单加载失败" description={error} action={<Button onClick={() => navigate('orders')}>返回订单</Button>} />

  /** 进度说明只读服务商真实上报的那条事件，不写死机损率/轨迹覆盖这类监测数字。 */
  const latestReport = [...(order.timeline ?? [])].reverse()
    .find((event) => event.title === '服务商上报进度')

  const updateStatus = async (status: string): Promise<void> => {
    setBusy(true)
    try {
      const updated = await serviceApi.updateOrder(order.id, { status })
      setOrder(updated)
      const done: Record<string, string> = {
        confirmed: '定金已支付，档期锁定，等待服务商到场',
        completed: '已确认验收，尾款按结算批次释放',
        cancelled: '订单已取消',
      }
      message.success(done[status] ?? '订单状态已更新')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const submitReview = async (): Promise<void> => {
    setBusy(true)
    try {
      const updated = await serviceApi.reviewOrder(order.id, { rating, review })
      setOrder(updated)
      setReviewOpen(false)
      message.success('评价已提交')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '评价提交失败')
    } finally {
      setBusy(false)
    }
  }

  const submitComplaint = async (): Promise<void> => {
    setBusy(true)
    try {
      await serviceApi.createComplaint({
        orderNo: order.orderNo,
        category: '服务履约',
        description: complaint,
        demand: '请平台协调服务商完成整改',
      })
      setComplaintOpen(false)
      message.success('投诉工单已创建，可在「售后与投诉」跟进')
      navigate('complaints')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '投诉提交失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <button type="button" className="back-link" onClick={() => navigate('orders')}>← 返回订单列表</button>
      <section className="order-detail-hero">
        <div>
          <span className="order-kicker">ORDER DETAIL</span>
          <h1>{order.serviceName}</h1>
          <p>{order.orderNo} · {order.providerName}</p>
        </div>
        <div className="order-detail-status">
          <StatusTag status={order.status} />
          <b>{order.progress}%</b>
          <small>{order.status === 'in_progress' ? '现场作业中' : order.status === 'completed' ? '服务已完成' : '履约进度'}</small>
        </div>
      </section>

      <div className="order-detail-layout">
        <div className="order-detail-main">
          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">LIVE PROGRESS</span><h2>服务动态</h2></div>
              <span className="live-label"><i /> 实时更新</span>
            </div>
            <div className="timeline">
              {(order.timeline ?? []).map((event, index) => (
                <div className={`timeline-item${event.completed ? ' done' : ''}`} key={`${event.title}-${index}`}>
                  <span className="timeline-dot">{event.completed ? <CheckCircleFilled /> : index + 1}</span>
                  <div><b>{event.title}</b><p>{event.note}</p><small>{event.eventTime}</small></div>
                </div>
              ))}
            </div>
          </section>

          {order.status === 'in_progress' && (
            <section className="surface-card quality-monitor">
              <div className="section-heading compact">
                <div><span className="section-kicker">PROGRESS REPORT</span><h2>服务商进度上报</h2></div>
                <span className="quality-score">{order.progress}<small>%</small></span>
              </div>
              <div className="quality-grid">
                <div><span>服务数量</span><b>{order.quantity} {order.unit}</b><MiniProgress value={order.progress} /></div>
                <div><span>最新上报</span><b>{latestReport?.title ?? '暂无上报'}</b><small>{latestReport?.note ?? '服务商在移动工作台上报后，这里会同步'}</small></div>
                <div><span>上报时间</span><b>{latestReport?.eventTime ?? '—'}</b><small>进度只前进不回退</small></div>
                <div><span>验收方式</span><b>由你确认</b><small className="good">确认验收后释放尾款</small></div>
              </div>
            </section>
          )}

          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">ORDER INFORMATION</span><h2>预约与费用</h2></div>
            </div>
            <div className="info-table">
              <span><small>服务地点</small><b><EnvironmentOutlined /> {order.location}</b></span>
              <span><small>预约时间</small><b><ClockCircleOutlined /> {order.appointmentDate} {order.appointmentSlot}</b></span>
              <span><small>服务数量</small><b>{order.quantity} {order.unit}</b></span>
              <span><small>联系人</small><b>{order.contactName} · {order.contactPhone}</b></span>
              <span><small>订单总额</small><b><Money value={order.totalAmount} /></b></span>
              <span><small>已付定金</small><b><Money value={order.depositAmount} /></b></span>
            </div>
            {order.notes && <div className="order-note"><b>补充要求</b><p>{order.notes}</p></div>}
          </section>
        </div>

        <aside className="order-detail-aside">
          <section className="surface-card provider-summary">
            <span className="provider-summary-icon">{order.providerName.slice(0, 1)}</span>
            <h3>{order.providerName}</h3>
            <p>平台认证 · 履约保障</p>
            <Button block icon={<FileProtectOutlined />} onClick={() => navigate('contracts')}>查看服务合同要素</Button>
            <p className="muted-copy">平台不在订单页下发双方号码；服务商在工作台接单后可见你预留的联系号码，问题请走「售后服务」由平台受理。</p>
          </section>
          <section className="surface-card safety-summary">
            <SafetyCertificateOutlined />
            <div><b>平台担保交易</b><p>尾款将在验收通过后结算；如服务不符，可发起售后并申请平台介入。</p></div>
          </section>
          <section className="surface-card action-stack">
            {order.status === 'pending_payment' && <Button type="primary" size="large" block loading={busy} onClick={() => void updateStatus('confirmed')}>支付定金并锁定档期</Button>}
            {order.status === 'confirmed' && <div className="booking-form-tip">已支付定金，等待服务商到场并在工作台上报进度。</div>}
            {order.status === 'in_progress' && <Button type="primary" size="large" block loading={busy} onClick={() => void updateStatus('completed')}>作业完成，确认验收</Button>}
            {order.status === 'completed' && !order.rating && <Button type="primary" size="large" block onClick={() => setReviewOpen(true)}>评价本次服务</Button>}
            {order.rating && <div className="reviewed-box"><span>{'★'.repeat(order.rating)}</span><p>{order.review}</p></div>}
            <Button block onClick={() => setComplaintOpen(true)}>售后服务</Button>
            {!['completed', 'cancelled'].includes(order.status) && <Button danger block loading={busy} onClick={() => void updateStatus('cancelled')}>取消订单</Button>}
          </section>
        </aside>
      </div>

      <Modal title="评价服务" open={reviewOpen} onCancel={() => setReviewOpen(false)} onOk={() => void submitReview()} confirmLoading={busy} okText="提交评价">
        <div className="review-form">
          <label>服务评分</label>
          <Rate value={rating} onChange={setRating} />
          <label>服务体验</label>
          <Input.TextArea value={review} onChange={(event) => setReview(event.target.value)} rows={4} placeholder="评价将帮助下一位用户做出选择…" />
        </div>
      </Modal>

      <Modal title="发起售后 / 投诉" open={complaintOpen} onCancel={() => setComplaintOpen(false)} onOk={() => void submitComplaint()} confirmLoading={busy} okText="提交投诉">
        <div className="review-form">
          <label>问题描述</label>
          <Input.TextArea value={complaint} onChange={(event) => setComplaint(event.target.value)} rows={5} placeholder="请说明问题、发生时间与期望处理方式" />
          <div className="booking-form-tip">投诉会创建一张归属本主体的工单，平台受理与处理结论都在「售后与投诉」页可查。</div>
        </div>
      </Modal>
    </div>
  )
}
