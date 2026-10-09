/**
 * 页面名称：农事日历
 * 路由路径：/production/plans/calendar
 * 所属模块：智能种养计划
 * PRD 序号：PRD 6.1 #13（对应 PRD 8.2 PLAN-04 农事日历 + 冲突检测）
 *
 * 页面用途（PRD）：日历视图查看农事安排、计划冲突检测。
 * 冲突定义（PRD PLAN-04）：同一地块同一天存在多条农事安排时判定为冲突，
 * 日历单元格以红色标记，并在侧栏顶部给出冲突汇总提示。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert as AntAlert,
  App as AntdApp,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  Drawer,
  Empty,
  List,
  Radio,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { BadgeProps } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  CalendarOutlined,
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
  const [sourceFilter, setSourceFilter] = useState<'all' | 'task' | 'plan-stage'>('all')

  /** 当前显示月份的起止（含前后各 7 天，避免月视图边界缺失） */
  const range = useMemo(() => {
    const start = viewMonth.startOf('month').subtract(7, 'day')
    const end = viewMonth.endOf('month').add(7, 'day')
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    }
  }, [viewMonth])

  const calendarQuery = useQuery({
    queryKey: ['plan-calendar', farmId, range.startDate, range.endDate],
    queryFn: () =>
      fetchCalendarEntries({
        startDate: range.startDate,
        endDate: range.endDate,
        farmId,
      }),
  })

  const entries = calendarQuery.data ?? []

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
        const plotKey = entry.plotId || '未关联地块'
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
      bucket.plotCount = byPlot.size
      bucket.conflicts = Array.from(byPlot.values()).filter((group) => group.items.length > 1)
    }
    return map
  }, [entries])

  /** 冲突日汇总 */
  const conflictDays = useMemo(
    () =>
      Array.from(buckets.entries())
        .filter(([, bucket]) => bucket.conflicts.length > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    [buckets],
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
      total: monthEntries.length,
      taskCount: monthEntries.filter((item) => item.source === 'task').length,
      stageCount: monthEntries.filter((item) => item.source === 'plan-stage').length,
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
  function renderCell(date: Dayjs): JSX.Element | null {
    const key = date.format('YYYY-MM-DD')
    if (key.slice(0, 7) !== viewMonth.format('YYYY-MM')) return null
    const bucket = buckets.get(key)
    if (!bucket || bucket.entries.length === 0) return null
    const preview = bucket.entries.slice(0, 3)
    return (
      <div style={{ padding: '2px 4px' }}>
        <Space direction="vertical" size={1} style={{ width: '100%' }}>
          {preview.map((entry) => (
            <div key={entry.entryId} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Badge status={entryStatus(entry)} />
              <span
                style={{
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: entry.source === 'plan-stage' ? '#1677ff' : undefined,
                }}
              >
                {entry.source === 'plan-stage' ? entry.category : taskTypeLabel(entry.category)}
              </span>
            </div>
          ))}
          {bucket.entries.length > 3 ? (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              +{bucket.entries.length - 3} 项
            </Typography.Text>
          ) : null}
          {bucket.conflicts.length > 0 ? (
            <Tooltip
              title={bucket.conflicts
                .map(
                  (group) =>
                    `${group.plotName}：${group.items.map(formatConflictItem).join(' / ')}`,
                )
                .join('\n')}
            >
              <Tag color="error" style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}>
                <WarningOutlined /> 冲突×{bucket.conflicts.length}
              </Tag>
            </Tooltip>
          ) : null}
        </Space>
      </div>
    )
  }

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
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <CalendarOutlined style={{ color: '#13a05a' }} />
            <span>农事日历</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {viewMonth.format('YYYY 年 MM 月')}
            </Typography.Text>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void calendarQuery.refetch().then(() => message.success('日历数据已刷新'))
              }}
            >
              刷新
            </Button>
            <Button onClick={() => navigate('/production/plans')}>返回计划列表</Button>
          </Space>
        }
      >
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

      {conflictDays.length > 0 ? (
        <AntAlert
          type="error"
          showIcon
          message={`检测到 ${conflictDays.length} 天存在同地块多任务冲突（PRD PLAN-04）`}
          description={
            <Space direction="vertical" size={2}>
              {conflictDays.slice(0, 5).map(([date, bucket]) => (
                <Typography.Text key={date} style={{ fontSize: 12 }}>
                  <Typography.Text strong>{date}</Typography.Text>
                  {bucket.conflicts.map((group, index) => (
                    <span key={`${date}-${group.plotId}-${index}`}>
                      {'　'}
                      {group.plotName}：{group.items.map(formatConflictItem).join(' / ')}
                    </span>
                  ))}
                </Typography.Text>
              ))}
              {conflictDays.length > 5 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  另有 {conflictDays.length - 5} 天冲突未展开，可在日历中查看。
                </Typography.Text>
              ) : null}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                建议调整同一地块的任务时间或合并同类作业后再派发。
              </Typography.Text>
            </Space>
          }
          action={
            <Button
              size="small"
              danger
              onClick={() => {
                setSelectedDate(conflictDays[0][0])
                setDrawerOpen(true)
              }}
            >
              查看首日明细
            </Button>
          }
        />
      ) : null}

      <Card>
        {calendarQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <Calendar
            value={viewMonth}
            onSelect={(date, info) => {
              if (info.source === 'date') {
                openDay(date)
              }
            }}
            onChange={(date) => setViewMonth(date)}
            cellRender={(current, info) => {
              if (info.type !== 'date') {
                return info.originNode
              }
              const content = renderCell(current)
              return (
                <div>
                  {info.originNode}
                  {content}
                </div>
              )
            }}
          />
        )}
      </Card>

      <Drawer
        title={
          <Space>
            <CalendarOutlined style={{ color: '#13a05a' }} />
            <span>{selectedDate} 农事安排</span>
          </Space>
        }
        width={520}
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
                message="该日存在同地块多任务冲突"
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当日暂无农事安排" />
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
  )
}
