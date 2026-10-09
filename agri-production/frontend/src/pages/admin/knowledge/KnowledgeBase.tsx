/**
 * 页面名称：农业知识库
 * 路由路径：/admin/production/knowledge
 * 所属模块：SOP与知识库
 * PRD 序号：PRD 6.2 #27
 * 原型页码：P21 ai-knowledge
 *
 * 交互说明（对照原型 P21）：
 * - 顶部统计卡：知识条目总数 15,680 / 已审核 14,200 / 待审核 850 / 已废弃 630；
 * - 左侧「知识分类」树（含条目数），点击分类过滤右侧列表；
 * - 右上「新增知识条目」，按 病虫害图谱 / 农技文章 / 问答语料 三个分类 Tab 切换语料类型；
 * - 列表列：编号 / 标题 / 分类 / 来源 / 审核状态 / 关联模型 / 操作（查看、编辑、审核、删除）；
 * - 支持全文搜索、编辑、删除、发布上下架与审核（通过 / 废弃）。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  listKnowledgeArticles,
  publishKnowledgeArticle,
  updateKnowledgeArticle,
} from '@/api'
import { DemoDataAlert } from '@/components'
import type { KnowledgeArticle, PageResult } from '@/types'

/** 审核状态：approved 已审核 / pending 待审核 / deprecated 已废弃 */
type AuditState = 'approved' | 'pending' | 'deprecated'

/** 语料类型：pest 病虫害图谱 / article 农技文章 / qa 问答语料 */
type EntryType = 'pest' | 'article' | 'qa'

/** 知识条目行模型 */
interface KnowledgeRow extends KnowledgeArticle {
  /** 条目编号 */
  articleNo: string
  /** 二级分类名称 */
  categoryName: string
  /** 来源 */
  source: string
  /** 关联模型 */
  relatedModel?: string
  /** 审核状态 */
  auditState: AuditState
  /** 语料类型 */
  entryType: EntryType
  /** 更新时间 */
  updatedAt: string
}

/** 一级分类（原型 P21 分类树） */
const TOP_CATEGORIES: { key: string; label: string; count: number }[] = [
  { key: '种植技术', label: '种植技术', count: 3200 },
  { key: '养殖技术', label: '养殖技术', count: 2800 },
  { key: '病虫害防治', label: '病虫害防治', count: 4500 },
  { key: '土壤管理', label: '土壤管理', count: 2180 },
  { key: '气象知识', label: '气象知识', count: 1500 },
  { key: '标准规范', label: '标准规范', count: 1500 },
]

/** 二级分类 */
const SUB_CATEGORIES: Record<string, { key: string; label: string; count: number }[]> = {
  种植技术: [
    { key: '水稻种植', label: '水稻种植', count: 850 },
    { key: '小麦种植', label: '小麦种植', count: 620 },
    { key: '果蔬种植', label: '果蔬种植', count: 1730 },
  ],
}

/** 分类选项（下拉用） */
const CATEGORY_OPTIONS: { value: string; label: string }[] = TOP_CATEGORIES.concat(
  Object.values(SUB_CATEGORIES).flat(),
).map((item) => ({ value: item.key, label: item.label }))

/** 基础 KnowledgeArticle.category 映射（1 种植技术 2 病虫害防治 3 政策法规 4 农资知识） */
const CATEGORY_TO_CODE: Record<string, 1 | 2 | 3 | 4> = {
  种植技术: 1,
  水稻种植: 1,
  小麦种植: 1,
  果蔬种植: 1,
  病虫害防治: 2,
  土壤管理: 4,
  气象知识: 4,
  标准规范: 3,
  养殖技术: 1,
}

/** 审核状态文案与颜色 */
const AUDIT_MAP: Record<AuditState, { label: string; color: string }> = {
  approved: { label: '已审核', color: 'success' },
  pending: { label: '待审核', color: 'gold' },
  deprecated: { label: '已废弃', color: 'default' },
}

/** 语料类型文案 */
const ENTRY_TYPE_MAP: Record<EntryType, string> = {
  pest: '病虫害图谱',
  article: '农技文章',
  qa: '问答语料',
}

/** 演示知识条目（原型 P21 列出的 6 条 + 补充） */
const MOCK_ARTICLES: KnowledgeRow[] = [
  {
    articleId: 'K001',
    articleNo: 'K001',
    title: '水稻稻瘟病防治技术规程',
    category: 2,
    categoryName: '病虫害防治',
    summary: '涵盖稻瘟病识别要点、药剂选择与施药时机。',
    content:
      '稻瘟病分为苗瘟、叶瘟、穗瘟。防治要点：① 选用抗病品种；② 合理密植，控制氮肥；③ 破口前 5-7 天与齐穗期各防治一次，选用登记药剂；④ 严格执行安全间隔期。',
    tags: ['水稻', '稻瘟病', '植保'],
    viewCount: 12840,
    status: 1,
    publisherName: '国家农技推广中心',
    publishedAt: '2025-03-12',
    source: '国家农技推广中心',
    relatedModel: '病虫害识别',
    auditState: 'approved',
    entryType: 'pest',
    updatedAt: '2025-06-18 10:20',
  },
  {
    articleId: 'K002',
    articleNo: 'K002',
    title: '小麦赤霉病早期识别要点',
    category: 2,
    categoryName: '病虫害防治',
    summary: '基于图像识别的赤霉病早期症状判定标准。',
    content:
      '赤霉病在扬花期侵染，早期表现为穗部小穗褪色水渍状。识别要点：① 关注扬花期降雨；② 观察穗部褐变与粉红色霉层；③ 结合田间湿度 > 80% 判读；④ 及时喷施并回收病残体。',
    tags: ['小麦', '赤霉病'],
    viewCount: 9620,
    status: 1,
    publisherName: '农科院',
    publishedAt: '2025-04-02',
    source: '农科院',
    relatedModel: '病虫害识别',
    auditState: 'approved',
    entryType: 'pest',
    updatedAt: '2025-05-22 09:15',
  },
  {
    articleId: 'K003',
    articleNo: 'K003',
    title: '有机苹果种植技术标准',
    category: 1,
    categoryName: '果蔬种植',
    summary: '有机果园土壤管理、修剪与病虫害综合防治规范。',
    content:
      '有机苹果种植要求：① 不用化学合成农药与肥料；② 行间生草 + 果园覆草提升有机质；③ 采用性诱剂、天敌与矿物源农药；④ 建立完整投入品台账并接受年度检查认证。',
    tags: ['苹果', '有机种植'],
    viewCount: 4310,
    status: 0,
    publisherName: '省农科院',
    source: '省农科院',
    relatedModel: '产量预测',
    auditState: 'pending',
    entryType: 'article',
    updatedAt: '2025-07-08 15:40',
  },
  {
    articleId: 'K004',
    articleNo: 'K004',
    title: '土壤重金属检测规范',
    category: 4,
    categoryName: '土壤管理',
    summary: '土壤铅镉汞砷采样布点与限值判定要求。',
    content:
      '按 NY/T 标准要求布点：① 每 20 亩不少于 1 个混合样；② 取样深度 0-20cm；③ 每季度一次趋势监测；④ 超标地块须停用并转入修复流程。',
    tags: ['土壤', '重金属'],
    viewCount: 7620,
    status: 1,
    publisherName: '环保部',
    publishedAt: '2025-02-18',
    source: '环保部',
    relatedModel: '土壤分析',
    auditState: 'approved',
    entryType: 'article',
    updatedAt: '2025-04-26 11:05',
  },
  {
    articleId: 'K005',
    articleNo: 'K005',
    title: '2025年玉米种植密度建议',
    category: 1,
    categoryName: '种植技术',
    summary: '按积温带给出玉米适宜密度与收获方式建议。',
    content:
      '东北春玉米区：耐密品种 4500-5000 株/亩；黄淮海夏玉米区：4200-4800 株/亩；西南丘陵区：3600-4000 株/亩。密植需配套抗倒伏品种与化控措施。',
    tags: ['玉米', '密植'],
    viewCount: 5840,
    status: 0,
    publisherName: '农技站',
    source: '农技站',
    relatedModel: '产量预测',
    auditState: 'pending',
    entryType: 'article',
    updatedAt: '2025-07-11 08:30',
  },
  {
    articleId: 'K006',
    articleNo: 'K006',
    title: '旧版水稻施肥指南',
    category: 1,
    categoryName: '种植技术',
    summary: '2019 版施肥建议，已被新版替代。',
    content: '该条目为 2019 版水稻施肥指南，施肥量与现行标准不一致，已标记为废弃，仅供历史查阅。',
    tags: ['水稻', '历史数据'],
    viewCount: 620,
    status: 0,
    publisherName: '历史数据',
    source: '历史数据',
    auditState: 'deprecated',
    entryType: 'article',
    updatedAt: '2023-11-02 16:20',
  },
  {
    articleId: 'K007',
    articleNo: 'K007',
    title: '水稻二化螟图谱与防治问答',
    category: 2,
    categoryName: '病虫害防治',
    summary: 'AI 问答高频问题：二化螟如何识别和防治？',
    content:
      '问：水稻出现枯心苗是二化螟吗？答：枯心苗多由二化螟幼虫蛀入心叶造成，剥查可见幼虫及虫粪；可在卵孵盛期选用苏云金杆菌或氯虫苯甲酰胺类登记药剂防治，注意轮换用药。',
    tags: ['水稻', '二化螟', '问答'],
    viewCount: 3120,
    status: 1,
    publisherName: '农技问答运营组',
    publishedAt: '2025-05-09',
    source: '运营沉淀',
    relatedModel: 'AI问答助手',
    auditState: 'approved',
    entryType: 'qa',
    updatedAt: '2025-06-30 14:10',
  },
  {
    articleId: 'K008',
    articleNo: 'K008',
    title: '设施番茄常见生理障碍问答集',
    category: 2,
    categoryName: '病虫害防治',
    summary: '番茄脐腐病、裂果等生理性问题的问答语料。',
    content:
      '问：番茄脐腐病怎么防？答：属缺钙生理病害，关键是保持水分均衡供应、避免土壤忽干忽湿，可在幼果期补充螯合钙；同时控制氮肥过量施用。',
    tags: ['番茄', '问答'],
    viewCount: 2480,
    status: 0,
    publisherName: '运营沉淀',
    source: '运营沉淀',
    relatedModel: 'AI问答助手',
    auditState: 'pending',
    entryType: 'qa',
    updatedAt: '2025-07-13 09:50',
  },
]

/** 本地演示数据源 */
let mockArticleStore: KnowledgeRow[] = [...MOCK_ARTICLES]

/** 平台级示例口径（原型 P21 统计卡，硬编码示例数字，非服务端统计值） */
const PLATFORM_STATS = {
  total: 15680,
  approved: 14200,
  pending: 850,
  deprecated: 630,
}

/** 示例数据覆盖范围（提示条文案，覆盖统计卡 / 分类树 / 列表） */
const DEMO_SCOPE = '顶部「知识条目总数 / 已审核 / 待审核 / 已废弃」统计卡、左侧分类树条目数、下方知识条目列表'

/** 示例数据写操作提示 */
const DEMO_WRITE_NOTE =
  '新增 / 编辑 / 审核通过 / 标记废弃 / 删除等操作只会修改浏览器本地内存中的示例数据，未写入服务端，刷新页面后即失效。'

/** 新增/编辑表单值 */
interface EntryFormValues {
  title: string
  categoryName: string
  source: string
  relatedModel?: string
  entryType: EntryType
  summary?: string
  content: string
}

/**
 * 农业知识库页面
 * @returns 页面内容
 */
export default function KnowledgeBase(): JSX.Element {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<EntryFormValues>()
  const [keyword, setKeyword] = useState<string>('')
  const [inputKeyword, setInputKeyword] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [entryTab, setEntryTab] = useState<EntryType>('pest')
  const [rows, setRows] = useState<KnowledgeRow[]>([])
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [detailRow, setDetailRow] = useState<KnowledgeRow | undefined>(undefined)
  /** 是否处于示例数据（演示）模式：由数据层返回的 demo 标志驱动 */
  const [demoMode, setDemoMode] = useState<boolean>(false)

  const listQuery = useQuery({
    queryKey: ['admin-knowledge-articles', keyword, entryTab],
    queryFn: async (): Promise<{ rows: KnowledgeRow[]; demo: boolean }> => {
      try {
        const page: PageResult<KnowledgeArticle> = await listKnowledgeArticles({
          pageNum: 1,
          pageSize: 200,
          title: keyword,
          category: entryTab === 'pest' ? 2 : 1,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          return {
            rows: page.list.map<KnowledgeRow>((item) => ({
              ...item,
              articleNo: item.articleId,
              categoryName: item.category === 2 ? '病虫害防治' : '种植技术',
              source: item.publisherName ?? '平台运营',
              auditState: item.status === 1 ? 'approved' : 'pending',
              entryType: entryTab,
              updatedAt: item.publishedAt ?? '—',
            })),
            demo: false,
          }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      return { rows: mockArticleStore, demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
      setDemoMode(listQuery.data.demo)
    }
  }, [listQuery.data])

  /** 当前展示行（叠加搜索 / 分类 / Tab 过滤） */
  const displayRows = useMemo(
    () =>
      rows.filter((row) => {
        if (keyword && !row.title.includes(keyword) && !row.content.includes(keyword)) {
          return false
        }
        if (categoryFilter && row.categoryName !== categoryFilter) {
          return false
        }
        if (entryTab && row.entryType !== entryTab) {
          return false
        }
        return true
      }),
    [rows, keyword, categoryFilter, entryTab],
  )

  /** 保存知识条目 */
  const saveMutation = useMutation({
    mutationFn: async (values: EntryFormValues) => {
      const payload: Partial<KnowledgeArticle> = {
        title: values.title,
        category: CATEGORY_TO_CODE[values.categoryName] ?? 1,
        summary: values.summary,
        content: values.content,
        tags: [values.categoryName],
        publisherName: values.source,
        status: 0,
      }
      try {
        if (editingId) {
          await updateKnowledgeArticle(editingId, payload)
        } else {
          await createKnowledgeArticle(payload)
        }
        message.success('知识条目已保存')
      } catch {
        message.warning('知识条目已保存到本地示例数据（演示模式，未写入服务端，刷新后失效）')
      }
      const nextId = editingId ?? `K${String(mockArticleStore.length + 1).padStart(3, '0')}`
      const nextRow: KnowledgeRow = {
        articleId: nextId,
        articleNo: nextId,
        title: values.title,
        category: CATEGORY_TO_CODE[values.categoryName] ?? 1,
        categoryName: values.categoryName,
        summary: values.summary,
        content: values.content,
        tags: [values.categoryName],
        viewCount: 0,
        status: 0,
        publisherName: values.source,
        source: values.source,
        relatedModel: values.relatedModel,
        auditState: 'pending',
        entryType: values.entryType,
        updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      mockArticleStore = editingId
        ? mockArticleStore.map((item) => (item.articleId === editingId ? nextRow : item))
        : [nextRow, ...mockArticleStore]
      return nextRow
    },
    onSuccess: () => {
      setDrawerOpen(false)
      setEditingId(undefined)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
  })

  /** 删除条目 */
  const removeMutation = useMutation({
    mutationFn: async (row: KnowledgeRow) => {
      try {
        await deleteKnowledgeArticle(row.articleId)
        message.success('条目已删除')
      } catch {
        message.warning('条目已从本地示例数据移除（演示模式，未写入服务端，刷新后失效）')
      }
      mockArticleStore = mockArticleStore.filter((item) => item.articleId !== row.articleId)
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
      return row.articleId
    },
  })

  /**
   * 审核条目：通过 -> 已审核并发布；废弃 -> 已废弃并下架
   * @param row 目标条目
   * @param result approved / deprecated
   */
  const auditMutation = useMutation({
    mutationFn: async (payload: { row: KnowledgeRow; result: 'approved' | 'deprecated' }) => {
      const nextAudit = payload.result
      try {
        await publishKnowledgeArticle(payload.row.articleId, nextAudit === 'approved' ? 1 : 0)
        message.success(nextAudit === 'approved' ? '条目已审核通过并发布' : '条目已标记为废弃')
      } catch {
        message.warning(
          `${nextAudit === 'approved' ? '条目已审核通过' : '条目已标记为废弃'}（演示模式，仅本地更新，未写入服务端）`,
        )
      }
      mockArticleStore = mockArticleStore.map((item) =>
        item.articleId === payload.row.articleId
          ? {
              ...item,
              auditState: nextAudit,
              status: nextAudit === 'approved' ? 1 : 0,
              updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            }
          : item,
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
      return nextAudit
    },
  })

  /**
   * 打开新增 / 编辑抽屉
   * @param row 目标条目，为空表示新增
   */
  const openDrawer = (row?: KnowledgeRow): void => {
    setEditingId(row?.articleId)
    form.setFieldsValue(
      row
        ? {
            title: row.title,
            categoryName: row.categoryName,
            source: row.source,
            relatedModel: row.relatedModel,
            entryType: row.entryType,
            summary: row.summary,
            content: row.content,
          }
        : { entryType: entryTab, categoryName: '病虫害防治' },
    )
    setDrawerOpen(true)
  }

  /** 分类树数据 */
  const treeData = useMemo(
    () =>
      TOP_CATEGORIES.map((category) => ({
        key: category.key,
        title: (
          <Space size={4}>
            <span>{category.label}</span>
            <Typography.Text type="secondary">{category.count.toLocaleString()}</Typography.Text>
          </Space>
        ),
        children: (SUB_CATEGORIES[category.key] ?? []).map((sub) => ({
          key: sub.key,
          title: (
            <Space size={4}>
              <span>{sub.label}</span>
              <Typography.Text type="secondary">{sub.count.toLocaleString()}</Typography.Text>
            </Space>
          ),
        })),
      })),
    [],
  )

  const columns = useMemo(
    () => [
      { title: '编号', dataIndex: 'articleNo', width: 90 },
      {
        title: '标题',
        dataIndex: 'title',
        width: 240,
        render: (text: string, row: KnowledgeRow) => (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailRow(row)}>
            {text}
          </Button>
        ),
      },
      {
        title: '分类',
        dataIndex: 'categoryName',
        width: 120,
        render: (text: string) => <Tag color="blue">{text}</Tag>,
      },
      { title: '来源', dataIndex: 'source', width: 150 },
      {
        title: '审核状态',
        dataIndex: 'auditState',
        width: 100,
        render: (state: AuditState) => (
          <Tag color={AUDIT_MAP[state].color}>{AUDIT_MAP[state].label}</Tag>
        ),
      },
      {
        title: '关联模型',
        dataIndex: 'relatedModel',
        width: 120,
        render: (text?: string) => text ?? '—',
      },
      {
        title: '查看数',
        dataIndex: 'viewCount',
        width: 100,
        render: (v: number) => v.toLocaleString(),
      },
      {
        title: '操作',
        key: 'action',
        width: 230,
        fixed: 'right' as const,
        render: (_: unknown, row: KnowledgeRow) => (
          <Space size={0}>
            <Button type="link" size="small" onClick={() => setDetailRow(row)}>
              查看
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openDrawer(row)}>
              编辑
            </Button>
            {row.auditState === 'pending' ? (
              <>
                <Button
                  type="link"
                  size="small"
                  onClick={() => auditMutation.mutate({ row, result: 'approved' })}
                >
                  审核通过
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => auditMutation.mutate({ row, result: 'deprecated' })}
                >
                  废弃
                </Button>
              </>
            ) : null}
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: `确认删除条目「${row.title}」？`,
                  okText: '确认删除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () => removeMutation.mutateAsync(row),
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [auditMutation, modal, removeMutation],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {demoMode ? <DemoDataAlert scope={DEMO_SCOPE} writeNote={DEMO_WRITE_NOTE} /> : null}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  知识条目总数
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={PLATFORM_STATS.total}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  已审核
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={PLATFORM_STATS.approved}
              valueStyle={{ color: '#13a05a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  待审核
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={PLATFORM_STATS.pending}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  已废弃
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={PLATFORM_STATS.deprecated}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <Card
            title={
              <Space size={6}>
                📂 知识分类
                {demoMode ? <Tag color="orange">示例</Tag> : null}
              </Space>
            }
            styles={{ body: { padding: 12 } }}
          >
            <Tree
              treeData={treeData}
              defaultExpandAll
              selectedKeys={categoryFilter ? [categoryFilter] : []}
              onSelect={(keys) => setCategoryFilter(keys.length > 0 ? String(keys[0]) : undefined)}
            />
            {categoryFilter ? (
              <Button
                type="link"
                size="small"
                style={{ paddingLeft: 0, marginTop: 8 }}
                onClick={() => setCategoryFilter(undefined)}
              >
                清除分类筛选
              </Button>
            ) : null}
          </Card>
        </Col>
        <Col span={18}>
          <Card
            title={
              <Tabs
                activeKey={entryTab}
                onChange={(key) => setEntryTab(key as EntryType)}
                items={[
                  { key: 'pest', label: '病虫害图谱' },
                  { key: 'article', label: '农技文章' },
                  { key: 'qa', label: '问答语料' },
                ]}
              />
            }
            extra={
              <Space>
                <Input.Search
                  allowClear
                  placeholder="搜索关键词"
                  style={{ width: 220 }}
                  value={inputKeyword}
                  onChange={(event) => setInputKeyword(event.target.value)}
                  onSearch={(value) => setKeyword(value)}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
                  }
                >
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
                  新增知识条目
                </Button>
              </Space>
            }
          >
            <Table<KnowledgeRow>
              rowKey="articleId"
              columns={columns}
              dataSource={displayRows}
              loading={listQuery.isLoading}
              pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              scroll={{ x: 1300 }}
              locale={{
                emptyText: <Empty description={`暂无${ENTRY_TYPE_MAP[entryTab]}条目`} />,
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 查看抽屉 */}
      <Drawer
        title={detailRow ? `知识条目 - ${detailRow.title}` : '知识条目'}
        width={680}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(undefined)}
        extra={
          detailRow?.auditState === 'pending' ? (
            <Space>
              <Button
                type="primary"
                onClick={() => {
                  const row = detailRow
                  setDetailRow(undefined)
                  auditMutation.mutate({ row, result: 'approved' })
                }}
              >
                审核通过
              </Button>
              <Button
                danger
                onClick={() => {
                  const row = detailRow
                  setDetailRow(undefined)
                  auditMutation.mutate({ row, result: 'deprecated' })
                }}
              >
                标记废弃
              </Button>
            </Space>
          ) : null
        }
      >
        {detailRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="编号">{detailRow.articleNo}</Descriptions.Item>
              <Descriptions.Item label="语料类型">{ENTRY_TYPE_MAP[detailRow.entryType]}</Descriptions.Item>
              <Descriptions.Item label="分类">{detailRow.categoryName}</Descriptions.Item>
              <Descriptions.Item label="来源">{detailRow.source}</Descriptions.Item>
              <Descriptions.Item label="关联模型">{detailRow.relatedModel ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="查看数">{detailRow.viewCount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="审核状态">
                <Tag color={AUDIT_MAP[detailRow.auditState].color}>
                  {AUDIT_MAP[detailRow.auditState].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">{detailRow.updatedAt}</Descriptions.Item>
              <Descriptions.Item label="摘要" span={2}>
                {detailRow.summary ?? '—'}
              </Descriptions.Item>
            </Descriptions>
            <Card title="正文内容" size="small">
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {detailRow.content}
              </Typography.Paragraph>
            </Card>
            {detailRow.tags && detailRow.tags.length > 0 ? (
              <Space>
                {detailRow.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            ) : null}
          </Space>
        ) : null}
      </Drawer>

      {/* 新增 / 编辑抽屉 */}
      <Drawer
        title={editingId ? '编辑知识条目' : '新增知识条目'}
        width={680}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form<EntryFormValues> form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：水稻稻瘟病防治技术规程" maxLength={80} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="categoryName"
                label="分类"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="entryType" label="语料类型" rules={[{ required: true, message: '请选择语料类型' }]}>
                <Select
                  options={[
                    { value: 'pest', label: '病虫害图谱' },
                    { value: 'article', label: '农技文章' },
                    { value: 'qa', label: '问答语料' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="relatedModel" label="关联模型">
                <Select
                  allowClear
                  options={[
                    { value: '病虫害识别', label: '病虫害识别' },
                    { value: '产量预测', label: '产量预测' },
                    { value: '土壤分析', label: '土壤分析' },
                    { value: 'AI问答助手', label: 'AI问答助手' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="source" label="来源" rules={[{ required: true, message: '请输入来源' }]}>
            <Input placeholder="如：国家农技推广中心" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="content" label="正文内容" rules={[{ required: true, message: '请输入正文内容' }]}>
            <Input.TextArea rows={8} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  )
}
