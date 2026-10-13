import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, Modal, Radio, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { arbitrateDispute, getAdminDisputePage, mediateDispute } from '@/api/admin'
import { getCurrentUser } from '@/utils/session'

interface DisputeRow {
  id: number
  disputeNo: string
  orderId: number
  complainantName: string
  respondentName: string
  disputeType: string
  claimAmount: number
  disputeReason: string
  disputeStatus: string
  processStage: string
  mediator: string
  mediationResult: string
  arbitrator: string
  arbitrationResult: string
  createTime: string
}

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待受理', color: 'warning' },
  processing: { text: '处理中', color: 'processing' },
  resolved: { text: '已解决', color: 'success' },
  closed: { text: '已关闭', color: 'default' }
}

const STAGE: Record<string, string> = {
  // 新发起的纠纷停在 complain；了结后写 resolved —— 这两个原先都不在表里，
  // 页面上就把英文原文直接显示出来了。
  complain: '申请中',
  mediation: '调解中',
  arbitration: '仲裁中',
  resolved: '已了结',
  closed: '已关闭'
}

/** 纠纷类型（库里存的是英文枚举，表格里原先直接打印原文）。 */
const DISPUTE_TYPE: Record<string, string> = {
  quality: '质量不符',
  delay: '交付延误',
  delivery: '交付延误',
  quantity: '数量短缺',
  price: '价格争议',
  payment: '货款结算',
  other: '其他'
}

/**
 * 纠纷仲裁（运营端）。
 *
 * <p>消费大盘上的"待处理纠纷"件数：调解/仲裁结果都会落库并记下处理人与时间。
 * 调解未达成一致会自动转入仲裁阶段（这是后端既有语义），页面上照实说明，
 * 而不是让运营以为"点了调解就结案了"。</p>
 */
export default function AdminDispute() {
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // 默认看"未结"：与运营大盘上「待处理纠纷」的口径一致（pending + processing）。
  // 此前默认只看 processing，于是大盘说有几件、点进来只看到一部分。
  const [status, setStatus] = useState('open')
  const [keyword, setKeyword] = useState('')
  const [current, setCurrent] = useState<DisputeRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getAdminDisputePage({ pageNum, pageSize, disputeStatus: status || undefined, keyword: keyword || undefined })
      .then((res: { code: number; data?: { records?: DisputeRow[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载纠纷失败')
        }
      })
      .catch(() => message.error('加载纠纷失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, status, keyword])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (values: { mode: string; result: string }) => {
    if (!current) return
    const handler = getCurrentUser()?.nickname ?? getCurrentUser()?.username ?? '运营'
    const res =
      values.mode === 'mediation'
        ? await mediateDispute(current.id, handler, values.result)
        : await arbitrateDispute(current.id, handler, values.result)
    if (res?.code === 200) {
      message.success(values.mode === 'mediation' ? '调解意见已记录' : '仲裁结果已生效')
      setCurrent(null)
      form.resetFields()
      load()
    } else {
      message.error(res?.message ?? '处理失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="180px">
            <Select
              value={status}
              style={{ width: '100%' }}
              onChange={(value) => {
                setPageNum(1)
                setStatus(value)
              }}
              options={[
                { value: 'open', label: '未结（待受理+处理中）' },
                { value: 'processing', label: '处理中' },
                { value: 'pending', label: '待受理' },
                { value: 'resolved', label: '已解决' },
                { value: '', label: '全部状态' }
              ]}
            />
          </Col>
          <Col flex="280px">
            <Input.Search
              allowClear
              placeholder="纠纷单号 / 申请人 / 被申请人"
              onSearch={(value) => {
                setPageNum(1)
                setKeyword(value)
              }}
            />
          </Col>
          <Col flex="auto">
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Card title={`纠纷 ${total} 件`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1250 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            }
          }}
          columns={[
            { title: '纠纷单号', dataIndex: 'disputeNo', width: 160 },
            { title: '申请人', dataIndex: 'complainantName', width: 150 },
            { title: '被申请人', dataIndex: 'respondentName', width: 150 },
            {
              title: '类型',
              dataIndex: 'disputeType',
              width: 100,
              render: (val: string) => (val ? DISPUTE_TYPE[val] ?? val : '—')
            },
            { title: '索赔金额', dataIndex: 'claimAmount', width: 120, render: (val: number) => `¥${val}` },
            {
              title: '纠纷事由',
              dataIndex: 'disputeReason',
              width: 240,
              ellipsis: true,
              render: (val: string) => val || '—'
            },
            {
              title: '状态',
              dataIndex: 'disputeStatus',
              width: 100,
              render: (val: string) => {
                const tag = STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            {
              title: '当前阶段',
              dataIndex: 'processStage',
              width: 110,
              render: (val: string) => STAGE[val] ?? val ?? '—'
            },
            {
              title: '处理记录',
              width: 240,
              render: (_: unknown, row: DisputeRow) =>
                [
                  row.mediator && `调解:${row.mediator}/${row.mediationResult ?? ''}`,
                  row.arbitrator && `仲裁:${row.arbitrator}/${row.arbitrationResult ?? ''}`
                ]
                  .filter(Boolean)
                  .join('　') || '—'
            },
            { title: '发起时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 110,
              fixed: 'right',
              render: (_: unknown, row: DisputeRow) =>
                row.disputeStatus === 'resolved' || row.disputeStatus === 'closed' ? (
                  <span style={{ color: '#a0aec0' }}>已结案</span>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setCurrent(row)
                      form.setFieldsValue({
                        mode: row.processStage === 'arbitration' ? 'arbitration' : 'mediation',
                        result: undefined
                      })
                    }}
                  >
                    处理
                  </Button>
                )
            }
          ]}
        />
      </Card>

      <Modal
        open={Boolean(current)}
        title={`处理纠纷：${current?.disputeNo ?? ''}`}
        onCancel={() => setCurrent(null)}
        onOk={() => form.submit()}
        okText="提交处理结果"
      >
        {current && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ color: '#4a5568' }}>{current.disputeReason}</div>
            <Form form={form} layout="vertical" onFinish={submit}>
              <Form.Item label="处理方式" name="mode" rules={[{ required: true, message: '请选择处理方式' }]}>
                <Radio.Group
                  options={[
                    { value: 'mediation', label: '调解' },
                    { value: 'arbitration', label: '仲裁' }
                  ]}
                />
              </Form.Item>
              <Form.Item label="处理结果" name="result" rules={[{ required: true, message: '请选择处理结果' }]}>
                <Select
                  placeholder="调解选「达成一致」会结案；其余结果转入仲裁"
                  options={[
                    { value: 'agreed', label: '调解：双方达成一致（结案）' },
                    { value: 'failed', label: '调解：未达成一致（转仲裁）' },
                    { value: 'uphold', label: '仲裁：支持申请人' },
                    { value: 'reject', label: '仲裁：驳回申请' },
                    { value: 'partial', label: '仲裁：部分支持' }
                  ]}
                />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  )
}
