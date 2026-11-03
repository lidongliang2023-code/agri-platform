import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { AiAdmin, Knowledge, QaRecord } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui'

/**
 * AI 知识库：AI 问答的答案完全来自这里的条目，因此内容质量直接决定问答可用性。
 * 编辑后立即影响检索结果，无需重启服务。
 */
export function AiPage(): JSX.Element {
  const [data, setData] = useState<AiAdmin | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [editing, setEditing] = useState<Knowledge | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [detail, setDetail] = useState<QaRecord | null>(null)
  const [form] = Form.useForm<Record<string, unknown>>()

  const load = (nextKeyword = keyword): void => {
    setKeyword(nextKeyword)
    setError('')
    opsApi.ai(nextKeyword || undefined).then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load('') }, [])

  const openEditor = (item?: Knowledge): void => {
    setEditing(item ?? null)
    form.setFieldsValue(item
      ? { title: item.title, category: item.category, crop: item.crop, summary: item.summary, content: item.content, tags: item.tags.join(','), sourceName: item.sourceName }
      : { category: '病虫害防治', crop: '通用', sourceName: '平台运营' })
    setEditorOpen(true)
  }

  const knowledgeColumns: ColumnsType<Knowledge> = [
    {
      title: '知识条目',
      dataIndex: 'title',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.title}</b>
          <span className="small muted">{record.category} · {record.crop} · {record.sourceName}</span>
        </div>
      ),
    },
    { title: '标签', dataIndex: 'tags', width: 220, render: (value: string[]) => value.slice(0, 3).map((tag) => <Tag className="soft-tag" key={tag}>{tag}</Tag>) },
    { title: '阅读', dataIndex: 'viewCount', width: 100, render: (value: number) => formatCount(value) },
    { title: '更新', dataIndex: 'updatedAt', width: 120 },
    { title: '操作', width: 90, render: (_, record) => <Button size="small" onClick={() => openEditor(record)}>编辑</Button> },
  ]

  const qaColumns: ColumnsType<QaRecord> = [
    {
      title: '问题',
      dataIndex: 'question',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.question}</b>
          <span className="small muted">{record.qaNo} · {record.askedBy} · {record.createdAt}</span>
        </div>
      ),
    },
    { title: '类型', dataIndex: 'qaType', width: 100, render: (value: string) => <Tag className="soft-tag">{value === 'pest' ? '病虫识别' : '问答'}</Tag> },
    { title: '作物', dataIndex: 'crop', width: 90 },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      render: (value: number) => <Tag className={`soft-tag tone-${value >= 90 ? 'green' : value >= 80 ? 'amber' : 'up'}`}>{value}%</Tag>,
    },
    { title: '操作', width: 90, render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>查看</Button> },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load()} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AI KNOWLEDGE BASE"
        title="AI 知识库"
        description="AI 问答与病虫识别的答案来源 · 条目需标注作物与分类，检索按二元组重叠度 + 作物命中加权"
        actions={<Button type="primary" onClick={() => openEditor()}>＋ 新增知识条目</Button>}
      />

      <div className="grid-4">
        <StatTile label="知识条目" value={data.stats.knowledgeCount} unit="条" note="全部已发布" tone="up" />
        <StatTile label="问答记录" value={formatCount(data.stats.qaCount)} unit="次" note="含病虫识别" />
        <StatTile label="平均置信度" value={data.stats.avgConfidence} unit="%" note="低于 80% 建议转人工" tone="warn" />
        <StatTile label="敏感词" value={data.stats.sensitiveCount} unit="条" note="与内容审核共用词库" />
      </div>

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <SectionHeading kicker="KNOWLEDGE" title="知识条目" />
          <Input.Search
            allowClear
            style={{ width: 240 }}
            placeholder="搜索标题 / 标签"
            defaultValue={keyword}
            onSearch={(value) => load(value.trim())}
          />
        </div>
        <Table rowKey="id" size="middle" columns={knowledgeColumns} dataSource={data.knowledge} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </section>

      <section className="surface-card">
        <SectionHeading kicker="Q&A LOGS" title="问答记录" />
        <Table rowKey="id" size="middle" columns={qaColumns} dataSource={data.qaPairs} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </section>

      <Modal
        open={editorOpen}
        title={editing ? '编辑知识条目' : '新增知识条目'}
        width={640}
        onCancel={() => setEditorOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            opsApi.saveKnowledge({ ...values, id: editing?.id })
              .then((result) => {
                message.success(result.message)
                setEditorOpen(false)
                form.resetFields()
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="例：大蒜叶枯病识别与防治" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select options={['病虫害防治', '营养管理', '采后处理', '栽培技术', '政策解读'].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="crop" label="作物" rules={[{ required: true }]}>
              <Input placeholder="例：大蒜 / 通用" />
            </Form.Item>
            <Form.Item name="sourceName" label="来源单位">
              <Input placeholder="例：省农科院蔬菜研究所" />
            </Form.Item>
            <Form.Item name="tags" label="标签（逗号分隔）">
              <Input placeholder="例：大蒜,叶枯病,真菌病害" />
            </Form.Item>
          </div>
          <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请填写摘要' }]}>
            <Input.TextArea rows={2} maxLength={120} showCount />
          </Form.Item>
          <Form.Item name="content" label="正文" rules={[{ required: true, message: '请填写正文' }]}>
            <Input.TextArea rows={7} placeholder="建议用【症状】【发病条件】【防治】等小标题分段，便于 AI 引用" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={540} title={detail?.question ?? ''}>
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag className="soft-tag">{detail.qaType === 'pest' ? '病虫识别' : '问答'}</Tag>
              <Tag className="soft-tag tone-green">置信度 {detail.confidence}%</Tag>
              <Tag className="soft-tag">{detail.crop}</Tag>
            </div>
            <SectionHeading kicker="ANSWER" title="AI 回答" />
            <p className="small">{detail.answer}</p>
            <SectionHeading kicker="SOURCE" title="引用来源" />
            <p className="small muted">{detail.sourceRefs || '—'}</p>
            <div className="kv-list">
              <div className="kv"><span>提问编号</span><b>{detail.qaNo}</b></div>
              <div className="kv"><span>提问人</span><b>{detail.askedBy}</b></div>
              <div className="kv"><span>时间</span><b>{detail.createdAt}</b></div>
            </div>
            <Button onClick={() => message.success('已标记为需补充知识条目，将进入运营待办')}>标记为知识缺口</Button>
          </div>
        )}
      </Drawer>
    </div>
  )
}
