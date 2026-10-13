import axios from 'axios'

/**
 * 询价（采购方对某个货源问价）。
 *
 * 这是"询价 → 报价 → 受理 → 生成订单"整条链路的**起点**：
 * 在此之前前端没有任何入口能创建询价，链路上游只能靠 SQL 造数据。
 *
 * 采购方由服务端按登录身份推导（询价单的采购方其实是从采购需求带过来的，
 * 所以能对哪张需求询价，取决于那张需求是不是你自己的）。
 */
export interface InquiryVO {
  id: number
  inquiryNo: string
  demandId: number
  demandNo: string
  productId: number
  productName: string
  buyerId: number
  buyerName: string
  sellerId: number
  sellerName: string
  quantity: number
  unit: string
  /** 采购方给的期望价区间（从采购需求带过来，可能为空） */
  priceMin: number
  priceMax: number
  inquiryStatus: string
  replyCount: number
  replyDeadline: string
  createTime: string
}

/** 对某个货源发起询价（需要的是一张**属于自己**的采购需求）。 */
export async function createInquiry(demandId: number, productId: number) {
  const response = await axios.post('/api/trade/negotiation/inquiry', { demandId, productId })
  return response.data
}

/** 我发起的询价（范围由服务端按身份推导）。 */
export async function getMyInquiries() {
  const response = await axios.get('/api/trade/negotiation/inquiry/mine')
  return response.data
}

/** 我收到的询价（供应商视角，等我报价的）。 */
export async function getReceivedInquiries() {
  const response = await axios.get('/api/trade/negotiation/inquiry/received')
  return response.data
}

/**
 * 对一条询价报价。
 *
 * 走的是 POST /quote 的"带 inquiryId"分支：主体、品类、收货地全部继承询价单，
 * 卖家只需给单价（数量默认沿用询价单里的）。服务端会算总价。
 */
export async function quoteInquiry(data: {
  inquiryId: number
  unitPrice: number
  quantity?: number
  freightAmount?: number
  remark?: string
}) {
  const response = await axios.post('/api/trade/negotiation/quote', data)
  return response.data
}
