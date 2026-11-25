import PestAtlasPanel from './PestAtlasPanel'
import PestImageSamplesPanel from './PestImageSamplesPanel'
import '@/components/ProductionListDense.css'
import Table from '@/components/ProductionListTable'
import ListRowActions from '@/components/ListRowActions'
import PageContainer from '@/components/ProductionPageContainer'
import { useMemo, useRef, useState } from 'react'
import ContentEditor, { CONTENT_LIMIT, ContentPreview, hasContent, normalizeContent, safeContentUrl } from '@/components/ContentEditor'
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
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  listKnowledgeArticles,
  publishKnowledgeArticle,
  updateKnowledgeArticle,
} from '@/api'
import type { KnowledgeArticle, PageResult } from '@/types'

const CATEGORY_OPTIONS = [
  { value: 'PLANT', label: '种植技术' },
  { value: 'PEST', label: '病虫害防治' },
  { value: 'POLICY', label: '政策法规' },
]
const CATEGORY_NAMES: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((x) => [x.value, x.label]))

type ArticleForm = {
  title: string
  categoryCode: string
  source?: string
  summary?: string
  contentUrl?: string
  content?: string
}

function dash(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function statusTag(status?: number | null): JSX.Element {
  return status === 1 ? <Tag color="success">已发布</Tag> : <Tag color="warning">草稿</Tag>
}

export default function KnowledgeBase(): JSX.Element {
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<ArticleForm>()
  const [filterForm] = Form.useForm()
  const [filters, setFilters] = useState<{ keyword?: string; categoryCode?: string; status?: number }>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editorOpen, setEditorOpen] = useState(false)
  const submitting = useRef(false)
  const [imageUploading, setImageUploading] = useState(false)
  const imageBusy = useRef(false)
  const uploadingChanged = (busy: boolean) => { imageBusy.current = busy; setImageUploading(busy) }
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null)
  const [detail, setDetail] = useState<KnowledgeArticle | null>(null)

  const list = useQuery({
    queryKey: ['admin-knowledge-articles', filters, page, pageSize],
    queryFn: (): Promise<PageResult<KnowledgeArticle>> =>
      listKnowledgeArticles({ ...filters, pageNum: page, pageSize }),
  })
  const rows = list.data?.list ?? []

  const save = useMutation({
    mutationFn: async (values: ArticleForm) => {
      const payload = { ...values, title: values.title.trim(), content: normalizeContent(values.content), contentUrl: values.contentUrl?.trim() || '' }
      const articleId = editing?.articleId ?? await createKnowledgeArticle(payload)
      // 新增成功后即保留编号，回读异常时重试会更新原记录，避免重复新增。
      setEditing({ ...payload, articleId })
      if (editing?.articleId) await updateKnowledgeArticle(articleId, payload)
      const saved = await getKnowledgeArticle(articleId)
      if (!saved || saved.title !== payload.title || (saved.content ?? '') !== payload.content.replace(/\r\n?/g, '\n')) {
        throw new Error('已提交，但正文回读不一致；已保留编辑内容，请重试保存')
      }
      return saved
    },
    onSuccess: (saved) => {
      message.success('生产知识文章及正文已保存')
      if (detail?.articleId === saved.articleId) setDetail(saved)
      setEditorOpen(false)
      setEditing(null)
      form.resetFields()
      void client.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
    onError: (error: Error) => message.error(`保存失败：${error.message}`),
    onSettled: () => { submitting.current = false },
  })

  const publish = useMutation({
    mutationFn: (row: KnowledgeArticle) => publishKnowledgeArticle(row.articleId ?? '', row.status === 1 ? 0 : 1),
    onSuccess: () => {
      message.success('文章发布状态已更新')
      void client.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
    onError: (error: Error) => message.error(`状态更新失败：${error.message}`),
  })

  const remove = useMutation({
    mutationFn: (row: KnowledgeArticle) => deleteKnowledgeArticle(row.articleId ?? ''),
    onSuccess: () => {
      message.success('文章已逻辑删除')
      void client.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })
    },
    onError: (error: Error) => message.error(`删除失败：${error.message}`),
  })

  const closeEditor = () => {
    if (submitting.current || imageBusy.current) return
    setEditorOpen(false)
    setEditing(null)
    form.resetFields()
  }
  const openEditor = async (row?: KnowledgeArticle) => {
    try {
      const full = row ? await getKnowledgeArticle(row.articleId) : null
      form.resetFields()
      setEditing(full)
      form.setFieldsValue(full ? {
        title: full.title ?? '', categoryCode: full.categoryCode, source: full.source ?? full.author,
        summary: full.summary ?? '', contentUrl: full.contentUrl ?? '', content: full.content ?? '',
      } : { categoryCode: 'PEST', content: '', contentUrl: '' })
      setEditorOpen(true)
    } catch (error) { message.error(`文章加载失败：${(error as Error).message}`) }
  }

  const columns = useMemo(() => [
    { title: '文章编号', dataIndex: 'articleId', width: 150, render: (v: string) => dash(v) },
    {
      title: '标题',
      dataIndex: 'title',
      width: 260,
      render: (v: string, row: KnowledgeArticle) => <Button type="link" style={{ padding: 0 }} onClick={async () => setDetail(await getKnowledgeArticle(row.articleId))}>{dash(v)}</Button>,
    },
    { title: '分类', dataIndex: 'categoryCode', width: 130, render: (v: string) => <Tag color="blue">{CATEGORY_NAMES[v] ?? dash(v)}</Tag> },
    { title: '来源', dataIndex: 'source', width: 180, render: (v: string, row: KnowledgeArticle) => dash(v ?? row.author) },
    { title: '阅读数', dataIndex: 'readCount', width: 100, render: (v: number) => dash(v) },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: number) => statusTag(v) },
    { title: '更新时间', dataIndex: 'updatedAt', width: 170, render: (v: string) => dash(v) },
    {
      title: '操作',
      key: 'action',
      width: 165,
      fixed: 'right' as const,
      render: (_: unknown, row: KnowledgeArticle) => (
        <ListRowActions
          items={[
            <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEditor(row)}>编辑</Button>,
            <Button key="pub" type="link" size="small" onClick={() => publish.mutate(row)}>{row.status === 1 ? '下架' : '发布'}</Button>,
            <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => modal.confirm({ title: `确认删除「${row.title ?? row.articleId}」？`, okButtonProps: { danger: true }, onOk: () => remove.mutateAsync(row) })}>删除</Button>,
          ]}
        />
      ),
    },
  ], [modal, publish, remove])

  return <PageContainer className="production-list-dense production-member-list" title="生产知识库" subTitle="维护生产知识文章、病虫害图谱与病斑样本库"><Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Alert type="info" showIcon message="生产知识文章归生产域维护" description="文章分类、来源、摘要、正文和发布状态直接写入生产域知识文章表；模型、提示词和问答场景请在 AI 中台治理。" />
    {list.isError ? <Alert type="error" showIcon message="知识文章加载失败" description={(list.error as Error).message} /> : null}
    <Table<KnowledgeArticle>
      rowKey="articleId"
      columns={columns}
      dataSource={rows}
      loading={list.isLoading}
      rowSelection={{}}
      columnSettingsStorageKey="agri:production:visible-columns:v1:admin-knowledge-articles"
      columnWidthStorageKey="agri:production:column-widths:v1:admin-knowledge-articles"
      onRefresh={() => void client.invalidateQueries({ queryKey: ['admin-knowledge-articles'] })}
      filterSlot={
        <Form form={filterForm} className="production-filter-grid" onFinish={(values) => { setFilters(values); setPage(1) }}>
          <Form.Item name="keyword" label="关键词"><Input allowClear placeholder="标题或摘要" /></Form.Item>
          <Form.Item name="categoryCode" label="分类"><Select allowClear placeholder="全部" options={CATEGORY_OPTIONS} /></Form.Item>
          <Form.Item name="status" label="状态"><Select allowClear placeholder="全部" options={[{ value: 1, label: '已发布' }, { value: 0, label: '草稿' }]} /></Form.Item>
          <Form.Item className="production-filter-actions">
            <Space size={8}>
              <Button onClick={() => { filterForm.resetFields(); setFilters({}); setPage(1) }}>重置</Button>
              <Button type="primary" htmlType="submit" loading={list.isFetching}>查询</Button>
            </Space>
          </Form.Item>
        </Form>
      }
      toolbarLeft={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新增文章</Button>}
      scroll={{ x: 1220 }}
      locale={{ emptyText: <Empty description="暂无生产知识文章" /> }}
      pagination={{ current: page, pageSize, total: list.data?.total ?? 0, onChange: (next, size) => { setPage(next); setPageSize(size) } }}
    />
    <PestAtlasPanel />
    <PestImageSamplesPanel />
    <Drawer title={detail ? `文章详情 - ${dash(detail.title)}` : '文章详情'} width={720} open={Boolean(detail)} onClose={() => setDetail(null)}>
      {detail ? <Space direction="vertical" size={16} style={{ width: '100%' }}><Descriptions bordered column={2}><Descriptions.Item label="文章编号">{dash(detail.articleId)}</Descriptions.Item><Descriptions.Item label="分类">{CATEGORY_NAMES[detail.categoryCode ?? ''] ?? dash(detail.categoryCode)}</Descriptions.Item><Descriptions.Item label="来源">{dash(detail.source ?? detail.author)}</Descriptions.Item><Descriptions.Item label="状态">{statusTag(detail.status)}</Descriptions.Item><Descriptions.Item label="阅读数">{dash(detail.readCount)}</Descriptions.Item><Descriptions.Item label="更新时间">{dash(detail.updatedAt)}</Descriptions.Item><Descriptions.Item label="摘要" span={2}>{dash(detail.summary)}</Descriptions.Item></Descriptions><Card title="文章正文"><ContentPreview value={detail.content} /></Card>{safeContentUrl(detail.contentUrl) ? <Typography.Link href={safeContentUrl(detail.contentUrl)} target="_blank" rel="noreferrer"><LinkOutlined /> 打开正文链接</Typography.Link> : <Typography.Text type="secondary">未配置正文链接</Typography.Text>}</Space> : null}
    </Drawer>
    <Drawer title={editing ? '编辑生产知识文章' : '新增生产知识文章'} width="min(1080px, 100vw)" open={editorOpen} onClose={closeEditor} maskClosable={!save.isPending && !imageUploading} closable={!save.isPending && !imageUploading} extra={<Space><Button disabled={save.isPending || imageUploading} onClick={closeEditor}>取消</Button><Button type="primary" loading={save.isPending} disabled={imageUploading} onClick={() => form.submit()}>保存到生产域</Button></Space>} destroyOnHidden>
      <Form form={form} layout="vertical" disabled={save.isPending} onFinish={(values) => { if (!submitting.current && !imageBusy.current) { submitting.current = true; save.mutate(values) } }}>
        <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true, message: '请输入标题' }, { max: 128, message: '标题最多128字' }]}><Input maxLength={128} /></Form.Item>
        <Row gutter={16}><Col span={12}><Form.Item name="categoryCode" label="分类" rules={[{ required: true, message: '请选择分类' }]}><Select options={CATEGORY_OPTIONS} /></Form.Item></Col><Col span={12}><Form.Item name="source" label="来源"><Input maxLength={100} /></Form.Item></Col></Row>
        <Form.Item name="summary" label="摘要"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
        <Form.Item name="content" label="文章正文" dependencies={['contentUrl']} rules={[{ max: CONTENT_LIMIT, message: '正文含格式标记最多100000个字符' }, ({ getFieldValue }) => ({ validator: (_, value) => hasContent(value) || safeContentUrl(getFieldValue('contentUrl')) ? Promise.resolve() : Promise.reject(new Error('请输入正文，或提供有效的外部正文链接')) })]}><ContentEditor disabled={save.isPending} onUploadingChange={uploadingChanged} /></Form.Item>
        <Form.Item name="contentUrl" label="外部正文 / 参考链接（可选）" rules={[{ validator: (_, value) => !value || safeContentUrl(value.trim()) ? Promise.resolve() : Promise.reject(new Error('请输入完整的 HTTP 或 HTTPS 地址')) }]}><Input maxLength={255} placeholder="可保留原有外部文章或参考资料地址" /></Form.Item>
      </Form>
    </Drawer>
  </Space></PageContainer>
}
