import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { App, Alert, Button, Drawer, Input, Modal, Select, Space, Tag } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import useAuthStore from '@/store/auth'
import ProTable from '@/components/ProductionTable'
import PageContainer from '@/components/ProductionPageContainer'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import { handleP2tDiff, listP2tDiffs } from '@/api/p2t'
import type { P2tDiffTicket } from '@/api/p2t'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'

const TYPES: Record<string, string> = { SHORT_SHIP: '短装', GRADE_DOWN: '等级降级', WINDOW_EXPIRED: '窗口过期', OVERSELL: '超卖' }
const STATUSES: Record<string, string> = { OPEN: '待处理', PENDING: '待处理', PROCESSING: '处理中', CLOSED: '已关闭' }
const OWNERS: Record<string, string> = { PRODUCTION: '生产侧', TRADE: '交易侧', SYSTEM: '系统' }
export default function P2tDiffs(): JSX.Element {
  const navigate = useNavigate()
  const subjectId = useAuthStore(s => s.userInfo?.tenantId)
  const scope = String(subjectId ?? '')
  const current = () => !!scope && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope
  const { message } = App.useApp()
  const ref = useRef<ActionType>(null)
  const [selected, setSelected] = useState<P2tDiffTicket | null>(null)
  const [handling, setHandling] = useState<P2tDiffTicket | null>(null)
  const [status, setStatus] = useState('PROCESSING')
  const [way, setWay] = useState('补发')
  const [remark, setRemark] = useState('')
  const [evidenceNo, setEvidenceNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setSelected(null); setHandling(null); setRemark(''); setFailed(false) }, [subjectId])
  const begin = (row: P2tDiffTicket) => { setHandling(row); setStatus('PROCESSING'); setWay(row.handleWay || '补发'); setRemark(''); setEvidenceNo('') }
  const submit = async () => {
    if (!handling || !current() || saving) return
    if (!remark.trim()) { message.warning('请填写处置说明'); return }
    if (status === 'CLOSED' && !evidenceNo.trim()) { message.warning(way === '降级' ? '请填写正式等级复核单号' : way === '补发' ? '请填写补发物流单号' : '请填写退款单号'); return }
    setSaving(true)
    try {
      const result = await handleP2tDiff(handling.id, { status, handleWay: way, remark: remark.trim(), evidenceNo: evidenceNo.trim(), expectedStatus: handling.status })
      if (!current()) return
      message.success(status === 'CLOSED' ? (way === '降级' ? '正式等级复核核验通过，工单已关闭（不含价款调整）' : way === '补发' ? '足额补发及买方签收核验通过，工单已关闭' : '交易账务全额退款核验通过，工单已关闭（不代表外部资金到账）') : '处理进展已追加保存'); setHandling(null)
      setSelected(old => old?.id === result.id ? result : old); ref.current?.reload()
    } catch (e) { if (current()) message.error((e as Error).message || '处置失败') }
    finally { setSaving(false) }
  }
  const columns: ProColumns<P2tDiffTicket>[] = [
    { title: '工单／供给／订单', dataIndex: 'keyword', hideInTable: true },
    { title: '工单号', dataIndex: 'ticketNo', width: 190, search: false, render: (_, r) => <Button type="link" onClick={() => setSelected(r)}>{r.ticketNo}</Button> },
    { title: '差异类型', dataIndex: 'diffType', valueType: 'select', valueEnum: TYPES, width: 120 },
    { title: '供给单号', dataIndex: 'offerNo', search: false, width: 190 },
    { title: '订单号', dataIndex: 'orderNo', search: false, width: 190 },
    { title: '差异量', dataIndex: 'diffQty', search: false, align: 'right', width: 100 },
    { title: '责任方', dataIndex: 'ownerSide', search: false, width: 100, render: (_, r) => OWNERS[r.ownerSide] || r.ownerSide || '—' },
    { title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: STATUSES, width: 110, render: (_, r) => <Tag color={r.status === 'CLOSED' ? 'green' : r.status === 'PROCESSING' ? 'blue' : 'orange'}>{STATUSES[r.status] || r.status}</Tag> },
    { title: '发现时间', dataIndex: 'discoveredAt', search: false, width: 170 },
    { title: '处置方式', dataIndex: 'handleWay', search: false, width: 120 },
    { title: '处置说明', dataIndex: 'handleRemark', search: false, width: 240, ellipsis: true },
    { title: '处置时间', dataIndex: 'handleTime', search: false, width: 170 },
    { title: '操作', valueType: 'option', fixed: 'right', width: 140, render: (_, r) => <Space><Button type="link" onClick={() => setSelected(r)}>详情</Button>{r.status !== 'CLOSED' && r.ownerSide === 'PRODUCTION' && <Button type="link" onClick={() => begin(r)}>登记处置</Button>}</Space> },
  ]
  return <PageContainer header={{ title: '差异与异常处置' }}>
    {failed && <Alert type="error" message="工单加载失败" action={<Button onClick={() => ref.current?.reload()}>重试</Button>} />}
    <ProTable<P2tDiffTicket> key={scope} actionRef={ref} rowKey="id" columns={columns} params={{ subjectId }}
      columnWidthStorageKey="p2t-diff-tickets" scroll={SCROLL_BY_CONTENT} options={{ reload: true, density: true, setting: true }}
      search={{ labelWidth: 'auto' }} pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      request={async p => {
        if (!current()) return { data: [], total: 0, success: false }
        setFailed(false)
        const result = await listP2tDiffs({ pageNum: p.current ?? 1, pageSize: p.pageSize ?? 20, keyword: p.keyword, status: p.status, diffType: p.diffType })
        return current() ? { data: result.list, total: result.total, success: true } : { data: [], total: 0, success: false }
      }} onRequestError={() => { if (current()) setFailed(true) }} />
    <Drawer open={!!selected} title="差异工单详情" width={760} onClose={() => setSelected(null)} destroyOnClose>
      {selected && <><DetailInfoGrid items={[
        { label: '工单号', value: selected.ticketNo }, { label: '差异类型', value: TYPES[selected.diffType] || selected.diffType },
        { label: '状态', value: STATUSES[selected.status] || selected.status }, { label: '责任方', value: OWNERS[selected.ownerSide] || selected.ownerSide },
        { label: '供给单号', value: selected.offerNo }, { label: '订单号', value: selected.orderNo },
        { label: '差异量', value: selected.diffQty }, { label: '发现时间', value: selected.discoveredAt },
        { label: '处置方式', value: selected.handleWay }, { label: '处置时间', value: selected.handleTime },
        { label: '处置说明', value: selected.handleRemark, fullWidth: true },
      ]} />{selected.status !== 'CLOSED' && selected.ownerSide === 'PRODUCTION' && <Button style={{ marginTop: 16 }} type="primary" onClick={() => begin(selected)}>登记处置</Button>}</>}
    </Drawer>
    <Modal title={`登记处置 ${handling?.ticketNo || ''}`} open={!!handling} confirmLoading={saving} onCancel={() => { if (!saving) setHandling(null) }} onOk={() => void submit()}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="此处仅登记协同处置记录"
          description="先登记处理中，再核验关闭。短装工单可用原订单足额补发且买方签收的专用物流单核验关闭；退款仅核验交易账务全额记账，不代表外部到账。等级降级可凭双人确认的正式复核单关闭，仅认定履约商品等级，不含价款调整；其他方案保留处理中。先在交易物流页从原物流单登记补发。交易或系统责任工单仅可查看。" />
        <span>处置状态</span><Select style={{ width: '100%' }} value={status} onChange={setStatus} options={[{ value: 'PROCESSING', label: '处理中' }, { value: 'CLOSED', label: '核验凭据并关闭', disabled: handling?.status !== 'PROCESSING' || !(way === '退款' || (way === '降级' && handling?.diffType === 'GRADE_DOWN') || (way === '补发' && handling?.diffType === 'SHORT_SHIP')) }]} />
        <span>处置方式</span><Select style={{ width: '100%' }} value={way} onChange={value => { setWay(value); setStatus('PROCESSING') }} options={['补发', '降级', '退款', '其他'].map(value => ({ value, label: `${value}（登记方案）` }))} />
        {handling?.diffType === 'GRADE_DOWN' && <Button onClick={() => navigate(`/production/quality/grading?ticketId=${handling.id}`)}>查看或申请正式等级复核</Button>}
        {status === 'CLOSED' && <><span>{way === '降级' ? '正式等级复核单号（双人确认通过）' : way === '补发' ? '补发物流单号（足额及买方签收核验）' : '退款单号（交易账务核验）'}</span><Input value={evidenceNo} onChange={e => setEvidenceNo(e.target.value)} maxLength={64} placeholder={way === '降级' ? 'GR 开头的正式等级复核单号' : way === '补发' ? 'RS 开头的专用补发物流单号' : '原订单关联的退款单号'} /></>}
        <span>本次处理结果（追加保留历史）</span><Input.TextArea value={remark} onChange={e => setRemark(e.target.value)} maxLength={200} showCount rows={4} />
      </Space>
    </Modal>
  </PageContainer>
}
