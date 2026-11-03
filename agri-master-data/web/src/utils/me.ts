/**
 * 用户端「我的」接口族（core-platform）。
 *
 * <p>与运营端 API 的区别：这些接口从**平台令牌**解析当前用户，不接受 userId 参数，
 * 因此天然只能读到自己的数据，不存在"换个 id 查别人"的风险。</p>
 */
import { userGet, userPost } from '@/utils/userApi'

export interface MyMerchant {
  id: string
  userId: string
  merchantId: string
  merchantName: string
  merchantType: string
  verifyStatus: string
  roleInMerchant: string
  status: number
  createdAt: string
}

export interface MyIdentity {
  id?: string
  identityNo?: string
  realName?: string
  idNoMasked?: string
  status?: string
  submitTime?: string
  reviewTime?: string
  reviewRemark?: string
  policeVerified?: boolean
  livenessVerified?: boolean
}

export interface MyCertification {
  id: string
  merchantId: string
  merchantName: string
  certNo: string
  companyName: string
  creditCode: string
  legalPerson?: string | null
  licenseNo?: string | null
  contactName?: string | null
  contactPhone?: string | null
  businessLicenseUrl?: string | null
  certStatus?: string
  submitTime?: string
  reviewTime?: string
  reviewRemark?: string | null
}

export interface MessageRow {
  id: string
  title: string
  content: string
  readFlag: number
  createdAt: string
  scene?: string
}

export const getMyMerchants = () => userGet<MyMerchant[]>('/api/v1/platform/merchants/mine')

export const getMyRealName = () =>
  userGet<MyIdentity | null>('/api/v1/platform/identity/real-name/mine')

export const getMyCertifications = () =>
  userGet<MyCertification[]>('/api/v1/platform/merchant-certifications/mine')

export const getMyMessages = (page = 1, size = 20) =>
  userGet<{ records: MessageRow[]; total: number | string; page: number; size: number }>('/api/v1/messages', { page, size })

export const getUnreadCount = () =>
  userGet<number>('/api/v1/messages/unread-count')

export const markMessageRead = (id: string) => userPost(`/api/v1/messages/${id}/read`)

export interface AnnouncementRow {
  id: string
  title: string
  type?: string
  content: string
  publishTime?: string
  expireTime?: string | null
}

/** 用户端可见公告：已发布且未到期（平台级数据，不按主体过滤）。 */
export const getMyAnnouncements = (limit = 20) =>
  userGet<AnnouncementRow[]>('/api/user/announcements', { limit })
