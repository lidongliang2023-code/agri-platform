<template>
  <view class="page marketing-page">
    <view class="hero"><text class="hero-kicker">MARKETING MATERIALS</text><text class="hero-title">营销素材</text><text class="hero-desc">平台活动由运营创建，商家负责分享和成交</text></view>

    <view class="metric-grid">
      <view class="metric-card"><view class="metric-icon">券</view><text class="metric-value">{{ marketing?.summary.coupons || 0 }}</text><text class="metric-label">可用优惠券</text></view>
      <view class="metric-card"><view class="metric-icon">秒</view><text class="metric-value">{{ marketing?.summary.flashes || 0 }}</text><text class="metric-label">限时秒杀</text></view>
      <view class="metric-card"><view class="metric-icon">团</view><text class="metric-value">{{ marketing?.summary.groups || 0 }}</text><text class="metric-label">社区拼团</text></view>
      <view class="metric-card"><view class="metric-icon">架</view><text class="metric-value">{{ marketing?.summary.shelfProducts || 0 }}</text><text class="metric-label">参与商品</text></view>
    </view>

    <view class="section-head"><view><text class="kicker">PLATFORM CAMPAIGNS</text><text class="title">平台活动</text></view></view>
    <view class="card">
      <view v-for="item in marketing?.flashes || []" :key="`f${item.id}`" class="activity-row"><view class="activity-icon orange">秒</view><view class="activity-copy"><text>{{ item.productName }}</text><text class="small-copy">秒杀价 {{ money(item.salePrice) }} · 剩余 {{ item.remainStock }}/{{ item.totalStock }} {{ item.status === 'UPCOMING' ? '即将开始' : '件' }}</text></view><text class="tag tag-orange">秒杀</text></view>
      <view v-for="item in marketing?.groups || []" :key="`g${item.id}`" class="activity-row"><view class="activity-icon">团</view><view class="activity-copy"><text>{{ item.name }} · {{ item.productName }}</text><text class="small-copy">{{ item.groupSize }} 人团 {{ money(item.groupPrice) }} · {{ item.validHours }} 小时有效</text></view><text class="tag tag-green">拼团</text></view>
      <view v-if="!(marketing?.flashes?.length || marketing?.groups?.length)" class="empty-mini">当前没有适合本店货架的活动</view>
    </view>

    <view class="section-head"><view><text class="kicker">SHARE COPY</text><text class="title">分享文案</text></view></view>
    <view class="card share-card"><textarea v-model="shareText" class="textarea" maxlength="300" /><button class="btn btn-primary btn-block" @tap="copyShare">复制推广文案</button></view>

    <view v-if="marketing?.storeSharePath" class="card"><text>消费者小程序店铺路径</text><text class="small-copy">{{marketing.storeSharePath}}</text><button class="btn" @tap="copyStorePath">复制店铺路径</button><text class="small-copy">在消费者小程序中使用此店铺路径。跨小程序分享需配置消费者小程序 AppID。</text></view>
    <view class="section-head"><view><text class="kicker">COUPONS</text><text class="title">平台优惠券</text></view></view>
    <view class="card coupon-card"><view v-for="item in marketing?.coupons || []" :key="item.id" class="coupon-row"><view><text>{{ item.name }}</text><text class="small-copy">满 {{ item.minAmount || 0 }} 元可用 · 有效期至 {{ item.validEnd || '-' }}</text></view><text class="strong-copy">{{ item.type === 'DISCOUNT' ? `${item.discountRate || ''} 折` : money(item.amount) }}</text></view><view v-if="!marketing?.coupons?.length" class="empty-mini">暂无可领取优惠券</view></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type ChannelMarketing } from '../../api'
import { currentChannelId } from '../../session'
import { money, toast } from '../../utils'

const marketing = ref<ChannelMarketing | null>(null)
const shareText = ref('丰链云产地直发好物，平台认证、品质可溯源。现在到我的小店看看，当季好货限时优惠，欢迎下单！')

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!currentChannelId()) return uni.stopPullDownRefresh()
  try {
    marketing.value = await channelApi.getMarketing()
  } catch (error) {
    toast((error as Error).message)
  } finally {
    uni.stopPullDownRefresh()
  }
}

function copyStorePath(){if(marketing.value?.storeSharePath)uni.setClipboardData({data:marketing.value.storeSharePath})}
function copyShare() {
  uni.setClipboardData({ data: shareText.value, success: () => toast('推广文案已复制', 'success') })
}
</script>

<style scoped lang="scss">
.marketing-page { padding-bottom: 30rpx; }
/* 指标卡：按移动端 UI 规范 V1.0（卡片 14px / 圆角 14px / 1px #eaeaea；大数字 20px 加粗；说明 12.5px #666） */
.metric-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24rpx; margin-bottom: 24rpx; }
.metric-card { display: flex; flex-direction: column; gap: 8rpx; min-width: 0; padding: 28rpx; border: 1px solid #eaeaea; border-radius: 28rpx; background: #ffffff; }
.metric-icon { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 20rpx; background: #e8f5eb; color: #1e6b38; font-size: 28rpx; font-weight: 700; }
.metric-value { color: #1a1a1a; font-size: 40rpx; font-weight: 700; line-height: 1.3; font-variant-numeric: tabular-nums; }
.metric-label { color: #666666; font-size: 25rpx; line-height: 1.5; }
.activity-row, .coupon-row { display: flex; align-items: center; gap: 13rpx; padding: 15rpx 0; border-top: 1rpx solid #edf2ee; }
.activity-row:first-child, .coupon-row:first-child { border-top: 0; }
.activity-icon { display: grid; width: 52rpx; height: 52rpx; flex: 0 0 52rpx; place-items: center; border-radius: 15rpx; background: #eaf7ef; color: #12764a; font-size: 24rpx; font-weight: 800; }
.activity-icon.orange { background: #fff3dd; color: #8f4500; }
.activity-copy, .coupon-row view { min-width: 0; flex: 1; }
.activity-copy text, .activity-copy .small-copy, .coupon-row view text, .coupon-row view .small-copy { display: block; }
.activity-copy text, .coupon-row view text { overflow: hidden; color: #0b1a12; font-size: 25rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.activity-copy .small-copy, .coupon-row view .small-copy { margin-top: 5rpx; color: #666666; font-size: 24rpx; }
.share-card .textarea { min-height: 190rpx; }
.share-card .btn { margin-top: 14rpx; }
.coupon-row > .strong-copy { color: #b71c1c; font-size: 32rpx; font-weight: 600; }
.empty-mini { padding: 38rpx 0; color: #666666; font-size: 24rpx; text-align: center; }
</style>
