import { useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { RecommendAdmin, RecommendItem, RecommendSlot, SensitiveWord } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag } from '../components/ui'

/**
 * 推荐与推送：推荐位策略与敏感词库共同决定用户端首屏内容，
 * 策略调整立即生效，因此每次改动都写审计日志。
 */
export function RecommendPage(): JSX.Element {
  const [data, setData] = useState<RecommendAdmin | null>(null)
  const [error, setError] = useState('')
  const [slotTarget, setSlotTarget] = useState<RecommendSlot | null>(null)
  const [wordOpen, setWordOpen] = useState(false)
  const [slotForm] = Form.useForm<{ strategyName: string; itemCount: number; status: string }>()
  // 内容编排：门户首页展示哪几条由运营指定
  const [curateTarget, setCurateTarget] = useState<RecommendSlot | null>(null)
  const [curateIds, setCurateIds] = useState<number[]>([])
  const [articleOptions, setArticleOptions] = useState<Array<{ label: string; value: number }>>([])
  const [curating, setCurating] = useState(false)
  const [wordForm] = Form.useForm<Record<string, unknown>>()

  const load = (): void => {
    setError('')
    opsApi.recommend().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const openCurate = (slot: RecommendSlot): void => {
    setCurateTarget(slot)
    setCurateIds([])
    setArticleOptions([])
    void Promise.all([
      opsApi.recommendItems(slot.id),
      opsApi.contents({ status: 'published' }),
    ])
      .then(([items, contents]) => {
        const list = items as RecommendItem[]
        setCurateIds(list.map((item) => item.contentId))
        setArticleOptions((contents.items ?? []).map((article) => ({
          value: article.id,
          label: `[${article.channel}] ${article.title}`,
        })))
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  const saveCurate = (): void => {
    if (!curateTarget) return
    setCurating(true)
    opsApi.saveRecommendItems(curateTarget.id, curateIds)
      .then((result) => {
        message.success(result.message)
        setCurateTarget(null)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setCurating(false))
  }

  const slotColumns: ColumnsType<RecommendSlot> = [
    {
      title: '推荐位',
      dataIndex: 'slotName',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.slotName}</b>
          <span className="small muted">{record.positionName}</span>
        </div>
      ),
    },
    { title: '策略', dataIndex: 'strategyName', width: 260 },
    { title: '条数', dataIndex: 'itemCount', width: 80 },
    { title: 'CTR', dataIndex: 'ctr', width: 90, render: (value: number) => `${Number(value).toFixed(2)}%` },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" onClick={() => {
            setSlotTarget(record)
            slotForm.setFieldsValue({ strategyName: record.strategyName, itemCount: record.itemCount, status: record.status })
          }}>
            调整
          </Button>
          <Button size="small" type="primary" ghost onClick={() => openCurate(record)}>编排内容</Button>
        </Space>
      ),
    },
  ]

  const wordColumns: ColumnsType<SensitiveWord> = [
    { title: '敏感词', dataIndex: 'word', render: (value: string) => <b>{value}</b> },
    {
      title: '级别',
      dataIndex: 'level',
      width: 100,
      render: (value: string) => (
        <Tag className={`soft-tag tone-${value === 'high' ? 'up' : value === 'medium' ? 'amber' : 'default'}`}>
          {value === 'high' ? '高' : value === 'medium' ? '中' : '低'}
        </Tag>
      ),
    },
    { title: '处置', dataIndex: 'action', width: 120 },
    { title: '命中', dataIndex: 'hitCount', width: 80 },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button size="small" onClick={() => {
          wordForm.setFieldsValue({ id: record.id, word: record.word, level: record.level, action: record.action, status: record.status })
          setWordOpen(true)
        }}>
          编辑
        </Button>
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="RECOMMENDATION"
        title="推荐与推送"
        description="推荐位策略、敏感词库与预警推送统一维护 · 策略变更实时生效，敏感词命中会自动降级为人工复核"
        actions={<Button type="primary" onClick={() => { wordForm.resetFields(); setWordOpen(true) }}>＋ 新增敏感词</Button>}
      />

      <div className="grid-4">
        <StatTile label="推荐位" value={data.slots.length} unit="个" note={`在线 ${data.slots.filter((item) => item.status === 'online').length} 个`} />
        <StatTile
          label="平均 CTR"
          value={(data.slots.reduce((sum, item) => sum + item.ctr, 0) / Math.max(data.slots.length, 1)).toFixed(2)}
          unit="%"
          note="近 7 日均值"
          tone="up"
        />
        <StatTile label="敏感词" value={data.sensitiveWords.length} unit="条" note={`启用 ${data.sensitiveWords.filter((item) => item.status === 'enabled').length} 条`} />
        <StatTile label="推送记录" value={data.pushRecords.length} unit="条" note="价格预警触达" tone="warn" />
      </div>

      <section className="surface-card">
        <SectionHeading kicker="SLOTS" title="推荐位策略" />
        <Table rowKey="id" size="middle" columns={slotColumns} dataSource={data.slots} pagination={false} />
      </section>

      <section className="surface-card">
        <SectionHeading kicker="SENSITIVE WORDS" title="敏感词库" />
        <Table rowKey="id" size="middle" columns={wordColumns} dataSource={data.sensitiveWords} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </section>

      <section className="surface-card">
        <SectionHeading kicker="PUSH RECORDS" title="推送记录" />
        <Table
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 6, showSizeChanger: false }}
          dataSource={data.pushRecords}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '品种', dataIndex: 'quoteName', width: 140 },
            { title: '触发值', dataIndex: 'triggerValue', width: 110 },
            {
              title: '级别',
              dataIndex: 'level',
              width: 90,
              render: (value: string) => <Tag className={`soft-tag tone-${value === 'high' ? 'up' : 'amber'}`}>{value === 'high' ? '高' : '中'}</Tag>,
            },
            { title: '时间', dataIndex: 'createdAt', width: 150 },
          ]}
        />
      </section>

      <Modal
        open={Boolean(slotTarget)}
        title={`调整推荐位：${slotTarget?.slotName ?? ''}`}
        onCancel={() => setSlotTarget(null)}
        onOk={() => slotForm.submit()}
        okText="保存"
      >
        <Form
          form={slotForm}
          layout="vertical"
          onFinish={(values) => {
            if (!slotTarget) return
            opsApi.saveSlot(slotTarget.id, values)
              .then((result) => {
                message.success(result.message)
                setSlotTarget(null)
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <Form.Item name="strategyName" label="推荐策略" rules={[{ required: true, message: '请填写策略' }]}>
            <Input placeholder="例：实时意图感知 + DIN 多目标" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="itemCount" label="展示条数" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} max={20} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={[{ value: 'online', label: '上线' }, { value: 'offline', label: '下线' }]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        open={Boolean(curateTarget)}
        title={`编排内容：${curateTarget?.slotName ?? ''}`}
        onCancel={() => setCurateTarget(null)}
        onOk={saveCurate}
        confirmLoading={curating}
        okText="保存并生效"
        width={680}
      >
        <p className="small muted" style={{ marginBottom: 12 }}>
          选中的内容按「选择顺序」展示在门户对应位置；全部清空则门户回退为按发布时间排序。
        </p>
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="搜索并选择要推荐的文章"
          value={curateIds}
          onChange={(values) => setCurateIds(values as number[])}
          options={articleOptions}
        />
        {curateIds.length > 0 && (
          <ol className="small" style={{ marginTop: 14, paddingLeft: 20, lineHeight: 1.9 }}>
            {curateIds.map((id) => (
              <li key={id}>{articleOptions.find((item) => item.value === id)?.label ?? `#${id}`}</li>
            ))}
          </ol>
        )}
        {curateIds.length === 0 && (
          <p className="small muted" style={{ marginTop: 12 }}>当前未选择任何内容。</p>
        )}
      </Modal>

      <Modal
        open={wordOpen}
        title="敏感词维护"
        onCancel={() => setWordOpen(false)}
        onOk={() => wordForm.submit()}
        okText="保存"
      >
        <Form
          form={wordForm}
          layout="vertical"
          initialValues={{ level: 'medium', action: '人工复核', status: 'enabled' }}
          onFinish={(values) => {
            opsApi.saveSensitiveWord(values)
              .then((result) => {
                message.success(result.message)
                setWordOpen(false)
                wordForm.resetFields()
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <Form.Item name="word" label="敏感词" rules={[{ required: true, message: '请填写敏感词' }]}>
            <Input placeholder="例：绝对增产" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="level" label="级别" rules={[{ required: true }]}>
              <Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} />
            </Form.Item>
            <Form.Item name="action" label="处置方式" rules={[{ required: true }]}>
              <Select options={['人工复核', '直接拦截', '仅记录'].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
