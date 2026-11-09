import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Tabs, Tag } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import dayjs from 'dayjs'
import PageContainer from '@/components/ProductionPageContainer'
import ProTable from '@/components/ProductionTable'
import useAuthStore from '@/store/auth'
import useFarmStore from '@/store/farm'
import { deleteReport, exportReport, generateReport, listReports, listReportSubscriptions, unsubscribeReport } from '@/api/analytics'
import type { ReportSubscription } from '@/api/analytics'
import type { ReportItem } from '@/types'

const TYPES = ['日报', '周报', '月报', '季报', '年报'].map((label, i) => ({ label, value: i + 1 }))
export default function ProductionReports(): JSX.Element {
  const subject = useAuthStore(s => s.userInfo?.tenantId)
  return <ReportContent key={String(subject ?? '')} subject={String(subject ?? '')} />
}
function ReportContent({ subject }: { subject: string }): JSX.Element {
  const { message } = App.useApp()
  const farm = useFarmStore(s => s.currentFarm)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [reportType, setType] = useState<number>()
  const [period, setPeriod] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState('')
  const [form] = Form.useForm<{ reportType: number; period: dayjs.Dayjs }>()
  const current = () => String(useAuthStore.getState().userInfo?.tenantId ?? '') === subject
  const list = useQuery({ queryKey: ['reports', subject, page, size, reportType, period], queryFn: () => listReports({ pageNum: page, pageSize: size, reportType, period: period || undefined }), enabled: !!subject, retry: false })
  const subscriptions = useQuery({ queryKey: ['report-subscriptions', subject], queryFn: listReportSubscriptions, enabled: !!subject, retry: false })
  const submit = async () => {
    let values: { reportType: number; period: dayjs.Dayjs }
    try { values = await form.validateFields() } catch { return }
    setBusy(true)
    let written = false
    try {
      if (!current()) return
      const result = await generateReport({ reportType: values.reportType, period: values.period.format('YYYY-MM-DD'), farmId: farm?.farmId })
      written = true
      if (!current()) return
      const readback = await listReports({ pageNum: 1, pageSize: 10, period: result.period })
      if (!readback.list.some(row => row.reportId === result.reportId)) throw new Error('生成请求已成功，但列表回读未找到该报表，请刷新核对')
      setOpen(false); setPage(1)
      await list.refetch()
      message.success('报表已生成并回读确认')
    } catch (e) { if (current()) message.error(`${written ? '生成后核验未完成：' : '生成失败：'}${(e as Error).message}`) }
    finally { if (current()) setBusy(false) }
  }
  const remove = async (id: string) => {
    setRowBusy(id)
    try { if (!await deleteReport(id)) throw new Error('服务端未确认删除'); if (current()) { await list.refetch(); message.success('报表已删除') } }
    catch (e) { if (current()) message.error((e as Error).message) }
    finally { if (current()) setRowBusy('') }
  }
  const download = async (id: string) => {
    setRowBusy(id)
    try {
      const result = await exportReport(id)
      if (!current()) return
      const url = new URL(result.fileUrl, window.location.origin)
      if (url.origin !== window.location.origin || !/\/analytics\/reports\/[^/]+\/file$/.test(url.pathname)) throw new Error('导出地址不符合本站报表下载规则')
      const anchor = document.createElement('a'); anchor.href = url.href; anchor.download = ''; anchor.click()
    } catch (e) { if (current()) message.error(`导出失败：${(e as Error).message}`) }
    finally { if (current()) setRowBusy('') }
  }
  const columns: ProColumns<ReportItem>[] = [
    { title: '报表名称', dataIndex: 'reportName', width: 260, ellipsis: true },
    { title: '类型', dataIndex: 'reportType', width: 100, render: (_, r) => TYPES.find(t => t.value === r.reportType)?.label ?? '—' },
    { title: '统计周期', dataIndex: 'period', width: 180 },
    { title: '生成时间', dataIndex: 'generatedAt', width: 185 },
    { title: '生成人', dataIndex: 'generatorName', width: 140, renderText: value => value || '未记录' },
    { title: '状态', dataIndex: 'status', width: 110, render: (_, r) => <Tag color={r.status === 2 ? 'success' : 'default'}>{r.status === 2 ? '已生成' : r.status === 3 ? '失败' : '生成中'}</Tag> },
    { title: '操作', valueType: 'option', fixed: 'right', width: 190, render: (_, r) => <Space><Button type="link" disabled={r.status !== 2 || !!rowBusy} onClick={() => void download(r.reportId)}>下载 CSV</Button><Popconfirm title="删除这份报表记录？" onConfirm={() => remove(r.reportId)}><Button type="link" danger disabled={!!rowBusy}>删除</Button></Popconfirm></Space> },
  ]
  const subColumns: ProColumns<ReportSubscription>[] = [
    { title: '报表类型', dataIndex: 'reportType', width: 150, render: (_, r) => TYPES.find(t => t.value === r.reportType)?.label ?? '—' },
    { title: '配置周期', dataIndex: 'period', width: 150 },
    { title: '接收人', dataIndex: 'receivers', width: 260, render: (_, r) => r.receivers.join('、') },
    { title: '执行情况', key: 'execution', width: 240, render: () => '仅保存配置，自动推送未接入' },
    { title: '操作', valueType: 'option', fixed: 'right', width: 120, render: (_, r) => <Popconfirm title="取消这条历史通知配置？" onConfirm={async () => { try { if (!await unsubscribeReport(r.subscribeId)) throw new Error('服务端未确认取消'); await subscriptions.refetch(); message.success('已取消') } catch (e) { message.error((e as Error).message) } }}><Button type="link" danger>取消配置</Button></Popconfirm> },
  ]
  return <PageContainer title="生产报表" subTitle="按实际生产记录生成周期快照，按经营主体归档" extra={<Space><Button type="primary" disabled={!subject} onClick={() => { form.setFieldsValue({ reportType: 3, period: dayjs() }); setOpen(true) }}>+ 生成报表</Button><Button onClick={() => { void list.refetch(); void subscriptions.refetch() }}>刷新</Button></Space>}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert showIcon type="info" message={`本次生成范围：${farm?.farmName ?? '当前主体全部农场'}；历史列表展示当前主体全部报表`} description="日报、周报、月报、季报、年报按所选日期归属周期生成；采收量统一为 kg，任务完成以验收通过为准。无实际成本和收入来源，不生成成本收益结论。历史快照不会自动重算。" />
      <Tabs items={[
        { key: 'reports', label: '报表归档', children: <Space direction="vertical" style={{ width: '100%' }}>
          {list.isError && <Alert type="error" message="报表查询失败" description={(list.error as Error).message} />}
          <ProTable<ReportItem> rowKey="reportId" headerTitle="生产报表" search={false} columns={columns} dataSource={list.isError ? [] : list.data?.list ?? []} loading={list.isFetching} scroll={{ x: 1200 }} columnWidthStorageKey="production-reports" columnsState={{ persistenceKey: 'production-reports-columns', persistenceType: 'localStorage' }} options={{ reload: () => { void list.refetch() } }} toolbar={{ actions: [<Select key="type" allowClear placeholder="全部类型" options={TYPES} value={reportType} onChange={v => { setType(v); setPage(1) }} style={{ width: 130 }} />, <Input.Search key="period" allowClear placeholder="搜索报表名称或周期" onSearch={v => { setPeriod(v.trim()); setPage(1) }} style={{ width: 240 }} />] }} toolBarRender={() => [<Button key="generate" type="primary" disabled={!subject} onClick={() => { form.setFieldsValue({ reportType: 3, period: dayjs() }); setOpen(true) }}>生成报表</Button>]} pagination={{ current: page, pageSize: size, total: list.data?.total ?? 0, showSizeChanger: true, onChange: (p, s) => { setPage(s === size ? p : 1); setSize(s) } }} />
        </Space> },
        { key: 'subscriptions', label: '历史通知配置', children: <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="warning" showIcon message="自动通知尚未接入" description="站内、邮件、微信均无自动推送执行端。本页仅查看或取消历史配置，暂不新增无执行能力的通知；请在报表归档中主动生成与下载。" />
          {subscriptions.isError && <Alert type="error" message="通知配置读取失败" description={(subscriptions.error as Error).message} />}
          <ProTable<ReportSubscription> rowKey="subscribeId" headerTitle="历史通知配置" search={false} columns={subColumns} dataSource={subscriptions.isError ? [] : subscriptions.data ?? []} loading={subscriptions.isFetching} scroll={{ x: 1000 }} columnWidthStorageKey="report-subscriptions" options={{ reload: () => { void subscriptions.refetch() } }} pagination={{ defaultPageSize: 10 }} />
        </Space> },
      ]} />
    </Space>
    <Modal title="生成生产报表" open={open} confirmLoading={busy} closable={!busy} maskClosable={false} cancelButtonProps={{ disabled: busy }} onCancel={() => setOpen(false)} onOk={() => void submit()}>
      <Alert type="info" message={`生成范围：${farm?.farmName ?? '当前主体全部农场'}`} style={{ marginBottom: 16 }} />
      <Form form={form} layout="vertical"><Form.Item name="reportType" label="报表周期" rules={[{ required: true }]}><Select options={TYPES} /></Form.Item><Form.Item name="period" label="周期内任意一天" rules={[{ required: true }]}><DatePicker allowClear={false} /></Form.Item></Form>
    </Modal>
  </PageContainer>
}
