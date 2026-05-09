import axios from 'axios'

export interface ContractQuery {
  pageNum: number
  pageSize: number
  contractNo?: string
  buyerId?: string
  sellerId?: string
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
  goodsName: string
  quantity: number
  unit: string
  unitPrice: number
  totalAmount: number
  signStatus: string
  contractStatus: string
  effectiveDate: string
  expireDate: string
  createTime: string
  updateTime: string
}

export async function getContractList(params: ContractQuery) {
  const response = await axios.get('/api/trade/contract/list', { params })
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
  const response = await axios.post(`/api/trade/contract/${id}/sign`)
  return response.data
}