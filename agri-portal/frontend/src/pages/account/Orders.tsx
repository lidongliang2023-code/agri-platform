/**
 * 用户中心 · 订单聚合
 *
 * <p><b>聚合的是"能可靠归属到当前账号"的订单，不是"平台所有订单"。</b>
 * 目前只接入交易域：`agri_trade_order` 有 buyer_id / seller_id（主体维度），
 * 且 `/api/trade/order/page` 会从令牌推导当前账号名下主体范围 —— 服务端不会相信前端传的范围。</p>
 *
 * <p>服务域与商城域**没有接入**，页面上会明确写出原因（表里没有账号归属字段 /
 * consumer_id 与平台账号未打通）。宁可少聚合一个域，也不能给出一份归属不明的订单列表。</p>
 *
 * <p>订单明细由前端直接调交易域接口，不经过用户中心转发 —— 中间层一旦做聚合查询，
 * 就很容易变成"谁的都能查"。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'
import { getPlatformAccessToken } from '../../utils/platformToken'

interface OrderSource {
  code: string
  name: string
  enabled: boolean
  endpoint: string | null
  description: string
  reason: string | null
}

interface StatusMeta {
  code: string
  label: string
}

interface TradeOrder {
  id: number
  orderNo: string
  buyerId: number | null
  buyerName: string | null
  sellerId: number | null
  sellerName: string | null
  productName: string | null
  categoryName: string | null
  totalAmount: number | null
  paidAmount: number | null
  paymentStatus: string | null
  orderStatus: string | null
  createTime: string | null
}

interface UnifiedOrder {
  source: string
  sourceLabel: string
  id: string
  orderNo: string
  counterparty: string
  side: 'buy' | 'sell' | 'unknown'
  productName: string
  amount: number
  status: string
  paymentStatus: string
  createTime: string
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

/**
 * 交易域的成功码是 **200**（不是平台侧的 0），这里两个都认。
 * 早先按 code===0 判会把正常响应当失败，页面一直空表。
 */
async function fetchJson<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(path, { credentials: 'include', headers })
  const body = (await response.json()) as ApiBody<T>
  const ok = body.code === 0 || body.code === 200
  if (!response.ok || !ok) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

/** 交易订单 → 统一结构；对手方按"我是买方还是卖方"取另一侧 */
function toUnified(order: TradeOrder, myMerchantIds: number[]): UnifiedOrder {
  const isBuyer = order.buyerId != null && myMerchantIds.includes(order.buyerId)
  const isSeller = order.sellerId != null && myMerchantIds.includes(order.sellerId)
  const side: UnifiedOrder['side'] = isBuyer ? 'buy' : isSeller ? 'sell' : 'unknown'
  return {
    source: 'trade',
    sourceLabel: '交易撮合',
    id: String(order.id),
    orderNo: order.orderNo ?? '',
    counterparty: (side === 'sell' ? order.buyerName : order.sellerName) ?? '—',
    side,
    productName: order.productName || order.categoryName || '—',
    amount: Number(order.totalAmount ?? 0),
    status: order.orderStatus ?? '',
    paymentStatus: order.paymentStatus ?? '',
    createTime: order.createTime ?? '',
  }
}

const SIDE_LABEL: Record<UnifiedOrder['side'], string> = {
  buy: '采购',
  sell: '销售',
  unknown: '—',
}

/**
 * 订单聚合页面
 *
 * @returns 页面内容
 */
export function Orders(): JSX.Element {
  const [sources, setSources] = useState<OrderSource[]>([])
  const [statuses, setStatuses] = useState<StatusMeta[]>([])
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [total, setTotal] = useState(0)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const meta = await fetchJson<{
        sources?: OrderSource[]
        statuses?: StatusMeta[]
      }>('/api/v1/sso/account/orders/sources')
      setSources(meta?.sources ?? [])
      setStatuses(meta?.statuses ?? [])

      /* 交易域接口要 Bearer：用 HttpOnly 刷新凭证换一枚，与消息中心同一套做法 */
      const token = await getPlatformAccessToken()
      const page = await fetchJson<{
        records?: TradeOrder[]
        total?: number | string
      }>('/api/trade/order/page?pageNum=1&pageSize=50', token)
      const records = page?.records ?? []
      setTotal(Number(page?.total ?? records.length))

      /* 判断"我是买方还是卖方"需要自己的主体 id，直接问交易域，不在前端猜 */
      let myMerchantIds: number[] = []
      try {
        const mine = await fetchJson<unknown>('/api/trade/identity/my-merchants', token)
        const list = Array.isArray(mine) ? mine : (mine as { list?: unknown[] })?.list ?? []
        myMerchantIds = (list as { merchantId?: number; id?: number }[])
          .map((row) => Number(row?.merchantId ?? row?.id ?? 0))
          .filter((id) => id > 0)
      } catch {
        /* 拿不到主体列表不影响列表展示，只是"采购/销售"标签会退化成「—」 */
      }
      if (myMerchantIds.length === 0 && records.length > 0) {
        setNotice('未能取到当前账号的经营主体，列表里的「采购/销售」方向可能显示为「—」')
      }
      setOrders(records.map((order) => toUnified(order, myMerchantIds)))
    } catch (e) {
      setError((e as Error).message || '订单加载失败')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const statusLabel = (code: string): string =>
    statuses.find((row) => row.code === code)?.label ?? code

  const visible = statusFilter === 'all'
    ? orders
    : orders.filter((row) => row.status === statusFilter)

  /** 各状态计数（基于已取回的一页数据，页面会注明口径） */
  const counts: Record<string, number> = {}
  for (const row of orders) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  const enabledSources = sources.filter((row) => row.enabled)
  const pendingSources = sources.filter((row) => !row.enabled)

  return (
    <div className="uc-ord">
      <div className="uc-ord-head">
        <div>
          <strong>
            共 {total} 笔订单 · 已接入 {enabledSources.length} 个来源
          </strong>
          <small>只聚合能可靠归属到当前账号的订单，归属范围由各域服务端自己判定</small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载订单…</div>}

      {!loading && !error && (
        <>
          <ul className="uc-ord-stats">
            {statuses.map((meta) => (
              <li
                key={meta.code}
                className={statusFilter === meta.code ? 'on' : ''}
                onClick={() => setStatusFilter(statusFilter === meta.code ? 'all' : meta.code)}
              >
                <span>{meta.label}</span>
                <strong>{counts[meta.code] ?? 0}</strong>
              </li>
            ))}
          </ul>

          {statusFilter !== 'all' && (
            <p className="uc-ord-filter">
              正在按「{statusLabel(statusFilter)}」筛选
              <button className="uc-ord-clear" onClick={() => setStatusFilter('all')}>
                清除
              </button>
            </p>
          )}

          {visible.length === 0 ? (
            <div className="card empty">
              {orders.length === 0
                ? '当前账号名下还没有订单。订单归属按经营主体判定，未绑定主体时不会显示任何单据。'
                : `没有「${statusLabel(statusFilter)}」状态的订单`}
            </div>
          ) : (
            <ul className="uc-ord-list">
              {visible.map((row) => (
                <li key={`${row.source}-${row.id}`}>
                  <div className="uc-ord-top">
                    <span className="uc-ord-source">{row.sourceLabel}</span>
                    <span className={`uc-ord-side ${row.side}`}>{SIDE_LABEL[row.side]}</span>
                    <strong className="uc-ord-no">{row.orderNo}</strong>
                    <span className={`uc-ord-status ${row.status}`}>{statusLabel(row.status)}</span>
                  </div>
                  <div className="uc-ord-body">
                    <span className="uc-ord-product">{row.productName}</span>
                    <span className="uc-ord-party">
                      {row.side === 'sell' ? '买方' : '卖方'}：{row.counterparty}
                    </span>
                    <span className="uc-ord-amount">¥{row.amount.toFixed(2)}</span>
                  </div>
                  <div className="uc-ord-meta">
                    <span>{row.createTime.replace('T', ' ').slice(0, 16)}</span>
                    <span>支付：{row.paymentStatus || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pendingSources.length > 0 && (
            <div className="uc-ord-pending">
              <strong>未纳入聚合的来源</strong>
              <ul>
                {pendingSources.map((row) => (
                  <li key={row.code}>
                    <Icon name="alert" size={12} />
                    <span className="uc-ord-pending-name">{row.name}</span>
                    <span className="uc-ord-pending-reason">{row.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="uc-ord-foot">
            说明：统计口径为已取回的一页数据（最多 50 笔），不是全量；订单明细以各域自己的页面为准。
          </p>
        </>
      )}
    </div>
  )
}
