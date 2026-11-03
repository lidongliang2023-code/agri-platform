import { useCallback, useEffect, useState } from 'react'
import {
  AimOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { App, Button, Form, Input, InputNumber, Select, Tag } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Demand } from '../types'
import { EmptyState, LoadingBlock, PageTitle } from '../components/ui'

interface DemandValues {
  category: string
  serviceName: string
  description: string
  location: string
  area: string
  preferredDate: string
  budgetMin: number
  budgetMax: number
  contactName: string
  contactPhone: string
}

const DEMAND_STATUS: Record<string, string> = {
  matching: '智能匹配中',
  quoted: '已收到报价',
  accepted: '服务商已接单',
  assigned: '平台已指派',
  closed: '已结束',
}

/** 期望日期不能写死成某个历史日子：默认给出明天，用户可再改。 */
function tomorrowText(): string {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function DemandPage(): JSX.Element {
  const { navigate } = useApp()
  const { message } = App.useApp()
  const [demands, setDemands] = useState<Demand[]>([])
  const [categories, setCategories] = useState<string[]>(['农机作业', '植保防疫', '粮食烘干', '检测认证', '农技问诊'])
  const [subjectName, setSubjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [description, setDescription] = useState('')
  const [form] = Form.useForm<DemandValues>()

  const load = useCallback((): void => {
    setLoading(true)
    Promise.all([serviceApi.demands(), serviceApi.dictionaries(), serviceApi.identity().catch(() => null)])
      .then(([rows, dict, identity]) => {
        setDemands(rows)
        if (dict.categories.length) setCategories(dict.categories)
        setSubjectName(identity?.merchantName ?? '')
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  // initialValues 只在挂载时生效，而主体名是异步拿到的；不补这一步，联系人会一直是空的
  useEffect(() => {
    if (subjectName) form.setFieldValue('contactName', subjectName)
  }, [subjectName, form])

  const parseDescription = (): void => {
    let category = categories[0]
    if (description.includes('飞防') || description.includes('植保')) category = categories.includes('植保防疫') ? '植保防疫' : category
    else if (description.includes('检测')) category = categories.includes('检测认证') ? '检测认证' : category
    else if (description.includes('烘干')) category = categories.includes('粮食烘干') ? '粮食烘干' : category
    const area = description.match(/(\d+)\s*亩/)?.[1]
    const price = description.match(/(\d+(?:\.\d+)?)\s*元/)?.[1]
    form.setFieldsValue({
      category,
      serviceName: description.slice(0, 20) || '农业服务需求',
      description,
      area: area ? `${area}亩` : '',
      preferredDate: tomorrowText(),
      budgetMin: price ? Number(price) : undefined,
      budgetMax: price ? Math.round(Number(price) * 1.15 * 100) / 100 : undefined,
    })
    message.success('已按关键词填充类型、面积与预算，请核对后发布')
  }

  const submit = async (values: DemandValues): Promise<void> => {
    setSubmitting(true)
    try {
      const created = await serviceApi.createDemand({ ...values })
      message.success(`需求 ${created.demandNo} 已发布，同类目在营服务商 ${created.matchCount} 家可见`)
      form.resetFields()
      setDescription('')
      load()
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '需求发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SMART MATCHING"
        title="需求大厅"
        description="用一句话描述作业面积、地点、时间和预算，AI 自动匹配可履约的服务商。"
        actions={<Button icon={<AimOutlined />} onClick={() => navigate('services')}>浏览服务商</Button>}
      />

      <div className="demand-layout">
        <section className="surface-card demand-form-card">
          <div className="section-heading compact">
            <div><span className="section-kicker">PUBLISH A DEMAND</span><h2>发布一条服务需求</h2></div>
            <span className="ai-chip"><RobotOutlined /> 关键词解析填充</span>
          </div>
          <div className="ai-description-box">
            <Input.TextArea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="例：我有 50 亩晚稻，在望城区乔口镇，10 月 25 日成熟，想找履带式收割机，预算 60 元一亩，要含运输卸粮。"
            />
            <div>
              <span>支持面积、时间、地点、预算与作业要求自动拆解</span>
              <Button type="primary" icon={<ThunderboltOutlined />} disabled={!description.trim()} onClick={parseDescription}>AI 解析并填充</Button>
            </div>
          </div>
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{ category: categories[0], preferredDate: tomorrowText(), contactName: subjectName, contactPhone: '' }}>
            <div className="form-grid-2">
              <Form.Item label="服务类型" name="category" rules={[{ required: true }]}>
                <Select options={categories.map((value) => ({ value, label: value }))} />
              </Form.Item>
              <Form.Item label="需求标题" name="serviceName" rules={[{ required: true, message: '请填写需求标题' }]}>
                <Input placeholder="如：50 亩晚稻机收" />
              </Form.Item>
            </div>
            <Form.Item label="详细描述" name="description" rules={[{ required: true, message: '请描述作业要求' }]}>
              <Input.TextArea rows={3} placeholder="补充机型、作业标准、运输与验收要求" />
            </Form.Item>
            <div className="form-grid-2">
              <Form.Item label="服务地点" name="location" rules={[{ required: true, message: '请输入服务地点' }]}>
                <Input prefix={<EnvironmentOutlined />} />
              </Form.Item>
              <Form.Item label="面积 / 数量" name="area" rules={[{ required: true, message: '请输入面积或数量' }]}>
                <Input />
              </Form.Item>
            </div>
            <div className="form-grid-3">
              <Form.Item label="期望日期" name="preferredDate" rules={[{ required: true, message: '请选择日期' }]}>
                <Input type="date" min={tomorrowText()} />
              </Form.Item>
              <Form.Item label="最低预算" name="budgetMin">
                <InputNumber min={0} addonAfter="元" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="最高预算" name="budgetMax">
                <InputNumber min={0} addonAfter="元" style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <div className="form-grid-2">
              <Form.Item label="联系人" name="contactName" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="联系电话" name="contactPhone" rules={[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]}>
                <Input placeholder="服务商接单后才会看到完整号码" />
              </Form.Item>
            </div>
            <Button type="primary" size="large" htmlType="submit" loading={submitting} block>发布需求并智能匹配</Button>
            <p className="form-assurance">手机号仅向已接单服务商展示，平台提供资金担保与履约保障。</p>
          </Form>
        </section>

        <aside className="demand-aside">
          <div className="ai-match-note">
            <RobotOutlined />
            <h3>需求是怎么被撮合的</h3>
            <ul>
              <li><b>同类目在营</b> 发布时按服务类型统计当前可接单的服务商数，就是页面显示的匹配数</li>
              <li><b>服务商抢单</b> 在营服务商在移动工作台看到脱敏后的需求，确认报价后抢单</li>
              <li><b>抢单前置校验</b> 类目不符、已被别家接走的会被拒绝</li>
              <li><b>运营兜底指派</b> 长期无人抢单时由平台调度人工派单，结果写入订单动态</li>
              <li><b>联系方式</b> 未接单前号码脱敏，接单后服务商可见完整号码</li>
            </ul>
          </div>
          <div className="surface-card demand-tip">
            <b>完善需求，更快响应</b>
            <p>写清地块条件、运输要求和验收标准，平均可减少 1-2 次电话沟通。</p>
          </div>
        </aside>
      </div>

      <section className="surface-card demand-list-section">
        <div className="section-heading compact">
          <div><span className="section-kicker">ACTIVE DEMANDS</span><h2>需求大厅</h2></div>
          <span className="section-note">共 {demands.length} 条 · 联系方式按主体脱敏</span>
        </div>
        {loading ? <LoadingBlock rows={2} /> : demands.length === 0 ? <EmptyState title="暂无公开需求" /> : (
          <div className="demand-list">
            {demands.map((demand) => (
              <article key={demand.id}>
                <div className="demand-status"><i /><span>{DEMAND_STATUS[demand.status] ?? demand.status}</span></div>
                <div className="demand-main">
                  <div className="demand-title-line">
                    <span>{demand.category}</span>
                    <h3>{demand.serviceName}{demand.mine && <Tag color="green">我发布的</Tag>}</h3>
                  </div>
                  <p>{demand.description}</p>
                  <div className="demand-meta">
                    <span><EnvironmentOutlined /> {demand.location}</span>
                    <span><CalendarOutlined /> {demand.preferredDate}</span>
                    <span>{demand.area}</span>
                    <span>预算 ¥{demand.budgetMin}-{demand.budgetMax}</span>
                    {demand.acceptedProviderName && <span>已由 {demand.acceptedProviderName} 接单</span>}
                  </div>
                </div>
                <div className="demand-matches"><b>{demand.matchCount}</b><span>家在营可见</span><small>{demand.demandNo}</small></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
