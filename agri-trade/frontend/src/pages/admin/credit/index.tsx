import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Rate, Select, Space, Table, Tag, message
} from 'antd'
import { EyeOutlined, StopOutlined, CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  auditCreditAppeal, changeEvaluationStatus, getCreditAppeals, getCreditEvaluations,
  type CreditAppeal, type CreditEvaluation
} from '@/api/credit'

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
 *
 * <p>这一页此前是**空缺** —— 评价表与申诉表都有数据，申诉审核的逻辑也早就写在
 * EvaluationController 里，但没有任何入口，运营看不到、也就无从处理。</p>
 *
 * <p>另外原来的审核接口没有运营角色校验（路径不在 /api/trade/admin 下），
 * 任何登录用户都能审核申诉、而通过会把别人的评价隐藏 —— 那个接口已删除，
 * 能力搬到这里。</p>
 */
export default function AdminCredit() {
  const [evaluations, setEvaluations] = useState<CreditEvaluation[]>([])
  const [evalTotal, setEvalTotal] = useState(0)
  const [evalPage, setEvalPage] = useState(1)
  const [evalFilters, setEvalFilters] = useState<{ evaluationNo?: string; ratingOverall?: number; evaluationStatus?: string }>({})
  const [evalDraft, setEvalDraft] = useState<{ evaluationNo?: string; ratingOverall?: number; evaluationStatus?: string }>({})

  const [appeals, setAppeals] = useState<CreditAppeal[]>([])
  const [appealTotal, setAppealTotal] = useState(0)
  const [appealPage, setAppealPage] = useState(1)
  const [appealStatus, setAppealStatus] = useState<string | undefined>()

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
        getCreditEvaluations({ pageNum: evalPage, pageSize: 10, ...evalFilters }),
        getCreditAppeals({ pageNum: appealPage, pageSize: 10, appealStatus })
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
  }, [evalPage, appealPage, evalFilters, appealStatus])

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
    <div style={{ padding: 20 }}>
      <Card
        title={`评价监管 ${evalTotal} 条`}
        style={{ marginBottom: 16 }}
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="隐藏评价必须填写原因"
          description="评价是公开的，隐藏要有据可查（原因会记在评价上）。申诉通过时系统也会自动隐藏对应评价。"
        />
        <Space style={{ marginBottom: 12 }} wrap>
          <Input
            placeholder="评价编号"
            style={{ width: 200 }}
            allowClear
            onChange={(e) => setEvalDraft((p) => ({ ...p, evaluationNo: e.target.value || undefined }))}
          />
          <Select
            placeholder="综合评分"
            style={{ width: 130 }}
            allowClear
            onChange={(v) => setEvalDraft((p) => ({ ...p, ratingOverall: v }))}
            options={[5, 4, 3, 2, 1].map((v) => ({ value: v, label: `${v}星` }))}
          />
          <Select
            placeholder="展示状态"
            style={{ width: 130 }}
            allowClear
            onChange={(v) => setEvalDraft((p) => ({ ...p, evaluationStatus: v }))}
            options={Object.entries(EVAL_STATUS).map(([value, item]) => ({ value, label: item.text }))}
          />
          <Button type="primary" onClick={() => { setEvalPage(1); setEvalFilters(evalDraft) }}>搜索</Button>
          <Button onClick={() => { setEvalDraft({}); setEvalFilters({}); setEvalPage(1) }}>重置</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={evaluations}
          scroll={{ x: 1200 }}
          pagination={{ current: evalPage, pageSize: 10, total: evalTotal, onChange: setEvalPage }}
          columns={[
            { title: '评价编号', dataIndex: 'evaluationNo', width: 160 },
            { title: '订单号', dataIndex: 'orderId', width: 100 },
            { title: '评价人', dataIndex: 'evaluatorName', width: 150 },
            { title: '被评价人', dataIndex: 'evaluateeName', width: 150 },
            { title: '综合评分', dataIndex: 'ratingOverall', width: 130,
              render: (v: number) => <Rate disabled defaultValue={v} /> },
            { title: '内容', dataIndex: 'evaluationContent', ellipsis: true },
            { title: '展示状态', dataIndex: 'evaluationStatus', width: 110,
              render: (v: string, row: CreditEvaluation) => (
                <Space size={4}>
                  <Tag color={EVAL_STATUS[v]?.color ?? 'default'}>{EVAL_STATUS[v]?.text ?? v}</Tag>
                  {v === 'hidden' && row.hideReason ? (
                    <span style={{ color: '#999', fontSize: 12 }} title={row.hideReason}>有原因</span>
                  ) : null}
                </Space>
              ) },
            {
              title: '操作',
              width: 150,
              fixed: 'right' as const,
              render: (_: unknown, row: CreditEvaluation) => (
                <Space size={0}>
                  <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(row)}>详情</Button>
                  {row.evaluationStatus === 'hidden' ? (
                    <Popconfirm title="恢复这条评价的展示？" okText="确 定" cancelText="取 消"
                      onConfirm={() => restore(row)}>
                      <Button type="link" icon={<CheckOutlined />}>恢复</Button>
                    </Popconfirm>
                  ) : (
                    <Button type="link" danger icon={<StopOutlined />}
                      onClick={() => { setHideRow(row); setHideReason('') }}>隐藏</Button>
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Card title={`申诉处理 ${appealTotal} 条`}>
        <Space style={{ marginBottom: 12 }}>
          <Select
            placeholder="申诉状态"
            style={{ width: 140 }}
            allowClear
            onChange={(v) => { setAppealPage(1); setAppealStatus(v) }}
            options={Object.entries(APPEAL_STATUS).map(([value, item]) => ({ value, label: item.text }))}
          />
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={appeals}
          scroll={{ x: 1300 }}
          locale={{ emptyText: '暂无申诉' }}
          pagination={{ current: appealPage, pageSize: 10, total: appealTotal, onChange: setAppealPage }}
          columns={[
            { title: '申诉编号', dataIndex: 'appealNo', width: 160 },
            { title: '关联评价', dataIndex: 'evaluationNo', width: 160,
              render: (v: string) => v ?? '—' },
            { title: '被评价方（申诉方）', dataIndex: 'evaluateeName', width: 170,
              render: (v: string, row: CreditAppeal) => v ?? row.appellantName ?? '—' },
            { title: '申诉类型', dataIndex: 'appealType', width: 120,
              render: (v: string) => APPEAL_TYPE[v] ?? v ?? '—' },
            { title: '申诉理由', dataIndex: 'appealReason', ellipsis: true },
            { title: '状态', dataIndex: 'appealStatus', width: 110,
              render: (v: string) => {
                const hit = APPEAL_STATUS[v]
                return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? v}</Tag>
              } },
            { title: '申请时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 170,
              fixed: 'right' as const,
              render: (_: unknown, row: CreditAppeal) => (
                <Space size={0}>
                  <Button type="link" icon={<EyeOutlined />} onClick={() => setAppealDetail(row)}>详情</Button>
                  {row.appealStatus === 'pending' && (
                    <>
                      <Button type="link" icon={<CheckOutlined />}
                        onClick={() => { setAuditRow(row); form.setFieldsValue({ status: 'approved' }) }}>审核</Button>
                      <Button type="link" danger icon={<CloseOutlined />}
                        onClick={() => { setAuditRow(row); form.setFieldsValue({ status: 'rejected' }) }}>驳回</Button>
                    </>
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>

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
