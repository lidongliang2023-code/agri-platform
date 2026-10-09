/**
 * 页面名称：病虫害识别
 * 路由路径：/production/ai/pest-detection
 * 所属模块：智能决策中心
 * PRD 序号：PRD 6.1 #40
 *
 * 还原要点（PRD 6.1 #40「图片上传、识别结果、防治方案」）：
 * - 图片上传：拖拽 / 点击上传，限制 JPG / PNG，单张 ≤ 10MB，本地预览
 * - 识别中：展示识别进度与耗时提示
 * - 识别结果：病虫害名称、类型（病害 / 虫害 / 草害）、置信度、危害程度、危害描述
 * - 防治方案：农业防治 / 物理防治 / 化学防治 + 推荐药剂与用量（含安全间隔期）
 * - 历史识别记录：缩略图、名称、置信度、地块、识别时间、查看 / 生成任务
 *
 * 数据来源：`POST /ai/pest-detection`（识别）、`GET /ai`（历史诊断记录列表）。
 *
 * ⚠️ 数据来源纪律（用药安全，不可回退）：
 * 1. 危害描述（damage）、农业 / 物理 / 化学防治、推荐用药（drugs）在后端
 *    `prod_ai_diagnosis` 中**没有对应字段**。此前页面用本地知识库按「文件名散列」
 *    命中后强行覆盖服务端返回值，导致「病虫害名来自服务端、用药建议来自本地编造」，
 *    且两者互不匹配（如服务端判定稻飞虱、本地散列出番茄晚疫病用药）。
 *    现一律**只取服务端字段**，缺失即显示「服务端未提供」，禁止任何本地填充。
 * 2. 识别接口失败 / 未返回病虫害名称时，**不得**静默生成本地结果并提示识别完成；
 *    改为显式报错，不生成任何结果卡片。
 * 3. 地块下拉在 `/plots` 返回空时显示空态 + 「暂无地块，请先建档」，不编造地块。
 * 4. 历史记录改为读取真实端点 `GET /ai`，无数据即为空态，不再回落 12 条硬编码记录。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd'
import {
  BugOutlined,
  InboxOutlined,
  MedicineBoxOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import useFarmStore from '@/store/farm'
import { detectPest, listAiDiagnoses } from '@/api/ai'
import { listPlots } from '@/api/plots'
import { formatNumber } from '@/utils/production-adapter'
import type { AiDiagnosisRecord, DetectStatus, PestDetection, Plot } from '@/types'

const { Text, Title, Paragraph } = Typography
const { Dragger } = Upload

/** 允许的图片类型 */
const ACCEPTED_TYPES: string[] = ['image/jpeg', 'image/png']

/** 单张图片大小上限（字节，10MB） */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 服务端未提供该字段时的统一占位文案 */
const NOT_PROVIDED = '服务端未提供'

/** 病虫害类型文案 */
const PEST_TYPE_LABEL: Record<number, string> = { 1: '病害', 2: '虫害', 3: '草害' }

/** 危害程度文案 */
const SEVERITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: '轻度', color: 'blue' },
  2: { label: '中度', color: 'orange' },
  3: { label: '重度', color: 'red' },
}

/** 推荐药剂（仅当服务端返回该结构时使用） */
interface DrugItem {
  /** 药剂名称 */
  name: string
  /** 用量 */
  dosage: string
  /** 施用方法 */
  method: string
  /** 安全间隔期（天） */
  interval: number
}

/**
 * 识别视图模型
 *
 * 在实体字段外补充危害描述与防治方案明细。**这些补充字段的取值来源只能是服务端响应**，
 * 后端未提供时一律保持 `undefined`，页面渲染为「服务端未提供」。
 */
interface DetectionView extends Omit<PestDetection, 'status'> {
  /** 诊断状态：兼容后端字符串（PENDING / SUCCESS / FAILED）与历史数字枚举 */
  status?: DetectStatus | string
  /** 危害描述（后端无此字段，恒为 undefined，除非服务端后续提供） */
  damage?: string
  /** 农业防治 */
  agriculture?: string[]
  /** 物理防治 */
  physical?: string[]
  /** 化学防治 */
  chemical?: string[]
  /** 推荐药剂 */
  drugs?: DrugItem[]
  /** 诊断类型（后端 diagnosisType） */
  diagnosisType?: string
  /** 模型名称（后端 modelName） */
  modelName?: string
}

/**
 * 将文件读取为 DataURL
 *
 * @param file 图片文件
 * @returns DataURL 字符串
 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 归一化置信度
 *
 * 后端 `prod_ai_diagnosis.confidence` 列定义为 `DECIMAL(5,2) COMMENT '置信度(%)'`，
 * 即单位为百分比（92.50 表示 92.5%）；前端视图模型统一按 0~1 比率存储。
 * 该函数**只做单位换算**，不推测、不插值、不兜底。
 *
 * @param value 服务端原始置信度
 * @returns 0~1 区间的置信度；无法解析时返回 undefined
 */
function normalizeConfidence(value?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  if (value > 1) return Number((value / 100).toFixed(4))
  return value
}

/**
 * 将服务端 AI 诊断记录映射为页面视图模型
 *
 * 仅做字段搬运与单位换算；危害描述 / 防治方案 / 推荐用药在后端无对应字段，
 * 故此处**不写入任何值**，由页面统一显示「服务端未提供」。
 *
 * @param record 服务端诊断记录
 * @param plotNameById plotId → 地块名称映射（由 `/plots` 关联，关联不到时不填）
 * @returns 识别视图
 */
function toDetectionView(
  record: AiDiagnosisRecord,
  plotNameById: Record<string, string>,
): DetectionView {
  return {
    detectId: record.diagnosisId,
    imageUrl: record.imageUrl ?? '',
    plotId: record.plotId,
    plotName: record.plotId ? plotNameById[record.plotId] : undefined,
    status: record.status,
    pestName: record.resultLabel,
    pestType: undefined,
    confidence: normalizeConfidence(record.confidence),
    severity: undefined,
    suggestion: record.suggestion,
    recommendDrugs: undefined,
    detectedAt: record.diagnosedAt ?? '',
    diagnosisType: record.diagnosisType,
    modelName: record.modelName,
  }
}

/**
 * 渲染识别状态标签
 *
 * 后端 status 为字符串（PENDING / SUCCESS / FAILED），历史上前端用数字枚举，此处兼容两者。
 *
 * @param status 状态值
 * @returns 状态标签
 */
function renderStatus(status?: DetectStatus | string): JSX.Element {
  const text = String(status ?? '')
  if (text === '1' || text === 'PENDING') return <Tag color="processing">识别中</Tag>
  if (text === '3' || text === 'FAILED') return <Tag color="error">识别失败</Tag>
  if (text === '2' || text === 'SUCCESS') return <Tag color="success">已完成</Tag>
  return <Tag>未知</Tag>
}

/**
 * 病虫害识别
 *
 * 业务职责：图片上传 → AI 识别 → 结果展示 → 防治方案 → 历史记录回溯。
 *
 * @returns 页面内容
 */
export default function PestDetection(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  /** 预览图 */
  const [preview, setPreview] = useState<string>('')
  /** 当前文件名 */
  const [fileName, setFileName] = useState<string>('')
  /** 关联地块 */
  const [plotId, setPlotId] = useState<string | undefined>(undefined)
  /** 识别中 */
  const [detecting, setDetecting] = useState<boolean>(false)
  /** 识别结果（仅可能来自服务端） */
  const [result, setResult] = useState<DetectionView | null>(null)
  /** 识别失败原因（接口失败 / 服务端未返回识别结果） */
  const [detectError, setDetectError] = useState<string>('')
  /** 文件上传列表（仅用于展示选中文件名） */
  const [fileList, setFileList] = useState<UploadFile[]>([])
  /** 本次会话内由服务端返回的新增记录 */
  const [extraHistory, setExtraHistory] = useState<DetectionView[]>([])

  /** 地块选项 */
  const plotQuery = useQuery({
    queryKey: ['pest-detection-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
  })

  /** 历史识别记录（真实端点 `GET /ai`） */
  const historyQuery = useQuery({
    queryKey: ['pest-detection-history', farmId],
    queryFn: () => listAiDiagnoses({ pageNum: 1, pageSize: 50 }),
  })

  /**
   * 地块选项
   *
   * `/plots` 返回空时返回空数组（空态），**不编造任何地块**。
   */
  const plotOptions: { value: string; label: string }[] = useMemo(() => {
    const plots: Plot[] = plotQuery.data?.list ?? []
    return plots.map((item) => ({ value: item.plotId, label: item.plotName }))
  }, [plotQuery.data])

  /** plotId → 地块名称 */
  const plotNameById: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {}
    plotOptions.forEach((item) => {
      map[item.value] = item.label
    })
    return map
  }, [plotOptions])

  /** 地块列表已加载完成且为空 */
  const plotsEmpty: boolean = !plotQuery.isLoading && plotOptions.length === 0

  /** 服务端历史记录：仅取 PEST（病虫害）类型 */
  const remoteHistory: DetectionView[] = useMemo(() => {
    const records: AiDiagnosisRecord[] = historyQuery.data?.list ?? []
    return records
      .filter((item) => item.diagnosisType === 'PEST')
      .map((item) => toDetectionView(item, plotNameById))
  }, [historyQuery.data, plotNameById])

  /** 最终历史记录：服务端列表 + 本次会话内服务端返回的新增记录 */
  const history: DetectionView[] = useMemo(
    () => [...extraHistory, ...remoteHistory],
    [extraHistory, remoteHistory],
  )

  /** 是否存在服务端返回的防治方案明细 */
  const hasControlPlan: boolean = Boolean(
    result &&
      (result.damage ||
        (result.agriculture?.length ?? 0) > 0 ||
        (result.physical?.length ?? 0) > 0 ||
        (result.chemical?.length ?? 0) > 0 ||
        (result.drugs?.length ?? 0) > 0),
  )

  /**
   * 执行识别
   *
   * 只接受服务端返回值：
   * - 服务端返回了病虫害名称 → 原样采用，**不覆盖 / 不合并任何本地数据**；
   * - 服务端未返回病虫害名称或接口失败 → 显式报错，不生成结果、不提示识别成功。
   *
   * @param imageUrl 图片地址（DataURL）
   * @returns void
   */
  const runDetect = async (imageUrl: string): Promise<void> => {
    const plotName = plotOptions.find((item) => item.value === plotId)?.label
    setDetecting(true)
    setResult(null)
    setDetectError('')
    try {
      const res = (await detectPest({ imageUrl, plotId })) as DetectionView
      if (!res || !res.pestName) {
        // 服务端未接入模型推理能力（骨架阶段 diagnose 仅落库，不回填 resultLabel）
        setDetectError(
          '识别接口已响应，但未返回病虫害名称（服务端模型推理能力未接入）。' +
            '为避免给出错误的用药结论，此处不生成任何识别结果，请稍后重试或联系农技员人工诊断。',
        )
        message.warning('服务端未返回识别结果，未生成防治方案')
        return
      }
      // ✅ 关键点：危害描述 / 防治方案 / 推荐用药**只取服务端字段**
      // （此处不再出现 `damage: fallback.damage, drugs: fallback.drugs` 之类的本地覆盖）
      const view: DetectionView = {
        ...res,
        plotName: res.plotName ?? plotName,
        confidence: normalizeConfidence(res.confidence),
        pestType: res.pestType,
        severity: res.severity,
      }
      setResult(view)
      setExtraHistory((prev) => [view, ...prev])
      message.success('识别完成（结果来自服务端）')
    } catch (error) {
      setDetectError(`识别失败：${(error as Error)?.message || '接口不可用'}。未生成任何识别结果。`)
      message.error('识别失败，请稍后重试')
    } finally {
      setDetecting(false)
      void queryClient.invalidateQueries({ queryKey: ['pest-detection-history'] })
    }
  }

  /**
   * 处理选中的图片
   *
   * @param file 图片文件
   * @returns void
   */
  const handleFile = async (file: File): Promise<void> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      message.error('仅支持 JPG / PNG 格式的图片')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error('图片大小不能超过 10MB')
      return
    }
    const dataUrl = await readAsDataUrl(file)
    setFileList([
      {
        uid: `upload-${Date.now()}`,
        name: file.name,
        status: 'done',
        url: dataUrl,
      },
    ])
    setPreview(dataUrl)
    setFileName(file.name)
    await runDetect(dataUrl)
  }

  /**
   * 由识别结果创建防治任务
   *
   * 用药 / 物料只在服务端提供了推荐用药或处置建议时携带，缺失时留空（不填充本地值）。
   *
   * @param item 识别结果
   * @returns void
   */
  const gotoTaskCreate = (item: DetectionView): void => {
    const drug = item.drugs?.[0]
    const query = new URLSearchParams({
      taskName: `${item.pestName ?? '病虫害'}防治`,
      plotName: item.plotName ?? '',
      material: drug ? `${drug.name} ${drug.dosage}` : (item.recommendDrugs?.[0] ?? ''),
      priority: item.severity === 3 ? '紧急' : item.severity === 2 ? '重要' : '普通',
      source: 'ai-pest-detection',
    }).toString()
    navigate(`/production/tasks/create?${query}`)
  }

  /** 历史记录列定义 */
  const historyColumns: ColumnsType<DetectionView> = [
    {
      title: '图片',
      dataIndex: 'imageUrl',
      width: 90,
      render: (value: string) =>
        value ? (
          <img src={value} alt="识别图片" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div
            style={{
              width: 56,
              height: 42,
              borderRadius: 4,
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bfbfbf',
            }}
          >
            <BugOutlined />
          </div>
        ),
    },
    {
      title: '识别结果',
      dataIndex: 'pestName',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Text strong>{value || NOT_PROVIDED}</Text>
            {record.pestType && <Tag>{PEST_TYPE_LABEL[record.pestType]}</Tag>}
            {record.severity && (
              <Tag color={SEVERITY_LABEL[record.severity]?.color}>
                {SEVERITY_LABEL[record.severity]?.label}
              </Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.plotName || '未关联地块'}
            {record.modelName ? ` · ${record.modelName}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 160,
      render: (value?: number) =>
        value === undefined ? (
          <Text type="secondary">{NOT_PROVIDED}</Text>
        ) : (
          <Progress
            percent={Math.round(value * 100)}
            size="small"
            status={value >= 0.9 ? 'success' : 'active'}
          />
        ),
    },
    {
      title: '识别时间',
      dataIndex: 'detectedAt',
      width: 170,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: DetectStatus | string) => renderStatus(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_value: unknown, record) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setResult(record)}>
            查看方案
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => gotoTaskCreate(record)}
          >
            建任务
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space size={8}>
            <BugOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>病虫害识别</span>
            <Text type="secondary">上传作物叶片 / 果实照片，AI 自动识别并给出防治方案</Text>
          </Space>
        </Card>

        <Row gutter={16}>
          <Col span={10}>
            <Card title="图片上传">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Select
                  allowClear
                  placeholder={plotsEmpty ? '暂无地块，请先建档' : '关联地块（可选）'}
                  options={plotOptions}
                  value={plotId}
                  onChange={(value) => setPlotId(value)}
                  style={{ width: '100%' }}
                  notFoundContent={plotQuery.isLoading ? '加载中…' : '暂无地块'}
                />
                {plotsEmpty && (
                  <Alert
                    type="warning"
                    showIcon
                    message="暂无地块，请先建档"
                    description="服务端 /plots 未返回任何地块数据。请先在「农场档案 · 地块管理」完成地块建档后再使用病虫害识别；此处不会用示例地块代替。"
                  />
                )}
                <Dragger
                  accept={ACCEPTED_TYPES.join(',')}
                  maxCount={1}
                  fileList={fileList}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void handleFile(file as unknown as File)
                    return false
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽图片到此处上传</p>
                  <p className="ant-upload-hint">支持 JPG / PNG，单张不超过 10MB</p>
                </Dragger>
                {preview && (
                  <div>
                    <img
                      src={preview}
                      alt="预览"
                      style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6 }}
                    />
                    <Space style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {fileName}
                      </Text>
                      <Button size="small" onClick={() => void runDetect(preview)}>
                        重新识别
                      </Button>
                    </Space>
                  </div>
                )}
                <Alert
                  type="info"
                  showIcon
                  message="识别建议"
                  description="拍摄时请尽量保证叶片病斑清晰、光线均匀，避免反光与过度裁剪，可显著提升置信度。"
                />
              </Space>
            </Card>
          </Col>

          <Col span={14}>
            <Card
              title="识别结果"
              extra={
                result && (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => gotoTaskCreate(result)}
                  >
                    生成防治任务
                  </Button>
                )
              }
            >
              <Spin spinning={detecting} tip="AI 正在识别病虫害特征…">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {detectError && (
                    <Alert
                      type="error"
                      showIcon
                      message="识别未完成，未生成任何结果"
                      description={detectError}
                    />
                  )}
                  {!result && !detecting && !detectError && (
                    <Empty description="请先上传图片，识别结果将在此展示" style={{ padding: '40px 0' }} />
                  )}
                  {!result && !detecting && detectError && (
                    <Empty
                      description="无识别结果（服务端未返回有效数据）"
                      style={{ padding: '24px 0' }}
                    />
                  )}

                  {result && (
                    <>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="病虫害名称">
                          <Text strong>{result.pestName}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="类型">
                          {result.pestType ? (
                            <Tag color={result.pestType === 2 ? 'orange' : 'red'}>
                              {PEST_TYPE_LABEL[result.pestType]}
                            </Tag>
                          ) : (
                            <Text type="secondary">{NOT_PROVIDED}</Text>
                          )}
                          {result.severity && (
                            <Tag color={SEVERITY_LABEL[result.severity]?.color}>
                              {SEVERITY_LABEL[result.severity]?.label}
                            </Tag>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="置信度">
                          {result.confidence === undefined ? (
                            <Text type="secondary">{NOT_PROVIDED}</Text>
                          ) : (
                            <Progress
                              percent={Math.round(result.confidence * 100)}
                              size="small"
                              style={{ maxWidth: 180 }}
                            />
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="识别时间">
                          {result.detectedAt || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="危害描述" span={2}>
                          {result.damage || (
                            <Text type="secondary">{NOT_PROVIDED}（后端 AI 诊断记录无该字段）</Text>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="处置建议（服务端）" span={2}>
                          {result.suggestion || (
                            <Text type="secondary">{NOT_PROVIDED}（后端 suggestion 字段为空）</Text>
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="模型" span={2}>
                          {result.modelName || <Text type="secondary">{NOT_PROVIDED}</Text>}
                        </Descriptions.Item>
                      </Descriptions>

                      {!hasControlPlan ? (
                        <Alert
                          type="warning"
                          showIcon
                          message="防治方案与推荐用药：服务端未提供"
                          description={
                            <Space direction="vertical" size={4}>
                              <span>
                                后端 AI 诊断接口未返回危害描述、农业 / 物理 / 化学防治措施与推荐用药字段。
                                为避免出现「病虫害名是真的、用药建议是编的」这一错误结论，
                                此处不使用任何本地知识库或示例数据填充。
                              </span>
                              <Text strong>
                                请携带本条识别结果咨询当地农技员 / 植保站后再施药，切勿自行配药。
                              </Text>
                            </Space>
                          }
                        />
                      ) : (
                        <Card
                          size="small"
                          title={
                            <Space>
                              <MedicineBoxOutlined />
                              <span>防治方案</span>
                            </Space>
                          }
                        >
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {result.damage && (
                              <div>
                                <Title level={5} style={{ marginBottom: 6 }}>
                                  危害描述
                                </Title>
                                <Paragraph style={{ marginBottom: 0 }}>{result.damage}</Paragraph>
                              </div>
                            )}
                            <div>
                              <Title level={5} style={{ marginBottom: 6 }}>
                                农业防治
                              </Title>
                              {(result.agriculture ?? []).length === 0 ? (
                                <Text type="secondary">{NOT_PROVIDED}</Text>
                              ) : (
                                <ul style={{ paddingLeft: 20, margin: 0 }}>
                                  {(result.agriculture ?? []).map((item) => (
                                    <li key={item}>
                                      <Paragraph style={{ marginBottom: 2 }}>{item}</Paragraph>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <Title level={5} style={{ marginBottom: 6 }}>
                                物理防治
                              </Title>
                              {(result.physical ?? []).length === 0 ? (
                                <Text type="secondary">{NOT_PROVIDED}</Text>
                              ) : (
                                <ul style={{ paddingLeft: 20, margin: 0 }}>
                                  {(result.physical ?? []).map((item) => (
                                    <li key={item}>
                                      <Paragraph style={{ marginBottom: 2 }}>{item}</Paragraph>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <Title level={5} style={{ marginBottom: 6 }}>
                                化学防治
                              </Title>
                              {(result.chemical ?? []).length === 0 ? (
                                <Text type="secondary">{NOT_PROVIDED}</Text>
                              ) : (
                                <ul style={{ paddingLeft: 20, margin: 0 }}>
                                  {(result.chemical ?? []).map((item) => (
                                    <li key={item}>
                                      <Paragraph style={{ marginBottom: 2 }}>{item}</Paragraph>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <Title level={5} style={{ marginBottom: 6 }}>
                                推荐药剂与用量
                              </Title>
                              {(result.drugs ?? []).length === 0 ? (
                                <Text type="secondary">{NOT_PROVIDED}</Text>
                              ) : (
                                <>
                                  <Alert
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 8 }}
                                    message="用药安全提示"
                                    description="以下用药信息来自服务端返回结果。实际施药前请核对作物与安全间隔期，并遵医嘱或咨询当地农技员 / 植保站。"
                                  />
                                  <Table<DrugItem>
                                    rowKey="name"
                                    size="small"
                                    pagination={false}
                                    dataSource={result.drugs ?? []}
                                    columns={[
                                      { title: '药剂名称', dataIndex: 'name' },
                                      { title: '用量', dataIndex: 'dosage' },
                                      { title: '施用方法', dataIndex: 'method', width: 100 },
                                      {
                                        title: '安全间隔期',
                                        dataIndex: 'interval',
                                        width: 110,
                                        render: (value: number) => `${value} 天`,
                                      },
                                    ]}
                                  />
                                </>
                              )}
                            </div>
                          </Space>
                        </Card>
                      )}
                    </>
                  )}
                </Space>
              </Spin>
            </Card>
          </Col>
        </Row>

        <Card title={`历史识别记录（${formatNumber(history.length)}）`}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {historyQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="历史识别记录加载失败"
                description="服务端 GET /ai 接口不可用，历史记录无法展示。此处不使用示例数据占位。"
              />
            )}
            {!historyQuery.isError && !historyQuery.isLoading && remoteHistory.length === 0 && (
              <Alert
                type="info"
                showIcon
                message="暂无病虫害识别记录"
                description="服务端 GET /ai 未返回 diagnosisType=PEST 的诊断记录。完成一次识别后记录将出现在此处。"
              />
            )}
            <Table<DetectionView>
              rowKey="detectId"
              columns={historyColumns}
              dataSource={history}
              scroll={{ x: 1000 }}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      historyQuery.isLoading ? '加载中…' : '暂无病虫害识别记录（服务端无数据）'
                    }
                  />
                ),
              }}
              pagination={{ pageSize: 8, showTotal: (value) => `共 ${value} 条` }}
            />
          </Space>
        </Card>
      </Space>
    </div>
  )
}
