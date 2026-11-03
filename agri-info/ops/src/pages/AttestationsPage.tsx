import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { Attestation, AttestationsAdmin } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag } from '../components/ui'

/** 存证管理：内容审核通过后可发起上链，存证编号供用户端公开验真。 */
export function AttestationsPage(): JSX.Element {
  const [data, setData] = useState<AttestationsAdmin | null>(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Attestation | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm<Record<string, unknown>>()

  const load = (): void => {
    setError('')
    opsApi.attestations().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const columns: ColumnsType<Attestation> = [
    {
      title: '存证内容',
      dataIndex: 'title',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.title}</b>
          <span className="small muted">{record.attestNo} · {record.contentType === 'report' ? '研究报告' : record.contentType === 'quote' ? '行情数据' : '资讯内容'}</span>
        </div>
      ),
    },
    { title: '链', dataIndex: 'chainName', width: 110 },
    { title: '区块高度', dataIndex: 'blockHeight', width: 120 },
    { title: '上链时间', dataIndex: 'attestedAt', width: 150 },
    { title: '验真', dataIndex: 'verifyCount', width: 90 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <StatusTag status={value} /> },
    { title: '操作', width: 90, render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>查看</Button> },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="ATTESTATION"
        title="存证管理"
        description="关键内容上链存证，任何第三方可凭存证编号在线验真 · 哈希在平台内计算，原文不出平台"
        actions={<Button type="primary" onClick={() => { form.resetFields(); setCreateOpen(true) }}>＋ 发起存证</Button>}
      />

      <div className="grid-4">
        <StatTile label="存证总量" value={data.stats.total} unit="条" />
        <StatTile label="已确认" value={data.stats.confirmed} unit="条" note="链上多节点共识" tone="up" />
        <StatTile label="累计验真" value={data.stats.verified} unit="次" note="含第三方验证" />
        <StatTile label="存证链" value={data.stats.chain} note="联盟链" />
      </div>

      <section className="surface-card">
        <SectionHeading kicker="LEDGER" title="存证清单" />
        <Table rowKey="id" size="middle" columns={columns} dataSource={data.items} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </section>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={560} title={detail?.attestNo ?? ''}>
        {detail && (
          <div className="stack">
            <b>{detail.title}</b>
            <div className="row" style={{ gap: 8 }}>
              <Tag className="soft-tag">{detail.contentType}</Tag>
              <StatusTag status={detail.status} />
            </div>
            <div className="kv-list">
              <div className="kv"><span>关联内容 ID</span><b>{detail.contentId}</b></div>
              <div className="kv"><span>存证链</span><b>{detail.chainName}</b></div>
              <div className="kv"><span>区块高度</span><b>{detail.blockHeight}</b></div>
              <div className="kv"><span>上链时间</span><b>{detail.attestedAt}</b></div>
              <div className="kv"><span>存证主体</span><b>{detail.owner}</b></div>
              <div className="kv"><span>验真次数</span><b>{detail.verifyCount}</b></div>
            </div>
            <div>
              <p className="small muted">内容哈希（SHA-256）</p>
              <p className="hash-box">{detail.contentHash}</p>
            </div>
            <div>
              <p className="small muted">交易 ID</p>
              <p className="hash-box">{detail.txId}</p>
            </div>
            <Button onClick={() => message.success('存证编号已复制，可发送给第三方验真')}>复制存证编号</Button>
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        title="发起内容存证"
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="提交上链"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ contentType: 'article', contentId: 1 }}
          onFinish={(values) => {
            opsApi.createAttestation(values)
              .then((result) => {
                message.success(`${result.message}：${result.attestNo}`)
                setCreateOpen(false)
                form.resetFields()
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <Form.Item name="title" label="存证标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="例：大蒜价格周度分析：库存收紧支撑价格上行" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="contentType" label="内容类型" rules={[{ required: true }]}>
              <Select options={[
                { value: 'article', label: '资讯内容' },
                { value: 'report', label: '研究报告' },
                { value: 'quote', label: '行情数据' },
              ]} />
            </Form.Item>
            <Form.Item name="contentId" label="关联内容 ID" rules={[{ required: true, message: '请填写内容 ID' }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
