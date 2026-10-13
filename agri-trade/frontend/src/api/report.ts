import axios from 'axios'

/**
 * 报表（运营端）。
 *
 * 口径：成交排除已取消订单；不做环比/同比（库里没有足够历史，硬算出来的环比没有意义）。
 */
export interface TradeReportRow {
  period: string
  orderCount: number
  orderAmount: number
  dealCount: number
  dealAmount: number
  refundAmount: number
  settleCount: number
  settleAmount: number
  platformFee: number
  avgOrderAmount: number
}

export interface CategoryReportRow {
  categoryName: string
  orderCount: number
  dealAmount: number
  share: number
}

export async function getTradeReport(params: { startDate: string; endDate: string; granularity: string }) {
  const response = await axios.get('/api/trade/admin/report/trade', { params })
  return response.data
}

export async function getCategoryReport(params: { startDate: string; endDate: string }) {
  const response = await axios.get('/api/trade/admin/report/category', { params })
  return response.data
}

/** 导出 CSV：拿 blob 后交给浏览器下载（响应带 BOM，Excel 打开不乱码）。 */
export async function exportReport(params: {
  startDate: string
  endDate: string
  granularity: string
  type: 'trade' | 'category'
}) {
  const response = await axios.get('/api/trade/admin/report/export', { params, responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `report-${params.type}-${params.startDate}_${params.endDate}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
