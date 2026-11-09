import axios from 'axios'

/**
 * 产销对接 · 卖家中心（承接侧）接口。
 *
 * 口径：供给意向由农业生产域的经营主体发布，**承接由供应商主体自己决定**——
 * 在这里看清"谁的货、多少量、什么窗口"，认领后以**我自己的主体号**建品定价。
 * 平台运营端不再代做对接（`/api/trade/admin/p2t` 的 pool/audit/build/products/price 已返回 410）。
 */

const BASE = '/api/trade/seller/p2t'

/** 交易端统一响应壳：成功码是 200（生产端是 0），两边判据不能混用。 */
export interface SellerEnvelope<T> {
  code: number
  message?: string
  data?: T
}

export interface SellerBinding {
  /** 主体号可能是字符串（前端会话里的绑定）也可能是数字（接口出参），一律按字符串回传给后端 */
  merchantId: string | number
  merchantName?: string
  roleInMerchant?: string
}

/** 一条可承接的供给意向：供给事实全部来自生产端，承接状态来自交易域实查。 */
export interface ClaimableOffer {
  id?: number
  offerNo: string
  batchNo?: string
  cropName?: string
  varietyName?: string
  categoryName?: string
  farmName?: string
  origin?: string
  unit?: string
  availableQty?: number
  reservedQty?: number
  minOrderQty?: number
  windowStart?: string
  windowEnd?: string
  auditStatus?: string
  tradeStatus?: string
  /** 是否已被承接（任何一家） */
  claimed?: boolean
  /** 是否被"我的某个主体"承接 */
  claimedByMe?: boolean
  claimedProductCode?: string
}

export interface ClaimablePool {
  records: ClaimableOffer[]
  total: number
  pageNum: number
  pageSize: number
  merchants?: SellerBinding[]
}

export interface MyClaimedProduct {
  id: number
  productCode: string
  productName: string
  sourceOfferNo?: string
  harvestBatchNo?: string
  sellerId?: string
  sellerName?: string
  stockQuantity?: number
  price?: number
  publishStatus?: string
  description?: string
}

export async function getClaimablePool(query: {
  pageNum: number
  pageSize: number
  keyword?: string
  auditStatus?: string
}): Promise<SellerEnvelope<ClaimablePool>> {
  const res = await axios.get<SellerEnvelope<ClaimablePool>>(`${BASE}/pool`, { params: query })
  return res.data
}

/**
 * 承接一张意向：接受 + 以我的主体号建品 + 回写上架，后端一个事务做完。
 *
 * @param sellerId 我绑定的主体之一；不传时由后端在"只绑一家"的情况下自动选，绑多家会要求显式指定
 */
export async function claimOffer(offerNo: string, payload: {
  sellerId?: string | number
  listedQty?: number
  price?: number
}): Promise<SellerEnvelope<MyClaimedProduct>> {
  const res = await axios.post<SellerEnvelope<MyClaimedProduct>>(
    `${BASE}/pool/${encodeURIComponent(offerNo)}/claim`, payload)
  return res.data
}

export async function getMyClaimedProducts(query: {
  pageNum: number
  pageSize: number
  keyword?: string
}): Promise<SellerEnvelope<{ records: MyClaimedProduct[]; total: number; reason?: string }>> {
  const res = await axios.get<SellerEnvelope<{ records: MyClaimedProduct[]; total: number; reason?: string }>>(
    `${BASE}/products`, { params: query })
  return res.data
}

/** 改自己承接出来的商品挂牌价（后端会先证明这件商品属于我）。 */
export async function updateClaimedPrice(id: number, price: number): Promise<SellerEnvelope<unknown>> {
  const res = await axios.put<SellerEnvelope<unknown>>(`${BASE}/products/${id}/price`, { price })
  return res.data
}
