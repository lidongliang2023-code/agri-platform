<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { money, query, request, type TradeDemand, type TradeProduct } from '../../api'
import { isTradeServiceConfigured, isTradeLanPreview, getTradeStatusBarHeight, getTradeUser, getTradeRole } from '../../auth'

const products = ref<TradeProduct[]>([])
const demands = ref<TradeDemand[]>([])
const productLoading = ref(true)
const demandLoading = ref(true)
const productError = ref('')
const productTotal = ref(0)
const demandError = ref('')
const statusBarHeight = ref(getTradeStatusBarHeight())
const serviceUnavailable = !isTradeServiceConfigured()
const lanPreview = isTradeLanPreview()
const account = ref(getTradeUser())
const displayName = computed(() => account.value?.nickname || account.value?.username || '')

const role = ref(getTradeRole())
const entries = computed(() => [
  { label: '交易大厅', icon: '货', tone: '', tab: '/pages/products/index' },
  { label: '采购需求', icon: '求', tone: 'amber', tab: '/pages/demands/index' },
  { label: '智能撮合', icon: '配', tone: 'violet', url: role.value === 'buyer' ? '/pages/match/index' : '/pages/seller/quote' },
  { label: '我的订单', icon: '单', tone: 'blue', tab: '/pages/orders/index' },
  { label: '电子合同', icon: '约', tone: 'blue', url: '/pages/contracts/index' },
  { label: '物流跟踪', icon: '运', tone: '', url: '/pages/logistics/index' },
  { label: role.value === 'buyer' ? '买家中心' : '卖家中心', icon: role.value === 'buyer' ? '买' : '卖', tone: 'amber', url: '/pages/workspace/index?role=' + role.value },
  { label: role.value === 'buyer' ? '采购需求管理' : '商品管理', icon: role.value === 'buyer' ? '求' : '货', tone: 'red', url: role.value === 'buyer' ? '/pages/buyer/demand' : '/pages/seller/goods' },
])

onShow(() => { role.value = getTradeRole(); account.value = getTradeUser(); void load() })
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()) })

// 这两条路径与 index.html 里的首屏预取脚本一致；改动时两边要一起改。
const PRODUCTS_PATH = `/public/hall/products${query({ sort: 'latest', pageNum: 1, pageSize: 6 })}`
const DEMANDS_PATH = '/public/demands'

/** H5 首次进入首页时，接口已由 index.html 随主脚本并行发出；这里取走结果（只用一次，30 秒内有效）。 */
async function firstLoad<T>(path: string): Promise<T> {
  // #ifdef H5
  const store = (window as unknown as { __TRADE_PREFETCH__?: Record<string, { at: number; promise: Promise<T> }> }).__TRADE_PREFETCH__
  const hit = store?.[path]
  if (hit) {
    delete store![path]
    if (Date.now() - hit.at < 30000) {
      try { return await hit.promise }
      catch { /* 预取失败就按正常请求再试一次，错误提示以正常请求为准 */ }
    }
  }
  // #endif
  return request<T>(path)
}

function listData<T>(data: unknown): T[] {
  const payload = data as { records?: unknown; list?: unknown } | null
  const rows = Array.isArray(data) ? data : payload?.records ?? payload?.list
  if (rows == null) return []
  if (!Array.isArray(rows)) throw new Error('服务返回的数据格式异常，请稍后重试')
  return rows.filter((row): row is T => row != null && typeof row === 'object')
}

function load() { return Promise.all([loadProducts(), loadDemands()]) }

async function loadProducts() {
  productLoading.value = true
  productError.value = ''
  try {
    const data = await firstLoad<any>(PRODUCTS_PATH)
    products.value = listData<TradeProduct>(data)
    productTotal.value = Number(data?.total ?? products.value.length)
  }
  catch (error) { productError.value = error instanceof Error ? error.message : '货源加载失败' }
  finally { productLoading.value = false }
}

async function loadDemands() {
  demandLoading.value = true
  demandError.value = ''
  try { demands.value = listData<TradeDemand>(await firstLoad<unknown>(DEMANDS_PATH)) }
  catch (error) { demandError.value = error instanceof Error ? error.message : '采购需求加载失败' }
  finally { demandLoading.value = false }
}

function openEntry(item: { tab?: string; url?: string }) {
  if (item.tab) uni.switchTab({ url: item.tab })
  else if (item.url) uni.navigateTo({ url: item.url })
}
function toProduct(id: number) { uni.navigateTo({ url: `/pages/product/detail?id=${id}` }) }
function toMarket() { uni.switchTab({ url: '/pages/products/index' }) }
function toDemand() { uni.switchTab({ url: '/pages/demands/index' }) }
function toLogin() { uni.navigateTo({ url: '/pages/login/index' }) }
function budget(item: TradeDemand) {
  if (item.priceMin == null && item.priceMax == null) return '面议'
  if (item.priceMin != null && item.priceMax != null) return `${money(item.priceMin)}–${money(item.priceMax)}`
  return money(item.priceMin ?? item.priceMax)
}
</script>

<template>
  <view class="page flush">
    <view class="hero" :style="{ paddingTop: `${statusBarHeight + 12}px` }">
      <view class="hero-top">
        <view class="brand"><image class="brand-mark" src="/static/fengchain.svg" mode="aspectFit" /><text>丰链云 · 交易撮合</text></view>
        <text v-if="!displayName" class="login-link" @tap="toLogin">登录</text>
      </view>
      <text class="hero-title">{{ displayName ? `您好，${displayName}` : '找货源，接需求' }}</text>
      <text class="hero-desc">品质农产品供需撮合，从产地直达采购方</text>
      <view class="hero-search" @tap="toMarket"><text class="search-icon">⌕</text><text>搜索产品、品类或产地</text></view>
      <view class="metrics">
        <view class="metric"><text class="metric-value">{{ productLoading || productError ? '—' : productTotal }}</text><text class="metric-label">在售货源</text></view>
        <view class="metric"><text class="metric-value">{{ demandLoading || demandError ? '—' : demands.length }}</text><text class="metric-label">公开需求</text></view>
        <view class="metric"><text class="metric-value">AI</text><text class="metric-label">智能撮合</text></view>
      </view>
    </view>

    <view class="pad body">
      <view class="card entry-card">
        <view class="entry-grid">
          <view v-for="item in entries" :key="item.label" class="entry" @tap="openEntry(item)">
            <view class="entry-icon" :class="item.tone">{{ item.icon }}</view>
            <text class="entry-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="lanPreview" class="notice">当前为局域网联调预览，请保持手机与服务电脑连接同一 Wi-Fi。仅用于测试，请使用测试账号。</view>
      <view v-if="serviceUnavailable" class="notice">当前预览包尚未连接交易服务，可查看导航和登录页面。货源、需求和账号登录将在配置服务后开放。</view>

      <view class="card">
        <view class="card-head"><text class="card-title">热门货源</text><text class="card-more" @tap="toMarket">全部 ›</text></view>
        <view v-if="productLoading" class="loading">正在加载货源…</view>
        <view v-else-if="productError" class="load-error inline"><text>{{ productError }}</text><button class="btn btn-ghost btn-sm" @tap="loadProducts">重新加载</button></view>
        <template v-else>
          <view v-for="item in products.slice(0, 4)" :key="item.id" class="product" @tap="toProduct(item.id)">
            <view class="glyph">{{ item.productName?.slice(0, 1) || '农' }}</view>
            <view class="grow">
              <text class="product-name ellipsis">{{ item.productName }}</text>
              <text class="tiny ellipsis">{{ item.sellerName || '认证供应商' }} · {{ item.originCity || '产地直供' }}</text>
            </view>
            <view class="product-price"><text class="price">{{ money(item.price ?? item.priceMin) }}</text><text class="tiny">/{{ item.unit }}</text></view>
          </view>
          <view v-if="!products.length" class="empty">暂无在售货源</view>
        </template>
      </view>

      <view class="card">
        <view class="card-head"><text class="card-title">最新采购需求</text><text class="card-more" @tap="toDemand">更多 ›</text></view>
        <view v-if="demandLoading" class="loading">正在加载采购需求…</view>
        <view v-else-if="demandError" class="load-error inline"><text>{{ demandError }}</text><button class="btn btn-ghost btn-sm" @tap="loadDemands">重新加载</button></view>
        <template v-else>
          <view v-for="item in demands.slice(0, 4)" :key="item.id" class="demand" @tap="toDemand">
            <view class="between"><text class="demand-name ellipsis">{{ item.demandName }}</text><text class="tag">{{ item.categoryName || '农产品' }}</text></view>
            <text class="tiny ellipsis demand-line">{{ item.buyerName }} · {{ item.deliveryAddress || '交货地待协商' }}</text>
            <view class="between demand-foot"><text class="muted">{{ item.quantity }} {{ item.unit || '吨' }}</text><text class="price">{{ budget(item) }}</text></view>
          </view>
          <view v-if="!demands.length" class="empty">暂无公开采购需求</view>
        </template>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hero { padding: 0 32rpx 72rpx; background: radial-gradient(circle at 88% 0, rgba(83, 213, 138, .26), transparent 420rpx), linear-gradient(150deg, #073821, #0f6440); color: #fff; }
.hero-top { display: flex; height: 88rpx; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 14rpx; font-size: 30rpx; font-weight: 700; }
.brand-mark { width: 48rpx; height: 48rpx; border-radius: 12rpx; background: rgba(255, 255, 255, .92); }
.login-link { display: flex; min-height: 64rpx; align-items: center; padding: 0 28rpx; border: 1rpx solid rgba(255, 255, 255, .4); border-radius: 32rpx; font-size: 26rpx; }
.hero-title { display: block; margin-top: 24rpx; font-size: 44rpx; font-weight: 750; }
.hero-desc { display: block; margin-top: 8rpx; color: rgba(255, 255, 255, .68); font-size: 26rpx; }
.hero-search { display: flex; height: 80rpx; align-items: center; gap: 14rpx; margin-top: 32rpx; padding: 0 28rpx; border-radius: 40rpx; background: rgba(255, 255, 255, .96); color: var(--c-text-3); font-size: 26rpx; }
.search-icon { font-size: 34rpx; }
.metrics { display: flex; margin-top: 28rpx; }
.metric { display: flex; flex: 1; align-items: center; flex-direction: column; gap: 4rpx; }
.metric + .metric { border-left: 1rpx solid rgba(255, 255, 255, .16); }
.metric-value { font-family: "DIN Alternate", "Helvetica Neue", Arial, sans-serif; font-size: 38rpx; font-weight: 700; }
.metric-label { color: rgba(255, 255, 255, .64); font-size: 24rpx; }
.body { position: relative; margin-top: -40rpx; }
.entry-card { padding: 32rpx 16rpx; }
.product { display: flex; align-items: center; gap: 20rpx; min-height: 120rpx; padding: 16rpx 0; border-top: 1rpx solid var(--c-line); }
.product:first-of-type { border-top: 0; }
.product .glyph { width: 80rpx; height: 80rpx; font-size: 30rpx; }
.product-name { display: block; margin-bottom: 6rpx; font-size: 28rpx; font-weight: 600; }
.product .tiny { display: block; }
.product-price { flex-shrink: 0; text-align: right; }
.product-price text { display: block; }
.demand { padding: 20rpx 0; border-top: 1rpx solid var(--c-line); }
.demand:first-of-type { border-top: 0; }
.demand-name { min-width: 0; flex: 1; font-size: 28rpx; font-weight: 600; }
.demand-line { display: block; margin-top: 8rpx; }
.demand-foot { margin-top: 10rpx; }
.load-error.inline { margin: 0; padding: 32rpx 16rpx; }
</style>
