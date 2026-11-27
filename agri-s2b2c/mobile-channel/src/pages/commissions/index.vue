<template>
  <view class="page commission-page">
    <view class="hero">
      <text class="hero-kicker">COMMISSION CENTER</text>
      <text class="hero-title">佣金与提现</text>
      <text class="hero-desc">分润、结算和提现进度统一查看</text>
    </view>

    <view class="balance-card">
      <text class="balance-label">可提现余额</text>
      <text class="balance-value">{{ money(summary?.available) }}</text>
      <button class="btn btn-sm withdraw-button" :disabled="loading || !!loadError || Number(summary?.available || 0) <= 0" @tap="withdrawError = ''; showWithdraw = true">申请提现</button>
    </view>
    <view class="summary-grid">
      <view><text>待结算</text><text class="orange strong-copy">{{ money(summary?.pendingTotal) }}</text></view>
      <view><text>已结算</text><text class="strong-copy">{{ money(summary?.settledTotal) }}</text></view>
      <view><text>已提现</text><text class="strong-copy">{{ money(summary?.withdrawnTotal) }}</text></view>
    </view>
    <view class="empty-mini">处理中 {{ money(summary?.frozenTotal) }}</view>
    <view v-if="loadError" class="card"><text>{{ loadError }}</text><button class="btn" :disabled="loading" @tap="load">重新加载</button></view>

    <view class="section-head"><view><text class="kicker">COMMISSION RECORDS</text><text class="title">佣金明细</text></view><text class="sub">{{ commissions.length }} 条</text></view>
    <scroll-view class="status-scroll" scroll-x :show-scrollbar="false"><view class="status-row"><text v-for="item in statuses" :key="item.value" class="status-chip" :class="{ active: status === item.value }" @tap="changeStatus(item.value)">{{ item.label }}</text></view></scroll-view>
    <view v-if="loading" class="loading">正在加载佣金…</view>
    <view v-else-if="commissions.length" class="card list-card">
      <view v-for="item in commissions" :key="item.id" class="commission-row">
        <view class="commission-icon">佣</view>
        <view class="commission-copy"><text>订单 {{ item.orderNo || item.orderId }}</text><text class="small-copy">{{ formatTime(item.createTime) }} · 比例 {{ item.rate }}%</text></view>
        <view class="commission-right"><text class="strong-copy">{{ money(item.amount) }}</text><text class="tag" :class="`tag-${commissionStatus(item.status).tone}`">{{ commissionStatus(item.status).label }}</text></view>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-icon">佣</view><text>暂无佣金记录</text></view>

    <view class="section-head"><view><text class="kicker">WITHDRAWALS</text><text class="title">提现记录</text></view></view>
    <view v-if="withdrawals.length" class="card list-card">
      <view v-for="item in withdrawals" :key="item.id" class="withdraw-row"><view><text>提现申请</text><text class="small-copy">{{ formatTime(item.applyTime) }}</text></view><text class="strong-copy">{{ money(item.amount) }}</text><text class="tag" :class="`tag-${withdrawalStatus(item.status).tone}`">{{ withdrawalStatus(item.status).label }}</text></view>
    </view>
    <view v-else class="empty-mini">暂无提现申请</view>
    <view class="card"><view class="withdraw-row"><button class="btn" :disabled="loading || pageNo<=1" @tap="changePage(-1)">上一页</button><text>{{pageNo}} 页 / 共 {{total}} 条</text><button class="btn" :disabled="loading || pageNo*20>=total" @tap="changePage(1)">下一页</button></view><button class="btn" @tap="openReconcile">查看月度对账</button></view>
    <MobileInputSheet :show="showWithdraw" title="申请提现" :description="`可提现 ${money(summary?.available)}，提交后可在提现记录查看进度`" placeholder="输入提现金额" input-type="digit" confirm-text="申请提现" :busy="withdrawing" :error="withdrawError" @close="showWithdraw = false" @submit="withdraw" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MobileInputSheet from '../../components/MobileInputSheet.vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type Commission, type CommissionSummary, type Withdrawal } from '../../api'
import { currentChannelId, requireChannelLogin } from '../../session'
import { commissionStatus, formatTime, money, toast, withdrawalStatus } from '../../utils'

const statuses = [{ label: '全部', value: '' }, { label: '待结算', value: 'PENDING' }, { label: '已结算', value: 'SETTLED' }]
const showWithdraw = ref(false)
const withdrawing = ref(false)
const withdrawError = ref('')
const status = ref('')
const summary = ref<CommissionSummary | null>(null)
const commissions = ref<Commission[]>([])
const withdrawals = ref<Withdrawal[]>([])
const loading = ref(false)
const loadError = ref('')
let requestSeq = 0
const pageNo=ref(1),total=ref(0)

onShow(load)
onPullDownRefresh(load)

async function load() {
  const seq = ++requestSeq
  summary.value = null
  commissions.value = []
  withdrawals.value = []
  total.value = 0
  loadError.value = ''
  if (!requireChannelLogin()) { loading.value = false; return uni.stopPullDownRefresh() }
  const channelId = currentChannelId()
  if (!channelId) { loading.value = false; return uni.stopPullDownRefresh() }
  loading.value = true
  try {
    const [moneyData, commissionData, withdrawalData] = await Promise.all([
      channelApi.getCommissionSummary(),
      channelApi.getCommissions(channelId, { page: pageNo.value, size: 20, status: status.value || undefined }),
      channelApi.getWithdrawals(),
    ])
    if (seq !== requestSeq) return
    summary.value = moneyData
    commissions.value = commissionData.records || []
    total.value=Number(commissionData.total || 0)
    withdrawals.value = withdrawalData || []
  } catch (error) {
    if (seq === requestSeq) {
      loadError.value = (error as Error).message || '加载失败，请重试'
      toast(loadError.value)
    }
  } finally {
    if (seq === requestSeq) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function changeStatus(value: string) { status.value = value; pageNo.value=1; load() }
function changePage(n:number){
  const next = pageNo.value + n
  if (loading.value || next < 1 || next > Math.max(1, Math.ceil(total.value / 20))) return
  pageNo.value = next
  load()
}
function openReconcile(){uni.navigateTo({url:'/pages/reconcile/index'})}

async function withdraw(value: string) {
  if (withdrawing.value || loading.value || loadError.value || !summary.value) return
  const available = Number(summary.value?.available || 0)
  const amount = Number(value)
  if (!/^\d+(\.\d{1,2})?$/.test(value) || amount <= 0 || amount > available) { withdrawError.value = '请输入可提现范围内的金额，最多两位小数'; return }
  withdrawing.value = true
  try {
    const result = await channelApi.applyWithdrawal(amount)
    if (!result.success) throw new Error(result.message || '提现申请失败')
    showWithdraw.value = false
    toast(result.message || '提现申请已提交', 'success')
    await load()
  } catch (error) {
    withdrawError.value = (error as Error).message
  } finally { withdrawing.value = false }
}
</script>

<style scoped lang="scss">
.commission-page { padding-bottom: 28rpx; }
.balance-card { position: relative; margin: 18rpx 22rpx 0; padding: 28rpx; border-radius: 24rpx; background: linear-gradient(135deg, #073821, #12764a); color: #fff; }
.balance-label { display: block; color: rgba(255,255,255,.65); font-size: 24rpx; }
.balance-value { display: block; margin-top: 8rpx; font-size: 50rpx; font-weight: 800; }
.withdraw-button { position: absolute; right: 24rpx; bottom: 28rpx; border-color: #fff; background: #fff; color: #0e5233; }
.summary-grid { display: flex; gap: 12rpx; margin: 16rpx 22rpx 0; }
.summary-grid view { flex: 1; padding: 18rpx; border: 1rpx solid #e3eae5; border-radius: 18rpx; background: #fff; }
.summary-grid text, .summary-grid .strong-copy { display: block; }
.summary-grid text { color: #666666; font-size: 24rpx; }
.summary-grid .strong-copy { margin-top: 6rpx; color: #33453b; font-size: 25rpx; }
.summary-grid .orange { color: #8f4500; }
.status-scroll { width: 100%; white-space: nowrap; }
.status-row { display: inline-flex; gap: 10rpx; padding: 0 22rpx 16rpx; }
.status-chip { padding: 10rpx 22rpx; border: 1rpx solid #e3eae5; border-radius: 999rpx; background: #fff; color: #666666; font-size: 24rpx; }
.status-chip.active { border-color: #12764a; background: #e9f6ee; color: #0e5233; font-weight: 700; }
.loading { padding: 80rpx 0; color: #666666; text-align: center; }
.list-card { padding-top: 8rpx; padding-bottom: 8rpx; }
.commission-row, .withdraw-row { display: flex; align-items: center; gap: 13rpx; min-height: 92rpx; border-top: 1rpx solid #edf2ee; }
.commission-row:first-child, .withdraw-row:first-child { border-top: 0; }
.commission-icon { display: grid; width: 50rpx; height: 50rpx; flex: 0 0 50rpx; place-items: center; border-radius: 14rpx; background: #eaf7ef; color: #12764a; font-size: 24rpx; font-weight: 800; }
.commission-copy, .withdraw-row view { min-width: 0; flex: 1; }
.commission-copy text, .commission-copy .small-copy, .withdraw-row view text, .withdraw-row view .small-copy { display: block; }
.commission-copy text, .withdraw-row view text { color: #0b1a12; font-size: 25rpx; font-weight: 650; }
.commission-copy .small-copy, .withdraw-row view .small-copy { margin-top: 4rpx; color: #666666; font-size: 24rpx; }
.commission-right { display: flex; align-items: flex-end; flex-direction: column; gap: 6rpx; }
.commission-right .strong-copy, .withdraw-row > .strong-copy { color: #e53935; font-size: 32rpx; font-weight: 600; }
.withdraw-row { gap: 12rpx; }
.empty-mini { padding: 34rpx 0; color: #666666; font-size: 24rpx; text-align: center; }
.balance-card { padding:28rpx; }.withdraw-button { position:static;width:100%;margin-top:24rpx; }.summary-grid { gap:8rpx; }.summary-grid view { min-width:0;padding:16rpx 12rpx; }.summary-grid .strong-copy { overflow-wrap:anywhere; }.commission-copy text { overflow-wrap:anywhere; }.commission-right { flex-shrink:0; }.withdraw-row { flex-wrap:wrap;padding:14rpx 0; }
</style>
