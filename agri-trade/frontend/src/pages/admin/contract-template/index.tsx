import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { ListRowActions } from '@agri/shared'
import {
  createTemplate, deleteTemplate, getTemplates, updateTemplate, type TemplateRow
} from '@/api/contract-template'
import { TradeFilters, TradeList } from '@/components/TradeList'

const TYPE: Record<string, string> = {
  standard: '标准购销',
  forward: '远期购销',
  framework: '框架采购'
}

/**
 * 合同模板（运营端）。
 */
export default function AdminContractTemplate() {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
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
      const res = await getTemplates({ pageNum: page, pageSize, templateName: keyword })
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
  }, [page, pageSize, keyword])

  useEffect(() => {
    load()
  }, [load])

  const handleQuery = () => {
    setPage(1)
    setKeyword(draftKeyword?.trim() || undefined)
  }

  const handleReset = () => {
    setDraftKeyword(undefined)
    setKeyword(undefined)
    setPage(1)
  }

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
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="模板是全平台共用的合同格式"
        description="合同是从模板起草出来的，但合同有自己的正文快照 —— 改模板不会改动已生成的合同。删除是软删，列表里不再出现。"
      />

      <TradeList<TemplateRow>
        listId="admin-contract-template"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>
            新建模板
          </Button>
        )}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '模板名称',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="按模板名称搜索"
                    onChange={(e) => setDraftKeyword(e.target.value || undefined)}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage)
            setPageSize(nextSize)
          },
        }}
        columns={[
          { title: '模板编码', dataIndex: 'templateCode', width: 190, ellipsis: true },
          { title: '模板名称', dataIndex: 'templateName', width: 220, ellipsis: true },
          { title: '类型', dataIndex: 'templateType', width: 110, render: (v: string) => TYPE[v] ?? v ?? '—' },
          { title: '说明', dataIndex: 'description', width: 220, ellipsis: true, render: (v: string) => v ?? '—' },
          { title: '排序', dataIndex: 'sortOrder', width: 80 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: number) => <Tag color={v === 1 ? 'success' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>
          },
          { title: '更新时间', dataIndex: 'updateTime', width: 170 },
          {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: unknown, row: TemplateRow) => (
              <ListRowActions>
                <Button type="link" size="small" onClick={() => openForm(row)}>编辑</Button>
                <Popconfirm
                  title="确认删除该模板？"
                  description="已用该模板起草的合同不受影响。"
                  okText="确 定"
                  cancelText="取 消"
                  onConfirm={() => handleDelete(row)}
                >
                  <Button type="link" size="small" danger>删除</Button>
                </Popconfirm>
              </ListRowActions>
            )
          }
        ]}
      />

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
