import { useState } from 'react'
import { Alert, App, Button, Card, Collapse, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createReportTask,
  downloadAdminReportFile,
  generateAdminReportFile,
  getAdminReportTask,
  listAdminReports,
  type ReportTask,
} from '@/api/admin/reports'
import ProductionTable from '@/components/ProductionTable'
import { PlusOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { supervisionFarms } from '@/api/admin/farm-supervision'
import type { Farm } from '@/types'

const STATUS: Record<string, string> = { PENDING: '待生成', RUNNING: '生成中', DONE: '已生成', FAILED: '失败' }

export default function ReportCenter() {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>()
  const [reportType, setReportType] = useState<string>()
  const [farmId, setFarmId] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [searchText, setSearchText] = useState('')
  const [draftStatus, setDraftStatus] = useState<string>()
  const [draftType, setDraftType] = useState<string>()
  const [draftFarm, setDraftFarm] = useState<string>()
  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs] | null>(null)
  const applyFilters = () => {
    setKeyword(searchText.trim())
    setStatus(draftStatus)
    setReportType(draftType)
    setFarmId(draftFarm)
    setRange(draftRange)
    setPage(1)
  }
  const resetFilters = () => {
    setSearchText(''); setKeyword('')
    setDraftStatus(undefined); setStatus(undefined)
    setDraftType(undefined); setReportType(undefined)
    setDraftFarm(undefined); setFarmId(undefined)
    setDraftRange(null); setRange(null); setPage(1)
  }
  const filterCount = [keyword, status, reportType, farmId, range].filter(Boolean).length
  const farms = useQuery({queryKey: ['report-farm-options'], queryFn: async () => {
    const result: Farm[] = []
    for (let pageNum = 1; ; pageNum++) {
      const data = await supervisionFarms({pageNum, pageSize: 100})
      if (!Array.isArray(data.list)) throw new Error('农场列表结构异常')
      result.push(...data.list)
      if (result.length >= data.total) return result
      if (!data.list.length) throw new Error('农场列表不完整，请重试')
    }
  }, retry: false})
  const farmOptions = farms.data?.map(f => ({value: String(f.farmId), label: `${f.farmName}（${f.farmId}）`})) ?? []
  const farmLabel = (id?: string) => id == null ? '全平台' : farmOptions.find(f => f.value === String(id))?.label ?? `农场 ID：${id}`
  const datePresets = [
    {label:'本月', value:[dayjs().startOf('month'), dayjs()] as [Dayjs,Dayjs]},
    {label:'近30天', value:[dayjs().subtract(29,'day'), dayjs()] as [Dayjs,Dayjs]},
    {label:'本年', value:[dayjs().startOf('year'), dayjs()] as [Dayjs,Dayjs]},
  ]
  const [open, setOpen] = useState(false)
  const [actionCode, setActionCode] = useState<string | null>(null)
  const [form] = Form.useForm<{ reportName: string; reportType: string; farmId?: string; range: [Dayjs, Dayjs] }>()

  const query = useQuery({
    queryKey: ['admin-report-tasks', page, size, keyword, status, reportType, farmId, range?.[0]?.format('YYYY-MM-DD'), range?.[1]?.format('YYYY-MM-DD')],
    queryFn: () => listAdminReports({ pageNum: page, pageSize: size, keyword, status, reportType, farmId, startDate: range?.[0]?.format('YYYY-MM-DD'), endDate: range?.[1]?.format('YYYY-MM-DD') }),
    retry: false,
  })

  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const code = await createReportTask({
        reportName: v.reportName.trim(),
        reportType: v.reportType,
        farmId: v.farmId,
        bizDateFrom: v.range[0].format('YYYY-MM-DD'),
        bizDateTo: v.range[1].format('YYYY-MM-DD'),
      })
      const check = await getAdminReportTask(code)
      if (
        check.reportId !== code ||
        check.reportType !== v.reportType ||
        String(check.farmId ?? '') !== String(v.farmId ?? '') ||
        check.reportName !== v.reportName.trim() ||
        check.bizDateFrom !== v.range[0].format('YYYY-MM-DD') ||
        check.bizDateTo !== v.range[1].format('YYYY-MM-DD')
      ) {
        throw new Error('任务已提交，但回读未确认，请刷新核对，勿重复提交')
      }
      return code
    },
    onSuccess: () => {
      message.success('报表任务已登记并回读确认')
      setOpen(false)
      form.resetFields()
      void client.invalidateQueries({ queryKey: ['admin-report-tasks'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const handleGenerate = async (code: string) => {
    setActionCode(code)
    try {
      const res = await generateAdminReportFile(code)
      if (res.status === 'DONE') {
        message.success('报表快照已生成')
      } else {
        message.warning(`报表生成状态为：${STATUS[res.status ?? ''] ?? res.status ?? '未知'}`)
      }
      void client.invalidateQueries({ queryKey: ['admin-report-tasks'] })
    } catch (e) {
      message.error((e as Error)?.message ?? '触发生成失败')
    } finally {
      setActionCode(null)
    }
  }

  const handleDownload = async (row: ReportTask) => {
    setActionCode(row.reportId)
    try {
      await downloadAdminReportFile(row.reportId, `${row.reportName || row.reportId}.csv`)
      message.success('报表下载已开始')
    } catch (e) {
      message.error((e as Error)?.message ?? '下载失败')
    } finally {
      setActionCode(null)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          生产与质量报表
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          登记报表任务
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        message="统一管理生产与质量报表任务及快照"
        description="支持即时登记并触发生成真实 CSV 报表快照。快照基于生产、质量及告警事实生成并落盘，未生成前不可下载，无业务记录时如实显示为零；已生成快照保持不变。"
      />

      <Card size="small">
        <Form layout="inline" onFinish={applyFilters} style={{ rowGap: 12 }}>
          <Form.Item label="名称 / 编号">
            <Input placeholder="搜索报表名称或编号" allowClear value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 230 }} />
          </Form.Item>
          <Form.Item label="状态">
            <Select allowClear value={draftStatus} placeholder="全部状态" style={{ width: 140 }} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} onChange={setDraftStatus} />
          </Form.Item>
          <Form.Item label="类型">
            <Select allowClear value={draftType} placeholder="全部类型" style={{ width: 150 }} options={[{value:'GOV',label:'生产监管'},{value:'QUALITY',label:'质量'},{value:'BIZ',label:'生产经营'}]} onChange={setDraftType} />
          </Form.Item>
          <Form.Item label="农场">
            <Select allowClear showSearch optionFilterProp="label" value={draftFarm} placeholder="全部农场范围" loading={farms.isFetching} style={{width:260}} options={farmOptions} onChange={setDraftFarm} />
          </Form.Item>
          <Form.Item label="统计期间">
            <DatePicker.RangePicker value={draftRange} presets={datePresets} placeholder={['开始日期','结束日期']} onChange={v=>setDraftRange(v?.[0] && v?.[1] ? [v[0],v[1]] : null)} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={query.isFetching}>查询</Button>
              <Button icon={<UndoOutlined />} onClick={resetFilters}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary" style={{margin:'12px 0 0'}}>日期匹配与所选期间有交集的报表；调整条件后点击查询，列表筛选不改变已生成快照。</Typography.Paragraph>
      </Card>

      {farms.isError && <Alert type="error" message="农场选项读取失败" action={<Button onClick={()=>void farms.refetch()}>重试</Button>} />}
      <Collapse size="small" items={[{key:'metrics',label:'指标口径与快照说明',children:<Typography.Paragraph style={{margin:0}}>任务按计划开始日，采收按采收日，检测按采样日，告警按创建日统计；地块与面积为生成时点在册值。任务验收完成率=验收通过任务/期间任务；检测合格率仅以已完成且结论明确的检测为分母；告警处置完成率以明确已处理或关闭为完成。无分母显示—，合计按数量加权。经营报表不含未接入的交易金额。</Typography.Paragraph>}]} />
      {query.data?.unavailableReason || query.isError ? (
        <Alert
          type="error"
          showIcon
          message={query.data?.unavailableReason || '报表读取失败'}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      ) : null}

      <ProductionTable<ReportTask>
        headerTitle={<Space wrap><span>报表任务</span><Tag>{query.isSuccess && !query.data?.unavailableReason ? `共 ${query.data?.total ?? 0} 份` : '数量待确认'}</Tag>{filterCount > 0 && <Tag color="blue">已应用 {filterCount} 项筛选</Tag>}</Space>}
        search={false}
        columnWidthStorageKey="admin-report-list"
        columnsState={{ persistenceKey: 'production-admin-report-columns-v1', persistenceType: 'localStorage' }}
        options={{ reload: () => { void query.refetch() }, density: true, setting: true, fullScreen: true }}
        locale={{ emptyText: filterCount ? '没有匹配的报表，请调整筛选条件或重置' : '暂无报表任务，点击右上方登记报表任务' }}
        rowKey="reportId"
        loading={query.isFetching}
        dataSource={query.data?.list ?? []}
        scroll={{ x: 1350 }}
        pagination={{
          current: page,
          pageSize: size,
          total: query.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 份`,
          onChange: (p, s) => {
            setPage(s === size ? p : 1)
            setSize(s)
          },
        }}
        columns={[
          { title: '报表编号', dataIndex: 'reportId', width: 230 },
          { title: '名称', dataIndex: 'reportName', width: 200 },
          {
            title: '类型',
            dataIndex: 'reportType',
            width: 110,
            render: (v) => ({ GOV: '生产监管', BIZ: '经营', QUALITY: '质量' }[v as string] ?? v),
          },
          {
            title: '统计期间',
            key: 'period',
            width: 220,
            render: (_, r) => `${r.bizDateFrom ?? '—'} 至 ${r.bizDateTo ?? '—'}`,
          },
          { title: '农场范围', key: 'farm', width: 220, render: (_, row) => farmLabel(row.farmId) },
          { title: '创建人 ID', dataIndex: 'generatorId', width: 150 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v) => (
              <Tag color={v === 'DONE' ? 'green' : v === 'FAILED' ? 'red' : 'default'}>
                {STATUS[v as string] ?? v ?? '—'}
              </Tag>
            ),
          },
          {
            title: '生成时间',
            dataIndex: 'generatedAt',
            width: 180,
            render: (v) => v || '—',
          },
          {
            title: '操作',
            key: 'actions',
            hideInSetting: true,
            width: 180,
            fixed: 'right',
            render: (_, row) => {
              const busy = actionCode === row.reportId
              const isDone = row.status === 'DONE'
              return (
                <Space size={8}>
                  {!isDone && <Popconfirm
                    title="确认生成当前统计期间的报表快照？"
                    onConfirm={() => void handleGenerate(row.reportId)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="link" size="small" loading={busy} disabled={actionCode !== null}>
                      {row.status === 'FAILED' ? '重试生成' : '生成快照'}
                    </Button>
                  </Popconfirm>}
                  {isDone ? (
                    <Button type="link" size="small" loading={busy} onClick={() => void handleDownload(row)}>
                      下载
                    </Button>
                  ) : (
                    <Button type="link" size="small" disabled>
                      待生成
                    </Button>
                  )}
                </Space>
              )
            },
          },
        ]}
      />

      <Modal
        title="登记报表任务"
        open={open}
        confirmLoading={save.isPending}
        onCancel={() => {
          if (!save.isPending) setOpen(false)
        }}
        onOk={() => save.mutate()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{reportType:'GOV'}}>
          <Form.Item name="reportName" label="报表名称" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="reportType" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'GOV', label: '生产监管' },
                { value: 'QUALITY', label: '质量' },
                { value: 'BIZ', label: '经营' },
              ]}
            />
          </Form.Item>
          <Form.Item name="farmId" label="农场范围" extra="不选时统计全平台农场；所选范围将固化到任务与快照。">
            <Select allowClear showSearch optionFilterProp="label" loading={farms.isFetching} options={farmOptions} placeholder="全平台" />
          </Form.Item>
          <Form.Item name="range" label="统计期间" rules={[{ required: true }]}>
            <DatePicker.RangePicker presets={datePresets} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
