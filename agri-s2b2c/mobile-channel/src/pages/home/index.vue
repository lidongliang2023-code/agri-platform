<template>
  <view class="page home-page">
    <view class="hero">
      <text class="hero-kicker">CHANNEL WORKBENCH</text>
      <text class="hero-title">{{ channel?.shopName || '商家工作台' }}</text>
      <text class="hero-desc">{{ channel?.companyName || '渠道增长与产地好物分销' }}</text>
      <view class="hero-status"><text class="online-dot" /><text>分润链路正常</text><text class="hero-platform">{{ platformLabel }}</text></view>
    </view>

    <view class="metric-grid">
      <view class="metric-card"><view class="metric-icon">佣</view><text class="metric-value">{{ money(totalCommission) }}</text><text class="metric-label">累计佣金</text></view>
      <view class="metric-card"><view class="metric-icon">单</view><text class="metric-value">{{ dashboard.todayOrders ?? 0 }}</text><text class="metric-label">今日有效订单</text></view>
      <view class="metric-card"><view class="metric-icon">品</view><text class="metric-value">{{ productTotal }}</text><text class="metric-label">货架商品</text></view>
      <view class="metric-card pending"><view class="metric-icon">待</view><text class="metric-value">{{ money(pendingCommission) }}</text><text class="metric-label">近20笔待结算佣金</text></view>
    </view>

    <view class="section-head"><view><text class="kicker">QUICK ACTION</text><text class="title">渠道经营</text></view></view>
    <view class="quick-grid">
      <view class="quick-card" @tap="goPool"><view class="quick-icon">选</view><text>选品中心</text><small class="small-copy">平台好货一键上架</small></view>
      <view class="quick-card" @tap="goProducts"><view class="quick-icon">品</view><text>我的货架</text><small class="small-copy">查看已选商品</small></view>
      <view class="quick-card" @tap="goOrders"><view class="quick-icon">单</view><text>订单管理</text><small class="small-copy">掌握成交进度</small></view>
      <view class="quick-card" @tap="goGrowth"><view class="quick-icon">营</view><text>营销素材</text><small class="small-copy">活动与售后协同</small></view>
    </view>

    <view class="section-head"><view><text class="kicker">RECENT COMMISSION</text><text class="title">最近佣金</text></view><text class="sub" @tap="goCommissions">全部佣金 →</text></view>
    <view class="card">
      <view v-for="item in commissions.slice(0, 5)" :key="item.id" class="commission-row">
        <view class="commission-icon">佣</view>
        <view class="commission-copy"><text>订单 {{ item.orderNo || item.orderId }}</text><small class="small-copy">{{ item.createTime?.replace('T', ' ') }}</small></view>
        <view class="commission-right"><b>{{ money(item.amount) }}</b><text class="tag" :class="`tag-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</text></view>
      </view>
      <view v-if="!commissions.length" class="empty-mini">暂无佣金记录</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type ChannelPartner, type Commission, type Dashboard } from '../../api'
import { channelSession, requireChannelLogin } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const channel = ref<ChannelPartner | null>(null)
const dashboard = ref<Dashboard>({})
const commissions = ref<Commission[]>([])
const productTotal = ref(0)
const totalCommission = ref(0)
const pendingCommission = computed(() => commissions.value.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum + Number(item.amount), 0))
const platformLabel = computed(() => {
  const platform = uni.getSystemInfoSync().uniPlatform
  return platform === 'mp-weixin' ? '微信小程序' : platform === 'app' ? 'APP' : 'H5'
})

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireChannelLogin()) return
  const channelId = channelSession.account!.id
  try {
    const [detail, dashboardData, commissionData, totalData, productData] = await Promise.all([
      channelApi.getChannel(channelId),
      channelApi.getDashboard(),
      channelApi.getCommissions({ channelId, page: 1, size: 20 }),
      channelApi.getTotalCommission(channelId),
      channelApi.getProducts({ channelId, page: 1, size: 30 }),
    ])
    channel.value = detail
    dashboard.value = dashboardData
    commissions.value = commissionData.records || []
    totalCommission.value = Number(totalData.total || 0)
    productTotal.value = Number(productData.total ?? 0)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    uni.stopPullDownRefresh()
  }
}

function goPool() { uni.switchTab({ url: '/pages/pool/index' }) }
function goProducts() { uni.navigateTo({ url: '/pages/products/index' }) }
function goOrders() { uni.navigateTo({ url: '/pages/orders/index' }) }
function goGrowth() { uni.navigateTo({ url: '/pages/growth/index' }) }
function goCommissions() { uni.switchTab({ url: '/pages/commissions/index' }) }
</script>

<style scoped lang="scss">
.hero { margin: 18rpx 22rpx 0; }
.hero-status { display: flex; align-items: center; gap: 8rpx; margin-top: 22rpx; color: rgba(255,255,255,.72); font-size: 24rpx; }
.online-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #6ee7a2; box-shadow: 0 0 0 6rpx rgba(110,231,162,.12); }
.hero-platform { margin-left: auto; padding: 5rpx 12rpx; border: 1rpx solid rgba(255,255,255,.16); border-radius: 999rpx; }
.metric-card.pending .metric-icon { background: #fff3dd; color: #a96a08; }
.quick-grid { display: flex; flex-wrap: wrap; gap: 12rpx; padding: 0 22rpx; }
.quick-card { width: calc((100% - 12rpx) / 2); padding: 20rpx; border: 1rpx solid #e3eae5; border-radius: 20rpx; background: #fff; }
.quick-icon { display: grid; width: 46rpx; height: 46rpx; place-items: center; border-radius: 13rpx; background: #eaf7ef; color: #12764a; font-size: 24rpx; font-weight: 800; }
.quick-card text,.quick-card .small-copy{display:block}.quick-card text{margin-top:12rpx;color:#0b1a12;font-size:24rpx;font-weight:700}.quick-card .small-copy{margin-top:4rpx;color:#93a29a;font-size:24rpx}
.commission-row{display:flex;align-items:center;gap:13rpx;padding:15rpx 0;border-top:1rpx solid #edf2ee}.commission-row:first-child{border-top:0}
.commission-icon{display:grid;width:50rpx;height:50rpx;flex:0 0 50rpx;place-items:center;border-radius:14rpx;background:#eaf7ef;color:#12764a;font-size:24rpx;font-weight:800}
.commission-copy{min-width:0;flex:1}.commission-copy text,.commission-copy .small-copy{display:block}.commission-copy text{color:#0b1a12;font-size:24rpx;font-weight:650}.commission-copy .small-copy{margin-top:4rpx;color:#93a29a;font-size:24rpx}
.commission-right{display:flex;align-items:flex-end;flex-direction:column;gap:6rpx}.commission-right b{color:#d45b32;font-size:24rpx}.empty-mini{padding:42rpx 0;color:#94a198;text-align:center;font-size:24rpx}
</style>
