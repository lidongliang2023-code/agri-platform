<script setup lang="ts">
import { computed, ref } from 'vue'
import { confirmAction } from '../../utils'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { serviceApi, statusMeta, type Order } from '../../api'

const order = ref<Order | null>(null)
const orderId = ref('')
const busy = ref(false)
const loadError = ref('')
const rating = ref(5)
const reviewText = ref('')

/** 进度说明只取服务商真实上报的事件，不再印一段编造的 CV 质检数字。 */
const latestReport = computed(() => {
  const events = order.value?.timeline ?? []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].title === '服务商上报进度') {
      return `${events[index].eventTime} · ${events[index].note}`
    }
  }
  return ''
})

onLoad((options) => {
  orderId.value = String(options?.id || '')
})
onShow(load)

async function load() {
  if (!orderId.value) return
  loadError.value = ''
  try {
    order.value = await serviceApi.order(orderId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载失败'
  }
}

async function change(status: string) {
  if (!order.value || busy.value) return
  busy.value = true
  try {
    if (!await confirmAction(status === 'cancelled' ? '取消订单' : status === 'completed' ? '确认验收' : '确认预约',
      status === 'cancelled' ? '取消后不能继续履约，是否取消？' : status === 'completed' ? '请核实作业完成情况，验收后可提交评价。' : '确认预约信息后等待服务商安排作业，此操作不扣款。')) return
    order.value = await serviceApi.updateOrder(order.value.id, status)
    uni.showToast({ title: status === 'cancelled' ? '订单已取消' : '状态已更新', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

async function submitReview() {
  if (!reviewText.value.trim()) return uni.showToast({ title: '请填写评价内容', icon: 'none' })
  if (!order.value || busy.value) return
  busy.value = true
  try {
    order.value = await serviceApi.reviewOrder(order.value.id, rating.value, reviewText.value)
    uni.showToast({ title: '评价已提交', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '评价失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function contactProvider() {
  if (order.value) uni.navigateTo({ url: `/pages/feedback/index?orderNo=${encodeURIComponent(order.value.orderNo)}` })
}
</script>

<template>
  <view class="page detail-page safe-bottom">
    <view v-if="loadError" class="empty"><text>{{ loadError }}</text><button class="btn" @click="load">重新加载</button></view>
    <view v-else-if="!order" class="loading">正在加载订单…</view>
    <template v-else>
      <view class="status-hero"><text class="tag" :class="statusMeta(order.status).tone">{{ statusMeta(order.status).label }}</text><text class="status-title">{{ statusMeta(order.status).label }}</text><text class="muted">{{ order.status === 'in_progress' ? (order.progress >= 100 ? '服务商已上报完工，请核实后验收' : `服务商上报进度 ${order.progress}%`) : '平台将持续同步服务进度' }}</text><view class="progress"><view :style="{ width: `${order.progress}%` }" /></view></view>
      <view class="card">
        <view class="card-head"><text class="card-title">{{ order.serviceName }}</text><text class="tag" :class="statusMeta(order.status).tone">{{ statusMeta(order.status).label }}</text></view>
        <view class="provider-line"><view class="provider-avatar">{{ order.providerName.slice(0, 1) }}</view><view><text class="strong">{{ order.providerName }}</text><text class="tiny">平台认证服务商</text></view><button class="btn btn-sm btn-ghost" @click="contactProvider">反馈</button></view>
        <view class="info-grid"><view><text class="tiny">预约时间</text><text>{{ order.appointmentDate }} {{ order.appointmentSlot }}</text></view><view><text class="tiny">服务地点</text><text>{{ order.location }}</text></view><view><text class="tiny">服务数量</text><text>{{ order.quantity }} {{ order.unit }}</text></view><view><text class="tiny">订单金额</text><text class="price">¥{{ order.totalAmount }}</text></view></view>
      </view>
      <view class="card"><view class="card-head"><text class="card-title">履约动态</text><text class="tag green">实时</text></view><view class="timeline"><view v-for="event in order.timeline" :key="event.title + event.eventTime" :class="{ done: event.completed }"><view class="dot">{{ event.completed ? '✓' : '' }}</view><view><text class="strong">{{ event.title }}</text><text class="muted">{{ event.note }}</text><text class="tiny">{{ event.eventTime }}</text></view></view></view></view>
      <view v-if="order.status === 'in_progress'" class="quality">
        <view class="between"><text>服务商最新上报</text><text class="score">{{ order.progress }}<text>%</text></text></view>
        <text>{{ latestReport || '暂无上报，进度以服务商回传为准' }}</text>
      </view>
      <view v-if="order.status === 'completed' && !order.rating" class="card review-card"><text class="card-title">评价本次服务</text><view class="stars"><text v-for="star in 5" :key="star" :class="{ on: star <= rating }" @click="rating = star">★</text></view><textarea class="textarea" v-model="reviewText" placeholder="分享作业质量、服务时效与价格透明情况…" /><button class="btn btn-primary btn-block" :loading="busy" :disabled="busy" @click="submitReview">提交评价</button></view>
      <view v-if="order.rating" class="card"><text class="card-title">我的评价</text><text class="gold">{{ '★'.repeat(order.rating) }}</text><text class="muted">{{ order.review }}</text></view>
      <view class="bottom-actions">
        <button v-if="order.status === 'pending_payment'" class="btn btn-primary" :loading="busy" :disabled="busy" @click="change('confirmed')">确认预约（不扣款）</button>
        <button v-if="order.status === 'in_progress' && order.progress >= 100" class="btn btn-primary" :loading="busy" :disabled="busy" @click="change('completed')">验收确认</button>
        <button v-if="!['completed', 'cancelled'].includes(order.status)" class="btn btn-danger" :disabled="busy" @click="change('cancelled')">取消订单</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.detail-page { padding: 24rpx 24rpx 150rpx; }
.status-hero { display: flex; flex-direction: column; gap: 8rpx; margin-bottom: 20rpx; padding: 28rpx; border-radius: 24rpx; background: radial-gradient(circle at 90% 0, rgba(51,175,104,.14), transparent 320rpx), linear-gradient(140deg, #fff, #eef9f3); }
.status-title { margin-top: 5rpx; font-size: 42rpx; font-weight: 750; }
.provider-line { display: flex; align-items: center; gap: 14rpx; padding: 16rpx 0; border-bottom: 1rpx solid #edf2ee; }
.provider-avatar { display: flex; width: 66rpx; height: 66rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: #12764a; color: #fff; font-weight: 700; }
.provider-line > view:nth-child(2) { display: flex; flex: 1; flex-direction: column; gap: 4rpx; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22rpx; padding-top: 22rpx; }
.info-grid view { display: flex; flex-direction: column; gap: 5rpx; }
.info-grid text:last-child { color: #34473b; font-size: 13px; }
.price { color: #0e5233 !important; font-weight: 700; }
.timeline { display: flex; flex-direction: column; }
.timeline > view { display: flex; gap: 15rpx; padding-bottom: 24rpx; }
.timeline .dot { display: flex; width: 34rpx; height: 34rpx; flex: 0 0 34rpx; align-items: center; justify-content: center; border: 1rpx solid #dfe8e2; border-radius: 50%; color: #52665a; font-size: 13px; }
.timeline .done .dot { border-color: #159a5e; background: #159a5e; color: #fff; }
.timeline > view > view:last-child { display: flex; flex-direction: column; gap: 4rpx; }
.quality { margin-bottom: 20rpx; padding: 24rpx; border-radius: 22rpx; background: linear-gradient(135deg, #082d1c, #0d5638); color: rgba(255,255,255,.82); }
.quality .score { color: #8fe2b2; font-family: monospace; font-size: 42rpx; font-weight: 700; }
.quality .score text { font-size: 13px; }
.review-card { display: flex; flex-direction: column; gap: 16rpx; }
.stars { display: flex; gap: 10rpx; color: #d5ddd7; font-size: 44rpx; }
.stars text.on { color: #e09a2c; }
.gold { color: #d88b1f; }
.bottom-actions { position: fixed; right: 0; bottom: 0; left: 0; z-index: 10; display: flex; gap: 12rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e1e9e3; background: rgba(255,255,255,.97); }
.bottom-actions .btn { flex: 1; }

.detail-page { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
.info-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
.info-grid view, .provider-line > view:nth-child(2), .timeline > view > view:last-child { min-width: 0; }
.provider-avatar { flex-shrink: 0; }
.stars { gap: 0; flex-wrap: wrap; }
.stars text { display: inline-flex; width: 44px; height: 44px; align-items: center; justify-content: center; }
.bottom-actions { align-items: stretch; }
@media (max-width: 360px) { .info-grid { grid-template-columns: minmax(0,1fr); } }

</style>
