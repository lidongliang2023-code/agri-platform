<template>
  <view class="page growth-page">
    <view class="hero"><text class="hero-kicker">GROWTH & SERVICE</text><text class="hero-title">营销与售后</text><text class="hero-desc">平台活动、社群素材和客户售后协同</text></view>
    <view class="metric-grid">
      <view class="metric-card"><view class="metric-icon">惠</view><text class="metric-value">{{ growth.marketing?.coupons?.length || 0 }}</text><text class="metric-label">可领优惠券</text></view>
      <view class="metric-card"><view class="metric-icon">佣</view><text class="metric-value">{{ growth.commissions?.length || 0 }}</text><text class="metric-label">佣金记录</text></view>
      <view class="metric-card"><view class="metric-icon">售</view><text class="metric-value">{{ pendingAfterSales }}</text><text class="metric-label">待处理售后</text></view>
      <view class="metric-card"><view class="metric-icon">营</view><text class="metric-value">{{ growth.marketing?.flashSales?.length || 0 }}</text><text class="metric-label">营销活动</text></view>
    </view>

    <view class="section-head"><view><text class="kicker">PLATFORM CAMPAIGNS</text><text class="title">平台活动</text></view></view>
    <view class="card">
      <view v-for="item in growth.marketing?.flashSales || []" :key="`f${item.id}`" class="activity-row"><view class="activity-icon">秒</view><view class="activity-copy"><text>{{ item.productName }}</text><small class="small-copy">秒杀价 {{ money(item.salePrice) }}</small></view><text class="tag tag-orange">秒杀</text></view>
      <view v-for="item in growth.marketing?.groupBuys || []" :key="`g${item.id}`" class="activity-row"><view class="activity-icon">团</view><view class="activity-copy"><text>{{ item.name }}</text><small class="small-copy">{{ item.groupSize }} 人团 {{ money(item.groupPrice) }}</small></view><text class="tag tag-green">拼团</text></view>
      <view class="share-box"><textarea v-model="shareText" class="textarea" readonly /><button class="btn btn-sm btn-primary copy-button" @tap="copyShare">复制推广文案</button></view>
    </view>

    <view class="section-head"><view><text class="kicker">AFTER SALES</text><text class="title">渠道售后协同</text></view><text class="sub">{{ pendingAfterSales }} 条待处理</text></view>
    <view class="card">
      <view v-for="item in growth.afterSales || []" :key="item.id" class="after-row"><view><text>{{ item.type === 'REFUND' ? '退款' : item.type }} · 订单 {{ item.orderId }}</text><small class="small-copy">{{ item.reason }}</small></view><b>{{ money(item.amount) }}</b><text class="tag" :class="`tag-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</text></view>
      <view v-if="!(growth.afterSales || []).length" class="empty-mini">暂无售后工单</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { channelApi, type GrowthData } from '../../api'
import { channelSession, requireChannelLogin } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const growth = ref<Partial<GrowthData>>({})
const shareText = ref('丰链云产地直发，五常大米当季限量秒杀，邻里拼团更优惠，点击进入我的小店查看。')
const pendingAfterSales = computed(() => (growth.value.afterSales || []).filter((item) => item.status === 'PENDING').length)

onShow(load)

async function load() {
  if (!requireChannelLogin()) return
  try {
    growth.value = await channelApi.getGrowth(channelSession.account?.id || 1)
  } catch (error) {
    toast((error as Error).message)
  }
}

function copyShare() {
  uni.setClipboardData({
    data: shareText.value,
    success() { toast('推广文案已复制', 'success') },
  })
}
</script>

<style scoped lang="scss">
.growth-page{padding-bottom:28rpx}.activity-row{display:flex;align-items:center;gap:13rpx;padding:14rpx 0;border-top:1rpx solid #edf2ee}.activity-row:first-child{border-top:0}.activity-icon{display:grid;width:50rpx;height:50rpx;flex:0 0 50rpx;place-items:center;border-radius:14rpx;background:#eaf7ef;color:#12764a;font-size:24rpx;font-weight:800}.activity-copy{min-width:0;flex:1}.activity-copy text,.activity-copy .small-copy{display:block}.activity-copy text{color:#0b1a12;font-size:24rpx;font-weight:650}.activity-copy .small-copy{margin-top:5rpx;color:#93a29a;font-size:24rpx}.share-box{margin-top:14rpx;padding-top:14rpx;border-top:1rpx solid #edf2ee}.copy-button{margin:10rpx 0 0 auto}.after-row{display:flex;align-items:center;gap:10rpx;padding:15rpx 0;border-top:1rpx solid #edf2ee}.after-row:first-child{border-top:0}.after-row>view{min-width:0;flex:1}.after-row>view text,.after-row>view .small-copy{display:block}.after-row>view text{color:#0b1a12;font-size:24rpx;font-weight:650}.after-row>view .small-copy{margin-top:5rpx;color:#84938a;font-size:24rpx}.after-row>b{color:#d45b32;font-size:24rpx}.empty-mini{padding:44rpx 0;color:#94a198;text-align:center;font-size:24rpx}
</style>
