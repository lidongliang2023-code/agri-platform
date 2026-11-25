import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Descriptions, Form, Input, Modal, Popconfirm, Rate, Select, Space, Tag, message
} from 'antd'
import { ListRowActions } from '@agri/shared'
import {
  auditCreditAppeal, changeEvaluationStatus, getCreditAppeals, getCreditEvaluations,
  type CreditAppeal, type CreditEvaluation
} from '@/api/credit'
import { TradeFilters, TradeList } from '@/components/TradeList'

const APPEAL_TYPE: Record<string, string> = {
  fact: '内容不实',
  false_content: '内容不实',
  not_my_order: '评价的不是本单',
  malicious: '恶意差评',
  other: '其它'
}

const APPEAL_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'default' }
}

const EVAL_STATUS: Record<string, { text: string; color: string }> = {
  published: { text: '展示中', color: 'success' },
  hidden: { text: '已隐藏', color: 'default' }
}

/**
 * 信用管理（运营端）：评价监管 + 申诉处理。
 */
export default function AdminCredit() {
  const [evaluations, setEvaluations] = useState<CreditEvaluation[]>([])
  const [evalTotal, setEvalTotal] = useState(0)
  const [evalPage, setEvalPage] = useState(1)
  const [evalPageSize, setEvalPageSize] = useState(20)
  const [evalFilters, setEvalFilters] = useState<{ evaluationNo?: string; ratingOverall?: number; evaluationStatus?: string }>({})
  const [evalDraft, setEvalDraft] = useState<{ evaluationNo?: string; ratingOverall?: number; evaluationStatus?: string }>({})

  const [appeals, setAppeals] = useState<CreditAppeal[]>([])
  const [appealTotal, setAppealTotal] = useState(0)
  const [appealPage, setAppealPage] = useState(1)
  const [appealPageSize, setAppealPageSize] = useState(20)
  const [appealStatus, setAppealStatus] = useState<string | undefined>()
  const [draftAppealStatus, setDraftAppealStatus] = useState<string | undefined>()

  const [loading, setLoading] = useState(false)
  const [hideRow, setHideRow] = useState<CreditEvaluation | null>(null)
  const [hideReason, setHideReason] = useState('')
  const [detail, setDetail] = useState<CreditEvaluation | null>(null)
  const [appealDetail, setAppealDetail] = useState<CreditAppeal | null>(null)
  const [auditRow, setAuditRow] = useState<CreditAppeal | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [e, a] = await Promise.all([
        getCreditEvaluations({ pageNum: evalPage, pageSize: evalPageSize, ...evalFilters }),
        getCreditAppeals({ pageNum: appealPage, pageSize: appealPageSize, appealStatus })
      ])
      if (e?.code === 200) {
        setEvaluations(e.data?.records ?? [])
        setEvalTotal(Number(e.data?.total ?? 0))
      }
      if (a?.code === 200) {
        setAppeals(a.data?.records ?? [])
        setAppealTotal(Number(a.data?.total ?? 0))
      }
    } catch {
      message.error('加载信用数据失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [evalPage, evalPageSize, appealPage, appealPageSize, evalFilters, appealStatus])

  useEffect(() => {
    load()
  }, [load])

  const submitHide = async () => {
    if (!hideRow) return
    if (!hideReason.trim()) {
      message.warning('隐藏评价必须填写原因')
      return
    }
    setSaving(true)
    try {
      const res = await changeEvaluationStatus(hideRow.id, 'hide', hideReason.trim())
      if (res?.code === 200) {
        message.success('已隐藏')
        setHideRow(null)
        setHideReason('')
        load()
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const restore = async (row: CreditEvaluation) => {
    try {
      const res = await changeEvaluationStatus(row.id, 'restore')
      if (res?.code === 200) {
        message.success('已恢复展示')
        load()
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败')
    }
  }

  const submitAudit = async () => {
    if (!auditRow) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await auditCreditAppeal(auditRow.id, values.status, values.remark)
      if (res?.code === 200) {
        message.success(values.status === 'approved' ? '申诉已通过，对应评价已隐藏' : '申诉已驳回')
        setAuditRow(null)
        form.resetFields()
        load()
      } else {
        message.error(res?.message ?? '审核失败')
      }
    } catch {
      message.error('审核失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 16 }}>
      <Alert
        type="info"
        showIcon
        message="隐藏评价必须填写原因"
        description="评价是公开的，隐藏要有据可查（原因会记在评价上）。申诉通过时系统也会自动隐藏对应评价。"
      />

      <TradeList<CreditEvaluation>
        listId="admin-credit-evaluations"
        rowKey="id"
        loading={loading}
        dataSource={evaluations}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>评价监管（共 {evalTotal} 条）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={() => {
              setEvalPage(1)
              setEvalFilters({ ...evalDraft, evaluationNo: evalDraft.evaluationNo?.trim() || undefined })
            }}
            onReset={() => {
              setEvalDraft({})
              setEvalFilters({})
              setEvalPage(1)
            }}
            fields={[
              {
                label: '评价编号',
                control: (
                  <Input
                    allowClear
                    value={evalDraft.evaluationNo}
                    placeholder="评价编号"
                    onChange={(e) => setEvalDraft((p) => ({ ...p, evaluationNo: e.target.value || undefined }))}
                    onPressEnter={() => {
                      setEvalPage(1)
                      setEvalFilters({ ...evalDraft, evaluationNo: evalDraft.evaluationNo?.trim() || undefined })
                    }}
                  />
                ),
              },
              {
                label: '综合评分',
                control: (
                  <Select
                    allowClear
                    value={evalDraft.ratingOverall}
                    placeholder="全部评分"
                    onChange={(v) => setEvalDraft((p) => ({ ...p, ratingOverall: v }))}
                    options={[5, 4, 3, 2, 1].map((v) => ({ value: v, label: `${v}星` }))}
                  />
                ),
              },
              {
                label: '展示状态',
                control: (
                  <Select
                    allowClear
                    value={evalDraft.evaluationStatus}
                    placeholder="全部状态"
                    onChange={(v) => setEvalDraft((p) => ({ ...p, evaluationStatus: v }))}
                    options={Object.entries(EVAL_STATUS).map(([value, item]) => ({ value, label: item.text }))}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: evalPage,
          pageSize: evalPageSize,
          total: evalTotal,
          onChange: (nextPage, nextSize) => {
            setEvalPage(nextPage)
            setEvalPageSize(nextSize)
          },
        }}
        columns={[
          { title: '评价编号', dataIndex: 'evaluationNo', width: 160, ellipsis: true },
          { title: '订单号', dataIndex: 'orderId', width: 100 },
          { title: '评价人', dataIndex: 'evaluatorName', width: 150, ellipsis: true },
          { title: '被评价人', dataIndex: 'evaluateeName', width: 150, ellipsis: true },
          {
            title: '综合评分',
            dataIndex: 'ratingOverall',
            width: 140,
            align: 'center',
            render: (v: number) => <Rate disabled defaultValue={v} />
          },
          { title: '内容', dataIndex: 'evaluationContent', width: 220, ellipsis: true },
          {
            title: '展示状态',
            dataIndex: 'evaluationStatus',
            width: 120,
            render: (v: string, row: CreditEvaluation) => (
              <Space size={4}>
                <Tag color={EVAL_STATUS[v]?.color ?? 'default'}>{EVAL_STATUS[v]?.text ?? v}</Tag>
                {v === 'hidden' && row.hideReason ? (
                  <span style={{ color: '#999', fontSize: 12 }} title={row.hideReason}>有原因</span>
                ) : null}
              </Space>
            )
          },
          {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: unknown, row: CreditEvaluation) => (
              <ListRowActions>
                <Button type="link" size="small" onClick={() => setDetail(row)}>详情</Button>
                {row.evaluationStatus === 'hidden' ? (
                  <Popconfirm title="恢复这条评价的展示？" okText="确 定" cancelText="取 消" onConfirm={() => restore(row)}>
                    <Button type="link" size="small">恢复</Button>
                  </Popconfirm>
                ) : (
                  <Button type="link" size="small" danger onClick={() => { setHideRow(row); setHideReason('') }}>隐藏</Button>
                )}
              </ListRowActions>
            )
          }
        ]}
      />

      <TradeList<CreditAppeal>
        listId="admin-credit-appeals"
        rowKey="id"
        loading={loading}
        dataSource={appeals}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>申诉处理（共 {appealTotal} 条）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={() => {
              setAppealPage(1)
              setAppealStatus(draftAppealStatus)
            }}
            onReset={() => {
              setDraftAppealStatus(undefined)
              setAppealStatus(undefined)
              setAppealPage(1)
            }}
            fields={[
              {
                label: '申诉状态',
                control: (
                  <Select
                    allowClear
                    value={draftAppealStatus}
                    placeholder="全部申诉状态"
                    onChange={(v) => {
                      setDraftAppealStatus(v)
                      setAppealPage(1)
                      setAppealStatus(v)
                    }}
                    options={Object.entries(APPEAL_STATUS).map(([value, item]) => ({ value, label: item.text }))}
                  />
                ),
              },
            ]}
          />
        )}
        locale={{ emptyText: '暂无申诉' }}
        pagination={{
          current: appealPage,
          pageSize: appealPageSize,
          total: appealTotal,
          onChange: (nextPage, nextSize) => {
            setAppealPage(nextPage)
            setAppealPageSize(nextSize)
          },
        }}
        columns={[
          { title: '申诉编号', dataIndex: 'appealNo', width: 160, ellipsis: true },
          { title: '关联评价', dataIndex: 'evaluationNo', width: 160, ellipsis: true, render: (v: string) => v ?? '—' },
          {
            title: '被评价方（申诉方）',
            dataIndex: 'evaluateeName',
            width: 170,
            ellipsis: true,
            render: (v: string, row: CreditAppeal) => v ?? row.appellantName ?? '—'
          },
          { title: '申诉类型', dataIndex: 'appealType', width: 120, render: (v: string) => APPEAL_TYPE[v] ?? v ?? '—' },
          { title: '申诉理由', dataIndex: 'appealReason', width: 220, ellipsis: true },
          {
            title: '状态',
            dataIndex: 'appealStatus',
            width: 110,
            render: (v: string) => {
              const hit = APPEAL_STATUS[v]
              return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? v}</Tag>
            }
          },
          { title: '申请时间', dataIndex: 'createTime', width: 170 },
          {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: unknown, row: CreditAppeal) => (
              <ListRowActions
                items={[
                  <Button key="detail" type="link" size="small" onClick={() => setAppealDetail(row)}>详情</Button>,
                  row.appealStatus === 'pending' && (
                    <Button key="approve" type="link" size="small" onClick={() => { setAuditRow(row); form.setFieldsValue({ status: 'approved' }) }}>
                      审核
                    </Button>
                  ),
                  row.appealStatus === 'pending' && (
                    <Button key="reject" type="link" size="small" danger onClick={() => { setAuditRow(row); form.setFieldsValue({ status: 'rejected' }) }}>
                      驳回
                    </Button>
                  ),
                ]}
              />
            )
          }
        ]}
      />

      <Modal title="隐藏评价" open={!!hideRow} onCancel={() => setHideRow(null)} onOk={submitHide}
        confirmLoading={saving} destroyOnClose>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="隐藏后这条评价不再对外展示"
          description="请填写原因（会记在该评价上，作为处置留痕）。" />
        <Input.TextArea rows={3} value={hideReason} onChange={(e) => setHideReason(e.target.value)}
          placeholder="例如：经核实为同行恶意差评" />
      </Modal>

      <Modal title="审核申诉" open={!!auditRow} onCancel={() => setAuditRow(null)} onOk={submitAudit}
        confirmLoading={saving} destroyOnClose>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="通过会同时隐藏被申诉的评价"
          description="通过 = 认可申诉（评价置为隐藏）；驳回 = 维持原评价。这里只处理待处理的申诉。" />
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="审核结论" rules={[{ required: true, message: '请选择结论' }]}>
            <Select options={[
              { value: 'approved', label: '通过（隐藏该评价）' },
              { value: 'rejected', label: '驳回（维持该评价）' }
            ]} />
          </Form.Item>
          <Form.Item name="remark" label="审核备注">
            <Input.TextArea rows={3} placeholder="可留空" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="评价详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={700}>
        {detail && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="评价编号">{detail.evaluationNo}</Descriptions.Item>
            <Descriptions.Item label="订单号">{detail.orderId}</Descriptions.Item>
            <Descriptions.Item label="评价人">{detail.evaluatorName}</Descriptions.Item>
            <Descriptions.Item label="被评价人">{detail.evaluateeName}</Descriptions.Item>
            <Descriptions.Item label="综合评分"><Rate disabled defaultValue={detail.ratingOverall} /></Descriptions.Item>
            <Descriptions.Item label="展示状态">
              <Tag color={EVAL_STATUS[detail.evaluationStatus]?.color ?? 'default'}>
                {EVAL_STATUS[detail.evaluationStatus]?.text ?? detail.evaluationStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="评价内容" span={2}>{detail.evaluationContent ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="隐藏原因" span={2}>{detail.hideReason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="是否匿名" span={2}>
              {detail.isAnonymous === 1 ? '匿名' : '实名'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal title="申诉详情" open={!!appealDetail} onCancel={() => setAppealDetail(null)} footer={null} width={720}>
        {appealDetail && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="申诉编号">{appealDetail.appealNo}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={APPEAL_STATUS[appealDetail.appealStatus]?.color ?? 'default'}>
                {APPEAL_STATUS[appealDetail.appealStatus]?.text ?? appealDetail.appealStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="申诉方">{appealDetail.evaluateeName ?? appealDetail.appellantName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="申诉类型">{APPEAL_TYPE[appealDetail.appealType] ?? appealDetail.appealType ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="申诉理由" span={2}>{appealDetail.appealReason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="证据说明" span={2}>{appealDetail.appealEvidence ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="关联评价">{appealDetail.evaluationNo ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="关联订单">{appealDetail.orderId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="评价内容" span={2}>{appealDetail.evaluationContent ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核人">{appealDetail.reviewer ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核时间">{appealDetail.reviewTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核备注" span={2}>{appealDetail.reviewRemark ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
