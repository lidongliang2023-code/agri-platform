import axios from 'axios'

/**
 * 我的经营看板（供方 + 采方两侧）。
 *
 * 范围由服务端按登录身份推导（不传 merchantId）—— 经营数据里带着
 * 别家主体的名字（TOP 采购商）与自家的销量，不能靠"顺手传个 id"就拿到。
 *
 * 数字全部来自真实表：收入/支出排除已取消订单，评分取自已展示评价，
 * 没有数据来源的指标（收藏/关注）已经不再返回。
 */
export interface TrendRow {
  date: string
  amount: number
  orderCount: number
}

export interface TopProductRow {
  productId: number
  productName: string
  totalSales: number
  salesCount: number
  avgPrice: number
}

export interface TopBuyerRow {
  buyerId: number
  buyerName: string
  totalPurchase: number
  purchaseCount: number
}

export interface CategoryRow {
  categoryName: string
  totalAmount: number
  orderCount: number
}

export interface StatusRow {
  status: string
  statusName: string
  count: number
  amount: number
}

export interface SellerDashboard {
  sellerId: number
  sellerName: string | null
  totalRevenue: number
  todayRevenue: number
  totalOrders: number
  todayOrders: number
  pendingOrders: number
  completedOrders: number
  avgOrderValue: number
  /** 没有评价时为 null（不再返回随机分） */
  avgRating: number | null
  productCount: number
  activeProducts: number
  revenueTrend: TrendRow[]
  topProducts: TopProductRow[]
  orderStatusDistribution: StatusRow[]
}

export interface BuyerDashboard {
  buyerId: number
  buyerName: string | null
  totalSpent: number
  todaySpent: number
  totalOrders: number
  todayOrders: number
  pendingOrders: number
  completedOrders: number
  avgOrderValue: number
  spendingTrend: TrendRow[]
  purchaseCategories: CategoryRow[]
  orderStatusDistribution: StatusRow[]
}

export interface MineDashboard {
  merchantId: number | null
  merchantName: string | null
  message?: string
  seller: SellerDashboard | null
  buyer: BuyerDashboard | null
}

export async function getMineDashboard() {
  const response = await axios.get('/api/trade/dashboard/mine')
  return response.data
}
