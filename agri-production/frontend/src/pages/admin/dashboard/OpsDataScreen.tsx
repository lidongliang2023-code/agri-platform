/**
 * 页面名称：数据大屏驾驶舱
 * 路由路径：/admin/production/dashboard/screen
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #3
 * 说明：原型无此页，按 PRD「投屏展示、区域地图、实时滚动指标」实现；
 * 深色背景为业务大屏设计要求，页面内所有文本均使用高对比度浅色，确保在深色下可读。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, Empty, Space, Tooltip, Typography } from 'antd'
import {
  ArrowUpOutlined,
  ExclamationCircleOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { fetchRegionStats, fetchRealtimeMetrics, fetchScreenData } from '@/api/admin/dashboard'

const { Text } = Typography

/** 大屏配色常量（深色底 + 霓虹强调色，文本均为高对比浅色） */
const SCREEN_THEME = {
  /** 背景起始色 */
  bgFrom: '#04102a',
  /** 背景结束色 */
  bgTo: '#0a1c3d',
  /** 面板底色 */
  panel: 'rgba(16, 40, 82, 0.55)',
  /** 面板描边 */
  border: 'rgba(64, 158, 255, 0.35)',
  /** 主文本色（高对比） */
  text: '#eaf3ff',
  /** 次级文本色（保持 >4.5:1 对比度） */
  subText: '#a9c8ef',
  /** 强调色 青柠 */
  accent: '#2be7c4',
  /** 强调色 蓝 */
  accentBlue: '#4facfe',
  /** 强调色 橙（告警） */
  accentOrange: '#ffb84d',
  /** 强调色 红（预警） */
  accentRed: '#ff7875',
} as const

/** 大屏核心指标定义 */
interface ScreenKpi {
  /** 唯一标识 */
  key: string
  /** 标题 */
  title: string
  /** 数值 */
  value: number
  /** 单位 */
  unit: string
  /** 小数位 */
  precision: number
  /** 强调色 */
  color: string
}

/** 实时滚动指标定义 */
interface RealtimeRow {
  /** 唯一标识 */
  id: string
  /** 时间 HH:mm:ss */
  time: string
  /** 对象名称（租户 / 农场） */
  target: string
  /** 事件描述 */
  content: string
  /** 是否告警 */
  isAlert: boolean
}

/** 大屏核心指标示例数据（平台级口径，原型 4.2） */
const FALLBACK_KPI: ScreenKpi[] = [
  { key: 'tenant', title: '平台租户数', value: 1580, unit: '家', precision: 0, color: SCREEN_THEME.accentBlue },
  { key: 'farm', title: '接入农场', value: 3542, unit: '个', precision: 0, color: SCREEN_THEME.accent },
  { key: 'area', title: '在田面积', value: 85.6, unit: '万亩', precision: 1, color: '#7ee787' },
  { key: 'task', title: '今日任务', value: 12458, unit: '条', precision: 0, color: SCREEN_THEME.accentOrange },
  { key: 'device', title: '在线设备', value: 7820, unit: '台', precision: 0, color: '#69b1ff' },
  { key: 'trace', title: '溯源码总量', value: 2450000, unit: '枚', precision: 0, color: '#d3adf7' },
]

/** 区域分布示例数据 */
const FALLBACK_REGIONS: Array<{ region: string; farmCount: number; ratio: number; level: string }> = [
  { region: '河南省', farmCount: 720, ratio: 96, level: 'high' },
  { region: '山东省', farmCount: 650, ratio: 88, level: 'high' },
  { region: '黑龙江省', farmCount: 480, ratio: 72, level: 'high' },
  { region: '江苏省', farmCount: 410, ratio: 66, level: 'middle' },
  { region: '四川省', farmCount: 355, ratio: 58, level: 'middle' },
  { region: '广东省', farmCount: 320, ratio: 54, level: 'middle' },
  { region: '河北省', farmCount: 286, ratio: 48, level: 'middle' },
  { region: '安徽省', farmCount: 232, ratio: 38, level: 'low' },
]

/** 实时滚动示例数据 */
const FALLBACK_REALTIME: RealtimeRow[] = [
  { id: 'r1', time: '10:32:15', target: '绿源农场', content: '完成施肥任务', isAlert: false },
  { id: 'r2', time: '10:31:48', target: '丰达A区', content: '开始灌溉', isAlert: false },
  { id: 'r3', time: '10:31:22', target: '大地南基地', content: '上报土壤数据', isAlert: false },
  { id: 'r4', time: '10:30:55', target: '田园B区', content: '温度预警 38.2℃', isAlert: true },
  { id: 'r5', time: '10:30:12', target: '鑫农C区', content: '完成巡田', isAlert: false },
  { id: 'r6', time: '10:29:45', target: '惠民D区', content: '设备上线', isAlert: false },
  { id: 'r7', time: '10:29:08', target: '丰收E区', content: '拍照上传', isAlert: false },
  { id: 'r8', time: '10:28:33', target: '绿源农场', content: '完成任务验收', isAlert: false },
]

/** 近 12 小时趋势示例数据 */
const FALLBACK_HOURS: Array<{ hour: string; taskCount: number; onlineRate: number }> = [
  { hour: '00:00', taskCount: 320, onlineRate: 93.2 },
  { hour: '02:00', taskCount: 210, onlineRate: 93.8 },
  { hour: '04:00', taskCount: 180, onlineRate: 94.1 },
  { hour: '06:00', taskCount: 860, onlineRate: 94.6 },
  { hour: '08:00', taskCount: 1640, onlineRate: 95.2 },
  { hour: '10:00', taskCount: 2180, onlineRate: 95.4 },
  { hour: '12:00', taskCount: 1520, onlineRate: 94.8 },
  { hour: '14:00', taskCount: 1740, onlineRate: 94.3 },
  { hour: '16:00', taskCount: 1420, onlineRate: 93.9 },
  { hour: '18:00', taskCount: 980, onlineRate: 93.4 },
  { hour: '20:00', taskCount: 620, onlineRate: 92.8 },
  { hour: '22:00', taskCount: 380, onlineRate: 92.5 },
]

/** 作物结构示例数据 */
const FALLBACK_CROPS: Array<{ name: string; value: number }> = [
  { name: '水稻', value: 326000 },
  { name: '小麦', value: 248000 },
  { name: '玉米', value: 212000 },
  { name: '果蔬', value: 108000 },
  { name: '大豆', value: 96000 },
  { name: '其它', value: 62000 },
]

/** TOP 租户示例数据 */
const FALLBACK_TOP_TENANTS: Array<{ name: string; farmCount: number; area: number; score: number }> = [
  { name: '绿源农业科技有限公司', farmCount: 45, area: 12500, score: 96 },
  { name: '大地种业', farmCount: 52, area: 15200, score: 94 },
  { name: '丰达农场', farmCount: 38, area: 9800, score: 91 },
  { name: '田园生态', farmCount: 33, area: 10100, score: 88 },
  { name: '丰收集团', farmCount: 29, area: 8600, score: 86 },
  { name: '惠民种植', farmCount: 15, area: 4200, score: 72 },
]

/** 区域活跃度配色 */
const LEVEL_COLOR: Record<string, string> = {
  high: SCREEN_THEME.accent,
  middle: SCREEN_THEME.accentOrange,
  low: SCREEN_THEME.accentRed,
}

/** 区域活跃度文案 */
const LEVEL_TEXT: Record<string, string> = {
  high: '高活跃',
  middle: '中活跃',
  low: '低活跃',
}

/**
 * 数字滚动动画组件
 *
 * 用于大屏核心指标的「跳动」效果，在 1.2 秒内从 0 递增到目标值。
 */
function AnimatedNumber({
  value,
  precision = 0,
}: {
  /** 目标数值 */
  value: number
  /** 小数位数 */
  precision?: number
}): JSX.Element {
  /** 当前显示值 */
  const [current, setCurrent] = useState<number>(0)
  /** 动画帧句柄 */
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const duration = 1200
    const start = performance.now()
    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration)
      setCurrent(Number((value * (1 - Math.pow(1 - progress, 3))).toFixed(precision)))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, precision])

  return <span>{Number(current).toLocaleString('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision })}</span>
}

/**
 * 数据大屏驾驶舱
 *
 * 业务职责：面向投屏的运营驾驶舱，含大字号核心指标、区域生产分布、
 * 实时滚动指标流、告警播报、近 12 小时趋势与 TOP 租户榜单。
 *
 * @returns 页面内容
 */
export default function OpsDataScreen(): JSX.Element {
  /** 大屏容器引用（用于全屏切换） */
  const containerRef = useRef<HTMLDivElement>(null)
  /** 是否已进入全屏 */
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  /** 实时指标是否轮播 */
  const [scrolling, setScrolling] = useState<boolean>(true)
  /** 当前时间 */
  const [now, setNow] = useState<string>(new Date().toLocaleString('zh-CN', { hour12: false }))
  /** 实时指标列表（轮播时滚动首元素） */
  const [rows, setRows] = useState<RealtimeRow[]>(FALLBACK_REALTIME)

  /** 大屏聚合数据 */
  const screenQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'screen'],
    queryFn: () => fetchScreenData(),
    retry: false,
  })

  /** 区域分布 */
  const regionQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'regions'],
    queryFn: () => fetchRegionStats(),
    retry: false,
  })

  /** 实时指标流 */
  const realtimeQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'realtime'],
    queryFn: () => fetchRealtimeMetrics(20),
    retry: false,
  })

  /** 后端有实时数据时同步到本地滚动列表 */
  useEffect(() => {
    const remote = realtimeQuery.data
    if (remote && remote.length > 0) {
      setRows(
        remote.map((item, index) => ({
          id: `${item.metricId}-${index}`,
          time: item.time,
          target: item.targetName,
          content: item.content,
          isAlert: item.isAlert,
        })),
      )
    }
  }, [realtimeQuery.data])

  /** 时钟 */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date().toLocaleString('zh-CN', { hour12: false }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  /** 实时指标轮播：每 2.5 秒将首条移到末尾 */
  useEffect(() => {
    if (!scrolling || rows.length === 0) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setRows((prev) => (prev.length <= 1 ? prev : [...prev.slice(1), prev[0]]))
    }, 2500)
    return () => window.clearInterval(timer)
  }, [scrolling, rows.length])

  /** 核心指标（后端缺失时用示例口径） */
  const kpiList: ScreenKpi[] = useMemo<ScreenKpi[]>(() => {
    const raw = screenQuery.data
    if (!raw) {
      return FALLBACK_KPI
    }
    const pick = (key: string, fallbackItem: ScreenKpi): ScreenKpi => {
      const parsed = Number(raw[key])
      return Number.isFinite(parsed) && parsed > 0
        ? { ...fallbackItem, value: parsed }
        : fallbackItem
    }
    return [
      pick('tenantCount', FALLBACK_KPI[0]),
      pick('farmCount', FALLBACK_KPI[1]),
      pick('fieldAreaWan', FALLBACK_KPI[2]),
      pick('todayTaskCount', FALLBACK_KPI[3]),
      pick('onlineDeviceCount', FALLBACK_KPI[4]),
      pick('traceCodeCount', FALLBACK_KPI[5]),
    ]
  }, [screenQuery.data])

  /** 区域分布 */
  const regionList = useMemo(() => {
    const remote = regionQuery.data
    if (remote && remote.length > 0) {
      const max = Math.max(...remote.map((item) => item.farmCount), 1)
      return remote.map((item) => ({
        region: item.region,
        farmCount: item.farmCount,
        ratio: Math.round((item.farmCount / max) * 100),
        level: item.activityLevel,
      }))
    }
    return FALLBACK_REGIONS
  }, [regionQuery.data])

  /** 告警条目（实时流中筛出） */
  const alertRows = useMemo(() => rows.filter((item) => item.isAlert), [rows])

  /** 切换全屏 */
  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      setIsFullscreen(false)
      return
    }
    void containerRef.current?.requestFullscreen()
    setIsFullscreen(true)
  }

  /** 近 12 小时趋势图 */
  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['任务数', '设备在线率'],
      top: 0,
      textStyle: { color: SCREEN_THEME.subText },
    },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: FALLBACK_HOURS.map((item) => item.hour),
      axisLabel: { color: SCREEN_THEME.subText },
      axisLine: { lineStyle: { color: 'rgba(160,200,240,0.4)' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '任务数',
        nameTextStyle: { color: SCREEN_THEME.subText },
        axisLabel: { color: SCREEN_THEME.subText },
        splitLine: { lineStyle: { color: 'rgba(160,200,240,0.15)' } },
      },
      {
        type: 'value',
        name: '在线率(%)',
        min: 85,
        max: 100,
        nameTextStyle: { color: SCREEN_THEME.subText },
        axisLabel: { color: SCREEN_THEME.subText },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        type: 'bar',
        name: '任务数',
        barWidth: 14,
        data: FALLBACK_HOURS.map((item) => item.taskCount),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#4facfe' },
              { offset: 1, color: 'rgba(79,172,254,0.15)' },
            ],
          },
        },
      },
      {
        type: 'line',
        name: '设备在线率',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 6,
        data: FALLBACK_HOURS.map((item) => item.onlineRate),
        itemStyle: { color: SCREEN_THEME.accent },
        lineStyle: { width: 3 },
      },
    ],
  }

  /** 作物结构环形图 */
  const cropOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 亩 ({d}%)' },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 12,
      textStyle: { color: SCREEN_THEME.subText },
    },
    series: [
      {
        type: 'pie',
        name: '在田面积',
        radius: ['45%', '72%'],
        center: ['38%', '52%'],
        data: FALLBACK_CROPS,
        label: { color: SCREEN_THEME.text, formatter: '{b} {d}%' },
        itemStyle: { borderColor: SCREEN_THEME.bgTo, borderWidth: 2 },
      },
    ],
  }

  /** 通用面板样式 */
  const panelStyle: CSSProperties = {
    background: SCREEN_THEME.panel,
    border: `1px solid ${SCREEN_THEME.border}`,
    borderRadius: 8,
    padding: 12,
    height: '100%',
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: `linear-gradient(160deg, ${SCREEN_THEME.bgFrom} 0%, ${SCREEN_THEME.bgTo} 100%)`,
        borderRadius: 10,
        padding: 16,
        minHeight: 'calc(100vh - 120px)',
        color: SCREEN_THEME.text,
      }}
    >
      {/* 大屏顶栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${SCREEN_THEME.border}`,
          paddingBottom: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2,
              color: SCREEN_THEME.text,
              textShadow: `0 0 12px ${SCREEN_THEME.accentBlue}`,
            }}
          >
            农业生产数字化运营大屏
          </span>
          <span style={{ color: SCREEN_THEME.subText, fontSize: 13 }}>
            {screenQuery.data ? '实时数据模式' : '示例数据模式'} · 数据每 5 分钟自动刷新
          </span>
        </div>
        <Space size={8}>
          <span style={{ color: SCREEN_THEME.accent, fontSize: 16, fontWeight: 600 }}>{now}</span>
          <Tooltip title="重新拉取大屏数据">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
              style={{ background: 'rgba(79,172,254,0.2)', color: SCREEN_THEME.text, borderColor: SCREEN_THEME.border }}
            />
          </Tooltip>
          <Tooltip title={isFullscreen ? '退出全屏' : '进入全屏'}>
            <Button
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              style={{ background: 'rgba(79,172,254,0.2)', color: SCREEN_THEME.text, borderColor: SCREEN_THEME.border }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 核心指标区 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 12,
        }}
      >
        {kpiList.map((item) => (
          <div
            key={item.key}
            style={{
              ...panelStyle,
              padding: 14,
              background: 'rgba(12, 34, 72, 0.72)',
              boxShadow: `inset 0 0 24px rgba(43, 231, 196, 0.08)`,
            }}
          >
            <div style={{ color: SCREEN_THEME.subText, fontSize: 13 }}>{item.title}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: item.color,
                  textShadow: `0 0 10px ${item.color}55`,
                }}
              >
                <AnimatedNumber value={item.value} precision={item.precision} />
              </span>
              <span style={{ color: SCREEN_THEME.subText, fontSize: 13 }}>{item.unit}</span>
            </div>
            <div style={{ marginTop: 4, color: SCREEN_THEME.accent, fontSize: 12 }}>
              <ArrowUpOutlined /> 较昨日环比上升
            </div>
          </div>
        ))}
      </div>

      {/* 中部：区域分布 / 实时指标 / 告警播报 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1.2fr 1fr',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {/* 区域生产分布（不依赖外部地图，采用区域卡片 + 活跃度色阶） */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: SCREEN_THEME.text }}>
              区域生产分布
            </span>
            <span style={{ fontSize: 12, color: SCREEN_THEME.subText }}>
              {regionQuery.data ? '实时口径' : '示例口径'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: LEVEL_COLOR.high }}>● 高活跃</span>
            <span style={{ color: LEVEL_COLOR.middle }}>● 中活跃</span>
            <span style={{ color: LEVEL_COLOR.low }}>● 低活跃</span>
          </div>
          <div style={{ maxHeight: 268, overflowY: 'auto' }}>
            {regionList.map((item) => (
              <div key={item.region} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: SCREEN_THEME.text }}>{item.region}</span>
                  <span style={{ color: SCREEN_THEME.subText }}>
                    {item.farmCount} 个农场 · {LEVEL_TEXT[item.level]}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(160,200,240,0.16)',
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: `${item.ratio}%`,
                      height: 8,
                      borderRadius: 4,
                      background: LEVEL_COLOR[item.level],
                      boxShadow: `0 0 8px ${LEVEL_COLOR[item.level]}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 实时滚动指标 */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: SCREEN_THEME.text }}>
              实时生产动态
            </span>
            <Space size={6}>
              <Tooltip title={scrolling ? '暂停滚动' : '继续滚动'}>
                <Button
                  size="small"
                  type="text"
                  icon={scrolling ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={() => setScrolling((prev) => !prev)}
                  style={{ color: SCREEN_THEME.accent }}
                />
              </Tooltip>
            </Space>
          </div>
          {rows.length === 0 ? (
            <Empty description={<span style={{ color: SCREEN_THEME.subText }}>暂无实时数据</span>} />
          ) : (
            <div style={{ height: 268, overflow: 'hidden' }}>
              {rows.slice(0, 6).map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '7px 8px',
                    marginBottom: 6,
                    borderRadius: 6,
                    background:
                      index === 0 ? 'rgba(43,231,196,0.14)' : 'rgba(160,200,240,0.08)',
                    borderLeft: `3px solid ${item.isAlert ? SCREEN_THEME.accentRed : SCREEN_THEME.accentBlue}`,
                    transition: 'background 0.6s ease, opacity 0.6s ease',
                    opacity: 1 - index * 0.12,
                  }}
                >
                  <span style={{ color: SCREEN_THEME.subText, fontSize: 12, minWidth: 62 }}>
                    {item.time}
                  </span>
                  <span style={{ color: SCREEN_THEME.text, fontSize: 13, minWidth: 92 }}>
                    {item.target}
                  </span>
                  <span
                    style={{
                      color: item.isAlert ? SCREEN_THEME.accentRed : SCREEN_THEME.accent,
                      fontSize: 13,
                    }}
                  >
                    {item.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 告警播报 */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: SCREEN_THEME.text }}>
              告警播报
            </span>
            <span style={{ color: SCREEN_THEME.accentOrange, fontSize: 12 }}>
              {alertRows.length} 条待处理
            </span>
          </div>
          {alertRows.length === 0 ? (
            <Empty description={<span style={{ color: SCREEN_THEME.subText }}>当前无告警</span>} />
          ) : (
            alertRows.slice(0, 4).map((item) => (
              <div
                key={`alert-${item.id}`}
                style={{
                  padding: '8px 10px',
                  marginBottom: 8,
                  borderRadius: 6,
                  background: 'rgba(255,120,117,0.12)',
                  borderLeft: `3px solid ${SCREEN_THEME.accentRed}`,
                }}
              >
                <div style={{ color: SCREEN_THEME.text, fontSize: 13, fontWeight: 600 }}>
                  <ExclamationCircleOutlined style={{ marginRight: 6, color: SCREEN_THEME.accentRed }} />
                  {item.target}
                </div>
                <div style={{ color: SCREEN_THEME.subText, fontSize: 12, marginTop: 2 }}>
                  {item.content} · {item.time}
                </div>
              </div>
            ))
          )}
          <div style={{ marginTop: 12 }}>
            <Text style={{ color: SCREEN_THEME.subText, fontSize: 12 }}>
              处置闭环：告警自动派单 → 责任人确认 → 现场处置 → 复盘归档
            </Text>
          </div>
        </div>
      </div>

      {/* 底部：趋势 + 作物结构 + TOP 租户 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
        <div style={panelStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: SCREEN_THEME.text }}>
            近 12 小时任务量与设备在线率
          </div>
          <ReactECharts option={trendOption} style={{ height: 230 }} notMerge />
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: SCREEN_THEME.text }}>
            在田作物结构
          </div>
          <ReactECharts option={cropOption} style={{ height: 230 }} notMerge />
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: SCREEN_THEME.text }}>
            TOP 租户榜
          </div>
          <div style={{ maxHeight: 230, overflowY: 'auto' }}>
            {FALLBACK_TOP_TENANTS.map((item, index) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  marginBottom: 6,
                  borderRadius: 6,
                  background: 'rgba(160,200,240,0.08)',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    textAlign: 'center',
                    lineHeight: '20px',
                    fontSize: 12,
                    background: index < 3 ? SCREEN_THEME.accentOrange : 'rgba(160,200,240,0.2)',
                    color: index < 3 ? '#0a1c3d' : SCREEN_THEME.text,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </span>
                <span style={{ flex: 1, color: SCREEN_THEME.text, fontSize: 13 }}>{item.name}</span>
                <span style={{ color: SCREEN_THEME.subText, fontSize: 12 }}>
                  {item.farmCount} 农场 / {item.area.toLocaleString('zh-CN')} 亩
                </span>
                <span style={{ color: SCREEN_THEME.accent, fontSize: 13, fontWeight: 600 }}>
                  {item.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
