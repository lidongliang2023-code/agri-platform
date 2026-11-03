import { useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { Author, Channel } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag, formatCount } from '../components/ui'

const AUTHOR_TYPES: Record<string, string> = {
  official: '官方',
  expert: '专家',
  media: '媒体',
  enterprise: '企业',
  user: '用户',
}

/** 栏目与作者：栏目决定用户端资讯频道分组，作者决定内容可信度标识。 */
export function ChannelsPage(): JSX.Element {
  const [data, setData] = useState<{ channels: Channel[]; authors: Author[] } | null>(null)
  const [error, setError] = useState('')
  const [channelOpen, setChannelOpen] = useState(false)
  const [editing, setEditing] = useState<Channel | null>(null)
  const [form] = Form.useForm<Record<string, unknown>>()

  const load = (): void => {
    setError('')
    opsApi.channels().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const openChannel = (channel?: Channel): void => {
    setEditing(channel ?? null)
    form.setFieldsValue(channel
      ? { name: channel.name, icon: channel.icon, description: channel.description, status: channel.status }
      : { name: '', icon: '📰', description: '', status: 'enabled' })
    setChannelOpen(true)
  }

  const channelColumns: ColumnsType<Channel> = [
    {
      title: '栏目',
      dataIndex: 'name',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.icon} {record.name}</b>
          <span className="small muted">{record.code}</span>
        </div>
      ),
    },
    { title: '说明', dataIndex: 'description' },
    { title: '内容量', dataIndex: 'articleCount', width: 100, render: (value: number) => formatCount(value) },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    {
      title: '操作',
      width: 90,
      render: (_, record) => <Button size="small" onClick={() => openChannel(record)}>编辑</Button>,
    },
  ]

  const authorColumns: ColumnsType<Author> = [
    {
      title: '作者',
      dataIndex: 'name',
      render: (_, record) => (
        <div className="row" style={{ gap: 8 }}>
          <span className="expert-avatar">{record.avatarText || record.name.slice(0, 1)}</span>
          <div className="table-title-cell">
            <b>{record.name}</b>
            <span className="small muted">{record.title} · {record.orgName}</span>
          </div>
        </div>
      ),
    },
    { title: '类型', dataIndex: 'authorType', width: 90, render: (value: string) => <Tag className="soft-tag">{AUTHOR_TYPES[value] ?? value}</Tag> },
    { title: '发文', dataIndex: 'articleCount', width: 80 },
    { title: '关注', dataIndex: 'followers', width: 90, render: (value: number) => formatCount(value) },
    {
      title: '认证',
      dataIndex: 'verified',
      width: 100,
      render: (value: boolean, record) => (
        <Switch
          size="small"
          checked={value}
          checkedChildren="已认证"
          unCheckedChildren="未认证"
          onChange={(checked) => opsApi.updateAuthor(record.id, { verified: checked })
            .then((result) => {
              message.success(result.message)
              setData((previous) => previous ? { ...previous, authors: result.authors as Author[] } : previous)
            })
            .catch((reason: Error) => message.error(reason.message))}
        />
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CHANNELS & AUTHORS"
        title="栏目与作者"
        description="栏目决定资讯频道结构与推荐位归属；作者认证标识直接影响用户端内容可信度展示"
        actions={<Button type="primary" onClick={() => openChannel()}>＋ 新建栏目</Button>}
      />

      <div className="grid-4">
        <StatTile label="栏目数" value={data.channels.length} unit="个" note={`启用 ${data.channels.filter((item) => item.status === 'enabled').length} 个`} />
        <StatTile label="栏目内容量" value={formatCount(data.channels.reduce((sum, item) => sum + item.articleCount, 0))} unit="篇" note="全栏目合计" tone="up" />
        <StatTile label="作者数" value={data.authors.length} unit="位" note={`已认证 ${data.authors.filter((item) => item.verified).length} 位`} />
        <StatTile label="作者关注量" value={formatCount(data.authors.reduce((sum, item) => sum + item.followers, 0))} unit="人" note="累计关注" />
      </div>

      <section className="surface-card">
        <SectionHeading kicker="CHANNELS" title="栏目管理" />
        <Table rowKey="id" size="middle" columns={channelColumns} dataSource={data.channels} pagination={false} />
      </section>

      <section className="surface-card">
        <SectionHeading kicker="AUTHORS" title="作者管理" />
        <Table rowKey="id" size="middle" columns={authorColumns} dataSource={data.authors} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </section>

      <Modal
        open={channelOpen}
        title={editing ? '编辑栏目' : '新建栏目'}
        onCancel={() => setChannelOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            opsApi.saveChannel({ ...values, id: editing?.id })
              .then((result) => {
                message.success(result.message)
                setChannelOpen(false)
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <div className="form-grid">
            <Form.Item name="name" label="栏目名称" rules={[{ required: true, message: '请填写栏目名称' }]}>
              <Input placeholder="例：市场动态" />
            </Form.Item>
            <Form.Item name="icon" label="图标（emoji）" rules={[{ required: true }]}>
              <Input placeholder="例：📈" />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]} />
            </Form.Item>
            <Form.Item name="sortNo" label="排序号">
              <InputNumber style={{ width: '100%' }} min={1} max={99} placeholder="数字越小越靠前" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="栏目说明">
            <Input.TextArea rows={3} maxLength={80} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
