/**
 * 用户-经营主体绑定（平台级）。
 *
 * <p>数据与接口都归属 core-platform（agri_core.platform_user_merchant），
 * 不属于交易模块 —— 这里只是从运营端入口去调它。所以路径是 /api/v1/admin/**、
 * 成功码是平台口径的 **0**（不是交易后端的 200）。混用这两个约定是很容易犯的错，
 * 所以这个文件独立出来，不放进 api/admin.ts。</p>
 *
 * <p>平台的返回约定还有一处要注意：业务失败（参数缺、重复绑定、主体不存在）
 * 走的是 **HTTP 200 + body 里带 code**，所以判断成功必须看 body.code，不能看状态行。</p>
 */
import axios from 'axios'

export interface UserMerchantBinding {
  id: number | string
  userId: number | string
  merchantId: number | string
  merchantName: string | null
  merchantType: string | null
  roleInMerchant: string
  status: number
  createdAt: string
}

export interface BindingQuery {
  pageNum: number
  pageSize: number
  userId?: string
  merchantId?: string
}

export async function getBindings(params: BindingQuery) {
  const response = await axios.get('/api/v1/admin/user-merchants', { params })
  return response.data
}

export async function createBinding(data: { userId: string; merchantId: string; roleInMerchant: string }) {
  const response = await axios.post('/api/v1/admin/user-merchants', {
    userId: Number(data.userId),
    merchantId: Number(data.merchantId),
    roleInMerchant: data.roleInMerchant
  })
  return response.data
}

/** 启停绑定。停用不移除记录 —— 任职历史本身要留痕。 */
export async function changeBindingStatus(id: number | string, status: number) {
  const response = await axios.put(`/api/v1/admin/user-merchants/${id}/status`, null, { params: { status } })
  return response.data
}
