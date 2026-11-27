<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { API_ORIGIN, requireTradeLogin, getTradeRole, requireTradeRole } from '../../auth'
import { money, request, tradeApi, type TradeProduct } from '../../api'

const role = ref(getTradeRole())
onShow(() => { role.value=getTradeRole() })
const product = ref<TradeProduct | null>(null)
const loading = ref(true)
const loadError = ref('')
const acting = ref('')
let productId = 0
const images = computed(() => ((product.value as any)?.images || []).map((url: string) => url.startsWith('/') ? API_ORIGIN + url : url) as string[])
const skus = computed(() => product.value?.skus?.filter(s => s.status === 1) || [])
const priceText = computed(() => {
  const p = product.value
  if (!p) return ''
  if (p.price != null) return money(p.price)
  if (p.priceMin != null && p.priceMax != null && p.priceMin !== p.priceMax) return `${money(p.priceMin)}–${money(p.priceMax)}`
  return money(p.priceMin ?? p.priceMax)
})

const detailLabels: Record<string, string> = {
  categoryName: '品类', variety: '品种', specification: '规格', specLevel: '规格等级', specSize: '规格描述',
  originProvince: '产地省份', originCity: '产地城市', originDistrict: '产地区县', originAddress: '详细产地',
  qualityLevel: '质量等级', harvestBatchNo: '采收批次', publishStatus: '上架状态', certifications: '认证资料',
  qualityReportUrl: '质检报告', videoUrl: '商品视频', barcode: '商品条码', description: '商品说明',
}
const enumLabels: Record<string, string> = {
  published: '已上架', draft: '草稿', active: '生效', inactive: '已停用', enabled: '已启用', disabled: '已停用',
  ONLINE: '已上架', OFFLINE: '已下架', true: '是', false: '否',
}

function readable(value: unknown, key = ''): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const text = value.trim()
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try { return readable(JSON.parse(text), key) } catch { return text }
    }
    if (/Url$/i.test(key) && /^https?:\/\//i.test(text)) return '已配置'
    return enumLabels[text] || text
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.map(item => readable(item, key)).filter(Boolean).join('、') : '暂无'
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item != null && item !== '')
      .map(([itemKey, item]) => `${detailLabels[itemKey] || '其他信息'}：${readable(item, itemKey)}`)
      .join('；')
  }
  return String(value)
}

const descriptionText = computed(() => readable((product.value as any)?.description) || '品质农产品，支持交易撮合询价与订单履约。')
const detailRows = computed(() => {
  const p = product.value as any
  if (!p) return []
  return Object.keys(detailLabels)
    .filter(key => p[key] != null && p[key] !== '' && key !== 'description')
    .map(key => ({ label: detailLabels[key], value: readable(p[key], key) }))
    .filter(row => row.value)
})

onLoad((options?: Record<string, string>) => { productId = Number(options?.id); void load() })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    if (!Number.isFinite(productId) || productId <= 0) throw new Error('商品链接无效，请返回交易大厅重新选择')
    product.value = await tradeApi.product(productId)
    if (!product.value) throw new Error('商品不存在或已下架')
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '商品加载失败'
  } finally {
    loading.value = false
  }
}

function preview(index: number) { uni.previewImage({ urls: images.value, current: index }) }
function inquire() { if (requireTradeRole('buyer') && requireTradeLogin()) uni.navigateTo({ url: '/pages/buyer/inquiry?productId=' + product.value?.id }) }
function checkout() { if (requireTradeRole('buyer') && requireTradeLogin()) uni.navigateTo({ url: '/pages/checkout/index?id=' + product.value?.id }) }
async function interact(type: 'favorite' | 'follow' | 'chat') {
  if (!requireTradeRole('buyer') || acting.value || !requireTradeLogin() || !product.value) return
  acting.value = type
  try {
    if (type === 'chat') {
      await request('/shop-interactions/negotiations/open', 'POST', { sellerId: product.value.sellerId, productId: product.value.id })
      uni.navigateTo({ url: '/pages/collaboration/chat' })
    } else {
      await request(type === 'favorite' ? '/shop-interactions/favorites/products/' + product.value.id : '/shop-interactions/follow/' + product.value.sellerId, 'POST')
      uni.showToast({ title: type === 'favorite' ? '已收藏' : '已关注', icon: 'success' })
    }
  } catch (e) { uni.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' }) }
  finally { acting.value = '' }
}
</script>

<template>
  <view class="page" :class="{ 'with-bar': product && !loadError }">
    <view v-if="loading" class="loading">正在加载商品…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载商品</button></view>
    <template v-else-if="product">
      <swiper v-if="images.length" class="gallery" indicator-dots indicator-active-color="#12764a" circular>
        <swiper-item v-for="(url, i) in images" :key="url"><image class="gallery-img" :src="url" mode="aspectFill" @tap="preview(i)" /></swiper-item>
      </swiper>
      <view v-else class="gallery placeholder"><text>{{ product.productName?.slice(0, 1) || '农' }}</text></view>

      <view class="card">
        <view class="price-row"><text class="price big">{{ priceText }}</text><text class="tiny">/{{ product.unit }}</text></view>
        <text class="title">{{ product.productName }}</text>
        <text v-if="product.variety || product.specification" class="muted">{{ [product.variety, product.specification].filter(Boolean).join(' · ') }}</text>
        <view class="chips-row">
          <text class="tag">{{ product.categoryName || '农产品' }}</text>
          <text class="tag amber">起订 {{ product.minOrderQuantity || 1 }} {{ product.unit }}</text>
          <text class="tag blue">库存 {{ product.stockQuantity || 0 }} {{ product.unit }}</text>
        </view>
      </view>

      <view class="card seller" @tap="role === 'buyer' && interact('follow')">
        <view class="glyph">{{ (product.sellerName || '供').slice(0, 1) }}</view>
        <view class="grow"><text class="seller-name ellipsis">{{ product.sellerName || '认证供应商' }}</text><text class="tiny">{{ [product.originProvince, product.originCity].filter(Boolean).join(' ') || '产地直供' }}</text></view>
        <text v-if="role === 'buyer'" class="btn btn-line btn-sm">{{ acting === 'follow' ? '处理中…' : '关注' }}</text>
      </view>

      <view v-if="skus.length" class="card">
        <text class="card-title">可选规格</text>
        <view v-for="sku in skus" :key="sku.id" class="kv"><text class="kv-label">{{ sku.skuName }}</text><text class="kv-value">{{ money(sku.price) }}/{{ sku.unit }} · 库存 {{ sku.stockQuantity }}</text></view>
      </view>

      <view v-if="detailRows.length" class="card">
        <text class="card-title">商品信息</text>
        <view v-for="row in detailRows" :key="row.label" class="kv">
          <text class="kv-label">{{ row.label }}</text>
          <text class="kv-value">{{ row.value }}</text>
        </view>
      </view>

      <view class="card">
        <text class="card-title">商品说明</text>
        <text class="description">{{ descriptionText }}</text>
      </view>

      <view v-if="role === 'buyer'" class="bottom-bar">
        <view class="mini-action" @tap="interact('chat')"><text class="mini-icon">聊</text><text>洽谈</text></view>
        <view class="mini-action" @tap="interact('favorite')"><text class="mini-icon">藏</text><text>收藏</text></view>
        <button class="btn btn-ghost" @tap="inquire">询价</button>
        <button class="btn btn-primary" @tap="checkout">立即采购</button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.gallery { overflow: hidden; height: 520rpx; margin-bottom: 20rpx; border-radius: 24rpx; background: #fff; }
.gallery-img { width: 100%; height: 100%; }
.gallery.placeholder { display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #e8f6ee, #cfe9d9); color: var(--c-primary-dark); font-size: 120rpx; font-weight: 700; }
.price-row { display: flex; align-items: baseline; gap: 6rpx; }
.price.big { font-size: 44rpx; }
.title { display: block; margin-top: 12rpx; font-size: 34rpx; font-weight: 700; line-height: 1.4; }
.card > .muted { display: block; margin-top: 8rpx; }
.chips-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 20rpx; }
.seller { display: flex; align-items: center; gap: 20rpx; }
.seller .glyph { width: 80rpx; height: 80rpx; font-size: 30rpx; }
.seller-name { display: block; font-size: 28rpx; font-weight: 600; }
.seller .tiny { display: block; }
.card-title { display: block; }
.description { display: block; margin-top: 16rpx; color: var(--c-text-2); font-size: 28rpx; line-height: 1.75; white-space: pre-wrap; }
.mini-action { display: flex; flex-shrink: 0; align-items: center; flex-direction: column; justify-content: center; width: 88rpx; min-height: 88rpx; color: var(--c-text-2); font-size: 24rpx; }
.mini-icon { font-size: 30rpx; font-weight: 700; color: var(--c-primary); }
.bottom-bar .btn { flex: 1; }

/* 收尾复验发现的布局与详情控件修正。 */
.mini-action { min-width:48px; min-height:48px; }
</style>
