import { Alert, Card, Collapse, Descriptions, Image, Space, Tag, Typography } from 'antd'
import type { ImageSearchSnapshot } from '@/api/pest-atlas'

type Attempt = { attemptId: string; snapshot: ImageSearchSnapshot; createdAt: string }
export default function PestImageEvidence({ snapshot, attempts = [] }: { snapshot?: ImageSearchSnapshot; attempts?: Attempt[] }): JSX.Element {
  const current = snapshot ?? attempts[attempts.length - 1]?.snapshot
  if (!current) return <Alert type="info" message="暂无病斑图片检索快照" description="病例生成于图片检索接入前，旧病例不会自动补检索。" />
  return <Card size="small" title="病斑图片检索证据" extra={<Tag color={current.status === 'MATCHED' ? 'green' : 'orange'}>{current.status === 'MATCHED' ? `候选 ${current.references.length} 条` : '无匹配样本'}</Tag>}>
    <Typography.Paragraph type="secondary">{current.notice} · 方法：{current.method}</Typography.Paragraph>
    {!current.references.length && <Alert showIcon type="warning" message="当前作物暂无已发布病斑样本命中" description="这不代表没有病虫害；请结合结构化图谱、现场症状和人工核验。" />}
    <Collapse items={current.references.map((ref, i) => ({ key: ref.sampleId, label: <Space wrap><Typography.Text strong>{i + 1}. {ref.cropName} · {ref.diseaseName}</Typography.Text><Tag color={i === 0 ? 'green' : 'default'}>相似度 {Math.round(ref.similarity * 100)}%</Tag><Tag>距离 {ref.distance}</Tag></Space>, children: <Space direction="vertical" style={{ width: '100%' }}><Image src={ref.imageUrl} width={180} height={130} style={{ objectFit: 'cover' }} /><Descriptions size="small" column={1} items={[{ key: 'source', label: '来源', children: `${ref.source} · ${ref.sourceVersion}` }, { key: 'ref', label: '出处', children: ref.sourceRef }, { key: 'id', label: '样本 / 图谱版本', children: `${ref.sampleId} · ${ref.atlasId}@${ref.revision}` }]} /></Space> }))} />
    {attempts.length > 1 && <Typography.Text type="secondary">本病例共有 {attempts.length} 次诊断尝试，以上为最近一次图片检索结果。</Typography.Text>}
  </Card>
}
