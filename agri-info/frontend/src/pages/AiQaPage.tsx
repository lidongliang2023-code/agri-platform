import { useEffect, useRef, useState } from 'react'
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Input, Select, Tag, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { AiAnswer, QaRecord } from '../types'
import { AiCard, EmptyState, PageTitle, SectionHeading } from '../components/ui'

interface Turn {
  id: string
  role: 'user' | 'ai'
  text: string
  answer?: AiAnswer
  createdAt: string
}

const CROPS = ['', '大蒜', '辣椒', '西红柿', '水稻', '小麦', '玉米', '苹果', '番茄', '黄瓜', '草莓']
const PRESETS = [
  '大蒜叶片从叶尖开始干枯是什么病？',
  '水稻分蘖期需要施多少氮肥？',
  '番茄叶片发黄是缺钾还是缺镁？',
  '辣椒落花落果怎么处理？',
]

/**
 * AI 农技问答：答案全部来自平台知识库检索（二元组重叠打分），
 * 因此每条回答都带来源引用；检索不到时如实提示而不是编造。
 */
export function AiQaPage(): JSX.Element {
  const { navigate } = useApp()
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [crop, setCrop] = useState('')
  const [asking, setAsking] = useState(false)
  const [records, setRecords] = useState<QaRecord[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadRecords = (): void => {
    infoApi.qaRecords().then(setRecords).catch(() => setRecords([]))
  }

  useEffect(loadRecords, [])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns])

  const ask = (text: string): void => {
    const content = text.trim()
    if (!content) return
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    setTurns((previous) => [...previous, { id: `u-${Date.now()}`, role: 'user', text: content, createdAt: now }])
    setQuestion('')
    setAsking(true)
    infoApi.askAi({ question: content, crop: crop || undefined })
      .then((answer) => {
        setTurns((previous) => [...previous, {
          id: `a-${Date.now()}`,
          role: 'ai',
          text: answer.answer,
          answer,
          createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        }])
        loadRecords()
      })
      .catch((reason: Error) => {
        message.error(reason.message)
        setTurns((previous) => [...previous, {
          id: `e-${Date.now()}`, role: 'ai', text: `抱歉，服务暂时不可用：${reason.message}`, createdAt: now,
        }])
      })
      .finally(() => setAsking(false))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AI ASSISTANT"
        title="AI 农技问答"
        description="基于平台知识库与专家问答记录检索作答，回答附带来源引用与置信度 · 疑难问题可一键转人工专家"
        actions={<Button onClick={() => navigate('pest')}>📷 拍照识病虫</Button>}
      />

      <div className="grid-main-aside">
        <section className="surface-card">
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <span className="small muted">作物上下文</span>
            <Select
              style={{ width: 160 }}
              value={crop}
              onChange={setCrop}
              options={CROPS.map((item) => ({ value: item, label: item || '不限作物' }))}
            />
            <span className="small muted">选定作物可显著提升检索命中率</span>
          </div>

          <div className="chat-window tall">
            {turns.length === 0 && (
              <EmptyState
                icon="🌾"
                title="问点什么吧"
                description="例如：大蒜叶枯病怎么防治？水稻分蘖期施多少氮肥？"
              />
            )}
            {turns.map((turn) => (
              <div className={`chat-item ${turn.role === 'user' ? 'out' : 'in'}`} key={turn.id}>
                <span className="chat-avatar">{turn.role === 'user' ? <UserOutlined /> : <RobotOutlined />}</span>
                <div className="chat-content">
                  <div className="chat-meta">
                    <b>{turn.role === 'user' ? '我' : 'AI 农技助手'}</b>
                    <span>{turn.createdAt}</span>
                  </div>
                  <div className="chat-msg">{turn.text}</div>
                  {turn.answer && (
                    <div className="chat-extras">
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <Tag className="soft-tag tone-green">置信度 {turn.answer.confidence}%</Tag>
                        <Tag className="soft-tag">{turn.answer.category}</Tag>
                        <Tag className="soft-tag">编号 {turn.answer.qaNo}</Tag>
                      </div>
                      {turn.answer.sourceRefs.length > 0 && (
                        <p className="small muted">来源：{turn.answer.sourceRefs.join('、')}</p>
                      )}
                      {turn.answer.related.length > 0 && (
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {turn.answer.related.map((item) => (
                            <button type="button" key={item.id} className="chip" onClick={() => navigate('knowledge', item.id)}>
                              {item.title}
                            </button>
                          ))}
                        </div>
                      )}
                      {turn.answer.expertAvailable && (
                        <Button size="small" onClick={() => navigate('expert')}>转人工专家</Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="chat-item in">
                <span className="chat-avatar"><RobotOutlined /></span>
                <div className="chat-content">
                  <div className="chat-msg typing">正在检索知识库…</div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <Input.TextArea
              rows={2}
              maxLength={200}
              value={question}
              placeholder="描述您的种植问题，越具体越准确（作物 + 症状 + 发生时间）"
              onChange={(event) => setQuestion(event.target.value)}
              onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); ask(question) } }}
            />
            <Button type="primary" icon={<SendOutlined />} loading={asking} onClick={() => ask(question)}>提问</Button>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {PRESETS.map((preset) => (
              <button type="button" key={preset} className="chip" onClick={() => ask(preset)}>{preset}</button>
            ))}
          </div>
        </section>

        <div className="stack">
          <AiCard title="AI 能力边界" confidence={92}>
            平台 AI 只基于已审核的农技知识与历史专家问答作答，不臆造药剂用量；涉及用药剂量时，请以产品标签与当地植保站指导为准。
          </AiCard>

          <section className="surface-card">
            <SectionHeading kicker="HISTORY" title="我的提问记录" />
            {records.length === 0 && <p className="muted small">还没有提问记录。</p>}
            <div className="stack" style={{ gap: 10 }}>
              {records.slice(0, 8).map((record) => (
                <div className="surface-card flat" key={record.id}>
                  <div className="row between">
                    <b style={{ fontSize: 13 }}>{record.question}</b>
                    <Tag className="soft-tag">{record.qaType === 'pest' ? '病虫识别' : '问答'}</Tag>
                  </div>
                  <p className="small muted" style={{ marginTop: 6 }}>{record.answer.slice(0, 60)}…</p>
                  <p className="small muted">{record.crop || '不限作物'} · {record.createdAt} · 置信度 {record.confidence}%</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
