import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { getMineDashboard, type MineDashboard } from '@/api/mine-dashboard'
import { getMyMerchants, getMyRealName, type MyMerchant, type RealNameRecord } from '@/api/identity'
import { getOrderList } from '@/api/order'
import { getDemandList, type DemandVO } from '@/api/demand'
import { getEvaluationList, type EvaluationVO } from '@/api/evaluation'
import { getDisputeList, type DisputeVO } from '@/api/dispute'
import { getSellerProductList, type SellerProductDetail } from '@/api/product'
import { getLogisticsList, type LogisticsVO } from '@/api/logistics'
import { getMyGuarantees, type GuaranteeRow } from '@/api/guarantee'
import { getMyInquiries, getReceivedInquiries, type InquiryVO } from '@/api/inquiry'

export interface MemberOrderRow {
  id: number; orderNo: string; buyerId: number; buyerName: string; sellerId: number; sellerName: string
  productName: string; categoryName?: string; totalQuantity: number | null; totalAmount: number
  paidAmount?: number; orderStatus: string; paymentStatus: string; createTime: string
}
interface Envelope<T> { code?: number; message?: string; data?: T }
interface Page<T> { records?: T[]; total?: number }
function pageRows<T>(body: Envelope<Page<T>>) {
  if (body.code !== 200) throw new Error(body.message || '加载失败')
  return { rows: body.data?.records || [], total: body.data?.total || 0 }
}
function arrayRows<T>(body: Envelope<T[]>) {
  if (body.code !== 200) throw new Error(body.message || '加载失败')
  const rows = Array.isArray(body.data) ? body.data : []
  return { rows, total: rows.length }
}
/** 参数变化、手动刷新和卸载均通过同一 watch 清理，迟到响应不会覆盖当前页。 */
function useRows<T>(load: () => Promise<{ rows: T[]; total: number }>, dependencies: () => unknown[], enabled: () => boolean = () => true) {
  const state = reactive({ rows: [] as T[], total: 0, loading: false, error: '' }) as { rows: T[]; total: number; loading: boolean; error: string }
  const revision = ref(0)
  watch(() => [revision.value, ...dependencies()], async (_next, _old, cleanup) => {
    let cancelled = false
    cleanup(() => { cancelled = true })
    state.error = ''
    if (!enabled()) { state.rows = []; state.total = 0; state.loading = false; return }
    state.loading = true
    try {
      const result = await load()
      if (!cancelled) { state.rows = result.rows; state.total = result.total }
    } catch (error) {
      if (!cancelled) { state.rows = []; state.total = 0; state.error = error instanceof Error ? error.message : '加载失败' }
    } finally { if (!cancelled) state.loading = false }
  }, { immediate: true })
  return Object.assign(state, { reload: () => { revision.value++ } })
}
export function useMemberBase() {
  const state = reactive({ loading: true, error: '', merchants: [] as MyMerchant[], dashboard: null as MineDashboard | null, realName: null as RealNameRecord | null })
  const revision = ref(0)
  watch(revision, async (_next, _old, cleanup) => {
    let cancelled = false; cleanup(() => { cancelled = true }); state.loading = true; state.error = ''
    const [merchants, dashboard, realName] = await Promise.allSettled([getMyMerchants(), getMineDashboard(), getMyRealName()])
    if (cancelled) return
    if (merchants.status === 'fulfilled' && merchants.value.code === 200) state.merchants = merchants.value.data || []
    else { state.merchants = []; state.error = merchants.status === 'fulfilled' ? merchants.value.message || '无法解析当前账号绑定的经营主体' : '无法解析当前账号绑定的经营主体' }
    state.dashboard = dashboard.status === 'fulfilled' && dashboard.value.code === 200 ? dashboard.value.data || null : null
    state.realName = realName.status === 'fulfilled' && realName.value.code === 200 ? realName.value.data || null : null
    state.loading = false
  }, { immediate: true })
  return reactive({ ...toReactiveAccessors(state), merchantIds: computed(() => state.merchants.map(item => String(item.merchantId))), primary: computed(() => state.merchants[0] || null), reload: () => { revision.value++ } })
}
function toReactiveAccessors<T extends object>(state: T) {
  return Object.fromEntries(Object.keys(state).map(key => [key, computed(() => state[key as keyof T])])) as { [K in keyof T]: import('vue').ComputedRef<T[K]> }
}
export function useOrders(side: MaybeRefOrGetter<'buyer' | 'seller'>, status: MaybeRefOrGetter<string>, pageNum: MaybeRefOrGetter<number> = 1, pageSize: MaybeRefOrGetter<number> = 20) {
  return useRows<MemberOrderRow>(async () => pageRows(await getOrderList({ side: toValue(side), orderStatus: toValue(status) || undefined, pageNum: toValue(pageNum), pageSize: toValue(pageSize) })), () => [toValue(side), toValue(status), toValue(pageNum), toValue(pageSize)])
}
export function useDemands(buyerId: MaybeRefOrGetter<string | null>) {
  return useRows<DemandVO>(async () => pageRows(await getDemandList({ pageNum: 1, pageSize: 50, buyerId: toValue(buyerId)! })), () => [toValue(buyerId)], () => Boolean(toValue(buyerId)))
}
export function useMyInquiryRows() { return useRows<InquiryVO>(async () => arrayRows(await getMyInquiries()), () => []) }
export function useReceivedInquiries() { const state = useRows<InquiryVO>(async () => arrayRows(await getReceivedInquiries()), () => []); return computed(() => state.rows) }
export function useEvaluations(params: MaybeRefOrGetter<{ evaluatorId?: number | string; evaluateeId?: number | string }>) {
  return useRows<EvaluationVO>(async () => { const p = toValue(params); return pageRows(await getEvaluationList({ pageNum: 1, pageSize: 100, evaluatorId: p.evaluatorId ? String(p.evaluatorId) : undefined, evaluateeId: p.evaluateeId ? String(p.evaluateeId) : undefined })) }, () => [toValue(params).evaluatorId, toValue(params).evaluateeId], () => Boolean(toValue(params).evaluatorId || toValue(params).evaluateeId))
}
export function useDisputes() { return useRows<DisputeVO>(async () => pageRows(await getDisputeList({ pageNum: 1, pageSize: 100 })), () => []) }
export function useProducts(sellerId: MaybeRefOrGetter<string | null>) { return useRows<SellerProductDetail>(async () => pageRows(await getSellerProductList({ pageNum: 1, pageSize: 100, sellerId: toValue(sellerId)! })), () => [toValue(sellerId)], () => Boolean(toValue(sellerId))) }
export function useLogistics() { return useRows<LogisticsVO>(async () => pageRows(await getLogisticsList({ pageNum: 1, pageSize: 100 })), () => []) }
export function useGuarantees() {
  const state = useRows<GuaranteeRow>(async () => arrayRows(await getMyGuarantees()), () => [])
  return computed(() => state.rows.filter(row => row.guaranteeStatus === 'active' && (!row.expireTime || new Date(row.expireTime).getTime() > Date.now())))
}
