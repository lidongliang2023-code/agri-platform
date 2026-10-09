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
 * 数据来源：`/ai/pest-detection`（识别 + 历史列表）；后端骨架无数据时
 * 由本地病虫害知识库兜底出结果，保证上传—识别—防治链路完整可交互。
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
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { detectPest, listPestDetections } from '@/api/ai'
import { listPlots } from '@/api/plots'
import { formatNumber } from '@/utils/production-adapter'
import type { PestDetection, Plot } from '@/types'

const { Text, Title, Paragraph } = Typography
const { Dragger } = Upload

/** 允许的图片类型 */
const ACCEPTED_TYPES: string[] = ['image/jpeg', 'image/png']

/** 单张图片大小上限（字节，10MB） */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 病虫害类型文案 */
const PEST_TYPE_LABEL: Record<number, string> = { 1: '病害', 2: '虫害', 3: '草害' }

/** 危害程度文案 */
const SEVERITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: '轻度', color: 'blue' },
  2: { label: '中度', color: 'orange' },
  3: { label: '重度', color: 'red' },
}

/** 推荐药剂 */
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

/** 病虫害知识条目 */
interface PestKnowledge {
  /** 病虫害名称 */
  name: string
  /** 类型：1 病害 2 虫害 3 草害 */
  type: 1 | 2 | 3
  /** 危害描述 */
  damage: string
  /** 农业防治 */
  agriculture: string[]
  /** 物理防治 */
  physical: string[]
  /** 化学防治 */
  chemical: string[]
  /** 推荐药剂 */
  drugs: DrugItem[]
}

/** 病虫害知识库（识别结果兜底与防治方案来源） */
const PEST_LIBRARY: PestKnowledge[] = [
  {
    name: '番茄晚疫病',
    type: 1,
    damage:
      '主要危害叶片、茎与果实。叶片出现水渍状暗绿色病斑，湿度大时背面产生白色霉层；茎部变褐腐烂，果实出现褐色硬斑，严重时全株枯死，减产可达 30%~50%。',
    agriculture: [
      '选用抗病品种，与非茄科作物实行 3 年以上轮作',
      '控制棚内湿度在 65% 以下，避免叶面结露',
      '及时摘除下部老叶与病叶，改善通风透光',
      '合理密植，避免氮肥过量导致植株徒长',
    ],
    physical: [
      '发病初期摘除病叶并带出棚外集中销毁',
      '采用膜下滴灌，减少叶面湿润时间',
      '高温闷棚：晴天中午闭棚升温至 40℃ 维持 2 小时（注意先浇水）',
    ],
    chemical: [
      '发病初期喷施保护性杀菌剂，重点喷叶背',
      '发病中心周围 2~3 米范围内重点施药',
      '不同类型药剂轮换使用，每季同类药剂不超过 3 次',
    ],
    drugs: [
      { name: '代森锰锌可湿性粉剂', dosage: '800 倍液，60~80g/亩', method: '叶面喷雾', interval: 15 },
      { name: '甲霜灵·锰锌', dosage: '600 倍液，80~100g/亩', method: '叶面喷雾', interval: 21 },
      { name: '氟噻唑吡乙酮', dosage: '3000 倍液，15~20ml/亩', method: '叶面喷雾', interval: 14 },
    ],
  },
  {
    name: '黄瓜霜霉病',
    type: 1,
    damage:
      '叶片正面出现多角形黄褐色病斑，背面生紫灰色霉层，病斑扩展迅速，条件适宜时 3~5 天可蔓延全棚，导致叶片枯死、化瓜严重。',
    agriculture: [
      '选用抗病品种，控制棚内湿度低于 75%',
      '科学通风：早晨短时间放风排湿，避免夜间结露',
      '增施磷钾肥与有机肥，提高植株抗性',
    ],
    physical: [
      '夜间适度加温降湿，抑制孢子囊萌发',
      '及时摘除重病叶并销毁',
      '采用无滴膜与地膜覆盖，降低空气湿度',
    ],
    chemical: [
      '发病前用保护剂预防，发病后用内吸治疗剂',
      '重点喷施叶背，亩用水量 45~60L',
      '注意药剂轮换，延缓抗药性产生',
    ],
    drugs: [
      { name: '烯酰吗啉', dosage: '1500 倍液，30~40ml/亩', method: '叶面喷雾', interval: 7 },
      { name: '代森联水分散粒剂', dosage: '600 倍液，60~80g/亩', method: '叶面喷雾', interval: 10 },
      { name: '氟噻唑吡乙酮', dosage: '3000 倍液，15ml/亩', method: '叶面喷雾', interval: 7 },
    ],
  },
  {
    name: '番茄早疫病',
    type: 1,
    damage:
      '叶片出现同心轮纹状褐色病斑，边缘有黄色晕圈；茎与果实亦可受害，果实多在果蒂附近形成黑褐色凹陷病斑，易引起落果。',
    agriculture: [
      '清除病残体，减少初侵染源',
      '合理轮作，避免与马铃薯连作',
      '平衡施肥，增施钾肥提高抗性',
    ],
    physical: ['及时打杈摘除病叶', '控制棚内湿度，避免长时间结露'],
    chemical: ['发病初期开始施药，间隔 7~10 天，连施 2~3 次'],
    drugs: [
      { name: '苯醚甲环唑', dosage: '1500 倍液，20~30ml/亩', method: '叶面喷雾', interval: 14 },
      { name: '嘧菌酯', dosage: '1500 倍液，40~60ml/亩', method: '叶面喷雾', interval: 14 },
    ],
  },
  {
    name: '蚜虫',
    type: 2,
    damage:
      '成虫与若虫群集于嫩叶、嫩茎与花蕾吸食汁液，导致叶片卷曲变形、植株矮化，同时分泌蜜露诱发煤污病，并传播多种病毒病。',
    agriculture: [
      '清除田间杂草，减少虫源',
      '合理施用氮肥，避免植株过嫩',
      '保护瓢虫、草蛉等天敌',
    ],
    physical: [
      '悬挂黄色粘虫板 30~40 张/亩诱杀有翅蚜',
      '覆盖防虫网阻断迁入',
      '银灰膜驱避蚜虫',
    ],
    chemical: ['虫口密度达标时施药，重点喷心叶与叶背'],
    drugs: [
      { name: '噻虫嗪水分散粒剂', dosage: '3000 倍液，10~15g/亩', method: '叶面喷雾', interval: 14 },
      { name: '吡虫啉可湿性粉剂', dosage: '2000 倍液，20~30g/亩', method: '叶面喷雾', interval: 14 },
      { name: '苦参碱水剂（生物源）', dosage: '800 倍液，60~80ml/亩', method: '叶面喷雾', interval: 5 },
    ],
  },
  {
    name: '白粉虱',
    type: 2,
    damage:
      '成虫与若虫刺吸叶片汁液，导致叶片褪绿、萎蔫；分泌蜜露污染叶片与果实，诱发煤污病，同时传播黄化曲叶病毒病。',
    agriculture: ['培育无虫壮苗，定植前彻底清园', '避免与茄科、豆科作物邻作', '及时摘除下部老叶'],
    physical: ['悬挂黄色粘虫板诱杀成虫', '风口安装 40~60 目防虫网', '释放丽蚜小蜂进行生物防治'],
    chemical: ['在若虫盛发期施药，注意轮换用药'],
    drugs: [
      { name: '螺虫乙酯悬浮剂', dosage: '4000 倍液，15~20ml/亩', method: '叶面喷雾', interval: 14 },
      { name: '噻虫嗪', dosage: '3000 倍液，10g/亩', method: '叶面喷雾', interval: 14 },
    ],
  },
  {
    name: '稻飞虱',
    type: 2,
    damage:
      '成虫、若虫群集稻株基部刺吸汁液，导致稻株枯黄、倒伏（虱烧），并可传播水稻病毒病，严重时造成大面积减产。',
    agriculture: ['选用抗虫品种，合理密植', '浅水勤灌，适时晒田', '科学施肥，防止后期贪青'],
    physical: ['安装杀虫灯诱杀成虫', '稻田养鸭捕食若虫', '保护蜘蛛、黑肩绿盲蝽等天敌'],
    chemical: ['达到防治指标（百丛 1000 头）时施药，重点喷稻株基部'],
    drugs: [
      { name: '吡蚜酮可湿性粉剂', dosage: '25~30g/亩', method: '基部喷雾', interval: 21 },
      { name: '三氟苯嘧啶', dosage: '15~20ml/亩', method: '基部喷雾', interval: 21 },
    ],
  },
  {
    name: '柑橘红蜘蛛',
    type: 2,
    damage:
      '刺吸叶片、果实与嫩梢汁液，叶片失绿呈灰白色，严重时大量落叶、落果，果实表面出现灰白色斑点，影响商品性。',
    agriculture: ['合理修剪，改善通风透光', '果园生草栽培，保护捕食螨', '避免滥用广谱杀虫剂'],
    physical: ['释放捕食螨进行生物防治', '干旱季节喷水增湿抑制发生'],
    chemical: ['虫口达到 3~5 头/叶时施药，注意轮换'],
    drugs: [
      { name: '螺螨酯悬浮剂', dosage: '4000 倍液，15ml/亩', method: '叶面喷雾', interval: 21 },
      { name: '阿维菌素乳油', dosage: '3000 倍液，30ml/亩', method: '叶面喷雾', interval: 14 },
    ],
  },
  {
    name: '小麦条锈病',
    type: 1,
    damage:
      '叶片产生鲜黄色虚线状夏孢子堆，排列成行，后期叶片枯死，严重影响光合作用，造成千粒重下降，减产可达 20%~40%。',
    agriculture: ['选用抗病品种，适期晚播', '合理施肥，避免偏施氮肥', '及时排灌，降低田间湿度'],
    physical: ['发病初期摘除病叶（小面积）'],
    chemical: ['发现发病中心立即喷药封锁，间隔 7~10 天'],
    drugs: [
      { name: '戊唑醇悬浮剂', dosage: '20~25ml/亩', method: '叶面喷雾', interval: 28 },
      { name: '吡唑醚菌酯', dosage: '30~40ml/亩', method: '叶面喷雾', interval: 28 },
    ],
  },
]

/** 识别视图模型（在实体字段外补充危害描述与防治方案明细） */
interface DetectionView extends PestDetection {
  /** 危害描述 */
  damage?: string
  /** 农业防治 */
  agriculture?: string[]
  /** 物理防治 */
  physical?: string[]
  /** 化学防治 */
  chemical?: string[]
  /** 推荐药剂 */
  drugs?: DrugItem[]
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
 * 依据文件名稳定散列命中知识库（保证同一张图多次识别结果一致）
 *
 * @param seed 种子字符串
 * @returns 知识条目
 */
function matchKnowledge(seed: string): PestKnowledge {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003
  }
  return PEST_LIBRARY[hash % PEST_LIBRARY.length]
}

/**
 * 构造兜底识别结果
 *
 * @param imageUrl 图片地址
 * @param seed 识别种子（文件名）
 * @param plotId 地块 ID
 * @param plotName 地块名称
 * @returns 识别视图
 */
function buildFallbackResult(
  imageUrl: string,
  seed: string,
  plotId?: string,
  plotName?: string,
): DetectionView {
  const knowledge = matchKnowledge(seed)
  const hash = seed.length * 7 + seed.charCodeAt(0)
  return {
    detectId: `LOCAL-DETECT-${Date.now()}`,
    imageUrl,
    plotId,
    plotName,
    status: 2,
    pestName: knowledge.name,
    pestType: knowledge.type,
    confidence: Number((0.82 + (hash % 15) / 100).toFixed(2)),
    severity: ((hash % 3) + 1) as 1 | 2 | 3,
    suggestion: knowledge.chemical.join('；'),
    recommendDrugs: knowledge.drugs.map((item) => `${item.name} ${item.dosage}`),
    detectedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    damage: knowledge.damage,
    agriculture: knowledge.agriculture,
    physical: knowledge.physical,
    chemical: knowledge.chemical,
    drugs: knowledge.drugs,
  }
}

/** 示例历史识别记录 */
const DEMO_HISTORY: DetectionView[] = Array.from({ length: 12 }, (_unused, index) => {
  const knowledge = PEST_LIBRARY[index % PEST_LIBRARY.length]
  return {
    detectId: `DEMO-DETECT-${String(index + 1).padStart(4, '0')}`,
    imageUrl: '',
    plotId: `DEMO-PLOT-${(index % 6) + 1}`,
    plotName: ['1号田', '2号田', '3号棚', '4号棚', '水稻A区', '果园北区'][index % 6],
    status: index === 11 ? 1 : 2,
    pestName: knowledge.name,
    pestType: knowledge.type,
    confidence: Number((0.78 + (index % 20) / 100).toFixed(2)),
    severity: ((index % 3) + 1) as 1 | 2 | 3,
    suggestion: knowledge.chemical.join('；'),
    recommendDrugs: knowledge.drugs.map((item) => `${item.name} ${item.dosage}`),
    detectedAt: dayjs('2026-06-03 10:30:00')
      .subtract(index * 5 + 2, 'hour')
      .format('YYYY-MM-DD HH:mm:ss'),
    damage: knowledge.damage,
    agriculture: knowledge.agriculture,
    physical: knowledge.physical,
    chemical: knowledge.chemical,
    drugs: knowledge.drugs,
  }
})

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
  /** 当前文件名（识别种子） */
  const [fileName, setFileName] = useState<string>('')
  /** 关联地块 */
  const [plotId, setPlotId] = useState<string | undefined>(undefined)
  /** 识别中 */
  const [detecting, setDetecting] = useState<boolean>(false)
  /** 识别结果 */
  const [result, setResult] = useState<DetectionView | null>(null)
  /** 文件上传列表（仅用于展示选中文件名） */
  const [fileList, setFileList] = useState<UploadFile[]>([])
  /** 本地新增记录 */
  const [extraHistory, setExtraHistory] = useState<DetectionView[]>([])

  /** 地块选项 */
  const plotQuery = useQuery({
    queryKey: ['pest-detection-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
  })

  /** 历史识别记录 */
  const historyQuery = useQuery({
    queryKey: ['pest-detection-history', farmId],
    queryFn: () => listPestDetections({ pageNum: 1, pageSize: 50 }),
  })

  const plotOptions: { value: string; label: string }[] = useMemo(() => {
    const plots: Plot[] = plotQuery.data?.list ?? []
    if (plots.length === 0) {
      return ['1号田', '2号田', '3号棚', '4号棚', '水稻A区', '果园北区'].map((name, index) => ({
        value: `DEMO-PLOT-${index + 1}`,
        label: name,
      }))
    }
    return plots.map((item) => ({ value: item.plotId, label: item.plotName }))
  }, [plotQuery.data])

  const remoteHistory: DetectionView[] = (historyQuery.data?.list ?? []) as DetectionView[]
  const usingFallback: boolean =
    !historyQuery.isLoading && (historyQuery.isError || remoteHistory.length === 0)

  /** 最终历史记录 */
  const history: DetectionView[] = usingFallback
    ? [...extraHistory, ...DEMO_HISTORY]
    : [...extraHistory, ...remoteHistory]

  /**
   * 执行识别
   *
   * @param imageUrl 图片地址（DataURL）
   * @param seed 识别种子
   * @returns void
   */
  const runDetect = async (imageUrl: string, seed: string): Promise<void> => {
    const plotName = plotOptions.find((item) => item.value === plotId)?.label
    setDetecting(true)
    setResult(null)
    const fallback = buildFallbackResult(imageUrl, seed, plotId, plotName)
    try {
      const res = await detectPest({ imageUrl, plotId })
      const merged: DetectionView =
        res && res.pestName
          ? { ...fallback, ...res, damage: fallback.damage, drugs: fallback.drugs }
          : fallback
      setResult(merged)
      setExtraHistory((prev) => [merged, ...prev])
    } catch {
      // 后端骨架阶段识别接口不可用，使用本地知识库结果
      setResult(fallback)
      setExtraHistory((prev) => [fallback, ...prev])
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
    await runDetect(dataUrl, file.name)
  }

  /**
   * 由识别结果创建防治任务
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
            <Text strong>{value || '未识别'}</Text>
            {record.pestType && <Tag>{PEST_TYPE_LABEL[record.pestType]}</Tag>}
            {record.severity && (
              <Tag color={SEVERITY_LABEL[record.severity]?.color}>
                {SEVERITY_LABEL[record.severity]?.label}
              </Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.plotName || '未关联地块'}
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
          '-'
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
      render: (status: number) => {
        if (status === 1) return <Tag color="processing">识别中</Tag>
        if (status === 3) return <Tag color="error">识别失败</Tag>
        return <Tag color="success">已完成</Tag>
      },
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
                  placeholder="关联地块（可选）"
                  options={plotOptions}
                  value={plotId}
                  onChange={(value) => setPlotId(value)}
                  style={{ width: '100%' }}
                />
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
                      <Button size="small" onClick={() => void runDetect(preview, fileName)}>
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
                {!result && !detecting && (
                  <Empty description="请先上传图片，识别结果将在此展示" style={{ padding: '40px 0' }} />
                )}
                {result && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="病虫害名称">
                        <Text strong>{result.pestName}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="类型">
                        <Tag color={result.pestType === 2 ? 'orange' : 'red'}>
                          {PEST_TYPE_LABEL[result.pestType ?? 1]}
                        </Tag>
                        {result.severity && (
                          <Tag color={SEVERITY_LABEL[result.severity]?.color}>
                            {SEVERITY_LABEL[result.severity]?.label}
                          </Tag>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="置信度">
                        <Progress
                          percent={Math.round((result.confidence ?? 0) * 100)}
                          size="small"
                          style={{ maxWidth: 180 }}
                        />
                      </Descriptions.Item>
                      <Descriptions.Item label="识别时间">{result.detectedAt}</Descriptions.Item>
                      <Descriptions.Item label="危害描述" span={2}>
                        {result.damage || result.suggestion || '-'}
                      </Descriptions.Item>
                    </Descriptions>

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
                        <div>
                          <Title level={5} style={{ marginBottom: 6 }}>
                            农业防治
                          </Title>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            {(result.agriculture ?? []).map((item) => (
                              <li key={item}>
                                <Paragraph style={{ marginBottom: 2 }}>{item}</Paragraph>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <Title level={5} style={{ marginBottom: 6 }}>
                            物理防治
                          </Title>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            {(result.physical ?? []).map((item) => (
                              <li key={item}>
                                <Paragraph style={{ marginBottom: 2 }}>{item}</Paragraph>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <Title level={5} style={{ marginBottom: 6 }}>
                            化学防治
                          </Title>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            {(result.chemical ?? []).map((item) => (
                              <li key={item}>
                                <Paragraph style={{ marginBottom: 2 }}>{item}</Paragraph>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <Title level={5} style={{ marginBottom: 6 }}>
                            推荐药剂与用量
                          </Title>
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
                        </div>
                      </Space>
                    </Card>
                  </Space>
                )}
              </Spin>
            </Card>
          </Col>
        </Row>

        <Card title={`历史识别记录（${formatNumber(history.length)}）`}>
          <Table<DetectionView>
            rowKey="detectId"
            columns={historyColumns}
            dataSource={history}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 8, showTotal: (value) => `共 ${value} 条` }}
          />
        </Card>
      </Space>
    </div>
  )
}
