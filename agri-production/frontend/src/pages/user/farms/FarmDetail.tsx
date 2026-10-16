/**
 * 页面名称：农场详情
 * 路由路径：/production/farms/:farmId
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #5
 * 原型来源：用户端原型 P2 farm-detail
 *
 * 还原要点（对照原型 P2）：
 * - 头部 `< 返回农场列表` ｜ 农场名 ｜ `✏️ 编辑`、`📊 数据分析`
 * - 「📍 基本信息」：农场编号 / 状态 / 类型 / 地址 / 面积 / 海拔 / 负责人 / 联系电话 / 创建时间 / 资质
 * - 4 个指标卡：在田面积、本月产量、本月投入、预计收入
 * - 「🗺️ 地块分布」：地块缩略卡（作物 emoji / 状态 / 面积）+ `查看全部地块→`
 * - 「⚡ 快捷入口」：农事任务 / 生产监控 / 投入品台账 / 溯源管理
 *
 * 指标口径（增长=绿色↑，下降=红色↓，全站统一）：
 * - 在田面积：GET /farms/{farmId}/summary 的 plotAreaTotal / areaTotal（真实）
 * - 本月产量：本月采收批次数量合计（吨），副指标为较上月环比（真实）
 * - 本月投入：本月投入品使用记录笔数（真实）
 * - 预计收入：依赖交易模块成交价，暂无数据口径，展示「待接入」
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LineChartOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { MetricStatistic } from '@/components'
import { getFarm, getFarmSummary, listFarmCerts, updateFarm } from '@/api/farms'
import { listPlots } from '@/api/plots'
import { listHarvests } from '@/api/harvests'
import { listInputUsages } from '@/api/inputs'
import type { Plot } from '@/types'
// 地块状态与作物 emoji 已统一收敛到 @/types（原各页面各存一份）
import { CROP_EMOJI_MAP, PLOT_STATUS_META } from '@/types'

/** 农场类型（后端 1 种植 2 养殖 3 混合）兜底文案 */
const FARM_TYPE_FALLBACK_MAP: Record<number, string> = {
  1: '种植类',
  2: '养殖类',
  3: '综合种养',
}

/** 农场业务类型选项（原型 P3 口径） */
const FARM_TYPE_BUSINESS_OPTIONS: string[] = [
  '蔬菜种植',
  '水稻种植',
  '果树种植',
  '综合养殖',
  '畜牧养殖',
  '水产养殖',
]

/** 业务类型 → 后端 farmType */
const BUSINESS_TYPE_VALUE_MAP: Record<string, number> = {
  蔬菜种植: 1,
  水稻种植: 1,
  果树种植: 1,
  综合养殖: 3,
  畜牧养殖: 2,
  水产养殖: 2,
}

/** 快捷入口配置（原型 P2 四个入口） */
interface QuickEntry {
  /** 唯一键 */
  key: string
  /** 展示文案 */
  label: string
  /** 目标路由 */
  path: string
}

const QUICK_ENTRIES: QuickEntry[] = [
  { key: 'plan', label: '🌱 新建种养计划', path: '/production/plans?create=1' },
  { key: 'tasks', label: '📋 农事任务', path: '/production/tasks' },
  { key: 'monitor', label: '📡 生产监控→', path: '/production/monitor' },
  // 2026-10-16：原指向 /production/inputs/ledger（投入品使用台账，与「投入品台账」页重复），
  // 那一页已删除，改指权威页「投入品台账」（/production/inputs，含 档案 + 使用台账 两个 Tab）。
  // 该页的农场上下文取自全局 farm store（页面顶部有农场切换），所以无需透传 farmId。
  { key: 'inputs', label: '📦 投入品台账', path: '/production/inputs' },
  { key: 'trace', label: '🔗 溯源管理', path: '/production/trace' },
]

/** 需要把当前农场 ID 透传给目标页的入口 key */
const FARM_SCOPED_ENTRY_KEYS: string[] = ['plan', 'monitor']

/**
 * 拼接快捷入口目标地址，按需带上 `farmId` 上下文。
 *
 * 种养计划入口使用 `/production/plans?create=1`（PlanList 识别该参数自动弹出新增表单），
 * 不存在 `/production/plans/create` 路由，勿改回后者以免被 `plans/:planId` 兜底吞掉。
 *
 * @param entry 快捷入口配置
 * @param farmId 当前农场 ID
 * @returns 最终跳转地址
 */
function resolveEntryPath(entry: QuickEntry, farmId: string | undefined): string {
  if (!farmId || !FARM_SCOPED_ENTRY_KEYS.includes(entry.key)) return entry.path
  const separator = entry.path.includes('?') ? '&' : '?'
  return `${entry.path}${separator}farmId=${encodeURIComponent(farmId)}`
}

/** 编辑表单值 */
interface EditFormValues {
  /** 农场名称 */
  farmName: string
  /** 业务类型标签 */
  typeLabel: string
  /** 总面积（亩） */
  areaTotal: number
  /** 负责人 */
  managerName: string
  /** 联系电话 */
  managerPhone: string
  /** 详细地址 */
  address: string
  /** 海拔（米，持久化于 remark） */
  altitude?: number
}

/**
 * 从 remark 解析自定义键值。
 *
 * 后端 FarmInfoEntity 未包含「海拔」「业务类型」字段，
 * 表单以 `海拔:35m；产业类型:蔬菜种植` 结构写入 remark，此处回读。
 *
 * @param remark 备注原文
 * @param key 键名
 * @returns 解析值，未命中返回 undefined
 */
function parseRemarkField(remark: string | undefined, key: string): string | undefined {
  if (!remark) return undefined
  const match = remark.match(new RegExp(`${key}[:：]\\s*([^；;]+)`))
  const value = match?.[1]?.trim()
  return value ? value : undefined
}

/**
 * 合并自定义键值到 remark（保留其它既有键值对）。
 *
 * @param remark 原备注
 * @param entries 待写入键值对
 * @returns 合并后的备注
 */
function mergeRemark(remark: string | undefined, entries: Record<string, string>): string {
  const keys = Object.keys(entries)
  const kept: string[] = []
  ;(remark ?? '')
    .split(/[；;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.split(/[:：]/)[0]?.trim()
      if (!key || keys.includes(key)) return
      kept.push(item)
    })
  Object.entries(entries).forEach(([key, value]) => {
    if (value) kept.push(`${key}:${value}`)
  })
  return kept.join('；')
}

/**
 * 计算环比百分比。
 *
 * @param current 本期值
 * @param previous 上期值
 * @returns 环比百分比；上期为 0 时返回 undefined
 */
function calcTrend(current: number, previous: number): number | undefined {
  if (!previous) return undefined
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

/**
 * 农场详情页
 *
 * 业务职责：单农场全景视图，含基本信息、经营指标、地块分布与快捷入口，
 * 支持在线编辑基础资料。
 *
 * @returns 页面内容
 */
export default function FarmDetail(): JSX.Element {
  const { farmId } = useParams<{ farmId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState<boolean>(false)
  const [plotsExpanded, setPlotsExpanded] = useState<boolean>(false)
  const [editForm] = Form.useForm<EditFormValues>()

  /** 农场基本信息 */
  const farmQuery = useQuery({
    queryKey: ['farm-detail', farmId],
    enabled: Boolean(farmId),
    queryFn: () => getFarm(farmId as string),
  })

  /** 农场概况统计 */
  const summaryQuery = useQuery({
    queryKey: ['farm-summary', farmId],
    enabled: Boolean(farmId),
    queryFn: () => getFarmSummary(farmId as string),
    retry: false,
  })

  /** 农场下地块（后端列表接口不支持 farmId 过滤，取大页后本地过滤） */
  const plotsQuery = useQuery({
    queryKey: ['farm-plots', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ pageNum: 1, pageSize: 200 }),
  })

  /** 农场资质证照 */
  const certQuery = useQuery({
    queryKey: ['farm-certs', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listFarmCerts(farmId as string, { pageNum: 1, pageSize: 50 }),
    retry: false,
  })

  /** 采收批次：计算本月产量与环比 */
  const harvestQuery = useQuery({
    queryKey: ['farm-harvests', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listHarvests({ pageNum: 1, pageSize: 200 }),
    retry: false,
  })

  /** 投入品使用记录：计算本月投入笔数 */
  const usageQuery = useQuery({
    queryKey: ['farm-input-usages', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listInputUsages({ pageNum: 1, pageSize: 200 }),
    retry: false,
  })

  /** 保存编辑 */
  const updateMutation = useMutation({
    mutationFn: (values: EditFormValues) =>
      updateFarm(farmId as string, {
        farmName: values.farmName,
        areaTotal: Number(values.areaTotal),
        managerName: values.managerName,
        managerPhone: values.managerPhone,
        address: values.address,
        farmType: (BUSINESS_TYPE_VALUE_MAP[values.typeLabel] ?? 1) as 1 | 2 | 3,
        remark: mergeRemark(farmQuery.data?.remark, {
          海拔: values.altitude ? `${values.altitude}m` : '',
          产业类型: values.typeLabel ?? '',
        }),
      }),
    onSuccess: () => {
      message.success('农场信息已更新')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['farm-detail', farmId] })
      void queryClient.invalidateQueries({ queryKey: ['farms'] })
    },
  })

  /** 农场地块列表 */
  const farmPlots = useMemo<Plot[]>(
    () => (plotsQuery.data?.list ?? []).filter((plot) => plot.farmId === farmId),
    [plotsQuery.data, farmId],
  )

  /** 本月 / 上月产量（吨）与环比；接口不可用时整体为 null，显示「—」而非 0 吨 */
  const harvestStats = useMemo(() => {
    if (harvestQuery.isError || !harvestQuery.data) {
      return { current: null, previous: null, trend: undefined }
    }
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const batches = (harvestQuery.data.list ?? []).filter(
      (batch) => batch.farmId === farmId || farmPlots.some((plot) => plot.plotId === batch.plotId),
    )
    const sumOf = (month: string): number =>
      batches
        .filter((batch) => (batch.harvestDate ?? '').startsWith(month))
        .reduce((total, batch) => total + (Number(batch.quantity) || 0), 0)
    const current = Number((sumOf(thisMonth) / 1000).toFixed(2))
    const previous = Number((sumOf(lastMonth) / 1000).toFixed(2))
    return { current, previous, trend: calcTrend(current, previous) }
  }, [harvestQuery.data, harvestQuery.isError, farmId, farmPlots])

  /** 本月投入笔数；接口不可用时为 null，显示「—」而非 0 笔 */
  const usageCount: number | null = useMemo(() => {
    if (usageQuery.isError || !usageQuery.data) return null
    const plotIds = farmPlots.map((plot) => plot.plotId)
    return (usageQuery.data.list ?? []).filter(
      (usage) => usage.plotId && plotIds.includes(usage.plotId),
    ).length
  }, [usageQuery.data, usageQuery.isError, farmPlots])

  /**
   * 概况：地块数 / 在田面积 / 利用率。
   *
   * `GET /farms/{farmId}/summary` 不可用时三项全为 null，
   * 页面显示「—」并给出可见提示——此前 `pick()` 把缺失值兜成 0，
   * 会在「利用率 0%」这种位置把「没数据」显示成「确实为零」。
   */
  const summary = useMemo(() => {
    const raw = summaryQuery.data as unknown as Record<string, unknown> | undefined
    const available = !summaryQuery.isError && Boolean(raw)
    const pick = (key: string): number | null => {
      if (!available) return null
      const parsed = Number(raw?.[key])
      return Number.isFinite(parsed) ? parsed : null
    }
    const plotAreaTotal = pick('plotAreaTotal')
    const declaredArea = pick('areaTotal')
    const areaTotal =
      declaredArea !== null && declaredArea > 0
        ? declaredArea
        : farmQuery.data?.areaTotal !== undefined && Number(farmQuery.data.areaTotal) > 0
          ? Number(farmQuery.data.areaTotal)
          : null
    const usageRate =
      plotAreaTotal !== null && areaTotal !== null && areaTotal > 0
        ? Math.round((plotAreaTotal / areaTotal) * 100)
        : null
    return { plotCount: pick('plotCount'), plotAreaTotal, areaTotal, usageRate }
  }, [summaryQuery.data, summaryQuery.isError, farmQuery.data])

  /** 打开编辑弹窗并回填 */
  const openEdit = (): void => {
    const farm = farmQuery.data
    if (!farm) return
    const altitudeText = parseRemarkField(farm.remark, '海拔') ?? ''
    editForm.setFieldsValue({
      farmName: farm.farmName,
      typeLabel:
        parseRemarkField(farm.remark, '产业类型') ??
        FARM_TYPE_FALLBACK_MAP[farm.farmType] ??
        '蔬菜种植',
      areaTotal: Number(farm.areaTotal) || 0,
      managerName: farm.managerName,
      managerPhone: farm.managerPhone,
      address: farm.address,
      altitude: Number(altitudeText.replace('m', '')) || undefined,
    })
    setEditOpen(true)
  }

  /** 渲染同比箭头（增长绿↑ / 下降红↓） */
  const renderTrend = (trend: number | undefined): JSX.Element => {
    if (trend === undefined) {
      return <Typography.Text type="secondary">环比 —</Typography.Text>
    }
    const up = trend >= 0
    return (
      <Typography.Text style={{ color: up ? '#52c41a' : '#ff4d4f' }}>
        {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(trend)}%
      </Typography.Text>
    )
  }

  /** 渲染主内容（加载 / 错误 / 空态 / 正常） */
  const renderBody = (): JSX.Element => {
    if (farmQuery.isLoading) {
      return <Skeleton active paragraph={{ rows: 10 }} />
    }
    if (farmQuery.isError || !farmQuery.data) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">农场数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void farmQuery.refetch()}>重新加载</Button>
              <Button onClick={() => navigate('/production/farms')}>返回农场列表</Button>
            </Space>
          }
        />
      )
    }

    const farm = farmQuery.data
    const typeLabel =
      parseRemarkField(farm.remark, '产业类型') ??
      FARM_TYPE_FALLBACK_MAP[farm.farmType] ??
      '未分类'
    const altitude = parseRemarkField(farm.remark, '海拔') ?? '暂未录入'
    const certs = certQuery.data?.list ?? []
    const visiblePlots = plotsExpanded ? farmPlots : farmPlots.slice(0, 5)

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title="📍 基本信息">
          <Descriptions
            bordered
            column={{ xs: 1, sm: 2, md: 3 }}
            size="small"
            items={[
              { key: 'code', label: '农场编号', children: farm.farmCode || '-' },
              {
                key: 'status',
                label: '状态',
                children:
                  farm.status === 1 ? <Tag color="green">运营中</Tag> : <Tag>已停用</Tag>,
              },
              { key: 'type', label: '类型', children: <Tag>{typeLabel}</Tag> },
              {
                key: 'address',
                label: '地址',
                children:
                  `${farm.province ?? ''}${farm.city ?? ''}${farm.district ?? ''}${
                    farm.address ?? ''
                  }` || '-',
              },
              {
                key: 'area',
                label: '面积',
                children: `${Number(farm.areaTotal || 0).toLocaleString('zh-CN')}亩`,
              },
              { key: 'altitude', label: '海拔', children: altitude },
              { key: 'manager', label: '负责人', children: farm.managerName || '-' },
              { key: 'phone', label: '联系电话', children: farm.managerPhone || '-' },
              { key: 'createdAt', label: '创建时间', children: farm.createdAt || '-' },
              {
                key: 'certs',
                label: '资质',
                span: 3,
                children:
                  certs.length === 0 ? (
                    <Typography.Text type="secondary">暂无资质记录</Typography.Text>
                  ) : (
                    <Space size={8} wrap>
                      {certs.map((cert) => (
                        <Tag key={cert.certId ?? cert.certName} color="blue">
                          {cert.certName}
                          {cert.expireDate ? `(${cert.expireDate} 到期)` : ''}
                        </Tag>
                      ))}
                    </Space>
                  ),
              },
            ]}
          />
        </Card>

        <Row gutter={16}>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <MetricStatistic title="在田面积" value={summary.plotAreaTotal} suffix="亩" />
              <Typography.Text type="secondary">
                利用率{' '}
                {summary.usageRate === null ? (
                  <Tooltip title="后端 /farms/{farmId}/summary 未提供在田面积 / 总面积，显示为「—」">
                    <Typography.Text type="secondary" style={{ cursor: 'help' }}>
                      —
                      <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
                    </Typography.Text>
                  </Tooltip>
                ) : (
                  `${summary.usageRate}%`
                )}
                （总面积 {summary.areaTotal === null ? '—' : summary.areaTotal.toLocaleString('zh-CN')}亩）
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <MetricStatistic
                title="本月产量"
                value={harvestStats.current}
                precision={2}
                suffix="吨"
                missingTip="采收批次接口未返回数据，显示为「—」，不按 0 吨处理"
              />
              <Space size={6}>
                {renderTrend(harvestStats.trend)}
                <Typography.Text type="secondary">较上月</Typography.Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <MetricStatistic
                title="本月投入"
                value={usageCount}
                suffix="笔"
                missingTip="投入品使用记录接口未返回数据，显示为「—」，不按 0 笔处理"
              />
              <Typography.Text type="secondary">投入品使用记录（金额待接入）</Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Tooltip title="收入测算依赖交易模块成交价，接入后自动填充">
                <Statistic title="预计收入" value="—" />
                <Typography.Text type="secondary">待交易数据接入</Typography.Text>
              </Tooltip>
            </Card>
          </Col>
        </Row>

        <Card
          title={`🗺️ 地块分布 (${summary.plotCount === null ? farmPlots.length : summary.plotCount}个地块)`}
          extra={
            <Typography.Link onClick={() => navigate(`/production/plots?farmId=${farmId}`)}>
              查看全部地块→
            </Typography.Link>
          }
        >
          {farmPlots.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical">
                  <Typography.Text type="secondary">该农场暂无地块</Typography.Text>
                  <Button
                    type="primary"
                    onClick={() => navigate(`/production/plots/create?farmId=${farmId}`)}
                  >
                    新增地块
                  </Button>
                </Space>
              }
            />
          ) : (
            <Row gutter={[12, 12]}>
              {visiblePlots.map((plot) => {
                const cropKey = plot.cropVariety ?? ''
                const meta = PLOT_STATUS_META[plot.status] ?? { label: '未知', color: 'default' }
                return (
                  <Col key={plot.plotId} xs={24} sm={12} md={8} xl={6}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => navigate(`/production/plots/${plot.plotId}`)}
                      title={
                        <Space size={4}>
                          <span>{CROP_EMOJI_MAP[cropKey] ?? '🌱'}</span>
                          <Typography.Text ellipsis style={{ maxWidth: 90 }}>
                            {plot.plotName}
                          </Typography.Text>
                        </Space>
                      }
                      extra={<Tag color={meta.color}>{meta.label}</Tag>}
                    >
                      <Typography.Text type="secondary">
                        {cropKey || '未种植'} / {Number(plot.area || 0).toLocaleString('zh-CN')}亩
                      </Typography.Text>
                    </Card>
                  </Col>
                )
              })}
              {!plotsExpanded && farmPlots.length > 5 && (
                <Col xs={24} sm={12} md={8} xl={6}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => setPlotsExpanded(true)}
                    style={{ textAlign: 'center', borderStyle: 'dashed' }}
                  >
                    <Typography.Link>更多地块（{farmPlots.length - 5}）</Typography.Link>
                  </Card>
                </Col>
              )}
            </Row>
          )}
        </Card>

        <Card title="⚡ 快捷入口">
          <Row gutter={[12, 12]}>
            {QUICK_ENTRIES.map((entry) => (
              <Col key={entry.key} xs={12} sm={6}>
                <Button
                  block
                  size="large"
                  onClick={() => navigate(resolveEntryPath(entry, farmId))}
                >
                  {entry.label}
                </Button>
              </Col>
            ))}
          </Row>
        </Card>
      </Space>
    )
  }

  return (
    <PageContainer
      title={`🏠 ${farmQuery.data?.farmName ?? '农场详情'}`}
      subTitle={farmQuery.data?.farmCode}
      onBack={() => navigate('/production/farms')}
      backIcon={<LeftOutlined />}
      extra={[
        <Button key="edit" icon={<EditOutlined />} onClick={openEdit} disabled={!farmQuery.data}>
          ✏️ 编辑
        </Button>,
        <Button
          key="analytics"
          icon={<LineChartOutlined />}
          onClick={() => navigate('/production/analytics')}
        >
          📊 数据分析
        </Button>,
      ]}
    >
      {!farmId && <Alert type="warning" showIcon message="缺少农场 ID，请返回列表重新进入" />}
      {renderBody()}

      <Modal
        title="编辑农场资料"
        open={editOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateMutation.isPending}
        onCancel={() => setEditOpen(false)}
        onOk={() => {
          void editForm.validateFields().then((values) => updateMutation.mutate(values))
        }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="farmName"
            label="农场名称"
            rules={[
              { required: true, message: '请输入农场名称' },
              { min: 2, max: 50, message: '农场名称需为 2-50 个字符' },
            ]}
          >
            <Input placeholder="请输入农场名称" />
          </Form.Item>
          <Form.Item
            name="typeLabel"
            label="农场类型"
            rules={[{ required: true, message: '请选择农场类型' }]}
          >
            <Select
              options={FARM_TYPE_BUSINESS_OPTIONS.map((item) => ({ value: item, label: item }))}
            />
          </Form.Item>
          <Form.Item
            name="areaTotal"
            label="面积（亩）"
            rules={[{ required: true, message: '请输入农场面积' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入面积" />
          </Form.Item>
          <Form.Item name="altitude" label="海拔（米）">
            <InputNumber min={0} max={9000} style={{ width: '100%' }} placeholder="选填" />
          </Form.Item>
          <Form.Item
            name="managerName"
            label="负责人"
            rules={[{ required: true, message: '请输入负责人姓名' }]}
          >
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>
          <Form.Item
            name="managerPhone"
            label="联系电话"
            rules={[
              { required: true, message: '请输入联系电话' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号' },
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item
            name="address"
            label="详细地址"
            rules={[{ required: true, message: '请输入详细地址' }]}
          >
            <Input placeholder="请输入详细地址" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
