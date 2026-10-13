import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, message
} from 'antd'
import { PlusOutlined, ReloadOutlined, StopOutlined, UndoOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  createCategory, deleteCategory, getCategories, getProductOptions, getViolations,
  revokeViolation, takeDownProduct, updateCategory,
  type CategoryRow, type ProductOption, type ViolationRow
} from '@/api/catalog'

const VIOLATION_TYPE: Record<string, string> = {
  false_info: '信息不实',
  banned: '禁售品',
  price_fraud: '价格欺诈',
  quality: '质量问题',
  other: '其它'
}

/**
 * 商品违规与品类管理（运营端）。
 *
 * 两组放在一页的两个页签里（PRD 里本就是同一组）。
 *
 * 品类这一块顺带收口了一处越权：原来品类的增删改挂在**用户侧**路径
 * /api/trade/product/category 下，且没有任何角色校验 —— 品类是全平台分类体系，
 * 任何一个登录用户都能新增、改名、删掉它。写接口已移到 /api/trade/admin/category/**。
 */
export default function AdminCatalog() {
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [violationTotal, setViolationTotal] = useState(0)
  const [violationPage, setViolationPage] = useState(1)
  const [violationStatus, setViolationStatus] = useState<string | undefined>()
  const [products, setProducts] = useState<ProductOption[]>([])
  const [takeDownOpen, setTakeDownOpen] = useState(false)
  const [revokeRow, setRevokeRow] = useState<ViolationRow | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [categoryTotal, setCategoryTotal] = useState(0)
  const [categoryPage, setCategoryPage] = useState(1)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [violationForm] = Form.useForm()
  const [categoryForm] = Form.useForm()

  const loadViolations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getViolations({ pageNum: violationPage, pageSize: 10, violationStatus })
      if (res?.code === 200) {
        setViolations(res.data?.records ?? [])
        setViolationTotal(Number(res.data?.total ?? 0))
      }
    } catch {
      message.error('加载违规记录失败')
    } finally {
      setLoading(false)
    }
  }, [violationPage, violationStatus])

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCategories({ pageNum: categoryPage, pageSize: 20 })
      if (res?.code === 200) {
        setCategories(res.data?.records ?? [])
        setCategoryTotal(Number(res.data?.total ?? 0))
      }
    } catch {
      message.error('加载品类失败')
    } finally {
      setLoading(false)
    }
  }, [categoryPage])

  useEffect(() => { loadViolations() }, [loadViolations])
  useEffect(() => { loadCategories() }, [loadCategories])

  const openTakeDown = async () => {
    violationForm.resetFields()
    setTakeDownOpen(true)
    try {
      const res = await getProductOptions({ pageNum: 1, pageSize: 100 })
      if (res?.code === 200) setProducts(res.data?.records ?? [])
    } catch {
      setProducts([])
    }
  }

  const submitTakeDown = async () => {
    const values = await violationForm.validateFields()
    setSaving(true)
    try {
      const res = await takeDownProduct(values.productId, values.violationType, values.reason)
      if (res?.code === 200) {
        message.success('已下架并留痕')
        setTakeDownOpen(false)
        loadViolations()
      } else {
        message.error(res?.message ?? '处置失败')
      }
    } catch {
      message.error('处置失败')
    } finally {
      setSaving(false)
    }
  }

  const submitRevoke = async () => {
    if (!revokeRow) return
    setSaving(true)
    try {
      const res = await revokeViolation(revokeRow.id, revokeReason)
      if (res?.code === 200) {
        message.success('已撤销处置，货源回到处置前的状态')
        setRevokeRow(null)
        setRevokeReason('')
        loadViolations()
      } else {
        message.error(res?.message ?? '撤销失败')
      }
    } catch {
      message.error('撤销失败')
    } finally {
      setSaving(false)
    }
  }

  const openCategory = (row?: CategoryRow) => {
    setEditingCategory(row ?? null)
    categoryForm.resetFields()
    if (row) {
      categoryForm.setFieldsValue({
        categoryName: row.categoryName,
        categoryCode: row.categoryCode,
        parentId: row.parentId,
        sortOrder: row.sortOrder,
        status: row.status,
        remark: row.remark
      })
    } else {
      categoryForm.setFieldsValue({ status: 1, sortOrder: 0 })
    }
    setCategoryOpen(true)
  }

  const submitCategory = async () => {
    const values = await categoryForm.validateFields()
    setSaving(true)
    try {
      const res = editingCategory
        ? await updateCategory(editingCategory.id, values)
        : await createCategory(values)
      if (res?.code === 200) {
        message.success(editingCategory ? '已保存' : '已新建')
        setCategoryOpen(false)
        loadCategories()
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async (row: CategoryRow) => {
    try {
      const res = await deleteCategory(row.id)
      if (res?.code === 200) {
        message.success('已删除')
        loadCategories()
      } else {
        message.error(res?.message ?? '删除失败')
      }
    } catch {
      message.error('删除失败')
    }
  }

  const parentName = (id: number | null) =>
    id == null ? '顶级品类' : categories.find((c) => c.id === id)?.categoryName ?? ('#' + id)

  const violationTab = (
    <Card
      title={'违规处置记录 ' + violationTotal + ' 条'}
      extra={
        <Space>
          <Select
            placeholder="处置状态"
            style={{ width: 130 }}
            allowClear
            onChange={(v) => { setViolationPage(1); setViolationStatus(v) }}
            options={[
              { value: 'active', label: '生效中' },
              { value: 'revoked', label: '已撤销' }
            ]}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadViolations}>刷新</Button>
          <Button type="primary" icon={<StopOutlined />} onClick={openTakeDown}>违规下架</Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="下架必须填写原因，且每条处置都留痕"
        description="下架后货源状态变为「已下架」，不再出现在货架；撤销处置会把它恢复到处置前的上架状态（不是一律重新上架）。"
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={violations}
        scroll={{ x: 1300 }}
        locale={{ emptyText: '暂无违规处置记录' }}
        pagination={{ current: violationPage, pageSize: 10, total: violationTotal, onChange: setViolationPage }}
        columns={[
          { title: '处置单号', dataIndex: 'violationNo', width: 160 },
          { title: '货源', dataIndex: 'productName', width: 190 },
          { title: '供应商', dataIndex: 'sellerName', width: 150, render: (v: string) => v ?? '—' },
          { title: '违规类型', dataIndex: 'violationType', width: 110,
            render: (v: string) => VIOLATION_TYPE[v] ?? v ?? '—' },
          { title: '处置原因', dataIndex: 'reason', ellipsis: true },
          { title: '状态', dataIndex: 'violationStatus', width: 100,
            render: (v: string) => (
              <Tag color={v === 'active' ? 'error' : 'default'}>{v === 'active' ? '生效中' : '已撤销'}</Tag>
            ) },
          { title: '处理人', dataIndex: 'operator', width: 100, render: (v: string) => v ?? '—' },
          { title: '处置时间', dataIndex: 'createTime', width: 170 },
          {
            title: '操作',
            width: 110,
            fixed: 'right' as const,
            render: (_: unknown, row: ViolationRow) =>
              row.violationStatus === 'active' ? (
                <Button type="link" icon={<UndoOutlined />}
                  onClick={() => { setRevokeRow(row); setRevokeReason('') }}>撤销</Button>
              ) : (
                <span style={{ color: '#a0aec0' }}>已撤销</span>
              )
          }
        ]}
      />
    </Card>
  )

  const categoryTab = (
    <Card
      title={'品类 ' + categoryTotal + ' 个'}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadCategories}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCategory()}>新建品类</Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="有下级品类或还有货源在用的品类不能删除"
        description="品类是全平台共用的分类体系，删掉之后引用它的货源会变成悬空引用（页面上只剩空白品类）。这种情况请改为「停用」。"
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={categories}
        locale={{ emptyText: '暂无品类' }}
        pagination={{ current: categoryPage, pageSize: 20, total: categoryTotal, onChange: setCategoryPage }}
        columns={[
          { title: '品类名称', dataIndex: 'categoryName', width: 180 },
          { title: '编码', dataIndex: 'categoryCode', width: 140, render: (v: string) => v ?? '—' },
          { title: '上级品类', dataIndex: 'parentId', width: 150, render: (v: number | null) => parentName(v) },
          { title: '层级', dataIndex: 'level', width: 80 },
          { title: '排序', dataIndex: 'sortOrder', width: 80 },
          { title: '状态', dataIndex: 'status', width: 100,
            render: (v: number) => <Tag color={v === 1 ? 'success' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag> },
          { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v: string) => v ?? '—' },
          {
            title: '操作',
            width: 150,
            fixed: 'right' as const,
            render: (_: unknown, row: CategoryRow) => (
              <Space size={0}>
                <Button type="link" icon={<EditOutlined />} onClick={() => openCategory(row)}>编辑</Button>
                <Popconfirm
                  title="确认删除该品类？"
                  description="有下级品类或还有货源在用时会拒绝删除。"
                  okText="确 定"
                  cancelText="取 消"
                  onConfirm={() => handleDeleteCategory(row)}
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />
    </Card>
  )

  return (
    <div style={{ padding: 20 }}>
      <Tabs items={[
        { key: 'violation', label: '商品违规', children: violationTab },
        { key: 'category', label: '品类管理', children: categoryTab }
      ]} />

      <Modal title="违规下架" open={takeDownOpen} onCancel={() => setTakeDownOpen(false)}
        onOk={submitTakeDown} confirmLoading={saving} destroyOnClose>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="下架后该货源不再出现在货架"
          description="原因必填（会作为处置留痕保留，商家来问时可以追溯）。" />
        <Form form={violationForm} layout="vertical">
          <Form.Item name="productId" label="货源" rules={[{ required: true, message: '请选择货源' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择已发布的货源"
              options={products.map((p) => ({ value: p.id, label: p.productName + '（' + (p.sellerName ?? '—') + '）' }))}
            />
          </Form.Item>
          <Form.Item name="violationType" label="违规类型" rules={[{ required: true, message: '请选择违规类型' }]}>
            <Select options={Object.entries(VIOLATION_TYPE).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="reason" label="处置原因" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={3} placeholder="例如：标题与实际规格不符，买家投诉属实" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="撤销违规处置" open={!!revokeRow} onCancel={() => setRevokeRow(null)}
        onOk={submitRevoke} confirmLoading={saving} destroyOnClose>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="撤销后货源恢复到处置前的上架状态"
          description="不是一律重新上架：如果处置前是草稿或待审核，就回到那个状态。" />
        <Input.TextArea rows={3} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
          placeholder="撤销原因（可留空）" />
      </Modal>

      <Modal
        title={editingCategory ? '编辑品类' : '新建品类'}
        open={categoryOpen}
        onCancel={() => setCategoryOpen(false)}
        onOk={submitCategory}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="categoryName" label="品类名称" rules={[{ required: true, message: '请填写品类名称' }]}>
            <Input placeholder="例如 大米" />
          </Form.Item>
          <Form.Item name="categoryCode" label="编码">
            <Input placeholder="可留空" />
          </Form.Item>
          <Form.Item name="parentId" label="上级品类" extra="不选即为顶级品类；层级由服务端按上级推导">
            <Select
              allowClear
              placeholder="顶级品类"
              options={categories
                .filter((c) => c.id !== editingCategory?.id)
                .map((c) => ({ value: c.id, label: c.categoryName }))}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
