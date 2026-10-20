import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal, Tabs, message } from 'antd'
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  HomeOutlined,
  AppstoreAddOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { updateOrderStatus } from '@/api/order'
import { getMySettlement, type SellerSettlementView } from '@/api/settlement'
import ContractList from '@/pages/contract/list'
import DisputeList from '@/pages/dispute/list'
import EvaluationList from '@/pages/evaluation/list'
import LogisticsList from '@/pages/logistics/list'
import MatchList from '@/pages/match/list'
import MyCompensation from '@/pages/mine-compensation'
import MyGuarantee from '@/pages/mine-guarantee'
import MyIdentity from '@/pages/mine-identity'
import PriceList from '@/pages/price/list'
import QuoteList from '@/pages/quote/list'
import { MemberCenterShell, type MemberNavItem } from './MemberCenterShell'
import {
  EmptyState,
  Panel,
  StatusTag,
  money,
  shortDate,
  useDisputes,
  useEvaluations,
  useGuarantees,
  useLogistics,
  useMemberBase,
  useOrders,
  useProducts,
  useReceivedInquiries,
  type OrderRow,
} from './shared'

const NAV: MemberNavItem[] = [
  { key: 'overview', label: '首页概览', icon: <HomeOutlined /> },
  { key: 'sales', label: '销售订单', icon: <ShopOutlined /> },
  { key: 'goods', label: '商品管理', icon: <AppstoreOutlined /> },
  { key: 'supply', label: '供应发布', icon: <AppstoreAddOutlined /> },
  { key: 'trade', label: '报价与撮合', icon: <StarOutlined /> },
  { key: 'ship', label: '发货与物流', icon: <TruckOutlined /> },
  { key: 'after', label: '售后处理', icon: <AlertOutlined /> },
  { key: 'rate', label: '店铺评价与信用', icon: <StarOutlined /> },
  { key: 'contract', label: '合同管理', icon: <FileTextOutlined /> },
  { key: 'fund', label: '资金结算', icon: <DollarOutlined /> },
  { key: 'customer', label: '客户管理', icon: <TeamOutlined /> },
  { key: 'iot', label: '生产接入', icon: <ApiOutlined /> },
  { key: 'profile', label: '店铺资料与认证', icon: <UserOutlined /> },
]

const SELLER_STATUS = [
  { value: '', label: '全部' },
  { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '运输中' },
  { value: 'received', label: '已收货' },
  { value: 'completed', label: '已完成' },
]

function Kpi({ label, value, unit, desc, tone = '' }: {
  label: string
  value: string | number
  unit?: string
  desc?: string
  tone?: string
}): JSX.Element {
  return (
    <div className={`mc-stat ${tone}`}>
      <div className="mc-stat-k">{label}</div>
      <div className="mc-stat-v">{value}<small>{unit}</small></div>
      {desc && <div className="mc-stat-d">{desc}</div>}
    </div>
  )
}

export default function SellerCenter(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') || 'overview'
  const setActive = (key: string): void => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    setParams(next, { replace: true })
  }

  const base = useMemberBase()
  // 卖家中心优先用 owner / seller 角色的主体展示商品与评价。
  const sellerMerchant = base.merchants.find((item) => item.roleInMerchant === 'owner' || item.roleInMerchant === 'seller')
    ?? base.primary
  const sellerId = sellerMerchant ? Number(sellerMerchant.merchantId) : null
  const allOrders = useOrders('seller', '', 1, 100)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pagedOrders = useOrders('seller', status, page, 10)
  const products = useProducts(sellerId)
  const logistics = useLogistics()
  const disputes = useDisputes()
  const evaluations = useEvaluations({ evaluateeId: sellerId ?? undefined })
  const guarantees = useGuarantees()
  const inquiries = useReceivedInquiries()
  const [goodsStatus, setGoodsStatus] = useState('all')
  const [settlement, setSettlement] = useState<SellerSettlementView | null>(null)

  useEffect(() => {
    let cancelled = false
    getMySettlement()
      .then((body) => {
        if (!cancelled && body?.code === 200) setSettlement(body.data ?? null)
      })
      .catch(() => { /* 结算接口不可用时页面显示未接入说明 */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setPage(1)
  }, [status])

  const sellerOrders = allOrders.rows
  const sellerOrderIds = useMemo(() => new Set(sellerOrders.map((item) => item.id)), [sellerOrders])
  const myLogistics = logistics.rows.filter((item) => sellerOrderIds.has(Number(item.orderId)))
  const myDisputes = disputes.rows.filter((item) => base.merchantIds.includes(Number(item.respondentId)))
  const openDisputes = myDisputes.filter((item) => !/closed|resolved|已解决/i.test(item.disputeStatus ?? ''))
  const avgRating = evaluations.rows.length
    ? evaluations.rows.reduce((sum, item) => sum + Number(item.ratingOverall ?? 0), 0) / evaluations.rows.length
    : null
  const productViews = products.rows.reduce((sum, item) => sum + Number(item.viewCount ?? 0), 0)
  const guaranteeAvailable = guarantees.reduce((sum, item) => sum + Number(item.availableAmount ?? 0), 0)
  const guaranteeFrozen = guarantees.reduce((sum, item) => sum + Number(item.frozenAmount ?? 0), 0)

  const customers = useMemo(() => {
    const groups = new Map<number, { id: number; name: string; total: number; count: number; last: string }>()
    sellerOrders.forEach((order) => {
      const id = Number(order.buyerId)
      const current = groups.get(id) ?? { id, name: order.buyerName || `采购方 ${id}`, total: 0, count: 0, last: '' }
      current.total += Number(order.totalAmount ?? 0)
      current.count += 1
      if (!current.last || order.createTime > current.last) current.last = order.createTime
      groups.set(id, current)
    })
    return Array.from(groups.values()).sort((a, b) => b.total - a.total)
  }, [sellerOrders])

  const filteredProducts = products.rows.filter((item) => {
    if (goodsStatus === 'all') return true
    return item.publishStatus === goodsStatus
  })

  const shipOrder = (order: OrderRow): void => {
    Modal.confirm({
      title: '确认发货？',
      content: `订单 ${order.orderNo} · ${order.productName || order.categoryName || '订单商品'}。发货后物流单会进入运输中状态。`,
      okText: '确认发货',
      cancelText: '取消',
      onOk: async () => {
        try {
          const body = await updateOrderStatus(order.id, 'shipped')
          if (body?.code === 200) {
            message.success('已发货')
            allOrders.reload()
            pagedOrders.reload()
          } else {
            message.error(body?.message ?? '发货失败')
          }
        } catch {
          message.error('发货失败（请检查后端是否在运行）')
        }
      },
    })
  }

  const orderActions = (order: OrderRow): JSX.Element => (
    <div className="mc-actions">
      <a className="mc-link" href={`/order/detail/${order.id}`}>查看详情</a>
      {order.orderStatus === 'paid' && (
        <button type="button" className="mc-link" onClick={() => shipOrder(order)}>发货</button>
      )}
      <a className="mc-link" href="/logistics">物流</a>
    </div>
  )

  const renderOverview = (): JSX.Element => (
    <>
      <div className="mc-grid mc-grid-4">
        <Kpi label="待发货" value={sellerOrders.filter((item) => item.orderStatus === 'paid').length} unit="笔" desc="请在 24 小时内处理" />
        <Kpi label="运输中" value={myLogistics.filter((item) => !/delivered|cancelled|已签收/i.test(item.logisticsStatus ?? '')).length}
          unit="单" desc={`关联物流单 ${myLogistics.length} 单`} tone="tech" />
        <Kpi label="待处理售后" value={openDisputes.length} unit="笔" desc="超时响应会影响店铺评分" tone={openDisputes.length ? 'amber' : ''} />
        <Kpi label="收到询价" value={inquiries.length} unit="条" desc="供应方视角的询价单" />
      </div>

      <Panel title="店铺经营概览" extra={<span className="mc-toolbar-muted">数据来自交易单据与商品表</span>}>
        <div className="mc-grid mc-grid-4">
          <Kpi label="累计成交额" value={money(base.dashboard?.seller?.totalRevenue ?? 0)} desc="不含已取消订单" />
          <Kpi label="今日成交额" value={money(base.dashboard?.seller?.todayRevenue ?? 0)} desc={`今日订单 ${base.dashboard?.seller?.todayOrders ?? 0} 笔`} tone="tech" />
          <Kpi label="在架货源" value={base.dashboard?.seller?.activeProducts ?? 0} unit="个" desc={`货源总数 ${base.dashboard?.seller?.productCount ?? products.rows.length}`} />
          <Kpi label="商品累计浏览" value={productViews} unit="次" desc={avgRating == null ? '暂无评价' : `平均评分 ${avgRating.toFixed(1)}`} tone="amber" />
        </div>
      </Panel>

      <Panel title="最近销售订单" extra={<button type="button" className="mc-link" onClick={() => setActive('sales')}>查看全部订单 →</button>}>
        {renderSellerOrders(sellerOrders.slice(0, 5), allOrders.loading, allOrders.error, orderActions)}
      </Panel>

      <div className="mc-section-title">快捷入口</div>
      <div className="mc-grid mc-grid-4">
        {[
          { icon: <FileTextOutlined />, title: '发布供应', desc: '发布供应信息，精准触达采购商', href: '/product/create' },
          { icon: <AppstoreOutlined />, title: '商品管理', desc: '上架商品、维护规格与库存', tab: 'goods' },
          { icon: <TruckOutlined />, title: '发货管理', desc: '发货、查看在途物流与签收状态', tab: 'ship' },
          { icon: <TeamOutlined />, title: '客户管理', desc: '采购商档案、成交与复购', tab: 'customer' },
        ].map((item) => (
          <a className="mc-quick" key={item.title} href={item.href ?? '#'}
            onClick={(event) => { if (item.tab) { event.preventDefault(); setActive(item.tab) } }}>
            <span className="mc-quick-icon">{item.icon}</span>
            <strong>{item.title}</strong>
            <small>{item.desc}</small>
          </a>
        ))}
      </div>
    </>
  )

  const renderSales = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-label">状态</span>
        <div className="mc-chips">
          {SELLER_STATUS.map((item) => (
            <button type="button" key={item.value} className={status === item.value ? 'on' : ''}
              onClick={() => setStatus(item.value)}>{item.label}</button>
          ))}
        </div>
        <span className="mc-spacer" />
        <a className="mc-btn ghost" href="/product/create">发布供应</a>
      </div>
      <Panel>
        {renderSellerOrders(pagedOrders.rows, pagedOrders.loading, pagedOrders.error, orderActions)}
        <div className="mc-pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>第 {page} / {Math.max(1, Math.ceil(pagedOrders.total / 10))} 页 · 共 {pagedOrders.total} 笔</span>
          <button type="button" disabled={page >= Math.ceil(pagedOrders.total / 10)} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      </Panel>
    </>
  )

  const renderTrade = (): JSX.Element => (
    <div className="mc-embedded mc-embedded-first">
      <Tabs
        defaultActiveKey="quote"
        items={[
          { key: 'quote', label: '报价管理', children: <QuoteList /> },
          { key: 'match', label: '智能匹配', children: <MatchList /> },
          { key: 'price', label: '价格推荐', children: <PriceList /> },
        ]}
      />
    </div>
  )

  const renderContract = (): JSX.Element => (
    <div className="mc-embedded mc-embedded-first"><ContractList /></div>
  )

  const renderGoods = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-label">状态</span>
        <div className="mc-chips">
          {[{ value: 'all', label: '全部' }, { value: 'published', label: '在售' }, { value: 'pending', label: '待审核' }, { value: 'soldout', label: '已售罄' }].map((item) => (
            <button type="button" key={item.value} className={goodsStatus === item.value ? 'on' : ''}
              onClick={() => setGoodsStatus(item.value)}>{item.label}</button>
          ))}
        </div>
        <span className="mc-spacer" />
        <a className="mc-btn" href="/product/create">上架新商品</a>
      </div>
      <Panel title="商品管理">
        {filteredProducts.length === 0 ? (
          <EmptyState title="没有符合条件的商品" desc="上架新商品后会出现在这里。"
            action={<a className="mc-btn" href="/product/create">上架新商品</a>} />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>商品名</th><th>品类</th><th>规格</th><th>单价</th><th>库存</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {filteredProducts.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{item.categoryName ?? '—'}</td>
                    <td>{item.specification ?? item.specLevel ?? '—'}</td>
                    <td className="mc-price">{money(item.price)}<span className="mc-unit">/{item.unit}</span></td>
                    <td className="mc-mono">{item.stockQuantity ?? '—'} {item.unit}</td>
                    <td><span className={`mc-tag ${item.publishStatus === 'published' ? 'green' : item.publishStatus === 'pending' ? 'amber' : 'ghost'}`}>{publishText(item.publishStatus)}</span></td>
                    <td><a className="mc-link" href={`/product/detail/${item.id}`}>查看</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderSupply = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">我发布的供应信息 · 浏览与询单情况</span>
        <span className="mc-spacer" />
        <a className="mc-btn" href="/product/create">发布新供应</a>
      </div>
      <Panel title="供应信息">
        {products.rows.length === 0 ? (
          <EmptyState title="还没有发布供应" desc="发布货源后会在这里看到浏览与询单数据。"
            action={<a className="mc-btn" href="/product/create">发布供应</a>} />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>商品</th><th>品类</th><th>可供量</th><th>报价</th><th>浏览 / 询单</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {products.rows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{item.categoryName ?? '—'}</td>
                    <td className="mc-mono">{item.stockQuantity ?? '—'} {item.unit}</td>
                    <td className="mc-mono">{money(item.price)}/{item.unit}</td>
                    <td className="mc-mono">{item.viewCount ?? 0} / {item.inquiryCount ?? 0}</td>
                    <td><span className={`mc-tag ${item.publishStatus === 'published' ? 'tech' : 'ghost'}`}>{publishText(item.publishStatus)}</span></td>
                    <td><a className="mc-link" href={`/product/detail/${item.id}`}>管理</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderShip = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">待发货订单与在途运单跟踪</span>
        <span className="mc-spacer" />
        <a className="mc-btn ghost" href="/logistics">物流管理</a>
      </div>
      <Panel title="发货与物流">
        {!myLogistics.length && !sellerOrders.filter((item) => item.orderStatus === 'paid').length ? (
          <EmptyState title="没有待发货或在途运单" desc="订单付款后会进入待发货，发货后这里会显示物流轨迹。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>运单号</th><th>关联订单</th><th>物流方式</th><th>承运商</th><th>当前节点</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {sellerOrders.filter((item) => item.orderStatus === 'paid').map((order) => (
                  <tr key={`pending-${order.id}`}>
                    <td className="mc-mono">—</td>
                    <td className="mc-mono">{order.orderNo}</td>
                    <td>待安排</td><td>—</td><td className="mc-toolbar-muted">待安排发货</td>
                    <td><span className="mc-tag amber">待发货</span></td>
                    <td><button type="button" className="mc-link" onClick={() => shipOrder(order)}>去发货</button></td>
                  </tr>
                ))}
                {myLogistics.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.logisticsNo}</td>
                    <td className="mc-mono">{row.orderId}</td>
                    <td>{row.logisticsType ?? '—'}</td>
                    <td>{row.carrierName ?? '—'}</td>
                    <td className="mc-wrap-text">{row.currentLocation ?? '—'}</td>
                    <td><span className="mc-tag tech">{logisticsText(row.logisticsStatus)}</span></td>
                    <td><a className="mc-link" href="/logistics">查看轨迹</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="mc-embedded"><LogisticsList /></div>
    </>
  )

  const renderAfter = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">待处理售后工单 · 48 小时内响应可维护店铺评分</span>
        <span className="mc-spacer" />
        <span className="mc-tag red">待处理 {openDisputes.length} 笔</span>
      </div>
      <Panel title="售后工单">
        {myDisputes.length === 0 ? (
          <EmptyState title="没有售后工单" desc="采购方发起售后后会出现在这里。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>工单号</th><th>关联订单</th><th>类型</th><th>问题</th><th>采购方诉求</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {myDisputes.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.disputeNo}</td>
                    <td className="mc-mono">{row.orderId}</td>
                    <td>{row.disputeType ?? '—'}</td>
                    <td className="mc-wrap-text">{row.disputeDescription ?? row.disputeReason ?? '—'}</td>
                    <td className="mc-mono">{row.claimAmount != null ? money(row.claimAmount) : '—'}</td>
                    <td><span className="mc-tag amber">{row.disputeStatus ?? '处理中'}</span></td>
                    <td><a className="mc-link" href="/member/seller?tab=after">处理</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="mc-embedded"><DisputeList /></div>
    </>
  )

  const renderRate = (): JSX.Element => (
    <>
      <div className="mc-grid mc-grid-4">
        <Kpi label="综合评分" value={avgRating == null ? '—' : avgRating.toFixed(1)} unit={avgRating == null ? '' : '分'} desc={`共 ${evaluations.rows.length} 条评价`} tone="tech" />
        <Kpi label="描述相符" value={avgMetric(evaluations.rows, 'ratingQuality')} desc="来自真实评价" />
        <Kpi label="服务态度" value={avgMetric(evaluations.rows, 'ratingService')} desc="来自真实评价" />
        <Kpi label="发货速度" value={avgMetric(evaluations.rows, 'ratingDelivery')} desc="来自真实评价" />
      </div>
      <Panel title="最新评价">
        {evaluations.rows.length === 0 ? (
          <EmptyState title="还没有店铺评价" desc="订单完成后采购方可以评价，评价会展示在这里。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>订单</th><th>采购方</th><th>评分</th><th>评价内容</th><th>时间</th></tr></thead>
              <tbody>
                {evaluations.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.orderId}</td>
                    <td>{row.evaluatorName}</td>
                    <td><span className="mc-stars">{'★'.repeat(Math.round(row.ratingOverall))}</span> {row.ratingOverall}</td>
                    <td className="mc-wrap-text">{row.evaluationContent ?? '—'}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="信用分与等级说明" extra={<span className="mc-tag amber">信用分接口待接入</span>}>
        <div className="mc-note">当前交易域只提供真实评价均分，没有独立的信用分字段；页面不展示编造的“96 分 / 金牌卖家”。</div>
      </Panel>
      <div className="mc-embedded"><EvaluationList /></div>
    </>
  )

  const renderFund = (): JSX.Element => (
    <>
      <div className="mc-grid mc-grid-3">
        <Kpi label="待结算金额" value={money(settlement?.summary.pendingAmount ?? 0)}
          desc={`${settlement?.summary.pendingCount ?? 0} 笔 · 预估应收 ${money(settlement?.summary.pendingReceivable ?? 0)}`} />
        <Kpi label="已结算应收" value={money(settlement?.summary.settledReceivable ?? 0)}
          desc={`${settlement?.summary.settledCount ?? 0} 笔 · 平台服务费 ${money(settlement?.summary.settledFee ?? 0)}`} tone="tech" />
        <Kpi label="可用保证金" value={money(guaranteeAvailable)} desc={`冻结 ${money(guaranteeFrozen)}`} tone="amber" />
      </div>
      <Panel title="待结算订单" extra={<span className="mc-toolbar-muted">确认收货且已付款，尚未生成结算单</span>}>
        {!settlement || settlement.pending.length === 0 ? (
          <EmptyState title="没有待结算订单" desc="订单确认收货并完成付款后，会进入待结算。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>订单号</th><th>采购方</th><th>订单金额</th><th>平台服务费</th><th>卖家应收</th><th>状态</th></tr></thead>
              <tbody>
                {settlement.pending.map((row) => (
                  <tr key={row.orderId}>
                    <td className="mc-mono">{row.orderNo}</td>
                    <td>{row.buyerName ?? '—'}</td>
                    <td className="mc-price">{money(row.totalAmount)}</td>
                    <td>{money(row.platformFee)} <span className="mc-xs">({(Number(row.platformFeeRate) * 100).toFixed(2)}%)</span></td>
                    <td className="mc-price">{money(row.sellerReceivable)}</td>
                    <td><span className="mc-tag amber">待结算</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="已结算记录" extra={<span className="mc-toolbar-muted">按平台结算单展示</span>}>
        {!settlement || settlement.settled.length === 0 ? (
          <EmptyState title="还没有已结算记录" desc="运营端完成结算后，分账金额与平台服务费会在这里展示。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>结算单号</th><th>订单号</th><th>采购方</th><th>订单金额</th><th>平台服务费</th><th>卖家应收</th><th>结算时间</th></tr></thead>
              <tbody>
                {settlement.settled.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.settlementNo}</td>
                    <td className="mc-mono">{row.orderNo}</td>
                    <td>{row.buyerName ?? '—'}</td>
                    <td className="mc-price">{money(row.totalAmount)}</td>
                    <td>{money(row.platformFee)}</td>
                    <td className="mc-price">{money(row.sellerReceivable)}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.settleTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="mc-embedded"><MyGuarantee /></div>
      <div className="mc-embedded"><MyCompensation /></div>
      <Panel title="提现申请">
        <EmptyState title="提现申请尚未开放" desc="当前只提供结算单与应收金额查询；提现涉及打款，需接入资金通道与审批流后再开放。" />
      </Panel>
    </>
  )

  const renderCustomer = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">采购商档案 · 由真实销售订单聚合</span>
      </div>
      <Panel title="客户管理">
        {customers.length === 0 ? (
          <EmptyState title="还没有成交客户" desc="产生销售订单后，采购商会自动汇总到这里。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>客户名称</th><th>累计采购额</th><th>订单数</th><th>最近下单</th><th>客户等级</th></tr></thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="mc-price">{money(row.total)}</td>
                    <td className="mc-mono">{row.count}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.last)}</td>
                    <td><span className={`mc-tag ${row.total >= 2000000 ? 'tech' : 'ghost'}`}>{row.total >= 2000000 ? '重点客户' : '普通客户'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderIot = (): JSX.Element => (
    <Panel title="生产接入">
      <div className="mc-note">
        生产域（地块、设备、环境监测）独立部署在生产管理子系统，交易域没有设备接口。
        请前往生产管理查看设备与地块数据，本页不展示未经来源的在线设备数。
      </div>
      <div className="mc-grid mc-grid-3" style={{ marginTop: 16 }}>
        {[
          { title: '1. 设备登记', desc: '在生产管理登记设备型号与通信协议。' },
          { title: '2. 地块绑定', desc: '把设备与地块绑定，建立采集点位。' },
          { title: '3. 数据上云', desc: '实时数据支撑生产监测与溯源背书。' },
        ].map((item) => (
          <div className="mc-quick" key={item.title}>
            <span className="mc-quick-icon"><ApiOutlined /></span>
            <strong>{item.title}</strong>
            <small>{item.desc}</small>
          </div>
        ))}
      </div>
      <a className="mc-btn" style={{ marginTop: 16 }} href="/production/dashboard">前往生产管理</a>
    </Panel>
  )

  const renderProfile = (): JSX.Element => (
    <>
      <Panel title="店铺资料与认证" extra={<a className="mc-btn ghost" href={`${window.location.protocol}//${window.location.hostname}:8098/portal/#/certify/enterprise`} target="_blank" rel="noreferrer">认证中心</a>}>
        {base.merchants.length === 0 ? (
          <EmptyState title="当前账号还没有绑定经营主体" desc={base.error || '请先完成企业注册或联系平台运营绑定主体。'} />
        ) : (
          <div className="mc-grid mc-grid-2">
            {base.merchants.map((merchant) => (
              <div className="mc-profile-card" key={merchant.id}>
                <div className="mc-profile-head">
                  <CheckCircleOutlined />
                  <strong>{merchant.merchantName}</strong>
                  <span className="mc-tag green">{merchant.roleInMerchant || '成员'}</span>
                </div>
                <dl>
                  <dt>经营主体 ID</dt><dd className="mc-mono">{merchant.merchantId}</dd>
                  <dt>主体类型</dt><dd>{merchant.merchantType || '—'}</dd>
                  <dt>绑定状态</dt><dd>{merchant.status === 1 ? '正常' : '停用'}</dd>
                  <dt>个人实名</dt><dd>{realNameText(base.realName)}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="资质证照">
        <EmptyState title="证照文件不在交易域" desc="营业执照、生产许可证等材料请到认证中心查看或更新。"
          action={<a className="mc-btn" href={`${window.location.protocol}//${window.location.hostname}:8098/portal/#/certify/enterprise`} target="_blank" rel="noreferrer">去认证中心</a>} />
      </Panel>
      <div className="mc-embedded"><MyIdentity /></div>
    </>
  )

  const content = active === 'sales' ? renderSales()
    : active === 'goods' ? renderGoods()
      : active === 'supply' ? renderSupply()
        : active === 'trade' ? renderTrade()
          : active === 'ship' ? renderShip()
            : active === 'after' ? renderAfter()
              : active === 'rate' ? renderRate()
                : active === 'contract' ? renderContract()
                  : active === 'fund' ? renderFund()
                    : active === 'customer' ? renderCustomer()
                      : active === 'iot' ? renderIot()
                        : active === 'profile' ? renderProfile()
                          : renderOverview()

  return (
    <MemberCenterShell role="seller" active={active} navItems={NAV}
      merchantName={sellerMerchant?.merchantName ?? ''} onNavigate={setActive}>
      {base.loading && <div className="mc-loading">正在加载会员数据…</div>}
      {base.error && <div className="mc-alert"><AlertOutlined />{base.error}</div>}
      {content}
    </MemberCenterShell>
  )
}

function renderSellerOrders(
  rows: OrderRow[],
  loading: boolean,
  error: string,
  actions: (order: OrderRow) => JSX.Element,
): JSX.Element {
  if (loading) return <div className="mc-loading">加载订单中…</div>
  if (error) return <div className="mc-alert">{error}</div>
  if (rows.length === 0) return <EmptyState title="还没有销售订单" desc="采购方下单后，销售订单会出现在这里。" />
  return (
    <div className="mc-table-wrap">
      <table className="mc-table">
        <thead>
          <tr><th>订单号</th><th>商品</th><th>数量</th><th>金额</th><th>采购方</th><th>状态</th><th>下单时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td className="mc-mono">{order.orderNo}</td>
              <td>{order.productName || order.categoryName || '—'}</td>
              <td className="mc-mono">{order.totalQuantity ?? '—'}</td>
              <td className="mc-price">{money(order.totalAmount)}</td>
              <td>{order.buyerName ?? '—'}</td>
              <td><StatusTag status={order.orderStatus} side="seller" /></td>
              <td className="mc-mono mc-xs">{shortDate(order.createTime)}</td>
              <td>{actions(order)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function publishText(status: string | undefined): string {
  const map: Record<string, string> = { published: '在售', pending: '待审核', soldout: '已售罄', offline: '已下架', rejected: '已驳回' }
  return status ? map[status] ?? status : '—'
}

function logisticsText(status: string | undefined): string {
  const map: Record<string, string> = { pending: '待揽收', picked: '已揽收', in_transit: '运输中', delivered: '已签收', cancelled: '已取消' }
  return status ? map[status] ?? status : '—'
}

function realNameText(record: { status: string } | null): string {
  if (!record) return '未提交'
  if (record.status === 'verified') return '已认证'
  if (record.status === 'pending') return '审核中'
  if (record.status === 'rejected') return '已驳回'
  return record.status
}

function avgMetric(rows: { ratingQuality: number; ratingService: number; ratingDelivery: number }[], key: 'ratingQuality' | 'ratingService' | 'ratingDelivery'): string {
  if (!rows.length) return '—'
  return (rows.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / rows.length).toFixed(1)
}
