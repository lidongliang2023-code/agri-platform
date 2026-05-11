import axios from 'axios'

export interface PriceRecommendation {
  productId: number
  productName: string
  categoryCode: string
  categoryName: string
  recommendedPrice: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  priceTrend: string
  confidence: number
  priceChange: number
  priceChangePercent: number
  marketDemand: string
  supplyStatus: string
  suggestion: string
}

export interface PriceTrend {
  date: string
  price: number
  volume: number
  avgPrice: number
}

export interface MarketPrice {
  productName: string
  categoryCode: string
  categoryName: string
  currentPrice: number
  previousPrice: number
  priceChange: number
  priceChangePercent: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  tradingVolume: number
  updateTime: string
}

export async function getPriceRecommendation(productId: number) {
  const response = await axios.get(`/api/trade/price/recommendation/${productId}`)
  return response.data
}

export async function getCategoryPriceRecommendation(categoryCode: string) {
  const response = await axios.get(`/api/trade/price/recommendation/category/${categoryCode}`)
  return response.data
}

export async function getPriceTrend(productId: number, days: number = 7) {
  const response = await axios.get(`/api/trade/price/trend/${productId}`, {
    params: { days }
  })
  return response.data
}

export async function getCategoryPriceTrend(categoryCode: string, days: number = 7) {
  const response = await axios.get(`/api/trade/price/trend/category/${categoryCode}`, {
    params: { days }
  })
  return response.data
}

export async function getMarketPrice(productName: string) {
  const response = await axios.get(`/api/trade/price/market/${encodeURIComponent(productName)}`)
  return response.data
}

export async function getMarketPricesByCategory(categoryCode: string) {
  const response = await axios.get(`/api/trade/price/market/category/${categoryCode}`)
  return response.data
}

export async function calculatePrice(productId: number) {
  const response = await axios.get(`/api/trade/price/calculate/${productId}`)
  return response.data
}

export async function getPriceRange(categoryCode: string) {
  const response = await axios.get(`/api/trade/price/range/${categoryCode}`)
  return response.data
}

export async function getAveragePrice(categoryCode: string) {
  const response = await axios.get(`/api/trade/price/average/${categoryCode}`)
  return response.data
}