import axios from 'axios'

export interface ContractQuery {
  pageNum: number
  pageSize: number
  contractNo?: string
  contractStatus?: string
}

export interface ContractVO {
  id: number
  contractNo: string
  orderId: number
  buyerId: number
  buyerName: string
  sellerId: number
  sellerName: string
  /**
   * 合同表没有 goodsName / totalAmount / signStatus 这三个字段名 ——
   * 对应的真实字段是 contractName / contractAmount / buyerSignStatus+sellerSignStatus。
   * 类型定义原先带的是错的那套，页面照它写就会读到 undefined。
   */
  contractName: string
  contractType: string
  quantity: number
  unit: string
  unitPrice: number
  contractAmount: number
  buyerSignStatus: string
  sellerSignStatus: string
  contractStatus: string
  effectiveDate: string
  expireDate: string
  signDate: string
  archiveStatus: string
  remark: string
  createTime: string
  updateTime: string
}

export async function getContractList(params: ContractQuery) {
  const response = await axios.get('/api/trade/contract/page', { params })
  return response.data
}

export async function getContractById(id: number) {
  const response = await axios.get(`/api/trade/contract/${id}`)
  return response.data
}

export async function createContract(data: any) {
  const response = await axios.post('/api/trade/contract', data)
  return response.data
}

export async function signContract(id: number) {
  // 签署方由服务端按登录身份判定（不接受前端声明"我是买方还是卖方"），
  // 所以这里不需要传任何参数。空对象是为了满足后端 @RequestBody 的读取。
  const response = await axios.post(`/api/trade/contract/${id}/sign`, {})
  return response.data
}

/** 归档（后端 /{id}/archive 早已有，前端一直没有入口）。 */
export async function archiveContract(id: number) {
  const response = await axios.post(`/api/trade/contract/${id}/archive`, {})
  return response.data
}
