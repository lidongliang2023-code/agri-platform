/**
 * 页面名称：差异与异常处置（交易视角）
 * 路由路径：/admin/trade/p2t/diffs
 * 所属模块：产销对接
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Modal, Select, Tag, message } from 'antd'
import { ListRowActions } from '@agri/shared'
import { getP2tDiffs, handleP2tDiff } from '@/api/p2t'
import type { P2tDiffRow } from '@/api/p2t'
import { TradeFilters, TradeList } from '@/components/TradeList'

const TYPE: Record<string, { text: string; color: string }> = {
  SHORT_SHIP: { text: '短装', color: 'red' },
  GRADE_DOWN: { text: '等级降级', color: 'orange' },
  WINDOW_EXPIRED: { text: '窗口过期', color: 'default' },
  OVERSELL: { text: '超卖', color: 'red' },
}

export default function P2tDiffs(): JSX.Element {
  const [rows, setRows] = useState<P2tDiffRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState<string | undefined>()
  const [draftStatus, setDraftStatus] = useState<string | undefined>()
  const [handling, setHandling] = useState<P2tDiffRow | null>(null)
  const [way, setWay] = useState('促销')
  const [remark, setRemark] = useState('')

  const load = useCallback((): void => {
    setLoading(true)
    getP2tDiffs({ pageNum, pageSize, status })
      .then((res: { code: number; data?: { records?: P2tDiffRow[]; total?: number } }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(Number(res.data?.total ?? res.data?.records?.length ?? 0))
        }
      })
      .catch(() => message.error('加载差异失败'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, status])

  useEffect(() => { load() }, [load])

  const submit = async (): Promise<void> => {
    if (!handling) return
    if (!remark.trim()) { message.warning('处置说明必填'); return }
    const res = await handleP2tDiff(handling.id, { status: 'CLOSED', handleWay: way, remark: remark.trim() })
    if (res?.code === 200) {
      message.success('处置已提交')
      setHandling(null)
      setRemark('')
      load()
    } else {
      message.error(res?.message ?? '处置失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <TradeList<P2tDiffRow>
        listId="admin-p2t-diffs"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>差异工单（共 {total} 条）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={() => {
              setPageNum(1)
              setStatus(draftStatus)
            }}
            onReset={() => {
              setDraftStatus(undefined)
              setStatus(undefined)
              setPageNum(1)
            }}
            fields={[
              {
                label: '处置状态',
                control: (
                  <Select
                    allowClear
                    value={draftStatus}
                    placeholder="全部状态"
                    onChange={(v) => {
                      setDraftStatus(v)
                      setPageNum(1)
                      setStatus(v)
                    }}
                    options={[
                      { value: 'OPEN', label: '待处置' },
                      { value: 'PROCESSING', label: '处理中' },
                      { value: 'CLOSED', label: '已关闭' },
                    ]}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: pageNum,
          pageSize,
          total,
          onChange: (p, s) => {
            setPageNum(p)
            setPageSize(s)
          },
        }}
        columns={[
          { title: '工单号', dataIndex: 'ticketNo', width: 170, ellipsis: true },
          { title: '类型', dataIndex: 'diffType', width: 110, render: (v: string) => <Tag color={TYPE[v]?.color}>{TYPE[v]?.text ?? v}</Tag> },
          {
            title: '供给单 / 订单',
            key: 'offerOrder',
            width: 190,
            render: (_, r) => <div>{r.offerNo ?? '—'}<div style={{ fontSize: 12, color: '#888' }}>{r.orderNo ?? ''}</div></div>
          },
          { title: '差异量', dataIndex: 'diffQty', width: 100 },
          { title: '责任方', dataIndex: 'ownerSide', width: 100, render: (v: string) => (v === 'PRODUCTION' ? '生产' : '交易') },
          { title: '状态', dataIndex: 'status', width: 104, render: (v: string) => <Tag color={v === 'CLOSED' ? 'green' : 'orange'}>{v}</Tag> },
          { title: '处置说明', dataIndex: 'handleRemark', width: 220, ellipsis: true, render: (v: string) => v || '—' },
          {
            title: '操作',
            key: 'action',
            width: 104,
            render: (_, r) => (
              r.status === 'CLOSED' ? (
                <span style={{ color: '#a0aec0' }}>已关闭</span>
              ) : (
                <ListRowActions>
                  <Button type="link" size="small" onClick={() => setHandling(r)}>处置</Button>
                </ListRowActions>
              )
            )
          },
        ]}
        locale={{ emptyText: '暂无差异工单' }}
      />

      <Modal open={!!handling} title={`处置差异 ${handling?.ticketNo ?? ''}`} onCancel={() => setHandling(null)} onOk={() => void submit()} okText="提交处置">
        <div style={{ marginBottom: 12 }}>处置方式
          <Select value={way} style={{ width: '100%', marginTop: 6 }} onChange={setWay}
            options={[
              { value: '促销', label: '交易侧发起促销建议' },
              { value: '接受降价', label: '接受降价清货' },
              { value: '转加工', label: '转加工 / 自销' },
              { value: '冻结SPU', label: '超卖：冻结 SPU 并人工核查' },
            ]} />
        </div>
        <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="处置说明（必填）" />
      </Modal>
    </div>
  )
}
