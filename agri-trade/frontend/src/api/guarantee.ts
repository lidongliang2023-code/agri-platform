import axios from 'axios'

/**
 * 保证金管理（运营端）。
 *
 * 保证金是"商家押在平台、用于赔付的钱"。冻结/解冻必须填原因，并且会写一条流水
 * （记录动作前后的可用与冻结额）—— 动了商家的钱而答不出"为什么"，
 * 是最容易被投诉也最难自证的一类问题。
 */
export interface GuaranteeRow {
  id: number
  merchantId: number
  merchantName: string
  guaranteeNo: string
  guaranteeType: string
  totalAmount: number
  availableAmount: number
  frozenAmount: number
  usedAmount: number
  guaranteeStatus: string
  applyTime: string
  verifyTime: string
  verifiedBy: string
  expireTime: string
  bankName: string
  remark: string
}

export interface GuaranteeLogRow {
  id: number
  guaranteeId: number
  action: string
  amount: number
  availableBefore: number
  availableAfter: number
  frozenBefore: number
  frozenAfter: number
  operator: string
  reason: string
  createTime: string
}

export async function getGuarantees(params: {
  pageNum: number
  pageSize: number
  guaranteeStatus?: string
  merchantName?: string
}) {
  const response = await axios.get('/api/trade/admin/guarantee/page', { params })
  return response.data
}

export async function getGuaranteeLogs(id: number) {
  const response = await axios.get(`/api/trade/admin/guarantee/${id}/logs`)
  return response.data
}

export async function verifyGuarantee(id: number, status: 'active' | 'rejected', remark?: string) {
  const response = await axios.post(`/api/trade/admin/guarantee/${id}/verify`, { status, remark })
  return response.data
}

export async function freezeGuarantee(id: number, amount: number, reason: string) {
  const response = await axios.post(`/api/trade/admin/guarantee/${id}/freeze`, {
    amount: String(amount),
    reason
  })
  return response.data
}

export async function unfreezeGuarantee(id: number, amount: number, reason: string) {
  const response = await axios.post(`/api/trade/admin/guarantee/${id}/unfreeze`, {
    amount: String(amount),
    reason
  })
  return response.data
}
