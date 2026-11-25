import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Descriptions, Form, Input, InputNumber, Modal, Select, Table, Tag, message
} from 'antd'
import { ListRowActions } from '@agri/shared'
import {
  freezeGuarantee, getGuaranteeLogs, getGuarantees, unfreezeGuarantee, verifyGuarantee,
  type GuaranteeLogRow, type GuaranteeRow
} from '@/api/guarantee'
import { TradeFilters, TradeList } from '@/components/TradeList'

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  active: { text: '生效中', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  expired: { text: '已到期', color: 'default' }
}

const TYPE: Record<string, string> = {
  cash: '现金保证金',
  bank: '银行保函',
  insurance: '保险保单'
}

const ACTION: Record<string, string> = {
  create: '开立',
  verify: '审核',
  freeze: '冻结',
  unfreeze: '解冻',
  replenish: '补缴',
  deduct: '扣划'
}

/**
 * 保证金管理（运营端）。
 */
export default function AdminGuarantee() {
  const [rows, setRows] = useState<GuaranteeRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<{ guaranteeStatus?: string; merchantName?: string }>({})
  const [draft, setDraft] = useState<{ guaranteeStatus?: string; merchantName?: string }>({})
  const [loading, setLoading] = useState(false)

  const [verifyRow, setVerifyRow] = useState<GuaranteeRow | null>(null)
  const [freezeRow, setFreezeRow] = useState<GuaranteeRow | null>(null)
  const [unfreezeRow, setUnfreezeRow] = useState<GuaranteeRow | null>(null)
  const [logRow, setLogRow] = useState<GuaranteeRow | null>(null)
  const [logs, setLogs] = useState<GuaranteeLogRow[]>([])
  const [saving, setSaving] = useState(false)
  const [verifyForm] = Form.useForm()
  const [freezeForm] = Form.useForm()
  const [unfreezeForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getGuarantees({ pageNum: page, pageSize, ...filters })
      if (res?.code === 200) {
        setRows(res.data?.records ?? [])
        setTotal(Number(res.data?.total ?? 0))
      } else {
        message.error(res?.message ?? '加载保证金失败')
      }
    } catch {
      message.error('加载保证金失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => {
    load()
  }, [load])

  const handleQuery = () => {
    setPage(1)
    setFilters({ ...draft, merchantName: draft.merchantName?.trim() || undefined })
  }

  const handleReset = () => {
    setDraft({})
    setFilters({})
    setPage(1)
  }

  const openLogs = async (row: GuaranteeRow) => {
    setLogRow(row)
    setLogs([])
    try {
      const res = await getGuaranteeLogs(row.id)
      if (res?.code === 200) setLogs(res.data ?? [])
    } catch {
      message.error('加载流水失败')
    }
  }

  const submitVerify = async () => {
    if (!verifyRow) return
    const values = await verifyForm.validateFields()
    setSaving(true)
    try {
      const res = await verifyGuarantee(verifyRow.id, values.status, values.remark)
      if (res?.code === 200) {
        message.success(values.status === 'active' ? '已通过' : '已驳回')
        setVerifyRow(null)
        verifyForm.resetFields()
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

  const submitFreeze = async (kind: 'freeze' | 'unfreeze') => {
    const row = kind === 'freeze' ? freezeRow : unfreezeRow
    const form = kind === 'freeze' ? freezeForm : unfreezeForm
    if (!row) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = kind === 'freeze'
        ? await freezeGuarantee(row.id, values.amount, values.reason)
        : await unfreezeGuarantee(row.id, values.amount, values.reason)
      if (res?.code === 200) {
        message.success(kind === 'freeze' ? '已冻结' : '已解冻')
        setFreezeRow(null)
        setUnfreezeRow(null)
        form.resetFields()
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

  const money = (v: number | undefined | null) =>
    v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ padding: 20 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="冻结与解冻必须填写原因，并会留下流水"
        description="每次动作都会记下金额与动作前后的可用/冻结额，商家来问「我的钱为什么被冻了」时能答得上。审核开立只有「待审核」的账户可以做。"
      />

      <TradeList<GuaranteeRow>
        listId="admin-guarantee"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>保证金账户（共 {total} 个）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '账户状态',
                control: (
                  <Select
                    allowClear
                    value={draft.guaranteeStatus}
                    placeholder="全部状态"
                    onChange={(v) => setDraft((p) => ({ ...p, guaranteeStatus: v }))}
                    options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.text }))}
                  />
                ),
              },
              {
                label: '主体名称',
                control: (
                  <Input
                    allowClear
                    value={draft.merchantName}
                    placeholder="按主体名称搜索"
                    onChange={(e) => setDraft((p) => ({ ...p, merchantName: e.target.value || undefined }))}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        locale={{ emptyText: '暂无保证金账户' }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage)
            setPageSize(nextSize)
          },
        }}
        columns={[
          { title: '主体', dataIndex: 'merchantName', width: 170, ellipsis: true, render: (v: string) => v ?? '—' },
          { title: '保证金单号', dataIndex: 'guaranteeNo', width: 180, ellipsis: true },
          { title: '类型', dataIndex: 'guaranteeType', width: 110, render: (v: string) => TYPE[v] ?? v ?? '—' },
          { title: '总额', dataIndex: 'totalAmount', width: 130, render: money },
          { title: '可用', dataIndex: 'availableAmount', width: 130, render: money },
          { title: '冻结', dataIndex: 'frozenAmount', width: 120, render: money },
          { title: '已用', dataIndex: 'usedAmount', width: 120, render: money },
          {
            title: '状态',
            dataIndex: 'guaranteeStatus',
            width: 104,
            render: (v: string) => <Tag color={STATUS[v]?.color ?? 'default'}>{STATUS[v]?.text ?? v}</Tag>
          },
          { title: '到期时间', dataIndex: 'expireTime', width: 170, render: (v: string) => v ?? '—' },
          {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: unknown, row: GuaranteeRow) => (
              <ListRowActions
                items={[
                  <Button key="logs" type="link" size="small" onClick={() => openLogs(row)}>流水</Button>,
                  row.guaranteeStatus === 'pending' && (
                    <Button key="verify" type="link" size="small" onClick={() => { setVerifyRow(row); verifyForm.setFieldsValue({ status: 'active' }) }}>
                      审核
                    </Button>
                  ),
                  row.guaranteeStatus === 'active' && (
                    <Button key="freeze" type="link" size="small" onClick={() => { setFreezeRow(row); freezeForm.resetFields() }}>
                      冻结
                    </Button>
                  ),
                  row.guaranteeStatus === 'active' && (
                    <Button key="unfreeze" type="link" size="small" onClick={() => { setUnfreezeRow(row); unfreezeForm.resetFields() }}>
                      解冻
                    </Button>
                  ),
                ]}
              />
            )
          }
        ]}
      />

      <Modal title="审核保证金账户" open={!!verifyRow} onCancel={() => setVerifyRow(null)}
        onOk={submitVerify} confirmLoading={saving} destroyOnClose>
        {verifyRow && (
          <Descriptions bordered column={1} size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="主体">{verifyRow.merchantName}</Descriptions.Item>
            <Descriptions.Item label="担保类型">{TYPE[verifyRow.guaranteeType] ?? verifyRow.guaranteeType}</Descriptions.Item>
            <Descriptions.Item label="金额">{money(verifyRow.totalAmount)}</Descriptions.Item>
            <Descriptions.Item label="银行">{verifyRow.bankName ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={verifyForm} layout="vertical">
          <Form.Item name="status" label="审核结论" rules={[{ required: true, message: '请选择结论' }]}>
            <Select options={[
              { value: 'active', label: '通过（账户生效，可用于赔付）' },
              { value: 'rejected', label: '驳回（需填写原因）' }
            ]} />
          </Form.Item>
          <Form.Item name="remark" label="审核意见" extra="驳回时必填">
            <Input.TextArea rows={2} placeholder="例如：保函编号与银行回执不符" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="冻结保证金" open={!!freezeRow} onCancel={() => setFreezeRow(null)}
        onOk={() => submitFreeze('freeze')} confirmLoading={saving} destroyOnClose>
        {freezeRow && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message={`${freezeRow.merchantName ?? ''} 当前可用 ${money(freezeRow.availableAmount)}`}
            description="冻结只影响「可用」，不动总额。必须填写原因，会留下流水。" />
        )}
        <Form form={freezeForm} layout="vertical">
          <Form.Item name="amount" label="冻结金额" rules={[{ required: true, message: '请填写金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="reason" label="冻结原因" rules={[{ required: true, message: '必须填写原因' }]}>
            <Input.TextArea rows={3} placeholder="例如：订单纠纷未结，按规则先行冻结" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="解冻保证金" open={!!unfreezeRow} onCancel={() => setUnfreezeRow(null)}
        onOk={() => submitFreeze('unfreeze')} confirmLoading={saving} destroyOnClose>
        {unfreezeRow && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`${unfreezeRow.merchantName ?? ''} 当前冻结 ${money(unfreezeRow.frozenAmount)}`}
            description="解冻把金额从「冻结」放回「可用」。必须填写原因，会留下流水。" />
        )}
        <Form form={unfreezeForm} layout="vertical">
          <Form.Item name="amount" label="解冻金额" rules={[{ required: true, message: '请填写金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="reason" label="解冻原因" rules={[{ required: true, message: '必须填写原因' }]}>
            <Input.TextArea rows={3} placeholder="例如：纠纷已结，解除冻结" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`保证金流水${logRow ? ' · ' + (logRow.merchantName ?? '') : ''}`} open={!!logRow}
        onCancel={() => setLogRow(null)} footer={null} width={860}>
        <Table
          rowKey="id"
          size="small"
          dataSource={logs}
          pagination={false}
          locale={{ emptyText: '还没有流水（这个账户目前只做过审核或尚未发生金额变动）' }}
          columns={[
            { title: '动作', dataIndex: 'action', width: 90, render: (v: string) => ACTION[v] ?? v },
            { title: '金额', dataIndex: 'amount', width: 130, align: 'right' as const, render: money },
            { title: '可用（前→后）', width: 200,
              render: (_: unknown, row: GuaranteeLogRow) => `${money(row.availableBefore)} → ${money(row.availableAfter)}` },
            { title: '冻结（前→后）', width: 200,
              render: (_: unknown, row: GuaranteeLogRow) => `${money(row.frozenBefore)} → ${money(row.frozenAfter)}` },
            { title: '操作人', dataIndex: 'operator', width: 100, render: (v: string) => v ?? '—' },
            { title: '原因', dataIndex: 'reason', ellipsis: true, render: (v: string) => v ?? '—' },
            { title: '时间', dataIndex: 'createTime', width: 170 }
          ]}
        />
      </Modal>
    </div>
  )
}
