<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { serviceApi, type Provider } from '../../api'

const provider = ref<Provider | null>(null)
const providerId = ref(0)
const favorited = ref(false)
const busy = ref(false)

onLoad((options) => {
  providerId.value = Number(options?.id || 0)
  load()
})

async function load() {
  try {
    provider.value = await serviceApi.provider(providerId.value)
    const list = await serviceApi.favorites().catch(() => [])
    favorited.value = (list ?? []).some((item) => Number(item.id) === providerId.value)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
}

async function toggleFavorite() {
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
  uni.navigateTo({ url: `/pages/booking/index?providerId=${providerId.value}&serviceName=${encodeURIComponent(item?.name || provider.value?.name || '')}` })
}

function explainContact() {
  // 服务商号码不在公开档案里下发；原先这里硬编码了一个演示手机号，谁点都打给同一个人
  uni.showModal({
    title: '如何联系服务商',
    content: '未下单前平台不公开双方号码。提交预约并支付定金后，服务商会在你填写的联系号码上收到工单，也可在订单详情里通过平台消息沟通。',
    showCancel: false,
  })
}
</script>

<template>
  <view class="page provider-page">
    <view v-if="!provider" class="loading">正在加载服务商资料…</view>
    <template v-else>
      <view class="detail-hero"><view class="provider-big-icon">{{ provider.categoryIcon }}</view><view><text class="verified">✓ 平台认证 · {{ provider.badge }}</text><text class="provider-title">{{ provider.name }}</text><text class="muted">{{ provider.description }}</text><text class="rating">★ {{ provider.rating }} · 已服务 {{ provider.orderCount }} 单</text></view></view>
      <view class="card">
        <view class="field"><text class="field-label">服务区域</text><text class="field-value">{{ provider.region }}</text></view>
        <view class="field"><text class="field-label">响应时效</text><text class="field-value">平均 {{ provider.responseMinutes }} 分钟</text></view>
        <view class="field"><text class="field-label">最早可约</text><text class="field-value">{{ provider.availableSlots[0] }}</text></view>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">服务项目</text><text class="card-sub">明码标价</text></view>
        <view class="service-item" v-for="item in provider.items" :key="item.id">
          <view class="item-copy"><text class="strong">{{ item.name }}</text><text class="muted">{{ item.description }}</text><text class="tiny">{{ item.duration }}</text></view>
          <text class="item-price">¥{{ item.price }}<text>{{ item.unit }}</text></text>
          <button class="btn btn-sm btn-ghost" @click="book(item.name)">预约</button>
        </view>
      </view>
      <view class="card"><view class="card-head"><text class="card-title">服务保障</text></view><view class="trust-grid"><text v-for="cert in provider.certifications" :key="cert">✓ {{ cert }}</text><text>✓ 平台担保交易</text><text>✓ 作业过程留痕</text></view></view>
      <view class="card" v-if="provider.reviews?.length"><view class="card-head"><text class="card-title">服务评价</text><text class="card-sub">{{ provider.rating }} 分</text></view><view class="review" v-for="review in provider.reviews" :key="review.appointmentDate"><view class="between"><text class="strong">真实评价</text><text class="gold">{{ '★'.repeat(review.rating) }}</text></view><text class="muted">{{ review.review }}</text><text class="tiny">{{ review.serviceName }} · {{ review.appointmentDate }}</text></view></view>
      <view class="contact-tip">未下单前平台不公开双方号码，<text @click="explainContact">怎么联系服务商？</text></view>
      <view class="bottom-actions safe-bottom">
        <button class="btn" :loading="busy" @click="toggleFavorite">{{ favorited ? '★ 已收藏' : '☆ 收藏' }}</button>
        <button class="btn btn-primary" @click="book()">立即预约</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.provider-page { padding: 24rpx 24rpx 150rpx; }
.detail-hero { display: flex; align-items: flex-start; gap: 20rpx; margin-bottom: 20rpx; padding: 28rpx; border: 1rpx solid #d8e8de; border-radius: 26rpx; background: linear-gradient(140deg, #fff, #edf8f2); }
.provider-big-icon { display: flex; width: 112rpx; height: 112rpx; flex: 0 0 112rpx; align-items: center; justify-content: center; border-radius: 27rpx; background: linear-gradient(135deg, #12764a, #159a5e); color: #fff; font-size: 56rpx; }
.detail-hero > view:last-child { display: flex; min-width: 0; flex-direction: column; gap: 7rpx; }
.verified { color: #12764a; font-size: 20rpx; }
.provider-title { font-size: 35rpx; font-weight: 750; }
.rating { color: #d88b1f; font-size: 21rpx; }
.service-item { display: flex; align-items: center; gap: 14rpx; padding: 20rpx 0; border-bottom: 1rpx solid #edf2ee; }
.service-item:last-child { border-bottom: 0; }
.item-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.item-copy .strong { font-size: 25rpx; }
.item-copy .muted { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.item-price { color: #0e5233; font-size: 28rpx; font-weight: 700; }
.item-price text { color: #94a198; font-size: 17rpx; font-weight: 400; }
.trust-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; }
.trust-grid text { padding: 14rpx; border-radius: 12rpx; background: #f2fbf5; color: #0e5233; font-size: 19rpx; }
.review { display: flex; flex-direction: column; gap: 5rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf2ee; }
.gold { color: #d88b1f; }
.bottom-actions { position: fixed; right: 0; bottom: 0; left: 0; z-index: 10; display: grid; grid-template-columns: 180rpx 1fr; gap: 14rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e1e9e3; background: rgba(255,255,255,.97); }
.contact-tip { margin: 20rpx 0 40rpx; color: #7b8a80; font-size: 20rpx; text-align: center; }
.contact-tip text { color: #12764a; }
</style>
