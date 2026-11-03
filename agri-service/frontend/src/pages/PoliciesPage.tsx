import { useEffect, useState } from 'react'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Progress } from 'antd'
import { serviceApi } from '../api'
import type { Policy, PolicyApplication } from '../types'
import { EmptyState, LoadingBlock, PageTitle, POLICY_STATUS, StatusTag } from '../components/ui'

export function PoliciesPage(): JSX.Element {
  const { message } = App.useApp()
  const [tab, setTab] = useState<'match' | 'applications'>('match')
  const [keyword, setKeyword] = useState('')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [applications, setApplications] = useState<PolicyApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Policy | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const load = (): void => {
    setLoading(true)
    Promise.all([serviceApi.policies(keyword || undefined), serviceApi.policyApplications()])
      .then(([policyList, applicationList]) => {
        setPolicies(policyList)
        setApplications(applicationList)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openApply = (policy: Policy): void => {
    setSelected(policy)
    form.setFieldsValue({
      applicant: '乔口丰收家庭农场',
      contactPhone: '13800121206',
      bankAccount: '6222 **** **** 1206',
    })
  }

  const submit = async (): Promise<void> => {
    if (!selected) return
    setSubmitting(true)
    try {
      const values = await form.validateFields()
      const created = await serviceApi.applyPolicy({ policyId: selected.id, ...values })
      setSelected(null)
      message.success(`申报 ${created.applicationNo} 已提交`)
      setTab('applications')
      load()
    } catch (reason) {
      if (reason instanceof Error) message.error(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="POLICY ASSISTANT"
        title="惠农政策"
        description="按经营主体自动匹配补贴政策，申报条件、材料和进度一目了然。"
        actions={<Button icon={<ThunderboltOutlined />} onClick={load}>重新匹配政策</Button>}
      />

      <section className="policy-top-summary">
        <div>
          <span className="policy-summary-icon"><ThunderboltOutlined /></span>
          <div><small>AI 精准匹配</small><h2>发现 4 项可申报政策</h2><p>乔口丰收家庭农场 · 种植型经营主体 · 128 亩</p></div>
        </div>
        <div className="policy-summary-figures">
          <span><b>4</b><small>匹配政策</small></span>
          <span><b>2</b><small>申报中</small></span>
          <span><b>¥4,500</b><small>预计可兑付</small></span>
        </div>
      </section>

      <section className="surface-card policy-content">
        <div className="policy-toolbar">
          <div className="order-tabs">
            <button type="button" className={tab === 'match' ? 'on' : ''} onClick={() => setTab('match')}>为您匹配</button>
            <button type="button" className={tab === 'applications' ? 'on' : ''} onClick={() => setTab('applications')}>我的申报 <i>{applications.length}</i></button>
          </div>
          {tab === 'match' && (
            <div className="inline-search">
              <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={load} prefix={<SearchOutlined />} placeholder="搜索政策关键词" />
              <Button onClick={load}>查询</Button>
            </div>
          )}
        </div>

        {loading ? <LoadingBlock rows={3} /> : tab === 'match' ? (
          policies.length === 0 ? <EmptyState title="没有匹配政策" /> : (
            <div className="policy-card-list">
              {policies.map((policy, index) => (
                <article className={`policy-card${index === 0 ? ' featured' : ''}`} key={policy.id}>
                  <div className="policy-score">
                    <span>{policy.matchScore}</span><small>匹配度</small>
                  </div>
                  <div className="policy-card-main">
                    <div className="policy-tag-line">
                      <span>{policy.level}</span><span>{policy.category}</span>
                      {policy.matchScore >= 90 && <em>优先推荐</em>}
                    </div>
                    <h3>{policy.title}</h3>
                    <p>{policy.conditions}</p>
                    <div className="policy-card-meta">
                      <span><b>{policy.amountText}</b><small>补贴标准</small></span>
                      <span><CalendarOutlined /><b>{policy.deadline}</b><small>申报截止</small></span>
                      <span><FileTextOutlined /><b>{policy.materials.length} 项</b><small>所需材料</small></span>
                    </div>
                  </div>
                  <div className="policy-card-actions">
                    <Button onClick={() => message.info(policy.conditions)}>查看详情</Button>
                    <Button type="primary" onClick={() => openApply(policy)}>去申报 <ArrowRightOutlined /></Button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : applications.length === 0 ? <EmptyState icon="📑" title="还没有申报记录" action={<Button type="primary" onClick={() => setTab('match')}>去看看政策</Button>} /> : (
          <div className="application-list">
            {applications.map((application) => (
              <article key={application.id}>
                <div className="application-head">
                  <div><span className="application-doc"><FileTextOutlined /></span><div><b>{application.policyTitle}</b><small>{application.applicationNo} · {application.submittedAt}</small></div></div>
                  <StatusTag status={application.status} labels={POLICY_STATUS} />
                </div>
                <div className="application-body">
                  <span><small>申报主体</small><b>{application.applicant}</b></span>
                  <span><small>预计金额</small><b>{application.amountText}</b></span>
                  <span><small>当前进度</small><b>{application.progress}%</b></span>
                </div>
                <Progress percent={application.progress} showInfo={false} strokeColor="#159a5e" />
                <div className="application-steps">
                  {['提交申报', '形式审查', '部门审核', '公示兑付'].map((step, index) => (
                    <span className={application.progress >= (index + 1) * 25 ? 'done' : ''} key={step}><CheckCircleFilled />{step}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal title={`申报 · ${selected?.title ?? ''}`} open={Boolean(selected)} onCancel={() => setSelected(null)} onOk={() => void submit()} confirmLoading={submitting} okText="提交申报" width={620}>
        <Form form={form} layout="vertical">
          <div className="apply-policy-summary">
            <b>{selected?.amountText}</b><span>{selected?.conditions}</span>
          </div>
          <Form.Item label="申报主体" name="applicant" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="form-grid-2">
            <Form.Item label="联系电话" name="contactPhone" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label="收款账户" name="bankAccount" rules={[{ required: true }]}><Input /></Form.Item>
          </div>
          <div className="materials-box">
            <b>需准备材料</b>
            {selected?.materials.map((material) => <span key={material}><CheckCircleFilled /> {material}</span>)}
          </div>
          <div className="booking-form-tip">平台将先进行材料完整性与资格预检，再提交至对应主管部门。</div>
        </Form>
      </Modal>
    </div>
  )
}
