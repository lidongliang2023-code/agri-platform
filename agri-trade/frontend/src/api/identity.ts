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
