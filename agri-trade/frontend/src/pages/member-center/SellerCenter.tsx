import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal, message } from 'antd'
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  CustomerServiceOutlined,
  DollarOutlined,
  FileTextOutlined,
  HomeOutlined,
  AppstoreAddOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShopOutlined,
  StarOutlined,
  TeamOutlined,
  TruckOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { shipOrder as shipOrderRequest } from '@/api/order'
import { updateSellerProductStatus } from '@/api/product'
import { getMySettlement, type SellerSettlementView } from '@/api/settlement'
import ContractList from '@/pages/contract/list'
import DisputeList from '@/pages/dispute/list'
import EvaluationList from '@/pages/evaluation/list'
import LogisticsList from '@/pages/logistics/list'
import MatchList from '@/pages/match/list'
import MyCompensation from '@/pages/mine-compensation'
import MyGuarantee from '@/pages/mine-guarantee'
import PriceList from '@/pages/price/list'
import QuoteList from '@/pages/quote/list'
import ProductCreate from '@/pages/product/create'
import { MemberCenterShell, type MemberNavItem } from './MemberCenterShell'
import './seller-center.css'
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
  { key: 'publish', label: '发布新商品', icon: <AppstoreAddOutlined /> },
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
]

const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`

const SELLER_STATUS = [
  { value: '', label: '全部' },
  { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '运输中' },
  { value: 'received', label: '已收货' },
  { value: 'completed', label: '已完成' },
]

export default function SellerCenter(): JSX.Element {
  const [params, setParams] = useSearchParams()
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
  // 卖家中心优先用 owner / seller 角色的主体展示商品与评价。
  const sellerMerchant = base.merchants.find((item) => item.roleInMerchant === 'owner' || item.roleInMerchant === 'seller')
    ?? base.primary
  const sellerId = sellerMerchant ? String(sellerMerchant.merchantId) : null
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
  const [tradeTab, setTradeTab] = useState<'quote' | 'match' | 'price'>('quote')
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
  const myDisputes = disputes.rows.filter((item) => base.merchantIds.includes(String(item.respondentId)))
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
    if (goodsStatus === 'soldout') return Number(item.stockQuantity ?? 0) <= 0
    return item.publishStatus === goodsStatus
  })

  const toggleProductStatus = async (productId: number, currentStatus: number): Promise<void> => {
    try {
      const body = await updateSellerProductStatus(productId, currentStatus === 1 ? 0 : 1)
      if (body?.code === 200) {
        message.success(currentStatus === 1 ? '商品已下架' : '商品已上架')
        products.reload()
      } else {
        message.error(body?.message ?? '商品状态更新失败')
      }
    } catch {
      message.error('商品状态更新失败')
    }
  }

  const shipOrder = (order: OrderRow): void => {
    Modal.confirm({
      title: '确认发货？',
      content: `订单 ${order.orderNo} · ${order.productName || order.categoryName || '订单商品'}。发货后物流单会进入运输中状态。`,
      okText: '确认发货',
      cancelText: '取消',
      onOk: async () => {
        try {
          const body = await shipOrderRequest(order.id, {
            carrierName: '平台物流',
            carrierNo: order.orderNo,
            logisticsType: 'road',
          })
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
    <div className="seller-overview">
      <section className="seller-overview-hero">
        <span className="seller-overview-icon"><ShopOutlined /></span>
        <div className="seller-overview-title">
          <small>SELLER BUSINESS CENTER</small>
          <h2>店铺经营工作台</h2>
          <p>{sellerMerchant?.merchantName || '当前经营主体'} · 商品、报价、履约和结算进度集中管理</p>
        </div>
        <div className="seller-overview-figures">
          <div><span>累计成交额</span><strong>{money(base.dashboard?.seller?.totalRevenue ?? 0)}</strong></div>
          <div><span>今日成交额</span><strong>{money(base.dashboard?.seller?.todayRevenue ?? 0)}</strong></div>
          <div><span>在架货源</span><strong>{base.dashboard?.seller?.activeProducts ?? 0}<em>个</em></strong></div>
        </div>
        <div className="seller-overview-actions">
          <button type="button" className="mc-btn" onClick={() => setActive('publish')}>
            <AppstoreAddOutlined /> 发布商品
          </button>
          <button type="button" className="mc-btn ghost" onClick={() => setActive('trade')}>
            报价与撮合 <ArrowRightOutlined />
          </button>
        </div>
      </section>

      <section className="seller-task-grid">
        {[
          { label: '待发货', value: sellerOrders.filter((item) => item.orderStatus === 'paid').length, tone: 'amber', icon: <TruckOutlined />, desc: '付款订单等待履约', tab: 'ship' },
          { label: '运输中', value: myLogistics.filter((item) => !/delivered|cancelled|已签收/i.test(item.logisticsStatus ?? '')).length, tone: 'tech', icon: <SendOutlined />, desc: '在途物流持续跟踪', tab: 'ship' },
          { label: '待处理售后', value: openDisputes.length, tone: 'red', icon: <CustomerServiceOutlined />, desc: '及时处理维护信用', tab: 'after' },
          { label: '收到询价', value: inquiries.length, tone: 'green', icon: <FileTextOutlined />, desc: '采购需求等待报价', tab: 'trade' },
        ].map((item) => (
          <button type="button" className={`seller-task ${item.tone}`} key={item.label} onClick={() => setActive(item.tab)}>
            <span className="seller-task-icon">{item.icon}</span>
            <span><small>{item.label}</small><strong>{item.value}<em>项</em></strong><i>{item.desc}</i></span>
            <ArrowRightOutlined />
          </button>
        ))}
      </section>

      <div className="seller-overview-layout">
        <div className="seller-overview-main">
          <Panel title="最近销售订单" extra={
            <button type="button" className="mc-link" onClick={() => setActive('sales')}>查看全部订单 <ArrowRightOutlined /></button>
          }>
            {renderSellerOrders(sellerOrders.slice(0, 5), allOrders.loading, allOrders.error, orderActions)}
          </Panel>
          <Panel title="经营线索">
            <div className="seller-lead-grid">
              <div><span className="seller-lead-icon"><AppstoreOutlined /></span><div><small>商品货源</small><strong>{products.rows.length}</strong><em>总浏览 {productViews} 次</em></div></div>
              <div><span className="seller-lead-icon tech"><FileTextOutlined /></span><div><small>收到询价</small><strong>{inquiries.length}</strong><em>等待供应商响应</em></div></div>
              <div><span className="seller-lead-icon amber"><StarOutlined /></span><div><small>店铺评分</small><strong>{avgRating == null ? '—' : avgRating.toFixed(1)}</strong><em>{evaluations.rows.length} 条真实评价</em></div></div>
              <div><span className="seller-lead-icon green"><TeamOutlined /></span><div><small>成交客户</small><strong>{customers.length}</strong><em>来自真实销售订单</em></div></div>
            </div>
          </Panel>
        </div>
        <aside className="seller-overview-aside">
          <Panel title="店铺信用">
            <div className="seller-rating-card">
              <strong>{avgRating == null ? '—' : avgRating.toFixed(1)}</strong>
              <div><span>{avgRating == null ? '暂无评分' : '综合评分'}</span><em>{'★'.repeat(Math.round(avgRating ?? 0))}</em><small>{evaluations.rows.length} 条评价</small></div>
            </div>
            <div className="seller-rating-lines">
              <div><span>描述相符</span><strong>{avgMetric(evaluations.rows, 'ratingQuality')}</strong></div>
              <div><span>服务态度</span><strong>{avgMetric(evaluations.rows, 'ratingService')}</strong></div>
              <div><span>发货速度</span><strong>{avgMetric(evaluations.rows, 'ratingDelivery')}</strong></div>
            </div>
          </Panel>
          <Panel title="资金概况" extra={<button type="button" className="mc-link" onClick={() => setActive('fund')}>结算明细</button>}>
            <div className="seller-fund-lines">
              <div><span>待结算金额</span><strong>{money(settlement?.summary.pendingAmount ?? 0)}</strong></div>
              <div><span>已结算应收</span><strong>{money(settlement?.summary.settledReceivable ?? 0)}</strong></div>
              <div><span>可用保证金</span><strong>{money(guaranteeAvailable)}</strong></div>
            </div>
          </Panel>
          <Panel title="快捷入口">
            <div className="seller-quick-list">
              {[
                { icon: <AppstoreAddOutlined />, title: '发布新商品', tab: 'publish' },
                { icon: <StarOutlined />, title: '报价与撮合', tab: 'trade' },
                { icon: <StarOutlined />, title: '评价与信用', tab: 'rate' },
                { icon: <TeamOutlined />, title: '客户管理', tab: 'customer' },
                { icon: <ApiOutlined />, title: '生产接入', tab: 'iot' },
              ].map((item) => (
                <button type="button" key={item.title} onClick={() => setActive(item.tab)}>
                  <span>{item.icon}</span><strong>{item.title}</strong><ArrowRightOutlined />
                </button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
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
        <button type="button" className="mc-btn ghost" onClick={() => setActive('publish')}>发布新商品</button>
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
    <div className="seller-workspace seller-trade-workspace">
      <section className="seller-workspace-hero">
        <span className="seller-workspace-icon"><StarOutlined /></span>
        <div><small>QUOTATION & MATCHING</small><h2>报价与撮合</h2><p>响应采购询价、查看智能匹配并按市场数据优化报价。</p></div>
        <div className="seller-workspace-stats">
          <div><span>收到询价</span><strong>{inquiries.length}</strong></div>
          <div><span>商品货源</span><strong>{products.rows.length}</strong></div>
          <div><span>店铺评分</span><strong>{avgRating == null ? '—' : avgRating.toFixed(1)}</strong></div>
        </div>
      </section>
      <div className="seller-switch-tabs">
        <button type="button" className={tradeTab === 'quote' ? 'on' : ''} onClick={() => setTradeTab('quote')}>
          <FileTextOutlined /><span><strong>报价管理</strong><small>询价响应与正式报价</small></span>
        </button>
        <button type="button" className={tradeTab === 'match' ? 'on' : ''} onClick={() => setTradeTab('match')}>
          <RiseOutlined /><span><strong>智能匹配</strong><small>需求与货源撮合评分</small></span>
        </button>
        <button type="button" className={tradeTab === 'price' ? 'on' : ''} onClick={() => setTradeTab('price')}>
          <BarChartOutlined /><span><strong>价格推荐</strong><small>市场价格与定价建议</small></span>
        </button>
      </div>
      <div className="seller-embedded-workbench">
        {tradeTab === 'quote' ? <QuoteList /> : tradeTab === 'match' ? <MatchList /> : <PriceList />}
      </div>
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
          {[{ value: 'all', label: '全部' }, { value: 'published', label: '在售' }, { value: 'pending', label: '待审核' }, { value: 'draft', label: '草稿' }, { value: 'rejected', label: '已驳回' }, { value: 'soldout', label: '已售罄' }].map((item) => (
            <button type="button" key={item.value} className={goodsStatus === item.value ? 'on' : ''}
              onClick={() => setGoodsStatus(item.value)}>{item.label}</button>
          ))}
        </div>
        <span className="mc-spacer" />
        <button type="button" className="mc-btn" onClick={() => setActive('publish')}>上架新商品</button>
      </div>
      <Panel title="商品管理">
        {products.loading ? (
          <EmptyState title="正在读取当前卖家的商品…" />
        ) : products.error ? (
          <EmptyState title="商品加载失败" desc={products.error} />
        ) : filteredProducts.length === 0 ? (
          <EmptyState title="没有符合条件的商品" desc="上架新商品后会出现在这里。"
            action={<button type="button" className="mc-btn" onClick={() => setActive('publish')}>上架新商品</button>} />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>图片</th><th>商品</th><th>品类</th><th>规格</th><th>单价</th><th>库存</th><th>发布状态</th><th>启停</th><th>操作</th></tr></thead>
              <tbody>
                {filteredProducts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.images?.[0]
                        ? <img src={item.images[0]} alt={item.productName} style={{ width: 42, height: 42, borderRadius: 7, objectFit: 'cover' }} />
                        : <span className="mc-tag ghost">无图</span>}
                    </td>
                    <td><strong>{item.productName}</strong><div className="mc-toolbar-muted">{item.productCode}</div></td>
                    <td>{item.categoryName ?? '—'}</td>
                    <td>{item.specSize ?? item.specLevel ?? '—'}</td>
                    <td className="mc-price">{money(item.price)}<span className="mc-unit">/{item.unit}</span></td>
                    <td className="mc-mono">{item.stockQuantity ?? '—'} {item.unit}</td>
                    <td><span className={`mc-tag ${item.publishStatus === 'published' ? 'green' : item.publishStatus === 'pending' ? 'amber' : 'ghost'}`}>{publishText(item.publishStatus)}</span></td>
                    <td><span className={`mc-tag ${item.status === 1 ? 'green' : 'ghost'}`}>{item.status === 1 ? '启用' : '停用'}</span></td>
                    <td>
                      <div className="mc-actions">
                        {item.publishStatus === 'published' && <a className="mc-link" href={`/product/detail/${item.id}`}>官网详情</a>}
                        <button type="button" className="mc-link" onClick={() => {
                          const next = new URLSearchParams(params)
                          next.set('tab', 'publish')
                          next.set('id', String(item.id))
                          if (sellerId) next.set('sellerId', sellerId)
                          setParams(next, { replace: true })
                        }}>编辑</button>
                        <button type="button" className="mc-link" onClick={() => void toggleProductStatus(item.id, item.status)}>
                          {item.status === 1 ? '下架' : '上架'}
                        </button>
                      </div>
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

  const renderSupply = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">我发布的供应信息 · 浏览与询单情况</span>
        <span className="mc-spacer" />
        <button type="button" className="mc-btn" onClick={() => setActive('publish')}>发布新商品</button>
      </div>
      <Panel title="供应信息">
        {products.rows.length === 0 ? (
          <EmptyState title="还没有发布供应" desc="发布货源后会在这里看到浏览与询单数据。"
            action={<button type="button" className="mc-btn" onClick={() => setActive('publish')}>发布新商品</button>} />
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
                    <td>
                      <div className="mc-actions">
                        <button type="button" className="mc-link" onClick={() => {
                          const next = new URLSearchParams(params)
                          next.set('tab', 'publish')
                          next.set('id', String(item.id))
                          if (sellerId) next.set('sellerId', sellerId)
                          setParams(next, { replace: true })
                        }}>编辑</button>
                        {item.publishStatus === 'published'
                          && <a className="mc-link" href={`/product/detail/${item.id}`}>官网详情</a>}
                      </div>
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

  const renderShip = (): JSX.Element => (
    <>
      <Panel title="待发货订单" extra={<span className="mc-toolbar-muted">付款后请及时安排发货</span>}>
        {sellerOrders.filter((item) => item.orderStatus === 'paid').length === 0 ? (
          <EmptyState title="没有待发货订单" desc="订单付款后会进入待发货，完成发货后可在下方物流管理中跟踪。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>订单号</th><th>商品</th><th>采购方</th><th>订单金额</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {sellerOrders.filter((item) => item.orderStatus === 'paid').map((order) => (
                  <tr key={`pending-${order.id}`}>
                    <td className="mc-mono">{order.orderNo}</td>
                    <td>{order.productName || order.categoryName || '—'}</td>
                    <td>{order.buyerName}</td>
                    <td className="mc-price">{money(order.totalAmount)}</td>
                    <td><span className="mc-tag amber">待发货</span></td>
                    <td><button type="button" className="mc-link" onClick={() => shipOrder(order)}>去发货</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <LogisticsList />
    </>
  )

  const renderAfter = (): JSX.Element => <DisputeList />

  const renderRate = (): JSX.Element => (
    <div className="seller-workspace seller-rating-workspace">
      <section className="seller-workspace-hero seller-rating-hero">
        <span className="seller-workspace-icon"><StarOutlined /></span>
        <div><small>STORE REPUTATION</small><h2>店铺评价与信用</h2><p>基于真实成交评价展示店铺服务水平，可回复评价或发起申诉。</p></div>
        <div className="seller-rating-score">
          <strong>{avgRating == null ? '—' : avgRating.toFixed(1)}</strong>
          <div><span>{avgRating == null ? '暂无评分' : '综合评分'}</span><em>{'★'.repeat(Math.round(avgRating ?? 0))}</em><small>{evaluations.rows.length} 条评价</small></div>
        </div>
      </section>
      <div className="seller-rating-metrics">
        <div><span>描述相符</span><strong>{avgMetric(evaluations.rows, 'ratingQuality')}</strong><em>商品与描述一致性</em></div>
        <div><span>服务态度</span><strong>{avgMetric(evaluations.rows, 'ratingService')}</strong><em>沟通与售后响应</em></div>
        <div><span>发货速度</span><strong>{avgMetric(evaluations.rows, 'ratingDelivery')}</strong><em>订单履约及时性</em></div>
        <div><span>评价总数</span><strong>{evaluations.rows.length}</strong><em>全部来自真实订单</em></div>
      </div>
      <Panel title="最新买家评价" extra={<span className="seller-section-note">展示最近公开评价</span>}>
        {evaluations.rows.length === 0 ? (
          <EmptyState title="还没有店铺评价" desc="订单完成后采购方可以评价，评价会展示在这里。" />
        ) : (
          <div className="seller-review-grid">
            {evaluations.rows.slice(0, 6).map((row) => (
              <div className="seller-review-card" key={row.id}>
                <div className="seller-review-head">
                  <span className="seller-review-avatar">{row.evaluatorName?.slice(0, 1) || '客'}</span>
                  <div><strong>{row.evaluatorName || '采购方'}</strong><small>订单 {row.orderId} · {shortDate(row.createTime)}</small></div>
                  <em>{'★'.repeat(Math.round(row.ratingOverall))}</em>
                </div>
                <p>{row.evaluationContent || '未填写文字评价'}</p>
                {row.replyContent && <div className="seller-review-reply">商家回复：{row.replyContent}</div>}
                <div className="seller-review-tags"><span>{row.ratingOverall} 分</span><span>{row.isAnonymous === 1 ? '匿名评价' : '实名评价'}</span></div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="评价管理与申诉" extra={<span className="mc-tag amber">信用分接口待接入</span>}>
        <div className="seller-credit-note">
          当前交易域只提供真实评价均分，没有独立信用分字段；不展示虚构的信用分或等级。
        </div>
        <div className="seller-embedded-workbench">
          <EvaluationList />
        </div>
      </Panel>
    </div>
  )

  const renderFund = (): JSX.Element => (
    <div className="seller-workspace seller-fund-workspace">
      <section className="seller-workspace-hero">
        <span className="seller-workspace-icon"><WalletOutlined /></span>
        <div><small>SETTLEMENT & FINANCE</small><h2>资金结算</h2><p>查看订单应收、平台服务费、保证金、赔付与结算进度。</p></div>
        <div className="seller-workspace-stats">
          <div><span>待结算</span><strong>{money(settlement?.summary.pendingAmount ?? 0)}</strong></div>
          <div><span>已结算应收</span><strong>{money(settlement?.summary.settledReceivable ?? 0)}</strong></div>
          <div><span>可用保证金</span><strong>{money(guaranteeAvailable)}</strong></div>
        </div>
      </section>
      <div className="seller-finance-metrics">
        <div><span>待结算订单</span><strong>{settlement?.summary.pendingCount ?? 0}<em>笔</em></strong><small>预估应收 {money(settlement?.summary.pendingReceivable ?? 0)}</small></div>
        <div><span>已结算订单</span><strong>{settlement?.summary.settledCount ?? 0}<em>笔</em></strong><small>累计应收 {money(settlement?.summary.settledReceivable ?? 0)}</small></div>
        <div><span>平台服务费</span><strong>{money(settlement?.summary.settledFee ?? 0)}</strong><small>已结算订单累计</small></div>
        <div><span>冻结保证金</span><strong>{money(guaranteeFrozen)}</strong><small>在途订单与纠纷占用</small></div>
      </div>
      <div className="seller-finance-history">
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
      </div>
      <div className="seller-finance-support">
        <div><MyGuarantee /></div>
        <div><MyCompensation /></div>
      </div>
      <Panel title="提现申请">
        <EmptyState title="提现申请尚未开放" desc="当前只提供结算单与应收金额查询；提现涉及打款，需接入资金通道与审批流后再开放。" />
      </Panel>
    </div>
  )

  const renderCustomer = (): JSX.Element => (
    <div className="seller-workspace seller-customer-workspace">
      <section className="seller-workspace-hero">
        <span className="seller-workspace-icon"><TeamOutlined /></span>
        <div><small>CUSTOMER RELATIONSHIP</small><h2>客户管理</h2><p>采购商档案由真实销售订单聚合，展示成交规模与最近采购。</p></div>
        <div className="seller-workspace-stats">
          <div><span>成交客户</span><strong>{customers.length}</strong></div>
          <div><span>客户订单</span><strong>{customers.reduce((sum, item) => sum + item.count, 0)}</strong></div>
          <div><span>累计成交</span><strong>{money(customers.reduce((sum, item) => sum + item.total, 0))}</strong></div>
        </div>
      </section>
      <div className="seller-customer-toolbar">
        <div><strong>客户档案</strong><span>按累计采购额排序</span></div>
        <a className="mc-btn ghost" href="/member/seller?tab=ship">查看待发货订单 <ArrowRightOutlined /></a>
      </div>
      {customers.length === 0 ? (
        <Panel><EmptyState title="还没有成交客户" desc="产生销售订单后，采购商会自动汇总到这里。" /></Panel>
      ) : (
        <div className="seller-customer-grid">
          {customers.map((row, index) => (
            <div className={`seller-customer-card${row.total >= 2000000 ? ' vip' : ''}`} key={row.id}>
              <div className="seller-customer-head">
                <span className="seller-customer-avatar">{row.name?.slice(0, 1) || '客'}</span>
                <div><small>采购主体 #{index + 1}</small><strong>{row.name}</strong></div>
                <span className={`mc-tag ${row.total >= 2000000 ? 'tech' : 'ghost'}`}>
                  {row.total >= 2000000 ? '重点客户' : '普通客户'}
                </span>
              </div>
              <div className="seller-customer-figures">
                <div><span>累计采购额</span><strong>{money(row.total)}</strong></div>
                <div><span>订单数量</span><strong>{row.count}<em>笔</em></strong></div>
              </div>
              <div className="seller-customer-foot">
                <span>最近下单</span><strong>{shortDate(row.last)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderIot = (): JSX.Element => (
    <div className="seller-workspace seller-iot-workspace">
      <section className="seller-iot-hero">
        <span className="seller-workspace-icon"><CloudServerOutlined /></span>
        <div><small>PRODUCTION INTEGRATION</small><h2>生产接入</h2><p>将生产管理中的地块、设备和环境数据与交易货源关联，形成可追溯供应能力。</p></div>
        <a className="mc-btn" href="/production/dashboard">前往生产管理 <ArrowRightOutlined /></a>
      </section>
      <div className="seller-iot-steps">
        {[
          { num: '01', title: '设备登记', desc: '在生产管理登记设备型号、通信协议和接入参数。', icon: <ApiOutlined /> },
          { num: '02', title: '地块绑定', desc: '把设备与生产基地、地块绑定，建立采集点位。', icon: <AppstoreOutlined /> },
          { num: '03', title: '数据上云', desc: '环境与生产数据持续沉淀，为溯源和商品资料背书。', icon: <CloudServerOutlined /> },
        ].map((item) => (
          <div className="seller-iot-step" key={item.num}>
            <span>{item.num}</span>
            <i>{item.icon}</i>
            <strong>{item.title}</strong>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="seller-iot-layout">
        <Panel title="接入说明">
          <div className="seller-iot-note">
            <p><SafetyCertificateOutlined /> 生产域独立部署在生产管理子系统，交易域只展示有真实来源的数据。</p>
            <p><CheckCircleFilled /> 完成地块与设备绑定后，可在商品资料中关联采收批次与溯源信息。</p>
            <p><RiseOutlined /> 实时监测数据可以提升商品详情可信度，并支撑供应能力展示。</p>
          </div>
        </Panel>
        <aside className="seller-iot-action">
          <CloudServerOutlined />
          <strong>进入生产管理工作台</strong>
          <span>管理生产基地、地块、设备和环境监测</span>
          <a className="mc-btn" href="/production/dashboard">立即前往</a>
        </aside>
      </div>
    </div>
  )

  const content = active === 'publish' ? <ProductCreate embedded />
    : active === 'sales' ? renderSales()
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

function avgMetric(rows: { ratingQuality: number; ratingService: number; ratingDelivery: number }[], key: 'ratingQuality' | 'ratingService' | 'ratingDelivery'): string {
  if (!rows.length) return '—'
  return (rows.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / rows.length).toFixed(1)
}
