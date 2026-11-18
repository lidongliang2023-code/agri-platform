<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { requireTradeLogin, getTradeRole } from '../../auth'
import { computed, ref } from 'vue'
import { money, ORDER_STATUS, tradeApi, type TradeOrder, type TradeOrderItem } from '../../api'

const order = ref<TradeOrder | null>(null)
const items = ref<TradeOrderItem[]>([])
const loading = ref(true)
const loadError = ref('')
const action = ref('')
const merchantIds = ref<string[]>([])
const role = ref(getTradeRole())
const amBuyer = computed(() => role.value === 'buyer' && merchantIds.value.includes(String(order.value?.buyerId)))
const amSeller = computed(() => role.value === 'seller' && merchantIds.value.includes(String(order.value?.sellerId)))
let orderId = 0
const canPay = computed(() => amBuyer.value && order.value?.paymentStatus !== 'paid' && ['pending', 'pending_confirm'].includes(order.value?.orderStatus || ''))
const canShip = computed(() => amSeller.value && order.value?.orderStatus === 'paid')
const canReceive = computed(() => amBuyer.value && order.value?.orderStatus === 'shipped')
const canCancel = computed(() => amBuyer.value && order.value?.paymentStatus !== 'paid' && ['pending', 'pending_confirm'].includes(order.value?.orderStatus || ''))
const hasActions = computed(() => canPay.value || canShip.value || canReceive.value || canCancel.value)
const links = computed(() => [
  { key: 'contract', label: '合同与签署', icon: '约', tone: 'blue' },
  { key: 'ship', label: '物流与运输轨迹', icon: '运', tone: '' },
  { key: 'after', label: '收货与售后', icon: '售', tone: 'amber' },
  { key: 'refund', label: '申请退款', icon: '退', tone: 'red' },
  { key: 'rate', label: '交易评价', icon: '评', tone: 'violet' },
  { key: 'invoice', label: '发票申请', icon: '票', tone: 'blue' },
].filter(link => role.value === 'buyer' || !['refund', 'invoice'].includes(link.key)))

onLoad((options?: Record<string, string>) => { orderId = Number(options?.id) })
onShow(() => {role.value=getTradeRole();order.value=null;items.value=[];void load()})
function business(key: string) { const routes: Record<string,string> = { contract:'/pages/contracts/index', ship:'/pages/logistics/index', after:amBuyer.value?'/pages/buyer/after':'/pages/business/index?key=after&role=seller', refund:'/pages/buyer/fund', invoice:'/pages/buyer/fund', rate:'/pages/business/index?key=rate&role=' + (amBuyer.value?'buyer':'seller') }; const url=routes[key] || '/pages/business/index?key=' + key + '&role=' + (amBuyer.value?'buyer':'seller'); uni.navigateTo({ url: url + (url.includes('?')?'&':'?') + 'orderId=' + orderId }) }
async function load() {
  if (!requireTradeLogin()) return
  loading.value = true
  loadError.value = ''
  try {
    if (!Number.isFinite(orderId) || orderId <= 0) throw new Error('订单链接无效')
    merchantIds.value = (await tradeApi.merchants()).map(m => String(m.merchantId))
    const [detail, rows] = await Promise.all([tradeApi.order(orderId), tradeApi.orderItems(orderId)])
    if (!detail) throw new Error('订单不存在或不可访问')
    if (!merchantIds.value.includes(String(role.value === 'buyer' ? detail.buyerId : detail.sellerId))) throw new Error('该订单不属于当前中心，请在“我的”切换中心后查看')
    order.value = detail
    items.value = rows || []
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '订单加载失败'
  } finally { loading.value = false }
}
async function act(type: 'pay' | 'ship' | 'receive' | 'cancel') {
  if (action.value || !({ pay: canPay.value, ship: canShip.value, receive: canReceive.value, cancel: canCancel.value }[type])) return
  const titles = { pay: '确认支付该订单吗？', ship: '确认发货吗？', receive: '确认已经收到货物吗？', cancel: '确认取消订单吗？' }
  const modal = await new Promise<boolean>((resolve) => uni.showModal({ title: titles[type], success: (res: any) => resolve(Boolean(res.confirm)), fail: () => resolve(false) }))
  if (!modal) return
  action.value = type
  try {
    if (type === 'pay') await tradeApi.payOrder(orderId)
    if (type === 'ship') await tradeApi.shipOrder(orderId)
    if (type === 'receive') await tradeApi.receiveOrder(orderId, order.value?.deliveryContact || '收货人')
    if (type === 'cancel') await tradeApi.cancelOrder(orderId)
    uni.showToast({ title: '操作成功', icon: 'success' }); await load()
  } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' }) }
  finally { action.value = '' }
}
</script>

<template>
  <view class="page" :class="{ 'with-bar': hasActions && order && !loadError }">
    <view v-if="loading && !order" class="loading">正在加载订单…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载订单</button></view>
    <template v-else-if="order">
      <view class="hero">
        <view class="between"><text class="status">{{ ORDER_STATUS[order.orderStatus] || order.orderStatus }}</text><text class="role-tag">{{ amBuyer ? '我是买方' : amSeller ? '我是卖方' : '' }}</text></view>
        <text class="amount">{{ money(order.totalAmount) }}</text>
        <text class="hero-sub">{{ order.paymentStatus === 'paid' ? '已支付' : '待支付' }} · {{ order.createTime }}</text>
        <text class="hero-sub mono">订单号 {{ order.orderNo }}</text>
      </view>

      <view class="card">
        <view class="card-head"><text class="card-title">商品明细</text><text class="tiny">共 {{ items.length }} 项</text></view>
        <view v-for="item in items" :key="item.id" class="item">
          <view class="grow"><text class="item-name">{{ item.productName }}</text><text class="tiny">{{ item.specLevel || '标准规格' }} · {{ item.quantity }} {{ item.unit }} × {{ money(item.unitPrice) }}</text></view>
          <text class="price">{{ money(item.totalPrice) }}</text>
        </view>
        <view v-if="!items.length" class="empty">暂无商品明细</view>
      </view>

      <view class="card">
        <text class="card-title">交易双方</text>
        <view class="kv"><text class="kv-label">采购方</text><text class="kv-value">{{ order.buyerName || '—' }}</text></view>
        <view class="kv"><text class="kv-label">供货方</text><text class="kv-value">{{ order.sellerName || '—' }}</text></view>
      </view>

      <view class="card">
        <text class="card-title">收货信息</text>
        <view class="kv"><text class="kv-label">收货人</text><text class="kv-value">{{ order.deliveryContact || '—' }}</text></view>
        <view class="kv"><text class="kv-label">联系电话</text><text class="kv-value">{{ order.deliveryPhone || '—' }}</text></view>
        <view class="kv"><text class="kv-label">收货地址</text><text class="kv-value">{{ [order.deliveryProvince, order.deliveryCity, order.deliveryAddress].filter(Boolean).join(' ') || '—' }}</text></view>
      </view>

      <text class="section-title">订单相关业务</text>
      <view class="menu-list">
        <view v-for="link in links" :key="link.key" class="menu-row" @tap="business(link.key)">
          <view class="entry-icon" :class="link.tone">{{ link.icon }}</view>
          <text class="menu-text">{{ link.label }}</text>
          <text class="arrow">›</text>
        </view>
      </view>

      <view v-if="hasActions" class="bottom-bar">
        <button v-if="canCancel" class="btn btn-line" :loading="action === 'cancel'" :disabled="!!action" @tap="act('cancel')">取消订单</button>
        <button v-if="canPay" class="btn btn-primary" :loading="action === 'pay'" :disabled="!!action" @tap="act('pay')">确认支付</button>
        <button v-if="canShip" class="btn btn-primary" :loading="action === 'ship'" :disabled="!!action" @tap="act('ship')">确认发货</button>
        <button v-if="canReceive" class="btn btn-primary" :loading="action === 'receive'" :disabled="!!action" @tap="act('receive')">确认收货</button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.hero { margin-bottom: 20rpx; padding: 32rpx; border-radius: 24rpx; background: linear-gradient(135deg, #073821, #12764a); color: #fff; }
.status { font-size: 32rpx; font-weight: 700; }
.role-tag { color: #a9e7c1; font-size: 24rpx; }
.amount { display: block; margin-top: 20rpx; font-family: "DIN Alternate", "Helvetica Neue", Arial, sans-serif; font-size: 52rpx; font-weight: 700; }
.hero-sub { display: block; margin-top: 8rpx; color: rgba(255, 255, 255, .7); font-size: 24rpx; overflow-wrap: anywhere; }
.item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0; border-top: 1rpx solid var(--c-line); }
.item:first-of-type { border-top: 0; }
.item-name { display: block; margin-bottom: 6rpx; font-size: 28rpx; font-weight: 600; }
.item .tiny { display: block; }
.card-title { display: block; }
.menu-list { margin-bottom: 20rpx; }
</style>
