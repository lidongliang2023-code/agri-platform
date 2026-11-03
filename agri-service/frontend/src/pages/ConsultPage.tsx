import { useEffect, useState } from 'react'
import {
  MessageOutlined,
  PhoneOutlined,
  RobotOutlined,
  StarFilled,
} from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Select } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Consultation, Expert } from '../types'
import { EmptyState, LoadingBlock, PageTitle, StatusTag } from '../components/ui'

export function ConsultPage(): JSX.Element {
  const { navigate } = useApp()
  const { message } = App.useApp()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [experts, setExperts] = useState<Expert[]>([])
  const [loading, setLoading] = useState(true)
  const [activeExpert, setActiveExpert] = useState<Expert | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const load = (): void => {
    setLoading(true)
    Promise.all([serviceApi.consultations(), serviceApi.experts()])
      .then(([history, roster]) => {
        setConsultations(history)
        setExperts(roster)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openConsult = (expert: Expert, type = '图文问诊'): void => {
    setActiveExpert(expert)
    form.setFieldsValue({ type, subject: '', content: '' })
  }

  const submit = async (): Promise<void> => {
    if (!activeExpert) return
    setSubmitting(true)
    try {
      const values = await form.validateFields()
      await serviceApi.createConsultation({ ...values, expertId: activeExpert.id })
      setActiveExpert(null)
      message.success('问诊已提交，专家接诊后会在消息中心通知')
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
        eyebrow="EXPERT CONSULTATION"
        title="农技 / 兽医专家问诊"
        description="AI 预诊先整理症状，专家再复核判断。支持图文、视频和预约上门。"
        actions={<Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('ai-diagnose')}>先让 AI 免费预诊</Button>}
      />

      <section className="consult-ai-banner">
        <span className="consult-ai-icon"><RobotOutlined /></span>
        <div><small>AI 农技助手 · 全天在线</small><h2>描述症状，先拿到风险等级与处置建议</h2><p>按关键词比对作物常见病害库，给出初步判断、匹配到的病害候选与是否需要专家复核。</p></div>
        <Button size="large" onClick={() => navigate('ai-diagnose')}>开始文字预诊</Button>
      </section>

      <div className="consult-layout">
        <section className="surface-card detail-section">
          <div className="section-heading compact">
            <div><span className="section-kicker">VERIFIED EXPERTS</span><h2>可接诊专家</h2></div>
            <span className="section-note">共 {experts.length} 位在册接诊</span>
          </div>
          {loading ? <LoadingBlock rows={2} /> : experts.length === 0 ? <EmptyState icon="👨‍🌾" title="当前没有可接诊专家" description="专家档案由平台维护，稍后再试" /> : (
            <div className="expert-list">
              {experts.map((expert) => (
                <article key={expert.id} className="expert-card">
                  <span className="expert-avatar">{expert.avatarIcon || expert.name.slice(0, 1)}</span>
                  <div className="expert-main">
                    <div><h3>{expert.name}<span>{expert.title}</span></h3><p>{expert.organization}</p></div>
                    <div className="expert-tags">{expert.serviceScope.split(',').filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <small><StarFilled /> {expert.rating} · 已接诊 {expert.consultCount} 次 · {expert.summary}</small>
                  </div>
                  <div className="expert-action">
                    <Button type="primary" ghost onClick={() => openConsult(expert)}>图文问诊</Button>
                    <Button size="small" onClick={() => openConsult(expert, '视频问诊')}>视频问诊</Button>
                    <Button size="small" onClick={() => openConsult(expert, '预约上门')}>预约上门</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="consult-aside">
          <div className="consult-process">
            <h3>问诊流程</h3>
            {['描述症状并上传照片', 'AI 预诊整理关键信息', '专家复核并给出方案', '按需预约上门服务'].map((step, index) => (
              <span key={step}><i>{index + 1}</i><b>{step}</b></span>
            ))}
          </div>
          <div className="surface-card consult-guarantee">
            <PhoneOutlined />
            <b>紧急情况建议直接致电</b>
            <p>大面积枯萎、畜禽急症或持续死亡，请优先联系本地兽医站并做好隔离。</p>
          </div>
        </aside>
      </div>

      <section className="surface-card detail-section">
        <div className="section-heading compact">
          <div><span className="section-kicker">CONSULTATION HISTORY</span><h2>我的问诊记录</h2></div>
        </div>
        {loading ? <LoadingBlock rows={2} /> : consultations.length === 0 ? <EmptyState icon="💬" title="暂无问诊记录" /> : (
          <div className="consult-history">
            {consultations.map((item) => (
              <article key={item.id}>
                <div className="consult-history-head">
                  <span><MessageOutlined /></span>
                  <div><b>{item.subject}</b><small>{item.consultNo} · {item.type} · {item.createdAt}</small></div>
                  <StatusTag status={item.status} labels={{ answered: { label: '已答复', tone: 'green' }, accepted: { label: '专家已接诊', tone: 'blue' }, closed: { label: '已结束', tone: 'gray' } }} />
                </div>
                <p>{item.suggestion}</p>
                <div><span>接诊：{item.expertName}</span><span>AI 判断：{item.aiLevel}</span></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal title={`向 ${activeExpert?.name ?? ''}（${activeExpert?.title ?? ''}）发起问诊`} open={Boolean(activeExpert)} onCancel={() => setActiveExpert(null)} onOk={() => void submit()} confirmLoading={submitting} okText="提交问诊" width={620}>
        <Form form={form} layout="vertical">
          <Form.Item label="问诊方式" name="type" initialValue="图文问诊">
            <Select options={[{ value: '图文问诊', label: '图文问诊 · 专家工作时间 2 小时内复核' }, { value: '视频问诊', label: '视频问诊 · 需与专家约定时段' }, { value: '预约上门', label: '预约专家上门' }]} />
          </Form.Item>
          <Form.Item label="问诊主题" name="subject" rules={[{ required: true, message: '请填写问诊主题' }]}><Input placeholder="如：晚稻叶片出现红褐色斑点" /></Form.Item>
          <Form.Item label="症状描述" name="content" rules={[{ required: true, message: '请描述症状' }]}>
            <Input.TextArea rows={6} placeholder="发病时间、面积、天气、近期用药以及作物当前阶段" />
          </Form.Item>
          <p className="form-hint">本版仅接收文字描述，照片与视频通道尚未开通；提交后结论会写入「我的问诊记录」和消息中心。</p>
        </Form>
      </Modal>
    </div>
  )
}
