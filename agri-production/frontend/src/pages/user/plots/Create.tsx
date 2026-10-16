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
 * - 「地块边界（可选）」：`📐 绘制多边形边界` + 当前面积提示
 * - 底部按钮：`取消`、`保存`、`保存并添加作物`
 *
 * 实现说明：
 * - 后端 PlotInfoEntity 无经度 / 纬度 / 坡度字段，统一序列化到 geoBoundary：
 *   点为 `{"type":"Point","coordinates":[lng,lat],"slope":"平地"}`，
 *   边界为 `{"type":"Polygon","coordinates":[[[lng,lat],...]]}`
 * - 支持 `?plotId=` 编辑态与 `?farmId=` 预选农场
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { BorderOuterOutlined, EnvironmentOutlined, LeftOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
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
import { listCropOptions } from '@/api/crops'
import { CROP_EMOJI_MAP } from '@/types'

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
  coordinates: Coordinate[][]
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
  /**
   * 当前作物：作物主数据主键（页面作物下拉的 value）。

   *
   * <p>作物是主数据（`/production/crops` 维护），地块这里选一个 —— 提交后落 `crop_id` +
   * `current_crop`（名称，页面直接显示）。此前地块压根没有"当前作物"的录入入口，
   * 库里的值只来自演示数据迁移。</p>
   */
  cropId?: string
  /** 经度 */
  longitude?: number
  /** 纬度 */
  latitude?: number
  /** 多边形边界文本（每行 `经度,纬度`） */
  polygonText?: string
}

/**
 * 安全解析 GeoJSON 字符串。
 *
 * @param raw 原始 geoBoundary 字符串
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
 * 解析多边形文本为坐标数组。
 *
 * @param text 每行形如 `116.5623,40.1234`
 * @returns 坐标数组
 */
function parsePolygonText(text: string | undefined): Coordinate[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lng, lat] = line.split(/[,，\s]+/).map((item) => Number(item))
      return [lng, lat] as Coordinate
    })
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
}

/**
 * 构建 geoBoundary 字符串。
 *
 * @param values 表单值
 * @returns JSON 字符串；无任何位置信息时返回 undefined
 */
function buildBoundary(values: PlotFormValues): string | undefined {
  const points = parsePolygonText(values.polygonText)
  if (points.length >= 3) {
    const geometry: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [[...points, points[0]]],
      slope: values.slope,
    }
    return JSON.stringify(geometry)
  }
  if (values.longitude !== undefined && values.latitude !== undefined) {
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
  const [farmId, setFarmId] = useState<string | undefined>(presetFarmId ?? undefined)
  const [polygonOpen, setPolygonOpen] = useState<boolean>(false)
  const [polygonText, setPolygonText] = useState<string>('')
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

  /** 板块加载后回填表单 */
  useEffect(() => {
    const plot = plotQuery.data
    if (!plot) return
    const geometry = parseBoundary(plot.geoBoundary)
    const points = geometry?.type === 'Polygon' ? geometry.coordinates[0] : undefined
    const next: PlotFormValues = {
      farmId: plot.farmId,
      plotName: plot.plotName,
      area: Number(plot.area) || 0,
      soilType: plot.soilType || '壤土',
      irrigationType: plot.irrigationType || '滴灌',
      plantingType: plot.plantingType ?? 1,
      slope: geometry?.slope ?? '平地',
      // 作物下拉的 value 是主数据主键；历史行只有名字（crop_id 为空）时先留空
      cropId: plot.cropId || undefined,
      longitude: geometry?.type === 'Point' ? geometry.coordinates[0] : undefined,
      latitude: geometry?.type === 'Point' ? geometry.coordinates[1] : undefined,
      polygonText: points
        ? points
            .slice(0, points.length - 1)
            .map((point) => `${point[0]},${point[1]}`)
            .join('\n')
        : '',
    }
    setFarmId(plot.farmId)
    setPolygonText(next.polygonText ?? '')
    form.setFieldsValue(next)
  }, [plotQuery.data, form])

  /** 农场概况（总面积） */
  const summaryQuery = useQuery({
    queryKey: ['farm-summary', farmId],
    enabled: Boolean(farmId),
    queryFn: () => getFarmSummary(farmId as string),
    retry: false,
  })

  /**
   * 作物主数据下拉（「当前作物」）。

   * <p>只给启用中的作物；拉不到就是空列表 —— 页面上会提示"没有可选作物"，
   * 不塞假选项（与计划 / 负责人下拉同口径）。没有想要的作物去 `/production/crops` 新增。</p>
   */
  const cropQuery = useQuery({
    queryKey: ['crop-options'],
    queryFn: () => listCropOptions(),
  })
  const cropOptions = useMemo(
    () =>
      (cropQuery.data ?? []).map((item) => ({
        value: item.cropId,
        label: CROP_EMOJI_MAP[item.cropName] ? `${CROP_EMOJI_MAP[item.cropName]} ${item.cropName}` : item.cropName,
      })),
    [cropQuery.data],
  )

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

  /** 保存 mutation */
  const saveMutation = useMutation({
    mutationFn: async (params: {
      values: PlotFormValues
      action: 'list' | 'crop'
      polygonText: string
    }) => {
      // 字段映射约定（后端 PlotInfoEntity 无经度 / 纬度 / 坡度 / 边界等独立列）：
      // 坡度、经度、纬度、多边形边界统一序列化写入 geoBoundary —— Point/Polygon GeoJSON + slope 扩展属性。
      // 后端未来补这些列时需同步迁移此处与编辑回填逻辑（parseBoundary / buildBoundary）。
      const payload = {
        farmId: params.values.farmId,
        plotName: params.values.plotName,
        area: Number(params.values.area) || 0,
        soilType: params.values.soilType,
        irrigationType: params.values.irrigationType,
        plantingType: params.values.plantingType as 1 | 2 | 3 | 4,
        // 当前作物走作物主数据（主键）；后端据此落 crop_id + current_crop（名称）
        cropId: params.values.cropId,
        geoBoundary: buildBoundary({ ...params.values, polygonText: params.polygonText }),
        status: 1 as 0 | 1 | 2 | 3 | 4,
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
    setSaveAction(action)
    void form.validateFields().then((values) => {
      saveMutation.mutate({ values, action, polygonText })
    })
  }

  /** 多边形顶点数量 */
  const polygonPoints = useMemo(() => parsePolygonText(polygonText), [polygonText])

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

            <Form.Item
              name="cropId"
              label="当前作物"
              extra="取自作物主数据（由平台运营维护）；缺作物请联系平台运营添加（品种请在下方单独填）"
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={cropOptions.length > 0 ? '选择该地块当前种的作物（可不填）' : '作物主数据里还没有作物'}
                options={cropOptions}
                style={{ maxWidth: 360 }}
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

          <Card title="地块位置" style={{ marginBottom: 16 }}>
            <div
              style={{
                height: 220,
                marginBottom: 16,
                borderRadius: 8,
                border: '1px dashed #91caff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'repeating-linear-gradient(45deg, #f0f7ff, #f0f7ff 14px, #e6f4ff 14px, #e6f4ff 28px)',
              }}
            >
              <Space direction="vertical" align="center">
                <EnvironmentOutlined style={{ fontSize: 26, color: '#1677ff' }} />
                <Typography.Text strong>🗺️ 高德地图选点区域</Typography.Text>
                <Typography.Text type="secondary">
                  地图控件接入后将支持直接点击选点
                </Typography.Text>
              </Space>
            </div>
            <Typography.Text type="secondary">点击地图选点 | 搜索位置 | 输入经纬度</Typography.Text>
            <Row gutter={24} style={{ marginTop: 12 }}>
              <Col xs={24} md={12}>
                <Form.Item name="longitude" label="经度">
                  <InputNumber
                    precision={6}
                    style={{ width: '100%' }}
                    placeholder="例如 116.5623"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="latitude" label="纬度">
                  <InputNumber
                    precision={6}
                    style={{ width: '100%' }}
                    placeholder="例如 40.1234"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="地块边界（可选）">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space size={8} wrap>
                <Typography.Text>如需精确绘制地块边界，点击</Typography.Text>
                <Button icon={<BorderOuterOutlined />} onClick={() => setPolygonOpen(true)}>
                  📐 绘制多边形边界
                </Button>
              </Space>
              <div
                style={{
                  minHeight: 120,
                  borderRadius: 8,
                  border: '1px dashed #d9d9d9',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Space direction="vertical" align="center">
                  <Typography.Text type="secondary">地块边界绘制区域</Typography.Text>
                  <Tag color={polygonPoints.length >= 3 ? 'green' : 'default'}>
                    当前面积: {polygonPoints.length >= 3 ? '已绘制边界' : '-（未绘制）'}
                  </Tag>
                  {polygonPoints.length >= 3 && (
                    <Typography.Text type="secondary">
                      顶点数：{polygonPoints.length}
                    </Typography.Text>
                  )}
                </Space>
              </div>
            </Space>
          </Card>
        </Form>
      )}

      <Modal
        title="绘制多边形边界"
        open={polygonOpen}
        okText="确定"
        cancelText="取消"
        onCancel={() => setPolygonOpen(false)}
        onOk={() => {
          if (polygonPoints.length >= 3) {
            message.success(`已保存 ${polygonPoints.length} 个边界顶点`)
          } else if (polygonPoints.length > 0) {
            message.warning('至少需要 3 个顶点才能构成地块边界')
          }
          setPolygonOpen(false)
        }}
        width={560}
      >
        <Typography.Paragraph type="secondary">
          每行输入一个顶点坐标，格式：<Typography.Text code>经度,纬度</Typography.Text>
          ，至少 3 个顶点自动闭合为多边形。
        </Typography.Paragraph>
        <Input.TextArea
          rows={8}
          value={polygonText}
          onChange={(event) => setPolygonText(event.target.value)}
          placeholder={'116.5623,40.1234\n116.5721,40.1256\n116.5688,40.1189'}
        />
      </Modal>
    </PageContainer>
  )
}
