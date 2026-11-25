import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Radio, Select, Space, Tag, message } from 'antd'
import { ListRowActions } from '@agri/shared'
import { arbitrateDispute, getAdminDisputePage, mediateDispute } from '@/api/admin'
import { TradeFilters, TradeList } from '@/components/TradeList'
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
  complain: '申请中',
  mediation: '调解中',
  arbitration: '仲裁中',
  resolved: '已了结',
  closed: '已关闭'
}

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
 */
export default function AdminDispute() {
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState('open')
  const [keyword, setKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('open')
  const [draftKeyword, setDraftKeyword] = useState('')
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

  const handleQuery = () => {
    setPageNum(1)
    setStatus(draftStatus)
    setKeyword(draftKeyword.trim())
  }

  const handleReset = () => {
    setDraftStatus('open')
    setDraftKeyword('')
    setPageNum(1)
    setStatus('open')
    setKeyword('')
  }

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
      <TradeList<DisputeRow>
        listId="admin-dispute"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>纠纷仲裁（共 {total} 件）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '纠纷状态',
                control: (
                  <Select
                    value={draftStatus}
                    onChange={(value) => {
                      setDraftStatus(value)
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
                ),
              },
              {
                label: '关键字',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="纠纷单号 / 申请人 / 被申请人"
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: pageNum,
          pageSize,
          total,
          onChange: (page, size) => {
            setPageNum(page)
            setPageSize(size)
          },
        }}
        columns={[
          { title: '纠纷单号', dataIndex: 'disputeNo', width: 160, ellipsis: true },
          { title: '申请人', dataIndex: 'complainantName', width: 150, ellipsis: true },
          { title: '被申请人', dataIndex: 'respondentName', width: 150, ellipsis: true },
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
            width: 104,
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
            key: 'handleRecord',
            width: 240,
            ellipsis: true,
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
            key: 'action',
            width: 110,
            render: (_: unknown, row: DisputeRow) =>
              row.disputeStatus === 'resolved' || row.disputeStatus === 'closed' ? (
                <span style={{ color: '#a0aec0' }}>已结案</span>
              ) : (
                <ListRowActions>
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
                </ListRowActions>
              )
          }
        ]}
      />

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
