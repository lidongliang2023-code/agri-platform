/**
 * 页面名称：新增地块
 * 路由路径：/production/plots/create
 * 所属模块：农场数字化管理
 * 原型来源：用户端原型 P6 plot-create
 *
 * 还原要点（对照原型 P6）：
 * - 头部 `< 返回地块列表` ／ 新增地块
 * - 「地块基本信息」：所属农场（带 `农场总面积: X亩 | 已用: Y亩 | 空闲: Z亩` 提示条）、
 *   地块名称、面积（亩，不能超过空闲面积）、土壤类型（radio）、灌溉方式（radio）、坡度（radio）
 * - 「地块位置」：地图选点区域 + `点击地图选点 | 搜索位置 | 输入经纬度` + 经度 / 纬度输入
 * - 「地块边界（可选）」：天地图绘制多边形边界 + 实时面积提示
 * - 底部按钮：`取消`、`保存`、`保存并添加作物`
 *
 * 实现说明（2026-11-02 重构）：
 * - 边界绘制从「文本框逐行输入经纬度」改为 **天地图地图绘制**：点击地图添加顶点、
 *   点击顶点标记删除、支持撤销 / 清空，实时显示顶点数 / 面积（亩）/ 周长。
 *   组件位于 `@agri/shared` 的 `TiandituBoundaryEditor`，与 `TiandituMap` 共用 SDK 加载器。
 * - 边界仍是 GeoJSON 落 `boundary`（Polygon，首尾闭合，坡度作为 slope 扩展属性），
 *   不做任何自定义字段；编辑态从 `boundary` 回填（此前误读 `geoBoundary`，导致编辑时边界总为空）。
 * - 绘制出可用边界（≥3 顶点）且中心点为空时，自动用多边形质心补 `center_longitude` / `center_latitude`，
 *   这样列表 / 详情的地图视图能直接按中心点定位并展示边界。
 * - 支持 `?plotId=` 编辑态与 `?farmId=` 预选农场
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { LeftOutlined, EnvironmentOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { createPlot, getPlot, listPlots, updatePlot } from '@/api/plots'
import { getFarmSummary, listAllFarms } from '@/api/farms'
import {
  TiandituBoundaryEditor,
  computePolygonMetrics,
  geocodeAddress,
  parseBoundaryVertices,
  polygonCentroid,
} from '@agri/shared'

/** 土壤类型选项（原型 P6） */
const SOIL_TYPE_OPTIONS: string[] = ['壤土', '砂土', '黏土', '盐碱土']

/** 灌溉方式选项（原型 P6） */
const IRRIGATION_OPTIONS: string[] = ['滴灌', '喷灌', '微喷', '漫灌']

/** 坡度选项（原型 P6） */
const SLOPE_OPTIONS: string[] = ['平地', '缓坡', '陡坡']

/** 种植类型（后端枚举 1 露天 2 大棚 3 水田 4 山地） */
const PLANTING_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '露天' },
  { value: 2, label: '大棚' },
  { value: 3, label: '水田' },
  { value: 4, label: '山地' },
]

/** 坐标点：[经度, 纬度] */
type Coordinate = [number, number]

/** 点几何体 */
interface PointGeometry {
  /** 几何类型 */
  type: 'Point'
  /** 经纬度坐标 */
  coordinates: Coordinate
  /** 坡度描述 */
  slope?: string
}

/** 多边形几何体 */
interface PolygonGeometry {
  /** 几何类型 */
  type: 'Polygon'
  /** 外环坐标 */
  coordinates: number[][]
  /** 坡度描述 */
  slope?: string
}

/** 地块边界几何体联合类型 */
type BoundaryGeometry = PointGeometry | PolygonGeometry

/** 表单值 */
interface PlotFormValues {
  /** 所属农场 */
  farmId: string
  /** 地块名称 */
  plotName: string
  /** 面积（亩） */
  area: number
  /** 土壤类型 */
  soilType: string
  /** 灌溉方式 */
  irrigationType: string
  /** 种植类型 */
  plantingType: number
  /** 坡度 */
  slope: string
  /** 经度 */
  longitude?: number
  /** 纬度 */
  latitude?: number
}

/**
 * 安全解析 GeoJSON 字符串。
 *
 * @param raw 原始边界 GeoJSON 字符串（后端 `boundary`）
 * @returns 解析后的几何体，非法时返回 undefined
 */
function parseBoundary(raw: string | undefined): BoundaryGeometry | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as BoundaryGeometry
  } catch {
    return undefined
  }
}

/**
 * 构建 GeoJSON 边界字符串。
 *
 * <p>多边形顶点由天地图绘制编辑器给出（不闭合），这里补上首尾闭合点。
 * 只有顶点 ≥3 时才写多边形；1~2 个顶点的半成品在提交前就会被拦截，
 * 不会降级成 Point（那会让人以为边界已保存）。</p>
 *
 * @param values 表单值
 * @param points 边界顶点（`[经度, 纬度]`，不闭合）
 * @returns JSON 字符串；无任何位置信息时返回 undefined
 */
function buildBoundary(values: PlotFormValues, points: number[][]): string | undefined {
  if (points.length >= 3) {
    const geometry: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [...points, points[0]],
      slope: values.slope,
    }
    return JSON.stringify(geometry)
  }
  if (typeof values.longitude === 'number' && typeof values.latitude === 'number') {
    const geometry: PointGeometry = {
      type: 'Point',
      coordinates: [values.longitude, values.latitude],
      slope: values.slope,
    }
    return JSON.stringify(geometry)
  }
  return undefined
}

/**
 * 新增 / 编辑地块页面
 *
 * 业务职责：维护地块基础信息、位置与边界，支持面积余量校验与保存后跳转。
 *
 * @returns 页面内容
 */
export default function Create(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editingPlotId = searchParams.get('plotId')
  const presetFarmId = searchParams.get('farmId')

  const [form] = Form.useForm<PlotFormValues>()
  const watchedLongitude = Form.useWatch('longitude', form)
  const watchedLatitude = Form.useWatch('latitude', form)
  const [farmId, setFarmId] = useState<string | undefined>(presetFarmId ?? undefined)
  /** 边界顶点（`[经度, 纬度]`，不闭合；由天地图绘制编辑器维护） */
  const [boundaryPoints, setBoundaryPoints] = useState<number[][]>([])
  /** 地址定位关键字（只用于地图定位，不写入地块档案） */
  const [addressKeyword, setAddressKeyword] = useState('')
  /** 地址定位请求中 */
  const [locating, setLocating] = useState(false)
  /** 地址定位信号：递增后让地图重新居中到定位点 */
  const [locateSignal, setLocateSignal] = useState(0)
  const [saveAction, setSaveAction] = useState<'list' | 'crop'>('list')

  /** 农场下拉 */
  const farmQuery = useQuery({
    queryKey: ['farm-options'],
    queryFn: () => listAllFarms(),
  })

  /** 编辑态地块 */
  const plotQuery = useQuery({
    queryKey: ['plot-detail', editingPlotId],
    enabled: Boolean(editingPlotId),
    queryFn: () => getPlot(editingPlotId as string),
  })

  /** 地块详情加载后回填表单（含边界顶点） */
  useEffect(() => {
    const plot = plotQuery.data
    if (!plot) return
    // 后端真实列是 boundary；geoBoundary 是历史自造键，仅作为兜底读取
    const rawBoundary = plot.boundary ?? plot.geoBoundary
    const geometry = parseBoundary(rawBoundary)
    const points = parseBoundaryVertices(rawBoundary)
    const pointCoordinates = geometry?.type === 'Point' ? geometry.coordinates : undefined
    const boundaryCenter = points.length >= 3 ? polygonCentroid(points) : null
    const next: PlotFormValues = {
      farmId: plot.farmId,
      plotName: plot.plotName,
      area: Number(plot.area) || 0,
      soilType: plot.soilType || '壤土',
      irrigationType: plot.irrigationType || '滴灌',
      // 存量行没有这一列（补列前建的），不猜；表单默认露天只在新建时生效
      plantingType: plot.plantingType ?? 1,
      slope: geometry?.slope ?? '平地',
      // 点型边界 → 用几何里的坐标；否则用后端中心点列；都没有但有多边形时用质心
      longitude: pointCoordinates?.[0] ?? plot.centerLongitude ?? boundaryCenter?.longitude,
      latitude: pointCoordinates?.[1] ?? plot.centerLatitude ?? boundaryCenter?.latitude,
    }
    setFarmId(plot.farmId)
    setBoundaryPoints(points)
    form.setFieldsValue(next)
  }, [plotQuery.data, form])

  /** 农场概况（总面积） */
  const summaryQuery = useQuery({
    queryKey: ['farm-summary', farmId],
    enabled: Boolean(farmId),
    queryFn: () => getFarmSummary(farmId as string),
    retry: false,
  })

  /** 农场下地块（计算已用面积） */
  const plotsQuery = useQuery({
    queryKey: ['plots-all'],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 500 }),
  })

  /** 剩余可用面积 */
  const remain = useMemo(() => {
    const farm =
      (farmQuery.data ?? []).find((item) => item.farmId === farmId) ?? undefined
    const rawSummary = summaryQuery.data as unknown as Record<string, unknown> | undefined
    const summaryArea = Number(rawSummary?.areaTotal)
    const totalArea =
      Number.isFinite(summaryArea) && summaryArea > 0
        ? summaryArea
        : Number(farm?.areaTotal) || 0
    const usedArea = (plotsQuery.data?.list ?? [])
      .filter((plot) => plot.farmId === farmId && plot.plotId !== editingPlotId)
      .reduce((sum, plot) => sum + (Number(plot.area) || 0), 0)
    const editingArea = editingPlotId
      ? Number(
          (plotsQuery.data?.list ?? []).find((plot) => plot.plotId === editingPlotId)?.area,
        ) || 0
      : 0
    const free = Math.max(0, totalArea - usedArea)
    return { totalArea, usedArea: Math.max(0, usedArea), free, editingArea }
  }, [farmQuery.data, summaryQuery.data, plotsQuery.data, farmId, editingPlotId])

  /** 边界测量（顶点数 ≥3 时面积 / 周长才有意义） */
  const boundaryMetrics = useMemo(
    () => computePolygonMetrics(boundaryPoints),
    [boundaryPoints],
  )

  /**
   * 绘制出可用边界且中心点未填时，用多边形质心补中心点。
   *
   * <p>列表地图视图只按 `center_longitude` / `center_latitude` 定位，
   * 没有中心点就算有边界也不显示；这里只在为空时补，不覆盖用户手填的坐标。</p>
   */
  useEffect(() => {
    if (boundaryPoints.length < 3) return
    const longitude = form.getFieldValue('longitude')
    const latitude = form.getFieldValue('latitude')
    if (typeof longitude === 'number' && typeof latitude === 'number') return
    const centroid = polygonCentroid(boundaryPoints)
    if (!centroid) return
    form.setFieldsValue({
      longitude: Number(centroid.longitude.toFixed(6)),
      latitude: Number(centroid.latitude.toFixed(6)),
    })
  }, [boundaryPoints, form])

  /** 边界编辑器初始定位：已选中心点优先，其次农场坐标 */
  const boundaryFocusPoint = useMemo(() => {
    if (typeof watchedLongitude === 'number' && typeof watchedLatitude === 'number') {
      return { longitude: watchedLongitude, latitude: watchedLatitude }
    }
    const farm = (farmQuery.data ?? []).find((item) => item.farmId === farmId)
    if (farm?.longitude !== undefined && farm?.latitude !== undefined) {
      return { longitude: Number(farm.longitude), latitude: Number(farm.latitude) }
    }
    return null
  }, [watchedLongitude, watchedLatitude, farmQuery.data, farmId])

  /**
   * 按地址定位地块位置。
   *
   * <p>地址只用于地图定位（天地图地理编码），不落库；定位成功后写回中心经纬度并让地图居中，
   * 用户随后可直接在同一个地图上绘制边界。</p>
   */
  const handleLocateByAddress = async (): Promise<void> => {
    const keyword = addressKeyword.trim()
    if (!keyword) {
      message.warning('请输入地块所在地址，例如「山东省烟台市栖霞市」')
      return
    }
    setLocating(true)
    try {
      const result = await geocodeAddress(keyword)
      form.setFieldsValue({
        longitude: Number(result.longitude.toFixed(6)),
        latitude: Number(result.latitude.toFixed(6)),
      })
      setLocateSignal((value) => value + 1)
      message.success(
        `已定位到：${result.matchedAddress ?? keyword}${
          result.level ? `（${result.level}）` : ''
        }`,
      )
    } catch (error) {
      message.error(error instanceof Error ? error.message : '地址定位失败，请稍后重试')
    } finally {
      setLocating(false)
    }
  }

  /** 保存 mutation */
  const saveMutation = useMutation({
    mutationFn: async (params: {
      values: PlotFormValues
      action: 'list' | 'crop'
      points: number[][]
    }) => {
      // 字段映射约定（后端 PlotInfoEntity 无经度 / 纬度 / 坡度 / 边界等独立列）：
      // 位置按后端真实字段提交：中心点两列 + 边界一列（GeoJSON）。
      // 坡度没有独立列，作为 GeoJSON 的 slope 扩展属性随 boundary 一起存。
      const center =
        typeof params.values.longitude === 'number' && typeof params.values.latitude === 'number'
          ? {
              longitude: params.values.longitude,
              latitude: params.values.latitude,
            }
          : polygonCentroid(params.points)
      const payload = {
        farmId: params.values.farmId,
        plotName: params.values.plotName,
        area: Number(params.values.area) || 0,
        soilType: params.values.soilType,
        irrigationType: params.values.irrigationType,
        plantingType: params.values.plantingType as 1 | 2 | 3 | 4,
        boundary: buildBoundary(params.values, params.points),
        centerLongitude: center ? Number(center.longitude.toFixed(6)) : undefined,
        centerLatitude: center ? Number(center.latitude.toFixed(6)) : undefined,
        // 这里原先固定发 status: 1，但后端 PlotSaveDTO **根本没有这个字段**（新增的地块统一是
        // active/启用，状态变更是走 PATCH /plots/{id}/status）。留着它会让人以为"表单能设状态"，
        // 更糟的是若哪天后端收下这个字段，编辑一个已停用地块时会被这一行**静默重新启用**。
      }
      if (editingPlotId) {
        await updatePlot(editingPlotId, payload)
        return { plotId: editingPlotId, farmId: params.values.farmId, action: params.action }
      }
      // 后端 POST /plots 返回 ApiResponse<String>（新地块主键），直取即可。
      const plotId = await createPlot(payload)
      return { plotId, farmId: params.values.farmId, action: params.action }
    },
    onSuccess: ({ plotId, farmId, action }) => {
      message.success(editingPlotId ? '地块信息已更新' : '地块创建成功')
      if (action === 'crop') {
        // 「保存并添加作物」跳转种养计划创建弹窗（约定见 PlanList：`?create=1` 自动弹出新增 ModalForm，
        // 并预填 farmId / plotId），避免用户到列表页后再手动重选农场与地块。
        const query = [
          'create=1',
          farmId ? `farmId=${encodeURIComponent(farmId)}` : '',
          plotId ? `plotId=${encodeURIComponent(plotId)}` : '',
        ]
          .filter(Boolean)
          .join('&')
        message.info('已打开种养计划，请为该地块绑定作物')
        navigate(`/production/plans?${query}`)
        return
      }
      if (plotId) {
        navigate(`/production/plots/${plotId}`)
        return
      }
      navigate('/production/plots')
    },
  })

  /** 提交 */
  const handleSubmit = (action: 'list' | 'crop'): void => {
    // 1~2 个顶点构不成边界；直接拦下，避免把半成品静默丢掉或降级成中心点
    if (boundaryPoints.length > 0 && boundaryPoints.length < 3) {
      message.warning('地块边界至少需要 3 个顶点：请继续在地图上绘制，或清空边界后保存')
      return
    }
    setSaveAction(action)
    void form.validateFields().then((values) => {
      saveMutation.mutate({ values, action, points: boundaryPoints })
    })
  }

  return (
    <PageContainer
      title={editingPlotId ? '编辑地块' : '新增地块'}
      onBack={() => navigate('/production/plots')}
      backIcon={<LeftOutlined />}
      extra={[
        <Button key="cancel" onClick={() => navigate('/production/plots')}>
          取消
        </Button>,
        <Button
          key="save"
          loading={saveAction === 'list' && saveMutation.isPending}
          onClick={() => handleSubmit('list')}
        >
          保存
        </Button>,
        <Button
          key="save-crop"
          type="primary"
          disabled={Boolean(editingPlotId)}
          loading={saveAction === 'crop' && saveMutation.isPending}
          onClick={() => handleSubmit('crop')}
        >
          保存并添加作物
        </Button>,
      ]}
    >
      {editingPlotId && plotQuery.isLoading ? (
        <Card loading />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            soilType: '壤土',
            irrigationType: '滴灌',
            plantingType: 1,
            slope: '平地',
            farmId: presetFarmId ?? undefined,
          }}
          disabled={saveMutation.isPending}
        >
          <Card title="地块基本信息" style={{ marginBottom: 16 }}>
            <Form.Item
              name="farmId"
              label="所属农场"
              rules={[{ required: true, message: '请选择所属农场' }]}
            >
              <Select
                placeholder="请选择所属农场"
                style={{ maxWidth: 360 }}
                onChange={(value: string) => setFarmId(value)}
                options={(farmQuery.data ?? []).map((farm) => ({
                  value: farm.farmId,
                  label: farm.farmName,
                }))}
              />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16, maxWidth: 640 }}
              message={`农场总面积: ${remain.totalArea}亩 | 已用: ${remain.usedArea}亩 | 空闲: ${remain.free}亩`}
            />

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="plotName"
                  label="地块名称"
                  rules={[
                    { required: true, message: '请输入地块名称' },
                    { max: 30, message: '地块名称不超过 30 个字符' },
                  ]}
                >
                  <Input placeholder="请输入地块名称" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="area"
                  label="面积（亩）"
                  extra="最多 2 位小数"
                  rules={[
                    { required: true, message: '请输入地块面积' },
                    {
                      validator: (_rule, value: number) => {
                        if (value === undefined || value === null) return Promise.resolve()
                        if (Number(value) <= 0) {
                          return Promise.reject(new Error('面积必须大于 0'))
                        }
                        if (remain.totalArea > 0 && Number(value) > remain.free) {
                          return Promise.reject(
                            new Error(`不能超过空闲面积 ${remain.free} 亩`),
                          )
                        }
                        return Promise.resolve()
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder={`不能超过空闲面积${remain.free}亩`}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="plantingType" label="种植类型">
              <Radio.Group
                options={PLANTING_TYPE_OPTIONS}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>

            <Form.Item name="soilType" label="土壤类型">
              <Radio.Group
                options={SOIL_TYPE_OPTIONS.map((item) => ({ value: item, label: item }))}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>

            <Form.Item name="irrigationType" label="灌溉方式">
              <Radio.Group
                options={IRRIGATION_OPTIONS.map((item) => ({ value: item, label: item }))}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>

            <Form.Item name="slope" label="坡度">
              <Radio.Group
                options={SLOPE_OPTIONS.map((item) => ({ value: item, label: item }))}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>
          </Card>

          <Card title="📍 地块位置与边界（可选）">
            <Space.Compact style={{ width: '100%', maxWidth: 720 }}>
              <Input
                allowClear
                value={addressKeyword}
                onChange={(event) => setAddressKeyword(event.target.value)}
                onPressEnter={() => void handleLocateByAddress()}
                placeholder="输入地块所在地址，如 山东省烟台市栖霞市 XX 镇 XX 村"
                prefix={<EnvironmentOutlined />}
                disabled={saveMutation.isPending}
              />
              <Button
                type="primary"
                loading={locating}
                disabled={saveMutation.isPending}
                onClick={() => void handleLocateByAddress()}
              >
                按地址定位
              </Button>
            </Space.Compact>
            <Typography.Paragraph type="secondary" style={{ margin: '8px 0 12px' }}>
              地址只用于地图定位，不写入地块档案；定位后在下方天地图上点击绘制边界，
              不绘制边界时以定位点作为地块中心点。
            </Typography.Paragraph>

            <TiandituBoundaryEditor
              value={boundaryPoints}
              onChange={setBoundaryPoints}
              height={420}
              focusPoint={boundaryFocusPoint}
              locateSignal={locateSignal}
              disabled={saveMutation.isPending}
            />

            <Row
              align="middle"
              justify="space-between"
              gutter={[12, 8]}
              style={{ marginTop: 12 }}
            >
              <Col>
                <Space size={8} wrap>
                  <Tag
                    color={
                      boundaryPoints.length >= 3
                        ? 'green'
                        : boundaryPoints.length > 0
                          ? 'orange'
                          : 'default'
                    }
                  >
                    {boundaryPoints.length >= 3
                      ? '已绘制边界'
                      : boundaryPoints.length > 0
                        ? '绘制中（顶点不足）'
                        : '未绘制边界'}
                  </Tag>
                  {boundaryPoints.length >= 3 && (
                    <Typography.Text type="secondary">
                      顶点 {boundaryPoints.length} 个 · 面积约{' '}
                      {boundaryMetrics.areaMu.toFixed(2)} 亩
                    </Typography.Text>
                  )}
                </Space>
              </Col>
              {boundaryPoints.length >= 3 && (
                <Col>
                  <Typography.Link
                    onClick={() => {
                      form.setFieldsValue({
                        area: Number(boundaryMetrics.areaMu.toFixed(2)),
                      })
                      message.success('已按绘制边界填入面积，可继续手动调整')
                    }}
                  >
                    使用绘制面积
                  </Typography.Link>
                </Col>
              )}
            </Row>
            <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              在天地图上依次点击顶点绘制边界（至少 3 个），点击已有顶点标记可删除；
              保存后边界按 GeoJSON 写入地块档案，并在列表 / 详情地图上展示。
            </Typography.Paragraph>

            <Row gutter={24} style={{ marginTop: 12 }}>
              <Col xs={24} md={12}>
                <Form.Item name="longitude" label="中心经度">
                  <InputNumber
                    precision={6}
                    style={{ width: '100%' }}
                    placeholder="地址定位后自动填充，也可手动输入"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="latitude" label="中心纬度">
                  <InputNumber
                    precision={6}
                    style={{ width: '100%' }}
                    placeholder="地址定位后自动填充，也可手动输入"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Form>
      )}
    </PageContainer>
  )
}
