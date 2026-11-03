import { useState } from 'react'
import {
  CheckCircleFilled,
  MessageOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { App, Button, Input, Select } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { DiagnoseResult } from '../types'
import { PageTitle } from '../components/ui'

export function AiDiagnosePage(): JSX.Element {
  const { navigate } = useApp()
  const { message } = App.useApp()
  const [subject, setSubject] = useState('')
  const [crop, setCrop] = useState('水稻')
  const [content, setContent] = useState('')
  const [result, setResult] = useState<DiagnoseResult | null>(null)
  const [loading, setLoading] = useState(false)

  const diagnose = async (): Promise<void> => {
    if (!content.trim()) {
      message.warning('请先描述症状')
      return
    }
    setLoading(true)
    try {
      const diagnosis = await serviceApi.diagnose({
        subject: subject.trim() || `${crop}田间问题`,
        crop,
        content,
      })
      setResult(diagnosis)
      message.success(`初判完成（${diagnosis.consultNo}），已存入问诊记录`)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '初判失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="RULE-BASED TRIAGE"
        title="农事问题初判"
        description="按症状关键词比对平台内置的常见病虫害处置规则，给出风险等级、候选病因与下一步建议；结论写入你的问诊记录，可随时转专家复核。"
        actions={<span className="ai-live-badge"><i /> 规则引擎在线</span>}
      />

      <div className="diagnose-layout">
        <section className="surface-card diagnose-input-card">
          <div className="section-heading compact">
            <div><span className="section-kicker">NEW TRIAGE</span><h2>描述您遇到的问题</h2></div>
            <span className="ai-chip"><RobotOutlined /> 文字初判</span>
          </div>
          <label className="field-label">作物 / 品种</label>
          <div className="form-grid-2">
            <Select value={crop} onChange={setCrop} options={['水稻', '油菜', '柑橘', '蔬菜', '生猪', '家禽'].map((value) => ({ value, label: value }))} />
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="问题主题，如：晚稻叶片红褐色斑点" />
          </div>
          <label className="field-label">症状描述</label>
          <Input.TextArea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            placeholder="写明发病部位与颜色、出现时间、发生面积、近期天气与用药——这些关键词直接决定初判结果"
          />
          <div className="quick-prompts">
            {['叶片出现红褐色斑点', '根部腐烂', '植株大面积黄化', '发现虫害', '畜禽连续死亡'].map((prompt) => (
              <button type="button" key={prompt} onClick={() => setContent((value) => (value ? `${value}\n${prompt}` : prompt))}>{prompt}</button>
            ))}
          </div>
          <Button type="primary" size="large" block icon={<ThunderboltOutlined />} loading={loading} onClick={() => void diagnose()}>开始初判</Button>
          <p className="ai-disclaimer"><SafetyCertificateOutlined /> 本版没有接入拍照与视频识别，只依据文字关键词匹配规则；描述越具体，候选病因越贴近。</p>
        </section>

        <section className="diagnose-result-card">
          {!result ? (
            <div className="diagnose-empty">
              <span><RobotOutlined /></span>
              <h3>等待症状信息</h3>
              <p>提交后你会拿到风险等级、命中的候选病因，以及是否需要转专家复核。</p>
              <div>
                <small><CheckCircleFilled /> 每次初判都会生成一条问诊记录</small>
                <small><CheckCircleFilled /> 命中关键词才会给出候选病因，否则提示补充信息</small>
                <small><CheckCircleFilled /> 可一键转到专家问诊</small>
              </div>
            </div>
          ) : (
            <div className="diagnose-result">
              <div className="diagnose-result-head">
                <span><RobotOutlined /></span>
                <div><small>初判结果 · {result.consultNo}</small><h2>{result.level}</h2></div>
                <em>{result.matchedDiseases.length > 0 ? `命中 ${result.matchedDiseases.length} 个候选` : '信息不足'}</em>
              </div>
              {result.matchedDiseases.length > 0 && (
                <div className="matched-tags">{result.matchedDiseases.map((item) => <span key={item}>{item}</span>)}</div>
              )}
              <div className="diagnose-suggestion"><b>处置建议</b><p>{result.suggestion}</p></div>
              <div className="diagnose-actions">
                <Button type="primary" disabled={!result.expertAvailable} onClick={() => navigate('consult')}>
                  {result.expertAvailable ? `转农技专家复核（在册 ${result.expertCount} 位）` : '当前无在册专家'}
                </Button>
                <Button onClick={() => navigate('services')}>预约植保服务</Button>
                <Button icon={<MessageOutlined />} onClick={() => navigate('consult')}>查看问诊记录</Button>
              </div>
              <div className="diagnose-warning">规则初判不能替代农技专家或执业兽医的现场诊断。如出现大面积扩散、畜禽连续死亡，请及时隔离并联系当地农业部门。</div>
            </div>
          )}
        </section>
      </div>

      <section className="surface-card detail-section">
        <div className="section-heading compact">
          <div><span className="section-kicker">RULE COVERAGE</span><h2>规则库现在能判什么</h2></div>
          <span className="section-note">按关键词命中，未命中会提示补充信息</span>
        </div>
        <div className="capability-grid">
          <div><span>🌾</span><b>叶部病斑</b><small>含「斑点/褐」→ 稻瘟病、胡麻斑病、细菌性条斑病候选</small></div>
          <div><span>🐛</span><b>虫害迹象</b><small>含「虫/飞」→ 虫量统计与飞防处置建议</small></div>
          <div><span>🍂</span><b>黄化萎蔫</b><small>含「黄/萎」→ 积水、根系损伤与缺素三类排查</small></div>
          <div><span>⚠️</span><b>高风险升级</b><small>含「死亡/大面积/枯萎」→ 直接标高风险并建议转专家</small></div>
        </div>
      </section>
    </div>
  )
}
