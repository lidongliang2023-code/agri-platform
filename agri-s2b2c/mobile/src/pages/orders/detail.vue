<template>
  <view class="page detail-page">
    <view v-if="loading" class="loading">正在加载订单详情…</view>
    <template v-else-if="order">
      <view class="status-hero">
        <text class="status-kicker">ORDER STATUS</text>
        <text class="status-title">{{ order.statusText || statusMeta(order.status).label }}</text>
        <text class="status-desc">{{ statusDesc }}</text>
      </view>

      <view class="card address-card" v-if="order.address">
        <view class="address-icon">址</view>
        <view>
          <text class="address-name">{{ order.address.name }} · {{ order.address.phone }}</text>
          <text class="address-detail">{{ fullAddress(order.address) }}</text>
        </view>
      </view>

      <view class="card">
        <view class="card-head"><text class="card-title">商品清单</text><text class="card-sub">{{ order.items?.length || 0 }} 种商品</text></view>
        <view v-for="item in order.items || []" :key="item.id" class="item-row">
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
          <view v-else class="item-image item-placeholder">丰</view>
          <view class="item-copy">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-spec">{{ item.spec }}</text>
            <text class="item-spec">下单来源批次：{{ item.prodBatchNo || '历史来源未记录' }}</text>
            <button class="btn btn-sm btn-ghost trace-button" :aria-label="`查看订单溯源：${item.name}`" @tap="showTrace(item.id)">查看溯源</button>
            <button v-if="order.status === 'COMPLETED'" class="btn btn-sm" @tap="openReview(item)">评价商品</button>
            <view class="item-bottom"><text class="price">{{ money(item.price) }}</text><text>× {{ item.quantity }}</text></view>
          </view>
        </view>
      </view>

      <view v-if="traceOpened" class="card info-card">
        <text class="card-title">订单来源与单品流转</text>
        <text v-if="traceLoading">正在加载溯源记录…</text>
        <text v-if="traceError" class="trace-error">{{ traceError }}</text>
        <template v-if="traceData">
          <text class="item-spec">{{ traceData.reason || `下单批次：${traceData.batchNo || '未记录'}` }}</text>
          <text v-if="!traceData.units?.length" class="item-spec">尚未记录实际出货单品码，不代表该订单已完成单品溯源。</text>
          <view v-for="unit in traceData.units || []" :key="unit.traceCode" class="trace-row"><text>单品码：{{ unit.traceCode }}</text><text>批次：{{ unit.batchNo }}</text></view>
          <view v-for="(node, index) in traceData.nodes || []" :key="index" class="trace-row"><text>{{ node.title || node.stageName }}</text><text>{{ node.detail }}</text><text class="item-spec">{{ node.occurredAt || '未记录时间' }}</text></view>
        </template>
      </view>
      <view class="card info-card">
        <info-row label="订单编号" :value="order.orderNo" />
        <info-row label="创建时间" :value="order.createTime?.replace('T', ' ')" />
        <info-row label="支付方式" :value="order.payMethod || '-'" />
        <info-row label="支付时间" :value="order.payTime?.replace('T', ' ') || '-'" />
        <info-row label="物流公司" :value="order.logisticsCompany || '-'" />
        <info-row label="物流单号" :value="order.logisticsNo || '-'" />
        <info-row label="订单备注" :value="order.remark || '-'" />
      </view>

      <view class="card"><button class="btn" @tap="openLogistics">查看物流轨迹</button></view>
      <view class="card amount-card">
        <view><text>商品金额</text><text>{{ money(order.totalAmount) }}</text></view>
        <view><text>运费</text><text>{{ money(order.freightAmount) }}</text></view>
        <view><text>优惠</text><text class="discount">-{{ money(order.discountAmount) }}</text></view>
        <view class="total"><text>实付金额</text><text class="price">{{ money(order.payAmount) }}</text></view>
      </view>

      <view v-if="activeAfterSale" class="card after-card" @tap="goAfterSales">
        <view>
          <text class="card-title">售后进度</text>
          <text class="item-spec">{{ afterSaleTypeLabel(activeAfterSale.type) }} · {{ money(activeAfterSale.amount) }}</text>
        </view>
        <text class="tag" :class="`tag-${statusMeta(activeAfterSale.status, activeAfterSale.returnShippedAt).tone}`">{{ statusMeta(activeAfterSale.status, activeAfterSale.returnShippedAt).label }} ›</text>
      </view>

      <view v-if="hasActions" class="action-spacer" />
      <view v-if="hasActions" class="fixed-bottom detail-actions">
        <button v-if="order.status === 'PENDING_PAY'" class="btn action-button" @tap="cancel">取消订单</button>
        <button v-if="canApplyAfterSale" class="btn action-button" @tap="applyAfterSale">申请售后</button>
        <button v-if="order.status === 'PENDING_PAY'" class="btn btn-primary action-button main" @tap="pay">立即支付</button>
        <button v-if="isReceivable" class="btn btn-primary action-button main" @tap="receive">确认收货</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { mallApi, type Address, type AfterSale, type Order, type TraceView } from '../../api'
import { AFTER_SALE_ALLOWED, afterSaleTypeLabel, money, statusMeta, toast } from '../../utils'

import InfoRow from '../../components/InfoRow.vue'

const order = ref<Order | null>(null)
const loading = ref(true)
const afterSales = ref<AfterSale[]>([])
let orderId = ''

const STATUS_DESC: Record<string, string> = {
  PENDING_PAY: '请尽快完成支付，超时未付款订单将自动取消',
  PENDING_SHIP: '商家正在备货，发货后可在此查看物流',
  SHIPPED: '商品已发出，收到后请确认收货',
  PENDING_RECEIVE: '商品已发出，收到后请确认收货',
  COMPLETED: '订单已完成，商品有问题可申请售后',
  CANCELLED: '订单已取消',
  REFUNDING: '退款处理中，请留意售后进度',
  REFUNDED: '退款已完成',
}
const statusDesc = computed(() => STATUS_DESC[order.value?.status || ''] || '订单已进入平台履约流程，关键节点全程留痕')
const isReceivable = computed(() => ['SHIPPED', 'PENDING_RECEIVE'].includes(order.value?.status || ''))
const activeAfterSale = computed(() => afterSales.value.find((item) => ['PENDING', 'RETURNING'].includes(item.status)) || afterSales.value[0] || null)
const canApplyAfterSale = computed(() => !!order.value
  && AFTER_SALE_ALLOWED.includes(order.value.status)
  && !afterSales.value.some((item) => ['PENDING', 'RETURNING'].includes(item.status)))
const hasActions = computed(() => order.value?.status === 'PENDING_PAY' || isReceivable.value || canApplyAfterSale.value)
const traceOpened = ref(false)
const traceLoading = ref(false)
const traceError = ref('')
const traceData = ref<TraceView | null>(null)
let traceRequest = 0
async function showTrace(itemId: string | number) {
  if (!order.value) return
  const requestId = ++traceRequest
  traceOpened.value = true; traceLoading.value = true; traceError.value = ''; traceData.value = null
  try { const result = await mallApi.getOrderTrace(order.value.id, itemId); if (requestId === traceRequest) traceData.value = result }
  catch (e) { if (requestId === traceRequest) traceError.value = (e as Error).message || '溯源查询失败' }
  finally { if (requestId === traceRequest) traceLoading.value = false }
}

onLoad((options) => { orderId = String(options?.id || '') })
// 从售后申请页返回时需要刷新售后状态
onShow(() => { if (orderId) load(orderId) })

async function load(id: string | number) {
  if (!order.value) loading.value = true
  try {
    const [detail, records] = await Promise.all([
      mallApi.getOrder(id),
      mallApi.getAfterSales().catch(() => [] as AfterSale[]),
    ])
    order.value = detail
    afterSales.value = records.filter((item) => String(item.orderId) === String(detail.id))
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({ title, content, success: (result) => resolve(!!result.confirm), fail: () => resolve(false) })
  })
}

async function runAction(action: () => Promise<{ success: boolean; message?: string }>, done: string) {
  if (!order.value) return
  try {
    const result = await action()
    if (!result.success) throw new Error(result.message || '操作失败')
    toast(done, 'success')
    load(order.value.id)
  } catch (error) {
    toast((error as Error).message)
  }
}

async function cancel() {
  if (!order.value || !await confirmAction('取消订单', '取消后订单不可恢复，确定取消吗？')) return
  const id = order.value.id
  await runAction(() => mallApi.cancelOrder(id), '订单已取消')
}

function applyAfterSale() {
  if (!order.value) return
  uni.navigateTo({ url: `/pages/aftersale/apply?orderId=${order.value.id}` })
}

function goAfterSales() {
  uni.navigateTo({ url: '/pages/aftersale/index' })
}

function openReview(item: {id: number;productId: number}) { if(order.value) uni.navigateTo({url: `/pages/reviews/write?orderId=${order.value.id}&productId=${item.productId}&orderItemId=${item.id}`}) }
function openLogistics() { if(order.value) uni.navigateTo({url: '/pages/logistics/index?id='+order.value.id}) }
function fullAddress(address: Address) {
  return `${address.province}${address.city}${address.district}${address.address}`
}

function pay() { if(order.value) uni.navigateTo({url: '/pages/pay/index?id='+order.value.id}) }

async function receive() {
  if (!order.value || !await confirmAction('确认收货', '请确认已收到商品，确认后订单将完成。')) return
  const id = order.value.id
  await runAction(() => mallApi.receiveOrder(id), '已确认收货')
}
</script>

<style scoped lang="scss">
.trace-row { display: flex; flex-direction: column; gap: 10rpx; padding: 22rpx 0; border-bottom: 1px solid #e7eee9; }
.trace-error { display: block; color: #b42318; padding: 18rpx 0; }

.detail-page {
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.loading {
  padding: 120rpx 0;
  color: #666666;
  text-align: center;
}

.status-hero {
  margin: 22rpx;
  padding: 30rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 88% 0, rgba(159, 231, 184, 0.16), transparent 44%),
    linear-gradient(135deg, #073821, #12764a);
  color: #fff;
}

.status-kicker,
.status-title,
.status-desc {
  display: block;
}

.status-kicker {
  color: #9fe7b8;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.status-title {
  margin-top: 9rpx;
  font-size: 38rpx;
  font-weight: 800;
}

.status-desc {
  margin-top: 9rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 24rpx;
}

.address-card {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.address-icon {
  display: grid;
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 52rpx;
  place-items: center;
  border-radius: 14rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 24rpx;
  font-weight: 800;
}

.address-name,
.address-detail {
  display: block;
}

.address-name {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.address-detail {
  margin-top: 8rpx;
  color: #666666;
  font-size: 24rpx;
  line-height: 1.55;
}

.item-row {
  display: flex;
  gap: 15rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.item-row:first-of-type {
  border-top: 0;
}

.item-image,
.item-placeholder {
  width: 116rpx;
  height: 116rpx;
  flex: 0 0 116rpx;
  border-radius: 14rpx;
}

.item-image {
  background: #eef7f1;
}

.item-placeholder {
  display: grid;
  place-items: center;
  background: #edf7f1;
  color: rgba(18, 118, 74, 0.18);
  font-size: 40rpx;
  font-weight: 800;
}

.item-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.item-name {
  font-size: 24rpx;
  font-weight: 700;
}

.item-spec {
  margin-top: 6rpx;
  color: #666666;
  font-size: 24rpx;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
}

.price {
  font-size: 28rpx;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 17rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.info-row:first-child {
  border-top: 0;
}

.info-label {
  color: #666666;
  font-size: 24rpx;
}

.info-value {
  max-width: 72%;
  color: #33453b;
  font-size: 24rpx;
  text-align: right;
}

.amount-card view {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  color: #52665a;
  font-size: 24rpx;
}

.amount-card view.total {
  margin-top: 5rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf2ee;
  color: #0b1a12;
  font-weight: 700;
}

.amount-card .price {
  font-size: 30rpx;
}

.discount {
  color: #12764a;
}

.detail-actions {
  justify-content: flex-end;
  padding-top: 14rpx;
}

.action-spacer {
  height: calc(130rpx + env(safe-area-inset-bottom));
}

.action-button {
  min-width: 180rpx;
  min-height: 76rpx;
  border-radius: 38rpx;
  font-size: 26rpx;
}

.action-button.main {
  min-width: 220rpx;
}

.trace-button {
  align-self: flex-start;
  margin-top: 8rpx;
}

.after-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.after-card .card-title,
.after-card .item-spec {
  display: block;
}
</style>
