import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AimOutlined,
  ArrowRightOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { App, Button, Empty, Form, Input, InputNumber, Modal, Select, Tag } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Expert, ServiceResource } from '../types'
import { LoadingBlock, PageTitle } from '../components/ui'

export function ResourcesPage(): JSX.Element {
  const { navigate } = useApp()
  const { message } = App.useApp()
  const [tab, setTab] = useState<'land' | 'labor' | 'legal'>('land')
  const [resources, setResources] = useState<ServiceResource[]>([])
  const [experts, setExperts] = useState<Expert[]>([])
  const [identityName, setIdentityName] = useState('')
  const [loading, setLoading] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [question, setQuestion] = useState('')
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([serviceApi.resources(), serviceApi.experts(), serviceApi.identity().catch(() => null)])
      .then(([rows, roster, identity]) => {
        setResources(rows)
        setExperts(roster)
        setIdentityName(identity?.merchantName ?? '')
        const lawyer = roster.find((item) => item.category === '法律咨询')
        setLawyerId(lawyer?.id ?? null)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const landList = useMemo(() => resources.filter((item) => item.resourceType === 'land'), [resources])
  const laborList = useMemo(() => resources.filter((item) => item.resourceType === 'labor'), [resources])
  const lawyer = useMemo(() => experts.find((item) => item.id === lawyerId) ?? null, [experts, lawyerId])

  const openPublish = (): void => {
    form.setFieldsValue({
      resourceType: tab === 'labor' ? 'labor' : 'land',
      title: '',
      location: '',
      areaMu: undefined,
      price: undefined,
      unit: tab === 'labor' ? '元/人/天' : '元/亩/年',
      description: '',
      contactPhone: '',
    })
    setPublishOpen(true)
  }

  const publish = async (): Promise<void> => {
    setSubmitting(true)
    try {
      const values = await form.validateFields()
      const created = await serviceApi.createResource(values)
      setPublishOpen(false)
      message.success(`资源「${created.title}」已发布，归属主体 ${created.merchantName ?? ''}`)
      load()
    } catch (reason) {
      if (reason instanceof Error) message.error(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  /** 法律求助走真实问诊单：把问题落到 service_consultation，由律师在工作台接诊。 */
  const askLegal = async (): Promise<void> => {
    if (!question.trim()) {
      message.warning('请先描述法律问题')
      return
    }
    if (!lawyer) {
      message.error('当前没有在册的涉农法律专家，无法受理')
      return
    }
    try {
      const created = await serviceApi.createConsultation({
        type: '法律图文',
        expertId: lawyer.id,
        subject: question.slice(0, 24),
        content: question,
      })
      setQuestion('')
      message.success(`已受理（${created.consultNo}），${lawyer.name} 的复核结论会在消息中心通知`)
      load()
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '提交失败')
    }
  }

  const renderResource = (row: ServiceResource, kind: 'land' | 'labor'): JSX.Element => (
    <article key={row.id}>
      <div>
        <h3>
          {row.title}
          {row.mine ? <Tag color="green">我发布的</Tag> : <Tag color="blue">{row.merchantName ?? '其他主体'}</Tag>}
        </h3>
        <p>{row.description || (kind === 'land' ? '未填写地块说明' : '未填写班组说明')}</p>
        <small><EnvironmentOutlined /> {row.location}　·　{row.areaMu ? `${row.areaMu} 亩` : '面积待补充'}</small>
      </div>
      <div>
        <b>{row.price} {row.unit}</b>
        <small><PhoneOutlined /> {row.contactName} {row.contactPhone}{row.mine ? '' : '（脱敏）'}</small>
        <Button type="primary" ghost icon={<AimOutlined />} onClick={() => navigate('demand')}>发起需求</Button>
      </div>
    </article>
  )

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="INDUSTRIAL RESOURCES"
        title="产业资源对接"
        description="土地流转与季节性用工由经营主体自行发布，平台记录归属并按主体脱敏联系方式；法律求助直接生成问诊单。"
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={openPublish}>发布资源</Button>}
      />

      <section className="resource-tabs">
        <button type="button" className={tab === 'land' ? 'on' : ''} onClick={() => setTab('land')}>
          <span>🌳</span><b>土地流转</b><small>{landList.length} 条在挂</small>
        </button>
        <button type="button" className={tab === 'labor' ? 'on' : ''} onClick={() => setTab('labor')}>
          <span>🧑‍🌾</span><b>劳务用工</b><small>{laborList.length} 条在挂</small>
        </button>
        <button type="button" className={tab === 'legal' ? 'on' : ''} onClick={() => setTab('legal')}>
          <span>⚖️</span><b>法律咨询</b><small>{lawyer ? `${lawyer.name} 可接诊` : '暂无在册律师'}</small>
        </button>
      </section>

      {loading ? <LoadingBlock rows={3} /> : (
        <>
          {tab === 'land' && (
            <div className="resource-layout">
              <section className="surface-card detail-section">
                <div className="section-heading compact">
                  <div><span className="section-kicker">LAND LISTINGS</span><h2>在挂地源</h2></div>
                  <span className="section-note">发布方与联系方式由平台记录</span>
                </div>
                <div className="land-list">
                  {landList.length === 0
                    ? <Empty description="暂未有主体发布土地流转资源" />
                    : landList.map((row) => renderResource(row, 'land'))}
                </div>
              </section>
              <aside className="surface-card resource-assurance-card">
                <TeamOutlined />
                <h3>流转前请自行核验</h3>
                {['承包关系与权属证书原件', '实地面积与地块四至', '流转期限与用途限制', '村集体备案与网签'].map((item) => <span key={item}>· {item}</span>)}
                <Button block onClick={() => navigate('policies')}>查看流转奖补政策</Button>
              </aside>
            </div>
          )}

          {tab === 'labor' && (
            <div className="resource-layout">
              <section className="surface-card detail-section">
                <div className="section-heading compact">
                  <div><span className="section-kicker">LABOR LISTINGS</span><h2>在挂工队</h2></div>
                  <span className="section-note">共 {laborList.length} 支</span>
                </div>
                <div className="labor-list">
                  {laborList.length === 0
                    ? <Empty description="暂未有主体发布劳务用工资源" />
                    : laborList.map((row) => renderResource(row, 'labor'))}
                </div>
              </section>
              <aside className="surface-card resource-assurance-card">
                <TeamOutlined />
                <h3>用工建议约定</h3>
                {['工时与计件口径', '结算周期与担保方式', '意外责任与保险', '现场安全交底'].map((item) => <span key={item}>· {item}</span>)}
                <Button block icon={<AimOutlined />} onClick={() => navigate('demand')}>发布用工需求</Button>
              </aside>
            </div>
          )}

          {tab === 'legal' && (
            <div className="resource-layout">
              <section className="surface-card detail-section legal-chat">
                <div className="section-heading compact">
                  <div><span className="section-kicker">LEGAL CONSULT</span><h2>{lawyer ? `${lawyer.name} · ${lawyer.title}` : '涉农法律咨询'}</h2></div>
                  <span className="ai-live-badge"><i /> 提交后生成真实问诊单</span>
                </div>
                <div className="legal-message">
                  <span>{lawyer ? lawyer.name.slice(0, 1) : '法'}</span>
                  <div>
                    <b>{lawyer ? `${lawyer.organization}` : '当前没有在册律师'}</b>
                    <p>{lawyer ? lawyer.summary : '法律咨询需要平台先录入具备执业资格的专家档案。'}</p>
                  </div>
                </div>
                <div className="legal-input">
                  <Input.TextArea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：土地流转合同没有约定到期地上作物归属，风险怎么处理？" />
                  <div>
                    <Button type="primary" onClick={() => void askLegal()} disabled={!lawyer}>提交问题</Button>
                    <Button onClick={() => navigate('consult')}>查看全部专家<ArrowRightOutlined /></Button>
                  </div>
                </div>
                <div className="legal-topics">
                  {['土地承包到期续签', '果园冻害损失责任', '采摘临时用工工伤', '农机作业质量纠纷'].map((topic) => (
                    <button type="button" key={topic} onClick={() => setQuestion(topic)}>{topic}</button>
                  ))}
                </div>
              </section>
              <aside className="surface-card resource-assurance-card">
                {lawyer ? (
                  <>
                    <span className="lawyer-avatar">{lawyer.name.slice(0, 1)}</span>
                    <h3>{lawyer.name}</h3>
                    <p>{lawyer.title} · {lawyer.serviceScope}</p>
                    <b>已接诊 {lawyer.consultCount} 次 · 评分 {lawyer.rating}</b>
                    <Button type="primary" block onClick={() => navigate('consult')}>查看专家列表</Button>
                    <small>正式法律意见以委托合同与法律意见书为准</small>
                  </>
                ) : (
                  <>
                    <h3>暂无在册律师</h3>
                    <p>平台需要录入执业律师档案后才能受理法律问诊。</p>
                  </>
                )}
              </aside>
            </div>
          )}
        </>
      )}

      <Modal title="发布产业资源" open={publishOpen} onCancel={() => setPublishOpen(false)} onOk={() => void publish()} confirmLoading={submitting} okText="提交发布" width={640}>
        <Form form={form} layout="vertical">
          <Form.Item label="资源类型" name="resourceType" rules={[{ required: true }]}>
            <Select options={[{ value: 'land', label: '土地流转' }, { value: 'labor', label: '劳务用工' }]} />
          </Form.Item>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请填写资源标题' }]}>
            <Input placeholder="如：望城区乔口镇连片水田 128 亩" />
          </Form.Item>
          <Form.Item label="所在地" name="location" rules={[{ required: true, message: '请填写所在地' }]}>
            <Input placeholder="区县 + 乡镇" />
          </Form.Item>
          <Form.Item label="面积 / 人数（亩）" name="areaMu"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="价格" name="price" rules={[{ required: true, message: '请填写价格' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} addonAfter={<Form.Item name="unit" noStyle><Input style={{ width: 110 }} /></Form.Item>} />
          </Form.Item>
          <Form.Item label="说明" name="description"><Input.TextArea rows={3} placeholder="权属/技能/可上工时间等" /></Form.Item>
          <Form.Item label="联系电话" name="contactPhone" rules={[{ required: true, message: '请填写联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请填写 11 位手机号' }]}>
            <Input placeholder="对外展示的联系方式，其他主体看到的是脱敏号码" />
          </Form.Item>
          <p className="form-hint">发布主体：{identityName || '未解析到经营主体'}（由登录令牌解析，不可在此填写）</p>
        </Form>
      </Modal>
    </div>
  )
}
