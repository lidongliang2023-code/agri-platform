import { useState } from 'react'
import { CameraOutlined } from '@ant-design/icons'
import { Button, Input, Progress, Select, Tag, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { PestResult } from '../types'
import { AiCard, EmptyState, PageTitle, SectionHeading } from '../components/ui'

const CROPS = ['大蒜', '辣椒', '西红柿', '水稻', '小麦', '玉米', '苹果', '番茄', '黄瓜', '草莓']
const SYMPTOM_PRESETS = [
  '叶片出现褐色斑点并逐渐扩大',
  '叶片从叶尖向基部干枯，背面有黑色霉层',
  '植株矮化，新叶卷曲发黄',
  '果实表面出现水渍状凹陷斑',
  '根部发黑，拔起有异味',
]

/**
 * 拍照识病虫：原型以症状描述替代真实图像上传，后端返回候选病虫害与概率排序，
 * 明确提示「先小范围验证再全田用药」，避免误判造成药害。
 */
export function PestPage(): JSX.Element {
  const { navigate } = useApp()
  const [crop, setCrop] = useState('大蒜')
  const [symptom, setSymptom] = useState('')
  const [result, setResult] = useState<PestResult | null>(null)
  const [loading, setLoading] = useState(false)

  const identify = (): void => {
    if (!symptom.trim()) { message.warning('请先描述症状'); return }
    setLoading(true)
    infoApi.pestIdentify({ crop, symptom: symptom.trim() })
      .then(setResult)
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="PEST & DISEASE"
        title="拍照识病虫"
        description="上传病叶照片或描述症状，AI 给出候选病虫害与概率排序及防治建议 · 识别结果仅供参考，用药前请复核"
        actions={<Button onClick={() => navigate('ai-qa')}>去 AI 问答</Button>}
      />

      <div className="grid-main-aside">
        <section className="surface-card">
          <SectionHeading kicker="INPUT" title="描述症状" />
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <span className="small muted">作物</span>
            <Select style={{ width: 160 }} value={crop} onChange={setCrop} options={CROPS.map((item) => ({ value: item, label: item }))} />
          </div>

          <div className="upload-zone" onClick={() => message.info('演示环境使用文字描述替代图片上传，正式版接入图像识别服务')}>
            <CameraOutlined />
            <strong>点击上传病叶照片</strong>
            <span className="small muted">支持 jpg / png，单张不超过 5MB（演示环境以症状描述代替）</span>
          </div>

          <Input.TextArea
            rows={4}
            maxLength={200}
            showCount
            style={{ marginTop: 12 }}
            value={symptom}
            placeholder="例：大蒜叶片从叶尖开始干枯，湿度大时病部有黑色霉层，近一周连阴雨"
            onChange={(event) => setSymptom(event.target.value)}
          />

          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {SYMPTOM_PRESETS.map((preset) => (
              <button type="button" key={preset} className="chip" onClick={() => setSymptom(preset)}>{preset}</button>
            ))}
          </div>

          <Button type="primary" loading={loading} style={{ marginTop: 14 }} onClick={identify}>
            开始识别
          </Button>

          {result && (
            <div style={{ marginTop: 20 }}>
              <SectionHeading kicker="RESULT" title="识别结果" />
              <div className="stack" style={{ gap: 10 }}>
                {result.candidates.map((item, index) => (
                  <div className="surface-card flat" key={item.name}>
                    <div className="row between">
                      <b style={{ fontSize: 13 }}>
                        {index === 0 && <Tag className="soft-tag tone-up">最可能</Tag>} {item.name}
                      </b>
                      <b className="small">{item.probability}%</b>
                    </div>
                    <Progress percent={item.probability} showInfo={false} strokeColor={index === 0 ? '#c62828' : '#12764a'} />
                    <p className="small muted" style={{ marginTop: 6 }}>{item.note}</p>
                  </div>
                ))}
              </div>

              <AiCard title="防治建议" confidence={result.candidates[0]?.probability ?? 0} actions={
                result.expertAvailable ? <Button size="small" onClick={() => navigate('expert')}>转人工专家复核</Button> : undefined
              }>
                {result.advice}
              </AiCard>

              <p className="source-note">
                识别编号 {result.qaNo} · 作物 {result.crop} · 结果已记入我的提问记录，可在 AI 问答页回看。
              </p>
            </div>
          )}

          {!result && (
            <EmptyState icon="🔬" title="等待识别" description="填写作物与症状后点击「开始识别」，通常 3 秒内返回结果。" />
          )}
        </section>

        <div className="stack">
          <section className="surface-card">
            <SectionHeading kicker="HOW IT WORKS" title="识别流程" />
            <ol className="step-list">
              <li><b>图像/症状归一</b>：把描述映射到知识库标准症状词表。</li>
              <li><b>候选检索</b>：按作物 + 症状匹配病虫害条目并计算相似度。</li>
              <li><b>概率排序</b>：输出 Top N 候选与置信度，避免单一结论误导。</li>
              <li><b>处置建议</b>：给出农业防治、生物防治、化学防治的优先顺序。</li>
            </ol>
          </section>

          <section className="surface-card">
            <SectionHeading kicker="SAFETY" title="用药提醒" />
            <ul className="safety-list">
              <li>先小范围试喷 24-48 小时，确认无药害后再全田使用。</li>
              <li>严格按标签剂量，不随意混配、加量。</li>
              <li>采收前注意安全间隔期，避免农残超标。</li>
              <li>连阴雨前后优先做好排水与通风，减少病害流行。</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
