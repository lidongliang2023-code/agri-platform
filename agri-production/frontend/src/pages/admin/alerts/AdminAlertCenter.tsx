import { useEffect, useState } from 'react'
import { Alert as Notice, App, Button, Drawer, Form, Input, Modal, Select, Space, Tag } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ProColumns } from '@ant-design/pro-components'
import { closeAlert, getAdminAlert, listAdminAlerts } from '@/api/admin/alerts'
import type { Alert } from '@/types'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import '@/components/ProductionDetailCompact.css'
import Table from '@/components/ProductionTable'
import { Card, FarmFilter, MonitorPage, QueryError, displayTime, iotOpsUrl } from '../monitor/MonitorShared'

const states: Record<number, string> = { 1: '待处理', 2: '处理中', 3: '已处理', 4: '已忽略' }
const levels: Record<number, string> = { 1: '提示', 2: '一般', 3: '重要', 4: '紧急' }
const sources: Record<number, string> = { 1: '环境', 2: '设备', 3: '病虫害', 4: '任务', 5: '投入品' }
const measures = ['联系负责人排查', '跟进检查整改', '记录物联网运维进展', '记录现场处置结果']
function stateCode(value: string | null): number | undefined {
  if (!value) return undefined
  const aliases: Record<string, number> = { pending: 1, unhandled: 1, handling: 2, processing: 2, in_progress: 2, handled: 3, closed: 3, ignored: 4 }
  const n = aliases[value.toLowerCase()] ?? Number(value)
  return n >= 1 && n <= 4 ? n : undefined
}
const actionable = (row: Alert) => row.status === 1 || row.status === 2

/** 运营生产告警唯一办理列表，与用户端共用告警记录，不在此下发设备指令。 */
export default function AdminAlertCenter(): JSX.Element {
  const { message } = App.useApp()
  const qc = useQueryClient(), navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const farmId = params.get('farmId') || undefined
  const status = stateCode(params.get('status'))
  const levelValue = Number(params.get('alertLevel'))
  const alertLevel = levelValue >= 1 && levelValue <= 4 ? levelValue : undefined
  const [page, setPage] = useState(1), [size, setSize] = useState(20)
  const [selected, setSelected] = useState<React.Key[]>([])
  const [detail, setDetail] = useState<Alert>()
  const [targets, setTargets] = useState<Alert[]>([])
  const [busy, setBusy] = useState(false)
  const [detailBusy, setDetailBusy] = useState(false)
  const [form] = Form.useForm<{ measure: string; remark: string }>()
  const query = useQuery({ queryKey: ['admin-alerts-center', farmId, status, alertLevel, page, size],
    queryFn: () => listAdminAlerts({ pageNum: page, pageSize: size, farmId, status, alertLevel }), retry: false })
  const rows = query.data?.list ?? []
  useEffect(() => { setPage(1); setSelected([]); setDetail(undefined); setTargets([]) }, [farmId, status, alertLevel])
  useEffect(() => { setSelected([]) }, [query.data])
  const filter = (key: string, value?: string | number) => {
    const next = new URLSearchParams(params)
    if (value == null || value === '') next.delete(key)
    else next.set(key, String(value))
    setParams(next, { replace: true })
    setPage(1)
  }
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-alerts-center'] }),
      qc.invalidateQueries({ queryKey: ['admin-monitor-alerts'] }),
      qc.invalidateQueries({ queryKey: ['production-alerts'] }),
      qc.invalidateQueries({ queryKey: ['production-alerts-stats'] }),
      qc.invalidateQueries({ queryKey: ['production-alert-detail'] }),
    ])
  }
  const openDetail = async (row: Alert) => {
    setDetailBusy(true)
    try { setDetail(await getAdminAlert(row.alertId)) }
    catch (e) { message.error(e instanceof Error ? e.message : '详情读取失败') }
    finally { setDetailBusy(false) }
  }
  const openHandle = (items: Alert[]) => { form.resetFields(); setTargets(items.filter(actionable)) }
  const submit = async () => {
    if (busy || !targets.length) return
    let values: { measure: string; remark: string }
    try { values = await form.validateFields() } catch { return }
    setBusy(true)
    try {
      const result = await Promise.allSettled(targets.map(row => closeAlert(row.alertId, `${values.measure}：${values.remark.trim()}`)))
      await refresh()
      const failed = targets.filter((_, index) => result[index].status === 'rejected')
      setDetail(undefined)
      if (failed.length) {
        setTargets(failed)
        message.error(`已保存 ${targets.length - failed.length} 条，失败 ${failed.length} 条；仅保留失败项，请核对后重试`)
      } else {
        setTargets([])
        message.success('处置进展已保存：待处理进入处理中，处理中进入已处理')
      }
    } catch (e) { message.error(e instanceof Error ? e.message : '保存失败，请刷新核验') }
    finally { setBusy(false) }
  }
  const columns: ProColumns<Alert>[] = [
    { title: '告警事项', dataIndex: 'alertTitle', width: 240, render: (_, row) => <Button type="link" loading={detailBusy} onClick={() => void openDetail(row)}>{row.alertTitle || row.alertId}</Button> },
    { title: '告警编号', dataIndex: 'alertNo', width: 180 },
    { title: '农场编号', dataIndex: 'farmId', width: 150 },
    { title: '地块', dataIndex: 'plotName', width: 160, render: (_, row) => row.plotName || row.plotId || '—' },
    { title: '来源', width: 95, render: (_, row) => sources[row.alertSource] || '未分类' },
    { title: '级别', width: 90, render: (_, row) => <Tag color={row.alertLevel === 4 ? 'red' : row.alertLevel === 3 ? 'orange' : 'default'}>{levels[row.alertLevel] || '未分级'}</Tag> },
    { title: '状态', width: 95, render: (_, row) => <Tag color={actionable(row) ? 'orange' : 'default'}>{states[row.status] || '未知状态'}</Tag> },
    { title: '触发时间', width: 175, render: (_, row) => displayTime(row.triggeredAt) },
    { title: '操作', valueType: 'option', fixed: 'right', width: 245, render: (_, row) => [
      <Button key="detail" type="link" onClick={() => void openDetail(row)}>详情</Button>,
      <Button key="handle" type="link" disabled={!actionable(row) || busy} onClick={() => openHandle([row])}>{row.status === 2 ? '完成处置' : '介入'}</Button>,
      <Button key="check" type="link" disabled={!row.farmId} onClick={() => navigate(`/admin/production/farms/compliance?farmId=${encodeURIComponent(row.farmId!)}`)}>检查整改</Button>,
    ] },
  ]
  return <MonitorPage title="生产告警处置与复盘" subTitle="统一生产告警台账、处置进展与历史复盘" extra={<Space wrap>
    <Button onClick={() => navigate('/admin/production/monitor/tasks')}>任务监控</Button>
    <Button onClick={() => navigate('/admin/production/monitor/environment')}>环境数据</Button>
    <Button onClick={() => window.location.assign(iotOpsUrl('workorders'))}>物联网运维</Button>
    <Button onClick={() => navigate('/admin/production/alerts/emergency')}>应急预案</Button>
  </Space>}>
    <Notice showIcon type="info" message="与用户端共用生产告警；此处记录处置进展。设备指令和维修在物联网办理，农场问题进入检查整改；已处理和已忽略记录只读。" />
    <QueryError error={query.error} />
    <Card title="生产告警台账">
      <Space wrap style={{ marginBottom: 12 }}>
        <FarmFilter value={farmId} onChange={value => filter('farmId', value)} />
        <Select allowClear aria-label="告警状态" value={status} placeholder="全部状态" style={{ width: 150 }} options={Object.entries(states).map(([value, label]) => ({ value: Number(value), label }))} onChange={value => filter('status', value)} />
        <Select allowClear aria-label="告警级别" value={alertLevel} placeholder="全部级别" style={{ width: 150 }} options={Object.entries(levels).map(([value, label]) => ({ value: Number(value), label }))} onChange={value => filter('alertLevel', value)} />
        <Button onClick={() => { setParams({}, { replace: true }); setPage(1) }}>重置</Button>
        <Button onClick={() => filter('status', 3)}>已处理复盘</Button>
      </Space>
      <Table<Alert> rowKey="alertId" columns={columns} dataSource={rows} loading={query.isFetching} search={false}
        columnWidthStorageKey="admin-production-alerts" options={{ reload: () => void refresh(), density: true, setting: true }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: row => ({ disabled: !actionable(row) || busy }) }}
        toolBarRender={() => [<Button key="handle" disabled={!selected.length || busy} onClick={() => openHandle(rows.filter(row => selected.includes(row.alertId)))}>批量登记进展（{selected.length}）</Button>]}
        pagination={{ current: page, pageSize: size, total: query.data?.total ?? 0, showSizeChanger: true, onChange: (p, s) => { setPage(s === size ? p : 1); setSize(s); setSelected([]) } }} />
    </Card>
    <Modal rootClassName="production-form-dialog" title="登记告警处置进展" open={!!targets.length} confirmLoading={busy} onOk={() => void submit()} onCancel={() => { if (!busy) setTargets([]) }} okText="保存进展">
      <Notice type="info" showIcon message={`本次处理 ${targets.length} 条；待处理进入处理中，处理中进入已处理。此操作不执行设备指令。`} />
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="measure" label="处理措施" rules={[{ required: true }]}><Select options={measures.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="remark" label="处理说明" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} maxLength={250} showCount /></Form.Item>
      </Form>
    </Modal>
    <Drawer rootClassName="production-detail-compact production-detail-dialog" title="生产告警详情" width={720} open={!!detail} onClose={() => setDetail(undefined)} extra={detail && actionable(detail) ? <Button type="primary" onClick={() => { openHandle([detail]); setDetail(undefined) }}>登记进展</Button> : undefined}>
      {detail && <DetailInfoGrid items={[
        { label: '告警编号', value: detail.alertNo }, { label: '告警事项', value: detail.alertTitle },
        { label: '农场编号', value: detail.farmId }, { label: '地块', value: detail.plotName || detail.plotId },
        { label: '告警来源', value: sources[detail.alertSource] || '未分类' }, { label: '级别', value: levels[detail.alertLevel] || '未分级' },
        { label: '状态', value: states[detail.status] || '未知状态' }, { label: '触发时间', value: displayTime(detail.triggeredAt) },
        { label: '关联设备', value: detail.deviceId }, { label: '触发值', value: detail.triggerValue },
        { label: '告警内容', value: detail.alertContent, fullWidth: true }, { label: '处理人', value: detail.handlerName },
        { label: '处理时间', value: displayTime(detail.handledAt) }, { label: '处置记录', value: <span style={{ whiteSpace: 'pre-wrap' }}>{detail.handleRemark || '尚无记录'}</span>, fullWidth: true },
      ]} />}
    </Drawer>
  </MonitorPage>
}
