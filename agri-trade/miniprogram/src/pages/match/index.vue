<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { requireTradeLogin, getTradeRole } from '../../auth'
import { ref } from 'vue'
import { tradeApi, type MatchResult, type TradeDemand } from '../../api'

const demands = ref<TradeDemand[]>([])
const selectedId = ref<number | null>(null)
const results = ref<MatchResult[]>([])
const loading = ref(false)
const matching = ref(false)

onShow(() => void load())
async function load() {
  if(getTradeRole()==='seller'){uni.redirectTo({url:'/pages/business/index?key=match&role=seller'});return}
  if (!requireTradeLogin()) return
  loading.value = true
  try {
    demands.value = await tradeApi.myDemands()
    if (selectedId.value == null && demands.value.length) selectedId.value = demands.value[0].id
  } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '需求加载失败', icon: 'none' }) }
  finally { loading.value = false }
}
async function runMatch() {
  if (matching.value) return
  if (!selectedId.value) { uni.showToast({ title: '请先选择采购需求', icon: 'none' }); return }
  matching.value = true
  try {
    results.value = await tradeApi.matchDemand(selectedId.value)
    uni.showToast({ title: `已找到 ${results.value.length} 个匹配货源`, icon: 'none' })
  } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '撮合失败', icon: 'none' }) }
  finally { matching.value = false }
}
function product(id: number) { uni.navigateTo({ url: `/pages/product/detail?id=${id}` }) }
function publish() { uni.navigateTo({ url: '/pages/publish-demand/index' }) }
</script>

<template>
  <view class="page">
    <view class="match-hero"><text class="kicker">AI MATCHING</text><text class="title">智能撮合助手</text><text class="desc">综合品类、价格、产地与信用，为采购需求推荐合适货源。</text></view>
    <view class="card">
      <view class="card-head"><text class="card-title">选择采购需求</text><text class="card-more" @tap="publish">新建需求 ›</text></view>
      <view v-if="loading" class="loading">正在加载需求…</view>
      <view v-else-if="!demands.length" class="empty">还没有采购需求，先发布一条需求吧</view>
      <view v-else class="demand-select">
        <view v-for="item in demands" :key="item.id" class="select-row" :class="{ selected: selectedId === item.id }" @tap="selectedId = item.id">
          <view><text class="demand-name">{{ item.demandName }}</text><text class="muted">{{ item.quantity }} {{ item.unit || '' }} · {{ item.deliveryAddress || '交付地待确认' }}</text></view><text class="radio" :class="{ on: selectedId === item.id }">{{ selectedId === item.id ? '✓' : '' }}</text>
        </view>
      </view>
      <button class="btn btn-primary btn-block" :loading="matching" :disabled="matching || loading" @tap="runMatch">{{ matching ? '正在分析货源…' : '开始智能撮合' }}</button>
    </view>
    <view class="section-head"><text class="title-small">推荐货源</text><text class="tiny">{{ results.length ? `已生成 ${results.length} 条结果` : '等待启动撮合' }}</text></view>
    <view class="card result" v-for="item in results" :key="item.id" @tap="product(item.productId)">
      <view class="score">{{ Number(item.matchScore).toFixed(0) }}<text>匹配度</text></view><view class="result-copy"><text class="result-name">{{ item.productName }}</text><text class="muted">{{ item.sellerName }}</text><text class="muted">{{ item.matchReason }}</text></view><text class="arrow">›</text>
    </view>
    <view v-if="!results.length" class="empty">选择需求并启动撮合，结果会展示在这里</view>
  </view>
</template>

<style scoped lang="scss">
.match-hero { margin-bottom: 20rpx; padding: 30rpx; border-radius: 24rpx; background: linear-gradient(135deg,#073821,#159a5e); color: #fff; }
.kicker { display: block; color: #a9e7c1; font-size: 24rpx; letter-spacing: .12em; }.radio { display: flex; width: 40rpx; height: 40rpx; flex-shrink: 0; align-items: center; justify-content: center; border: 2rpx solid #b8c3bc; border-radius: 50%; color: #fff; font-size: 24rpx; }.radio.on { border-color: #12764a; background: #12764a; }.title { display: block; margin-top: 8rpx; font-size: 36rpx; font-weight: 800; }.desc { display: block; margin-top: 10rpx; color: rgba(255,255,255,.68); font-size: 24rpx; line-height: 1.6; }.demand-select { max-height: 560rpx; overflow: auto; }.select-row { display: flex; min-height: 104rpx; align-items: center; justify-content: space-between; gap: 14rpx; padding: 18rpx 0; border-top: 1rpx solid #edf2ee; }.select-row:first-child { border-top: 0; }.select-row.selected { color: #12764a; }.select-row view { min-width: 0; flex: 1; }.demand-name,.muted { display: block; }.demand-name { font-size: 28rpx; font-weight: 600; }.select-row .muted { margin-top: 5rpx; }.btn { margin-top: 18rpx; }.section-head { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 0 12rpx; }.title-small { font-size: 30rpx; font-weight: 700; }.result { display: flex; align-items: center; gap: 16rpx; }.score { display: flex; width: 104rpx; height: 104rpx; flex: 0 0 104rpx; align-items: center; justify-content: center; flex-direction: column; border-radius: 50%; background: #e5f5eb; color: #12764a; font-size: 28rpx; font-weight: 800; }.score text { font-size: 22rpx; font-weight: 400; }.result-copy { min-width: 0; flex: 1; }.result-name { display: block; font-size: 28rpx; font-weight: 700; }.result-copy .muted { margin-top: 5rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
