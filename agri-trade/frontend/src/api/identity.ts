import axios from 'axios'

/**
 * 我的经营主体。
 *
 * <p>身份不再由前端自报：订单/纠纷列表的范围一律由后端从登录令牌推导
 * （后端调 core-platform 的 /api/v1/platform/merchants/mine）。
 * 这个接口只用来**展示**"我当前以哪家主体在看数据"，
 * 好让"查不到数据"能区分成两种情况：真的没有单据，还是账号没绑主体。</p>
 */
export interface MyMerchant {
  id: number | string
  userId: number | string
  merchantId: number | string
  merchantName: string
  merchantType: string
  /** owner 负责人 / buyer 采购 / seller 销售 / finance 财务 */
  roleInMerchant: string
  status: number
}

export async function getMyMerchants(): Promise<{ code: number; message?: string; data?: MyMerchant[] }> {
  const response = await axios.get('/api/trade/identity/my-merchants')
  return response.data
}

/**
 * 个人实名认证。
 *
 * <p>口径：服务端**不存身份证号明文**，只存掩码与加盐哈希；因此这里拿回来的
 * 永远是掩码（如 `110***********002X`），页面上也不必为"显示明文"做任何事。
 * 提交时明文只在请求体里出现一次。</p>
 */
export interface RealNameRecord {
  id: number | string
  identityNo: string
  realName: string
  idNoMasked: string
  status: 'pending' | 'verified' | 'rejected'
  submitTime: string
  reviewerName: string | null
  reviewTime: string | null
  reviewRemark: string | null
  /** 重新提交时：号码与上一次是否不同（服务端用同一条记录的盐比对哈希得出） */
  idNoChanged: boolean
}

export async function getMyRealName(): Promise<{ code: number; message?: string; data?: RealNameRecord | null }> {
  const response = await axios.get('/api/v1/platform/identity/real-name/mine')
  return response.data
}

export async function submitRealName(data: { realName: string; idNo: string }) {
  const response = await axios.post('/api/v1/platform/identity/real-name', data)
  return response.data
}

export async function getUserIdentityPage(params: Record<string, unknown>) {
  const response = await axios.get('/api/v1/admin/user-identities', { params })
  return response.data
}

export async function reviewUserIdentity(id: number | string, approved: boolean, remark?: string) {
  const response = await axios.post(`/api/v1/admin/user-identities/${id}/review`, { approved, remark })
  return response.data
}
