import { useCallback, useEffect, useState } from 'react'
import { getMineDashboard, type MineDashboard } from '@/api/mine-dashboard'
import { getMyMerchants, getMyRealName, type MyMerchant, type RealNameRecord } from '@/api/identity'
import { getOrderList, type OrderQuery } from '@/api/order'
import { getDemandList, type DemandVO } from '@/api/demand'
import { getEvaluationList, type EvaluationVO } from '@/api/evaluation'
import { getDisputeList, type DisputeVO } from '@/api/dispute'
import { getProductList, type TradeProductVO } from '@/api/product'
import { getLogisticsList, type LogisticsVO } from '@/api/logistics'
import { getMyGuarantees, type GuaranteeRow } from '@/api/guarantee'
import { getMyInquiries, getReceivedInquiries, type InquiryVO } from '@/api/inquiry'

export interface OrderRow {
  id: number
  orderNo: string
  buyerId: number
  buyerName: string
  sellerId: number
  sellerName: string
  productName: string
  categoryName?: string
  totalQuantity: number | null
  totalAmount: number
  paidAmount?: number
  orderStatus: string
  paymentStatus: string
  createTime: string
}

export const ORDER_STATUS: Record<string, { text: string; tone: string }> = {
  pending_confirm: { text: '待确认', tone: 'amber' },
  pending: { text: '待付款', tone: 'amber' },
  paid: { text: '待发货', tone: 'tech' },
  shipped: { text: '运输中', tone: 'tech' },
  received: { text: '已收货', tone: 'green' },
  completed: { text: '已完成', tone: 'green' },
  cancelled: { text: '已取消', tone: 'ghost' },
  refunding: { text: '退款中', tone: 'red' },
  refunded: { text: '已退款', tone: 'ghost' },
}

export const money = (value: number | null | undefined): string =>
  value == null ? '—' : `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const shortDate = (value: string | null | undefined): string =>
  value ? value.replace('T', ' ').slice(0, 16) : '—'

export function StatusTag({ status, side }: { status: string; side?: 'buyer' | 'seller' }): JSX.Element {
  const known = ORDER_STATUS[status]
  const text = known?.text ?? status ?? '未知'
  const tone = known?.tone ?? 'ghost'
  return <span className={`mc-tag ${tone}`}>{side === 'seller' && status === 'paid' ? '待发货' : text}</span>
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }): JSX.Element {
  return (
    <div className="mc-empty">
      <div className="mc-empty-title">{title}</div>
      {desc && <div className="mc-empty-desc">{desc}</div>}
      {action && <div className="mc-empty-action">{action}</div>}
    </div>
  )
}

export function Panel({
  title,
  extra,
  children,
  className = '',
}: {
  title?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <section className={`mc-panel ${className}`}>
      {(title || extra) && (
        <div className="mc-panel-head">
          <h3>{title}</h3>
          <div className="mc-panel-extra">{extra}</div>
        </div>
      )}
      {children}
    </section>
  )
}

interface PageResult<T> {
  records?: T[]
  total?: number
}

interface ApiResult<T> {
  code?: number
  message?: string
  data?: T
}

function pageOf<T>(body: ApiResult<PageResult<T>> | undefined): { rows: T[]; total: number; error?: string } {
  if (!body) return { rows: [], total: 0, error: '接口无响应' }
  if (body.code !== 200) return { rows: [], total: 0, error: body.message ?? '加载失败' }
  return { rows: body.data?.records ?? [], total: body.data?.total ?? 0 }
}

/** 当前登录账号绑定的经营主体 + 买卖两侧看板 + 实名状态。 */
export function useMemberBase(): {
  loading: boolean
  error: string
  merchants: MyMerchant[]
  merchantIds: number[]
  primary: MyMerchant | null
  dashboard: MineDashboard | null
  realName: RealNameRecord | null
  reload: () => void
} {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [merchants, setMerchants] = useState<MyMerchant[]>([])
  const [dashboard, setDashboard] = useState<MineDashboard | null>(null)
  const [realName, setRealName] = useState<RealNameRecord | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([getMyMerchants(), getMineDashboard(), getMyRealName()]).then(([merchantRes, dashboardRes, realNameRes]) => {
      if (cancelled) return
      if (merchantRes.status === 'fulfilled' && merchantRes.value?.code === 200) {
        setMerchants(merchantRes.value.data ?? [])
      } else {
        setMerchants([])
        const message = merchantRes.status === 'fulfilled' ? merchantRes.value?.message : undefined
        setError(message ?? '无法解析当前账号绑定的经营主体')
      }
      if (dashboardRes.status === 'fulfilled' && dashboardRes.value?.code === 200) {
        setDashboard(dashboardRes.value.data ?? null)
      }
      if (realNameRes.status === 'fulfilled' && realNameRes.value?.code === 200) {
        setRealName(realNameRes.value.data ?? null)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [tick])

  const merchantIds = merchants.map((item) => Number(item.merchantId))
  return {
    loading,
    error,
    merchants,
    merchantIds,
    primary: merchants[0] ?? null,
    dashboard,
    realName,
    reload: () => setTick((value) => value + 1),
  }
}

export function useOrders(side: 'buyer' | 'seller', status: string, pageNum = 1, pageSize = 10): {
  rows: OrderRow[]
  total: number
  loading: boolean
  error: string
  reload: () => void
} {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params: OrderQuery = { pageNum, pageSize, side, orderStatus: status || undefined }
    getOrderList(params)
      .then((body: ApiResult<PageResult<OrderRow>>) => {
        if (cancelled) return
        const result = pageOf(body)
        setRows(result.rows)
        setTotal(result.total)
        setError(result.error ?? '')
      })
      .catch(() => { if (!cancelled) { setRows([]); setTotal(0); setError('加载订单失败') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [side, status, pageNum, pageSize, tick])

  return { rows, total, loading, error, reload: () => setTick((value) => value + 1) }
}

export function useDemands(buyerId: number | null): { rows: DemandVO[]; loading: boolean; error: string } {
  const [rows, setRows] = useState<DemandVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!buyerId) { setRows([]); return }
    let cancelled = false
    setLoading(true)
    getDemandList({ pageNum: 1, pageSize: 50, buyerId })
      .then((body: ApiResult<PageResult<DemandVO>>) => {
        if (cancelled) return
        const result = pageOf(body)
        setRows(result.rows)
        setError(result.error ?? '')
      })
      .catch(() => { if (!cancelled) setError('加载采购需求失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [buyerId])
  return { rows, loading, error }
}

export function useMyInquiryRows(): { rows: InquiryVO[]; loading: boolean; error: string } {
  const [rows, setRows] = useState<InquiryVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMyInquiries()
      .then((body: ApiResult<InquiryVO[]>) => {
        if (cancelled) return
        if (body?.code === 200) setRows(Array.isArray(body.data) ? body.data : [])
        else setError(body?.message ?? '加载询价失败')
      })
      .catch(() => { if (!cancelled) setError('加载询价失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { rows, loading, error }
}

export function useReceivedInquiries(): InquiryVO[] {
  const [rows, setRows] = useState<InquiryVO[]>([])
  useEffect(() => {
    let cancelled = false
    getReceivedInquiries()
      .then((body: ApiResult<InquiryVO[]>) => {
        if (!cancelled && body?.code === 200 && Array.isArray(body.data)) setRows(body.data)
      })
      .catch(() => { /* 计入"未接入/无数据"，不编数字 */ })
    return () => { cancelled = true }
  }, [])
  return rows
}

export function useEvaluations(params: { evaluatorId?: number; evaluateeId?: number }): {
  rows: EvaluationVO[]
  loading: boolean
  error: string
} {
  const { evaluatorId, evaluateeId } = params
  const [rows, setRows] = useState<EvaluationVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!evaluatorId && !evaluateeId) { setRows([]); return }
    let cancelled = false
    setLoading(true)
    getEvaluationList({
      pageNum: 1,
      pageSize: 100,
      evaluatorId: evaluatorId ? String(evaluatorId) : undefined,
      evaluateeId: evaluateeId ? String(evaluateeId) : undefined,
    })
      .then((body: ApiResult<PageResult<EvaluationVO>>) => {
        if (cancelled) return
        const result = pageOf(body)
        setRows(result.rows)
        setError(result.error ?? '')
      })
      .catch(() => { if (!cancelled) setError('加载评价失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [evaluatorId, evaluateeId])
  return { rows, loading, error }
}

export function useDisputes(): { rows: DisputeVO[]; loading: boolean; error: string } {
  const [rows, setRows] = useState<DisputeVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDisputeList({ pageNum: 1, pageSize: 100 })
      .then((body: ApiResult<PageResult<DisputeVO>>) => {
        if (cancelled) return
        const result = pageOf(body)
        setRows(result.rows)
        setError(result.error ?? '')
      })
      .catch(() => { if (!cancelled) setError('加载售后工单失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { rows, loading, error }
}

export function useProducts(sellerId: number | null): {
  rows: TradeProductVO[]
  loading: boolean
  error: string
} {
  const [rows, setRows] = useState<TradeProductVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!sellerId) { setRows([]); return }
    let cancelled = false
    setLoading(true)
    getProductList({ pageNum: 1, pageSize: 100, sellerId })
      .then((body: ApiResult<PageResult<TradeProductVO>>) => {
        if (cancelled) return
        const result = pageOf(body)
        setRows(result.rows)
        setError(result.error ?? '')
      })
      .catch(() => { if (!cancelled) setError('加载商品失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sellerId])
  return { rows, loading, error }
}

export function useLogistics(): { rows: LogisticsVO[]; loading: boolean; error: string } {
  const [rows, setRows] = useState<LogisticsVO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLogisticsList({ pageNum: 1, pageSize: 100 })
      .then((body: ApiResult<PageResult<LogisticsVO>>) => {
        if (cancelled) return
        const result = pageOf(body)
        setRows(result.rows)
        setError(result.error ?? '')
      })
      .catch(() => { if (!cancelled) setError('加载物流单失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { rows, loading, error }
}

export function useGuarantees(): GuaranteeRow[] {
  const [rows, setRows] = useState<GuaranteeRow[]>([])
  const load = useCallback(() => {
    getMyGuarantees()
      .then((body: ApiResult<GuaranteeRow[]>) => {
        if (body?.code === 200 && Array.isArray(body.data)) setRows(body.data)
      })
      .catch(() => { /* 空列表 + 页面说明 */ })
  }, [])
  useEffect(() => { load() }, [load])
  return rows
}

