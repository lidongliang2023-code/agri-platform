import { useState } from 'react'
import { Alert, App, Button, Card, Col, Drawer, Form, Input, Modal, Row, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/utils/request'
import { listPestAtlas, publishPestAtlas, savePestAtlas } from '@/api/pest-atlas'
import type { KnowledgeSnapshot, PestAtlasEntry } from '@/api/pest-atlas'
import PestKnowledgeEvidence from '@/pages/user/ai/PestKnowledgeEvidence'
const statusNames = { DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下架' }
export default function PestAtlasPanel(): JSX.Element {
  const { message } = App.useApp()
  const cache = useQueryClient()
  const [form] = Form.useForm<PestAtlasEntry>()
  const [searchForm] = Form.useForm()
  const [editing, setEditing] = useState<Partial<PestAtlasEntry>>()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>()
  const [page, setPage] = useState(1)
  const [searchOpen, setSearchOpen] = useState(false)
  const list = useQuery({ queryKey: ['pest-atlas', keyword, status, page], queryFn: () => listPestAtlas({ keyword, status, pageNum: page, pageSize: 10 }) })
  const saved = (): void => { void cache.invalidateQueries({ queryKey: ['pest-atlas'] }) }
  const save = useMutation({ mutationFn: (values: PestAtlasEntry) => savePestAtlas({ ...values, id: editing?.id, revision: editing?.revision }), onSuccess: () => { setEditing(undefined); saved(); message.success('图谱草稿已保存，发布后参与新诊断') }, onError: (error: Error) => message.error(error.message) })
  const publish = useMutation({ mutationFn: publishPestAtlas, onSuccess: () => { saved(); message.success('图谱状态已更新，历史病例快照保持不变') }, onError: (error: Error) => message.error(error.message) })
  const search = useMutation({ mutationFn: (values: { cropName: string; symptoms: string }) => http.get<KnowledgeSnapshot>('/admin/knowledge/pest-atlas/search', values), onError: (error: Error) => message.error(error.message) })
  const edit = (entry: Partial<PestAtlasEntry>): void => { form.resetFields(); form.setFieldsValue(entry); setEditing(entry) }
  return <Card title="病虫害图谱 · 结构化识别依据" extra={<Space><Button onClick={() => { search.reset(); setSearchOpen(true) }}>检索试跑</Button><Button type="primary" onClick={() => edit({ quarantine: false })}>新增图谱条目</Button></Space>}>
    <Alert showIcon type="info" message="图谱管理识别关系，文章管理知识正文" description="只有已审核发布的条目参与诊断。按作物、症状和部位检索后交给视觉模型核验，非病斑图片相似度检索。编辑已发布条目会转回草稿，须重新发布。" style={{ marginBottom: 16 }} />
    <Space wrap style={{ marginBottom: 16 }}><Input.Search allowClear placeholder="作物、病名或来源" onSearch={value => { setKeyword(value); setPage(1) }} /><Select allowClear placeholder="全部状态" style={{ width: 140 }} options={Object.entries(statusNames).map(([value, label]) => ({ value, label }))} onChange={value => { setStatus(value); setPage(1) }} /><Button onClick={() => void list.refetch()}>刷新</Button></Space>
    {list.isError && <Alert type="error" message="图谱加载失败" description={(list.error as Error).message} />}
    <Table<PestAtlasEntry> rowKey="id" loading={list.isLoading} dataSource={list.data?.list ?? []} scroll={{ x: 1000 }} pagination={{ current: page, pageSize: 10, total: list.data?.total ?? 0, onChange: setPage, showSizeChanger: false }} locale={{ emptyText: '暂无图谱条目，请录入有真实出处的识别依据并审核发布' }} columns={[
      { title: '作物 / 病虫害', render: (_, r) => <><Typography.Text strong>{r.cropName} · {r.diseaseName}</Typography.Text><div>{r.quarantine && <Tag color="red">检疫疑似需上报</Tag>}</div></> },
      { title: '症状关键词', render: (_, r) => r.symptomKeywords.join('、') },
      { title: '出处 / 版本', render: (_, r) => <>{r.source || '待填写'}<div>{r.sourceVersion || '待填写'} · 图谱修订 {r.revision}</div></> },
      { title: '状态', render: (_, r) => <Tag color={r.status === 'PUBLISHED' ? 'success' : 'default'}>{statusNames[r.status]}</Tag> },
      { title: '操作', render: (_, r) => <Space><Button type="link" onClick={() => edit(r)}>查看 / 编辑</Button><Button type="link" loading={publish.isPending} onClick={() => publish.mutate(r)}>{r.status === 'PUBLISHED' ? '下架' : '审核发布'}</Button></Space> },
    ]} />
    <Drawer title={editing?.id ? '编辑图谱（保存后为草稿）' : '新增病虫害图谱'} width={760} open={Boolean(editing)} onClose={() => !save.isPending && setEditing(undefined)} extra={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>保存草稿</Button>}>
      <Form form={form} layout="vertical" onFinish={values => save.mutate(values)} disabled={save.isPending}>
        <Row gutter={16}>{[['cropName', '作物名称'], ['diseaseName', '标准病虫害名称']].map(([name, label]) => <Col span={12} key={name}><Form.Item name={name} label={label} rules={[{ required: true, whitespace: true, max: 100 }]}><Input maxLength={100} /></Form.Item></Col>)}</Row>
        {([['cropAliases', '作物别名', 20], ['diseaseAliases', '病虫害别名', 20], ['symptomKeywords', '症状关键词', 20], ['affectedParts', '受害部位', 10], ['growthStages', '适用生育阶段（可选）', 10]] as const).map(([name, label, count]) => <Form.Item key={name} name={name} label={`${label}（最多${count}项）`}><Select mode="tags" tokenSeparators={['，', ',']} open={false} placeholder="输入后按回车添加，也可用逗号分隔" /></Form.Item>)}
        {([['identification', '识别依据'], ['differential', '易混淆病因与鉴别要点'], ['measures', '农艺、物理防治与采样建议']] as const).map(([name, label]) => <Form.Item name={name} label={label} key={name}><Input.TextArea rows={3} maxLength={5000} showCount /></Form.Item>)}
        <Alert type="warning" showIcon message="不要把图谱防治建议用作自动用药处方，农药登记与剂量仍须专业人员核对。" style={{ marginBottom: 16 }} />
        <Row gutter={16}><Col span={12}><Form.Item name="source" label="来源机构 / 文献"><Input maxLength={500} /></Form.Item></Col><Col span={12}><Form.Item name="sourceVersion" label="文献版本 / 日期"><Input maxLength={500} /></Form.Item></Col></Row>
        <Form.Item name="sourceRef" label="出处章节、页码或资料编号"><Input maxLength={500} /></Form.Item>
        <Form.Item name="articleId" label="关联现有病虫害知识文章编号（可选）" extra="不复制文章正文；关联后仅在文章已发布且有正文时参与新诊断。"><Input maxLength={64} /></Form.Item>
        <Form.Item name="quarantine" label="属于检疫性病虫害（须按有效名录审核）" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Drawer>
    <Modal title="已发布图谱检索试跑" open={searchOpen} footer={null} width={800} onCancel={() => setSearchOpen(false)}>
      <Form form={searchForm} layout="vertical" onFinish={values => search.mutate(values)}><Form.Item name="cropName" label="作物名称 / 别名" rules={[{ required: true, max: 100 }]}><Input maxLength={100} /></Form.Item><Form.Item name="symptoms" label="现场症状" rules={[{ required: true, max: 3000 }]}><Input.TextArea rows={3} maxLength={3000} /></Form.Item><Button type="primary" htmlType="submit" loading={search.isPending}>检索已发布依据</Button></Form>
      {search.data && <div style={{ marginTop: 16 }}><PestKnowledgeEvidence snapshot={search.data} /></div>}
    </Modal>
  </Card>
}
