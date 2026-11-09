import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Col, DatePicker, Empty, Row, Segmented, Space, Statistic } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ProColumns } from '@ant-design/pro-components'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import PageContainer from '@/components/ProductionPageContainer'
import ProTable from '@/components/ProductionTable'
import useFarmStore from '@/store/farm'
import useAuthStore from '@/store/auth'
import { getAnalyticsDimension, getAnalysisTrend } from '@/api/analytics'
import type { AnalyticsDimension, DimensionPoint } from '@/api/analytics'

export default function AnalyticsOverview(): JSX.Element {
  const navigate = useNavigate()
  const farm = useFarmStore(s => s.currentFarm)
  const subject = useAuthStore(s => s.userInfo?.tenantId)
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
  const [dimension, setDimension] = useState<AnalyticsDimension>('crop')
  const [metricCode, setMetricCode] = useState<'YIELD' | 'PASS_RATE'>('YIELD')
  const args = { farmId: farm?.farmId, startDate: range[0].format('YYYY-MM-DD'), endDate: range[1].format('YYYY-MM-DD') }
  const dimensions = useQuery({ queryKey: ['analysis-dimension', subject, args, dimension], queryFn: () => getAnalyticsDimension({ ...args, dimension }), enabled: !!subject, retry: false, refetchOnWindowFocus: true })
  const trend = useQuery({ queryKey: ['analysis-trend', subject, args, metricCode], queryFn: () => getAnalysisTrend({ ...args, metricCode }), enabled: !!subject, retry: false, refetchOnWindowFocus: true })
  const rows = dimensions.isError ? [] : dimensions.data ?? []
  const total = rows.reduce((sum, row) => ({ yield: sum.yield + Number(row.yieldQty ?? 0), tasks: sum.tasks + row.taskCount, done: sum.done + row.doneCount }), { yield: 0, tasks: 0, done: 0 })
  const refresh = () => { void dimensions.refetch(); void trend.refetch() }
  const columns: ProColumns<DimensionPoint>[] = [
    { title: dimension === 'crop' ? '作物' : dimension === 'plot' ? '地块' : '月份', dataIndex: 'name', width: 220 },
    { title: '采收量（kg）', dataIndex: 'yieldQty', width: 180, render: (_, r) => Number(r.yieldQty ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 }) },
    { title: '涉及地块面积（亩）', dataIndex: 'areaMu', width: 180 },
    { title: '排期任务数', dataIndex: 'taskCount', width: 150 },
    { title: '验收通过任务数', dataIndex: 'doneCount', width: 170 },
    { title: '验收完成率', key: 'rate', width: 150, render: (_, r) => r.taskCount ? `${(r.doneCount / r.taskCount * 100).toFixed(1)}%` : '—' },
    { title: '操作', valueType: 'option', width: 150, fixed: 'right', render: () => <Button type="link" onClick={() => navigate('/production/harvests')}>查看采收台账</Button> },
  ]
  const number = (n: number) => dimensions.isSuccess ? n.toLocaleString('zh-CN', { maximumFractionDigits: 3 }) : '—'
  return <PageContainer title="数据分析总览" subTitle={`统计范围：${farm?.farmName ?? '当前主体全部农场'}`} extra={<Space><Button onClick={() => navigate('/production/analytics/reports')}>生成生产报表</Button><Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button></Space>}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card><Space wrap size={16}><span>统计日期</span><DatePicker.RangePicker value={range} allowClear={false} onChange={v => { if (v?.[0] && v[1]) setRange([v[0], v[1]]) }} /><Button onClick={() => setRange([dayjs().subtract(29, 'day'), dayjs()])}>近30天</Button><Button onClick={() => setRange([dayjs().startOf('month'), dayjs()])}>本月</Button><span>农场范围跟随顶部选择器</span></Space></Card>
      <Alert type="info" showIcon message="统计口径" description="采收按采收日期、任务按计划开始日期统计；完成须验收通过。重量统一换算为 kg，无法换算时明确报错，不混单位累加。面积为期间涉及地块去重面积，不能跨月份求和。成本与产值尚无实际账务来源，本页不推算投入产出比。" />
      {!subject && <Alert type="warning" message="请先选择经营主体" />}
      {dimensions.isError && <Alert type="error" showIcon message="维度统计查询失败" description={(dimensions.error as Error).message} action={<Button onClick={() => void dimensions.refetch()}>重试</Button>} />}
      <Row gutter={[16, 16]}>{[['期间采收量（kg）', number(total.yield)], ['排期任务数', number(total.tasks)], ['验收通过任务数', number(total.done)], ['验收完成率', dimensions.isSuccess && total.tasks ? `${(total.done / total.tasks * 100).toFixed(1)}%` : '—']].map(([title, value]) => <Col xs={24} sm={12} xl={6} key={title}><Card><Statistic title={title} value={value} /></Card></Col>)}</Row>
      <Card title="生产趋势" extra={<Segmented value={metricCode} options={[{ label: '采收量（kg）', value: 'YIELD' }, { label: '检测合格率（%）', value: 'PASS_RATE' }]} onChange={v => setMetricCode(v as 'YIELD' | 'PASS_RATE')} />} loading={trend.isFetching}>
        {trend.isError ? <Alert type="error" message="趋势查询失败" description={(trend.error as Error).message} action={<Button onClick={() => void trend.refetch()}>重试</Button>} /> : !trend.data?.length ? <Empty description="所选期间暂无记录" /> : <ReactECharts style={{ height: 300 }} option={{ tooltip: { trigger: 'axis' }, grid: { left: 65, right: 24, bottom: 50 }, xAxis: { type: 'category', data: trend.data.map(p => p.bizDate) }, yAxis: { type: 'value', name: metricCode === 'YIELD' ? 'kg' : '%', ...(metricCode === 'PASS_RATE' ? { max: 100 } : {}) }, series: [{ type: 'line', smooth: false, connectNulls: false, data: trend.data.map(p => p.metricValue), itemStyle: { color: '#167b51' } }] }} />}
      </Card>
      <ProTable<DimensionPoint> rowKey="name" headerTitle="维度分析" columns={columns} dataSource={rows} loading={dimensions.isFetching} search={false} scroll={{ x: 1200 }} columnWidthStorageKey="analysis-dimensions" columnsState={{ persistenceKey: 'analysis-dimensions-columns', persistenceType: 'localStorage' }} options={{ reload: () => { void dimensions.refetch() } }} toolbar={{ actions: [<Segmented key="dimension" value={dimension} options={[{ label: '按作物', value: 'crop' }, { label: '按地块', value: 'plot' }, { label: '按月份', value: 'month' }]} onChange={v => setDimension(v as AnalyticsDimension)} />] }} pagination={{ defaultPageSize: 10, showSizeChanger: true }} />
    </Space>
  </PageContainer>
}
