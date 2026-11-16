<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { requireTradeLogin, getTradeRole } from '../../auth'
import { ref } from 'vue'
import { money, tradeApi, type TradeContract } from '../../api'

const role = ref(getTradeRole())
const rows = ref<TradeContract[]>([])
const loading = ref(false)
const loadError = ref('')
const SIGN: Record<string, string> = { signed: '已签', unsigned: '未签', pending: '待签' }
const STATUS: Record<string, string> = { draft: '草稿', pending: '待签署', signing: '签署中', signed: '已签署', effective: '已生效', completed: '已完成', cancelled: '已作废' }

onShow(() => {role.value=getTradeRole();rows.value=[];void load()})
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()) })
async function load() {
  if (!requireTradeLogin()) return
  loading.value = true; loadError.value = ''
  try { rows.value = await tradeApi.contracts() }
  catch (error) { loadError.value = error instanceof Error ? error.message : '合同加载失败' }
  finally { loading.value = false }
}
function detail(id: number) { uni.navigateTo({ url: `/pages/contract-detail/index?id=${id}` }) }
function pending(item: TradeContract) { return item.contractStatus !== 'cancelled' && (role.value === 'buyer' ? item.buyerSignStatus !== 'signed' : item.sellerSignStatus !== 'signed') }
</script>

<template>
  <view class="page">
    <view class="page-head">
      <view><text class="page-title">{{ role === 'buyer' ? '采购合同' : '销售合同' }}</text><text class="page-sub">{{ loading ? '正在刷新…' : `共 ${rows.length} 份` }}</text></view>
    </view>
    <view v-if="loading && !rows.length" class="loading">正在加载合同…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载合同</button></view>
    <template v-else>
      <view v-for="item in rows" :key="item.id" class="card list-card" @tap="detail(item.id)">
        <view class="between">
          <text class="tiny mono ellipsis grow">{{ item.contractNo }}</text>
          <text class="tag" :class="pending(item) ? 'amber' : item.contractStatus === 'cancelled' ? 'gray' : ''">{{ STATUS[item.contractStatus] || item.contractStatus }}</text>
        </view>
        <text class="list-title">{{ item.contractName }}</text>
        <text class="muted line ellipsis">{{ item.buyerName }} ↔ {{ item.sellerName }}</text>
        <view class="sign-row">
          <text class="tag" :class="item.buyerSignStatus === 'signed' ? '' : 'gray'">买方{{ SIGN[item.buyerSignStatus] || item.buyerSignStatus }}</text>
          <text class="tag" :class="item.sellerSignStatus === 'signed' ? '' : 'gray'">卖方{{ SIGN[item.sellerSignStatus] || item.sellerSignStatus }}</text>
        </view>
        <view class="foot">
          <text class="tiny">{{ item.createTime }}</text>
          <text v-if="item.contractAmount != null" class="price">{{ money(item.contractAmount) }}</text>
          <text v-else class="tiny">{{ pending(item) ? '去签署 ›' : '查看 ›' }}</text>
        </view>
      </view>
      <view v-if="!rows.length" class="empty">暂无合同，订单创建后会自动生成待签合同</view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.sign-row { display: flex; gap: 12rpx; margin-top: 16rpx; }
</style>
