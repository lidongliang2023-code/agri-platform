<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { serviceApi, type Provider } from '../../api'

const provider = ref<Provider | null>(null)
const providerId = ref('')
const favorited = ref(false)
const busy = ref(false)
const loadError = ref('')

onLoad((options) => {
  providerId.value = String(options?.id || '')
  if (!/^\d+$/.test(providerId.value)) { loadError.value = '缺少服务商编号，请从服务列表进入'; return }
  load()
})

async function load() {
  loadError.value = ''
  try {
    provider.value = await serviceApi.provider(providerId.value)
    const list = await serviceApi.favorites().catch(() => [])
    favorited.value = (list ?? []).some((item) => String(item.id) === providerId.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载失败'
  }
}

async function toggleFavorite() {
  if (busy.value) return
  busy.value = true
  try {
    const result = await serviceApi.toggleFavorite(providerId.value)
    favorited.value = Boolean(result.favorited)
    uni.showToast({ title: favorited.value ? '已收藏' : '已取消收藏', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function book(serviceName = '') {
  const item = provider.value?.items?.find((entry) => entry.name === serviceName) || provider.value?.items?.[0]
  if (!item || provider.value?.status !== 'available') return uni.showToast({ title: '暂无可预约项目', icon: 'none' })
  uni.navigateTo({ url: `/pages/booking/index?providerId=${providerId.value}&serviceItemId=${item.id}` })
}

function explainContact() {
  // 服务商号码不在公开档案里下发；原先这里硬编码了一个演示手机号，谁点都打给同一个人
  uni.showModal({
    title: '如何联系服务商',
    content: '确认预约后，服务商可在接单台查看您填写的联系方式。若需平台协助，请在订单详情提交反馈。',
    showCancel: false,
  })
}
</script>

<template>
  <view class="page provider-page">
    <view v-if="loadError" class="empty"><text>{{ loadError }}</text><button class="btn" @click="load">重新加载</button></view>
    <view v-else-if="!provider" class="loading">正在加载服务商资料…</view>
    <template v-else>
      <view class="detail-hero"><view class="provider-big-icon">{{ provider.categoryIcon }}</view><view><text class="verified">✓ 平台认证 · {{ provider.badge }}</text><text class="provider-title">{{ provider.name }}</text><text class="muted">{{ provider.description }}</text><text class="rating">★ {{ provider.rating }} · 已服务 {{ provider.orderCount }} 单</text></view></view>
      <view class="card">
        <view class="field"><text class="field-label">服务区域</text><text class="field-value">{{ provider.region }}</text></view>
        <view class="field"><text class="field-label">响应时效</text><text class="field-value">平均 {{ provider.responseMinutes }} 分钟</text></view>
        <view class="field"><text class="field-label">公布时段</text><text class="field-value">{{ provider.availableSlots[0] }}</text></view>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">服务项目</text><text class="card-sub">明码标价</text></view>
        <view class="service-item" v-for="item in provider.items" :key="item.id">
          <view class="item-copy"><text class="strong">{{ item.name }}</text><text class="muted">{{ item.description }}</text><text class="tiny">{{ item.duration }}</text></view>
          <text class="item-price">¥{{ item.price }}<text>{{ item.unit }}</text></text>
          <button class="btn btn-sm btn-ghost" @click="book(item.name)">预约</button>
        </view>
      </view>
      <view class="card"><view class="card-head"><text class="card-title">服务保障</text></view><view class="trust-grid"><text v-for="cert in provider.certifications" :key="cert">✓ {{ cert }}</text><text>✓ 平台反馈受理</text><text>✓ 作业过程留痕</text></view></view>
      <view class="card" v-if="provider.reviews?.length"><view class="card-head"><text class="card-title">服务评价</text><text class="card-sub">{{ provider.rating }} 分</text></view><view class="review" v-for="review in provider.reviews" :key="review.appointmentDate"><view class="between"><text class="strong">真实评价</text><text class="gold">{{ '★'.repeat(review.rating) }}</text></view><text class="muted">{{ review.review }}</text><text class="tiny">{{ review.serviceName }} · {{ review.appointmentDate }}</text></view></view>
      <view class="contact-tip">未下单前平台不公开双方号码，<text @click="explainContact">怎么联系服务商？</text></view>
      <view class="bottom-actions safe-bottom">
        <button class="btn" :loading="busy" @click="toggleFavorite">{{ favorited ? '★ 已收藏' : '☆ 收藏' }}</button>
        <button class="btn btn-primary" :disabled="!provider.items?.length || provider.status !== 'available'" @click="book()">立即预约</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.provider-page { padding: 24rpx 24rpx 150rpx; }
.detail-hero { display: flex; align-items: flex-start; gap: 20rpx; margin-bottom: 20rpx; padding: 28rpx; border: 1rpx solid #d8e8de; border-radius: 26rpx; background: linear-gradient(140deg, #fff, #edf8f2); }
.provider-big-icon { display: flex; width: 112rpx; height: 112rpx; flex: 0 0 112rpx; align-items: center; justify-content: center; border-radius: 27rpx; background: linear-gradient(135deg, #12764a, #159a5e); color: #fff; font-size: 56rpx; }
.detail-hero > view:last-child { display: flex; min-width: 0; flex-direction: column; gap: 7rpx; }
.verified { color: #12764a; font-size: 13px; }
.provider-title { font-size: 35rpx; font-weight: 750; }
.rating { color: #d88b1f; font-size: 13px; }
.service-item { display: flex; align-items: center; gap: 14rpx; padding: 20rpx 0; border-bottom: 1rpx solid #edf2ee; }
.service-item:last-child { border-bottom: 0; }
.item-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.item-copy .strong { font-size: 14px; }
.item-copy .muted { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.item-price { color: #0e5233; font-size: 15px; font-weight: 700; }
.item-price text { color: #52665a; font-size: 13px; font-weight: 400; }
.trust-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; }
.trust-grid text { padding: 14rpx; border-radius: 12rpx; background: #f2fbf5; color: #0e5233; font-size: 13px; }
.review { display: flex; flex-direction: column; gap: 5rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf2ee; }
.gold { color: #d88b1f; }
.bottom-actions { position: fixed; right: 0; bottom: 0; left: 0; z-index: 10; display: grid; grid-template-columns: 180rpx 1fr; gap: 14rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e1e9e3; background: rgba(255,255,255,.97); }
.contact-tip { margin: 20rpx 0 40rpx; color: #52665a; font-size: 13px; text-align: center; }
.contact-tip text { color: #12764a; }

.provider-page { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
.item-price { max-width: 32%; overflow-wrap: anywhere; }
.service-item > .btn { flex-shrink: 0; }
.trust-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
.contact-tip text { display: inline-flex; min-height: 44px; align-items: center; }
.rating { color: #946014; }
@media (max-width: 360px) {
  .service-item { flex-wrap: wrap; }
  .item-copy { flex-basis: 100%; }
  .item-price { flex: 1; max-width: none; }
}


/* 收尾复验发现的布局与详情控件修正。 */
.contact-tip text { min-width:48px; min-height:48px; }
</style>
