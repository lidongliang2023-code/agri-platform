/**
 * 页面名称：数据大屏驾驶舱
 * 路由路径：/admin/production/dashboard/screen
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #3
 * 说明：原型无此页，按 PRD「投屏展示、区域地图、实时滚动指标」实现；
 * 深色背景为业务大屏设计要求，页面内所有文本均使用高对比度浅色，确保在深色下可读。
 *
 * ====================== 数据源实测结论（已连后端验证） ======================
 * 可用（真实数据）：
 * - GET /admin/dashboard              农场 / 地块 / 待办任务 / 在库批次 / 检测合格与不合格 / 待处理告警 / 在线设备
 * - GET /admin/dashboard/rank         TOP 农场种植面积排行
 * - GET /admin/dashboard/alert-trend  告警级别分布（INFO / WARN / CRITICAL）
 * 不可用（后端无此端点，code=500）：
 * - GET /admin/dashboard/screen                → 大屏专用聚合
 * - GET /admin/dashboard/region-distribution   → 区域生产分布
 * - GET /admin/dashboard/realtime              → 实时滚动指标流
 * 后端亦无「近 12 小时趋势」「在田作物结构」端点。
 *
 * 处置：真实端点出真数；不可用端点**不再用硬编码示例数据顶替**，统一空态 + 明确提示。
 * =========================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Alert, Button, Empty, Space, Tooltip, Typography } from 'antd'
import {
  ExclamationCircleOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAlertLevelMap,
  fetchOpsOverviewMetrics,
  fetchRankItems,
} from '@/api/admin/dashboard'

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
  /** 数值文本（后端未返回时为 undefined，渲染为「未接入」） */
  value?: number
  /** 单位 */
  unit: string
  /** 小数位 */
  precision: number
  /** 强调色 */
  color: string
}

/**
 * 将后端返回的「可能是字符串的数字」安全转为 number。
 *
 * @param value 后端原始值
 * @returns 数字；无法解析时返回 undefined（保持「未接入」语义，绝不填 0）
 */
function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** 告警级别中文名 */
const ALERT_LEVEL_TEXT: Record<string, string> = {
  INFO: '提示级',
  WARN: '预警级',
  CRITICAL: '严重级',
}

/** 告警级别配色 */
const ALERT_LEVEL_COLOR: Record<string, string> = {
  INFO: SCREEN_THEME.accentBlue,
  WARN: SCREEN_THEME.accentOrange,
  CRITICAL: SCREEN_THEME.accentRed,
}

/** 不可用面板的空态（深色底适配） */
function PanelEmpty({ text }: { text: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: SCREEN_THEME.subText, fontSize: 12 }}>{text}</span>}
      />
    </div>
  )
}

/**
 * 数据大屏驾驶舱
 *
 * 业务职责：面向投屏的运营驾驶舱，含大字号核心指标、TOP 农场榜、告警级别分布；
 * 区域分布 / 实时滚动流 / 近 12 小时趋势 / 作物结构因后端无对应端点，统一呈现空态并明示。
 *
 * @returns 页面内容
 */
export default function OpsDataScreen(): JSX.Element {
  /** 大屏容器引用（用于全屏切换） */
  const containerRef = useRef<HTMLDivElement>(null)
  /** 是否已进入全屏 */
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  /** 当前时间 */
  const [now, setNow] = useState<string>(new Date().toLocaleString('zh-CN', { hour12: false }))
  const queryClient = useQueryClient()

  /** 运营大盘真实指标（每 5 分钟自动刷新） */
  const overviewQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'overview'],
    queryFn: () => fetchOpsOverviewMetrics(),
    retry: false,
    refetchInterval: 300_000,
  })

  /** TOP 农场种植面积排行（真实） */
  const rankQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'rank'],
    queryFn: () => fetchRankItems(10),
    retry: false,
    refetchInterval: 300_000,
  })

  /** 告警级别分布（真实） */
  const alertQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'alert-trend'],
    queryFn: () => fetchAlertLevelMap(),
    retry: false,
    refetchInterval: 300_000,
  })

  /** 时钟：每秒刷新一次，组件卸载时清理 */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date().toLocaleString('zh-CN', { hour12: false }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  /** 核心指标（全部来自 GET /admin/dashboard；未返回则显示「未接入」） */
  const kpiList: ScreenKpi[] = useMemo<ScreenKpi[]>(() => {
    const raw = overviewQuery.data
    return [
      {
        key: 'farm',
        title: '接入农场',
        value: toNumber(raw?.farmCount),
        unit: '个',
        precision: 0,
        color: SCREEN_THEME.accent,
      },
      {
        key: 'plot',
        title: '地块总数',
        value: toNumber(raw?.plotCount),
        unit: '个',
        precision: 0,
        color: SCREEN_THEME.accentBlue,
      },
      {
        key: 'device',
        title: '在线设备',
        value: toNumber(raw?.deviceOnline),
        unit: `/ ${raw?.deviceTotal ?? '—'} 台`,
        precision: 0,
        color: '#69b1ff',
      },
      {
        key: 'task',
        title: '待办任务',
        value: toNumber(raw?.taskPending),
        unit: '条',
        precision: 0,
        color: SCREEN_THEME.accentOrange,
      },
      {
        key: 'batch',
        title: '在库批次',
        value: toNumber(raw?.batchInStock),
        unit: '个',
        precision: 0,
        color: '#7ee787',
      },
      {
        key: 'alert',
        title: '待处理告警',
        value: toNumber(raw?.alertPending),
        unit: '条',
        precision: 0,
        color: SCREEN_THEME.accentRed,
      },
      {
        key: 'inspection',
        title: '检测合格 / 不合格',
        value: undefined,
        unit: '',
        precision: 0,
        color: SCREEN_THEME.accent,
      },
    ]
  }, [overviewQuery.data])

  /** 检测合格 / 不合格（后端返回的两个真实计数，不做比率换算） */
  const inspectionText: string = useMemo(() => {
    const pass = toNumber(overviewQuery.data?.inspectionPass)
    const fail = toNumber(overviewQuery.data?.inspectionFail)
    if (pass === undefined && fail === undefined) {
      return '未接入'
    }
    return `${pass ?? '—'} / ${fail ?? '—'}`
  }, [overviewQuery.data])

  /** 告警级别分布行（真实） */
  const alertRows = useMemo(() => {
    const raw = alertQuery.data ?? {}
    return Object.entries(raw)
      .map(([level, count]) => ({
        level,
        label: ALERT_LEVEL_TEXT[level] ?? level,
        count: toNumber(count as string | number) ?? 0,
        color: ALERT_LEVEL_COLOR[level] ?? SCREEN_THEME.accentBlue,
      }))
      .filter((item) => item.count > 0)
  }, [alertQuery.data])

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

  /** 手动刷新全部真实指标 */
  const handleRefresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  /** 通用面板样式 */
  const panelStyle: CSSProperties = {
    background: SCREEN_THEME.panel,
    border: `1px solid ${SCREEN_THEME.border}`,
    borderRadius: 8,
    padding: 12,
    height: '100%',
  }

  /** 真实数据是否至少有一个源成功 */
  const hasRealData = Boolean(overviewQuery.data || rankQuery.data || alertQuery.data)

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
      <Alert
        banner
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="大屏口径说明：核心指标、TOP 农场榜、告警级别分布取自真实接口；区域分布 / 实时滚动流 / 近 12 小时趋势 / 作物结构后端暂无接口，显示为空态，不做示例数据填充"
      />

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
            {hasRealData ? '实时数据模式' : '未取到数据'} · 数据每 5 分钟自动刷新
          </span>
        </div>
        <Space size={8}>
          <span style={{ color: SCREEN_THEME.accent, fontSize: 16, fontWeight: 600 }}>{now}</span>
          <Tooltip title="重新拉取大屏数据">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
                  color: item.value === undefined ? SCREEN_THEME.subText : item.color,
                  textShadow: item.value === undefined ? 'none' : `0 0 10px ${item.color}55`,
                }}
              >
                {item.key === 'inspection'
                  ? inspectionText
                  : item.value === undefined
                    ? '未接入'
                    : item.value.toLocaleString('zh-CN', {
                        minimumFractionDigits: item.precision,
                        maximumFractionDigits: item.precision,
                      })}
              </span>
              {item.unit && item.key !== 'inspection' ? (
                <span style={{ color: SCREEN_THEME.subText, fontSize: 13 }}>{item.unit}</span>
              ) : null}
            </div>
            <div style={{ marginTop: 4, color: SCREEN_THEME.subText, fontSize: 12 }}>
              {item.key === 'inspection' ? '条（后端未返回比率，不做换算）' : `来源：GET /admin/dashboard`}
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
        {/* 区域生产分布：后端暂无 /admin/dashboard/region-distribution 端点 */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: SCREEN_THEME.text }}>
              区域生产分布
            </span>
            <span style={{ fontSize: 12, color: SCREEN_THEME.accentOrange }}>未接入</span>
          </div>
          <PanelEmpty text="后端未提供 /admin/dashboard/region-distribution 端点，暂无区域分布数据" />
        </div>

        {/* 实时滚动指标：后端暂无 /admin/dashboard/realtime 端点 */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: SCREEN_THEME.text }}>
              实时生产动态
            </span>
            <span style={{ fontSize: 12, color: SCREEN_THEME.accentOrange }}>未接入</span>
          </div>
          <PanelEmpty text="后端未提供 /admin/dashboard/realtime 端点，暂无实时滚动数据" />
        </div>

        {/* 告警播报：真实告警级别分布 */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: SCREEN_THEME.text }}>
              告警级别分布
            </span>
            <span style={{ color: SCREEN_THEME.accentOrange, fontSize: 12 }}>
              {alertRows.length > 0 ? '实时口径' : '未接入'}
            </span>
          </div>
          {alertRows.length === 0 ? (
            <PanelEmpty text="后端 /admin/dashboard/alert-trend 未返回数据" />
          ) : (
            <div style={{ maxHeight: 230, overflowY: 'auto' }}>
              {alertRows.map((item) => (
                <div
                  key={item.level}
                  style={{
                    padding: '8px 10px',
                    marginBottom: 8,
                    borderRadius: 6,
                    background: 'rgba(160,200,240,0.08)',
                    borderLeft: `3px solid ${item.color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Space size={6}>
                      <ExclamationCircleOutlined style={{ color: item.color }} />
                      <span style={{ color: SCREEN_THEME.text, fontSize: 13 }}>{item.label}</span>
                    </Space>
                    <span style={{ color: item.color, fontSize: 16, fontWeight: 700 }}>
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
          <PanelEmpty text="后端未提供小时级趋势端点，暂无趋势数据" />
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: SCREEN_THEME.text }}>
            在田作物结构
          </div>
          <PanelEmpty text="后端未提供作物结构统计端点，暂无数据" />
        </div>

        <div style={panelStyle}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: SCREEN_THEME.text }}>
            TOP 农场榜（按种植面积）
          </div>
          {rankQuery.data && rankQuery.data.length > 0 ? (
            <div style={{ maxHeight: 230, overflowY: 'auto' }}>
              {rankQuery.data.map((item, index) => (
                <div
                  key={item.farmId}
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
                  <span style={{ flex: 1, color: SCREEN_THEME.text, fontSize: 13 }}>
                    {item.farmName ?? item.farmId}
                  </span>
                  <span style={{ color: SCREEN_THEME.subText, fontSize: 12 }}>
                    {toNumber(item.areaTotal)?.toLocaleString('zh-CN') ?? '—'} 亩 /{' '}
                    {toNumber(item.plotCount as string | number) ?? '—'} 地块
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <PanelEmpty text="后端 /admin/dashboard/rank 未返回数据" />
          )}
        </div>
      </div>
    </div>
  )
}
