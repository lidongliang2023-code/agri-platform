import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Space, Statistic, Table, Tag, message } from 'antd'
import { EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  getMyGuaranteeLogs, getMyGuarantees, replenishMyGuarantee,
  type GuaranteeLogRow, type GuaranteeRow
} from '@/api/guarantee'

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
 * 我的保证金（商家侧）。
 *
 * 保证金是商家押在平台、用于赔付的钱。此前商家**看不到自己的账户余额，也没有补缴入口** ——
 * 后端只有"传 merchantId 查余额"那种接口，连自己都查不了（更别说别人也能查）。
 * 现在范围由服务端按登录身份推导，补缴只允许补自己的账户，且每次补缴都会写一条流水。
 */
export default function MyGuarantee() {
  const [rows, setRows] = useState<GuaranteeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [replenishRow, setReplenishRow] = useState<GuaranteeRow | null>(null)
  const [logRow, setLogRow] = useState<GuaranteeRow | null>(null)
  const [logs, setLogs] = useState<GuaranteeLogRow[]>([])
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyGuarantees()
      if (res?.code === 200) {
        setRows(res.data ?? [])
      } else {
        message.error(res?.message ?? '加载保证金失败')
      }
    } catch {
      message.error('加载保证金失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openLogs = async (row: GuaranteeRow) => {
    setLogRow(row)
    setLogs([])
    try {
      const res = await getMyGuaranteeLogs(row.id)
      if (res?.code === 200) setLogs(res.data ?? [])
    } catch {
      message.error('加载流水失败')
    }
  }

  const submitReplenish = async () => {
    if (!replenishRow) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await replenishMyGuarantee(replenishRow.id, values.amount, values.reason)
      if (res?.code === 200) {
        message.success('补缴成功')
        setReplenishRow(null)
        form.resetFields()
        load()
      } else {
        message.error(res?.message ?? '补缴失败')
      }
    } catch {
      message.error('补缴失败')
    } finally {
      setSaving(false)
    }
  }

  const money = (v: number | undefined | null) =>
    v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

  const total = rows.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0)
  const available = rows.reduce((sum, row) => sum + Number(row.availableAmount ?? 0), 0)
  const frozen = rows.reduce((sum, row) => sum + Number(row.frozenAmount ?? 0), 0)
  const used = rows.reduce((sum, row) => sum + Number(row.usedAmount ?? 0), 0)

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="保证金总额" value={total} prefix="¥" precision={2} /></Card></Col>
        <Col span={6}><Card><Statistic title="可用" value={available} prefix="¥" precision={2} /></Card></Col>
        <Col span={6}><Card><Statistic title="冻结中" value={frozen} prefix="¥" precision={2} /></Card></Col>
        <Col span={6}><Card><Statistic title="已用于赔付" value={used} prefix="¥" precision={2} /></Card></Col>
      </Row>

      <Card
        title={`我的保证金账户 ${rows.length} 个`}
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="保证金用于交易赔付"
          description="冻结中的金额由平台按规则暂时锁定（例如订单纠纷未结）；补缴是往账户里加钱，每次都会留下流水。账户的开立与审核由平台运营办理。"
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1200 }}
          locale={{ emptyText: '还没有保证金账户（账户由平台运营办理开立）' }}
          pagination={false}
          columns={[
            { title: '保证金单号', dataIndex: 'guaranteeNo', width: 180 },
            { title: '类型', dataIndex: 'guaranteeType', width: 110, render: (v: string) => TYPE[v] ?? v ?? '—' },
            { title: '总额', dataIndex: 'totalAmount', width: 130, align: 'right' as const, render: money },
            { title: '可用', dataIndex: 'availableAmount', width: 130, align: 'right' as const, render: money },
            { title: '冻结', dataIndex: 'frozenAmount', width: 120, align: 'right' as const, render: money },
            { title: '已用', dataIndex: 'usedAmount', width: 120, align: 'right' as const, render: money },
            { title: '状态', dataIndex: 'guaranteeStatus', width: 100,
              render: (v: string) => <Tag color={STATUS[v]?.color ?? 'default'}>{STATUS[v]?.text ?? v}</Tag> },
            { title: '到期时间', dataIndex: 'expireTime', width: 170, render: (v: string) => v ?? '—' },
            {
              title: '操作',
              width: 170,
              fixed: 'right' as const,
              render: (_: unknown, row: GuaranteeRow) => (
                <Space size={0}>
                  <Button type="link" icon={<EyeOutlined />} onClick={() => openLogs(row)}>流水</Button>
                  {row.guaranteeStatus === 'active' && (
                    <Button type="link" icon={<PlusOutlined />}
                      onClick={() => { setReplenishRow(row); form.resetFields() }}>补缴</Button>
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal title="补缴保证金" open={!!replenishRow} onCancel={() => setReplenishRow(null)}
        onOk={submitReplenish} confirmLoading={saving} destroyOnClose>
        {replenishRow && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`${replenishRow.guaranteeNo} 当前可用 ${money(replenishRow.availableAmount)}`}
            description="补缴会同时增加总额与可用额，并留下一条流水。" />
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="amount" label="补缴金额" rules={[{ required: true, message: '请填写金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="reason" label="备注">
            <Input placeholder="可留空，例如：按平台要求补足保证金" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="保证金流水" open={!!logRow} onCancel={() => setLogRow(null)} footer={null} width={860}>
        <Table
          rowKey="id"
          size="small"
          dataSource={logs}
          pagination={false}
          locale={{ emptyText: '还没有流水' }}
          columns={[
            { title: '动作', dataIndex: 'action', width: 90, render: (v: string) => ACTION[v] ?? v },
            { title: '金额', dataIndex: 'amount', width: 130, align: 'right' as const, render: money },
            { title: '可用（前→后）', width: 200,
              render: (_: unknown, row: GuaranteeLogRow) => `${money(row.availableBefore)} → ${money(row.availableAfter)}` },
            { title: '操作人', dataIndex: 'operator', width: 100, render: (v: string) => v ?? '—' },
            { title: '原因', dataIndex: 'reason', ellipsis: true, render: (v: string) => v ?? '—' },
            { title: '时间', dataIndex: 'createTime', width: 170 }
          ]}
        />
      </Modal>
    </div>
  )
}
