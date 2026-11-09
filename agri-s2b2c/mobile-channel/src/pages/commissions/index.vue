<template>
  <view class="page commission-page">
    <view class="hero"><text class="hero-kicker">COMMISSION CENTER</text><text class="hero-title">佣金管理</text><text class="hero-desc">渠道分润清晰可见，结算进度实时同步</text></view>
    <view class="summary-grid">
      <view><text>累计佣金</text><b>{{ money(totalCommission) }}</b></view>
      <view><text>待结算</text><b class="orange">{{ money(pendingAmount) }}</b></view>
      <view><text>已结算</text><b class="green">{{ money(settledAmount) }}</b></view>
    </view>
    <scroll-view class="status-scroll" scroll-x :show-scrollbar="false"><view class="status-row"><view v-for="item in statuses" :key="item.value" class="status-chip" :class="{ active: status === item.value }" @tap="changeStatus(item.value)">{{ item.label }}</view></view></scroll-view>
    <view v-if="loading" class="loading">正在加载佣金记录…</view>
    <view v-else-if="commissions.length" class="card commission-list">
      <view v-for="item in commissions" :key="item.id" class="commission-row">
        <view class="commission-icon">佣</view>
        <view class="commission-copy"><text>订单 {{ item.orderNo || item.orderId }}</text><small class="small-copy">佣金比例 {{ item.rate }}% · {{ item.createTime?.replace('T', ' ') }}</small></view>
        <view class="commission-right"><b>{{ money(item.amount) }}</b><text class="tag" :class="`tag-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</text></view>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-icon">佣</view><text>暂无佣金记录</text></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type Commission } from '../../api'
import { channelSession, requireChannelLogin } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const statuses = [{ label: '全部', value: '' }, { label: '待结算', value: 'PENDING' }, { label: '已结算', value: 'SETTLED' }]
const status = ref('')
const commissions = ref<Commission[]>([])
const totalCommission = ref(0)
const loading = ref(false)
const pendingAmount = computed(() => commissions.value.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum + Number(item.amount), 0))
const settledAmount = computed(() => commissions.value.filter((item) => item.status === 'SETTLED').reduce((sum, item) => sum + Number(item.amount), 0))

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireChannelLogin()) return
  const channelId = channelSession.account?.id || 1
  loading.value = true
  try {
    const [list, total] = await Promise.all([
      channelApi.getCommissions({ channelId, page: 1, size: 50, status: status.value }),
      channelApi.getTotalCommission(channelId),
    ])
    commissions.value = list.records || []
    totalCommission.value = Number(total.total || 0)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function changeStatus(value: string) { status.value = value; load() }
</script>

<style scoped lang="scss">
.commission-page{padding-bottom:28rpx}.summary-grid{display:flex;gap:10rpx;margin:14rpx 22rpx 8rpx}.summary-grid view{flex:1;padding:18rpx;border:1rpx solid #e3eae5;border-radius:18rpx;background:#fff}.summary-grid text,.summary-grid b{display:block}.summary-grid text{color:#84938a;font-size:24rpx}.summary-grid b{margin-top:7rpx;color:#0e5233;font-size:26rpx}.summary-grid .orange{color:#a96a08}.summary-grid .green{color:#12764a}.status-scroll{width:100%;white-space:nowrap}.status-row{display:inline-flex;gap:9rpx;padding:10rpx 22rpx 14rpx}.status-chip{padding:8rpx 20rpx;border:1rpx solid #e3eae5;border-radius:999rpx;background:#fff;color:#718277;font-size:24rpx}.status-chip.active{border-color:#12764a;background:#e9f6ee;color:#0e5233;font-weight:700}.loading{padding:80rpx 0;color:#84938a;text-align:center}.commission-list{padding-top:8rpx;padding-bottom:8rpx}.commission-row{display:flex;align-items:center;gap:13rpx;padding:16rpx 0;border-top:1rpx solid #edf2ee}.commission-row:first-child{border-top:0}.commission-icon{display:grid;width:50rpx;height:50rpx;flex:0 0 50rpx;place-items:center;border-radius:14rpx;background:#eaf7ef;color:#12764a;font-size:24rpx;font-weight:800}.commission-copy{min-width:0;flex:1}.commission-copy text,.commission-copy .small-copy{display:block}.commission-copy text{color:#0b1a12;font-size:24rpx;font-weight:650}.commission-copy .small-copy{margin-top:5rpx;color:#93a29a;font-size:24rpx}.commission-right{display:flex;align-items:flex-end;flex-direction:column;gap:6rpx}.commission-right b{color:#d45b32;font-size:24rpx}
</style>
