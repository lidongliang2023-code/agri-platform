/**
 * 页面名称：GIS地图监管
 * 路由路径：/admin/production/farms/map
 * 所属模块：农场监管
 * PRD 序号：PRD 6.2 #10
 * 原型来源：P5 farm-map — GIS地图监管
 */
import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  BorderOuterOutlined,
  CameraOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FireOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import {
  listSupervisedComplianceProfiles,
  listSupervisedFarmMapPoints,
} from '@/api/admin/farms'
import type { FarmComplianceProfile } from '@/api/admin/farms'
import {
  RISK_BAND_META,
  SAMPLE_MAP_POINTS,
  buildRiskInfo,
  exportCsv,
  formatRegion,
} from './supervisionShared'
import type { RiskLevelKey, SupervisionMapPoint } from './supervisionShared'

const { Text, Title } = Typography

/** 图层模式：热力图 / 聚合 */
type LayerKey = 'heatmap' | 'cluster'

/** 区域聚合统计模型 */
interface RegionAggregate {
  /** 区域键（省份或城市） */
  key: string
  /** 区域名称 */
  name: string
  /** 农场数 */
  farmCount: number
  /** 面积合计（亩） */
  areaTotal: number
  /** 平均风险评分 */
  avgRisk: number
  /** 正常数量 */
  normal: number
  /** 预警数量 */
  warning: number
  /** 异常数量 */
  abnormal: number
  /** 主导风险等级 */
  dominantRisk: RiskLevelKey
}

/** 地图筛选条件 */
interface MapFilters {
  /** 省份 */
  province: string
  /** 城市 */
  city: string
  /** 状态多选 */
  statuses: string[]
  /** 风险等级多选 */
  riskLevels: RiskLevelKey[]
}

/**
 * GIS 地图监管
 *
 * 业务职责：地图模式下按区域 / 状态 / 风险等级筛选并统计农场分布，支持图层切换与导出。
 *
 * ⚠️ GIS 实现说明（技术选型原因）：
 * 1. 后端 `GET /admin/farms/map` 当前只返回「省 + 市 + 区 + 面积」，不含经纬度，无法做真实打点；
 * 2. 项目未内置中国行政 GeoJSON，且按约定不引入高德 / 百度等外部地图依赖；
 * 3. 原型 P5 中的地图本体亦为占位色块，真实交互是「区域筛选 + 统计条 + 图层切换」。
 * 因此采用等价替代方案：**区域聚合网格 + ECharts 热力图**
 * - 「热力图」图层：X 轴区域、Y 轴风险等级，色块深浅表示农场密度；
 * - 「聚合」图层：区域卡片网格，底色深浅表示农场密度，左边框颜色表示主导风险等级；
 * 两者与原型 P5 的交互口径完全一致。
 *
 * @returns 页面内容
 */
export default function FarmGisMap(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  /** 图表实例引用，用于导出截图 */
  const chartRef = useRef<ReactECharts>(null)

  /** 当前图层 */
  const [layer, setLayer] = useState<LayerKey>('heatmap')
  /** 是否处于框选模式 */
  const [boxSelectMode, setBoxSelectMode] = useState<boolean>(false)
  /** 框选选中的区域键 */
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  /** 面板筛选草稿值 */
  const [draft, setDraft] = useState<MapFilters>({
    province: '',
    city: '',
    statuses: ['正常', '预警', '异常'],
    riskLevels: ['low', 'medium', 'high'],
  })
  /** 已应用的筛选条件 */
  const [applied, setApplied] = useState<MapFilters>(draft)

  /** 农场地理分布 */
  const mapQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'map'],
    queryFn: () => listSupervisedFarmMapPoints(),
    retry: false,
  })

  /** 合规画像（用于派生风险评分） */
  const profilesQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'profiles'],
    queryFn: () => listSupervisedComplianceProfiles(200),
    retry: false,
  })

  /** 画像 Map：farmId → 合规等级 */
  const profileMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    const list = profilesQuery.data
    if (Array.isArray(list)) {
      list.forEach((item) => {
        if (item?.farmId && item.complianceLevel) {
          map.set(String(item.farmId), item.complianceLevel)
        }
      })
    }
    return map
  }, [profilesQuery.data])

  /** 地图点位：后端优先，无数据降级为原型示例分布 */
  const points = useMemo<SupervisionMapPoint[]>(() => {
    const remote = mapQuery.data
    if (Array.isArray(remote) && remote.length > 0) {
      return remote.map((item) => {
        const level = profileMap.get(String(item.farmId))
        const profile: FarmComplianceProfile | undefined = level
          ? {
              farmId: String(item.farmId),
              plotCount: 0,
              certCount: 0,
              certExpiring: 0,
              certExpired: 0,
              complianceLevel: level as 'OK' | 'WARN' | 'RISK',
            }
          : undefined
        const risk = buildRiskInfo(String(item.farmId), profile, false)
        return {
          farmId: item.farmId,
          farmName: item.farmName,
          province: item.province || '',
          city: item.city || '',
          district: item.district || '',
          areaTotal: Number(item.areaTotal) || 0,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          statusLabel: RISK_BAND_META[risk.riskLevel].farmStatus,
        }
      })
    }
    return SAMPLE_MAP_POINTS
  }, [mapQuery.data, profileMap])

  /** 是否使用原型示例点位 */
  const usingSample: boolean = useMemo<boolean>(() => {
    const remote = mapQuery.data
    return !(Array.isArray(remote) && remote.length > 0) && !mapQuery.isLoading
  }, [mapQuery.data, mapQuery.isLoading])

  /** 省份选项 */
  const provinceOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    points.forEach((item) => {
      if (item.province) {
        set.add(item.province)
      }
    })
    return Array.from(set)
  }, [points])

  /** 城市选项（跟随当前省份草稿值） */
  const cityOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    points
      .filter((item) => !draft.province || item.province === draft.province)
      .forEach((item) => {
        if (item.city) {
          set.add(item.city)
        }
      })
    return Array.from(set)
  }, [points, draft.province])

  /** 筛选后的点位 */
  const filteredPoints = useMemo<SupervisionMapPoint[]>(
    () =>
      points.filter((item) => {
        if (applied.province && item.province !== applied.province) {
          return false
        }
        if (applied.city && item.city !== applied.city) {
          return false
        }
        if (!applied.statuses.includes(item.statusLabel)) {
          return false
        }
        if (!applied.riskLevels.includes(item.riskLevel)) {
          return false
        }
        if (selectedRegions.length > 0) {
          const key = applied.province ? item.city : item.province
          if (!selectedRegions.includes(key)) {
            return false
          }
        }
        return true
      }),
    [points, applied, selectedRegions],
  )

  /** 区域聚合（选中省份时按城市聚合，否则按省份聚合） */
  const regionAggregates = useMemo<RegionAggregate[]>(() => {
    const map = new Map<string, RegionAggregate>()
    filteredPoints.forEach((item) => {
      const key = applied.province ? item.city || '未知城市' : item.province || '未知省份'
      const current: RegionAggregate = map.get(key) ?? {
        key,
        name: key,
        farmCount: 0,
        areaTotal: 0,
        avgRisk: 0,
        normal: 0,
        warning: 0,
        abnormal: 0,
        dominantRisk: 'low',
      }
      current.farmCount += 1
      current.areaTotal += item.areaTotal
      current.avgRisk += item.riskScore
      if (item.riskLevel === 'high') {
        current.abnormal += 1
      } else if (item.riskLevel === 'medium') {
        current.warning += 1
      } else {
        current.normal += 1
      }
      map.set(key, current)
    })
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgRisk: item.farmCount > 0 ? Math.round(item.avgRisk / item.farmCount) : 0,
        dominantRisk:
          item.abnormal >= item.warning && item.abnormal >= item.normal
            ? ('high' as RiskLevelKey)
            : item.warning >= item.normal
              ? ('medium' as RiskLevelKey)
              : ('low' as RiskLevelKey),
      }))
      .sort((a, b) => b.farmCount - a.farmCount)
  }, [filteredPoints, applied.province])

  /** 最大密度，用于颜色深浅插值 */
  const maxFarmCount: number = useMemo<number>(
    () => regionAggregates.reduce((max, item) => Math.max(max, item.farmCount), 0),
    [regionAggregates],
  )

  /** 统计条数据（原型 P5 Statistics Bar） */
  const stats = useMemo<{ total: number; normal: number; warning: number; abnormal: number }>(
    () => ({
      total: filteredPoints.length,
      normal: filteredPoints.filter((item) => item.riskLevel === 'low').length,
      warning: filteredPoints.filter((item) => item.riskLevel === 'medium').length,
      abnormal: filteredPoints.filter((item) => item.riskLevel === 'high').length,
    }),
    [filteredPoints],
  )

  /** 热力图配置 */
  const heatmapOption: EChartsOption = useMemo<EChartsOption>(() => {
    const xData = regionAggregates.map((item) => item.name)
    const yData = ['高风险', '中风险', '低风险']
    const data: Array<[number, number, number]> = []
    regionAggregates.forEach((item, xIndex) => {
      data.push([xIndex, 0, item.abnormal])
      data.push([xIndex, 1, item.warning])
      data.push([xIndex, 2, item.normal])
    })
    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const typed = params as { data: [number, number, number] }
          const name = xData[typed.data[0]] ?? ''
          const level = yData[typed.data[1]] ?? ''
          return `${name}<br/>${level}农场：${typed.data[2]} 个`
        },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 64, containLabel: true },
      xAxis: {
        type: 'category',
        data: xData,
        splitArea: { show: true },
        axisLabel: { interval: 0, rotate: xData.length > 8 ? 30 : 0 },
      },
      yAxis: { type: 'category', data: yData, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: Math.max(1, maxFarmCount),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        itemWidth: 12,
        itemHeight: 90,
        inRange: { color: ['#eafbe6', '#95de64', '#faad14', '#ff4d4f'] },
        text: ['密度高', '低'],
      },
      series: [
        {
          name: '农场密度',
          type: 'heatmap',
          data,
          label: {
            show: true,
            formatter: (params: unknown) => {
              const typed = params as { data: [number, number, number] }
              return typed.data[2] > 0 ? String(typed.data[2]) : ''
            },
          },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 0, 0, 0.3)' } },
        },
      ],
    }
  }, [regionAggregates, maxFarmCount])

  /** 点位明细列 */
  const pointColumns: ColumnsType<SupervisionMapPoint> = [
    {
      title: '农场名称',
      dataIndex: 'farmName',
      width: 180,
      render: (value: string, row) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={() => navigate(`/admin/production/farms/${row.farmId}`)}
        >
          {value}
        </Button>
      ),
    },
    {
      title: '区域',
      width: 180,
      render: (_value: unknown, row) => formatRegion(row.province, row.city),
    },
    {
      title: '面积',
      dataIndex: 'areaTotal',
      width: 110,
      align: 'right',
      render: (value: number) => `${value.toLocaleString('zh-CN')}亩`,
    },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      width: 100,
      align: 'center',
      render: (value: number, row) => (
        <Tag color={RISK_BAND_META[row.riskLevel].tagColor}>{value}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      width: 90,
      align: 'center',
      render: (_value: unknown, row) => (
        <Tag color={RISK_BAND_META[row.riskLevel].tagColor}>
          {RISK_BAND_META[row.riskLevel].farmStatus}
        </Tag>
      ),
    },
  ]

  /** 应用筛选 */
  const handleApply = (): void => {
    if (draft.statuses.length === 0) {
      message.warning('请至少勾选一个状态')
      return
    }
    if (draft.riskLevels.length === 0) {
      message.warning('请至少勾选一个风险等级')
      return
    }
    setApplied({ ...draft })
    setSelectedRegions([])
  }

  /** 重置筛选 */
  const handleReset = (): void => {
    const empty: MapFilters = {
      province: '',
      city: '',
      statuses: ['正常', '预警', '异常'],
      riskLevels: ['low', 'medium', 'high'],
    }
    setDraft(empty)
    setApplied(empty)
    setSelectedRegions([])
    setBoxSelectMode(false)
  }

  /** 导出当前视图：热力图导出 PNG，聚合网格导出 CSV */
  const handleExport = (): void => {
    const instance = layer === 'heatmap' ? chartRef.current?.getEchartsInstance() : undefined
    if (instance) {
      const url = instance.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.href = url
      link.download = `农场地理分布热力图_${Date.now()}.png`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('已导出热力图截图')
      return
    }
    if (filteredPoints.length === 0) {
      message.warning('当前没有可导出的数据')
      return
    }
    exportCsv<SupervisionMapPoint>('农场地理分布', filteredPoints, [
      { title: '农场名称', render: (row) => row.farmName },
      { title: '省份', render: (row) => row.province },
      { title: '城市', render: (row) => row.city },
      { title: '区县', render: (row) => row.district },
      { title: '面积(亩)', render: (row) => row.areaTotal },
      { title: '风险评分', render: (row) => row.riskScore },
      { title: '状态', render: (row) => row.statusLabel },
    ])
    message.success(`已导出 ${filteredPoints.length} 个农场的分布数据`)
  }

  /**
   * 根据农场密度计算聚合卡片底色透明度（0.12 ~ 0.6）。
   *
   * @param count 农场数量
   * @returns 透明度
   */
  const densityOpacity = (count: number): number => {
    if (maxFarmCount <= 0) {
      return 0.12
    }
    return 0.12 + (Math.min(count, maxFarmCount) / maxFarmCount) * 0.48
  }

  return (
    <div>
      {/* 标题栏 + 返回（原型 P5 面包屑） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            地图监管
          </Title>
          <Text type="secondary">首页 &gt; 生产管理 &gt; 农场监管 &gt; 地图监管</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/farms')}>
              返回农场列表
            </Button>
            <Tooltip title="导出当前视图">
              <Button icon={<CameraOutlined />} onClick={handleExport}>
                导出截图
              </Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        {/* 筛选面板（原型 P5 Filter Panel） */}
        <Col xs={24} lg={6}>
          <Card size="small" title="筛选面板">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary">省份</Text>
                <Select
                  allowClear
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="全部"
                  value={draft.province || undefined}
                  onChange={(value?: string) =>
                    setDraft({ ...draft, province: value ?? '', city: '' })
                  }
                  options={provinceOptions.map((item) => ({ label: item, value: item }))}
                />
              </div>
              <div>
                <Text type="secondary">城市</Text>
                <Select
                  allowClear
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="全部"
                  value={draft.city || undefined}
                  onChange={(value?: string) => setDraft({ ...draft, city: value ?? '' })}
                  options={cityOptions.map((item) => ({ label: item, value: item }))}
                />
              </div>
              <div>
                <Text type="secondary">状态筛选</Text>
                <div style={{ marginTop: 4 }}>
                  <Checkbox.Group
                    style={{ width: '100%' }}
                    value={draft.statuses}
                    onChange={(values) => setDraft({ ...draft, statuses: values as string[] })}
                    options={(['high', 'medium', 'low'] as RiskLevelKey[])
                      .map((key) => RISK_BAND_META[key].farmStatus)
                      .map((value) => ({
                        label: `${
                          value === '正常' ? '🟢' : value === '预警' ? '🟡' : '🔴'
                        } ${value}`,
                        value,
                      }))}
                  />
                </div>
              </div>
              <div>
                <Text type="secondary">风险等级</Text>
                <div style={{ marginTop: 4 }}>
                  <Checkbox.Group
                    style={{ width: '100%' }}
                    value={draft.riskLevels}
                    onChange={(values) =>
                      setDraft({ ...draft, riskLevels: values as RiskLevelKey[] })
                    }
                    options={(['low', 'medium', 'high'] as RiskLevelKey[]).map((key) => ({
                      label: `${RISK_BAND_META[key].shortLabel}(${RISK_BAND_META[key].rangeText})`,
                      value: key,
                    }))}
                  />
                </div>
              </div>
              <Space>
                <Button type="primary" onClick={handleApply}>
                  应用筛选
                </Button>
                <Button onClick={handleReset}>
                  重置筛选
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* 地图区（原型 P5 Map Area） */}
        <Col xs={24} lg={18}>
          <Card
            size="small"
            title={
              <Space>
                <EnvironmentOutlined />
                农场地理分布
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  type={boxSelectMode ? 'primary' : 'default'}
                  icon={<BorderOuterOutlined />}
                  onClick={() => {
                    setBoxSelectMode(!boxSelectMode)
                    if (boxSelectMode) {
                      setSelectedRegions([])
                    }
                  }}
                >
                  框选查看
                </Button>
                <Segmented
                  size="small"
                  value={layer}
                  onChange={(value) => setLayer(String(value) as LayerKey)}
                  options={[
                    {
                      label: (
                        <Space size={4}>
                          <FireOutlined />
                          热力图
                        </Space>
                      ),
                      value: 'heatmap',
                    },
                    {
                      label: (
                        <Space size={4}>
                          <AppstoreOutlined />
                          聚合
                        </Space>
                      ),
                      value: 'cluster',
                    },
                  ]}
                />
                <Tooltip title="导出当前视图">
                  <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} />
                </Tooltip>
              </Space>
            }
          >
            {/* 统计条（原型 P5 Statistics Bar） */}
            <Space size={16} wrap style={{ marginBottom: 8 }}>
              <Text strong>共筛选 {stats.total} 个农场</Text>
              <Tag color="green">🟢 正常 {stats.normal}</Tag>
              <Tag color="orange">🟡 预警 {stats.warning}</Tag>
              <Tag color="red">🔴 异常 {stats.abnormal}</Tag>
              {selectedRegions.length > 0 && (
                <Tag closable onClose={() => setSelectedRegions([])}>
                  已框选 {selectedRegions.length} 个区域
                </Tag>
              )}
            </Space>

            {usingSample && (
              <Alert
                style={{ marginBottom: 8 }}
                type="info"
                showIcon
                message="当前展示原型示例分布数据（后端 /admin/farms/map 暂未返回数据）"
                description="筛选、框选、图层切换与导出功能均可正常使用。"
              />
            )}

            {mapQuery.isError && (
              <Alert
                style={{ marginBottom: 8 }}
                type="error"
                showIcon
                message="地图数据加载失败，已降级为原型示例分布"
              />
            )}

            <Alert
              style={{ marginBottom: 8 }}
              type="warning"
              showIcon
              message="GIS 说明：本项目不引入外部地图依赖，后端暂未返回经纬度，项目也未内置中国 GeoJSON"
              description="此处以「区域聚合网格 + ECharts 热力图（色块深浅 = 农场密度）」等价替代原型中的占位地图，交互口径与原型 P5 保持一致。"
            />

            {/* 图层一：热力图 */}
            {layer === 'heatmap' &&
              (regionAggregates.length === 0 ? (
                <Empty description="当前筛选条件下没有农场" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <ReactECharts
                  ref={chartRef}
                  option={heatmapOption}
                  style={{ height: Math.max(320, regionAggregates.length * 26 + 120) }}
                  notMerge
                />
              ))}

            {/* 图层二：聚合网格 */}
            {layer === 'cluster' &&
              (regionAggregates.length === 0 ? (
                <Empty description="当前筛选条件下没有农场" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Row gutter={[8, 8]}>
                  {regionAggregates.map((item) => {
                    const meta = RISK_BAND_META[item.dominantRisk]
                    const rgb =
                      item.dominantRisk === 'high'
                        ? '255,77,79'
                        : item.dominantRisk === 'medium'
                          ? '250,140,22'
                          : '82,196,26'
                    const checked = selectedRegions.includes(item.key)
                    return (
                      <Col key={item.key} xs={12} sm={8} md={6}>
                        <Card
                          size="small"
                          hoverable
                          styles={{
                            body: {
                              padding: 10,
                              background: `rgba(${rgb}, ${densityOpacity(item.farmCount)})`,
                              borderLeft: `4px solid ${meta.color}`,
                            },
                          }}
                          onClick={() => {
                            if (boxSelectMode) {
                              setSelectedRegions(
                                checked
                                  ? selectedRegions.filter((key) => key !== item.key)
                                  : [...selectedRegions, item.key],
                              )
                              return
                            }
                            if (applied.province) {
                              setDraft({ ...draft, city: item.key })
                              setApplied({ ...applied, city: item.key })
                            } else {
                              setDraft({ ...draft, province: item.key, city: '' })
                              setApplied({ ...applied, province: item.key, city: '' })
                            }
                          }}
                        >
                          <Row justify="space-between" align="middle">
                            <Col>
                              <Text strong>{item.name}</Text>
                            </Col>
                            <Col>{boxSelectMode && <Checkbox checked={checked} />}</Col>
                          </Row>
                          <div>
                            <Text style={{ fontSize: 20, fontWeight: 600 }}>{item.farmCount}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {' '}
                              个农场
                            </Text>
                          </div>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {item.areaTotal.toLocaleString('zh-CN')}亩 · 均分 {item.avgRisk}
                            </Text>
                          </div>
                          <Space size={4} style={{ marginTop: 4 }}>
                            <Tag color="green">{item.normal}</Tag>
                            <Tag color="orange">{item.warning}</Tag>
                            <Tag color="red">{item.abnormal}</Tag>
                          </Space>
                        </Card>
                      </Col>
                    )
                  })}
                </Row>
              ))}
          </Card>
        </Col>
      </Row>

      {/* 筛选结果明细 */}
      <Card size="small" style={{ marginTop: 12 }} title="筛选结果明细">
        <Table<SupervisionMapPoint>
          rowKey="farmId"
          size="small"
          columns={pointColumns}
          dataSource={filteredPoints}
          loading={mapQuery.isLoading}
          locale={{ emptyText: '暂无农场数据' }}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>
    </div>
  )
}
