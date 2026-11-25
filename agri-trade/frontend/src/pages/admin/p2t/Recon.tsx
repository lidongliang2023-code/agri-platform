/**
 * 页面名称：产销对账
 * 路由路径：/admin/trade/p2t/recon
 * 所属模块：数据 / 产销对账
 */
import { Card, Col, Input, Row, Select, Statistic, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getP2tRecon } from '@/api/p2t'
import { TradeFilters, TradeList } from '@/components/TradeList'

interface ReconRow {
  offerNo: string
  cropName?: string
  unit: string
  supplyQty: number
  tradedQty: number
  remainingQty: number
  tradeRate: number
  auditStatus: string
  tradeStatus: string
  productCode?: string
  batchNo?: string
}

export default function P2tRecon(): JSX.Element {
  const [rows, setRows] = useState<ReconRow[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState<string | undefined>()

  const load = useCallback(() => {
    setLoading(true)
    getP2tRecon()
      .then((res: { code: number; data?: ReconRow[] }) => {
        if (res?.code === 200) setRows(res.data ?? [])
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) =>
      (!status || r.tradeStatus === status)
      && (!kw || [r.offerNo, r.cropName, r.batchNo, r.productCode].some((v) => String(v ?? '').toLowerCase().includes(kw))))
  }, [rows, keyword, status])

  const statusOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.tradeStatus).filter(Boolean))
    return Array.from(set).map((value) => ({ value, label: value }))
  }, [rows])

  const supply = filteredRows.reduce((sum, r) => sum + Number(r.supplyQty ?? 0), 0)
  const traded = filteredRows.reduce((sum, r) => sum + Number(r.tradedQty ?? 0), 0)
  const remaining = filteredRows.reduce((sum, r) => sum + Number(r.remainingQty ?? 0), 0)

  const handleQuery = () => {
    setKeyword(draftKeyword)
    setStatus(draftStatus)
  }

  const handleReset = () => {
    setDraftKeyword('')
    setDraftStatus(undefined)
    setKeyword('')
    setStatus(undefined)
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 16 }}>
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="供给量合计" value={supply} precision={1} /></Card></Col>
        <Col span={8}><Card><Statistic title="成交量合计" value={traded} precision={1} /></Card></Col>
        <Col span={8}><Card><Statistic title="剩余可售" value={remaining} precision={1} /></Card></Col>
      </Row>

      <TradeList<ReconRow>
        listId="admin-p2t-recon"
        rowKey="offerNo"
        loading={loading}
        dataSource={filteredRows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>供给单三维对账（共 {filteredRows.length} 条）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '关键字',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="供给单 / 品种 / 批次 / 商品"
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onPressEnter={handleQuery}
                  />
                ),
              },
              {
                label: '交易状态',
                control: (
                  <Select
                    allowClear
                    value={draftStatus}
                    placeholder="全部状态"
                    onChange={setDraftStatus}
                    options={statusOptions}
                  />
                ),
              },
            ]}
          />
        )}
        columns={[
          { title: '供给单', dataIndex: 'offerNo', width: 170, ellipsis: true },
          { title: '品种', dataIndex: 'cropName', width: 130, ellipsis: true },
          { title: '批次', dataIndex: 'batchNo', width: 150, ellipsis: true },
          { title: '供给量', dataIndex: 'supplyQty', width: 115, render: (v, r) => `${v} ${r.unit}` },
          { title: '成交量', dataIndex: 'tradedQty', width: 115, render: (v, r) => `${v} ${r.unit}` },
          { title: '剩余', dataIndex: 'remainingQty', width: 115, render: (v, r) => `${v} ${r.unit}` },
          { title: '成交率', dataIndex: 'tradeRate', width: 96, render: (v) => `${v}%` },
          { title: '入仓量', key: 'warehouseQty', width: 125, render: () => <Typography.Text type="secondary">仓储管理只读</Typography.Text> },
          {
            title: '状态',
            dataIndex: 'tradeStatus',
            width: 110,
            render: (v: string) => <Tag color={v === 'LISTED' ? 'green' : 'default'}>{v}</Tag>,
          },
          { title: '商品', dataIndex: 'productCode', width: 160, ellipsis: true, render: (v) => v ?? '—' },
        ]}
        locale={{ emptyText: '还没有供给数据' }}
      />
    </div>
  )
}
