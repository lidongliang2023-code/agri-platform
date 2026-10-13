import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { auditProduct, getAdminProductPage } from '@/api/admin'

interface ProductRow {
  id: number
  productCode: string
  productName: string
  sellerName: string
  categoryName: string
  variety: string
  unit: string
  price: number
  stockQuantity: number
  originProvince: string
  originCity: string
  publishStatus: string
  auditor: string
  auditTime: string
  auditRemark: string
  createTime: string
}

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  published: { text: '已发布', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  draft: { text: '草稿', color: 'default' }
}

/**
 * 货源审核（PRD 10.2 第二组）。
 *
 * <p>通过 / 驳回都会写审核人、审核时间与审核意见 —— 审核动作不留痕，
 * 事后就没法回答"这条货源是谁放行的"。</p>
 */
export default function AdminProductAudit() {
  const [rows, setRows] = useState<ProductRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [publishStatus, setPublishStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [rejecting, setRejecting] = useState<ProductRow | null>(null)
  const [rejectRemark, setRejectRemark] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getAdminProductPage({
      pageNum,
      pageSize,
      publishStatus: publishStatus || undefined,
      keyword: keyword || undefined
    })
      .then((res: { code: number; data?: { records?: ProductRow[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载货源失败')
        }
      })
      .catch(() => message.error('加载货源失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, publishStatus, keyword])

  useEffect(() => {
    load()
  }, [load])

  const handleAudit = async (row: ProductRow, approved: boolean, remark?: string) => {
    const res = await auditProduct(row.id, approved, remark)
    if (res?.code === 200) {
      message.success(approved ? '已通过，货源对买家可见' : '已驳回')
      setRejecting(null)
      setRejectRemark('')
      load()
    } else {
      message.error(res?.message ?? '审核失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="180px">
            <Select
              value={publishStatus}
              style={{ width: '100%' }}
              onChange={(value) => {
                setPageNum(1)
                setPublishStatus(value)
              }}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'published', label: '已发布' },
                { value: 'rejected', label: '已驳回' },
                { value: 'draft', label: '草稿' },
                { value: '', label: '全部状态' }
              ]}
            />
          </Col>
          <Col flex="260px">
            <Input.Search
              allowClear
              placeholder="货源名称 / 编码 / 供应商"
              onSearch={(value) => {
                setPageNum(1)
                setKeyword(value)
              }}
            />
          </Col>
          <Col flex="auto">
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Card title={`货源 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1200 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            }
          }}
          columns={[
            { title: '货源编码', dataIndex: 'productCode', width: 150 },
            { title: '货源名称', dataIndex: 'productName', width: 200 },
            { title: '供应商', dataIndex: 'sellerName', width: 150 },
            { title: '品类', dataIndex: 'categoryName', width: 90 },
            { title: '品种', dataIndex: 'variety', width: 110 },
            { title: '单价', dataIndex: 'price', width: 110, render: (val: number, row: ProductRow) => `¥${val}/${row.unit}` },
            {
              title: '产地',
              width: 130,
              render: (_: unknown, row: ProductRow) => [row.originProvince, row.originCity].filter(Boolean).join(' ') || '—'
            },
            {
              title: '状态',
              dataIndex: 'publishStatus',
              width: 100,
              render: (val: string) => {
                const tag = STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            {
              title: '审核痕迹',
              width: 200,
              render: (_: unknown, row: ProductRow) =>
                row.auditor ? `${row.auditor} / ${row.auditTime ?? ''}${row.auditRemark ? ' / ' + row.auditRemark : ''}` : '—'
            },
            {
              title: '操作',
              width: 160,
              fixed: 'right',
              render: (_: unknown, row: ProductRow) =>
                row.publishStatus === 'pending' ? (
                  <Space size="small">
                    <Popconfirm title="通过后该货源对买家可见，确认？" onConfirm={() => handleAudit(row, true)}>
                      <Button type="link" size="small">
                        通过
                      </Button>
                    </Popconfirm>
                    <Button type="link" size="small" danger onClick={() => setRejecting(row)}>
                      驳回
                    </Button>
                  </Space>
                ) : (
                  <span style={{ color: '#a0aec0' }}>已处理</span>
                )
            }
          ]}
        />
      </Card>

      <Modal
        open={Boolean(rejecting)}
        title={`驳回货源：${rejecting?.productName ?? ''}`}
        onCancel={() => setRejecting(null)}
        onOk={() => handleAudit(rejecting as ProductRow, false, rejectRemark)}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          value={rejectRemark}
          onChange={(e) => setRejectRemark(e.target.value)}
          placeholder="请填写驳回原因（会作为审核意见留给供应商）"
        />
      </Modal>
    </div>
  )
}
