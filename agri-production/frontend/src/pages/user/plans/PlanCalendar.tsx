/**
 * 页面名称：农事日历
 * 路由路径：/production/plans/calendar
 * 所属模块：农事生产
 * PRD 序号：PRD 6.1 #13（对应 PRD 8.2 PLAN-04 农事日历 + 冲突检测）
 *
 * 页面用途（PRD）：日历视图查看农事安排、计划冲突检测。
 * 同地块同日多项未完成任务提示待协调；生育期与无地块记录不参与冲突判断。
 */
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import './plans.css'
import './calendar.css'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert as AntAlert,
  App as AntdApp,
  Badge,
  Button,
  DatePicker,
  Col,
  Drawer,
  Empty,
  List,
  Radio,
  Row,
  Skeleton,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import type { BadgeProps } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import useFarmStore from '@/store/farm'
import { fetchCalendarEntries } from '@/api/production-view'
import type { CalendarEntry } from '@/api/production-view'
import { taskTypeLabel } from '@/utils/production-adapter'

/** 同一地块在同一天出现多条安排，即一条待处理的冲突 */
interface PlotConflict {
  /** 地块 ID */
  plotId: string
  /** 地块名称 */
  plotName: string
  /** 冲突明细（任务名 + 负责人），用于红标文案，避免只给红点让运营猜测 */
  items: {
    /** 条目唯一键 */
    entryId: string
    /** 标题 */
    title: string
    /** 来源 */
    source: CalendarEntry['source']
    /** 负责人姓名（未指派时为空串） */
    assigneeName: string
  }[]
}

/** 某天聚合结果 */
interface DayBucket {
  /** 当天条目 */
  entries: CalendarEntry[]
  /** 涉及地块数 */
  plotCount: number
  /** 当天的同地块冲突明细（长度 > 0 即为冲突日） */
  conflicts: PlotConflict[]
}

/**
 * 将一条日历条目渲染为「任务名（负责人）」文案
 * @param item 冲突明细项
 * @returns 展示文案
 */
function formatConflictItem(item: PlotConflict['items'][number]): string {
  const owner = item.assigneeName ? item.assigneeName : '未指派'
  return `${item.title}（${owner}）`
}

/**
 * 农事日历
 * @returns 页面内容
 */
export default function PlanCalendar(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const [viewMonth, setViewMonth] = useState<Dayjs>(dayjs())
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [plotFilter, setPlotFilter] = useState<string>()
  const [sourceFilter, setSourceFilter] = useState<'all' | 'task' | 'plan-stage'>('all')

  /** 当前显示月份的起止（含前后各 7 天，避免月视图边界缺失） */
  const range = useMemo(() => {
    const first = viewMonth.startOf('month')
    const start = first.subtract((first.day() + 6) % 7, 'day')
    const end = start.add(41, 'day')
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    }
  }, [viewMonth])

  const calendarQuery = useQuery({
    queryKey: ['plan-calendar', farmId, range.startDate, range.endDate],
    enabled: Boolean(farmId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () =>
      fetchCalendarEntries({
        startDate: range.startDate,
        endDate: range.endDate,
        farmId,
      }),
  })

  const allEntries = calendarQuery.data?.entries ?? []
  const plotOptions = Array.from(new Map(allEntries.filter(item => item.plotId).map(item => [item.plotId, { value: item.plotId, label: item.plotName || item.plotId }])).values())
  const entries = allEntries.filter(item => (sourceFilter === 'all' || item.source === sourceFilter) && (!plotFilter || item.plotId === plotFilter))
  /** 日历各来源的不可用原因（非空表示本次少了一块排期，不是"没有排期"） */
  const calendarUnavailableReasons = calendarQuery.data?.unavailableReasons ?? []

  /**
   * 将当日条目的状态 / 来源映射为 Badge 语义
   * @param entry 日历条目
   * @returns Badge 状态
   */
  function entryStatus(entry: CalendarEntry): BadgeProps['status'] {
    if (entry.source === 'plan-stage') return 'processing'
    if (entry.done) return 'success'
    return 'warning'
  }

  /** 按日期聚合，并计算地块级冲突 */
  const buckets = useMemo<Map<string, DayBucket>>(() => {
    const map = new Map<string, DayBucket>()
    for (const entry of entries) {
      const bucket = map.get(entry.date) ?? { entries: [], plotCount: 0, conflicts: [] }
      bucket.entries.push(entry)
      map.set(entry.date, bucket)
    }
    for (const bucket of map.values()) {
      // 按地块聚合：同一地块当天出现 >1 条安排即构成冲突（团队口径，为 PRD「同人同地块」的超集，
      // 目的是未指派任务（assignee 为空）也能被判出，避免漏报）
      const byPlot = new Map<string, PlotConflict>()
      for (const entry of bucket.entries) {
        if (!entry.plotId || entry.source !== 'task' || entry.done) continue
        const plotKey = entry.plotId
        const group = byPlot.get(plotKey) ?? {
          plotId: plotKey,
          plotName: entry.plotName || '未关联地块',
          items: [],
        }
        group.items.push({
          entryId: entry.entryId,
          title: entry.title,
          source: entry.source,
          assigneeName: entry.assigneeName ?? '',
        })
        byPlot.set(plotKey, group)
      }
      bucket.plotCount = new Set(bucket.entries.filter(item => item.plotId).map(item => item.plotId)).size
      bucket.conflicts = Array.from(byPlot.values()).filter((group) => group.items.length > 1)
    }
    return map
  }, [entries])

  /** 冲突日汇总 */
  const conflictDays = useMemo(
    () =>
      Array.from(buckets.entries())
        .filter(([date, bucket]) => date.startsWith(viewMonth.format('YYYY-MM')) && bucket.conflicts.length > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    [buckets, viewMonth],
  )

  /** 选中日过滤后的条目 */
  const selectedEntries = useMemo(() => {
    const bucket = buckets.get(selectedDate)
    const list = bucket?.entries ?? []
    return sourceFilter === 'all' ? list : list.filter((item) => item.source === sourceFilter)
  }, [buckets, selectedDate, sourceFilter])

  /** 本月统计 */
  const monthStats = useMemo(() => {
    const prefix = viewMonth.format('YYYY-MM')
    const monthEntries = entries.filter((item) => item.date.startsWith(prefix))
    return {
      total: new Set(monthEntries.map(item => item.source === 'task' ? `task-${item.taskId || item.entryId}` : `stage-${item.planId}-${item.stageId || item.entryId}`)).size,
      taskCount: new Set(monthEntries.filter(item => item.source === 'task').map(item => item.taskId || item.entryId)).size,
      stageCount: new Set(monthEntries.filter(item => item.source === 'plan-stage').map(item => `${item.planId}-${item.stageId || item.entryId}`)).size,
      busyDays: Array.from(
        new Set(monthEntries.map((item) => item.date)),
      ).length,
    }
  }, [entries, viewMonth])

  /**
   * 渲染日历单元格
   * @param date 单元格日期
   * @returns ReactNode
   */

  /**
   * 打开某天的任务抽屉
   * @param date 目标日期
   * @returns void
   */
  function openDay(date: Dayjs): void {
    setSelectedDate(date.format('YYYY-MM-DD'))
    setDrawerOpen(true)
  }

  return (
    <PageContainer
      className="production-plans-page"
      title="📅 农事日历"
      subTitle={currentFarm?.farmName}
      extra={[
        <Typography.Text key="month" type="secondary">{viewMonth.format('YYYY 年 MM 月')}</Typography.Text>,
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => {
          void calendarQuery.refetch().then(result => {
            if (result.isError) message.error('日历刷新失败，请重试')
            else if (result.data?.unavailableReasons.length) message.warning('部分排期未能刷新，请查看提示')
            else message.success('日历数据已刷新')
          })
        }}>刷新</Button>,
        <Button key="plans" onClick={() => navigate('/production/plans')}>返回农事计划</Button>,
      ]}
    >
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {calendarUnavailableReasons.length > 0 && (
        <AntAlert
          showIcon
          type="warning"
          message="农事日历本次不完整：部分数据来源未取到"
          description={
            <span>
              {calendarUnavailableReasons.map((reason) => (
                <span key={reason}>
                  {reason}
                  <br />
                </span>
              ))}
              因此日历里缺少对应排期——<strong>这不是"这段时间没有安排"</strong>，
              不要据此判断某段时间空闲。此处不会用示例数据补位。
            </span>
          }
        />
      )}
      <Card>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic title="本月农事安排" value={monthStats.total} suffix="项" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="农事任务" value={monthStats.taskCount} suffix="条" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="生育期节点" value={monthStats.stageCount} suffix="个" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="涉及天数"
              value={monthStats.busyDays}
              suffix="天"
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
        </Row>
      </Card>

      {!farmId && <AntAlert type="info" showIcon message="请先选择当前农场，再查看农事安排" />}
      {calendarQuery.isError && <AntAlert type="error" showIcon message="日历加载失败" description="无法取得当前农场排期，请刷新重试。" action={<Button onClick={() => void calendarQuery.refetch()}>重试</Button>} />}
      <Card>
        <div className="farm-calendar-toolbar">
          <Space wrap>
            <Button aria-label="上个月" icon={<LeftOutlined />} onClick={() => setViewMonth(value => value.subtract(1, 'month'))} />
            <DatePicker picker="month" allowClear={false} value={viewMonth} format="YYYY 年 MM 月" onChange={date => { if (date) setViewMonth(date) }} />
            <Button aria-label="下个月" icon={<RightOutlined />} onClick={() => setViewMonth(value => value.add(1, 'month'))} />
            <Button onClick={() => { setViewMonth(dayjs()); setSelectedDate(dayjs().format('YYYY-MM-DD')) }}>今天</Button>
          </Space>
          <Space wrap>
            <Select allowClear placeholder="全部地块" aria-label="筛选地块" value={plotFilter} options={plotOptions} style={{ width: 160 }} onChange={setPlotFilter} />
            <Radio.Group value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} optionType="button" options={[{ label: '全部', value: 'all' }, { label: '农事任务', value: 'task' }, { label: '生育期', value: 'plan-stage' }]} />
          </Space>
        </div>
        <div className="farm-calendar-legend">
          <span><Badge status="warning" /> 待完成任务</span><span><Badge status="success" /> 已完成任务</span><span><Badge status="processing" /> 生育期</span>
          <Typography.Text type="secondary">统计按业务单据去重；跨天安排逐日展示</Typography.Text>
          {conflictDays.length > 0 && <Button size="small" type="link" danger onClick={() => openDay(dayjs(conflictDays[0][0]))}><WarningOutlined /> {conflictDays.length} 天存在同地块多任务待协调</Button>}
        </div>
        {calendarQuery.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : (
          <div className="farm-calendar-scroll">
            <div className="farm-calendar-grid" role="group" aria-label={`${viewMonth.format('YYYY年M月')}农事月历`}>
              {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => <div key={day} className={`farm-calendar-weekday ${index > 4 ? 'is-weekend' : ''}`}>周{day}</div>)}
              {Array.from({ length: 42 }, (_, index) => {
                const date = dayjs(range.startDate).add(index, 'day')
                const key = date.format('YYYY-MM-DD')
                const bucket = buckets.get(key)
                const items = bucket?.entries ?? []
                const outside = !date.isSame(viewMonth, 'month')
                const today = date.isSame(dayjs(), 'day')
                return <button key={key} type="button" disabled={!farmId || calendarQuery.isError} className={`farm-calendar-day${outside ? ' is-outside' : ''}${today ? ' is-today' : ''}${key === selectedDate ? ' is-selected' : ''}`} aria-label={`${key}，${items.length}项安排`} onClick={() => { if (outside) setViewMonth(date); openDay(date) }}>
                  <span className="farm-calendar-day-heading"><span className="farm-calendar-date">{today ? '今' : date.date()}</span>{bucket?.conflicts.length ? <span className="farm-calendar-conflict" title="同地块多项未完成任务，请协调安排">待协调</span> : null}</span>
                  <span className="farm-calendar-events">{items.slice(0, 3).map(entry => <span key={entry.entryId} className={`farm-calendar-event ${entry.source === 'plan-stage' ? 'is-stage' : entry.done ? 'is-done' : 'is-task'}`} title={`${entry.title} · ${entry.plotName || '未关联地块'} · ${entry.assigneeName || '未指派'}`}><span className="farm-calendar-event-title">{entry.title}</span><span className="farm-calendar-event-plot">{entry.plotName || '未关联地块'}</span></span>)}{items.length > 3 && <span className="farm-calendar-more">另有 {items.length - 3} 项 · 点击查看</span>}</span>
                </button>
              })}
            </div>
          </div>
        )}
      </Card>

      <Drawer
        title={
          <Space>
            <CalendarOutlined style={{ color: '#13a05a' }} />
            <span>{selectedDate} 农事安排</span>
          </Space>
        }
        width={Math.min(600, window.innerWidth)}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Radio.Group
            size="small"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as 'all' | 'task' | 'plan-stage')}
          >
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="task">农事任务</Radio.Button>
            <Radio.Button value="plan-stage">生育期</Radio.Button>
          </Radio.Group>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {(() => {
            const dayConflicts = buckets.get(selectedDate)?.conflicts ?? []
            if (dayConflicts.length === 0) return null
            return (
              <AntAlert
                type="warning"
                showIcon
                message="该日存在同地块多任务待协调"
                description={
                  <Space direction="vertical" size={2}>
                    {dayConflicts.map((group, index) => (
                      <Typography.Text
                        key={`${group.plotId}-${index}`}
                        style={{ fontSize: 12 }}
                      >
                        <Typography.Text strong>{group.plotName}</Typography.Text>：
                        {group.items.map(formatConflictItem).join(' / ')}
                      </Typography.Text>
                    ))}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      同一地块同一天被安排了多条作业，请协调执行人或错峰安排。
                    </Typography.Text>
                  </Space>
                }
              />
            )
          })()}
          {selectedEntries.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={calendarUnavailableReasons.length ? "部分排期读取失败，暂无法确认当日全部安排" : "当前筛选下暂无农事安排"} />
          ) : (
            <List
              dataSource={selectedEntries}
              rowKey="entryId"
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="jump"
                      type="link"
                      size="small"
                      onClick={() => {
                        if (item.source === 'task' && item.taskId) {
                          navigate(`/production/tasks/${item.taskId}`)
                        } else if (item.planId) {
                          navigate(`/production/plans/${item.planId}`)
                        } else {
                          navigate('/production/plans')
                        }
                      }}
                    >
                      前往业务 →
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Badge status={entryStatus(item)} />
                        <Typography.Text strong>{item.title}</Typography.Text>
                        {item.source === 'task' && <Tag>{item.done ? '已完成' : '待完成'}</Tag>}
                        <Tag color={item.source === 'plan-stage' ? 'blue' : 'green'}>
                          {item.source === 'plan-stage' ? '生育期' : '农事任务'}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={2}>
                        <Typography.Text type="secondary">
                          地块：{item.plotName || '未关联地块'}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          类别：
                          {item.source === 'plan-stage' ? item.category : taskTypeLabel(item.category)}
                          {item.endDate ? `　区间：${item.date} ~ ${item.endDate}` : null}
                        </Typography.Text>
                        {item.source === 'task' ? (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            负责人：{item.assigneeName || '未指派'}
                          </Typography.Text>
                        ) : null}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Space>
      </Drawer>
    </Space>
    </PageContainer>
  )
}
