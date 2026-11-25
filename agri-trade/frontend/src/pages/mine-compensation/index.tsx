import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Card, Col, Input, Row, Select, Statistic, Tag, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { getMyCompensations, type CompensationVO } from '@/api/compensation'
import { getMyMerchants } from '@/api/identity'
import { TradeFilters, TradeList } from '@/components/TradeList'

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已核准待打款', color: 'processing' },
  rejected: { text: '已驳回', color: 'error' },
  paid: { text: '已到账', color: 'success' }
}

const TYPE: Record<string, string> = {
  delay: '交付延误',
  quality: '质量不符',
  quantity: '数量短缺',
  price: '价格争议',
  dispute: '纠纷裁定',
  other: '其他'
}

/**
 * 我的获赔（商家侧）。
 */
export default function MyCompensation() {
  const [rows, setRows] = useState<CompensationVO[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState<string | undefined>()
  const [draftKeyword, setDraftKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyCompensations()
      if (res?.code === 200) {
        setRows(res.data ?? [])
      } else {
        message.error(res?.message ?? '加载获赔记录失败')
      }
    } catch {
      message.error('加载获赔记录失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { data: merchantData } = useQuery({ queryKey: ['my-merchants'], queryFn: getMyMerchants })
  const merchants = merchantData?.code === 200 ? merchantData.data ?? [] : null

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) =>
      (!status || r.compensationStatus === status)
      && (!kw || [r.compensationNo, r.orderNo, r.compensationReason, r.transactionId].some((v) => String(v ?? '').toLowerCase().includes(kw))))
  }, [rows, status, keyword])

  const totalPaid = rows
    .filter((r) => r.compensationStatus === 'paid')
    .reduce((sum, r) => sum + Number(r.compensationAmount ?? 0), 0)
  const openCount = rows.filter((r) => r.compensationStatus === 'pending' || r.compensationStatus === 'approved').length

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {merchants?.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="当前账号还没有绑定经营主体"
          description="因此看不到任何获赔记录。请运营在「用户-主体绑定」里为你绑定经营主体后重试。"
        />
      )}

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="已到账赔付" value={totalPaid} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="在办赔付（待审 + 待打款）" value={openCount} suffix="笔" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="赔付单总数" value={rows.length} suffix="笔" />
          </Card>
        </Col>
      </Row>

      <TradeList<CompensationVO>
        listId="member-compensation"
        rowKey="id"
        loading={loading}
        dataSource={filteredRows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>我的获赔（共 {filteredRows.length} 笔）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={() => {
              setStatus(draftStatus)
              setKeyword(draftKeyword)
            }}
            onReset={() => {
              setDraftStatus(undefined)
              setDraftKeyword('')
              setStatus(undefined)
              setKeyword('')
            }}
            fields={[
              {
                label: '赔付状态',
                control: (
                  <Select
                    allowClear
                    value={draftStatus}
                    placeholder="全部状态"
                    onChange={setDraftStatus}
                    options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.text }))}
                  />
                ),
              },
              {
                label: '关键字',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="赔付单号 / 订单号 / 流水号"
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onPressEnter={() => {
                      setStatus(draftStatus)
                      setKeyword(draftKeyword)
                    }}
                  />
                ),
              },
            ]}
          />
        )}
        columns={[
          { title: '赔付单号', dataIndex: 'compensationNo', width: 180, ellipsis: true },
          { title: '关联订单', dataIndex: 'orderNo', width: 170, ellipsis: true, render: (v: string) => v ?? '—' },
          {
            title: '赔付类型',
            dataIndex: 'compensationType',
            width: 120,
            render: (v: string) => (v ? TYPE[v] ?? v : '—')
          },
          {
            title: '赔付金额',
            dataIndex: 'compensationAmount',
            width: 140,
            render: (v: number) => (v == null ? '—' : `¥${v}`)
          },
          {
            title: '状态',
            dataIndex: 'compensationStatus',
            width: 130,
            render: (v: string) => {
              const hit = STATUS[v] ?? { text: v, color: 'default' }
              return <Tag color={hit.color}>{hit.text}</Tag>
            }
          },
          { title: '赔付事由', dataIndex: 'compensationReason', width: 220, ellipsis: true, render: (v: string) => v ?? '—' },
          { title: '到账时间', dataIndex: 'payTime', width: 170, render: (v: string) => v ?? '—' },
          { title: '打款流水号', dataIndex: 'transactionId', width: 220, ellipsis: true, render: (v: string) => v ?? '—' },
          { title: '发起时间', dataIndex: 'createTime', width: 170 }
        ]}
      />
    </div>
  )
}
