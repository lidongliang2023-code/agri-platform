import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tag, message } from 'antd'
import { EyeOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons'
import { getRiskAlerts, getRiskRules, getRiskSummary, handleRiskAlert, scanRisk, type RiskAlertRow, type RiskRule, type RiskSummary } from '@/api/risk'

const LEVEL: Record<string, { text: string; color: string }> = {
  high: { text: '高', color: 'error' },
  medium: { text: '中', color: 'warning' },
  low: { text: '低', color: 'default' }
}

const STATUS: Record<string, { text: string; color: string }> = {
  new: { text: '待处理', color: 'warning' },
  handled: { text: '已处理', color: 'success' },
  ignored: { text: '已忽略', color: 'default' }
}

const SUBJECT_TYPE: Record<string, string> = {
  product: '货源',
  merchant: '经营主体',
  order: '订单'
}

/**
 * 风控管理（运营端）。
 *
 * 三条规则的判定依据都写在服务端，且 detail 里带着当时算出的真实数字，
 * 运营可以自己对账。阈值在「系统配置」里调整，改了下次扫描即生效。
 *
 * 扫描是**按需触发**的：三条规则依赖运营自己定的阈值，自动跑会让人不知道
 * 告警是按哪套阈值出来的。
 */
export default function AdminRisk() {
  const [summary, setSummary] = useState<RiskSummary | null>(null)
  const [rules, setRules] = useState<RiskRule[]>([])
  const [rows, setRows] = useState<RiskAlertRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<{ alertStatus?: string; alertLevel?: string; ruleCode?: string }>({})
  const [draft, setDraft] = useState<{ alertStatus?: string; alertLevel?: string; ruleCode?: string }>({})
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [detail, setDetail] = useState<RiskAlertRow | null>(null)
  const [handleRow, setHandleRow] = useState<RiskAlertRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r, a] = await Promise.all([
        getRiskSummary(),
        getRiskRules(),
        getRiskAlerts({ pageNum: page, pageSize: 10, ...filters })
      ])
      if (s?.code === 200) setSummary(s.data)
      if (r?.code === 200) setRules(r.data ?? [])
      if (a?.code === 200) {
        setRows(a.data?.records ?? [])
        setTotal(Number(a.data?.total ?? 0))
      }
    } catch {
      message.error('加载风控数据失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    load()
  }, [load])

  const doScan = async () => {
    setScanning(true)
    try {
      const res = await scanRisk()
      if (res?.code === 200) {
        const d = res.data ?? {}
        message.success(
          `扫描完成：本次检出 ${d.detectedTotal ?? 0} 条，新增 ${(d.low_price?.created ?? 0) + (d.low_rating?.created ?? 0) + (d.delivery_timeout?.created ?? 0)} 条，` +
          `其余为已有未处理告警（不重复入库）`
        )
        load()
      } else {
        message.error(res?.message ?? '扫描失败')
      }
    } catch {
      message.error('扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const submitHandle = async () => {
    if (!handleRow) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await handleRiskAlert(handleRow.id, values.status, values.remark)
      if (res?.code === 200) {
        message.success(values.status === 'handled' ? '已标记处理' : '已忽略')
        setHandleRow(null)
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

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="待处理告警" value={summary?.newCount ?? 0} suffix="条" /></Card></Col>
        <Col span={8}><Card><Statistic title="已处理" value={summary?.handledCount ?? 0} suffix="条" /></Card></Col>
        <Col span={8}><Card><Statistic title="已忽略" value={summary?.ignoredCount ?? 0} suffix="条" /></Card></Col>
      </Row>

      <Card
        title="风控规则（当期阈值）"
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
            <Button type="primary" icon={<SafetyOutlined />} loading={scanning} onClick={doScan}>执行扫描</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="扫描是按需触发的，不是定时任务"
          description="三条规则都依赖运营自己定的阈值，自动跑会让人不知道告警是按哪套阈值出来的。阈值在「系统配置 → 风控」里调整，改了下次扫描即生效。同一条规则 + 同一个对象在未处理时只保留一条，不会每次扫描都刷重复。"
        />
        <Table
          rowKey="ruleCode"
          size="small"
          pagination={false}
          dataSource={rules}
          columns={[
            { title: '规则', dataIndex: 'ruleName', width: 120 },
            { title: '等级', dataIndex: 'alertLevel', width: 80,
              render: (v: string) => <Tag color={LEVEL[v]?.color ?? 'default'}>{LEVEL[v]?.text ?? v}</Tag> },
            { title: '阈值配置键', dataIndex: 'thresholdKey', width: 260,
              render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
            { title: '当前阈值', dataIndex: 'thresholdValue', width: 110,
              render: (v: string) => v ?? '（用默认值）' },
            { title: '判定依据', dataIndex: 'description' }
          ]}
        />
      </Card>

      <Card title={`告警 ${total} 条`}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Select placeholder="处理状态" style={{ width: 130 }} allowClear
            onChange={(v) => setDraft((p) => ({ ...p, alertStatus: v }))}
            options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.text }))} />
          <Select placeholder="等级" style={{ width: 110 }} allowClear
            onChange={(v) => setDraft((p) => ({ ...p, alertLevel: v }))}
            options={Object.entries(LEVEL).map(([value, item]) => ({ value, label: item.text }))} />
          <Select placeholder="规则" style={{ width: 150 }} allowClear
            onChange={(v) => setDraft((p) => ({ ...p, ruleCode: v }))}
            options={rules.map((r) => ({ value: r.ruleCode, label: r.ruleName }))} />
          <Button type="primary" onClick={() => { setPage(1); setFilters(draft) }}>查询</Button>
          <Button onClick={() => { setDraft({}); setFilters({}); setPage(1) }}>重置</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1300 }}
          locale={{ emptyText: '还没有告警，点右上角「执行扫描」跑一次' }}
          pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
          columns={[
            { title: '告警编号', dataIndex: 'alertNo', width: 190, ellipsis: true },
            { title: '规则', dataIndex: 'ruleName', width: 110 },
            { title: '等级', dataIndex: 'alertLevel', width: 80,
              render: (v: string) => <Tag color={LEVEL[v]?.color ?? 'default'}>{LEVEL[v]?.text ?? v}</Tag> },
            { title: '对象', dataIndex: 'subjectName', width: 190,
              render: (v: string, row: RiskAlertRow) => `${SUBJECT_TYPE[row.subjectType] ?? row.subjectType}：${v ?? row.subjectId}` },
            { title: '告警', dataIndex: 'title', width: 200 },
            { title: '判定依据', dataIndex: 'detail', ellipsis: true },
            { title: '状态', dataIndex: 'alertStatus', width: 100,
              render: (v: string) => <Tag color={STATUS[v]?.color ?? 'default'}>{STATUS[v]?.text ?? v}</Tag> },
            { title: '检出时间', dataIndex: 'detectedAt', width: 170 },
            {
              title: '操作',
              width: 150,
              fixed: 'right' as const,
              render: (_: unknown, row: RiskAlertRow) => (
                <Space size={0}>
                  <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(row)}>详情</Button>
                  {row.alertStatus === 'new' && (
                    <Button type="link" onClick={() => { setHandleRow(row); form.setFieldsValue({ status: 'handled' }) }}>处理</Button>
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal title="处理告警" open={!!handleRow} onCancel={() => setHandleRow(null)} onOk={submitHandle}
        confirmLoading={saving} destroyOnClose>
        {handleRow && (
          <Descriptions bordered column={1} size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="告警">{handleRow.title}</Descriptions.Item>
            <Descriptions.Item label="判定依据">{handleRow.detail}</Descriptions.Item>
          </Descriptions>
        )}
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="这里只标记处理结果，不做处置动作"
          description="需要下架就走「商品与品类 → 违规下架」，需要介入交易就走纠纷仲裁 —— 各自留痕。忽略必须写原因，事后要能回答「当时为什么不看」。" />
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="处理结果" rules={[{ required: true, message: '请选择' }]}>
            <Select options={[
              { value: 'handled', label: '已处理（核实过并采取了动作）' },
              { value: 'ignored', label: '已忽略（判定为误报或无需处理）' }
            ]} />
          </Form.Item>
          <Form.Item name="remark" label="备注" extra="忽略时必填">
            <Input.TextArea rows={3} placeholder="例如：核实为同规格不同包装，价格正常" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="告警详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={720}>
        {detail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="告警编号">{detail.alertNo}</Descriptions.Item>
            <Descriptions.Item label="规则">{detail.ruleName}（{detail.ruleCode}）</Descriptions.Item>
            <Descriptions.Item label="对象">
              {SUBJECT_TYPE[detail.subjectType] ?? detail.subjectType}：{detail.subjectName ?? detail.subjectId}
            </Descriptions.Item>
            <Descriptions.Item label="告警">{detail.title}</Descriptions.Item>
            <Descriptions.Item label="判定依据">{detail.detail}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS[detail.alertStatus]?.color ?? 'default'}>{STATUS[detail.alertStatus]?.text ?? detail.alertStatus}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="检出时间">{detail.detectedAt}</Descriptions.Item>
            <Descriptions.Item label="处理人">{detail.handler ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="处理时间">{detail.handleTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="处理备注">{detail.handleRemark ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
