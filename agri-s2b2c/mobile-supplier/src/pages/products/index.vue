<template>
  <view class="page products-page">
    <view class="page-top">
      <view>
        <text class="kicker">PRODUCT MANAGEMENT</text>
        <text class="title">商品管理</text>
      </view>
      <button class="btn btn-sm btn-primary" @tap="openEditor()">发布商品</button>
    </view>
    <view class="search-card">
      <view class="search-box">
        <text>⌕</text>
        <input v-model="keyword" placeholder="搜索商品名称" confirm-type="search" @confirm="search" />
      </view>
      <scroll-view scroll-x :show-scrollbar="false" class="status-scroll">
        <view class="status-row">
          <view v-for="item in statuses" :key="item.value" class="status-chip" :class="{ active: status === item.value }" @tap="changeStatus(item.value)">
            {{ item.label }}
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="loading" class="loading">正在加载商品…</view>
    <view v-else-if="filteredProducts.length" class="product-list">
      <view v-for="item in filteredProducts" :key="item.id" class="product-card">
        <image v-if="firstImage(item.images)" class="product-image" :src="firstImage(item.images)" mode="aspectFill" />
        <view v-else class="product-image product-placeholder">丰</view>
        <view class="product-body">
          <view class="product-head">
            <text class="product-name">{{ item.name }}</text>
            <text class="tag" :class="`tag-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</text>
          </view>
          <text class="product-point">{{ item.sellingPoint }}</text>
          <view class="product-tags"><text class="tag tag-gray">{{ item.categoryName || '未分类' }}</text><text class="tag tag-green">{{ item.spec }}</text></view>
          <view class="product-stats">
            <view><small class="small-copy">售价</small><b>{{ money(item.price) }}</b></view>
            <view><small class="small-copy">库存</small><b>{{ item.stock }}</b></view>
            <view><small class="small-copy">销量</small><b>{{ item.sales || 0 }}</b></view>
          </view>
          <view class="product-actions">
            <button class="btn btn-sm" @tap="openEditor(item.id)">编辑商品</button>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="empty">
      <view class="empty-icon">品</view>
      <text>暂无商品</text>
      <button class="btn btn-ghost btn-sm empty-button" @tap="openEditor()">发布第一件商品</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { supplierApi, type Product } from '../../api'
import { requireSupplierLogin, supplierSession } from '../../session'
import { firstImage, money, statusMeta, toast } from '../../utils'

const statuses = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
]
const keyword = ref('')
const status = ref('')
const products = ref<Product[]>([])
const loading = ref(false)
const filteredProducts = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return products.value
  return products.value.filter((item) => item.name.toLowerCase().includes(text))
})

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireSupplierLogin()) return
  loading.value = true
  try {
    const result = await supplierApi.getProducts({
      supplierId: supplierSession.account?.id || 1,
      page: 1,
      size: 50,
      status: status.value,
    })
    products.value = result.records || []
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function changeStatus(value: string) {
  status.value = value
  load()
}

function search() {
  // 本地筛选，便于小程序端即时响应；状态筛选仍请求后端。
}

function openEditor(id?: number) {
  uni.navigateTo({ url: id ? `/pages/products/edit?id=${id}` : '/pages/products/edit' })
}
</script>

<style scoped lang="scss">
.products-page {
  padding-bottom: 28rpx;
}

.page-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 24rpx 22rpx 16rpx;
}

.page-top .kicker,
.page-top .title {
  display: block;
}

.page-top .kicker {
  color: #12764a;
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.page-top .title {
  margin-top: 4rpx;
  color: #0b1a12;
  font-size: 34rpx;
  font-weight: 800;
}

.search-card {
  margin: 0 22rpx;
  padding: 14rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 20rpx;
  background: #fff;
}

.search-box {
  display: flex;
  height: 70rpx;
  align-items: center;
  gap: 10rpx;
  padding: 0 17rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 14rpx;
}

.search-box text {
  color: #52665a;
  font-size: 29rpx;
}

.search-box input {
  flex: 1;
  font-size: 23rpx;
}

.status-scroll {
  width: 100%;
  margin-top: 12rpx;
  white-space: nowrap;
}

.status-row {
  display: inline-flex;
  gap: 9rpx;
}

.status-chip {
  padding: 8rpx 20rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 999rpx;
  color: #718277;
  font-size: 19rpx;
}

.status-chip.active {
  border-color: #12764a;
  background: #e9f6ee;
  color: #0e5233;
  font-weight: 700;
}

.loading {
  padding: 90rpx 0;
  color: #84938a;
  text-align: center;
}

.product-list {
  padding: 16rpx 22rpx 0;
}

.product-card {
  display: flex;
  gap: 16rpx;
  margin-bottom: 14rpx;
  padding: 18rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 21rpx;
  background: #fff;
}

.product-image,
.product-placeholder {
  width: 180rpx;
  height: 190rpx;
  flex: 0 0 180rpx;
  border-radius: 16rpx;
}

.product-image {
  background: #eef7f1;
}

.product-placeholder {
  display: grid;
  place-items: center;
  background: #edf7f1;
  color: rgba(18,118,74,.16);
  font-size: 60rpx;
  font-weight: 800;
}

.product-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.product-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8rpx;
}

.product-name {
  min-width: 0;
  flex: 1;
  color: #0b1a12;
  font-size: 23rpx;
  font-weight: 700;
}

.product-point {
  margin-top: 6rpx;
  overflow: hidden;
  color: #84938a;
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-tags {
  display: flex;
  gap: 7rpx;
  margin-top: 10rpx;
}

.product-stats {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 12rpx;
}

.product-stats .small-copy,
.product-stats b {
  display: block;
}

.product-stats .small-copy {
  color: #93a29a;
  font-size: 15rpx;
}

.product-stats b {
  margin-top: 3rpx;
  color: #33453b;
  font-size: 20rpx;
}

.product-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10rpx;
}

.empty-button {
  margin-top: 14rpx;
}
</style>
