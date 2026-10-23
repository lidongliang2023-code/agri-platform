import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Form, Input, Modal, Select, message } from 'antd'
import {
  AlertOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HeartOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  TruckOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { confirmReceipt, getMyRefunds, type RefundRow } from '@/api/order'
import { acceptQuote, convertQuoteToOrder, getQuoteList, type QuoteVO } from '@/api/quote'
import { applyInvoice, getMyInvoices, type InvoiceRow } from '@/api/invoice'
import ContractList from '@/pages/contract/list'
import DisputeList from '@/pages/dispute/list'
import LogisticsList from '@/pages/logistics/list'
import MyCompensation from '@/pages/mine-compensation'
import MyGuarantee from '@/pages/mine-guarantee'
import DemandCreate from '@/pages/demand/create'
import { MemberCenterShell, type MemberNavItem } from './MemberCenterShell'
import './buyer-center.css'
import {
  EmptyState,
  Panel,
  StatusTag,
  money,
  shortDate,
  useDemands,
  useDisputes,
  useEvaluations,
  useGuarantees,
  useMemberBase,
  useMyInquiryRows,
  useOrders,
  type OrderRow,
} from './shared'

const NAV: MemberNavItem[] = [
  { key: 'overview', label: '首页概览', icon: <HomeOutlined /> },
  { key: 'publish', label: '发布采购需求', icon: <FileTextOutlined /> },
  { key: 'purchase', label: '采购订单', icon: <ShoppingCartOutlined /> },
  { key: 'inquiry', label: '我的询价', icon: <FileSearchOutlined /> },
  { key: 'after', label: '收货与售后', icon: <TruckOutlined /> },
  { key: 'rate', label: '采购评价', icon: <StarOutlined /> },
  { key: 'contract', label: '合同管理', icon: <FileTextOutlined /> },
  { key: 'fund', label: '资金与发票', icon: <DollarOutlined /> },
  { key: 'favorite', label: '收藏与关注', icon: <HeartOutlined /> },
]

const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`

const BUYER_STATUS = [
  { value: '', label: '全部' },
  { value: 'pending_confirm', label: '待付款' },
  { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '待收货' },
  { value: 'received', label: '已收货' },
  { value: 'refunding', label: '退款中' },
  { value: 'refunded', label: '已退款' },
  { value: 'completed', label: '已完成' },
]

const REFUND_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待审核', tone: 'amber' },
  approved: { text: '已退款', tone: 'green' },
  rejected: { text: '已驳回', tone: 'red' },
  cancelled: { text: '已撤销', tone: 'ghost' },
}

export default function BuyerCenter(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const active = params.get('tab') || 'overview'
  const setActive = (key: string): void => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    setParams(next, { replace: true })
  }

  const base = useMemberBase()
  useEffect(() => {
    if (active === 'profile') window.location.replace(PERSONAL_CENTER)
  }, [active])
  // 同一账号可能同时绑定多个主体：买家中心优先用 buyer 角色的主体展示与筛选需求。
  const buyerMerchant = base.merchants.find((item) => item.roleInMerchant === 'buyer') ?? base.primary
  const buyerId = buyerMerchant ? String(buyerMerchant.merchantId) : null
  const allOrders = useOrders('buyer', '', 1, 100)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pagedOrders = useOrders('buyer', status, page, 10)
  const demands = useDemands(buyerId)
  const inquiries = useMyInquiryRows()
  const disputes = useDisputes()
  const evaluations = useEvaluations({ evaluatorId: buyerId ?? undefined })
  const guarantees = useGuarantees()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [quotes, setQuotes] = useState<QuoteVO[]>([])
  const [refunds, setRefunds] = useState<RefundRow[]>([])
  const [quoteBusy, setQuoteBusy] = useState<number | null>(null)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false)
  const [invoiceForm] = Form.useForm<{ orderId: number; invoiceType: string; title: string; taxNo?: string; remark?: string }>()

  const loadInvoices = useCallback(() => {
    getMyInvoices()
      .then((body) => {
        if (body?.code === 200) setInvoices(Array.isArray(body.data) ? body.data : [])
      })
      .catch(() => { /* 页面显示未接入/重试提示 */ })
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const loadQuotes = useCallback(() => {
    if (!buyerId) {
      setQuotes([])
      return
    }
    getQuoteList({ pageNum: 1, pageSize: 100, buyerId })
      .then((body: { code: number; data?: { records?: QuoteVO[] } }) => {
        if (body?.code === 200) setQuotes(body.data?.records ?? [])
      })
      .catch(() => setQuotes([]))
  }, [buyerId])

  const loadRefunds = useCallback(() => {
    getMyRefunds()
      .then((body: { code: number; data?: RefundRow[] }) => {
        if (body?.code === 200) setRefunds(Array.isArray(body.data) ? body.data : [])
      })
      .catch(() => setRefunds([]))
  }, [])

  useEffect(() => {
    loadQuotes()
  }, [loadQuotes])

  useEffect(() => {
    loadRefunds()
  }, [loadRefunds])

  useEffect(() => {
    setPage(1)
  }, [status])

  const orderStats = useMemo(() => {
    const rows = allOrders.rows
    const evaluated = new Set(evaluations.rows.map((item) => item.orderId))
    return {
      pendingPay: rows.filter((item) => item.orderStatus === 'pending' || item.orderStatus === 'pending_confirm').length,
      pendingShip: rows.filter((item) => item.orderStatus === 'paid').length,
      pendingReceive: rows.filter((item) => item.orderStatus === 'shipped').length,
      pendingRate: rows.filter((item) =>
        ['received', 'completed'].includes(item.orderStatus) && !evaluated.has(item.id)).length,
    }
  }, [allOrders.rows, evaluations.rows])

  const guaranteeTotal = guarantees.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0)
  const guaranteeAvailable = guarantees.reduce((sum, item) => sum + Number(item.availableAmount ?? 0), 0)
  const guaranteeFrozen = guarantees.reduce((sum, item) => sum + Number(item.frozenAmount ?? 0), 0)

  const myDisputes = disputes.rows.filter((item) => base.merchantIds.includes(String(item.complainantId)))
  const evaluatedOrderIds = new Set(evaluations.rows.map((item) => item.orderId))
  const pendingEvaluations = allOrders.rows.filter((item) =>
    ['received', 'completed'].includes(item.orderStatus) && !evaluatedOrderIds.has(item.id))
  const invoicedOrderIds = new Set(invoices.map((item) => item.orderId))
  const eligibleInvoiceOrders = allOrders.rows.filter((item) =>
    ['paid', 'shipped', 'received', 'completed'].includes(item.orderStatus) && !invoicedOrderIds.has(item.id))

  const openInvoice = (): void => {
    setInvoiceOpen(true)
  }

  const submitInvoice = async (): Promise<void> => {
    try {
      const values = await invoiceForm.validateFields()
      setInvoiceSubmitting(true)
      const body = await applyInvoice(values)
      if (body?.code === 200) {
        message.success('开票申请已提交')
        setInvoiceOpen(false)
        loadInvoices()
      } else {
        message.error(body?.message ?? '提交开票申请失败')
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error('提交开票申请失败（请检查后端是否在运行）')
    } finally {
      setInvoiceSubmitting(false)
    }
  }

  const confirmReceive = (order: OrderRow): void => {
    Modal.confirm({
      title: '确认已收到货物？',
      content: `订单 ${order.orderNo} · ${order.productName}。确认后订单将进入已完成状态。`,
      okText: '确认收货',
      cancelText: '取消',
      onOk: async () => {
        try {
          const body = await confirmReceipt(order.id, { signReceiver: order.buyerName })
          if (body?.code === 200) {
            message.success('已确认收货，订单进入售后与评价阶段')
            allOrders.reload()
            pagedOrders.reload()
          } else {
            message.error(body?.message ?? '确认收货失败')
          }
        } catch {
          message.error('确认收货失败（请检查后端是否在运行）')
        }
      },
    })
  }

  const orderActions = (order: OrderRow): JSX.Element => (
    <div className="mc-actions">
      <a className="mc-link" href={`/order/detail/${order.id}`}>查看详情</a>
      {order.orderStatus === 'shipped' && (
        <button type="button" className="mc-link" onClick={() => confirmReceive(order)}>确认收货</button>
      )}
      {['received', 'completed'].includes(order.orderStatus) && !evaluatedOrderIds.has(order.id) && (
        <a className="mc-link" href="/evaluation">去评价</a>
      )}
    </div>
  )

  const acceptBuyerQuote = async (quote: QuoteVO): Promise<void> => {
    setQuoteBusy(quote.id)
    try {
      const accepted = await acceptQuote(quote.id)
      if (accepted?.code !== 200) {
        message.error(accepted?.message ?? '接受报价失败')
        return
      }
      // accept 接口已完成受理与成单；convert 接口在这里作为幂等取订单入口。
      const converted = await convertQuoteToOrder(quote.id)
      if (converted?.code === 200 && converted.data?.id) {
        message.success('已接受报价并生成采购订单')
        loadQuotes()
        demands.reload()
        inquiries.reload()
        allOrders.reload()
        pagedOrders.reload()
        navigate(`/order/confirm?orderId=${converted.data.id}`)
      } else {
        message.error(converted?.message ?? '报价已受理，但生成订单失败')
      }
    } catch {
      message.error('接受报价失败（请检查后端是否在运行）')
    } finally {
      setQuoteBusy(null)
    }
  }

  const renderOverview = (): JSX.Element => (
    <div className="buyer-overview">
      <section className="buyer-overview-hero">
        <span className="buyer-overview-icon"><ShoppingCartOutlined /></span>
        <div className="buyer-overview-title">
          <small>BUYER PROCUREMENT CENTER</small>
          <h2>采购工作台</h2>
          <p>{buyerMerchant?.merchantName || '当前采购主体'} · 从需求发布到收货开票，进度统一跟踪</p>
        </div>
        <div className="buyer-overview-figures">
          <div><span>累计采购额</span><strong>{money(base.dashboard?.buyer?.totalSpent ?? 0)}</strong></div>
          <div><span>今日采购额</span><strong>{money(base.dashboard?.buyer?.todaySpent ?? 0)}</strong></div>
          <div><span>可用保证金</span><strong>{money(guaranteeAvailable)}</strong></div>
        </div>
        <div className="buyer-overview-actions">
          <button type="button" className="mc-btn" onClick={() => setActive('publish')}>
            <SendOutlined /> 发起采购
          </button>
          <a className="mc-btn ghost" href="/hall">交易大厅 <ArrowRightOutlined /></a>
        </div>
      </section>

      <section className="buyer-task-grid">
        {[
          { label: '待付款', value: orderStats.pendingPay, tone: 'amber', icon: <WalletOutlined />, desc: '完成支付后进入履约', status: 'pending_confirm' },
          { label: '待发货', value: orderStats.pendingShip, tone: 'tech', icon: <ClockCircleOutlined />, desc: '供应方正在备货', status: 'paid' },
          { label: '待收货', value: orderStats.pendingReceive, tone: 'tech', icon: <TruckOutlined />, desc: '物流运输与签收', status: 'shipped' },
          { label: '待评价', value: orderStats.pendingRate, tone: 'green', icon: <StarOutlined />, desc: '收货后评价供应商', status: 'received' },
        ].map((item) => (
          <button type="button" className={`buyer-task ${item.tone}`} key={item.label}
            onClick={() => {
              setStatus(item.status)
              setActive('purchase')
            }}>
            <span className="buyer-task-icon">{item.icon}</span>
            <span><small>{item.label}</small><strong>{item.value}<em>笔</em></strong><i>{item.desc}</i></span>
            <ArrowRightOutlined />
          </button>
        ))}
      </section>

      <div className="buyer-overview-layout">
        <div className="buyer-overview-main">
          <Panel title="最近采购订单" extra={
            <button type="button" className="mc-link" onClick={() => setActive('purchase')}>
              查看全部订单 <ArrowRightOutlined />
            </button>
          }>
            {renderOrdersTable(allOrders.rows.slice(0, 5), allOrders.loading, allOrders.error, orderActions)}
          </Panel>

          <Panel title="询价与报价进展" extra={
            <button type="button" className="mc-link" onClick={() => setActive('inquiry')}>
              进入我的询价 <ArrowRightOutlined />
            </button>
          }>
            {quotes.length === 0 && demands.rows.length === 0 ? (
              <EmptyState title="还没有采购需求或报价" desc="先发布采购需求，平台会辅助匹配供应商并接收正式报价。"
                action={<button type="button" className="mc-btn" onClick={() => setActive('publish')}>发布采购需求</button>} />
            ) : (
              <div className="buyer-overview-pipeline">
                <div className="buyer-pipeline-stat">
                  <span className="buyer-pipeline-icon"><FileTextOutlined /></span>
                  <div><small>采购需求</small><strong>{demands.rows.length}</strong><em>需求持续撮合中</em></div>
                </div>
                <div className="buyer-pipeline-stat">
                  <span className="buyer-pipeline-icon tech"><FileSearchOutlined /></span>
                  <div><small>询价单</small><strong>{inquiries.rows.length}</strong><em>等待供应商响应</em></div>
                </div>
                <div className="buyer-pipeline-stat">
                  <span className="buyer-pipeline-icon amber"><CheckCircleFilled /></span>
                  <div><small>待受理报价</small><strong>{quotes.filter((quote) => quote.quoteStatus === 'pending').length}</strong><em>比较后可直接成单</em></div>
                </div>
                <div className="buyer-pipeline-stat">
                  <span className="buyer-pipeline-icon green"><StarOutlined /></span>
                  <div><small>待评价交易</small><strong>{pendingEvaluations.length}</strong><em>评价供应方服务</em></div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <aside className="buyer-overview-aside">
          <Panel title="资金账户" extra={<a className="mc-link" href="/my-guarantee">账户明细</a>}>
            <div className="buyer-funds">
              <div><span>可用保证金</span><strong>{money(guaranteeAvailable)}</strong></div>
              <div><span>冻结金额</span><strong>{money(guaranteeFrozen)}</strong></div>
              <div><span>保证金总额</span><strong>{money(guaranteeTotal)}</strong></div>
            </div>
            <div className="buyer-funds-foot">
              <DollarOutlined />
              <span>订单按规则占用保证金，完成后自动释放。</span>
            </div>
          </Panel>

          <Panel title="快捷入口">
            <div className="buyer-quick-list">
              {[
                { icon: <SendOutlined />, title: '发布采购需求', desc: '创建新的采购任务', tab: 'publish' },
                { icon: <FileSearchOutlined />, title: '我的询价', desc: '查看报价与议价进展', tab: 'inquiry' },
                { icon: <TruckOutlined />, title: '收货与售后', desc: '物流、退款与纠纷处理', tab: 'after' },
                { icon: <DollarOutlined />, title: '资金与发票', desc: '保证金、发票与赔付', tab: 'fund' },
              ].map((item) => (
                <button type="button" key={item.title} onClick={() => setActive(item.tab)}>
                  <span>{item.icon}</span>
                  <div><strong>{item.title}</strong><small>{item.desc}</small></div>
                  <ArrowRightOutlined />
                </button>
              ))}
            </div>
          </Panel>

          <div className="buyer-trust-card">
            <SafetyCertificateOutlined />
            <div><strong>平台交易保障</strong><span>合同签署、支付、物流和售后全程留痕。</span></div>
          </div>
        </aside>
      </div>
    </div>
  )

  const renderPurchase = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-label">状态</span>
        <div className="mc-chips">
          {BUYER_STATUS.map((item) => (
            <button type="button" key={item.value} className={status === item.value ? 'on' : ''}
              onClick={() => setStatus(item.value)}>{item.label}</button>
          ))}
        </div>
        <span className="mc-spacer" />
        <button type="button" className="mc-btn ghost" onClick={() => setActive('publish')}>发起新采购</button>
      </div>
      <Panel>
        {renderOrdersTable(pagedOrders.rows, pagedOrders.loading, pagedOrders.error, orderActions)}
        <div className="mc-pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>第 {page} / {Math.max(1, Math.ceil(pagedOrders.total / 10))} 页 · 共 {pagedOrders.total} 笔</span>
          <button type="button" disabled={page >= Math.ceil(pagedOrders.total / 10)} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      </Panel>
    </>
  )

  const renderInquiry = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">我发布的采购需求 · 供应方报价进展</span>
        <span className="mc-spacer" />
        <button type="button" className="mc-btn" onClick={() => setActive('publish')}>发布新采购需求</button>
      </div>
      <Panel title="采购需求">
        {demands.rows.length === 0 ? (
          <EmptyState title="还没有采购需求" desc="发布需求后，供应方的报价会汇总到这里。"
            action={<button type="button" className="mc-btn" onClick={() => setActive('publish')}>发布采购需求</button>} />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>需求编号</th><th>需求名称</th><th>品类 / 品种</th><th>采购量</th><th>期望价</th><th>报价数</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                {demands.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.demandNo}</td>
                    <td>{row.demandName || '—'}</td>
                    <td>{row.categoryName ?? '—'} / {row.variety ?? '—'}</td>
                    <td className="mc-mono">{row.quantity ?? '—'}</td>
                    <td className="mc-mono">{row.priceMin != null || row.priceMax != null
                      ? `${row.priceMin ?? '—'} ~ ${row.priceMax ?? '—'}` : '—'}</td>
                    <td className="mc-mono">{row.responseCount ?? 0}</td>
                    <td><span className="mc-tag tech">{demandStatusText(row.demandStatus)}</span></td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                    <td><a className="mc-link" href={`/demand/detail/${row.id}`}>查看</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="货源询价进展">
        {inquiries.rows.length === 0 ? (
          <EmptyState title="还没有询价单" desc="在交易大厅对货源发起询价后，会在这里跟踪报价与议价进展。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>询价单号</th><th>商品</th><th>供应方</th><th>数量</th><th>报价数</th><th>截止时间</th><th>状态</th></tr></thead>
              <tbody>
                {inquiries.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.inquiryNo}</td>
                    <td>{row.productName}</td>
                    <td>{row.sellerName}</td>
                    <td className="mc-mono">{row.quantity} {row.unit}</td>
                    <td className="mc-mono">{row.replyCount ?? 0}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.replyDeadline)}</td>
                    <td><span className="mc-tag tech">{row.inquiryStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="供应商报价">
        {quotes.length === 0 ? (
          <EmptyState title="还没有供应商报价" desc="询价发起后，供应方提交的报价会在这里显示，可直接受理并生成采购订单。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>报价单号</th><th>供应商</th><th>商品</th><th>单价</th><th>数量</th><th>运费</th><th>总价</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td className="mc-mono">{quote.quoteNo}</td>
                    <td>{quote.sellerName ?? '—'}</td>
                    <td>{quote.productName ?? '—'}</td>
                    <td className="mc-price">{money(quote.unitPrice)}</td>
                    <td className="mc-mono">{quote.quantity} {quote.unit ?? ''}</td>
                    <td className="mc-price">{money(quote.freightAmount ?? 0)}</td>
                    <td className="mc-price">{money(quote.totalAmount)}</td>
                    <td>
                      <span className={`mc-tag ${quote.quoteStatus === 'pending' ? 'amber' : quote.quoteStatus === 'rejected' ? 'red' : 'green'}`}>
                        {quote.quoteStatus === 'pending' ? '待受理' : quote.quoteStatus === 'accepted' ? '已受理' : quote.quoteStatus === 'rejected' ? '已拒绝' : quote.quoteStatus}
                      </span>
                    </td>
                    <td>
                      {quote.quoteStatus === 'pending' ? (
                        <button type="button" className="mc-link" disabled={quoteBusy === quote.id}
                          onClick={() => void acceptBuyerQuote(quote)}>
                          {quoteBusy === quote.id ? '处理中…' : '接受并生成订单'}
                        </button>
                      ) : quote.orderId ? (
                        <a className="mc-link" href={`/order/detail/${quote.orderId}`}>查看订单</a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderAfter = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">售后申请 · 退换货 · 质量申诉 · 平台仲裁</span>
        <span className="mc-spacer" />
        <a className="mc-btn ghost" href="/dispute">发起 / 查看售后工单</a>
      </div>
      <Panel title="售后与争议工单">
        {myDisputes.length === 0 ? (
          <EmptyState title="没有进行中的售后工单" desc="从订单详情或纠纷管理发起售后，工单会在这里汇总。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>工单号</th><th>关联订单</th><th>类型</th><th>问题描述</th><th>状态</th><th>提交时间</th></tr></thead>
              <tbody>
                {myDisputes.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.disputeNo}</td>
                    <td className="mc-mono">{row.orderId}</td>
                    <td>{row.disputeType ?? '—'}</td>
                    <td className="mc-wrap-text">{row.disputeDescription ?? row.disputeReason ?? '—'}</td>
                    <td><span className="mc-tag amber">{row.disputeStatus ?? '处理中'}</span></td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="退款与售后进度">
        {refunds.length === 0 ? (
          <EmptyState title="暂无退款记录" desc="收货后如遇质量问题，可从订单详情发起退货退款；审核进度会显示在这里。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>退款单号</th><th>订单号</th><th>类型</th><th>退款金额</th><th>原因</th><th>状态</th><th>审核意见</th><th>申请时间</th></tr></thead>
              <tbody>
                {refunds.map((row) => {
                  const status = REFUND_STATUS[row.refundStatus] ?? { text: row.refundStatus, tone: 'ghost' }
                  return (
                    <tr key={row.id}>
                      <td className="mc-mono">{row.refundNo}</td>
                      <td className="mc-mono">{row.orderNo}</td>
                      <td>{row.refundType === 'return_refund' ? '退货退款' : row.refundType === 'refund_only' ? '仅退款' : row.refundType}</td>
                      <td className="mc-price">{money(row.refundAmount)}</td>
                      <td className="mc-wrap-text">{row.refundReason ?? '—'}</td>
                      <td><span className={`mc-tag ${status.tone}`}>{status.text}</span></td>
                      <td className="mc-wrap-text">{row.reviewRemark ?? '—'}</td>
                      <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="mc-embedded"><DisputeList /></div>
      <div className="mc-embedded"><LogisticsList /></div>
    </>
  )

  const renderRate = (): JSX.Element => (
    <div className="buyer-workspace buyer-rating-workspace">
      <section className="buyer-workspace-hero">
        <span className="buyer-workspace-icon"><StarOutlined /></span>
        <div><small>PURCHASE REVIEWS</small><h2>采购评价</h2><p>记录真实采购体验，帮助平台沉淀供应商服务与履约质量。</p></div>
        <div className="buyer-workspace-stats">
          <div><span>待评价</span><strong>{pendingEvaluations.length}</strong></div>
          <div><span>已评价</span><strong>{evaluations.rows.length}</strong></div>
          <div><span>平均评分</span><strong>{evaluations.rows.length
            ? (evaluations.rows.reduce((sum, item) => sum + Number(item.ratingOverall ?? 0), 0) / evaluations.rows.length).toFixed(1)
            : '—'}</strong></div>
        </div>
      </section>
      <div className="buyer-rating-layout">
        <div className="buyer-workspace-main">
          <Panel title={`待评价订单（${pendingEvaluations.length}）`} extra={<span className="buyer-section-note">收货后可评价供应方</span>}>
            {pendingEvaluations.length === 0 ? (
              <EmptyState title="没有待评价订单" desc="订单收货后可以评价供应方，评价会公开展示。" />
            ) : (
              <div className="buyer-review-pending-list">
                {pendingEvaluations.map((order) => (
                  <div className="buyer-review-pending" key={order.id}>
                    <span className="buyer-review-order-icon"><ShoppingCartOutlined /></span>
                    <div><small>{order.orderNo}</small><strong>{order.productName || order.categoryName || '采购商品'}</strong><p>{order.sellerName || '供应商'} · {money(order.totalAmount)}</p></div>
                    <span className="mc-tag green">已收货</span>
                    <a className="mc-btn" href={`/order/detail/${order.id}`}>去评价 <ArrowRightOutlined /></a>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title={`我发出的评价（${evaluations.rows.length}）`} extra={<span className="buyer-section-note">按时间倒序</span>}>
            {evaluations.rows.length === 0 ? (
              <EmptyState title="还没有评价记录" desc="完成订单后可对供应方进行评价。" />
            ) : (
              <div className="buyer-review-grid">
                {evaluations.rows.map((row) => (
                  <div className="buyer-review-card" key={row.id}>
                    <div className="buyer-review-head">
                      <span>{row.evaluateeName?.slice(0, 1) || '供'}</span>
                      <div><strong>{row.evaluateeName || '供应方'}</strong><small>订单 {row.orderId} · {shortDate(row.createTime)}</small></div>
                      <em>{'★'.repeat(Math.round(row.ratingOverall))}</em>
                    </div>
                    <p>{row.evaluationContent || '未填写文字评价'}</p>
                    {row.replyContent && <div className="buyer-review-reply">供应商回复：{row.replyContent}</div>}
                    <div><span className="mc-tag green">{row.ratingOverall} 分</span><span className="mc-tag ghost">真实采购评价</span></div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <aside className="buyer-workspace-aside">
          <Panel title="评价说明">
            <ul className="buyer-workspace-guide">
              <li><CheckCircleFilled /> 只有当前采购主体参与的已收货订单可以评价。</li>
              <li><StarOutlined /> 每个采购主体对同一订单只能评价一次。</li>
              <li><SafetyCertificateOutlined /> 评价会公开用于供应商信用展示。</li>
            </ul>
          </Panel>
          <div className="buyer-workspace-trust">
            <SafetyCertificateOutlined />
            <div><strong>真实交易评价</strong><span>评分和内容均绑定真实订单，不展示模拟评价。</span></div>
          </div>
        </aside>
      </div>
    </div>
  )

  const renderContract = (): JSX.Element => (
    <div className="mc-embedded mc-embedded-first"><ContractList /></div>
  )

  const renderFund = (): JSX.Element => (
    <div className="buyer-workspace buyer-fund-workspace">
      <section className="buyer-workspace-hero">
        <span className="buyer-workspace-icon"><WalletOutlined /></span>
        <div><small>FUNDS & INVOICES</small><h2>资金与发票</h2><p>查看采购支出、保证金、赔付到账与发票申请状态。</p></div>
        <div className="buyer-workspace-stats">
          <div><span>累计采购</span><strong>{money(base.dashboard?.buyer?.totalSpent ?? 0)}</strong></div>
          <div><span>可用保证金</span><strong>{money(guaranteeAvailable)}</strong></div>
          <div><span>发票申请</span><strong>{invoices.length}</strong></div>
        </div>
      </section>
      <div className="buyer-finance-metrics">
        <div><span>累计采购支出</span><strong>{money(base.dashboard?.buyer?.totalSpent ?? 0)}</strong><small>不含已取消订单</small></div>
        <div><span>平均客单价</span><strong>{money(base.dashboard?.buyer?.avgOrderValue ?? 0)}</strong><small>按真实采购订单</small></div>
        <div><span>冻结保证金</span><strong>{money(guaranteeFrozen)}</strong><small>在途订单占用</small></div>
        <div><span>待开票申请</span><strong>{invoices.filter((item) => item.invoiceStatus === 'pending').length}<em>笔</em></strong><small>已付款订单可申请</small></div>
      </div>

      <Panel title={`发票申请与记录（${invoices.length}）`} extra={
        <button type="button" className="mc-btn" onClick={openInvoice} disabled={eligibleInvoiceOrders.length === 0}>
          申请开票
        </button>
      }>
        {invoices.length === 0 ? (
          <EmptyState title="还没有开票申请" desc={eligibleInvoiceOrders.length ? '选择一笔已付款订单申请开票。' : '暂无可开票订单。'}
            action={eligibleInvoiceOrders.length ? <button type="button" className="mc-btn" onClick={openInvoice}>申请开票</button> : undefined} />
        ) : (
          <div className="buyer-invoice-list">
            {invoices.map((row) => (
              <div className="buyer-invoice-card" key={row.id}>
                <span className="buyer-invoice-icon"><FileTextOutlined /></span>
                <div><small>{row.invoiceNo}</small><strong>{row.title}</strong><p>{row.orderNo} · {row.invoiceType}</p></div>
                <div><span>开票金额</span><strong>{money(row.amount)}</strong></div>
                <span className={`mc-tag ${row.invoiceStatus === 'issued' ? 'green' : row.invoiceStatus === 'rejected' ? 'red' : 'amber'}`}>{invoiceStatusText(row.invoiceStatus)}</span>
                <time>{shortDate(row.applyTime)}</time>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="buyer-finance-subpage">
        <div className="buyer-finance-subhead"><strong>保证金账户</strong><span>交易保证金与资金流水</span></div>
        <MyGuarantee />
      </div>
      <div className="buyer-finance-subpage">
        <div className="buyer-finance-subhead"><strong>获赔记录</strong><span>平台赔付与到账状态</span></div>
        <MyCompensation />
      </div>

      <Modal title="申请开票" open={invoiceOpen} onCancel={() => setInvoiceOpen(false)}
        onOk={() => void submitInvoice()} confirmLoading={invoiceSubmitting} okText="提交申请" cancelText="取消"
        destroyOnClose afterOpenChange={(open) => {
          if (open) {
            invoiceForm.setFieldsValue({
              orderId: eligibleInvoiceOrders[0]?.id,
              invoiceType: '增值税专用发票',
              title: buyerMerchant?.merchantName ?? '',
              taxNo: '',
              remark: '',
            })
          }
        }}>
        <Form form={invoiceForm} layout="vertical" preserve={false}>
          <Form.Item name="orderId" label="采购订单" rules={[{ required: true, message: '请选择订单' }]}>
            <Select placeholder="选择已付款订单" options={eligibleInvoiceOrders.map((order) => ({
              value: order.id,
              label: `${order.orderNo} · ${order.productName || order.categoryName || '订单商品'} · ${money(order.totalAmount)}`,
            }))} />
          </Form.Item>
          <Form.Item name="invoiceType" label="发票类型" rules={[{ required: true, message: '请选择发票类型' }]}>
            <Select options={['增值税专用发票', '增值税普通发票', '电子普通发票'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="title" label="发票抬头" rules={[{ required: true, message: '请填写发票抬头' }]}>
            <Input placeholder="与企业营业执照一致" />
          </Form.Item>
          <Form.Item name="taxNo" label="纳税人识别号">
            <Input placeholder="统一社会信用代码" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )

  const renderFavorite = (): JSX.Element => (
    <Panel title="收藏与关注">
      <EmptyState title="收藏与关注尚未接入" desc="当前交易域没有收藏/关注接口。可以先到交易大厅浏览货源，后续接入后会在这里展示关注的供应商与商品。"
        action={<a className="mc-btn" href="/product">去交易大厅</a>} />
    </Panel>
  )

  const content = active === 'publish' ? <DemandCreate embedded />
    : active === 'purchase' ? renderPurchase()
      : active === 'inquiry' ? renderInquiry()
      : active === 'after' ? renderAfter()
        : active === 'rate' ? renderRate()
          : active === 'contract' ? renderContract()
            : active === 'fund' ? renderFund()
              : active === 'favorite' ? renderFavorite()
                  : renderOverview()

  return (
    <MemberCenterShell role="buyer" active={active} navItems={NAV}
      merchantName={buyerMerchant?.merchantName ?? ''} onNavigate={setActive}>
      {base.loading && <div className="mc-loading">正在加载会员数据…</div>}
      {base.error && <div className="mc-alert"><AlertOutlined />{base.error}</div>}
      {content}
    </MemberCenterShell>
  )
}

function renderOrdersTable(
  rows: OrderRow[],
  loading: boolean,
  error: string,
  actions: (order: OrderRow) => JSX.Element,
): JSX.Element {
  if (loading) return <div className="mc-loading">加载订单中…</div>
  if (error) return <div className="mc-alert">{error}</div>
  if (rows.length === 0) return <EmptyState title="还没有采购订单" desc="在交易大厅选择货源下单后，订单会出现在这里。" />
  return (
    <div className="mc-table-wrap">
      <table className="mc-table">
        <thead>
          <tr><th>订单号</th><th>商品</th><th>数量</th><th>金额</th><th>供应方</th><th>状态</th><th>下单时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td className="mc-mono">{order.orderNo}</td>
              <td>{order.productName || order.categoryName || '—'}</td>
              <td className="mc-mono">{order.totalQuantity ?? '—'}</td>
              <td className="mc-price">{money(order.totalAmount)}</td>
              <td>{order.sellerName ?? '—'}</td>
              <td><StatusTag status={order.orderStatus} side="buyer" /></td>
              <td className="mc-mono mc-xs">{shortDate(order.createTime)}</td>
              <td>{actions(order)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function demandStatusText(status: string | undefined): string {
  const map: Record<string, string> = {
    pending: '待匹配',
    matching: '匹配中',
    quoted: '报价中',
    completed: '已成交',
    closed: '已关闭',
  }
  return status ? map[status] ?? status : '—'
}

function invoiceStatusText(status: string): string {
  if (status === 'issued') return '已开票'
  if (status === 'rejected') return '已驳回'
  if (status === 'pending') return '待开票'
  return status
}
