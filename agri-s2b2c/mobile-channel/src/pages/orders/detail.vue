<template>
  <view class="page detail-page">
    <view v-if="loading" class="loading">正在加载订单…</view>
    <view v-else-if="!detail" class="empty"><view class="empty-icon">!</view><text>{{ loadError || '订单不存在' }}</text><button v-if="loadError" class="btn" @tap="load">重新加载</button></view>
    <template v-else>
      <view class="hero status-hero">
        <text class="hero-kicker">ORDER · {{ detail.order.orderNo }}</text>
        <text class="hero-title">{{ orderStatus(detail.order.status).label }}</text>
        <text class="hero-desc">下单 {{ formatTime(detail.order.createTime) }}<text v-if="detail.order.payTime"> · 支付 {{ formatTime(detail.order.payTime) }}</text></text>
      </view>

      <!-- 发货 -->
      <view v-if="showShipCard" class="card ship-card">
        <view class="card-head"><text class="card-title">发货</text><text v-if="shipment?.status" class="tag" :class="`tag-${shipTone}`">{{ shipLabel }}</text></view>

        <template v-if="pendingFromSupplier">
          <text class="ship-line">供应商提交了发货信息：{{ shipment?.logisticsCompany }} {{ shipment?.logisticsNo }}</text>
          <view class="ship-actions">
            <button class="btn btn-sm" :disabled="busy" @tap="rejectShip">驳回</button>
            <button class="btn btn-sm btn-primary" :disabled="busy" @tap="confirmShip">确认发货</button>
          </view>
        </template>
        <template v-else-if="pendingFromMe">
          <text class="ship-line">已提交：{{ shipment?.logisticsCompany }} {{ shipment?.logisticsNo }}，等待供应商确认</text>
          <view class="ship-actions"><button class="btn btn-sm" :disabled="busy" @tap="withdrawShip">撤回</button></view>
        </template>
        <template v-else-if="detail.order.status === 'PENDING_SHIP'">
          <text v-if="shipment?.status === 'REJECTED'" class="ship-line warn">上次发货被驳回：{{ shipment?.reason || '未填写原因' }}</text>
          <view class="form-item"><text class="form-label">物流公司</text><input v-model="shipForm.company" class="input" placeholder="如 顺丰速运；不填按「云仓/直发」" /></view>
          <view class="form-item"><text class="form-label">物流单号</text><input v-model="shipForm.logisticsNo" class="input" placeholder="请输入或扫码" /></view>
          <view class="ship-actions">
            <button class="btn btn-sm btn-ghost" @tap="scanLogistics">扫码</button>
            <button class="btn btn-sm btn-primary" :loading="busy" :disabled="busy" @tap="proposeShip">提交发货</button>
          </view>
        </template>
        <template v-else>
          <text class="ship-line">{{ detail.order.logisticsCompany || '云仓/直发' }} {{ detail.order.logisticsNo || '' }}</text>
        </template>
      </view>

      <view v-if="detail.address" class="card">
        <view class="card-head"><text class="card-title">收货信息</text></view>
        <text class="line-strong">{{ detail.address.name }} {{ detail.address.phone }}</text>
        <text class="line">{{ detail.address.region }}{{ detail.address.detail }}</text>
      </view>

      <view class="card">
        <view class="card-head"><text class="card-title">商品</text><text class="card-sub">{{ detail.items.length }} 件</text></view>
        <view v-for="item in detail.items" :key="item.id" class="goods-row">
          <image v-if="item.image" class="goods-image" :src="item.image" mode="aspectFill" />
          <view v-else class="goods-image goods-placeholder">丰</view>
          <view class="goods-copy"><text class="line-strong">{{ item.name }}</text><text class="line">{{ item.spec }} × {{ item.quantity }}</text></view>
          <text class="goods-price">{{ money(item.totalAmount ?? item.price * item.quantity) }}</text>
        </view>
        <view class="amount-row"><text>运费</text><text>{{ money(detail.order.freightAmount) }}</text></view>
        <view class="amount-row"><text>优惠</text><text>-{{ money(detail.order.discountAmount) }}</text></view>
        <view class="amount-row total"><text>实付</text><text class="price">{{ money(detail.order.payAmount) }}</text></view>
      </view>

      <view v-if="detail.buyer" class="card">
        <view class="card-head"><text class="card-title">买家</text><text class="card-sub">{{ memberLevelLabel(detail.buyer.memberLevel, '会员') }}</text></view>
        <text class="line-strong">{{ detail.buyer.nickname || '丰链云会员' }} {{ detail.buyer.phone }}</text>
        <text class="line">在本店下单 {{ detail.buyer.orderCount || 0 }} 次 · 累计 {{ money(detail.buyer.totalAmount) }}</text>
      </view>

      <view v-if="detail.commissions.length" class="card">
        <view class="card-head"><text class="card-title">本单佣金</text></view>
        <view v-for="c in detail.commissions" :key="c.id" class="amount-row">
          <text>佣金比例 {{ c.rate }}% · {{ commissionStatus(c.status).label }}</text><text class="price">{{ money(c.amount) }}</text>
        </view>
      </view>

      <view v-if="detail.afterSales.length" class="card" @tap="goAfterSales">
        <view class="card-head"><text class="card-title">售后</text><text class="card-sub">去处理 ›</text></view>
        <view v-for="a in detail.afterSales" :key="a.id" class="amount-row">
          <text>{{ afterSaleTypeLabel(a.type) }} · {{ afterSaleStatus(a.status, a.returnShippedAt).label }}</text><text>{{ money(a.amount) }}</text>
        </view>
      </view>

      <view v-if="detail.order.remark" class="card"><view class="card-head"><text class="card-title">买家备注</text></view><text class="line">{{ detail.order.remark }}</text></view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { channelApi, type OrderDetail, type Shipment } from '../../api'
import { requireChannelLogin } from '../../session'
import { afterSaleStatus, afterSaleTypeLabel, commissionStatus, confirmAction, formatTime, memberLevelLabel, money, orderStatus, promptText, toast } from '../../utils'

const detail = ref<OrderDetail | null>(null)
const shipment = ref<Shipment | null>(null)
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const shipForm = reactive({ company: '', logisticsNo: '' })
let orderId = ''

const pendingFromSupplier = computed(() => detail.value?.order.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value.proposerType === 'SUPPLIER')
const pendingFromMe = computed(() => detail.value?.order.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value.proposerType === 'CHANNEL')
const showShipCard = computed(() => !!detail.value && (
  detail.value.order.status === 'PENDING_SHIP' || pendingFromSupplier.value || pendingFromMe.value || !!detail.value.order.logisticsNo))
const shipLabel = computed(() => ({ PROPOSED: '待确认', CONFIRMED: '已确认', REJECTED: '已驳回', CANCELLED: '已撤回', WITHDRAWN: '已撤回' } as Record<string, string>)[String(shipment.value?.status)] || String(shipment.value?.status || ''))
const shipTone = computed(() => ({ PROPOSED: 'orange', CONFIRMED: 'green', REJECTED: 'red' } as Record<string, string>)[String(shipment.value?.status)] || 'gray')

onLoad((options) => {
  orderId = String(options?.id || '')
})
onShow(load)

async function load() {
  if (!requireChannelLogin()) return
  if (!orderId) {
    loading.value = false
    loadError.value = '缺少订单编号'
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const [data, latest] = await Promise.all([
      channelApi.getOrder(orderId),
      channelApi.getShipment(orderId),
    ])
    detail.value = data
    shipment.value = latest
  } catch (error) {
    detail.value = null
    shipment.value = null
    loadError.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

async function run(action: () => Promise<{ success: boolean; message?: string }>) {
  if (busy.value || loading.value || !detail.value || detail.value.order.status !== 'PENDING_SHIP') return
  busy.value = true
  try {
    const result = await action()
    if (!result.success) throw new Error(result.message || '操作失败')
    toast(result.message || '已提交', 'success')
    await load()
  } catch (error) {
    toast((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function proposeShip() {
  const no = shipForm.logisticsNo.trim()
  if (!no) return toast('请填写物流单号')
  if (!await confirmAction('提交发货', `${shipForm.company.trim() || '云仓/直发'} ${no}`)) return
  await run(() => channelApi.proposeShipment(orderId, no, shipForm.company.trim() || undefined))
}

async function confirmShip() {
  if (!await confirmAction('确认发货', '确认后订单变为已发货，买家可查看物流。')) return
  await run(() => channelApi.confirmShipment(orderId))
}

async function rejectShip() {
  const reason = await promptText('驳回发货信息', '请填写驳回原因')
  if (reason === null) return
  if (!reason) return toast('请填写驳回原因')
  await run(() => channelApi.rejectShipment(orderId, reason))
}

async function withdrawShip() {
  if (!await confirmAction('撤回发货信息', '撤回后可以重新填写物流。')) return
  await run(() => channelApi.withdrawShipment(orderId))
}

function scanLogistics() {
  uni.scanCode({
    success(result) { shipForm.logisticsNo = String(result.result || '').trim() },
    fail() { toast('扫码未完成，可手动输入') },
  })
}

function goAfterSales() {
  uni.setStorageSync('channel_orders_intent', 'after')
  uni.switchTab({ url: '/pages/orders/index' })
}
</script>

<style scoped lang="scss">
.detail-page { padding-bottom: 32rpx; }
.loading { padding: 90rpx 0; color: #666666; text-align: center; }
.status-hero { margin: 18rpx 22rpx 0; }
.ship-card { border-color: #cfe6d8; }
.ship-line { display: block; color: #33453b; font-size: 26rpx; line-height: 1.6; }
.ship-line.warn { margin-bottom: 14rpx; color: #b71c1c; }
.ship-actions { display: flex; justify-content: flex-end; gap: 12rpx; margin-top: 16rpx; }
.ship-actions .btn { min-width: 150rpx; min-height: 68rpx; }
.line-strong, .line { display: block; }
.line-strong { color: #0b1a12; font-size: 28rpx; font-weight: 650; }
.line { margin-top: 6rpx; color: #666666; font-size: 24rpx; line-height: 1.6; }
.goods-row { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; }
.goods-image { width: 100rpx; height: 100rpx; flex: 0 0 100rpx; border-radius: 14rpx; background: #eef7f1; }
.goods-placeholder { display: grid; place-items: center; color: rgba(18,118,74,.25); font-size: 36rpx; font-weight: 800; }
.goods-copy { min-width: 0; flex: 1; }
.goods-price { color: #33453b; font-size: 26rpx; }
.amount-row { display: flex; justify-content: space-between; gap: 12rpx; padding: 10rpx 0; color: #666666; font-size: 26rpx; }
.amount-row.total { margin-top: 6rpx; padding-top: 16rpx; border-top: 1rpx solid #edf2ee; color: #0b1a12; font-weight: 700; }
.ship-actions { flex-wrap:wrap; }.ship-actions .btn { flex:1; }.goods-row { flex-wrap:wrap; }.goods-price { margin-left:auto; }.hero-kicker { display:block !important;font-size:24rpx;overflow-wrap:anywhere; }.amount-row { flex-wrap:wrap; }
</style>
