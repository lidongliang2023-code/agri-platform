import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { message } from 'antd'
import {
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HomeOutlined,
  InboxOutlined,
  LogoutOutlined,
  ProfileOutlined,
  ReloadOutlined,
  RightOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TruckOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { BrandMark } from '@/components/BrandMark'
import { getHomeSummary, type HomeSummary } from '@/api/home'
import {
  getPublicProductById,
  getPublicProductImages,
} from '@/api/product'
import { createDemand } from '@/api/demand'
import {
  confirmReceipt,
  createOrderFromProduct,
  getOrderById,
  getOrderItems,
  getOrderList,
  payOrder,
  shipOrder,
} from '@/api/order'
import { getContractById, getContractList, type ContractVO } from '@/api/contract'
import { getLogisticsList, type LogisticsVO } from '@/api/logistics'
import { getMyMerchants, type MyMerchant } from '@/api/identity'
import { getMyGuarantees, type GuaranteeRow } from '@/api/guarantee'
import { matchDemandToProducts, type MatchResult } from '@/api/match'
import { CHINA_REGIONS, getChinaCities } from '@/data/chinaRegions'
import { clearSession, getCurrentUser, isLoggedIn } from '@/utils/session'
import { redirectToSso, ssoLogoutUrl } from '@/utils/sso'
import './mobile-trade.css'

type MainTab = 'home' | 'market' | 'match' | 'orders' | 'profile'
type OrderSide = 'buyer' | 'seller'
type MarketMode = 'supply' | 'demand'

type MobilePage =
  | { type: 'main' }
  | { type: 'product'; productId: number }
  | { type: 'checkout'; productId: number }
  | { type: 'demands' }
  | { type: 'demand-create' }
  | { type: 'order-detail'; orderId: number }
  | { type: 'contracts' }
  | { type: 'contract-detail'; contractId: number }
  | { type: 'logistics' }
  | { type: 'wallet' }
  | { type: 'notifications' }

interface PublicProduct {
  id: number
  productName: string
  sellerId: number | string
  sellerName?: string | null
  categoryId?: number | null
  categoryName?: string | null
  variety?: string | null
  specification?: string | null
  unit: string
  price?: number | null
  priceMin?: number | null
  priceMax?: number | null
  stockQuantity?: number | null
  minOrderQuantity?: number | null
  salesVolume?: number | null
  originProvince?: string | null
  originCity?: string | null
  originDistrict?: string | null
  originAddress?: string | null
  description?: string | null
  publishStatus?: string
}

interface PublicDemand {
  id: number
  demandNo: string
  demandName: string
  buyerId?: number | string
  buyerName: string
  productName?: string | null
  categoryId?: number | null
  categoryName?: string | null
  variety?: string | null
  quantity: number
  unit?: string | null
  priceMin?: number | null
  priceMax?: number | null
  deliveryAddress?: string | null
  demandStatus: string
  responseCount?: number | null
  createTime: string
}

interface CategoryRow {
  id: number
  categoryName: string
  parentId?: number | null
  level?: number
}

interface ProductImage {
  id: number
  imageUrl: string
  sortOrder?: number
}

interface OrderItem {
  id: number
  productId: number
  productName: string
  specLevel?: string | null
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface OrderDetailData {
  id: number
  orderNo: string
  buyerId: number | string
  buyerName: string
  sellerId: number | string
  sellerName: string
  categoryName?: string | null
  productName?: string | null
  totalQuantity?: number | null
  goodsAmount?: number | null
  freightAmount?: number | null
  totalAmount: number
  paidAmount?: number | null
  paymentStatus: string
  paymentMethod?: string | null
  orderStatus: string
  deliveryProvince?: string | null
  deliveryCity?: string | null
  deliveryAddress?: string | null
  deliveryContact?: string | null
  deliveryPhone?: string | null
  logisticsNo?: string | null
  logisticsStatus?: string | null
  createTime: string
}

interface DemandDraft {
  demandName: string
  productName: string
  variety: string
  categoryId: string
  quantity: string
  unit: string
  priceMin: string
  priceMax: string
  deliveryAddress: string
  additionalRequirements: string
}

interface CheckoutDraft {
  quantity: string
  freightAmount: string
  deliveryContact: string
  deliveryPhone: string
  deliveryProvince: string
  deliveryCity: string
  deliveryAddress: string
}

const EMPTY_SUMMARY: HomeSummary = {
  stat: { tradeAmount: 0, dealCount: 0, participantCount: 0, publishedProductCount: 0 },
  categoryQuotes: [],
  recentDeals: [],
}

const EMPTY_DEMAND: DemandDraft = {
  demandName: '',
  productName: '',
  variety: '',
  categoryId: '',
  quantity: '',
  unit: '吨',
  priceMin: '',
  priceMax: '',
  deliveryAddress: '',
  additionalRequirements: '',
}

const EMPTY_CHECKOUT: CheckoutDraft = {
  quantity: '1',
  freightAmount: '0',
  deliveryContact: '',
  deliveryPhone: '',
  deliveryProvince: '',
  deliveryCity: '',
  deliveryAddress: '',
}

const NAV_ITEMS: { key: MainTab; label: string; icon: JSX.Element }[] = [
  { key: 'home', label: '首页', icon: <HomeOutlined /> },
  { key: 'market', label: '市场', icon: <ShoppingOutlined /> },
  { key: 'match', label: '智能撮合', icon: <RobotOutlined /> },
  { key: 'orders', label: '订单', icon: <ProfileOutlined /> },
  { key: 'profile', label: '我的', icon: <UserOutlined /> },
]

const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  pending_confirm: '待确认',
  matching: '撮合中',
  quoted: '待选价',
  paid: '待发货',
  shipped: '待收货',
  received: '已收货',
  completed: '已完成',
  closed: '已关闭',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
  signed: '已签署',
  effective: '生效中',
  executing: '执行中',
  pending_sign: '待签署',
  picked: '已揽收',
  in_transit: '运输中',
  delivering: '派送中',
  delivered: '已签收',
  exception: '异常',
  active: '生效中',
  rejected: '已驳回',
  expired: '已到期',
  unpaid: '未支付',
}

const money = (value: number | null | undefined, fallback = '询价'): string => (
  value == null
    ? fallback
    : `¥${Number(value).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
)

const compactMoney = (value: number | null | undefined): string => {
  const amount = Number(value ?? 0)
  if (amount >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(2)}亿`
  if (amount >= 10_000) return `¥${(amount / 10_000).toFixed(1)}万`
  return money(amount)
}

const shortDate = (value?: string | null): string => value?.replace('T', ' ').slice(0, 16) || '—'

const statusText = (value?: string | null): string => STATUS_TEXT[value ?? ''] ?? value ?? '未知'

const statusTone = (value?: string | null): string => {
  if (['completed', 'received', 'signed', 'effective', 'active', 'delivered', 'paid'].includes(value ?? '')) return 'green'
  if (['cancelled', 'closed', 'rejected', 'exception', 'refunded'].includes(value ?? '')) return 'red'
  if (['pending', 'pending_confirm', 'matching', 'quoted', 'pending_sign', 'unpaid'].includes(value ?? '')) return 'amber'
  return 'blue'
}

const productGlyph = (product: Pick<PublicProduct, 'categoryName' | 'productName'>): string => {
  const category = product.categoryName ?? ''
  if (/果|水果/.test(category)) return '果'
  if (/菜|蔬菜/.test(category)) return '蔬'
  if (/粮|米|稻/.test(category)) return '粮'
  if (/茶/.test(category)) return '茶'
  if (/肉|禽|畜/.test(category)) return '牧'
  if (/水产|鱼/.test(category)) return '渔'
  return product.productName?.slice(0, 1) || '农'
}

async function fetchHallProducts(params: {
  pageNum?: number
  pageSize?: number
  keyword?: string
  categoryId?: string
  sort?: string
}): Promise<{ records: PublicProduct[]; total: number }> {
  const query = new URLSearchParams({
    pageNum: String(params.pageNum ?? 1),
    pageSize: String(params.pageSize ?? 20),
    sort: params.sort || 'latest',
  })
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
  if (params.categoryId) query.set('categoryIds', params.categoryId)
  const response = await fetch(`/api/trade/public/hall/products?${query.toString()}`)
  const body = await response.json() as {
    code?: number
    message?: string
    data?: { records?: PublicProduct[]; total?: number } | PublicProduct[]
  }
  if (body.code !== 200) throw new Error(body.message ?? '货源加载失败')
  if (Array.isArray(body.data)) return { records: body.data, total: body.data.length }
  return { records: body.data?.records ?? [], total: body.data?.total ?? 0 }
}

async function fetchPublicDemands(): Promise<PublicDemand[]> {
  const response = await fetch('/api/trade/public/demands')
  const body = await response.json() as { code?: number; message?: string; data?: PublicDemand[] }
  if (body.code !== 200) throw new Error(body.message ?? '采购需求加载失败')
  return Array.isArray(body.data) ? body.data : []
}

async function fetchPublicCategories(): Promise<CategoryRow[]> {
  const response = await fetch('/api/trade/public/categories')
  const body = await response.json() as { code?: number; message?: string; data?: CategoryRow[] }
  if (body.code !== 200) throw new Error(body.message ?? '商品分类加载失败')
  return Array.isArray(body.data) ? body.data : []
}

function LoadingBlock({ label = '正在加载' }: { label?: string }): JSX.Element {
  return (
    <div className="mt-loading" role="status">
      <span />
      <p>{label}</p>
    </div>
  )
}

function EmptyBlock({
  title,
  desc,
  action,
}: {
  title: string
  desc: string
  action?: JSX.Element
}): JSX.Element {
  return (
    <div className="mt-empty">
      <span><InboxOutlined /></span>
      <strong>{title}</strong>
      <p>{desc}</p>
      {action}
    </div>
  )
}

function StatusPill({ value }: { value?: string | null }): JSX.Element {
  return <span className={`mt-status ${statusTone(value)}`}>{statusText(value)}</span>
}

function ProductCard({
  product,
  onOpen,
}: {
  product: PublicProduct
  onOpen: () => void
}): JSX.Element {
  const price = product.price ?? product.priceMin ?? null
  return (
    <button type="button" className="mt-product-card" onClick={onOpen}>
      <span className="mt-product-visual">
        <small>{product.categoryName ?? '农产品'}</small>
        <strong>{productGlyph(product)}</strong>
        <em>{product.originCity || product.originProvince || '产地优选'}</em>
      </span>
      <span className="mt-product-body">
        <strong>{product.productName}</strong>
        <small>{[product.variety, product.specification].filter(Boolean).join(' · ') || '品质货源 · 平台保障'}</small>
        <span className="mt-product-price">
          <b>{money(price)}</b>
          <em>/{product.unit}</em>
        </span>
        <span className="mt-product-meta">
          <span>{product.sellerName || '认证供应商'}</span>
          <span>{Number(product.stockQuantity ?? 0) > 0 ? `余 ${product.stockQuantity}${product.unit}` : '询价确认'}</span>
        </span>
      </span>
    </button>
  )
}

export default function MobileTrade(): JSX.Element {
  const currentUser = getCurrentUser()
  const loggedIn = isLoggedIn()
  const [tab, setTab] = useState<MainTab>('home')
  const [stack, setStack] = useState<MobilePage[]>([{ type: 'main' }])
  const [summary, setSummary] = useState<HomeSummary>(EMPTY_SUMMARY)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [recommended, setRecommended] = useState<PublicProduct[]>([])
  const [demands, setDemands] = useState<PublicDemand[]>([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [marketMode, setMarketMode] = useState<MarketMode>('supply')
  const [marketProducts, setMarketProducts] = useState<PublicProduct[]>([])
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [marketKeyword, setMarketKeyword] = useState('')
  const [marketCategory, setMarketCategory] = useState('')
  const [marketSort, setMarketSort] = useState('latest')
  const [detailProduct, setDetailProduct] = useState<PublicProduct | null>(null)
  const [detailImages, setDetailImages] = useState<ProductImage[]>([])
  const [detailImageFailed, setDetailImageFailed] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailQuantity, setDetailQuantity] = useState('1')
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft>(EMPTY_CHECKOUT)
  const [checkoutSaving, setCheckoutSaving] = useState(false)
  const [demandDraft, setDemandDraft] = useState<DemandDraft>(EMPTY_DEMAND)
  const [demandSaving, setDemandSaving] = useState(false)
  const [orders, setOrders] = useState<OrderDetailData[]>([])
  const [orderSide, setOrderSide] = useState<OrderSide>('buyer')
  const [orderFilter, setOrderFilter] = useState('all')
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderDetail, setOrderDetail] = useState<OrderDetailData | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderDetailLoading, setOrderDetailLoading] = useState(false)
  const [orderAction, setOrderAction] = useState('')
  const [contracts, setContracts] = useState<ContractVO[]>([])
  const [contractDetail, setContractDetail] = useState<ContractVO | null>(null)
  const [contractsLoading, setContractsLoading] = useState(false)
  const [logistics, setLogistics] = useState<LogisticsVO[]>([])
  const [logisticsLoading, setLogisticsLoading] = useState(false)
  const [merchants, setMerchants] = useState<MyMerchant[]>([])
  const [guarantees, setGuarantees] = useState<GuaranteeRow[]>([])
  const [accountLoading, setAccountLoading] = useState(false)
  const [matchDemandId, setMatchDemandId] = useState<number | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [matching, setMatching] = useState(false)

  const page = stack[stack.length - 1] ?? { type: 'main' }
  const merchantName = merchants[0]?.merchantName
    || currentUser?.nickname
    || currentUser?.username
    || '访客用户'
  const merchantIds = useMemo(
    () => new Set(merchants.map((merchant) => String(merchant.merchantId))),
    [merchants],
  )

  const pushPage = useCallback((next: MobilePage): void => {
    setStack((current) => [...current, next])
  }, [])

  const goBack = useCallback((): void => {
    setStack((current) => current.length > 1 ? current.slice(0, -1) : current)
  }, [])

  const switchTab = useCallback((next: MainTab): void => {
    setTab(next)
    setStack([{ type: 'main' }])
  }, [])

  const goLogin = useCallback((): void => {
    void redirectToSso(`${window.location.pathname}${window.location.search}`)
  }, [])

  const requireLogin = useCallback((): boolean => {
    if (isLoggedIn()) return true
    message.info('登录后可继续完成交易')
    goLogin()
    return false
  }, [goLogin])

  const loadHome = useCallback(async (): Promise<void> => {
    setHomeLoading(true)
    const tasks = await Promise.allSettled([
      isLoggedIn() ? getHomeSummary() : Promise.resolve(null),
      fetchPublicCategories(),
      fetchHallProducts({ pageNum: 1, pageSize: 10 }),
      fetchPublicDemands(),
    ])
    if (tasks[0].status === 'fulfilled' && tasks[0].value
      && 'code' in tasks[0].value && tasks[0].value.code === 200 && tasks[0].value.data) {
      setSummary(tasks[0].value.data as HomeSummary)
    }
    if (tasks[1].status === 'fulfilled') {
      setCategories(tasks[1].value)
    }
    if (tasks[2].status === 'fulfilled') setRecommended(tasks[2].value.records)
    if (tasks[3].status === 'fulfilled') setDemands(tasks[3].value)
    setHomeLoading(false)
  }, [])

  const loadMarket = useCallback(async (): Promise<void> => {
    setMarketLoading(true)
    setMarketError('')
    try {
      const result = await fetchHallProducts({
        pageNum: 1,
        pageSize: 30,
        keyword: marketKeyword,
        categoryId: marketCategory,
        sort: marketSort,
      })
      setMarketProducts(result.records)
    } catch (error) {
      setMarketProducts([])
      setMarketError(error instanceof Error ? error.message : '货源加载失败')
    } finally {
      setMarketLoading(false)
    }
  }, [marketCategory, marketKeyword, marketSort])

  const loadOrders = useCallback(async (): Promise<void> => {
    if (!isLoggedIn()) return
    setOrdersLoading(true)
    try {
      const response = await getOrderList({ pageNum: 1, pageSize: 30, side: orderSide })
      if (response?.code === 200) {
        setOrders(response.data?.records ?? [])
      }
    } catch {
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [orderSide])

  const loadContracts = useCallback(async (): Promise<void> => {
    if (!isLoggedIn()) return
    setContractsLoading(true)
    try {
      const response = await getContractList({ pageNum: 1, pageSize: 30 })
      if (response?.code === 200) setContracts(response.data?.records ?? [])
    } catch {
      setContracts([])
    } finally {
      setContractsLoading(false)
    }
  }, [])

  const loadLogistics = useCallback(async (): Promise<void> => {
    if (!isLoggedIn()) return
    setLogisticsLoading(true)
    try {
      const response = await getLogisticsList({ pageNum: 1, pageSize: 30 })
      if (response?.code === 200) setLogistics(response.data?.records ?? [])
    } catch {
      setLogistics([])
    } finally {
      setLogisticsLoading(false)
    }
  }, [])

  const loadAccount = useCallback(async (): Promise<void> => {
    if (!isLoggedIn()) return
    setAccountLoading(true)
    const results = await Promise.allSettled([
      getMyMerchants(),
      getMyGuarantees(),
    ])
    if (results[0].status === 'fulfilled' && results[0].value?.code === 200) {
      setMerchants(results[0].value.data ?? [])
    }
    if (results[1].status === 'fulfilled' && results[1].value?.code === 200) {
      setGuarantees(Array.isArray(results[1].value.data) ? results[1].value.data : [])
    }
    setAccountLoading(false)
  }, [])

  useEffect(() => {
    void loadHome()
    if (isLoggedIn()) {
      void loadAccount()
      void loadOrders()
    }
  }, [loadAccount, loadHome, loadOrders])

  useEffect(() => {
    if (tab === 'market' || page.type === 'main') void loadMarket()
  }, [loadMarket, page.type, tab])

  useEffect(() => {
    if (tab === 'orders') void loadOrders()
  }, [loadOrders, tab])

  useEffect(() => {
    if (demands.length > 0 && matchDemandId == null) setMatchDemandId(demands[0].id)
  }, [demands, matchDemandId])

  useEffect(() => {
    if (page.type !== 'product' && page.type !== 'checkout') return
    let cancelled = false
    setDetailLoading(true)
    Promise.all([
      getPublicProductById(page.productId),
      getPublicProductImages(page.productId),
    ])
      .then(([productResponse, imageResponse]) => {
        if (cancelled) return
        if (productResponse?.code !== 200 || !productResponse.data) {
          message.error(productResponse?.message ?? '商品不存在或已下架')
          return
        }
        const product = productResponse.data as PublicProduct
        setDetailProduct(product)
        setDetailImages(imageResponse?.code === 200 ? imageResponse.data ?? [] : [])
        setDetailImageFailed(false)
        setDetailQuantity(String(Number(product.minOrderQuantity ?? 1)))
        setCheckoutDraft((current) => ({
          ...current,
          quantity: String(Number(product.minOrderQuantity ?? 1)),
        }))
      })
      .catch(() => message.error('商品详情加载失败'))
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

  useEffect(() => {
    if (page.type !== 'order-detail') return
    let cancelled = false
    setOrderDetailLoading(true)
    Promise.all([
      getOrderById(page.orderId),
      getOrderItems(page.orderId),
    ])
      .then(([orderResponse, itemResponse]) => {
        if (cancelled) return
        if (orderResponse?.code === 200) setOrderDetail(orderResponse.data ?? null)
        if (itemResponse?.code === 200) setOrderItems(itemResponse.data ?? [])
      })
      .catch(() => message.error('订单详情加载失败'))
      .finally(() => {
        if (!cancelled) setOrderDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

  useEffect(() => {
    if (page.type === 'contracts') void loadContracts()
    if (page.type === 'logistics') void loadLogistics()
    if (page.type !== 'contract-detail') return
    let cancelled = false
    setContractsLoading(true)
    getContractById(page.contractId)
      .then((response) => {
        if (!cancelled && response?.code === 200) setContractDetail(response.data ?? null)
      })
      .catch(() => message.error('合同加载失败'))
      .finally(() => {
        if (!cancelled) setContractsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadContracts, loadLogistics, page])

  useEffect(() => {
    const titles: Record<string, string> = {
      product: '商品详情',
      checkout: '确认采购',
      demands: '采购需求',
      'demand-create': '发布采购需求',
      'order-detail': '订单详情',
      contracts: '我的合同',
      'contract-detail': '合同详情',
      logistics: '物流跟踪',
      wallet: '资金与保证金',
      notifications: '交易提醒',
    }
    document.title = page.type === 'main'
      ? `${NAV_ITEMS.find((item) => item.key === tab)?.label ?? '首页'} · 丰链云交易`
      : `${titles[page.type] ?? '交易撮合'} · 丰链云`
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [page.type, tab])

  const openProduct = (product: PublicProduct): void => {
    setDetailProduct(product)
    setDetailImages([])
    pushPage({ type: 'product', productId: product.id })
  }

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault()
    setMarketKeyword(searchInput.trim())
    setMarketMode('supply')
    setTab('market')
    setStack([{ type: 'main' }])
  }

  const selectCategory = (categoryId: string): void => {
    setMarketCategory(categoryId)
    setMarketMode('supply')
    setTab('market')
    setStack([{ type: 'main' }])
  }

  const openDemandCreate = (product?: PublicProduct): void => {
    if (!requireLogin()) return
    setDemandDraft({
      ...EMPTY_DEMAND,
      demandName: product ? `${product.productName} 采购需求` : '',
      productName: product?.productName ?? '',
      variety: product?.variety ?? '',
      categoryId: product?.categoryId ? String(product.categoryId) : '',
      unit: product?.unit || '吨',
      priceMin: product?.priceMin != null ? String(product.priceMin) : '',
      priceMax: product?.priceMax != null ? String(product.priceMax) : '',
    })
    pushPage({ type: 'demand-create' })
  }

  const openCheckout = (): void => {
    if (!requireLogin()) return
    if (!detailProduct) return
    const quantity = Number(detailQuantity)
    const min = Number(detailProduct.minOrderQuantity ?? 1)
    if (!Number.isFinite(quantity) || quantity < min) {
      message.warning(`采购数量不能低于 ${min}${detailProduct.unit}`)
      return
    }
    setCheckoutDraft((current) => ({ ...current, quantity: String(quantity) }))
    pushPage({ type: 'checkout', productId: detailProduct.id })
  }

  const submitCheckout = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!detailProduct || !requireLogin()) return
    const quantity = Number(checkoutDraft.quantity)
    const min = Number(detailProduct.minOrderQuantity ?? 1)
    if (!Number.isFinite(quantity) || quantity < min) {
      message.warning(`采购数量不能低于 ${min}${detailProduct.unit}`)
      return
    }
    if (!checkoutDraft.deliveryContact.trim() || !checkoutDraft.deliveryPhone.trim()
      || !checkoutDraft.deliveryProvince || !checkoutDraft.deliveryCity
      || !checkoutDraft.deliveryAddress.trim()) {
      message.warning('请完整填写收货信息')
      return
    }
    setCheckoutSaving(true)
    try {
      const response = await createOrderFromProduct({
        productId: detailProduct.id,
        quantity,
        freightAmount: Number(checkoutDraft.freightAmount || 0),
        deliveryProvince: checkoutDraft.deliveryProvince,
        deliveryCity: checkoutDraft.deliveryCity,
        deliveryAddress: checkoutDraft.deliveryAddress.trim(),
        deliveryContact: checkoutDraft.deliveryContact.trim(),
        deliveryPhone: checkoutDraft.deliveryPhone.trim(),
      })
      if (response?.code === 200 && response.data?.id) {
        message.success('采购订单已创建')
        await loadOrders()
        setStack([{ type: 'main' }, { type: 'order-detail', orderId: response.data.id }])
        setTab('orders')
      } else {
        message.error(response?.message ?? '订单创建失败')
      }
    } catch {
      message.error('订单创建失败，请检查交易服务')
    } finally {
      setCheckoutSaving(false)
    }
  }

  const submitDemand = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!requireLogin()) return
    if (!demandDraft.demandName.trim() || !demandDraft.categoryId
      || !Number(demandDraft.quantity) || !demandDraft.unit) {
      message.warning('请填写需求标题、品类、数量和单位')
      return
    }
    const category = categories.find((item) => String(item.id) === demandDraft.categoryId)
    setDemandSaving(true)
    try {
      const response = await createDemand({
        demandName: demandDraft.demandName.trim(),
        productName: demandDraft.productName.trim() || demandDraft.demandName.trim(),
        variety: demandDraft.variety.trim() || undefined,
        categoryId: Number(demandDraft.categoryId),
        categoryName: category?.categoryName,
        demandType: 'spot',
        quantity: Number(demandDraft.quantity),
        unit: demandDraft.unit,
        priceMin: demandDraft.priceMin ? Number(demandDraft.priceMin) : undefined,
        priceMax: demandDraft.priceMax ? Number(demandDraft.priceMax) : undefined,
        deliveryAddress: demandDraft.deliveryAddress.trim() || undefined,
        additionalRequirements: demandDraft.additionalRequirements.trim() || undefined,
      })
      if (response?.code === 200) {
        message.success('采购需求已发布')
        const next = await fetchPublicDemands()
        setDemands(next)
        setStack([{ type: 'main' }])
        setTab('match')
      } else {
        message.error(response?.message ?? '需求发布失败')
      }
    } catch {
      message.error('需求发布失败，请检查交易服务')
    } finally {
      setDemandSaving(false)
    }
  }

  const runMatch = async (): Promise<void> => {
    if (!requireLogin()) return
    if (!matchDemandId) {
      message.warning('请先发布或选择采购需求')
      return
    }
    setMatching(true)
    try {
      const response = await matchDemandToProducts(matchDemandId, 10)
      if (response?.code === 200) {
        setMatchResults(response.data ?? [])
        message.success(`已完成撮合，共推荐 ${(response.data ?? []).length} 个货源`)
      } else {
        setMatchResults([])
        message.warning(response?.message ?? '暂未匹配到合适货源')
      }
    } catch {
      setMatchResults([])
      message.error('智能撮合失败，请检查交易服务')
    } finally {
      setMatching(false)
    }
  }

  const changeOrderStatus = async (action: 'pay' | 'ship' | 'receive'): Promise<void> => {
    if (!orderDetail || !requireLogin()) return
    const labels = { pay: '确认支付该订单？', ship: '确认发货并生成物流单？', receive: '确认已经收到货物？' }
    if (!window.confirm(labels[action])) return
    setOrderAction(action)
    try {
      const response = action === 'pay'
        ? await payOrder(orderDetail.id, { paymentMethod: 'transfer' })
        : action === 'ship'
          ? await shipOrder(orderDetail.id, { carrierName: '平台物流', logisticsType: 'road' })
          : await confirmReceipt(orderDetail.id, { signReceiver: orderDetail.deliveryContact ?? merchantName })
      if (response?.code === 200) {
        message.success(action === 'pay' ? '支付成功' : action === 'ship' ? '已发货' : '已确认收货')
        const [nextOrder] = await Promise.all([
          getOrderById(orderDetail.id),
          loadOrders(),
        ])
        if (nextOrder?.code === 200) setOrderDetail(nextOrder.data ?? null)
      } else {
        message.error(response?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败，请稍后重试')
    } finally {
      setOrderAction('')
    }
  }

  const openProtectedPage = (next: MobilePage): void => {
    if (!requireLogin()) return
    pushPage(next)
  }

  const activeOrders = orders.filter((order) => !['completed', 'cancelled', 'closed'].includes(order.orderStatus))
  const completedOrders = orders.filter((order) => order.orderStatus === 'completed')
  const filteredOrders = orders.filter((order) => {
    if (orderFilter === 'active') return activeOrders.includes(order)
    if (orderFilter === 'complete') return completedOrders.includes(order)
    return true
  })
  const availableGuarantee = guarantees
    .filter((item) => item.guaranteeStatus === 'active'
      && (!item.expireTime || new Date(item.expireTime).getTime() > Date.now()))
    .reduce((total, item) => total + Number(item.availableAmount ?? 0), 0)
  const checkoutCities = getChinaCities(checkoutDraft.deliveryProvince)
  const checkoutProductPrice = detailProduct?.price ?? detailProduct?.priceMin ?? 0
  const checkoutEstimate = Number(checkoutProductPrice) * Number(checkoutDraft.quantity || 0)
  const selectedDemand = demands.find((item) => item.id === matchDemandId)
  const notifications = orders.slice(0, 8)
  const publicQuotes = useMemo(() => {
    if (summary.categoryQuotes.length > 0) return summary.categoryQuotes
    const groups = new Map<string, { categoryName: string; productCount: number; minPrice: number; maxPrice: number }>()
    recommended.forEach((product) => {
      const price = Number(product.price ?? product.priceMin ?? 0)
      if (!price) return
      const categoryName = product.categoryName || '其他农产品'
      const current = groups.get(categoryName) ?? {
        categoryName,
        productCount: 0,
        minPrice: price,
        maxPrice: price,
      }
      current.productCount += 1
      current.minPrice = Math.min(current.minPrice, price)
      current.maxPrice = Math.max(current.maxPrice, price)
      groups.set(categoryName, current)
    })
    return Array.from(groups.values()).sort((a, b) => b.productCount - a.productCount).slice(0, 6)
  }, [recommended, summary.categoryQuotes])

  const renderHeader = (): JSX.Element => {
    if (page.type !== 'main') {
      const titles: Partial<Record<MobilePage['type'], string>> = {
        product: '货源详情',
        checkout: '确认采购',
        demands: '采购需求',
        'demand-create': '发布采购需求',
        'order-detail': '订单详情',
        contracts: '我的合同',
        'contract-detail': '合同详情',
        logistics: '物流跟踪',
        wallet: '资金与保证金',
        notifications: '交易提醒',
      }
      return (
        <header className="mt-topbar mt-topbar-sub">
          <button type="button" aria-label="返回" onClick={goBack}><ArrowLeftOutlined /></button>
          <strong>{titles[page.type]}</strong>
          <button type="button" aria-label="消息" onClick={() => openProtectedPage({ type: 'notifications' })}>
            <BellOutlined />
          </button>
        </header>
      )
    }
    return (
      <header className="mt-topbar">
        <div className="mt-brand">
          <BrandMark size={34} />
          <div><strong>丰链云</strong><small>FENGCHAIN · AGRI</small></div>
        </div>
        <div className="mt-topbar-actions">
          <button type="button" className="mt-role-pill" onClick={() => switchTab('profile')}>
            <span>{loggedIn ? merchantName.slice(0, 1) : '访'}</span>
            {loggedIn ? '买家端' : '登录'}
          </button>
          <button type="button" aria-label="消息通知" onClick={() => openProtectedPage({ type: 'notifications' })}>
            <BellOutlined />
            {activeOrders.length > 0 && <i>{activeOrders.length}</i>}
          </button>
        </div>
      </header>
    )
  }

  const renderHome = (): JSX.Element => (
    <div className="mt-page">
      <form className="mt-search" onSubmit={submitSearch}>
        <SearchOutlined />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="搜索农产品、供应商、采购需求"
          aria-label="搜索货源"
        />
        <button type="submit">搜索</button>
      </form>

      <section className="mt-home-hero">
        <div className="mt-home-hero-copy">
          <span><ThunderboltOutlined /> 智能大宗交易</span>
          <h1>好货源，找丰链云</h1>
          <p>连接产地与采购，撮合、议价、签约、履约一站完成。</p>
          <button type="button" onClick={() => switchTab('market')}>进入交易市场 <RightOutlined /></button>
        </div>
        <div className="mt-home-hero-orbit" aria-hidden="true"><span>农</span><i /><b /></div>
      </section>

      <section className="mt-home-stats">
        <div><strong>{Number(summary.stat.publishedProductCount || recommended.length).toLocaleString()}</strong><span>在架货源</span></div>
        <div><strong>{demands.length.toLocaleString()}</strong><span>活跃采购</span></div>
        <div><strong>{categories.length.toLocaleString()}</strong><span>覆盖品类</span></div>
      </section>

      <section className="mt-quick-grid">
        <button type="button" onClick={() => openDemandCreate()}><span className="green"><FileTextOutlined /></span><strong>发布采购</strong></button>
        <button type="button" onClick={() => switchTab('market')}><span className="lime"><ShopOutlined /></span><strong>找货源</strong></button>
        <button type="button" onClick={() => switchTab('match')}><span className="blue"><RobotOutlined /></span><strong>智能撮合</strong></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'contracts' })}><span className="amber"><FileTextOutlined /></span><strong>我的合同</strong></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'logistics' })}><span className="teal"><TruckOutlined /></span><strong>物流跟踪</strong></button>
      </section>

      <section className="mt-section">
        <div className="mt-section-head">
          <div><strong>热门品类</strong><span>按产业快速找货</span></div>
        </div>
        <div className="mt-category-grid">
          {categories.slice(0, 8).map((category, index) => (
            <button type="button" key={category.id} onClick={() => selectCategory(String(category.id))}>
              <span className={`tone-${index % 6}`}>{category.categoryName.slice(0, 1)}</span>
              <strong>{category.categoryName}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-section">
        <div className="mt-section-head">
          <div><strong>今日推荐货源</strong><span>平台已审核 · 支持在线下单</span></div>
          <button type="button" onClick={() => switchTab('market')}>全部 <RightOutlined /></button>
        </div>
        {homeLoading ? <LoadingBlock label="正在读取最新货源" /> : (
          recommended.length > 0 ? (
            <div className="mt-product-grid">
              {recommended.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} />
              ))}
            </div>
          ) : <EmptyBlock title="暂无在架货源" desc="供应商发布并审核通过后会展示在这里。" />
        )}
      </section>

      <section className="mt-section">
        <div className="mt-section-head">
          <div><strong>活跃采购需求</strong><span>发现真实采购机会</span></div>
          <button type="button" onClick={() => pushPage({ type: 'demands' })}>更多 <RightOutlined /></button>
        </div>
        <div className="mt-demand-stack">
          {demands.slice(0, 3).map((demand) => (
            <button type="button" className="mt-demand-card" key={demand.id}
              onClick={() => {
                if (!requireLogin()) return
                setMatchDemandId(demand.id)
                switchTab('match')
              }}>
              <span className="mt-demand-badge">采购</span>
              <div><strong>{demand.demandName}</strong><p>{demand.quantity} {demand.unit || ''} · {demand.deliveryAddress || '交付地待确认'}</p></div>
              <StatusPill value={demand.demandStatus} />
            </button>
          ))}
          {demands.length === 0 && <EmptyBlock title="暂无采购需求" desc="发布第一条采购需求，让供应商主动报价。" />}
        </div>
      </section>

      <section className="mt-section mt-price-strip">
        <div className="mt-section-head">
          <div><strong>行情速览</strong><span>平台真实在架价格</span></div>
        </div>
        <div className="mt-price-scroll">
          {publicQuotes.map((quote) => (
            <div key={quote.categoryName}>
              <span>{quote.categoryName}</span>
              <strong>{money(quote.minPrice)}</strong>
              <small>{quote.productCount} 个货源</small>
            </div>
          ))}
          {publicQuotes.length === 0 && <p className="mt-inline-note">行情数据准备中</p>}
        </div>
      </section>
    </div>
  )

  const renderMarket = (): JSX.Element => (
    <div className="mt-page">
      <form className="mt-search mt-search-market" onSubmit={submitSearch}>
        <SearchOutlined />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="搜商品、品种、供应商"
          aria-label="搜索市场"
        />
        <button type="submit">搜索</button>
      </form>

      <div className="mt-segment">
        <button type="button" className={marketMode === 'supply' ? 'on' : ''} onClick={() => setMarketMode('supply')}>找货源</button>
        <button type="button" className={marketMode === 'demand' ? 'on' : ''} onClick={() => setMarketMode('demand')}>找采购</button>
      </div>

      {marketMode === 'supply' ? (
        <>
          <div className="mt-filter-scroll">
            <button type="button" className={marketCategory === '' ? 'on' : ''} onClick={() => setMarketCategory('')}>全部</button>
            {categories.slice(0, 10).map((category) => (
              <button type="button" key={category.id}
                className={marketCategory === String(category.id) ? 'on' : ''}
                onClick={() => setMarketCategory(String(category.id))}>
                {category.categoryName}
              </button>
            ))}
          </div>
          <div className="mt-sortbar">
            <span>共 {marketProducts.length} 个货源</span>
            <div>
              <button type="button" className={marketSort === 'latest' ? 'on' : ''} onClick={() => setMarketSort('latest')}>最新</button>
              <button type="button" className={marketSort === 'priceAsc' ? 'on' : ''} onClick={() => setMarketSort('priceAsc')}>价格</button>
            </div>
          </div>
          {marketLoading ? <LoadingBlock label="正在寻找优质货源" /> : marketError ? (
            <EmptyBlock title="货源加载失败" desc={marketError}
              action={<button type="button" className="mt-primary-button" onClick={() => void loadMarket()}><ReloadOutlined /> 重新加载</button>} />
          ) : marketProducts.length > 0 ? (
            <div className="mt-product-grid mt-market-products">
              {marketProducts.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} />
              ))}
            </div>
          ) : <EmptyBlock title="没有找到匹配货源" desc="换个品类或关键词试试，也可以发布采购需求。" />}
        </>
      ) : (
        <div className="mt-demand-list">
          <div className="mt-sortbar">
            <span>共 {demands.length} 条采购需求</span>
            <button type="button" onClick={() => openDemandCreate()}><FileTextOutlined /> 发布需求</button>
          </div>
          {demands.map((demand) => (
            <article className="mt-demand-full" key={demand.id}>
              <div className="mt-demand-full-head"><StatusPill value={demand.demandStatus} /><span>{shortDate(demand.createTime)}</span></div>
              <strong>{demand.demandName}</strong>
              <p>{demand.productName || demand.variety || demand.categoryName || '农产品采购'}</p>
              <div className="mt-demand-facts">
                <span><b>{demand.quantity}</b> {demand.unit || ''}</span>
                <span>{demand.priceMin != null ? money(demand.priceMin) : '价格面议'}</span>
                <span>{demand.responseCount ?? 0} 条响应</span>
              </div>
              <div className="mt-demand-full-foot">
                <span><EnvironmentOutlined /> {demand.deliveryAddress || '交付地待确认'}</span>
                <button type="button" onClick={() => {
                  if (!requireLogin()) return
                  setMatchDemandId(demand.id)
                  switchTab('match')
                }}>智能匹配</button>
              </div>
            </article>
          ))}
          {demands.length === 0 && <EmptyBlock title="暂无采购需求" desc="发布采购需求后，供应商可以响应并报价。" />}
        </div>
      )}
    </div>
  )

  const renderMatch = (): JSX.Element => (
    <div className="mt-page">
      <section className="mt-match-hero">
        <span><RobotOutlined /></span>
        <div><small>AI MATCHING</small><h1>智能撮合助手</h1><p>综合品类、价格、产地、品质与信用，为采购需求推荐合适货源。</p></div>
      </section>

      {!loggedIn ? (
        <section className="mt-login-gate">
          <SafetyCertificateOutlined />
          <strong>登录后启动智能撮合</strong>
          <p>系统将按当前经营主体的采购需求进行匹配，并保存撮合记录。</p>
          <button type="button" className="mt-primary-button" onClick={goLogin}>立即登录</button>
        </section>
      ) : (
        <>
          <section className="mt-panel">
            <div className="mt-panel-head"><strong>选择采购需求</strong><button type="button" onClick={() => openDemandCreate()}>新建需求</button></div>
            <div className="mt-demand-selector">
              {demands.slice(0, 8).map((demand) => (
                <button type="button" key={demand.id}
                  className={matchDemandId === demand.id ? 'on' : ''}
                  onClick={() => { setMatchDemandId(demand.id); setMatchResults([]) }}>
                  <strong>{demand.demandName}</strong>
                  <span>{demand.quantity} {demand.unit || ''} · {statusText(demand.demandStatus)}</span>
                </button>
              ))}
              {demands.length === 0 && <EmptyBlock title="还没有采购需求" desc="先发布采购需求，再启动智能撮合。" />}
            </div>
          </section>

          <button type="button" className="mt-match-button" disabled={matching || !matchDemandId} onClick={() => void runMatch()}>
            <RobotOutlined /> {matching ? '正在分析货源…' : '开始智能撮合'}
          </button>

          {selectedDemand && (
            <div className="mt-match-context">
              <span>当前需求</span>
              <strong>{selectedDemand.demandName}</strong>
              <p>{selectedDemand.quantity} {selectedDemand.unit || ''} · {selectedDemand.deliveryAddress || '交付地待确认'}</p>
            </div>
          )}

          <section className="mt-section">
            <div className="mt-section-head"><div><strong>推荐货源</strong><span>{matchResults.length ? `已生成 ${matchResults.length} 个匹配结果` : '等待启动撮合'}</span></div></div>
            <div className="mt-match-results">
              {matchResults.map((match) => (
                <article className="mt-match-card" key={match.id}>
                  <div className="mt-score-ring" style={{ '--score': `${Math.max(0, Math.min(100, Number(match.matchScore)))}%` } as CSSProperties}>
                    <span>{Number(match.matchScore).toFixed(0)}</span><small>匹配度</small>
                  </div>
                  <div className="mt-match-content">
                    <div><strong>{match.productName}</strong><StatusPill value={match.matchStatus} /></div>
                    <p>{match.sellerName}</p>
                    <span>{match.matchReason}</span>
                    <button type="button" onClick={() => openProduct({
                      id: match.productId,
                      productName: match.productName,
                      sellerId: match.sellerId,
                      sellerName: match.sellerName,
                      unit: '件',
                      price: null,
                    })}>查看货源 <RightOutlined /></button>
                  </div>
                </article>
              ))}
              {matchResults.length === 0 && (
                <EmptyBlock title="尚未生成推荐" desc="选择一条采购需求并启动撮合，结果会实时展示。" />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )

  const renderOrders = (): JSX.Element => (
    <div className="mt-page">
      <section className="mt-page-heading">
        <div><small>TRADE ORDERS</small><h1>我的订单</h1><p>跟踪采购与销售订单的支付、发货和收货进度。</p></div>
        <button type="button" onClick={() => void loadOrders()} disabled={ordersLoading}><ReloadOutlined /> 刷新</button>
      </section>
      {!loggedIn ? (
        <section className="mt-login-gate">
          <ProfileOutlined />
          <strong>登录后查看订单</strong>
          <p>订单范围按当前账号绑定的经营主体自动隔离。</p>
          <button type="button" className="mt-primary-button" onClick={goLogin}>立即登录</button>
        </section>
      ) : (
        <>
          <div className="mt-segment mt-role-segment">
            <button type="button" className={orderSide === 'buyer' ? 'on' : ''} onClick={() => { setOrderSide('buyer'); setOrderFilter('all') }}>我买到的</button>
            <button type="button" className={orderSide === 'seller' ? 'on' : ''} onClick={() => { setOrderSide('seller'); setOrderFilter('all') }}>我卖出的</button>
          </div>
          <div className="mt-filter-scroll mt-order-filters">
            <button type="button" className={orderFilter === 'all' ? 'on' : ''} onClick={() => setOrderFilter('all')}>全部</button>
            <button type="button" className={orderFilter === 'active' ? 'on' : ''} onClick={() => setOrderFilter('active')}>进行中</button>
            <button type="button" className={orderFilter === 'complete' ? 'on' : ''} onClick={() => setOrderFilter('complete')}>已完成</button>
          </div>
          {ordersLoading ? <LoadingBlock label="正在读取订单" /> : filteredOrders.length === 0 ? (
            <EmptyBlock title="暂无订单" desc={orderSide === 'buyer' ? '从市场选择货源并下单后，订单会出现在这里。' : '买家下单后会在这里看到销售订单。'}
              action={<button type="button" className="mt-primary-button" onClick={() => switchTab('market')}>去交易市场</button>} />
          ) : (
            <div className="mt-order-list">
              {filteredOrders.map((order) => (
                <button type="button" className="mt-order-card" key={order.id} onClick={() => pushPage({ type: 'order-detail', orderId: order.id })}>
                  <div className="mt-order-card-head">
                    <span>{order.orderNo}</span>
                    <StatusPill value={order.orderStatus} />
                  </div>
                  <div className="mt-order-card-body">
                    <span className="mt-order-icon"><ShoppingOutlined /></span>
                    <div>
                      <strong>{order.productName || order.categoryName || '农产品交易订单'}</strong>
                      <p>{orderSide === 'buyer' ? `供应商：${order.sellerName}` : `采购方：${order.buyerName}`}</p>
                      <small>{shortDate(order.createTime)}</small>
                    </div>
                    <b>{money(order.totalAmount)}</b>
                  </div>
                  <div className="mt-order-card-foot">
                    <span>{order.paymentStatus === 'paid' ? '已支付' : '待支付'} · {statusText(order.orderStatus)}</span>
                    <span>查看详情 <RightOutlined /></span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  const renderProfile = (): JSX.Element => (
    <div className="mt-page mt-profile-page">
      <section className="mt-profile-card">
        <span className="mt-profile-avatar">{loggedIn ? merchantName.slice(0, 1) : <UserOutlined />}</span>
        <div>
          <small>{loggedIn ? '当前经营主体' : '欢迎来到丰链云'}</small>
          <h1>{loggedIn ? merchantName : '登录后管理交易'}</h1>
          <p>{loggedIn ? (merchants[0]?.merchantType === 'enterprise' ? '认证企业' : '平台认证主体') : '找货、采购、签约与履约一站完成'}</p>
        </div>
        {!loggedIn ? <button type="button" onClick={goLogin}>登录</button> : <StatusPill value={merchants[0]?.status === 1 ? 'active' : 'pending'} />}
      </section>

      <section className="mt-profile-stats">
        <button type="button" onClick={() => switchTab('orders')}><strong>{orders.length}</strong><span>订单</span></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'contracts' })}><strong>{contracts.length}</strong><span>合同</span></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'logistics' })}><strong>{logistics.length}</strong><span>物流</span></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'wallet' })}><strong>{compactMoney(availableGuarantee)}</strong><span>保证金</span></button>
      </section>

      <section className="mt-panel mt-profile-menu">
        <div className="mt-menu-group-title">交易管理</div>
        <button type="button" onClick={() => openProtectedPage({ type: 'wallet' })}><span className="green"><WalletOutlined /></span><div><strong>资金与保证金</strong><small>可用余额、账户状态与流水</small></div><RightOutlined /></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'contracts' })}><span className="blue"><FileTextOutlined /></span><div><strong>我的合同</strong><small>查看、签署和管理交易合同</small></div><RightOutlined /></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'logistics' })}><span className="teal"><TruckOutlined /></span><div><strong>物流跟踪</strong><small>查看承运商与运输进度</small></div><RightOutlined /></button>
        <button type="button" onClick={() => openProtectedPage({ type: 'notifications' })}><span className="amber"><BellOutlined /></span><div><strong>交易提醒</strong><small>订单、合同与履约动态</small></div><RightOutlined /></button>
      </section>

      <section className="mt-panel mt-profile-menu">
        <div className="mt-menu-group-title">角色与主体</div>
        <button type="button" onClick={() => { window.location.href = '/member/buyer' }}><span className="green"><ShoppingOutlined /></span><div><strong>买家中心</strong><small>完整采购、合同、售后与资金管理</small></div><RightOutlined /><RightOutlined /></button>
        <button type="button" onClick={() => { window.location.href = '/member/seller' }}><span className="lime"><ShopOutlined /></span><div><strong>卖家中心</strong><small>商品、报价、订单与结算管理</small></div><RightOutlined /></button>
        <button type="button" onClick={() => {
          window.location.href = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account`
        }}><span className="blue"><TeamOutlined /></span><div><strong>个人中心</strong><small>主体认证、成员与账号安全</small></div><RightOutlined /></button>
      </section>

      {loggedIn ? (
        <button type="button" className="mt-logout" onClick={() => {
          clearSession()
          window.location.href = ssoLogoutUrl('trade')
        }}><LogoutOutlined /> 退出登录</button>
      ) : (
        <button type="button" className="mt-primary-button mt-profile-login" onClick={goLogin}>登录 / 注册</button>
      )}
      <p className="mt-version">丰链云交易撮合移动端 · H5 / 微信内嵌</p>
    </div>
  )

  const renderMain = (): JSX.Element => {
    if (tab === 'home') return renderHome()
    if (tab === 'market') return renderMarket()
    if (tab === 'match') return renderMatch()
    if (tab === 'orders') return renderOrders()
    return renderProfile()
  }

  const renderProduct = (): JSX.Element => {
    if (detailLoading && !detailProduct) return <LoadingBlock label="正在读取货源详情" />
    if (!detailProduct) return <EmptyBlock title="货源不存在" desc="该货源可能已下架，请返回市场重新选择。" />
    const image = detailImages[0]?.imageUrl
    const showImage = Boolean(image) && !detailImageFailed
    const origin = [
      detailProduct.originProvince,
      detailProduct.originCity,
      detailProduct.originDistrict,
      detailProduct.originAddress,
    ].filter(Boolean).join(' ')
    const price = detailProduct.price ?? detailProduct.priceMin
    return (
      <div className="mt-detail-page">
        <div className={`mt-detail-visual${showImage ? ' has-image' : ''}`}>
          <span>{productGlyph(detailProduct)}</span>
          <small>{detailProduct.categoryName || '优质农产品'}</small>
          {showImage && (
            <img
              src={image}
              alt={detailProduct.productName}
              onError={() => setDetailImageFailed(true)}
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth < 32 || event.currentTarget.naturalHeight < 32) {
                  setDetailImageFailed(true)
                }
              }}
            />
          )}
        </div>
        <section className="mt-detail-summary">
          <div className="mt-detail-tags">
            <span>{detailProduct.categoryName || '农产品'}</span>
            {detailProduct.variety && <span>{detailProduct.variety}</span>}
            <span>平台认证</span>
          </div>
          <h1>{detailProduct.productName}</h1>
          <div className="mt-detail-price"><strong>{money(price)}</strong><span>/{detailProduct.unit}</span></div>
          <p>{detailProduct.specification || detailProduct.description || '规格与交付要求可与供应商进一步确认。'}</p>
        </section>
        <section className="mt-detail-facts">
          <div><span>起订量</span><strong>{detailProduct.minOrderQuantity ?? 1} {detailProduct.unit}</strong></div>
          <div><span>可供数量</span><strong>{detailProduct.stockQuantity ?? '询价'} {detailProduct.stockQuantity != null ? detailProduct.unit : ''}</strong></div>
          <div><span>累计成交</span><strong>{detailProduct.salesVolume ?? 0} {detailProduct.unit}</strong></div>
        </section>
        <section className="mt-panel mt-detail-panel">
          <div className="mt-panel-head"><strong>商品信息</strong></div>
          <dl>
            <div><dt>商品品类</dt><dd>{detailProduct.categoryName || '—'}</dd></div>
            <div><dt>品种规格</dt><dd>{[detailProduct.variety, detailProduct.specification].filter(Boolean).join(' / ') || '—'}</dd></div>
            <div><dt>产地</dt><dd>{origin || '产地待确认'}</dd></div>
            <div><dt>商品编号</dt><dd>#{detailProduct.id}</dd></div>
          </dl>
        </section>
        <section className="mt-supplier-card">
          <span><ShopOutlined /></span>
          <div><small>供应商</small><strong>{detailProduct.sellerName || '平台认证供应商'}</strong><p><SafetyCertificateOutlined /> 主体认证 · 平台交易保障</p></div>
          <button type="button" onClick={() => { window.location.href = `/shop/${detailProduct.sellerId}` }}>进店</button>
        </section>
        <section className="mt-detail-service">
          <div><CheckCircleOutlined /><span>平台合同</span></div>
          <div><TruckOutlined /><span>物流跟踪</span></div>
          <div><WalletOutlined /><span>资金保障</span></div>
        </section>
        <div className="mt-detail-actions">
          <button type="button" className="ghost" onClick={() => openDemandCreate(detailProduct)}>发布采购需求</button>
          <button type="button" onClick={openCheckout}>立即采购</button>
        </div>
      </div>
    )
  }

  const renderCheckout = (): JSX.Element => {
    if (detailLoading && !detailProduct) return <LoadingBlock label="正在读取商品信息" />
    if (!detailProduct) return <EmptyBlock title="商品信息不可用" desc="请返回市场重新选择货源。" />
    return (
      <form className="mt-form-page" onSubmit={(event) => void submitCheckout(event)}>
        <section className="mt-checkout-product">
          <span>{productGlyph(detailProduct)}</span>
          <div><strong>{detailProduct.productName}</strong><p>{detailProduct.sellerName}</p><b>{money(detailProduct.price ?? detailProduct.priceMin)}/{detailProduct.unit}</b></div>
        </section>
        <section className="mt-form-card">
          <h2>采购信息</h2>
          <label><span>采购数量 *</span><div className="mt-input-with-unit"><input inputMode="decimal" value={checkoutDraft.quantity}
            onChange={(event) => setCheckoutDraft({ ...checkoutDraft, quantity: event.target.value })} /><em>{detailProduct.unit}</em></div></label>
          <label><span>运费（元）</span><input inputMode="decimal" value={checkoutDraft.freightAmount}
            onChange={(event) => setCheckoutDraft({ ...checkoutDraft, freightAmount: event.target.value })} /></label>
          <div className="mt-estimate"><span>商品金额</span><strong>{money(checkoutEstimate)}</strong></div>
          <div className="mt-estimate"><span>订单预估</span><strong>{money(checkoutEstimate + Number(checkoutDraft.freightAmount || 0))}</strong></div>
        </section>
        <section className="mt-form-card">
          <h2>收货信息</h2>
          <label><span>收货人 *</span><input value={checkoutDraft.deliveryContact} placeholder="请输入收货人姓名"
            onChange={(event) => setCheckoutDraft({ ...checkoutDraft, deliveryContact: event.target.value })} /></label>
          <label><span>联系电话 *</span><input inputMode="tel" value={checkoutDraft.deliveryPhone} placeholder="请输入手机号"
            onChange={(event) => setCheckoutDraft({ ...checkoutDraft, deliveryPhone: event.target.value })} /></label>
          <div className="mt-form-grid">
            <label><span>省份 *</span><select value={checkoutDraft.deliveryProvince} onChange={(event) => setCheckoutDraft({
              ...checkoutDraft,
              deliveryProvince: event.target.value,
              deliveryCity: '',
            })}><option value="">请选择</option>{CHINA_REGIONS.map((region) => <option key={region.name} value={region.name}>{region.name}</option>)}</select></label>
            <label><span>城市 *</span><select value={checkoutDraft.deliveryCity} disabled={!checkoutDraft.deliveryProvince}
              onChange={(event) => setCheckoutDraft({ ...checkoutDraft, deliveryCity: event.target.value })}>
              <option value="">请选择</option>{checkoutCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select></label>
          </div>
          <label><span>详细地址 *</span><textarea rows={3} value={checkoutDraft.deliveryAddress} placeholder="市场、仓库或详细收货地址"
            onChange={(event) => setCheckoutDraft({ ...checkoutDraft, deliveryAddress: event.target.value })} /></label>
        </section>
        <section className="mt-checkout-notice">
          <SafetyCertificateOutlined />
          <p>订单价格由平台按货源单价和数量计算，支付与履约进度可在移动端订单中心跟踪。</p>
        </section>
        <button type="submit" className="mt-submit-button" disabled={checkoutSaving}>
          {checkoutSaving ? '正在创建订单…' : `确认采购 · ${money(checkoutEstimate + Number(checkoutDraft.freightAmount || 0))}`}
        </button>
      </form>
    )
  }

  const renderDemandCreate = (): JSX.Element => (
    <form className="mt-form-page" onSubmit={(event) => void submitDemand(event)}>
      <section className="mt-form-hero">
        <FileTextOutlined />
        <div><small>PUBLISH DEMAND</small><h1>发布采购需求</h1><p>补充采购品类、数量和交付条件，平台将辅助撮合供应商。</p></div>
      </section>
      <section className="mt-form-card">
        <h2>需求信息</h2>
        <label><span>需求标题 *</span><input value={demandDraft.demandName} placeholder="例如：优质番茄 5 吨采购需求"
          onChange={(event) => setDemandDraft({ ...demandDraft, demandName: event.target.value })} /></label>
        <label><span>采购品类 *</span><select value={demandDraft.categoryId}
          onChange={(event) => setDemandDraft({ ...demandDraft, categoryId: event.target.value })}>
          <option value="">请选择品类</option>
          {categories.map((category) => <option key={category.id} value={String(category.id)}>{category.categoryName}</option>)}
        </select></label>
        <label><span>商品名称</span><input value={demandDraft.productName} placeholder="具体商品名称"
          onChange={(event) => setDemandDraft({ ...demandDraft, productName: event.target.value })} /></label>
        <label><span>品种</span><input value={demandDraft.variety} placeholder="例如：普罗旺斯番茄"
          onChange={(event) => setDemandDraft({ ...demandDraft, variety: event.target.value })} /></label>
      </section>
      <section className="mt-form-card">
        <h2>数量与价格</h2>
        <div className="mt-form-grid">
          <label><span>采购数量 *</span><input inputMode="decimal" value={demandDraft.quantity} placeholder="5"
            onChange={(event) => setDemandDraft({ ...demandDraft, quantity: event.target.value })} /></label>
          <label><span>单位 *</span><select value={demandDraft.unit}
            onChange={(event) => setDemandDraft({ ...demandDraft, unit: event.target.value })}>
            {['吨', '公斤', '件', '箱', '袋'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select></label>
        </div>
        <div className="mt-form-grid">
          <label><span>期望最低价</span><input inputMode="decimal" value={demandDraft.priceMin} placeholder="元"
            onChange={(event) => setDemandDraft({ ...demandDraft, priceMin: event.target.value })} /></label>
          <label><span>期望最高价</span><input inputMode="decimal" value={demandDraft.priceMax} placeholder="元"
            onChange={(event) => setDemandDraft({ ...demandDraft, priceMax: event.target.value })} /></label>
        </div>
      </section>
      <section className="mt-form-card">
        <h2>交付要求</h2>
        <label><span>收货地址</span><textarea rows={2} value={demandDraft.deliveryAddress} placeholder="请输入详细收货地址"
          onChange={(event) => setDemandDraft({ ...demandDraft, deliveryAddress: event.target.value })} /></label>
        <label><span>补充说明</span><textarea rows={3} value={demandDraft.additionalRequirements} placeholder="质量、包装、结算或开票要求"
          onChange={(event) => setDemandDraft({ ...demandDraft, additionalRequirements: event.target.value })} /></label>
      </section>
      <button type="submit" className="mt-submit-button" disabled={demandSaving}>{demandSaving ? '正在发布…' : '发布采购需求'}</button>
    </form>
  )

  const renderDemands = (): JSX.Element => (
    <div className="mt-page">
      <section className="mt-page-heading">
        <div><small>PURCHASE DEMANDS</small><h1>采购需求</h1><p>浏览平台真实采购机会，登录后可参与智能撮合。</p></div>
        <button type="button" onClick={() => openDemandCreate()}><FileTextOutlined /> 发布</button>
      </section>
      <div className="mt-demand-list">
        {demands.map((demand) => (
          <article className="mt-demand-full" key={demand.id}>
            <div className="mt-demand-full-head"><StatusPill value={demand.demandStatus} /><span>{shortDate(demand.createTime)}</span></div>
            <strong>{demand.demandName}</strong>
            <p>{demand.productName || demand.variety || demand.categoryName || '农产品采购'}</p>
            <div className="mt-demand-facts">
              <span><b>{demand.quantity}</b> {demand.unit || ''}</span>
              <span>{demand.priceMin != null ? money(demand.priceMin) : '价格面议'}</span>
              <span>{demand.responseCount ?? 0} 条响应</span>
            </div>
            <div className="mt-demand-full-foot">
              <span><EnvironmentOutlined /> {demand.deliveryAddress || '交付地待确认'}</span>
              <button type="button" onClick={() => {
                if (!requireLogin()) return
                setMatchDemandId(demand.id)
                switchTab('match')
              }}>智能匹配</button>
            </div>
          </article>
        ))}
        {demands.length === 0 && <EmptyBlock title="暂无采购需求" desc="当前没有公开采购需求。" />}
      </div>
    </div>
  )

  const renderOrderDetail = (): JSX.Element => {
    if (orderDetailLoading && !orderDetail) return <LoadingBlock label="正在读取订单详情" />
    if (!orderDetail) return <EmptyBlock title="未找到订单" desc="订单可能不存在或不属于当前主体。" />
    const isBuyer = merchantIds.has(String(orderDetail.buyerId))
    const isSeller = merchantIds.has(String(orderDetail.sellerId))
    const canPay = isBuyer && ['pending', 'pending_confirm'].includes(orderDetail.orderStatus)
    const canShip = isSeller && orderDetail.orderStatus === 'paid'
    const canReceive = isBuyer && orderDetail.orderStatus === 'shipped'
    return (
      <div className="mt-order-detail">
        <section className="mt-order-status-hero">
          <StatusPill value={orderDetail.orderStatus} />
          <h1>{statusText(orderDetail.orderStatus)}</h1>
          <p>{canPay ? '请确认订单信息并完成支付' : canShip ? '请完成发货并填写物流信息' : canReceive ? '收到货物后请及时确认' : '订单状态会随履约进度实时更新'}</p>
        </section>
        <section className="mt-panel">
          <div className="mt-panel-head"><strong>商品明细</strong><span className="mt-order-no">{orderDetail.orderNo}</span></div>
          <div className="mt-order-items">
            {orderItems.map((item) => (
              <div key={item.id}>
                <span className="mt-order-icon"><ShoppingOutlined /></span>
                <div><strong>{item.productName}</strong><p>{item.specLevel || '规格以订单为准'} · {item.quantity}{item.unit}</p></div>
                <b>{money(item.totalPrice)}</b>
              </div>
            ))}
            {orderItems.length === 0 && <p className="mt-inline-note">订单明细暂未返回</p>}
          </div>
        </section>
        <section className="mt-panel">
          <div className="mt-panel-head"><strong>订单信息</strong></div>
          <dl className="mt-order-info">
            <div><dt>{isSeller ? '采购方' : '供应商'}</dt><dd>{isSeller ? orderDetail.buyerName : orderDetail.sellerName}</dd></div>
            <div><dt>商品金额</dt><dd>{money(orderDetail.goodsAmount ?? orderDetail.totalAmount)}</dd></div>
            <div><dt>运费</dt><dd>{money(orderDetail.freightAmount ?? 0)}</dd></div>
            <div><dt>订单总额</dt><dd className="strong">{money(orderDetail.totalAmount)}</dd></div>
            <div><dt>收货地址</dt><dd>{[orderDetail.deliveryProvince, orderDetail.deliveryCity, orderDetail.deliveryAddress].filter(Boolean).join(' ') || '—'}</dd></div>
            <div><dt>收货人</dt><dd>{orderDetail.deliveryContact || '—'} {orderDetail.deliveryPhone || ''}</dd></div>
          </dl>
        </section>
        {orderDetail.logisticsNo && (
          <button type="button" className="mt-panel mt-link-panel" onClick={() => openProtectedPage({ type: 'logistics' })}>
            <span><TruckOutlined /></span><div><strong>物流运输中</strong><p>{orderDetail.logisticsNo}</p></div><RightOutlined />
          </button>
        )}
        {(canPay || canShip || canReceive) && (
          <div className="mt-order-detail-actions">
            <button type="button" className="ghost" onClick={() => window.location.href = `/order/detail/${orderDetail.id}`}>完整详情</button>
            <button type="button" disabled={Boolean(orderAction)} onClick={() => void changeOrderStatus(canPay ? 'pay' : canShip ? 'ship' : 'receive')}>
              {orderAction ? '正在处理…' : canPay ? '立即支付' : canShip ? '确认发货' : '确认收货'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderContracts = (): JSX.Element => (
    <div className="mt-page">
      <section className="mt-page-heading">
        <div><small>CONTRACTS</small><h1>我的合同</h1><p>查看采购与销售合同的签署和执行状态。</p></div>
        <button type="button" onClick={() => void loadContracts()}><ReloadOutlined /></button>
      </section>
      {!loggedIn ? <EmptyBlock title="登录后查看合同" desc="合同只对交易双方开放。" action={<button type="button" className="mt-primary-button" onClick={goLogin}>立即登录</button>} /> : contractsLoading ? (
        <LoadingBlock label="正在读取合同" />
      ) : contracts.length === 0 ? (
        <EmptyBlock title="暂无合同" desc="交易双方生成合同后会展示在这里。" />
      ) : (
        <div className="mt-contract-list">
          {contracts.map((contract) => (
            <button type="button" className="mt-contract-card" key={contract.id} onClick={() => pushPage({ type: 'contract-detail', contractId: contract.id })}>
              <div><span className="mt-contract-icon"><FileTextOutlined /></span><StatusPill value={contract.contractStatus} /></div>
              <strong>{contract.contractName}</strong>
              <p>{contract.buyerName} <SwapOutlined /> {contract.sellerName}</p>
              <div><span>{contract.contractNo}</span><b>{money(contract.contractAmount)}</b></div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const renderContractDetail = (): JSX.Element => {
    if (contractsLoading && !contractDetail) return <LoadingBlock label="正在读取合同" />
    if (!contractDetail) return <EmptyBlock title="未找到合同" desc="合同可能不存在或您不是合同当事人。" />
    return (
      <div className="mt-page">
        <section className="mt-contract-hero">
          <FileTextOutlined />
          <StatusPill value={contractDetail.contractStatus} />
          <h1>{contractDetail.contractName}</h1>
          <p>{contractDetail.contractNo}</p>
        </section>
        <section className="mt-panel">
          <div className="mt-panel-head"><strong>合同信息</strong></div>
          <dl className="mt-order-info">
            <div><dt>采购方</dt><dd>{contractDetail.buyerName}</dd></div>
            <div><dt>供应方</dt><dd>{contractDetail.sellerName}</dd></div>
            <div><dt>合同金额</dt><dd className="strong">{money(contractDetail.contractAmount)}</dd></div>
            <div><dt>数量</dt><dd>{contractDetail.quantity} {contractDetail.unit}</dd></div>
            <div><dt>单价</dt><dd>{money(contractDetail.unitPrice)}/{contractDetail.unit}</dd></div>
            <div><dt>签署状态</dt><dd>买方 {statusText(contractDetail.buyerSignStatus)} · 卖方 {statusText(contractDetail.sellerSignStatus)}</dd></div>
          </dl>
        </section>
        <section className="mt-panel">
          <div className="mt-panel-head"><strong>合同内容</strong></div>
          <div className="mt-contract-content">{contractDetail.contractContent || '合同正文由交易双方在合同工作台查看。'}</div>
        </section>
        <button type="button" className="mt-primary-button mt-contract-action" onClick={() => {
          window.location.href = `/member/buyer?tab=contract&id=${contractDetail.id}`
        }}>进入合同工作台</button>
      </div>
    )
  }

  const renderLogistics = (): JSX.Element => (
    <div className="mt-page">
      <section className="mt-page-heading">
        <div><small>LOGISTICS</small><h1>物流跟踪</h1><p>查看承运商、当前位置和签收状态。</p></div>
        <button type="button" onClick={() => void loadLogistics()}><ReloadOutlined /></button>
      </section>
      {!loggedIn ? <EmptyBlock title="登录后查看物流" desc="物流单按交易主体隔离展示。" action={<button type="button" className="mt-primary-button" onClick={goLogin}>立即登录</button>} /> : logisticsLoading ? (
        <LoadingBlock label="正在读取物流单" />
      ) : logistics.length === 0 ? (
        <EmptyBlock title="暂无物流单" desc="订单发货后会自动生成物流跟踪记录。" />
      ) : (
        <div className="mt-logistics-list">
          {logistics.map((item) => (
            <article className="mt-logistics-card" key={item.id}>
              <div><span><TruckOutlined /></span><StatusPill value={item.logisticsStatus} /></div>
              <strong>{item.logisticsNo}</strong>
              <p>{item.carrierName || '平台物流'} · {item.logisticsType || '公路运输'}</p>
              <div className="mt-logistics-path">
                <span><EnvironmentOutlined /> {item.currentLocation || item.senderAddress || '等待物流更新'}</span>
                <small>{shortDate(item.updateTime)}</small>
              </div>
              <button type="button" onClick={() => pushPage({ type: 'order-detail', orderId: item.orderId })}>查看关联订单 <RightOutlined /></button>
            </article>
          ))}
        </div>
      )}
    </div>
  )

  const renderWallet = (): JSX.Element => {
    const effective = guarantees.filter((item) => item.guaranteeStatus === 'active'
      && (!item.expireTime || new Date(item.expireTime).getTime() > Date.now()))
    const frozen = effective.reduce((total, item) => total + Number(item.frozenAmount ?? 0), 0)
    return (
      <div className="mt-page">
        <section className="mt-wallet-hero">
          <small>AVAILABLE GUARANTEE</small>
          <span>可用保证金</span>
          <strong>{money(availableGuarantee)}</strong>
          <p>{effective.length} 个生效账户 · {money(frozen)} 冻结中</p>
          <button type="button" onClick={() => { window.location.href = '/member/buyer?tab=fund' }}>查看完整资金账户 <RightOutlined /></button>
        </section>
        {accountLoading ? <LoadingBlock label="正在读取保证金账户" /> : guarantees.length === 0 ? (
          <EmptyBlock title="暂无保证金账户" desc="保证金账户由平台运营审核开立。" />
        ) : (
          <div className="mt-guarantee-list">
            {guarantees.map((item) => (
              <article key={item.id}>
                <div><span><WalletOutlined /></span><StatusPill value={item.guaranteeStatus === 'active'
                  && item.expireTime && new Date(item.expireTime).getTime() < Date.now() ? 'expired' : item.guaranteeStatus} /></div>
                <strong>{item.guaranteeNo}</strong>
                <p>{item.merchantName || merchantName}</p>
                <div className="mt-guarantee-facts">
                  <span><small>总额</small><b>{money(item.totalAmount)}</b></span>
                  <span><small>可用</small><b>{money(item.availableAmount)}</b></span>
                  <span><small>冻结</small><b>{money(item.frozenAmount)}</b></span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderNotifications = (): JSX.Element => (
    <div className="mt-page">
      <section className="mt-page-heading">
        <div><small>TRADE NOTIFICATIONS</small><h1>交易提醒</h1><p>订单与履约状态的最新动态。</p></div>
      </section>
      {!loggedIn ? <EmptyBlock title="登录后查看提醒" desc="交易提醒只展示当前经营主体的订单动态。" action={<button type="button" className="mt-primary-button" onClick={goLogin}>立即登录</button>} /> : notifications.length === 0 ? (
        <EmptyBlock title="暂无交易提醒" desc="新订单、支付、发货和收货动态会出现在这里。" />
      ) : (
        <div className="mt-notification-list">
          {notifications.map((order) => (
            <button type="button" key={order.id} onClick={() => pushPage({ type: 'order-detail', orderId: order.id })}>
              <span className={`mt-notice-icon ${statusTone(order.orderStatus)}`}>
                {order.orderStatus === 'shipped' ? <TruckOutlined /> : order.orderStatus === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
              </span>
              <div><strong>订单{statusText(order.orderStatus)}</strong><p>{order.productName || order.orderNo} · {money(order.totalAmount)}</p><small>{shortDate(order.createTime)}</small></div>
              <RightOutlined />
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const renderScreen = (): JSX.Element => {
    if (page.type === 'product') return renderProduct()
    if (page.type === 'checkout') return renderCheckout()
    if (page.type === 'demands') return renderDemands()
    if (page.type === 'demand-create') return renderDemandCreate()
    if (page.type === 'order-detail') return renderOrderDetail()
    if (page.type === 'contracts') return renderContracts()
    if (page.type === 'contract-detail') return renderContractDetail()
    if (page.type === 'logistics') return renderLogistics()
    if (page.type === 'wallet') return renderWallet()
    if (page.type === 'notifications') return renderNotifications()
    return renderMain()
  }

  return (
    <div className={`mt-app${page.type === 'main' ? ' mt-app-main' : ' mt-app-sub'}`}>
      {renderHeader()}
      <main className="mt-main">{renderScreen()}</main>
      {page.type === 'main' && (
        <nav className="mt-tabbar" aria-label="移动端主导航">
          {NAV_ITEMS.map((item) => (
            <button type="button" key={item.key} className={tab === item.key ? 'on' : ''}
              onClick={() => switchTab(item.key)}>
              <span>{item.icon}</span><small>{item.label}</small>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
