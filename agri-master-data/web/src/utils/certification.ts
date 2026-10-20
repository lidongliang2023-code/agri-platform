import request from '@/utils/api'

/** 平台企业认证申请（core-platform）。 */
export interface MerchantCertification {
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

/** 平台个人实名申请（服务端只返回掩码）。 */
export interface UserIdentity {
  id: number | string
  identityNo: string
  realName: string
  idNoMasked: string
  status: string
  submitTime: string
  reviewerName: string | null
  reviewTime: string | null
  reviewRemark: string | null
  idNoChanged: boolean
}

export const getMerchantCertifications = (params: Record<string, unknown>) =>
  request.get('/api/v1/admin/merchant-certifications', { params })

export const auditMerchantCertification = (id: number | string, status: 'approved' | 'rejected', remark?: string) =>
  request.post(`/api/v1/admin/merchant-certifications/${id}/audit`, { status, remark })

export const getUserIdentities = (params: Record<string, unknown>) =>
  request.get('/api/v1/admin/user-identities', { params })

export const reviewUserIdentity = (id: number | string, approved: boolean, remark?: string) =>
  request.post(`/api/v1/admin/user-identities/${id}/review`, { approved, remark })
