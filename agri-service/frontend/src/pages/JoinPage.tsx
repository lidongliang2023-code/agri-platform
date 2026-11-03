import { useEffect, useState } from 'react'
import {
  CheckCircleFilled,
  ShopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { App, Button, Form, Input, Select } from 'antd'
import { serviceApi } from '../api'
import { PageTitle } from '../components/ui'

export function JoinPage(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [applicant, setApplicant] = useState('')
  const [availableProviders, setAvailableProviders] = useState(0)
  const [success, setSuccess] = useState<{ name: string; status: string; message: string } | null>(null)

  useEffect(() => {
    Promise.all([serviceApi.dictionaries(), serviceApi.identity().catch(() => null)])
      .then(([dict, identity]) => {
        setCategories(dict.categories)
        setApplicant(identity?.merchantName ?? '')
      })
      .catch(() => setCategories([]))
  }, [message])

  useEffect(() => {
    serviceApi.providers({})
      .then((rows) => setAvailableProviders(rows.length))
      .catch(() => setAvailableProviders(0))
  }, [])

  const submit = async (values: Record<string, unknown>): Promise<void> => {
    setSubmitting(true)
    try {
      const result = await serviceApi.applyProvider(values)
      setSuccess(result)
      message.success('入驻申请已提交，可在消息中心跟踪审核结论')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '入驻申请失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="PROVIDER ONBOARDING"
        title="服务商入驻"
        description="面向农机、农技、检测、培训与涉农服务机构。入驻档案归属当前登录经营主体，审核通过后才会进入服务超市。"
      />
      <section className="join-hero">
        <div>
          <span className="hero-kicker"><i /> 共建可核查的农业服务网络</span>
          <h2>让专业能力被看见，让服务可靠地成交</h2>
          <p>一次入驻，同时连接需求发布、派单履约与担保结算。</p>
        </div>
        <div className="join-metrics">
          <span><b>{availableProviders}</b><small>当前在营可接单服务商</small></span>
          <span><b>{applicant || '未解析'}</b><small>本次申请归属主体</small></span>
        </div>
      </section>

      <div className="join-layout">
        <section className="surface-card join-form-card">
          <div className="section-heading compact">
            <div><span className="section-kicker">APPLY NOW</span><h2>提交入驻资料</h2></div>
            <span className="section-note">审核进度以运营端结论为准</span>
          </div>
          {success ? (
            <div className="join-success">
              <span><CheckCircleFilled /></span>
              <h2>申请已提交</h2>
              <p>{success.name} 的入驻资料已进入审核队列，审核结论会写入消息中心。</p>
              <div><b>申请状态</b><span>{success.status === 'pending' ? '待审核' : success.status}</span></div>
              <Button type="primary" onClick={() => setSuccess(null)}>继续提交资料</Button>
            </div>
          ) : (
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{ category: categories[0] ?? '农机作业' }}>
              <div className="form-grid-2">
                <Form.Item label="服务商名称" name="name" rules={[{ required: true, message: '请输入服务商名称' }]}>
                  <Input placeholder="公司、合作社或服务队名称" />
                </Form.Item>
                <Form.Item label="服务类型" name="category" rules={[{ required: true }]}>
                  <Select options={(categories.length ? categories : ['农机作业']).map((value) => ({ value, label: value }))} />
                </Form.Item>
              </div>
              <div className="form-grid-2">
                <Form.Item label="联系人（自动取当前主体）"><Input value={applicant || '未解析到经营主体'} readOnly disabled /></Form.Item>
                <Form.Item label="联系电话" name="phone" rules={[{ required: true, message: '请输入联系电话' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位手机号' }]}><Input /></Form.Item>
              </div>
              <Form.Item label="主要服务区域" name="region" rules={[{ required: true, message: '请输入服务区域' }]}><Input placeholder="如：长沙市望城区乔口镇及周边 30km" /></Form.Item>
              <Form.Item label="资质与证照名称" name="certifications" rules={[{ required: true, message: '请填写已有的营业执照/许可证名称' }]}>
                <Input placeholder="逗号分隔，如：营业执照,农机作业许可" />
              </Form.Item>
              <Form.Item label="服务能力与优势" name="description" rules={[{ required: true, message: '请介绍服务能力' }]}>
                <Input.TextArea rows={4} placeholder="服务项目、设备数量、人员资质、过往服务规模等" />
              </Form.Item>
              <p className="form-assurance">
                本版不接收证照图片附件，填写的资质名称会展示在服务商档案页；审核时由平台线下查验原件。
              </p>
              <Button type="primary" size="large" htmlType="submit" block loading={submitting}>提交入驻审核</Button>
              <p className="form-assurance">提交即表示同意平台服务商管理规范，资料仅用于资质审核与档案展示。</p>
            </Form>
          )}
        </section>

        <aside className="join-aside">
          <div className="join-benefit"><ThunderboltOutlined /><h3>获得服务需求</h3><p>进入需求大厅的抢单池，同类目在营需求会出现在移动工作台。</p></div>
          <div className="join-benefit"><ShopOutlined /><h3>建立服务档案</h3><p>展示资质名称、服务项目、真实评价与可约档期。</p></div>
          <div className="join-benefit"><TeamOutlined /><h3>履约与结算协同</h3><p>订单、进度上报、验收与结算批次在同一套流程内留痕。</p></div>
          <div className="join-contact"><b>提示</b><span>入驻申请归属于当前登录主体</span><small>同一主体重复提交会被运营审核合并处理</small></div>
        </aside>
      </div>
    </div>
  )
}
