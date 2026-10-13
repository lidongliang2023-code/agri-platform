import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Col, Input, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { deleteDemand, getDemandList, matchDemand, type DemandQuery } from '@/api/demand'

interface DemandRow {
  id: number
  demandNo: string
  demandName: string
  buyerName: string
  categoryName: string
  variety: string
  productName: string
  quantity: number
  unit: string
  priceMin: number
  priceMax: number
  deliveryProvince: string
  deliveryCity: string
  demandStatus: string
  responseCount: number
  createTime: string
}

const STATUS_TAG: Record<string, { text: string; color: string }> = {
  pending: { text: '待匹配', color: 'warning' },
  matching: { text: '匹配中', color: 'processing' },
  quoted: { text: '已报价', color: 'blue' },
  completed: { text: '已完成', color: 'success' },
  closed: { text: '已关闭', color: 'default' }
}

/**
 * 采购需求列表（原型"采购需求 → 需求列表"）。
 *
 * <p>接上了本次新增的 keyword / demandStatus 过滤参数 —— 在此之前搜框输了字点搜索
 * 是没有任何变化的：后端只认 buyerId 与状态，其余参数被 Spring 静默忽略。</p>
 */
export default function DemandList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<DemandRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<DemandQuery>({ pageNum: 1, pageSize: 10 })

  const load = useCallback((next: DemandQuery) => {
    setLoading(true)
    getDemandList(next)
      .then((res: { code: number; data?: { records?: DemandRow[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载需求失败')
        }
      })
      .catch(() => message.error('加载需求失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(query)
  }, [query, load])

  const handleMatch = async (id: number) => {
    const res = await matchDemand(id)
    if (res?.code === 200) {
      message.success('已触发撮合，去详情页看匹配结果')
      load(query)
    } else {
      message.error(res?.message ?? '触发撮合失败')
    }
  }

  const handleDelete = async (id: number) => {
    const res = await deleteDemand(id)
    if (res?.code === 200) {
      message.success('已下架')
      load(query)
    } else {
      message.error(res?.message ?? '下架失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="260px">
            <Input.Search
              allowClear
              placeholder="搜索需求名称 / 商品 / 品种"
              onSearch={(value) =>
                setQuery((prev) => ({ ...prev, pageNum: 1, keyword: value || undefined }))
              }
            />
          </Col>
          <Col flex="180px">
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: '100%' }}
              onChange={(value) => setQuery((prev) => ({ ...prev, pageNum: 1, demandStatus: value }))}
              options={Object.entries(STATUS_TAG).map(([value, item]) => ({ value, label: item.text }))}
            />
          </Col>
          <Col flex="auto">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => load(query)}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/demand/create')}>
                发布采购需求
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title={`采购需求 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1200 }}
          pagination={{
            current: query.pageNum,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
          }}
          columns={[
            { title: '需求单号', dataIndex: 'demandNo', width: 150 },
            {
              title: '需求名称',
              dataIndex: 'demandName',
              width: 200,
              render: (text: string, row: DemandRow) => (
                <a onClick={() => navigate(`/demand/detail/${row.id}`)}>{text || `需求 ${row.demandNo}`}</a>
              )
            },
            { title: '采购方', dataIndex: 'buyerName', width: 160 },
            { title: '品类', dataIndex: 'categoryName', width: 100 },
            { title: '品种', dataIndex: 'variety', width: 110 },
            {
              title: '数量',
              dataIndex: 'quantity',
              width: 110,
              render: (val: number, row: DemandRow) => `${val} ${row.unit ?? ''}`
            },
            {
              title: '期望价',
              width: 150,
              render: (_: unknown, row: DemandRow) => `¥${row.priceMin} ~ ¥${row.priceMax}`
            },
            {
              title: '收货地',
              width: 140,
              render: (_: unknown, row: DemandRow) =>
                [row.deliveryProvince, row.deliveryCity].filter(Boolean).join(' ') || '—'
            },
            {
              title: '状态',
              dataIndex: 'demandStatus',
              width: 100,
              render: (val: string) => {
                const tag = STATUS_TAG[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            { title: '已报价', dataIndex: 'responseCount', width: 90 },
            { title: '发布时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 200,
              fixed: 'right',
              render: (_: unknown, row: DemandRow) => (
                <Space size="small">
                  <Button type="link" size="small" onClick={() => navigate(`/demand/detail/${row.id}`)}>
                    详情
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleMatch(row.id)}
                  >
                    撮合
                  </Button>
                  <Popconfirm title="确认下架这条需求？" onConfirm={() => handleDelete(row.id)}>
                    <Button type="link" size="small" danger>
                      下架
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}
