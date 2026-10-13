/**
 * 用户端首页数据。
 *
 * <p><b>这里原来是三个返回写死对象的函数</b> —— `getMarketData()` 直接把
 * "累计交易额 128.5 亿、注册用户数 56.8 万人、累计成交 89.2 万笔"当数据返回，
 * `getRecentTransactions()` 返回"山东寿光番茄 / 北京XX商贸"这类编出来的成交记录，
 * 首页连一次后端请求都没发。页面看起来一切正常，数字全是假的。</p>
 *
 * <p>现在改为请求 /api/trade/home/summary，每一项都有可核对的真实口径
 * （见后端 HomeController 的字段注释）。</p>
 */
import axios from 'axios'

export interface HomeStat {
  /** 累计交易额（元），已取消订单不计入 */
  tradeAmount: number
  /** 累计成交笔数（笔） */
  dealCount: number
  /** 参与交易的买卖方数（家/人），按订单里的 buyerId/sellerId 去重 */
  participantCount: number
  /** 在架货源数（个） */
  publishedProductCount: number
}

export interface CategoryQuote {
  categoryName: string
  productCount: number
  minPrice: number
  maxPrice: number
}

export interface RecentDeal {
  orderNo: string
  productName: string
  quantity: number
  unit: string
  amount: number
  time: string
}

export interface HomeSummary {
  stat: HomeStat
  categoryQuotes: CategoryQuote[]
  recentDeals: RecentDeal[]
}

export async function getHomeSummary() {
  const response = await axios.get('/api/trade/home/summary')
  return response.data
}
