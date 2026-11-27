<template>
  <view class="page products-page">
    <view class="top-bar">
      <view class="filter-row">
        <text v-for="tab in tabs" :key="tab.value" class="filter-chip" :class="{ active: filter === tab.value }" @tap="filter = tab.value">
          {{ tab.label }} {{ tab.count }}
        </text>
      </view>
      <button class="btn btn-sm btn-primary pool-button" @tap="goPool">+ 选品</button>
    </view>

    <view v-if="loadError" class="card" role="alert"><text>货架刷新失败，请检查网络后重试。</text><button class="btn" :disabled="loading" @tap="load">重新加载货架</button></view>
    <view v-if="loading && !products.length" class="loading">正在加载货架商品…</view>
    <view v-else-if="filtered.length" class="product-list">
      <view v-for="item in filtered" :key="item.id" class="product-card" :class="{ off: isOff(item) }">
        <view class="product-main">
          <image v-if="firstImage(item.images)" class="product-image" :src="firstImage(item.images)" mode="aspectFill" />
          <view v-else class="product-image product-placeholder">丰</view>
          <view class="product-body">
            <text class="product-name">{{ item.name }}</text>
            <text class="product-point">{{ item.supplierName || item.sellingPoint }}</text>
            <view class="tags">
              <text class="tag" :class="isOff(item) ? 'tag-gray' : 'tag-green'">{{ isOff(item) ? '已下架' : '在架' }}</text>
              <text class="tag tag-orange">佣金 {{ item.commissionRate || 0 }}%</text>
              <text class="tag tag-gray">库存 {{ item.stock }}</text>
            </view>
            <view class="price-row">
              <view><text class="price">{{ money(item.effectivePrice ?? item.price) }}</text><text class="price-label">{{ item.retailPrice ? '本店零售价' : '按供货价销售' }}</text></view>
              <view class="supply"><text>供货价 {{ money(item.price) }}</text><text>销量 {{ item.sales || 0 }}</text></view>
            </view>
          </view>
        </view>
        <view class="product-actions">
          <text class="limit-copy">{{ limitText(item) }}</text>
          <button class="btn btn-sm" :disabled="busyId !== null" @tap="editPrice(item)">改价</button>
          <button class="btn btn-sm" :class="isOff(item) ? 'btn-primary' : 'btn-ghost'" :loading="busyId === item.id" :disabled="busyId !== null" @tap="toggleShelf(item)">
            {{ isOff(item) ? '上架' : '下架' }}
          </button>
        </view>
      </view>
    </view>
    <view v-else-if="!loadError" class="empty">
      <view class="empty-icon">架</view>
      <text>{{ products.length ? '没有这一类商品' : '货架还没有商品' }}</text>
      <button class="btn btn-sm btn-primary empty-button" @tap="goPool">去选品中心</button>
    </view>
    <view class="card"><text class="small-copy">当前页 {{products.length}} 件，共 {{total}} 件；上方筛选作用于当前页</text><view class="product-actions"><button class="btn" :disabled="loading || pageNo<=1" @tap="changePage(-1)">上一页</button><text>{{pageNo}}</text><button class="btn" :disabled="loading || pageNo*20>=total" @tap="changePage(1)">下一页</button></view></view>
    <MobileInputSheet :show="!!priceItem" title="设置本店零售价" :description="priceItem ? priceItem.name + ' · ' + limitText(priceItem) : ''" placeholder="留空恢复供货价" input-type="digit" :initial-value="priceItem?.retailPrice != null ? String(priceItem.retailPrice) : ''" :busy="busyId !== null" :error="priceError" @close="priceItem = null" @submit="savePrice" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MobileInputSheet from '../../components/MobileInputSheet.vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type Product } from '../../api'
import { currentChannelId } from '../../session'
import { confirmAction, firstImage, money, toast } from '../../utils'

const priceItem = ref<Product | null>(null)
const priceError = ref('')
const products = ref<Product[]>([])
const loading = ref(false)
const loadError = ref(false)
const filter = ref('')
const pageNo=ref(1),total=ref(0)
const busyId = ref<number | null>(null)

const isOff = (item: Product) => String(item.shelfStatus || 'ON').toUpperCase() === 'OFF'
const tabs = computed(() => [
  { label: '全部', value: '', count: products.value.length },
  { label: '在架', value: 'ON', count: products.value.filter((item) => !isOff(item)).length },
  { label: '已下架', value: 'OFF', count: products.value.filter(isOff).length },
])
const filtered = computed(() => {
  if (filter.value === 'ON') return products.value.filter((item) => !isOff(item))
  if (filter.value === 'OFF') return products.value.filter(isOff)
  return products.value
})

onShow(load)
onPullDownRefresh(load)

async function load() {
  const channelId = currentChannelId()
  if (!channelId) return uni.stopPullDownRefresh()
  loading.value = true
  loadError.value = false
  try {
    const result = await channelApi.getProducts(channelId, { page: pageNo.value, size: 20 })
    products.value = result.records || []
    total.value = Number(result.total || 0)
  } catch (error) {
    loadError.value = true
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function limitText(item: Product) {
  const min = item.minRetailPrice != null ? Number(item.minRetailPrice) : Number(item.price)
  if (item.maxRetailPrice != null) return `可售价 ${money(min)} ~ ${money(item.maxRetailPrice)}`
  return `零售价不低于 ${money(min)}`
}

async function update(item: Product, params: { retailPrice?: string; shelfStatus?: 'ON' | 'OFF' }, done: string) {
  if (busyId.value !== null) return
  busyId.value = item.id
  try {
    const result = await channelApi.updateListing(item.id, params)
    if (!result.success) throw new Error(result.message || '更新失败')
    priceItem.value = null
    toast(done, 'success')
    await load()
  } catch (error) {
    priceError.value = (error as Error).message
    toast(priceError.value)
  } finally {
    busyId.value = null
  }
}

function editPrice(item: Product) {
  if (busyId.value !== null) return
  priceError.value = ''
  priceItem.value = item
}
async function savePrice(value: string) {
  const item = priceItem.value
  if (!item || busyId.value !== null) return
  const amount = Number(value)
  const min = Number(item.minRetailPrice ?? item.price)
  if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || amount < min || (item.maxRetailPrice != null && amount > Number(item.maxRetailPrice)))) {
    priceError.value = `请输入范围内的金额，最多两位小数。${limitText(item)}`
    return
  }
  priceError.value = ''
  await update(item, { retailPrice: value ? amount.toFixed(2) : '' }, value ? '零售价已更新' : '已恢复按供货价')
}

async function toggleShelf(item: Product) {
  const next = isOff(item) ? 'ON' : 'OFF'
  if (next === 'OFF' && !await confirmAction('下架商品', `下架后客户在本店看不到「${item.name}」，随时可以重新上架。`)) return
  await update(item, { shelfStatus: next }, next === 'ON' ? '已上架' : '已下架')
}

function changePage(n:number){pageNo.value+=n;load()}
function goPool() {
  uni.navigateTo({ url: '/pages/pool/index' })
}
</script>

<style scoped lang="scss">
.products-page { padding-bottom: 28rpx; }
.top-bar { display: flex; align-items: center; gap: 12rpx; padding: 18rpx 22rpx; background: #fff; }
.filter-row { display: flex; flex: 1; gap: 10rpx; }
.filter-chip { padding: 10rpx 20rpx; border: 1rpx solid #e3eae5; border-radius: 999rpx; color: #666666; font-size: 24rpx; }
.filter-chip.active { border-color: #12764a; background: #e9f6ee; color: #0e5233; font-weight: 700; }
.pool-button { flex-shrink: 0; min-height: 64rpx; }
.loading { padding: 90rpx 0; color: #666666; text-align: center; }
.product-list { padding: 18rpx 22rpx 0; }
.product-card { margin-bottom: 16rpx; padding: 20rpx; border: 1rpx solid #e3eae5; border-radius: 22rpx; background: #fff; }
.product-card.off .product-image { opacity: .5; }
.product-main { display: flex; gap: 18rpx; }
.product-image, .product-placeholder { width: 168rpx; height: 168rpx; flex: 0 0 168rpx; border-radius: 16rpx; }
.product-image { background: #eef7f1; }
.product-placeholder { display: grid; place-items: center; background: #edf7f1; color: rgba(18,118,74,.2); font-size: 56rpx; font-weight: 800; }
.product-body { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.product-name { overflow: hidden; color: #0b1a12; font-size: 28rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.product-point { margin-top: 4rpx; overflow: hidden; color: #666666; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 10rpx; }
.price-row { display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; padding-top: 10rpx; }
.price-row .price { font-size: 32rpx; }
.price-label { display: block; color: #666666; font-size: 24rpx; }
.supply { display: flex; align-items: flex-end; flex-direction: column; color: #666666; font-size: 24rpx; }
.product-actions { display: flex; align-items: center; gap: 12rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid #edf2ee; }
.limit-copy { min-width: 0; flex: 1; color: #666666; font-size: 24rpx; }
.product-actions .btn { min-width: 120rpx; min-height: 60rpx; }
.empty-button { margin-top: 14rpx; }
.top-bar { position:sticky;z-index:12;flex-wrap:wrap; }.filter-row { min-width:0; }.filter-chip { flex:1;padding:8rpx 12rpx;white-space:nowrap; }.pool-button { width:100%; }.product-image,.product-placeholder { width:132rpx;height:132rpx;flex-basis:132rpx; }.product-name { white-space:normal;line-height:1.5; }.price-row { align-items:flex-start;flex-direction:column;gap:8rpx; }.supply { flex-direction:row;gap:16rpx; }.product-actions { flex-wrap:wrap; }.limit-copy { flex-basis:100%; }.product-actions .btn { flex:1; }.tags { gap:8rpx; }
</style>
