export interface MarketData {
  totalAmount: number
  userCount: number
  transactionCount: number
  coverageCount: number
  marketList: MarketItem[]
}

export interface MarketItem {
  category: string
  price: string
  change: string
  volume: string
}

export interface TransactionItem {
  id: number
  productName: string
  buyerName: string
  quantity: string
  unitPrice: string
  time: string
}

export async function getMarketData() {
  const mockData = {
    data: {
      totalAmount: 128.5,
      userCount: 56.8,
      transactionCount: 89.2,
      coverageCount: 320,
      marketList: [
        { category: '红富士苹果', price: '3.25', change: '+8.2%', volume: '12,850' },
        { category: '土豆', price: '1.15', change: '-2.5%', volume: '8,230' },
        { category: '白萝卜', price: '0.85', change: '+1.2%', volume: '5,670' },
        { category: '大白菜', price: '0.62', change: '-5.3%', volume: '9,120' },
      ]
    }
  }
  return mockData
}

export async function getRecentTransactions() {
  const mockData = {
    data: [
      { id: 1, productName: '山东寿光番茄', buyerName: '北京XX商贸', quantity: '5000', unitPrice: '2.5', time: '2分钟前' },
      { id: 2, productName: '云南蓝莓', buyerName: '上海XX超市', quantity: '2000', unitPrice: '35', time: '5分钟前' },
      { id: 3, productName: '陕西洛川苹果', buyerName: '广州XX批发', quantity: '10000', unitPrice: '3.8', time: '8分钟前' },
      { id: 4, productName: '海南芒果', buyerName: '深圳XX餐饮', quantity: '3000', unitPrice: '8.5', time: '12分钟前' },
      { id: 5, productName: '新疆红枣', buyerName: '杭州XX食品', quantity: '8000', unitPrice: '12', time: '15分钟前' },
    ]
  }
  return mockData
}