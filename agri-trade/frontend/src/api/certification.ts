import axios from 'axios'

/**
 * 经营主体认证（企业认证）。
 *
 * 数据与接口都归属 core-platform（platform_merchant / platform_merchant_certification），
 * 运营端只是入口 —— 与"用户-主体绑定"同一套做法。
 * 成功码是平台口径的 **0**（不是交易后端的 200）；业务失败走 HTTP 200 + body 里带 code。
 */
export interface CertificationRow {
  id: number | string
  merchantId: number | string
  merchantName: string
  certNo: string
  companyName: string
  creditCode: string
  legalPerson: string | null
  licenseNo: string | null
  contactName: string | null
  contactPhone: string | null
  attachNote: string | null
  certStatus: string
  submitTime: string
  reviewer: string | null
  reviewTime: string | null
  reviewRemark: string | null
}

export interface MerchantRow {
  id: number | string
  code: string
  name: string
  type: string
  creditCode: string | null
  contactName: string | null
  contactPhone: string | null
  status: number
  verifyStatus: string | null
  verifyTime: string | null
  verifyRemark: string | null
}

export async function getCertifications(params: {
  pageNum: number
  pageSize: number
  certStatus?: string
  merchantName?: string
}) {
  const response = await axios.get('/api/v1/admin/merchant-certifications', { params })
  return response.data
}

export async function auditCertification(id: number | string, status: 'approved' | 'rejected', remark?: string) {
  const response = await axios.post(`/api/v1/admin/merchant-certifications/${id}/audit`, { status, remark })
  return response.data
}

export async function getMerchants(params: { page: number; size: number; keyword?: string }) {
  const response = await axios.get('/api/v1/admin/merchants', { params })
  return response.data
}
