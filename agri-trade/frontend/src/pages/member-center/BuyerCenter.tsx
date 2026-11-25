import type { TablePaginationConfig } from 'antd'
import { ListRowActions } from '@agri/shared'
import { TradeList, TradeFilters } from '@/components/TradeList'
import TradeAgentPanel from './TradeAgentPanel'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Form, Input, Modal, Select, message } from 'antd'
import {
  AlertOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CustomerServiceOutlined,
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
import { ShopChat } from '@/pages/shop/detail/ShopChat'
import {
  getFavoriteProducts,
  getFollowingSellers,
  unfavoriteProduct,
  unfollowSeller,
  type FavoriteProduct,
  type FollowingSeller,
} from '@/api/shop-interaction'
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
  { key: 'agent', label: '采购 Agent', icon: <FileTextOutlined />, group: '交易寻源' },
  { key: 'overview', label: '首页概览', icon: <HomeOutlined />, group: '交易寻源' },
  { key: 'demand-list', label: '采购需求', icon: <FileSearchOutlined />, group: '交易寻源' },
  { key: 'inquiry', label: '询价与报价', icon: <FileSearchOutlined />, group: '交易寻源' },
  { key: 'chat', label: '洽谈消息', icon: <CustomerServiceOutlined />, group: '交易寻源' },
  { key: 'purchase', label: '采购订单', icon: <ShoppingCartOutlined />, group: '订单履约' },
  { key: 'after', label: '收货与售后', icon: <TruckOutlined />, group: '订单履约' },
  { key: 'rate', label: '采购评价', icon: <StarOutlined />, group: '订单履约' },
  { key: 'contract', label: '合同管理', icon: <FileTextOutlined />, group: '资产与账务' },
  { key: 'fund', label: '资金与发票', icon: <DollarOutlined />, group: '资产与账务' },
  { key: 'favorite', label: '收藏与关注', icon: <HeartOutlined />, group: '资产与账务' },
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

const INQUIRY_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待报价', tone: 'amber' },
  pending_reply: { text: '待报价', tone: 'amber' },
  quoted: { text: '已报价', tone: 'tech' },
  converted: { text: '已转订单', tone: 'green' },
  closed: { text: '已关闭', tone: 'ghost' },
  expired: { text: '已过期', tone: 'ghost' },
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
  const [draftOrderStatus, setDraftOrderStatus] = useState('')
  const [demandKeyword, setDemandKeyword] = useState('')
  const [demandStatus, setDemandStatus] = useState('')
  const [draftDemandKeyword, setDraftDemandKeyword] = useState('')
  const [draftDemandStatus, setDraftDemandStatus] = useState('')
  const [demandPage, setDemandPage] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const pagedOrders = useOrders('buyer', status, page, pageSize)
  const demands = useDemands(buyerId)
  const inquiries = useMyInquiryRows()
  const disputes = useDisputes()
  const evaluations = useEvaluations({ evaluatorId: buyerId ?? undefined })
  const guarantees = useGuarantees()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [quotes, setQuotes] = useState<QuoteVO[]>([])
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null)
  const [refunds, setRefunds] = useState<RefundRow[]>([])
  const [quoteBusy, setQuoteBusy] = useState<number | null>(null)
  const [following, setFollowing] = useState<FollowingSeller[]>([])
  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteProduct[]>([])
  const [followingLoading, setFollowingLoading] = useState(false)
  const [followingBusy, setFollowingBusy] = useState<string | null>(null)
  const [chatTarget, setChatTarget] = useState<{
    sellerId: string
    sellerName: string
    productId: number | null
  } | null>(null)
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

  const loadFollowing = useCallback((): void => {
    setFollowingLoading(true)
    Promise.all([getFollowingSellers(), getFavoriteProducts()])
      .then(([followResult, productResult]) => {
        if (followResult.code === 200) setFollowing(followResult.data ?? [])
        if (productResult.code === 200) setFavoriteProducts(productResult.data ?? [])
      })
      .catch(() => {
        setFollowing([])
        setFavoriteProducts([])
      })
      .finally(() => setFollowingLoading(false))
  }, [])

  useEffect(() => {
    if (active === 'favorite') loadFollowing()
  }, [active, loadFollowing])


  useEffect(() => {
    if (active === 'demand-list') demands.reload()
  }, [active])

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
  const filteredDemands = useMemo(() => {
    const keyword = demandKeyword.trim().toLowerCase()
    return demands.rows.filter((row) =>
      (!demandStatus || row.demandStatus === demandStatus)
      && (!keyword || [row.demandNo, row.demandName, row.productName, row.categoryName, row.variety]
        .some((value) => String(value ?? '').toLowerCase().includes(keyword))))
  }, [demandKeyword, demandStatus, demands.rows])

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
    <ListRowActions>
      <a className="mc-link" href={`/order/detail/${order.id}`}>查看详情</a>
      {order.orderStatus === 'shipped' && (
        <button type="button" className="mc-link" onClick={() => confirmReceive(order)}>确认收货</button>
      )}
      {['received', 'completed'].includes(order.orderStatus) && !evaluatedOrderIds.has(order.id) && (
        <a className="mc-link" href="/evaluation">去评价</a>
      )}
    </ListRowActions>
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
              setDraftOrderStatus(item.status)
              setPage(1)
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
                { icon: <FileSearchOutlined />, title: '采购需求', desc: '查看需求、详情与撮合进度', tab: 'demand-list' },
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

  const renderDemandList = (): JSX.Element => (
    <div className="buyer-workspace buyer-demand-workspace">
      <section className="buyer-workspace-hero">
        <span className="buyer-workspace-icon"><FileSearchOutlined /></span>
        <div>
          <small>PURCHASE REQUESTS</small>
          <h2>采购需求</h2>
          <p>集中查看已发布的采购需求、撮合进度与供应商响应情况。</p>
        </div>
        <div className="buyer-workspace-stats">
          <div><span>需求总数</span><strong>{demands.rows.length}</strong></div>
          <div><span>报价中</span><strong>{demands.rows.filter((row) => row.demandStatus === 'quoted').length}</strong></div>
          <div><span>已成交</span><strong>{demands.rows.filter((row) => row.demandStatus === 'completed').length}</strong></div>
        </div>
      </section>

      <TradeList
            listId="buyer-demands"
            rowKey="id"
            dataSource={filteredDemands}
            onRefresh={demands.reload}
            loading={demands.loading}
            pagination={{ current: demandPage, onChange: setDemandPage }}
            filterSlot={<TradeFilters fields={[
              { label: '关键字', control: <Input allowClear value={draftDemandKeyword} onChange={(event) => setDraftDemandKeyword(event.target.value)} placeholder="需求编号、标题、品类或品种" /> },
              { label: '需求状态', control: <Select value={draftDemandStatus} onChange={setDraftDemandStatus} options={[
            { value: '', label: '全部状态' },
            { value: 'pending', label: '待匹配' },
            { value: 'matching', label: '匹配中' },
            { value: 'quoted', label: '报价中' },
            { value: 'completed', label: '已成交' },
            { value: 'closed', label: '已关闭' },
          ]} /> },
            ]} onQuery={() => { setDemandKeyword(draftDemandKeyword); setDemandStatus(draftDemandStatus); setDemandPage(1) }}
               onReset={() => { setDraftDemandKeyword(''); setDraftDemandStatus(''); setDemandKeyword(''); setDemandStatus(''); setDemandPage(1) }} />}
            toolbarLeft={<button type="button" className="mc-btn" onClick={() => setActive('publish')}><SendOutlined />发布采购需求</button>}
            locale={{ emptyText: <EmptyState title={demands.error || '没有符合条件的需求'} /> }}
            columns={[
              { title: "需求编号", key: 'col-1', width: 160, render: (_, row) => (<span className="mc-mono">{row.demandNo}</span>) },
              { title: "需求标题", key: 'col-2', width: 160, render: (_, row) => (<><strong className="buyer-demand-name">{row.demandName || row.productName || '—'}</strong></>) },
              { title: "品类 / 品种", key: 'col-3', width: 160, render: (_, row) => (<>{row.categoryName ?? '—'} / {row.variety ?? '—'}</>) },
              { title: "采购量", key: 'col-4', width: 160, render: (_, row) => (<span className="mc-mono">{row.quantity ?? '—'}</span>) },
              { title: "期望价", key: 'col-5', width: 160, render: (_, row) => (<span className="mc-mono">{row.priceMin != null || row.priceMax != null
                      ? `${row.priceMin ?? '—'} ~ ${row.priceMax ?? '—'}` : '—'}</span>) },
              { title: "报价数", key: 'col-6', width: 108, render: (_, row) => (<span className="mc-mono">{row.responseCount ?? 0}</span>) },
              { title: "状态", key: 'col-7', width: 108, render: (_, row) => (<><span className="mc-tag tech">{demandStatusText(row.demandStatus)}</span></>) },
              { title: "创建时间", key: 'col-8', width: 160, render: (_, row) => (<span className="mc-mono mc-xs">{shortDate(row.createTime)}</span>) },
              { title: "操作", key: 'action', width: 170, render: (_, row) => (<span className="buyer-demand-row-actions"><a className="mc-link" href={`/demand/detail/${row.id}`}>查看详情</a>
                      <button type="button" className="mc-link"
                        onClick={() => navigate(`/member/buyer?tab=publish&id=${row.id}`)}>编辑</button></span>) },
            ]}
          />
    </div>
  )

  const renderPurchase = (): JSX.Element => (
    renderOrdersTable(pagedOrders.rows, pagedOrders.loading, pagedOrders.error, orderActions, {
      onRefresh: pagedOrders.reload,
      filterSlot: <TradeFilters fields={[
        { label: '订单状态', control: <Select value={draftOrderStatus} onChange={setDraftOrderStatus} options={BUYER_STATUS} /> },
      ]} onQuery={() => { setStatus(draftOrderStatus); setPage(1) }}
         onReset={() => { setDraftOrderStatus(''); setStatus(''); setPage(1) }} />,
      toolbarLeft: <><button type="button" className="mc-btn" onClick={() => navigate('/order/create')}>创建采购订单</button><button type="button" className="mc-btn ghost" onClick={() => setActive('publish')}>发布采购需求</button></>,
      pagination: { current: page, pageSize, total: pagedOrders.total, onChange: (nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize) } },
    })
  )

  const renderInquiry = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">货源询价、供应方报价与议价进展</span>
        <span className="mc-spacer" />
        <button type="button" className="mc-btn ghost" onClick={() => setActive('demand-list')}>查看采购需求</button>
        <a className="mc-btn" href="/hall">去交易大厅询价</a>
      </div>
      <Panel title="货源询价进展">
        {inquiries.rows.length === 0 ? (
          <EmptyState title="还没有询价单" desc="在交易大厅对货源发起询价后，会在这里跟踪报价与议价进展。" />
        ) : (
          <TradeList
            listId="buyer-inquiries"
            rowKey="id"
            dataSource={inquiries.rows}
            loading={inquiries.loading}
            onRefresh={inquiries.reload}
            rowClassName={(row) => `buyer-inquiry-row${selectedInquiryId === row.id ? ' selected' : ''}`}
            onRow={(row) => ({ onClick: (event) => {
              if (event.target instanceof Element && event.target.closest('.ant-table-selection-column, button, a')) return
              setSelectedInquiryId(selectedInquiryId === row.id ? null : row.id)
            } })}
            columns={[
              { title: "询价单号", key: 'col-1', width: 160, render: (_, row) => (<span className="mc-mono">{row.inquiryNo}</span>) },
              { title: "商品", key: 'col-2', width: 160, render: (_, row) => (<>{row.productName}</>) },
              { title: "供应方", key: 'col-3', width: 160, render: (_, row) => (<>{row.sellerName}</>) },
              { title: "数量", key: 'col-4', width: 108, render: (_, row) => (<span className="mc-mono">{row.quantity} {row.unit}</span>) },
              { title: "报价数", key: 'col-5', width: 108, render: (_, row) => (<span className="mc-mono">{row.replyCount ?? 0}</span>) },
              { title: "截止时间", key: 'col-6', width: 160, render: (_, row) => (<span className="mc-mono mc-xs">{shortDate(row.replyDeadline)}</span>) },
              { title: "状态", key: 'col-7', width: 108, render: (_, row) => (<><span className={`mc-tag ${(INQUIRY_STATUS[row.inquiryStatus] ?? { tone: 'ghost' }).tone}`}>
                        {(INQUIRY_STATUS[row.inquiryStatus] ?? { text: row.inquiryStatus || '未知' }).text}
                      </span></>) },
              { title: "操作", key: 'action', width: 170, render: (_, row) => (<><button type="button" className="mc-link" onClick={(event) => { event.stopPropagation(); setSelectedInquiryId(selectedInquiryId === row.id ? null : row.id) }}>
                        {selectedInquiryId === row.id ? '收起报价' : '查看报价'}
                      </button></>) },
            ]}
          />
        )}
      </Panel>
      <Panel
        title={selectedInquiryId
          ? `供应商报价 · ${inquiries.rows.find((row) => row.id === selectedInquiryId)?.inquiryNo ?? ''}`
          : '供应商报价'}
        extra={selectedInquiryId ? (
          <button type="button" className="mc-link" onClick={() => setSelectedInquiryId(null)}>
            查看全部报价
          </button>
        ) : <span className="mc-toolbar-muted">点击上方询价单可联动筛选</span>}
      >
        {quotes.filter((quote) => !selectedInquiryId || quote.inquiryId === selectedInquiryId).length === 0 ? (
          <EmptyState
            title={selectedInquiryId ? '该询价单暂无供应商报价' : '还没有供应商报价'}
            desc={selectedInquiryId
              ? '供应商提交报价后会自动显示在这张询价单下。'
              : '询价发起后，供应方提交的报价会在这里显示，可直接受理并生成采购订单。'} />
        ) : (
          <TradeList
            key={selectedInquiryId ?? 'all'}
            listId="buyer-quotes"
            rowKey="id"
            dataSource={quotes.filter((quote) => !selectedInquiryId || quote.inquiryId === selectedInquiryId)}
            onRefresh={loadQuotes}
            columns={[
              { title: "报价单号", key: 'col-1', width: 160, render: (_, quote) => (<span className="mc-mono">{quote.quoteNo}</span>) },
              { title: "供应商", key: 'col-2', width: 160, render: (_, quote) => (<>{quote.sellerName ?? '—'}</>) },
              { title: "商品", key: 'col-3', width: 160, render: (_, quote) => (<>{quote.productName ?? '—'}</>) },
              { title: "单价", key: 'col-4', width: 160, render: (_, quote) => (<span className="mc-price">{money(quote.unitPrice)}</span>) },
              { title: "数量", key: 'col-5', width: 108, render: (_, quote) => (<span className="mc-mono">{quote.quantity} {quote.unit ?? ''}</span>) },
              { title: "运费", key: 'col-6', width: 160, render: (_, quote) => (<span className="mc-price">{money(quote.freightAmount ?? 0)}</span>) },
              { title: "总价", key: 'col-7', width: 160, render: (_, quote) => (<span className="mc-price">{money(quote.totalAmount)}</span>) },
              { title: "状态", key: 'col-8', width: 108, render: (_, quote) => (<><span className={`mc-tag ${quote.quoteStatus === 'pending' ? 'amber' : quote.quoteStatus === 'rejected' ? 'red' : 'green'}`}>
                        {quote.quoteStatus === 'pending' ? '待受理' : quote.quoteStatus === 'accepted' ? '已受理' : quote.quoteStatus === 'rejected' ? '已拒绝' : quote.quoteStatus}
                      </span></>) },
              { title: "操作", key: 'action', width: 170, render: (_, quote) => (<><ListRowActions>
                        <button type="button" className="mc-link"
                          onClick={() => setChatTarget({
                            sellerId: String(quote.sellerId),
                            sellerName: quote.sellerName || '供应商',
                            productId: quote.productId ?? null,
                          })}>进入洽谈</button>
                        {quote.quoteStatus === 'pending' ? (
                          <button type="button" className="mc-link" disabled={quoteBusy === quote.id}
                            onClick={() => void acceptBuyerQuote(quote)}>
                            {quoteBusy === quote.id ? '处理中…' : '接受并生成订单'}
                          </button>
                        ) : quote.orderId ? (
                          <a className="mc-link" href={`/order/detail/${quote.orderId}`}>查看订单</a>
                        ) : null}
                      </ListRowActions></>) },
            ]}
          />
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
          <TradeList
            listId="buyer-disputes"
            rowKey="id"
            dataSource={myDisputes}
            loading={disputes.loading}
            onRefresh={disputes.reload}
            columns={[
              { title: "工单号", key: 'col-1', width: 160, render: (_, row) => (<span className="mc-mono">{row.disputeNo}</span>) },
              { title: "关联订单", key: 'col-2', width: 160, render: (_, row) => (<span className="mc-mono">{row.orderId}</span>) },
              { title: "类型", key: 'col-3', width: 160, render: (_, row) => (<>{row.disputeType ?? '—'}</>) },
              { title: "问题描述", key: 'col-4', width: 220, render: (_, row) => (<span className="mc-wrap-text">{row.disputeDescription ?? row.disputeReason ?? '—'}</span>) },
              { title: "状态", key: 'col-5', width: 108, render: (_, row) => (<><span className="mc-tag amber">{row.disputeStatus ?? '处理中'}</span></>) },
              { title: "提交时间", key: 'col-6', width: 160, render: (_, row) => (<span className="mc-mono mc-xs">{shortDate(row.createTime)}</span>) },
            ]}
          />
        )}
      </Panel>
      <Panel title="退款与售后进度">
        {refunds.length === 0 ? (
          <EmptyState title="暂无退款记录" desc="收货后如遇质量问题，可从订单详情发起退货退款；审核进度会显示在这里。" />
        ) : (
          <TradeList
            listId="buyer-refunds"
            rowKey="id"
            dataSource={refunds}
            onRefresh={loadRefunds}
            columns={[
              { title: "退款单号", key: 'col-1', width: 160, render: (_, row) => (<span className="mc-mono">{row.refundNo}</span>) },
              { title: "订单号", key: 'col-2', width: 160, render: (_, row) => (<span className="mc-mono">{row.orderNo}</span>) },
              { title: "类型", key: 'col-3', width: 160, render: (_, row) => (<>{row.refundType === 'return_refund' ? '退货退款' : row.refundType === 'refund_only' ? '仅退款' : row.refundType}</>) },
              { title: "退款金额", key: 'col-4', width: 160, render: (_, row) => (<span className="mc-price">{money(row.refundAmount)}</span>) },
              { title: "原因", key: 'col-5', width: 160, render: (_, row) => (<span className="mc-wrap-text">{row.refundReason ?? '—'}</span>) },
              { title: "状态", key: 'col-6', width: 108, render: (_, row) => { const status = REFUND_STATUS[row.refundStatus] ?? { text: row.refundStatus, tone: 'ghost' }
 return (<><span className={`mc-tag ${status.tone}`}>{status.text}</span></>) } },
              { title: "审核意见", key: 'col-7', width: 220, render: (_, row) => (<span className="mc-wrap-text">{row.reviewRemark ?? '—'}</span>) },
              { title: "申请时间", key: 'col-8', width: 160, render: (_, row) => (<span className="mc-mono mc-xs">{shortDate(row.createTime)}</span>) },
            ]}
          />
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

  const renderFavorite = (): JSX.Element => {
    const removeFollow = async (seller: FollowingSeller): Promise<void> => {
      const sellerId = String(seller.sellerId)
      setFollowingBusy(sellerId)
      try {
        const result = await unfollowSeller(sellerId)
        if (result.code !== 200) {
          message.error(result.message || '取消关注失败')
          return
        }
        setFollowing((current) => current.filter((item) => String(item.sellerId) !== sellerId))
        message.success(`已取消关注 ${seller.sellerName}`)
      } catch {
        message.error('取消关注失败，请稍后重试')
      } finally {
        setFollowingBusy(null)
      }
    }

    const removeFavoriteProduct = async (product: FavoriteProduct): Promise<void> => {
      const key = `product-${product.productId}`
      setFollowingBusy(key)
      try {
        const result = await unfavoriteProduct(product.productId)
        if (result.code !== 200) {
          message.error(result.message || '取消收藏失败')
          return
        }
        setFavoriteProducts((current) =>
          current.filter((item) => item.productId !== product.productId))
        message.success(`已取消收藏 ${product.productName}`)
      } catch {
        message.error('取消收藏失败，请稍后重试')
      } finally {
        setFollowingBusy(null)
      }
    }

    return (
      <div className="buyer-workspace buyer-favorite-workspace">
        <section className="buyer-workspace-hero">
          <span className="buyer-workspace-icon"><HeartOutlined /></span>
          <div>
            <small>FOLLOWED SUPPLIERS</small>
            <h2>收藏与关注</h2>
            <p>查看已关注的供应商，快速进入店铺或继续在线洽谈。</p>
          </div>
          <div className="buyer-workspace-stats">
            <div><span>关注供应商</span><strong>{following.length}</strong></div>
            <div><span>收藏商品</span><strong>{favoriteProducts.length}</strong></div>
            <div><span>在售货源</span><strong>{following.reduce((sum, item) => sum + Number(item.productCount ?? 0), 0)}</strong></div>
            <div><span>覆盖品类</span><strong>{new Set(following.flatMap((item) => (item.categories ?? '').split('、').filter(Boolean))).size}</strong></div>
          </div>
        </section>

        <div className="mc-toolbar">
          <span className="mc-toolbar-muted">关注关系按当前登录账号保存，取消后可重新关注。</span>
          <span className="mc-spacer" />
          <button type="button" className="mc-btn ghost" onClick={loadFollowing} disabled={followingLoading}>刷新</button>
          <a className="mc-btn" href="/hall">浏览供应商</a>
        </div>

        {followingLoading ? (
          <div className="mc-loading">正在读取关注列表…</div>
        ) : following.length === 0 ? (
          <Panel title="关注的供应商">
            <EmptyState title="还没有关注供应商" desc="在供应商店铺点击关注后，会在这里快速找到它。"
              action={<a className="mc-btn" href="/hall">去交易大厅</a>} />
          </Panel>
        ) : (
          <div className="buyer-following-grid">
            {following.map((seller) => {
              const sellerId = String(seller.sellerId)
              return (
                <article className="buyer-following-card" key={sellerId}>
                  <div className="buyer-following-head">
                    <span>{seller.sellerName.slice(0, 1)}</span>
                    <div><strong>{seller.sellerName}</strong><small>{[seller.province, seller.city].filter(Boolean).join(' ') || '所在地待补充'}</small></div>
                    <em>已关注</em>
                  </div>
                  <div className="buyer-following-facts">
                    <div><span>在售货源</span><strong>{seller.productCount}<small>款</small></strong></div>
                    <div><span>起批价格</span><strong>{seller.minPrice == null ? '询价' : money(seller.minPrice)}</strong></div>
                    <div><span>主营品类</span><strong>{seller.categories || '待补充'}</strong></div>
                    <div><span>关注时间</span><strong>{shortDate(seller.followedAt)}</strong></div>
                  </div>
                  <div className="buyer-following-actions">
                    <a className="mc-btn ghost" href={`/shop/${sellerId}`}>进入店铺</a>
                    <button type="button" className="mc-btn"
                      onClick={() => setChatTarget({ sellerId, sellerName: seller.sellerName, productId: null })}>
                      <CustomerServiceOutlined />洽谈
                    </button>
                    <button type="button" className="mc-link danger" disabled={followingBusy === sellerId}
                      onClick={() => void removeFollow(seller)}>
                      {followingBusy === sellerId ? '处理中…' : '取消关注'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {!followingLoading && (
          <Panel title={`收藏的商品（${favoriteProducts.length}）`}
            extra={<a className="mc-link" href="/hall">继续浏览货源</a>}>
            {favoriteProducts.length === 0 ? (
              <EmptyState title="还没有收藏商品" desc="在商品详情点击“收藏商品”后会显示在这里。"
                action={<a className="mc-btn" href="/hall">去交易大厅</a>} />
            ) : (
              <TradeList
            listId="buyer-favorites"
            rowKey="productId"
            dataSource={favoriteProducts}
            onRefresh={loadFollowing}
            columns={[
              { title: "商品", key: 'col-1', width: 160, render: (_, product) => (<><strong>{product.productName}</strong></>) },
              { title: "供应商", key: 'col-2', width: 160, render: (_, product) => (<>{product.sellerName || '—'}</>) },
              { title: "品类", key: 'col-3', width: 160, render: (_, product) => (<>{product.categoryName || '—'}</>) },
              { title: "当前价格", key: 'col-4', width: 160, render: (_, product) => (<span className="mc-price">{product.price == null
                          ? '询价' : `${money(product.price)}/${product.unit || '单位'}`}</span>) },
              { title: "状态", key: 'col-5', width: 108, render: (_, product) => (<><span className={`mc-tag ${product.publishStatus === 'published' ? 'green' : 'ghost'}`}>
                          {product.publishStatus === 'published' ? '在售' : '已下架'}
                        </span></>) },
              { title: "收藏时间", key: 'col-6', width: 160, render: (_, product) => (<span className="mc-mono mc-xs">{shortDate(product.favoritedAt)}</span>) },
              { title: "操作", key: 'action', width: 170, render: (_, product) => (<><ListRowActions>
                            <a className="mc-link" href={`/product/detail/${product.productId}`}>查看</a>
                            {product.publishStatus === 'published' && (
                              <a className="mc-link" href={`/order/create?productId=${product.productId}`}>去下单</a>
                            )}
                            <button type="button" className="mc-link danger"
                              disabled={followingBusy === `product-${product.productId}`}
                              onClick={() => void removeFavoriteProduct(product)}>
                              {followingBusy === `product-${product.productId}` ? '处理中…' : '取消收藏'}
                            </button>
                          </ListRowActions></>) },
            ]}
          />
            )}
          </Panel>
        )}
      </div>
    )
  }

  const renderTabContent = (tab: string): JSX.Element => (
    tab === 'agent' ? <TradeAgentPanel role="BUYER" />
      : tab === 'publish' ? <DemandCreate embedded returnPath="/member/buyer?tab=demand-list" />
        : tab === 'demand-list' ? renderDemandList()
          : tab === 'purchase' ? renderPurchase()
            : tab === 'inquiry' ? renderInquiry()
              : tab === 'chat' ? (
                <div className="mc-embedded buyer-negotiation-inbox">
                  <ShopChat
                    open
                    embedded
                    inbox
                    inboxRole="buyer"
                    sellerId=""
                    sellerName={buyerMerchant?.merchantName ?? ''}
                    onClose={() => setActive('overview')}
                  />
                </div>
              )
                : tab === 'after' ? renderAfter()
                  : tab === 'rate' ? renderRate()
                    : tab === 'contract' ? renderContract()
                      : tab === 'fund' ? renderFund()
                        : tab === 'favorite' ? renderFavorite()
                          : renderOverview()
  )

  return (
    <>
      <MemberCenterShell
        role="buyer"
        active={active === 'publish' ? 'demand-list' : active}
        tabKey={active}
        extraTabLabels={{ publish: '发布采购需求' }}
        navItems={NAV}
        merchantName={buyerMerchant?.merchantName ?? ''}
        onNavigate={setActive}
        notice={(
          <>
            {base.loading && <div className="mc-loading">正在加载会员数据…</div>}
            {base.error && <div className="mc-alert"><AlertOutlined />{base.error}</div>}
          </>
        )}
        renderTab={renderTabContent}
      />
      <ShopChat
        open={Boolean(chatTarget)}
        sellerId={chatTarget?.sellerId ?? ''}
        sellerName={chatTarget?.sellerName ?? ''}
        productId={chatTarget?.productId}
        onClose={() => setChatTarget(null)}
      />
    </>
  )
}

function renderOrdersTable(
  rows: OrderRow[],
  loading: boolean,
  error: string,
  actions: (order: OrderRow) => JSX.Element,
  options?: { onRefresh: () => void; filterSlot: React.ReactNode; toolbarLeft: React.ReactNode; pagination: TablePaginationConfig },
): JSX.Element {
  return (
    <TradeList
            listId={options ? 'buyer-orders' : 'buyer-recent-orders'}
            loading={loading}
            locale={{ emptyText: <EmptyState title={error || '还没有采购订单'} /> }}
            rowKey="id"
            dataSource={rows}
            onRefresh={options?.onRefresh}
            filterSlot={options?.filterSlot}
            toolbarLeft={options?.toolbarLeft}
            pagination={options?.pagination ?? false}
            showToolbar={Boolean(options)}
            selectable={Boolean(options)}
            columns={[
              { title: "订单号", key: 'col-1', width: 160, render: (_, order) => (<span className="mc-mono">{order.orderNo}</span>) },
              { title: "商品", key: 'col-2', width: 160, render: (_, order) => (<>{order.productName || order.categoryName || '—'}</>) },
              { title: "数量", key: 'col-3', width: 108, render: (_, order) => (<span className="mc-mono">{order.totalQuantity ?? '—'}</span>) },
              { title: "金额", key: 'col-4', width: 160, render: (_, order) => (<span className="mc-price">{money(order.totalAmount)}</span>) },
              { title: "供应方", key: 'col-5', width: 160, render: (_, order) => (<>{order.sellerName ?? '—'}</>) },
              { title: "状态", key: 'col-6', width: 108, render: (_, order) => (<><StatusTag status={order.orderStatus} side="buyer" /></>) },
              { title: "下单时间", key: 'col-7', width: 160, render: (_, order) => (<span className="mc-mono mc-xs">{shortDate(order.createTime)}</span>) },
              { title: "操作", key: 'action', width: 170, render: (_, order) => (<>{actions(order)}</>) },
            ]}
          />
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
