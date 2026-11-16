<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { requireTradeLogin, getTradeRole } from '../../auth'
import { ref } from 'vue'
import { LOGISTICS_STATUS, tradeApi, type TradeLogistics, type TradeTrace } from '../../api'

const role = ref(getTradeRole())
const rows = ref<TradeLogistics[]>([])
const traces = ref<TradeTrace[]>([])
const selected = ref<TradeLogistics | null>(null)
const loading = ref(false)
const loadError = ref('')
const traceLoading = ref(false)
const traceError = ref('')
let traceSerial = 0

onShow(() => {role.value=getTradeRole();rows.value=[];close();void load()})
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()) })
async function load() {
  if (!requireTradeLogin()) return
  loading.value = true; loadError.value = ''
  try { rows.value = await tradeApi.logistics() }
  catch (error) { loadError.value = error instanceof Error ? error.message : '物流加载失败' }
  finally { loading.value = false }
}
async function open(row: TradeLogistics) {
  const token = ++traceSerial
  selected.value = row; traces.value = []; traceError.value = ''; traceLoading.value = true
  try { const data = await tradeApi.traces(row.id); if (token === traceSerial) traces.value = data || [] }
  catch (error) { if (token === traceSerial) traceError.value = error instanceof Error ? error.message : '轨迹加载失败' }
  finally { if (token === traceSerial) traceLoading.value = false }
}
function close() { traceSerial++; selected.value = null }
function tone(status: string) { return status === 'delivered' ? '' : status === 'pending' ? 'amber' : 'blue' }
</script>

<template>
  <view class="page">
    <view class="page-head">
      <view><text class="page-title">{{ role === 'buyer' ? '收货物流' : '发货物流' }}</text><text class="page-sub">{{ loading ? '正在刷新…' : `共 ${rows.length} 笔物流单` }}</text></view>
    </view>
    <view v-if="loading && !rows.length" class="loading">正在加载物流…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载物流</button></view>
    <template v-else>
      <view v-for="item in rows" :key="item.id" class="card list-card" @tap="open(item)">
        <view class="between">
          <text class="tiny mono ellipsis grow">{{ item.logisticsNo }}</text>
          <text class="tag" :class="tone(item.logisticsStatus)">{{ LOGISTICS_STATUS[item.logisticsStatus] || item.logisticsStatus }}</text>
        </view>
        <text class="list-title">{{ item.carrierName || '承运商待确认' }}</text>
        <view class="route">
          <view class="route-point"><text class="dot from" /><text class="muted">{{ item.senderAddress || '发货地待确认' }}</text></view>
          <view class="route-point"><text class="dot to" /><text class="muted">{{ item.receiverAddress || '收货地待确认' }}</text></view>
        </view>
        <view class="foot"><text class="tiny ellipsis grow">{{ item.currentLocation ? `当前：${item.currentLocation}` : '暂无最新位置' }}</text><text class="tiny">查看轨迹 ›</text></view>
      </view>
      <view v-if="!rows.length" class="empty">暂无物流单</view>
    </template>

    <view v-if="selected" class="sheet-mask" @tap="close">
      <view class="sheet" @tap.stop>
        <view class="sheet-head"><view class="grow"><text class="sheet-title">运输轨迹</text><text class="tiny mono ellipsis sub">{{ selected.logisticsNo }}</text></view><view class="sheet-close" @tap="close">×</view></view>
        <scroll-view scroll-y class="sheet-body trace-body">
          <view class="sheet-body-inner">
            <view v-if="traceLoading" class="loading">正在加载轨迹…</view>
            <view v-else-if="traceError" class="load-error"><text>{{ traceError }}</text><button class="btn btn-ghost" @tap="open(selected)">重新加载轨迹</button></view>
            <template v-else>
              <view v-for="(item, index) in traces" :key="item.id" class="trace" :class="{ latest: index === 0 }">
                <view class="rail"><text class="node" /><text v-if="index < traces.length - 1" class="bar" /></view>
                <view class="grow trace-copy">
                  <text class="trace-status">{{ LOGISTICS_STATUS[item.traceStatus] || item.traceStatus }}</text>
                  <text class="muted">{{ item.traceDescription || item.traceLocation || '状态已更新' }}</text>
                  <text class="tiny">{{ item.traceTime }}</text>
                </view>
              </view>
              <view v-if="!traces.length" class="empty">暂无物流轨迹</view>
            </template>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.route { margin-top: 14rpx; }
.route-point { display: flex; align-items: center; gap: 14rpx; padding: 6rpx 0; }
.route-point .muted { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dot { width: 16rpx; height: 16rpx; flex-shrink: 0; border-radius: 50%; }
.dot.from { background: #b8c3bc; }
.dot.to { background: var(--c-primary); }
.sub { display: block; margin-top: 4rpx; }
.trace-body { height: 60vh; }
.trace { display: flex; gap: 20rpx; }
.rail { display: flex; width: 24rpx; flex-shrink: 0; align-items: center; flex-direction: column; }
.node { width: 20rpx; height: 20rpx; margin-top: 10rpx; border-radius: 50%; background: #c8d3cc; }
.trace.latest .node { background: var(--c-primary); box-shadow: 0 0 0 8rpx var(--c-primary-soft); }
.bar { width: 2rpx; flex: 1; margin-top: 6rpx; background: #dde5e0; }
.trace-copy { padding-bottom: 32rpx; }
.trace-copy text { display: block; }
.trace-status { font-size: 28rpx; font-weight: 600; }
.trace.latest .trace-status { color: var(--c-primary); }
.trace-copy .muted, .trace-copy .tiny { margin-top: 6rpx; }
</style>
