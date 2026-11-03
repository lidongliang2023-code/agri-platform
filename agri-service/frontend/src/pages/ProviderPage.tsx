import { useEffect, useState } from 'react'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  SafetyCertificateOutlined,
  StarFilled,
} from '@ant-design/icons'
import { App, Button, Form, Input, InputNumber, Modal, Select } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Provider } from '../types'
import { EmptyState, LoadingBlock, Money } from '../components/ui'

interface BookingValues {
  serviceName: string
  quantity: number
  appointmentDate: string
  appointmentSlot: string
  location: string
  contactName: string
  contactPhone: string
  notes: string
}

/** 明天：日期默认值必须是相对今天算出来的，写死一个历史日期等于让用户提交过期预约。 */
function tomorrowText(): string {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function ProviderPage(): JSX.Element {
  const { id, navigate } = useApp()
  const { message } = App.useApp()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [error, setError] = useState('')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [form] = Form.useForm<BookingValues>()

  useEffect(() => {
    if (!id) return
    setProvider(null)
    setError('')
    serviceApi.provider(id)
      .then(setProvider)
      .catch((reason: Error) => setError(reason.message))
  }, [id])

  useEffect(() => {
    if (!id) return
    serviceApi.favorites()
      .then((rows) => setFavorite(rows.some((item) => Number(item.id) === id)))
      .catch(() => setFavorite(false))
    serviceApi.identity()
      .then((identity) => setSubjectName(identity.merchantName))
      .catch(() => setSubjectName(''))
  }, [id])

  const toggleFavorite = async (): Promise<void> => {
    if (!provider) return
    try {
      const result = await serviceApi.toggleFavorite(provider.id)
      setFavorite(Boolean(result.favorited))
      message.success(result.favorited ? `已收藏 ${result.name}` : '已取消收藏')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '收藏操作失败')
    }
  }

  if (!id) {
    return <EmptyState title="缺少服务商编号" description="请从服务超市重新选择服务商。" action={<Button onClick={() => navigate('services')}>返回服务超市</Button>} />
  }
  if (!provider && !error) return <LoadingBlock rows={4} />
  if (!provider) return <EmptyState icon="🛠️" title="服务商资料加载失败" description={error} action={<Button onClick={() => navigate('services')}>返回服务超市</Button>} />

  const bookableItems = provider.items ?? []
  const selectedItem = bookableItems[0]
  const openBooking = (serviceName?: string): void => {
    if (provider.status !== 'available') {
      message.warning(`该服务商当前状态为「${provider.status}」，暂不可接单`)
      return
    }
    form.setFieldsValue({
      serviceName: serviceName ?? selectedItem?.name ?? provider.name,
      quantity: 1,
      appointmentDate: tomorrowText(),
      appointmentSlot: provider.availableSlots[0] ?? '09:00-12:00',
      location: '',
      contactName: subjectName,
      contactPhone: '',
      notes: '',
    })
    setBookingOpen(true)
  }

  const submitBooking = async (values: BookingValues): Promise<void> => {
    setSubmitting(true)
    try {
      // 单价与定金由服务端按服务商目录价实算，这里只提交选择项
      const order = await serviceApi.createOrder({
        providerId: provider.id,
        serviceName: values.serviceName,
        quantity: values.quantity,
        appointmentDate: values.appointmentDate,
        appointmentSlot: values.appointmentSlot,
        location: values.location,
        contactName: values.contactName,
        contactPhone: values.contactPhone,
        notes: values.notes,
      })
      setBookingOpen(false)
      message.success(`预约已提交（${order.orderNo}），支付定金后服务商才确认档期`)
      navigate('order-detail', order.id)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '预约失败')
    } finally {
      setSubmitting(false)
    }
  }

  const slotHint = '档期由服务商在工作台维护，未同步时以服务商确认为准'

  return (
    <div className="page-stack provider-page">
      <button type="button" className="back-link" onClick={() => navigate('services')}>← 返回服务超市</button>

      <section className="provider-hero">
        <div className="provider-hero-main">
          <span className="provider-hero-icon">{provider.categoryIcon}</span>
          <div>
            <div className="hero-provider-badges">
              <span className="verified-badge"><SafetyCertificateOutlined /> 平台认证</span>
              <span className="level-badge">{provider.badge}</span>
            </div>
            <h1>{provider.name}</h1>
            <p>{provider.description}</p>
            <div className="provider-hero-meta">
              <span className="rating"><StarFilled /> {provider.rating}<small> · {provider.orderCount} 单服务</small></span>
              <span><EnvironmentOutlined /> {provider.region}</span>
              <span><ClockCircleOutlined /> 平均 {provider.responseMinutes} 分钟响应</span>
            </div>
          </div>
        </div>
        <div className="provider-hero-price">
          <small>{selectedItem?.name ?? provider.category}</small>
          <Money value={provider.price} suffix={provider.unit.replace('元/', '')} />
          <span>平台担保 · 验收后结算</span>
        </div>
      </section>

      <div className="provider-detail-layout">
        <div className="provider-detail-main">
          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">SERVICE ITEMS</span><h2>服务项目与价格</h2></div>
              <span className="section-note">明码标价，无隐藏费用</span>
            </div>
            <div className="service-item-table">
              {(provider.items ?? []).map((item) => (
                <div className="service-item-row" key={item.id}>
                  <div>
                    <h3>{item.name}<span>{item.duration}</span></h3>
                    <p>{item.description}</p>
                    <small>近 30 天 {item.selectedCount} 人选择</small>
                  </div>
                  <Money value={item.price} suffix={item.unit.replace('元/', '')} />
                  <Button type="primary" ghost onClick={() => openBooking(item.name)}>立即预约</Button>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">QUALIFICATION</span><h2>资质与履约保障</h2></div>
            </div>
            <div className="cert-grid">
              {provider.certifications.map((item) => (
                <div key={item}><CheckCircleFilled /><span><b>{item}</b><small>服务商申报资质，入驻审核时由平台查验</small></span></div>
              ))}
              <div><CheckCircleFilled /><span><b>平台担保交易</b><small>定金托管，验收通过后释放尾款</small></span></div>
              <div><CheckCircleFilled /><span><b>服务过程留痕</b><small>订单动态、进度上报与评价可回溯</small></span></div>
            </div>
          </section>

          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">FIELD DIARY</span><h2>服务商公布的档期</h2></div>
              <span className="section-note">{slotHint}</span>
            </div>
            {provider.availableSlots.length === 0 ? <p className="muted-copy">该服务商暂未公布可约档期。</p> : (
              <div className="slot-grid">
                {provider.availableSlots.map((slot) => (
                  <button type="button" key={slot} onClick={() => openBooking()}>
                    <span>{slot}</span><small>选择后进入预约</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">REVIEWS</span><h2>真实服务评价</h2></div>
              <span className="rating-summary"><b>{provider.rating}</b> / 5.0</span>
            </div>
            <div className="review-list">
              {(provider.reviews ?? []).length === 0 && <p className="muted-copy">还没有可展示的评价，完成首单后可发表真实体验。</p>}
              {(provider.reviews ?? []).map((review) => (
                <article key={review.orderNo} className="review-row">
                  <span className="review-avatar">{provider.name.slice(0, 1)}</span>
                  <div>
                    <div className="review-head"><b>{review.serviceName}</b><span>{'★'.repeat(review.rating)}</span></div>
                    <p>{review.review}</p>
                    <small>{review.appointmentDate} · 订单已验收</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="provider-detail-aside">
          <section className="booking-card">
            <span className="booking-kicker">立即预约</span>
            <h3>让服务按时到田</h3>
            <div className="booking-row"><span>最早可约</span><b>{provider.availableSlots[0] ?? '暂未公布'}</b></div>
            <div className="booking-row"><span>服务区域</span><b>{provider.region}</b></div>
            <div className="booking-row"><span>当前状态</span><b>{provider.status === 'available' ? '可接单' : provider.status}</b></div>
            <Button type="primary" size="large" block disabled={provider.status !== 'available'} onClick={() => openBooking()}>
              {provider.status === 'available' ? '选择服务并预约' : '该服务商暂停接单'}
            </Button>
            <Button size="large" block icon={favorite ? <HeartFilled /> : <HeartOutlined />} onClick={() => void toggleFavorite()}>
              {favorite ? '已收藏' : '收藏服务商'}
            </Button>
            <p className="muted-copy">未下单前平台不公开双方号码；预约提交后，服务商会看到你填写的联系号码。</p>
          </section>
          <section className="trust-card">
            <SafetyCertificateOutlined />
            <div><b>平台服务保障</b><p>资质审核 · 电子合同 · 履约留痕 · 纠纷调解</p></div>
          </section>
        </aside>
      </div>

      <Modal title="预约服务" open={bookingOpen} onCancel={() => setBookingOpen(false)} footer={null} width={620} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={submitBooking} className="booking-form">
          <Form.Item label="服务项目" name="serviceName" rules={[{ required: true, message: '请选择服务项目' }]}>
            <Select
              options={(provider.items ?? []).length > 0
                ? (provider.items ?? []).map((item) => ({ value: item.name, label: `${item.name} · ¥${item.price}/${item.unit.replace('元/', '')}` }))
                : [{ value: provider.name, label: `${provider.name} · 起价 ¥${provider.price}${provider.unit}` }]}
            />
          </Form.Item>
          <div className="form-grid-2">
            <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请填写服务数量' }]}>
              <InputNumber min={1} precision={1} addonAfter={provider.unit.replace('元/', '')} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="预约日期" name="appointmentDate" rules={[{ required: true, message: '请选择日期' }]}>
              <Input type="date" min={tomorrowText()} />
            </Form.Item>
          </div>
          <Form.Item label="服务时段" name="appointmentSlot" rules={[{ required: true, message: '请选择时段' }]}>
            <Select
              options={(provider.availableSlots.length ? provider.availableSlots : ['09:00-12:00', '14:00-18:00'])
                .map((slot) => ({ value: slot, label: slot }))}
            />
          </Form.Item>
          <Form.Item label="服务地址" name="location" rules={[{ required: true, message: '请输入服务地址' }]}>
            <Input prefix={<EnvironmentOutlined />} placeholder="村镇 + 地块，例：望城区乔口镇 3 号田" />
          </Form.Item>
          <div className="form-grid-2">
            <Form.Item label="联系人" name="contactName" rules={[{ required: true, message: '请输入联系人' }]}>
              <Input placeholder="默认使用当前经营主体名称" />
            </Form.Item>
            <Form.Item label="联系电话" name="contactPhone"
              rules={[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]}>
              <Input placeholder="服务商接单后可见" />
            </Form.Item>
          </div>
          <Form.Item label="补充要求" name="notes">
            <Input.TextArea rows={3} placeholder="如作业标准、运输卸粮、机损赔付要求等" />
          </Form.Item>
          <div className="booking-form-tip">金额与定金由服务端按服务商目录价实算。提交后进入「待支付定金」，支付后服务商才确认档期，验收通过后再结算尾款。</div>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>确认预约</Button>
        </Form>
      </Modal>
    </div>
  )
}
