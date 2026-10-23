import axios from 'axios'

/** 买家开票申请（交易域 /api/trade/invoice）。 */
export interface InvoiceRow {
  /** 雪花 ID 可能超过 JS 安全整数范围，后端按字符串返回。 */
  id: string | number
  invoiceNo: string
  orderId: number
  orderNo: string
  buyerId: number
  buyerName: string
  sellerId: number
  sellerName: string
  amount: number
  invoiceType: string
  title: string
  taxNo: string | null
  invoiceStatus: 'pending' | 'issued' | 'rejected'
  applyTime: string
  issueTime: string | null
  remark: string | null
}

export async function getMyInvoices(): Promise<{ code: number; message?: string; data?: InvoiceRow[] }> {
  const response = await axios.get('/api/trade/invoice/mine')
  return response.data
}

export async function applyInvoice(data: {
  orderId: number
  invoiceType: string
  title: string
  taxNo?: string
  remark?: string
}): Promise<{ code: number; message?: string; data?: InvoiceRow }> {
  const response = await axios.post('/api/trade/invoice', data)
  return response.data
}

export async function getAdminInvoices(params: {
  pageNum: number
  pageSize: number
  invoiceStatus?: string
  keyword?: string
}): Promise<{ code: number; message?: string; data?: { records: InvoiceRow[]; total: number } }> {
  const response = await axios.get('/api/trade/admin/invoice/page', { params })
  return response.data
}

export async function reviewInvoice(
  id: string | number,
  status: 'issued' | 'rejected',
  remark?: string,
): Promise<{ code: number; message?: string; data?: boolean }> {
  const response = await axios.post(`/api/trade/admin/invoice/${id}/review`, { status, remark })
  return response.data
}
