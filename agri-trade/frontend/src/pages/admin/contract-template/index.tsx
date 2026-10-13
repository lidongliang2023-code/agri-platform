import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { EditOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  createTemplate, deleteTemplate, getTemplates, updateTemplate, type TemplateRow
} from '@/api/contract-template'

const TYPE: Record<string, string> = {
  standard: '标准购销',
  forward: '远期购销',
  framework: '框架采购'
}

/**
 * 合同模板（运营端）。
 *
 * 模板是全平台共用的合同格式。此前只有"列表 + 新建"两个接口、没有页面，
 * **也没有删除** —— 模板加进去就撤不回来了。这里补齐列表/新建/修改/删除。
 *
 * 合同表里存的合同是从某个模板起草出来的：模板改了不影响已生成的合同
 * （合同有自己的正文快照），所以改模板不会把存量合同改掉。
 */
export default function AdminContractTemplate() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState<string | undefined>()
  const [draftKeyword, setDraftKeyword] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTemplates({ pageNum: page, pageSize: 10, templateName: keyword })
      if (res?.code === 200) {
        setRows(res.data?.records ?? [])
        setTotal(Number(res.data?.total ?? 0))
      } else {
        message.error(res?.message ?? '加载模板失败')
      }
    } catch {
      message.error('加载模板失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => {
    load()
  }, [load])

  const openForm = (row?: TemplateRow) => {
    setEditing(row ?? null)
    form.resetFields()
    if (row) {
      form.setFieldsValue({
        templateName: row.templateName,
        templateType: row.templateType,
        templateContent: row.templateContent,
        description: row.description,
        sortOrder: row.sortOrder,
        status: row.status
      })
    } else {
      form.setFieldsValue({ templateType: 'standard', sortOrder: 99, status: 1 })
    }
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = editing ? await updateTemplate(editing.id, values) : await createTemplate(values)
      if (res?.code === 200) {
        message.success(editing ? '已保存' : '已新建')
        setOpen(false)
        load()
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: TemplateRow) => {
    try {
      const res = await deleteTemplate(row.id)
      if (res?.code === 200) {
        message.success('已删除')
        load()
      } else {
        message.error(res?.message ?? '删除失败')
      }
    } catch {
      message.error('删除失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card
        title={`合同模板 ${total} 个`}
        extra={
          <Space>
            <Input placeholder="按模板名称搜索" style={{ width: 180 }} allowClear
              onChange={(e) => setDraftKeyword(e.target.value || undefined)} />
            <Button onClick={() => { setPage(1); setKeyword(draftKeyword) }}>查询</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>新建模板</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="模板是全平台共用的合同格式"
          description="合同是从模板起草出来的，但合同有自己的正文快照 —— 改模板不会改动已生成的合同。删除是软删，列表里不再出现。"
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1200 }}
          pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
          columns={[
            { title: '模板编码', dataIndex: 'templateCode', width: 190 },
            { title: '模板名称', dataIndex: 'templateName', width: 220 },
            { title: '类型', dataIndex: 'templateType', width: 110,
              render: (v: string) => TYPE[v] ?? v ?? '—' },
            { title: '说明', dataIndex: 'description', ellipsis: true, render: (v: string) => v ?? '—' },
            { title: '排序', dataIndex: 'sortOrder', width: 80 },
            { title: '状态', dataIndex: 'status', width: 100,
              render: (v: number) => <Tag color={v === 1 ? 'success' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag> },
            { title: '更新时间', dataIndex: 'updateTime', width: 170 },
            {
              title: '操作',
              width: 150,
              fixed: 'right' as const,
              render: (_: unknown, row: TemplateRow) => (
                <Space size={0}>
                  <Button type="link" icon={<EditOutlined />} onClick={() => openForm(row)}>编辑</Button>
                  <Popconfirm
                    title="确认删除该模板？"
                    description="已用该模板起草的合同不受影响。"
                    okText="确 定"
                    cancelText="取 消"
                    onConfirm={() => handleDelete(row)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal title={editing ? '编辑合同模板' : '新建合同模板'} open={open}
        onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} destroyOnClose width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: '请填写模板名称' }]}>
            <Input placeholder="例如 农产品标准购销合同" />
          </Form.Item>
          <Form.Item name="templateType" label="模板类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={Object.entries(TYPE).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="templateContent" label="模板正文" rules={[{ required: true, message: '请填写模板正文' }]}
            extra="可用占位符，例如 {buyerName}、{goodsName}、{amount}">
            <Input.TextArea rows={8} placeholder="合同正文…" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input placeholder="可留空" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
