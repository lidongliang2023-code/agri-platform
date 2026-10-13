import axios from 'axios'

/**
 * 赔付单。
 *
 * <p>用户端只有"我的获赔"这一个入口，范围由服务端按登录令牌绑定的经营主体推导 ——
 * 页面不自报主体号。</p>
 */
export interface CompensationVO {
  id: number
  compensationNo: string
  orderId: number
  orderNo: string
  disputeId: number
  compensationType: string
  compensationReason: string
  compensationAmount: number
  compensationStatus: string
  recipientId: number
  recipientName: string
  applicantName: string
  reviewResult: string
  reviewer: string
  reviewTime: string
  payTime: string
  transactionId: string
  createTime: string
}

export async function getMyCompensations() {
  const response = await axios.get('/api/trade/compensation/mine')
  return response.data
}
