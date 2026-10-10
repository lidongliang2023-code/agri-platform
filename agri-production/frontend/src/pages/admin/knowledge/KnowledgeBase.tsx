/**
 * 页面名称：农业知识库
 * 路由路径：/admin/production/knowledge
 * 所属模块：SOP与知识库
 * PRD 序号：PRD 6.2 #27
 * 原型页码：P21 ai-knowledge
 *
 * 交互说明（对照原型 P21）：
 * - 顶部统计卡：知识条目总数 / 已发布 / 草稿 / 已废弃；
 * - 左侧「知识分类」树（含条目数），点击分类过滤右侧列表；
 * - 右上「新增知识条目」，按 病虫害图谱 / 农技文章 / 问答语料 三个分类 Tab 切换语料类型；
 * - 列表列：编号 / 标题 / 分类 / 来源 / 审核状态 / 关联模型 / 操作（查看、编辑、审核、删除）；
 * - 支持全文搜索、编辑、删除、发布上下架与审核（通过 / 废弃）。
 *
 * ⚠️ 契约口径（2026-10 实测 `GET /api/v1/production/admin/knowledge`）：
 * 后端直接吐 `KnowledgeArticleEntity`，真实字段是
 * `articleId / categoryCode(PLANT|PEST|POLICY) / title / summary / contentUrl /
 *  author / source / readCount / publishAt / status` + 审计列 `createdAt / updatedAt`。
 *
 * 此前前端声明的 `viewCount`（浏览量）后端根本没有——后端叫 `readCount`。
 * 于是列表「查看数」列 `render: (v: number) => v.toLocaleString()` 拿到 undefined 直接抛
 * TypeError，React error boundary 接管后整页白屏；详情抽屉同一字段再崩一次。
 *
 * 处置（两类问题分开治，不能混为一谈）：
 * 1. **只是字段名对不上、值是真的** → 按后端真字段名消费（`readCount` / `source` /
 *    `publishAt` / `categoryCode` / `contentUrl`），这是对齐而不是兜底；
 * 2. **后端确实没有这个字段** → 显式降级为「—」+ 提示图标，不兜 0、不留空白：
 *    - `content`（正文）：后端只有正文链接 `contentUrl`，没有正文内容；
 *    - `entryType`（语料类型）：后端无该字段，三个语料 Tab 不参与过滤；
 *    - `relatedModel`（关联模型）：后端无该字段；
 *    - `deprecated`（已废弃）：后端 status 只有 1 已发布 / 0 草稿，无废弃态，统计卡显示「—」。
 *
 * 同时撤掉了本地示例文章与硬编码的 15680 / 14200 / 850 / 630 统计卡：
 * 那组数字与后端真实条目数（实测 3 条）毫无关系，属于「把没有数据渲染成有结论」。
 *
 * ⚠️ 写入口径（BT-57，实测 `prod_knowledge_article` 列）：
 * 后端只有 `article_id / category_code / title / summary / content_url /
 * author / source / read_count / publish_at / status`。
 * 此前 payload 里的 `category`（数字编码）、`content`（正文）、`tags` 三列**都不存在**，
 * 而 Spring Boot 默认 `FAIL_ON_UNKNOWN_PROPERTIES=false`，未知字段直接忽略、不报错，
 * 于是「接口 200 + 前端提示已保存」，用户选的分类其实没落库、刷新后分类列只剩「—」。
 * 现在：payload 只写真列 + 保存后 GET 详情回读逐字段比对，对不上就如实列出。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  getKnowledgeArticle,
  listKnowledgeArticles,
  publishKnowledgeArticle,
  updateKnowledgeArticle,
} from '@/api'
import { MISSING_VALUE_TEXT, MetricNumber, MetricStatistic } from '@/components'
import { toFiniteNumber } from '@/utils/metric-format'
import { hasNonEmptyTextFields } from '@/utils/shape-guard'
import type { KnowledgeArticle, PageResult } from '@/types'

/** 审核状态：approved 已发布 / pending 草稿 / deprecated 已废弃（后端无废弃态） */
type AuditState = 'approved' | 'pending' | 'deprecated'

/** 语料类型：pest 病虫害图谱 / article 农技文章 / qa 问答语料（后端无该字段） */
type EntryType = 'pest' | 'article' | 'qa'

/**
 * 知识条目行模型。
 *
 * 继承 `Partial<KnowledgeArticle>`：后端字段可能缺失（`content` 就没有），
 * 若按必填建模，TS 会担保 `row.content.includes(...)` 一定安全，
 * 而实际会抛 TypeError——搜索框一输入就崩。
 */
interface KnowledgeRow extends Partial<KnowledgeArticle> {
  /** 条目编号 */
  articleNo: string
  /** 一级分类名称（由后端 categoryCode 映射；未知编码直接显示编码本身，不臆断中文名） */
  categoryName: string
  /** 来源 */
  source: string
  /** 关联模型：后端无该字段 */
  relatedModel?: string
  /** 审核状态 */
  auditState: AuditState
  /** 语料类型：后端无该字段，恒为 undefined，展示「—」 */
  entryType?: EntryType
  /** 更新时间 */
  updatedAt: string
}

/**
 * 后端 `categoryCode` → 中文分类名。
 *
 * 只收录实测出现过的编码；未知编码直接回落到编码原文，
 * 不做「看起来像」的猜测映射（猜错等于给条目贴错标签）。
 */
const CATEGORY_CODE_TO_NAME: Record<string, string> = {
  PLANT: '种植技术',
  PEST: '病虫害防治',
  POLICY: '政策法规',
}

/**
 * 分类名 → 后端真实 `categoryCode`。
 *
 * 实测 `prod_knowledge_article` **只有 `category_code` 字符串列**，
 * 真实取值就是种子里的 PLANT / PEST / POLICY 三种。
 *
 * 此前前端写的是 `category: 1|2|3|4`——后端根本没有 `category` 这一列，
 * Jackson 默认忽略未知属性（`FAIL_ON_UNKNOWN_PROPERTIES` 未开启），
 * 于是形成「用户选了分类 → 接口返回 200 → 前端提示已保存 → 分类其实没落库」，
 * 刷新之后列表的分类列只剩「—」（BT-57）。
 *
 * 因此下拉只提供**后端真能存进去**的三个分类：
 * 给一个存不进去的选项，等于让用户以为自己选成功了。
 */
const CATEGORY_NAME_TO_CODE: Record<string, string> = {
  种植技术: 'PLANT',
  病虫害防治: 'PEST',
  政策法规: 'POLICY',
}

/** 分类选项（下拉用）：由上面这张真编码表派生，不额外提供无编码的分类 */
const CATEGORY_OPTIONS: { value: string; label: string }[] = Object.keys(CATEGORY_NAME_TO_CODE).map(
  (name) => ({ value: name, label: name }),
)

/** 审核状态文案与颜色 */
const AUDIT_MAP: Record<AuditState, { label: string; color: string }> = {
  approved: { label: '已发布', color: 'success' },
  pending: { label: '草稿', color: 'gold' },
  deprecated: { label: '已废弃', color: 'default' },
}

/** 语料类型文案 */
const ENTRY_TYPE_MAP: Record<EntryType, string> = {
  pest: '病虫害图谱',
  article: '农技文章',
  qa: '问答语料',
}

/** 语料类型缺失提示语 */
const ENTRY_TYPE_MISSING_TIP = '未接入：后端知识库无「语料类型」字段，显示为「—」，不做臆断归类'

/** 查看数缺失提示语 */
const VIEW_COUNT_MISSING_TIP = '未接入：后端知识库未返回阅读数（readCount），显示为「—」而非 0'

/** 已废弃统计缺失提示语 */
const DEPRECATED_MISSING_TIP =
  '未接入：后端知识库 status 只有 1 已发布 / 0 草稿，无「废弃」状态，显示为「—」而非 0'

/** 语料类型未接入的页面说明 */
const ENTRY_TYPE_NOTE =
  '后端知识库没有「病虫害图谱 / 农技文章 / 问答语料」字段，' +
  '上方三个语料 Tab 当前不参与过滤（不做臆断归类），列表展示全部条目。'

/** 新增/编辑表单值 */
interface EntryFormValues {
  title: string
  categoryName: string
  source: string
  relatedModel?: string
  entryType: EntryType
  summary?: string
  /** 正文链接（后端真字段 `contentUrl`；后端没有正文内容列） */
  contentUrl?: string
}

/**
 * 保存后回读发现的「没生效」字段清单项。
 *
 * @property label 字段中文名（给用户看）
 * @property sent  前端提交的值
 * @property got   服务端回读到的值
 */
interface FieldDrift {
  label: string
  sent: string
  got: string
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
  /** 正在编辑的原始行：保存时用它保留 status 等不该被覆盖的字段 */
  const [editingRow, setEditingRow] = useState<KnowledgeRow | undefined>(undefined)
  const [detailRow, setDetailRow] = useState<KnowledgeRow | undefined>(undefined)

  const listQuery = useQuery({
    queryKey: ['admin-knowledge-articles', keyword],
    queryFn: async (): Promise<KnowledgeRow[]> => {
      const page: PageResult<KnowledgeArticle> = await listKnowledgeArticles({
        pageNum: 1,
        pageSize: 200,
        keyword,
      })
      const list = page?.list
      if (!Array.isArray(list) || list.length === 0) {
        return []
      }
      return list
        .filter((item) => hasNonEmptyTextFields(item, ['articleId', 'title']))
        .map<KnowledgeRow>((item) => ({
          ...item,
          articleNo: item.articleId ?? MISSING_VALUE_TEXT,
          categoryName:
            CATEGORY_CODE_TO_NAME[item.categoryCode ?? ''] ?? item.categoryCode ?? MISSING_VALUE_TEXT,
          source: item.source ?? item.author ?? MISSING_VALUE_TEXT,
          // 后端真字段是 readCount；这里统一到页面使用的 viewCount 名，
          // 拿不到就留 undefined 由渲染层显示「—」，不兜 0。
          viewCount: toFiniteNumber(item.readCount) ?? undefined,
          auditState: item.status === 1 ? 'approved' : 'pending',
          // 后端无语料类型字段，不做臆断归类
          entryType: undefined,
          updatedAt: item.publishAt ?? item.updatedAt ?? MISSING_VALUE_TEXT,
        }))
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data)
    }
  }, [listQuery.data])

  /** 当前展示行（叠加搜索 / 分类过滤） */
  const displayRows = useMemo(
    () =>
      rows.filter((row) => {
        if (keyword) {
          // content 后端不返回，必须 ?? '' 兜住，否则搜索框一输入就 undefined.includes 抛错
          const haystack = `${row.title ?? ''} ${row.summary ?? ''} ${row.content ?? ''}`
          if (!haystack.includes(keyword)) {
            return false
          }
        }
        if (categoryFilter && row.categoryName !== categoryFilter) {
          return false
        }
        return true
      }),
    [rows, keyword, categoryFilter],
  )

  /** 统计汇总：全部来自后端真实条目，已废弃因后端无该状态恒为 null（显示「—」） */
  const stats = useMemo(
    () => ({
      total: rows.length,
      approved: rows.filter((row) => row.status === 1).length,
      pending: rows.filter((row) => row.status !== 1).length,
      deprecated: null,
    }),
    [rows],
  )

  /**
   * 保存知识条目。
   *
   * 两条硬约束（BT-57）：
   * 1. **payload 只写 `prod_knowledge_article` 真实存在的列**
   *    （articleId / categoryCode / title / summary / contentUrl / author /
   *     source / readCount / publishAt / status）。
   *    `category` / `content` / `tags` 三列后端都没有，写了也不会报错——
   *    Spring Boot 默认 `FAIL_ON_UNKNOWN_PROPERTIES=false`，直接静默忽略，
   *    于是「提示已保存」而用户选的分类、填的正文其实没入库。
   * 2. **保存后回读**（GET /admin/knowledge/{id}）逐字段比对，
   *    有对不上的就如实列出来，不再无条件弹「已保存」。
   */
  const saveMutation = useMutation({
    mutationFn: async (values: EntryFormValues): Promise<FieldDrift[]> => {
      const categoryCode = CATEGORY_NAME_TO_CODE[values.categoryName]
      if (!categoryCode) {
        // 下拉已经只给有编码的分类，这里是防御：真走到了就如实报错，绝不悄悄存成别的
        throw new Error(`分类「${values.categoryName}」在后端没有对应编码，未保存`)
      }
      const payload: Partial<KnowledgeArticle> = {
        title: values.title,
        categoryCode,
        summary: values.summary,
        // 后端只有「正文链接」列，没有正文列；正文内容不写入（写了也存不下）
        contentUrl: values.contentUrl,
        source: values.source,
        /*
         * 编辑时沿用条目当前状态：此前无条件写 status: 0，
         * 会把一条已发布条目悄悄改回草稿（updateById 对非 null 字段照写）。
         */
        status: editingRow?.status ?? 0,
      }

      const targetId = editingId ?? (await createKnowledgeArticle(payload))
      if (!targetId) {
        throw new Error('后端未返回条目 ID，无法确认是否落库')
      }
      if (editingId) {
        await updateKnowledgeArticle(editingId, payload)
      }

      // 回读校验：以服务端真实状态为准，不拿「请求发出去了」当成功
      const saved = await getKnowledgeArticle(targetId)
      const drifts: FieldDrift[] = []
      const compare = (label: string, sent?: string | null, got?: string | null): void => {
        const a = sent ?? ''
        const b = got ?? ''
        if (a !== b) {
          drifts.push({ label, sent: a, got: b })
        }
      }
      compare('标题', payload.title, saved?.title)
      compare('分类', payload.categoryCode, saved?.categoryCode)
      compare('摘要', payload.summary, saved?.summary)
      compare('正文链接', payload.contentUrl, saved?.contentUrl)
      compare('来源', payload.source, saved?.source)
      return drifts
    },
    onSuccess: (drifts: FieldDrift[]) => {
      if (drifts.length > 0) {
        const detail = drifts
          .map((item) => `${item.label}（提交「${item.sent || '空'}」，回读「${item.got || '空'}」）`)
          .join('；')
        message.warning(`条目已提交，但回读发现 ${drifts.length} 个字段未生效：${detail}`)
      } else {
        message.success('知识条目已保存（回读校验一致）')
      }
      setDrawerOpen(false)
      setEditingId(undefined)
      setEditingRow(undefined)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
    onError: (error: Error) => {
      message.error(`保存失败：${error.message || '后端拒绝了本次写入'}`)
    },
  })

  /** 删除条目 */
  const removeMutation = useMutation({
    mutationFn: async (row: KnowledgeRow) => {
      await deleteKnowledgeArticle(row.articleId ?? '')
      return row.articleId ?? ''
    },
    onSuccess: () => {
      message.success('条目已删除')
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
    onError: (error: Error) => {
      message.error(`删除失败：${error.message || '后端拒绝了本次删除'}`)
    },
  })

  /**
   * 审核条目：通过 -> 发布；废弃 -> 后端无该能力，如实报错
   * @param payload 目标条目与审核结论
   */
  const auditMutation = useMutation({
    mutationFn: async (payload: { row: KnowledgeRow; result: 'approved' | 'deprecated' }) => {
      if (payload.result === 'deprecated') {
        // 后端 status 只有 1/0，没有「废弃」态，也没有下架端点；
        // 不做本地假更新（那等于宣称已废弃，刷新即露馅）。
        throw new Error('后端知识库无「废弃」状态，标记废弃未接入')
      }
      await publishKnowledgeArticle(payload.row.articleId ?? '', 1)
      return payload.result
    },
    onSuccess: () => {
      message.success('条目已审核通过并发布')
      void queryClient.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
    onError: (error: Error) => {
      message.error(`审核失败：${error.message || '后端拒绝了本次审核'}`)
    },
  })

  /**
   * 打开新增 / 编辑抽屉
   * @param row 目标条目，为空表示新增
   */
  const openDrawer = (row?: KnowledgeRow): void => {
    setEditingId(row?.articleId)
    setEditingRow(row)
    form.setFieldsValue(
      row
        ? {
            title: row.title,
            categoryName: row.categoryName,
            source: row.source,
            relatedModel: row.relatedModel,
            entryType: row.entryType,
            summary: row.summary,
            // 后端只有正文链接列：编辑时回填 contentUrl，不回填 content
            contentUrl: row.contentUrl,
          }
        : { entryType: entryTab, categoryName: '病虫害防治' },
    )
    setDrawerOpen(true)
  }

  /** 分类树数据：一级分类与条目数均由后端真实条目聚合而来（后端无二级分类） */
  const treeData = useMemo(() => {
    const counter = new Map<string, number>()
    rows.forEach((row) => {
      counter.set(row.categoryName, (counter.get(row.categoryName) ?? 0) + 1)
    })
    return Array.from(counter.entries()).map(([name, count]) => ({
      key: name,
      title: (
        <Space size={4}>
          <span>{name}</span>
          <Typography.Text type="secondary">
            <MetricNumber value={count} />
          </Typography.Text>
        </Space>
      ),
    }))
  }, [rows])

  const columns = useMemo(
    () => [
      {
        title: '编号',
        dataIndex: 'articleNo',
        width: 90,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '标题',
        dataIndex: 'title',
        width: 240,
        render: (text: string, row: KnowledgeRow) => (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailRow(row)}>
            {text ?? MISSING_VALUE_TEXT}
          </Button>
        ),
      },
      {
        title: '分类',
        dataIndex: 'categoryName',
        width: 120,
        render: (text?: string) => (text ? <Tag color="blue">{text}</Tag> : MISSING_VALUE_TEXT),
      },
      {
        title: '来源',
        dataIndex: 'source',
        width: 150,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '审核状态',
        dataIndex: 'auditState',
        width: 100,
        render: (state?: AuditState) =>
          state ? <Tag color={AUDIT_MAP[state].color}>{AUDIT_MAP[state].label}</Tag> : MISSING_VALUE_TEXT,
      },
      {
        title: '关联模型',
        dataIndex: 'relatedModel',
        width: 120,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '查看数',
        dataIndex: 'viewCount',
        width: 110,
        render: (v: unknown) => <MetricNumber value={v} missingTip={VIEW_COUNT_MISSING_TIP} />,
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
                  title: `确认删除条目「${row.title ?? row.articleNo}」？`,
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
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="知识条目加载失败"
          description={`${(listQuery.error as Error | null)?.message ?? '未知错误'}（不使用本地示例数据兜底，列表与统计均为空）`}
        />
      ) : null}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <MetricStatistic title="知识条目总数" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <MetricStatistic
              title="已发布"
              value={stats.approved}
              suffix="条"
              valueStyle={{ color: '#13a05a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <MetricStatistic
              title="草稿（未发布）"
              value={stats.pending}
              suffix="条"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <MetricStatistic
              title="已废弃"
              value={stats.deprecated}
              suffix="条"
              valueStyle={{ color: '#8c8c8c' }}
              missingTip={DEPRECATED_MISSING_TIP}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <Card title="📂 知识分类" styles={{ body: { padding: 12 } }}>
            {treeData.length > 0 ? (
              <Tree
                treeData={treeData}
                defaultExpandAll
                selectedKeys={categoryFilter ? [categoryFilter] : []}
                onSelect={(keys) => setCategoryFilter(keys.length > 0 ? String(keys[0]) : undefined)}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无分类（后端无知识条目或尚未加载）"
              />
            )}
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
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              分类与条目数由后端真实条目聚合；后端无二级分类，故不做二级树。
            </Typography.Paragraph>
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
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="语料类型未接入"
              description={ENTRY_TYPE_NOTE}
            />
            <Table
              rowKey="articleId"
              columns={columns}
              dataSource={displayRows}
              loading={listQuery.isLoading}
              pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              scroll={{ x: 1300 }}
              locale={{
                emptyText: <Empty description="暂无知识条目" />,
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 查看抽屉 */}
      <Drawer
        title={detailRow ? `知识条目 - ${detailRow.title ?? detailRow.articleNo}` : '知识条目'}
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
              <Descriptions.Item label="语料类型">
                {detailRow.entryType ? (
                  ENTRY_TYPE_MAP[detailRow.entryType]
                ) : (
                  // 后端无语料类型字段：显示「—」+ 提示，不做臆断归类
                  <MetricNumber value={null} missingTip={ENTRY_TYPE_MISSING_TIP} />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="分类">{detailRow.categoryName}</Descriptions.Item>
              <Descriptions.Item label="来源">{detailRow.source}</Descriptions.Item>
              <Descriptions.Item label="关联模型">{detailRow.relatedModel ?? MISSING_VALUE_TEXT}</Descriptions.Item>
              <Descriptions.Item label="查看数">
                <MetricNumber value={detailRow.viewCount} missingTip={VIEW_COUNT_MISSING_TIP} />
              </Descriptions.Item>
              <Descriptions.Item label="审核状态">
                <Tag color={AUDIT_MAP[detailRow.auditState].color}>
                  {AUDIT_MAP[detailRow.auditState].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">{detailRow.updatedAt}</Descriptions.Item>
              <Descriptions.Item label="摘要" span={2}>
                {detailRow.summary ?? MISSING_VALUE_TEXT}
              </Descriptions.Item>
            </Descriptions>
            <Card title="正文内容" size="small">
              {detailRow.content ? (
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {detailRow.content}
                </Typography.Paragraph>
              ) : detailRow.contentUrl ? (
                <Space direction="vertical" size={4}>
                  <Typography.Text type="secondary">
                    后端仅提供正文链接，未返回正文内容：
                  </Typography.Text>
                  {/* 后端 contentUrl 为演示种子里的不可解析域名，此处以纯文本展示，
                      不渲染成可点击链接——点了必然加载失败，属于种子口径问题，另行处理 */}
                  <Typography.Text code>{detailRow.contentUrl}</Typography.Text>
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  {MISSING_VALUE_TEXT}（后端未返回正文内容与正文链接）
                </Typography.Text>
              )}
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
              <Form.Item name="entryType" label="语料类型" tooltip={ENTRY_TYPE_MISSING_TIP}>
                <Select
                  allowClear
                  options={[
                    { value: 'pest', label: '病虫害图谱' },
                    { value: 'article', label: '农技文章' },
                    { value: 'qa', label: '问答语料' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="relatedModel" label="关联模型" tooltip="后端无该字段，保存后不会落库">
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
          {/*
            后端知识库**没有正文内容列**，只有 `content_url varchar(255)`。
            此前这一项是「正文内容」多行框（maxLength 2000），保存时写进 contentUrl：
            - 类型就不对（正文塞进链接列）；
            - 长度也不对——MySQL 是 STRICT 模式，超过 255 字符会直接 1406 报错。
            改成如实填写正文链接，长度上限与后端列一致。
          */}
          <Form.Item
            name="contentUrl"
            label="正文链接"
            tooltip="后端知识库只有「正文链接」列（content_url，上限 255 字符），没有正文内容列；正文内容无法保存"
          >
            <Input placeholder="如：https://example.com/kb/rice-blast.html" maxLength={255} showCount />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  )
}
