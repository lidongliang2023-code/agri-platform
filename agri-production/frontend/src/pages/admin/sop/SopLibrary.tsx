import '@/components/ProductionListDense.css'
import Table from '@/components/ProductionListTable'
import ListRowActions from '@/components/ListRowActions'
import PageContainer from '@/components/ProductionPageContainer'
import { useMemo, useRef, useState } from 'react'
import ContentEditor, { CONTENT_LIMIT, ContentPreview, hasContent, normalizeContent, safeContentUrl } from '@/components/ContentEditor'
import { Alert, App, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber, Row, Select, Space, Statistic, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSopLibrary, deleteSopLibrary, getSopLibrary, listSopLibrary, publishSopLibrary, updateSopLibrary } from '@/api'
import type { SopLibraryItem } from '@/api'

type SopForm = Partial<SopLibraryItem>
const TYPE_OPTIONS = [{ value: 'PLANT', label: '种植' }, { value: 'PEST', label: '植保' }, { value: 'HARVEST', label: '采收' }]
function dash(v: unknown): string { return v === null || v === undefined || v === '' ? '—' : String(v) }
function statusTag(v?: number | null): JSX.Element { return v === 1 ? <Tag color="success">已发布</Tag> : <Tag>草稿</Tag> }

export default function SopLibrary(): JSX.Element {
  const { message, modal } = App.useApp()
  const client = useQueryClient()
  const [form] = Form.useForm<SopForm>()
  const [filterForm] = Form.useForm()
  const [filters, setFilters] = useState<{ keyword?: string; status?: number }>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<SopLibraryItem | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const submitting = useRef(false)
  const [imageUploading, setImageUploading] = useState(false)
  const imageBusy = useRef(false)
  const uploadingChanged = (busy: boolean) => { imageBusy.current = busy; setImageUploading(busy) }
  const [detail, setDetail] = useState<SopLibraryItem | undefined>()
  const list = useQuery({ queryKey: ['admin-sop-library', filters, page, pageSize], queryFn: () => listSopLibrary({ ...filters, pageNum: page, pageSize }) })
  const rows = list.data?.list ?? []
  const save = useMutation({
    mutationFn: async (values: SopForm) => {
      const payload = { ...values, sopName: values.sopName?.trim(), content: normalizeContent(values.content), contentUrl: values.contentUrl?.trim() || '' }
      const sopId = editing?.sopId ?? await createSopLibrary(payload)
      setEditing({ ...payload, sopId })
      if (editing?.sopId) await updateSopLibrary(sopId, payload)
      const saved = await getSopLibrary(sopId)
      if (!saved || saved.sopName !== payload.sopName || (saved.content ?? '') !== payload.content.replace(/\r\n?/g, '\n')) throw new Error('已提交，但正文回读不一致；已保留编辑内容，请重试保存')
      return saved
    },
    onSuccess: (saved) => {
      message.success('SOP规程及正文已保存')
      if (detail?.sopId === saved.sopId) setDetail(saved)
      setEditing(null); setEditorOpen(false); form.resetFields()
      void client.invalidateQueries({ queryKey: ['admin-sop-library'] })
    },
    onError: (e: Error) => message.error(`保存失败：${e.message}`),
    onSettled: () => { submitting.current = false },
  })
  const remove = useMutation({ mutationFn: (row: SopLibraryItem) => deleteSopLibrary(row.sopId), onSuccess: () => { message.success('SOP已删除'); void client.invalidateQueries({ queryKey: ['admin-sop-library'] }) } })
  const publish = useMutation({ mutationFn: (row: SopLibraryItem) => publishSopLibrary(row.sopId, row.status === 1 ? 0 : 1), onSuccess: () => { message.success('SOP状态已更新'); void client.invalidateQueries({ queryKey: ['admin-sop-library'] }) } })
  const closeEditor = () => {
    if (submitting.current || imageBusy.current) return
    setEditing(null); setEditorOpen(false); form.resetFields()
  }
  const openEdit = async (row?: SopLibraryItem) => {
    try {
      const full = row ? await getSopLibrary(row.sopId) : null
      form.resetFields(); setEditing(full)
      form.setFieldsValue(full ?? { status: 0, versionNo: 'V1.0', sopType: 'PLANT', content: '', contentUrl: '' })
      setEditorOpen(true)
    } catch (error) { message.error(`规程加载失败：${(error as Error).message}`) }
  }

  const columns = useMemo(() => [
    { title: '规程编码', dataIndex: 'sopCode', render: (v: string) => dash(v) },
    { title: '规程名称', dataIndex: 'sopName', render: (v: string) => <Typography.Text strong>{dash(v)}</Typography.Text> },
    { title: '类型', dataIndex: 'sopType', render: (v: string) => <Tag>{TYPE_OPTIONS.find((x) => x.value === v)?.label ?? dash(v)}</Tag> },
    { title: '版本', dataIndex: 'versionNo', render: (v: string) => dash(v) },
    { title: '适用阶段', dataIndex: 'stageSeq', render: (v: number) => v == null ? '—' : `第${v}阶段` },
    { title: '适用区域', dataIndex: 'applicableRegion', render: (v: string) => dash(v) },
    { title: '状态', dataIndex: 'status', render: (v: number) => statusTag(v) },
    { title: '操作', key: 'action', width: 160, fixed: 'right' as const, render: (_: unknown, row: SopLibraryItem) => <ListRowActions items={[<Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={async () => setDetail(await getSopLibrary(row.sopId))}>详情</Button>, <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>, <Button key="pub" type="link" size="small" onClick={() => publish.mutate(row)}>{row.status === 1 ? '下架' : '发布'}</Button>, <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => modal.confirm({ title: `确认删除「${row.sopName ?? row.sopCode}」？`, okButtonProps: { danger: true }, onOk: () => remove.mutateAsync(row) })}>删除</Button>]} /> },
  ], [modal, publish, remove])
  return <PageContainer className="production-list-dense production-member-list" title="生产域 SOP 规程库" subTitle="标准化种植、植保与采收操作规程维护与发布"><Space direction="vertical" size={12} style={{ width: '100%' }}>
    {list.isError ? <Alert type="error" showIcon message="规程库加载失败" description={(list.error as Error).message} /> : null}
    <Row gutter={12}><Col span={8}><Card><Statistic title="规程总数" value={list.data?.total ?? 0} /></Card></Col><Col span={8}><Card><Statistic title="当前页已发布" value={rows.filter((x) => x.status === 1).length} /></Card></Col><Col span={8}><Card><Statistic title="当前页草稿" value={rows.filter((x) => x.status === 0).length} /></Card></Col></Row>
    <Table<SopLibraryItem>
      rowKey="sopId"
      loading={list.isLoading}
      columns={columns}
      dataSource={rows}
      rowSelection={{}}
      columnSettingsStorageKey="agri:production:visible-columns:v1:admin-sop-library"
      columnWidthStorageKey="agri:production:column-widths:v1:admin-sop-library"
      onRefresh={() => void client.invalidateQueries({ queryKey: ['admin-sop-library'] })}
      filterSlot={
        <Form form={filterForm} className="production-filter-grid" onFinish={(v) => { setFilters(v); setPage(1) }}>
          <Form.Item name="keyword" label="关键字"><Input allowClear placeholder="名称或编码" /></Form.Item>
          <Form.Item name="status" label="状态"><Select allowClear placeholder="全部" options={[{ value: 1, label: '已发布' }, { value: 0, label: '草稿' }]} /></Form.Item>
          <Form.Item className="production-filter-actions">
            <Space size={8}>
              <Button onClick={() => { filterForm.resetFields(); setFilters({}); setPage(1) }}>重置</Button>
              <Button type="primary" htmlType="submit" loading={list.isFetching}>查询</Button>
            </Space>
          </Form.Item>
        </Form>
      }
      toolbarLeft={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新增规程</Button>}
      scroll={{ x: 1180 }}
      locale={{ emptyText: <Empty description="暂无生产SOP" /> }}
      pagination={{ current: page, pageSize, total: list.data?.total ?? 0, onChange: (next, size) => { setPage(next); setPageSize(size) } }}
    />
    <Drawer title={editing ? '编辑生产SOP' : '新增生产SOP'} width="min(1080px, 100vw)" open={editorOpen} onClose={closeEditor} maskClosable={!save.isPending && !imageUploading} closable={!save.isPending && !imageUploading} destroyOnHidden extra={<Space><Button disabled={save.isPending || imageUploading} onClick={closeEditor}>取消</Button><Button type="primary" loading={save.isPending} disabled={imageUploading} onClick={() => form.submit()}>保存到生产域</Button></Space>}>
      <Form form={form} layout="vertical" disabled={save.isPending} onFinish={(v) => { if (!submitting.current && !imageBusy.current) { submitting.current = true; save.mutate(v) } }}>
        <Row gutter={16}><Col xs={24} md={12}><Form.Item name="sopCode" label="规程编码"><Input maxLength={64} placeholder="不填则自动生成" /></Form.Item></Col><Col xs={24} md={12}><Form.Item name="sopName" label="规程名称" rules={[{ required: true, whitespace: true, message: '请输入规程名称' }]}><Input maxLength={100} /></Form.Item></Col></Row>
        <Row gutter={16}><Col xs={24} md={8}><Form.Item name="sopType" label="规程类型" rules={[{ required: true, message: '请选择规程类型' }]}><Select options={TYPE_OPTIONS} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="cropId" label="作物ID"><Input maxLength={64} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="versionNo" label="版本号"><Input maxLength={16} /></Form.Item></Col></Row>
        <Row gutter={16}><Col xs={24} md={8}><Form.Item name="stageSeq" label="适用阶段"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="applicableRegion" label="适用区域"><Input maxLength={100} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="publisher" label="发布人"><Input maxLength={50} /></Form.Item></Col></Row>
        <Form.Item name="content" label="规程正文" dependencies={['contentUrl']} rules={[{ max: CONTENT_LIMIT, message: '正文含格式标记最多100000个字符' }, ({ getFieldValue }) => ({ validator: (_, value) => hasContent(value) || safeContentUrl(getFieldValue('contentUrl')) ? Promise.resolve() : Promise.reject(new Error('请输入规程正文，或提供有效的规程文件链接')) })]}><ContentEditor disabled={save.isPending} onUploadingChange={uploadingChanged} /></Form.Item>
        <Form.Item name="contentUrl" label="规程文件 / 参考链接（可选）" rules={[{ validator: (_, value) => !value || safeContentUrl(value.trim()) ? Promise.resolve() : Promise.reject(new Error('请输入完整的 HTTP 或 HTTPS 地址')) }]}><Input maxLength={255} placeholder="可保留原有 PDF 规程或参考资料地址" /></Form.Item>
        <Form.Item name="status" label="保存状态"><Select options={[{ value: 0, label: '草稿' }, { value: 1, label: '已发布' }]} /></Form.Item>
      </Form>
    </Drawer>
    <Drawer title={detail ? `规程详情 - ${dash(detail.sopName)}` : '规程详情'} width={720} open={Boolean(detail)} onClose={() => setDetail(undefined)}>{detail ? <Space direction="vertical" size={16} style={{ width: '100%' }}><Descriptions bordered column={2}><Descriptions.Item label="规程编码">{dash(detail.sopCode)}</Descriptions.Item><Descriptions.Item label="版本">{dash(detail.versionNo)}</Descriptions.Item><Descriptions.Item label="类型">{dash(detail.sopType)}</Descriptions.Item><Descriptions.Item label="作物ID">{dash(detail.cropId)}</Descriptions.Item><Descriptions.Item label="适用阶段">{detail.stageSeq == null ? '—' : detail.stageSeq}</Descriptions.Item><Descriptions.Item label="适用区域">{dash(detail.applicableRegion)}</Descriptions.Item><Descriptions.Item label="发布人">{dash(detail.publisher)}</Descriptions.Item><Descriptions.Item label="状态">{statusTag(detail.status)}</Descriptions.Item><Descriptions.Item label="规程文件" span={2}>{safeContentUrl(detail.contentUrl) ? <Typography.Link href={safeContentUrl(detail.contentUrl)} target="_blank" rel="noopener noreferrer">{detail.contentUrl}</Typography.Link> : '—'}</Descriptions.Item></Descriptions><Card title="规程正文"><ContentPreview value={detail.content} /></Card></Space> : null}</Drawer>
  </Space></PageContainer>
}
