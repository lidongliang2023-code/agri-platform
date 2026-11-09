import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert, App, Button, Card, Col, Empty, List, Row, Segmented, Skeleton, Space, Statistic, Tag, Typography } from 'antd'
import { ReloadOutlined, ArrowRightOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { http } from '@/utils/request'
import useFarmStore from '@/store/farm'
import { taskStatusMeta } from '@/utils/production-adapter'

interface Dashboard {
  asOf: string; from: string; to: string; farmId: string | null
  missingQuantityCount: number
  plotCount: number; totalArea: number; plantingArea: number; activePlanCount: number
  yieldKg: number; periodYieldKg: number; periodBatchCount: number; unconverted: Record<string, number>
  pendingTaskCount: number; completedTaskCount: number; overdueTaskCount: number
  alertCount: number; passCount: number; failCount: number; passRate: number | null; pendingInspectionCount: number
  todos: { id: string; name: string; status: string; executor?: string; due?: string }[]
  alerts: { id: string; title: string; level: string; time?: string }[]
  trend: { date: string; value: number }[]
  plots: { id: string; name: string; area: number; planting: boolean; crop?: string }[]
}

/** 生产事实的只读聚合，写操作进入对应业务页面完成。 */
export default function ProductionOverview(): JSX.Element {
  const farm = useFarmStore(s => s.currentFarm)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [days, setDays] = useState(30)
  const query = useQuery({
    queryKey: ['production-dashboard-v2', farm?.farmId, days],
    queryFn: () => http.get<Dashboard>('/analytics/dashboard', { farmId: farm?.farmId, days }, { silent: true }),
    enabled: !!farm?.farmId,
    refetchOnMount: 'always', refetchOnWindowFocus: true, staleTime: 0,
    refetchInterval: 30000,
  })
  const d = query.data
  const go = (path: string): void => navigate(`/production/${path}`)
  const refresh = async (): Promise<void> => {
    const result = await query.refetch()
    if (result.isError) message.error('刷新失败，请重试')
    else message.success('已更新为当前业务数据')
  }
  const metric = (title: string, value: number | null, suffix: string, path: string): JSX.Element => (
    <Col xs={24} sm={12} xl={6} key={title}>
      <Card size="small"><Statistic title={title} value={value ?? '—'} precision={value !== null && !Number.isInteger(value) ? 2 : 0} suffix={suffix} />
        <Button type="link" size="small" onClick={() => go(path)}>查看明细 <ArrowRightOutlined /></Button>
      </Card>
    </Col>
  )
  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Row align="middle" justify="space-between" gutter={[16, 12]}>
      <Col><Typography.Title level={3} style={{ margin: 0 }}>生产数据看板</Typography.Title>
        <Typography.Text type="secondary">{farm?.farmName ?? '请选择当前农场'} · 生产概况、待办处理与趋势分析</Typography.Text></Col>
      <Col><Space wrap><Segmented value={days} options={[{ label: '近7天', value: 7 }, { label: '近30天', value: 30 }, { label: '近90天', value: 90 }]} onChange={v => setDays(Number(v))} />
        <Button icon={<ReloadOutlined />} loading={query.isFetching} disabled={!farm?.farmId || query.isFetching} onClick={() => void refresh()}>刷新</Button></Space></Col>
    </Row>
    {!farm?.farmId ? <Alert type="info" showIcon message="请先选择当前农场" /> : query.isError ?
      <Alert type="error" showIcon message="生产数据读取失败" description="本次未取得最新统计结果，请重试。" action={<Button onClick={() => void refresh()}>重试</Button>} /> : null}
    {query.isLoading && farm?.farmId && <Skeleton active paragraph={{ rows: 8 }} />}
    {d && <>
      {query.isError && <Alert type="warning" message="以下为上次成功获取的数据，尚未刷新" />}
      <Typography.Text type="secondary">统计范围：当前主体 / 当前农场 · {d.from} 至 {d.to}（采收趋势） · 更新于 {d.asOf.replace('T', ' ').slice(0, 19)}</Typography.Text>
      <Row gutter={[16, 16]}>
        {metric('在田面积', d.plantingArea, '亩', 'plots')}
        {metric('期间采收量', d.periodYieldKg, 'kg', 'harvests')}
        {metric('待办任务', d.pendingTaskCount, '条', 'tasks')}
        {metric('未关闭告警', d.alertCount, '条', 'alerts')}
      </Row>
      {!!Object.keys(d.unconverted).length && <Alert type="warning" showIcon message="部分采收批次未计入重量汇总" description={<>以下单位无法换算为 kg：{Object.entries(d.unconverted).map(([unit, qty]) => `${qty} ${unit}`).join('、')}。请在采收记录中核实；不会将不同单位直接相加。</>} />}
      {d.missingQuantityCount > 0 && <Alert type="warning" showIcon message={`${d.missingQuantityCount} 个批次缺少采收数量，未计入产量，请核实采收记录`} />}
      <Space wrap>
        <Tag>地块 {d.plotCount} 个 / {d.totalArea} 亩</Tag><Tag>进行中农事计划 {d.activePlanCount} 项</Tag>
        <Tag color={d.overdueTaskCount ? 'red' : 'default'}>逾期待办 {d.overdueTaskCount} 条</Tag><Tag>累计采收 {d.yieldKg} kg</Tag>
        <Tag>累计已完成任务 {d.completedTaskCount} 条</Tag>
      </Space>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}><Card title="待办农事任务" extra={<Button type="link" onClick={() => go('tasks')}>全部任务</Button>}>
            <List dataSource={d.todos} locale={{ emptyText: '当前农场暂无待办任务' }} renderItem={t => <List.Item actions={[<Button type="link" key="detail" onClick={() => go(`tasks/${t.id}`)}>处理</Button>]}><List.Item.Meta title={<Space>{t.name}<Tag>{taskStatusMeta(t.status).label}</Tag></Space>} description={`${t.executor || '未分配执行人'} · 计划截止 ${t.due?.replace('T', ' ') || '未设置'}`} /></List.Item>} />
            <Typography.Text type="secondary">按计划截止时间排序，显示前8条；进入任务完成执行、记录及验收。</Typography.Text>
          </Card></Col>
          <Col xs={24} xl={10}><Card title="告警提醒" extra={<Button type="link" onClick={() => go('alerts')}>告警中心</Button>}>
            <List dataSource={d.alerts} locale={{ emptyText: '当前农场暂无未关闭告警' }} renderItem={a => <List.Item actions={[<Button type="link" key="handle" onClick={() => go('alerts?alertId=' + encodeURIComponent(a.id))}>查看处理</Button>]}><List.Item.Meta title={a.title} description={<Space><Tag>{a.level}</Tag>{a.time?.replace('T', ' ')}</Space>} /></List.Item>} />
          </Card></Col>
        </Row>
        <Card title="生产业务快捷入口"><Space wrap>{[['农事计划', 'plans'], ['采收登记', 'harvests'], ['库存管理', 'harvests/inventory'], ['质量检测', 'quality'], ['供给管理', 'p2t/offers']].map(([label, path]) => <Button key={path} onClick={() => go(path)}>{label}</Button>)}</Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>业务数据由对应模块校验并保存，返回本页后自动重新读取；看板不重复登记生产事实。</Typography.Paragraph>
        </Card>

      <Typography.Title level={4} style={{ marginBottom: 0 }}>生产趋势与质量分析</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}><Card title="采收趋势（kg）" extra={<Button type="link" onClick={() => go('harvests')}>采收记录</Button>}>
          {d.trend.length ? <ReactECharts style={{ height: 300 }} option={{ color: ['#0e5233'], tooltip: { trigger: 'axis' }, grid: { left: 60, right: 25, top: 20, bottom: 45 }, xAxis: { type: 'category', data: d.trend.map(p => p.date) }, yAxis: { type: 'value', name: 'kg' }, series: [{ name: '采收量', type: 'bar', data: d.trend.map(p => p.value), barMaxWidth: 36 }] }} /> : <Empty description="所选期间暂无可换算重量的采收记录" />}
          <Typography.Text type="secondary">仅展示实际有采收记录的日期；按采收日期汇总，kg / 公斤 / 千克、斤、吨统一换算。</Typography.Text>
        </Card></Col>
        <Col xs={24} xl={8}><Card title="质量检测结论" extra={<Button type="link" onClick={() => go('quality')}>检测台账</Button>}>
          <Statistic title="累计已完成检测合格率" value={d.passRate ?? '—'} suffix="%" />
          <Space style={{ marginTop: 24 }} wrap><Tag color="green">合格 {d.passCount} 单</Tag><Tag color="red">不合格 {d.failCount} 单</Tag><Tag>待完成 {d.pendingInspectionCount} 单</Tag></Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 20 }}>按已完成且有明确合格 / 不合格结论的检测单计算；无有效结论时显示“—”。此统计不替代批次准入判定。</Typography.Paragraph>
        </Card></Col>
        <Col span={24}><Card title="地块与在田分布" extra={<Button type="link" onClick={() => go('plots')}>地块管理</Button>}>
          <List dataSource={d.plots} pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: '当前农场暂无地块' }} renderItem={p => <List.Item actions={[<Button type="link" key="detail" onClick={() => go(`plots/${p.id}`)}>查看地块</Button>]}><List.Item.Meta title={<Space>{p.name}<Tag color={p.planting ? 'green' : 'default'}>{p.planting ? '在田' : '无进行中计划'}</Tag></Space>} description={`${p.area} 亩 · ${p.crop || '未登记当前作物'}`} /></List.Item>} />
          <Typography.Text type="secondary">在田面积按存在进行中农事计划的地块去重汇总，不将启用地块直接认定为在种。</Typography.Text>
        </Card></Col>
      </Row>

    </>}
  </Space>
}
