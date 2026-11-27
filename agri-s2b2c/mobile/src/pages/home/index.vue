<template>
  <view class="page home-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="topbar">
      <view class="brand">
        <image class="brand-mark" src="/static/fengchain.svg" mode="aspectFill" />
        <view class="brand-copy">
          <text class="brand-name">丰链云</text>
          <text class="brand-sub">产地直供</text>
        </view>
      </view>
      <view class="topbar-actions">
        <view class="online"><text class="online-dot" />品质在线</view>
        <view class="round-button" @tap="openServices">券</view>
      </view>
    </view>

    <view class="home-content">
      <view class="search-box" @tap="goSearch">
        <text class="search-icon">⌕</text>
        <text>搜索农产品</text>
        <text class="search-action">搜索</text>
      </view>

      <view class="season-banner" @tap="goCategory(0)"><view><text class="season-title">当季好物，新鲜到家</text><text class="season-caption">产地直供 · 查看商品溯源</text></view><text class="season-link">去选购 ›</text></view>

      <view class="section-head">
        <view><text class="section-kicker">FARM CATEGORY</text><text class="section-title">源头分类</text></view>
        <text class="section-link" @tap="goCategoryPage">全部商品 →</text>
      </view>
      <view class="category-grid">
        <view v-for="item in categories" :key="item.id" class="category-card" @tap="goCategory(item.id)">
          <view class="category-icon">{{ item.icon }}</view>
          <text class="category-name">{{ item.name }}</text>
          <text class="category-sub">{{ item.sub }}</text>
        </view>
      </view>

      <view v-if="channels.length" class="channel-sec">
        <view class="section-head">
          <view><text class="section-kicker">CHANNEL SHOPS</text><text class="section-title">渠道好店</text></view>
          <text class="section-link">{{ channels.length }} 家</text>
        </view>
        <scroll-view scroll-x class="channel-scroll">
          <view class="channel-row-m">
            <view v-for="c in channels" :key="c.id" class="channel-card-m" @tap="openChannel(c.id)">
              <image v-if="c.shopLogo" class="channel-logo-m" :src="c.shopLogo" mode="aspectFill" />
              <view v-else class="channel-logo-m fallback">{{ (c.shopName || '渠').slice(0, 1) }}</view>
              <text class="channel-name-m">{{ c.shopName }}</text>
              <text class="channel-meta-m">{{ c.productCount || 0 }} 款在售</text>
              <text v-if="c.minPrice" class="channel-price-m">低至 {{ money(c.minPrice) }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="selection-head">
        <view><text class="section-kicker">SEASONAL SELECTION</text><text class="section-title">当季精选</text></view>
        <text class="section-link">产地好货 · 平台认证</text>
      </view>
      <view v-if="loading" class="loading">正在挑选产地好货…</view>
      <view v-else-if="products.length" class="product-grid">
        <view v-for="item in products" :key="item.id" class="product-card" @tap="openProduct(item)">
          <image v-if="firstImage(item.images)" class="product-image" :src="firstImage(item.images)" mode="aspectFill" />
          <view v-else class="product-placeholder">丰</view>
          <view class="product-body">
            <text class="product-name">{{ item.name }}</text>
            <text class="product-point">{{ item.sellingPoint }}</text>
            <view class="product-meta">
              <text class="product-price">{{ money(item.price) }}</text>
              <text class="product-sales">已售 {{ item.sales }}</text>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="empty">
        <view class="empty-icon">丰</view>
        <text>暂无在售商品</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { mallApi, type ChannelShop, type Product } from '../../api'
import { firstImage, money, openProduct, toast } from '../../utils'
import { ref } from 'vue'

const statusBarHeight = ref(uni.getSystemInfoSync().statusBarHeight || 0)
const loading = ref(false)
const products = ref<Product[]>([])
const channels = ref<ChannelShop[]>([])
const categories = ref([{ id:0, name:'全部商品', sub:'更多好物', icon:'丰' }])

onMounted(loadProducts)

async function loadProducts() {
  loading.value = true
  try {
    const [result, shops, tree] = await Promise.all([
      mallApi.getProducts({ page: 1, size: 10 }),
      mallApi.getChannels({ limit: 8 }).catch(() => []),
      mallApi.getCategories(),
    ])
    products.value = result.records || []
    channels.value = shops || []
    categories.value = [...tree.slice(0,5).map(c=>({id:c.id,name:c.name,sub:'查看商品',icon:'丰'})),{id:0,name:'全部商品',sub:'更多好物',icon:'全'}]
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openChannel(id: string | number) {
  uni.navigateTo({ url: `/pages/channel/index?channelId=${id}` })
}

function goSearch() {
  uni.setStorageSync('s2b2c_search_focus', true)
  uni.switchTab({ url: '/pages/category/index' })
}

function goCategoryPage() {
  uni.switchTab({ url: '/pages/category/index' })
}

function goCategory(id: number) {
  uni.setStorageSync('s2b2c_pending_category', id)
  uni.switchTab({ url: '/pages/category/index' })
}

function openServices() {
  uni.navigateTo({ url: '/pages/services/index' })
}

onPullDownRefresh(loadProducts)
</script>

<style scoped lang="scss">
.channel-sec { margin-top: 8rpx; }
.channel-scroll { white-space: nowrap; }
.channel-row-m { display: inline-flex; gap: 18rpx; padding: 0 24rpx 8rpx; }
.channel-card-m { display: inline-flex; width: 250rpx; flex-direction: column; gap: 8rpx; padding: 20rpx; border: 1rpx solid #e3eae5; border-radius: 22rpx; background: #fff; }
.channel-logo-m { width: 72rpx; height: 72rpx; border-radius: 16rpx; background: #e5f5eb; flex-shrink: 0; }
.channel-logo-m.fallback { display: grid; place-items: center; color: #12764a; font-size: 30rpx; font-weight: 800; }
.channel-name-m { overflow: hidden; color: #0b1a12; font-size: 26rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.channel-meta-m { color: #666666; font-size: 24rpx; }
.channel-price-m { color: #e53935; font-size: 32rpx; font-weight: 700; }

.home-page {
  padding-bottom: 32rpx;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  height: 94rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #e6ede8;
  background: rgba(255, 255, 255, 0.97);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.brand-mark {
  display: grid;
  width: 62rpx;
  height: 62rpx;
  place-items: center;
  border-radius: 18rpx;
  background: linear-gradient(145deg, #159a5e, #12764a);
  color: #fff;
  font-size: 32rpx;
  font-weight: 800;
  box-shadow: 0 10rpx 24rpx rgba(18, 118, 74, 0.2);
}

.brand-copy text {
  display: block;
}

.brand-name {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.15;
}

.brand-sub {
  margin-top: 3rpx;
  color: #666666;
  font-size: 24rpx;
  letter-spacing: 1rpx;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.online {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #666666;
  font-size: 24rpx;
}

.online-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #159a5e;
  box-shadow: 0 0 0 7rpx rgba(21, 154, 94, 0.1);
}

.round-button {
  display: grid;
  width: 60rpx;
  height: 60rpx;
  place-items: center;
  border: 1rpx solid #dce7df;
  border-radius: 16rpx;
  background: #fff;
  color: #0e5233;
  font-size: 24rpx;
  font-weight: 700;
}

.home-content {
  padding: 20rpx 22rpx 0;
}

.search-box {
  display: flex;
  height: 78rpx;
  align-items: center;
  gap: 12rpx;
  padding: 0 18rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 18rpx;
  background: #fff;
  color: #666666;
  font-size: 24rpx;
}

.search-icon {
  color: #52665a;
  font-size: 34rpx;
  line-height: 1;
}

.search-action {
  margin-left: auto;
  color: #12764a;
  font-weight: 600;
}

.hero {
  position: relative;
  min-height: 370rpx;
  margin-top: 18rpx;
  overflow: hidden;
  padding: 48rpx 40rpx 34rpx;
  border-radius: 26rpx;
  background:
    radial-gradient(circle at 88% 8%, rgba(110, 231, 162, 0.18), transparent 44%),
    linear-gradient(135deg, #06281a, #0d5d3b);
  color: #fff;
}

.hero-orbit {
  position: absolute;
  border: 1rpx solid rgba(159, 231, 184, 0.12);
  border-radius: 50%;
  pointer-events: none;
}

.hero-orbit-one {
  top: -220rpx;
  right: -180rpx;
  width: 620rpx;
  height: 620rpx;
}

.hero-orbit-two {
  right: -80rpx;
  bottom: -280rpx;
  width: 520rpx;
  height: 520rpx;
}

.hero-kicker {
  position: relative;
  color: #a9dfbd;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.hero-title {
  position: relative;
  display: block;
  margin-top: 22rpx;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.35;
}

.hero-desc {
  position: relative;
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.68);
  font-size: 24rpx;
}

.hero-button {
  position: relative;
  display: inline-flex;
  height: 66rpx;
  align-items: center;
  gap: 10rpx;
  margin-top: 28rpx;
  padding: 0 22rpx;
  border-radius: 14rpx;
  background: #fff;
  color: #0e5233;
  font-size: 24rpx;
  font-weight: 700;
}

.hero-page {
  position: absolute;
  right: 28rpx;
  bottom: 22rpx;
  display: flex;
  gap: 9rpx;
}

.hero-page text {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.42);
}

.hero-page .active {
  width: 28rpx;
  border-radius: 10rpx;
  background: #9fe7b8;
}

.trust-row {
  display: flex;
  gap: 10rpx;
  margin-top: 14rpx;
}

.trust-item {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10rpx;
  padding: 18rpx 12rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 18rpx;
  background: #fff;
}

.trust-mark {
  display: grid;
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 42rpx;
  place-items: center;
  border-radius: 12rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 24rpx;
  font-weight: 800;
}

.trust-item .strong-copy,
.trust-item .small-copy {
  display: block;
}

.trust-item .strong-copy {
  color: #0e5233;
  font-size: 24rpx;
}

.trust-item .small-copy {
  margin-top: 3rpx;
  color: #666666;
  font-size: 24rpx;
  white-space: nowrap;
  transform: scale(0.92);
  transform-origin: left center;
}

.section-head,
.selection-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 34rpx 0 16rpx;
}

.section-kicker,
.section-title {
  display: block;
}

.section-kicker {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.section-title {
  margin-top: 5rpx;
  color: #0b1a12;
  font-size: 34rpx;
  font-weight: 800;
}

.section-link {
  color: #666666;
  font-size: 24rpx;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.category-card {
  width: calc((100% - 24rpx) / 3);
  padding: 20rpx 10rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 18rpx;
  background: #fff;
  text-align: center;
}

.category-icon {
  font-size: 42rpx;
}

.category-name,
.category-sub {
  display: block;
}

.category-name {
  margin-top: 7rpx;
  color: #33453b;
  font-size: 24rpx;
  font-weight: 650;
}

.category-sub {
  margin-top: 3rpx;
  color: #9aa69f;
  font-size: 24rpx;
}

.loading {
  padding: 70rpx 0;
  color: #666666;
  font-size: 24rpx;
  text-align: center;
}

.product-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.product-card {
  width: calc((100% - 14rpx) / 2);
  overflow: hidden;
  border: 1rpx solid #e3eae5;
  border-radius: 20rpx;
  background: #fff;
}

.product-image,
.product-placeholder {
  width: 100%;
  height: 300rpx;
}

.product-image {
  background: #eef7f1;
}

.product-placeholder {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f2fbf6, #e1f0e7);
  color: rgba(18, 118, 74, 0.12);
  font-size: 90rpx;
  font-weight: 800;
}

.product-body {
  padding: 16rpx 16rpx 18rpx;
}

.product-name,
.product-point {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-name {
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.product-point {
  margin-top: 8rpx;
  color: #666666;
  font-size: 24rpx;
}

.product-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 17rpx;
}

.product-price {
  color: #e53935;
  font-size: 32rpx;
 font-weight:700;}

.product-sales {
  color: #666666;
  font-size: 24rpx;
}

.season-banner { display:flex; align-items:center; justify-content:space-between; gap:16rpx; margin:18rpx 0 6rpx; padding:24rpx; border-radius:20rpx; background:#e5f1e8; }
.season-title,.season-caption { display:block; }.season-title { font-size:32rpx; font-weight:750; color:#164a30; }.season-caption { margin-top:8rpx; font-size:24rpx; color:#666666; }.season-link { flex-shrink:0; font-size:26rpx; color:#12764a; }
.category-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8rpx; }.category-card { min-height:110rpx; padding:14rpx 6rpx; background:transparent; border:none; }.category-sub { display:none; }.category-icon { width:64rpx; height:64rpx; margin:0 auto 8rpx; font-size:36rpx; }.section-head,.selection-head { padding-top:20rpx; }.round-button { min-width:44px; min-height:44px; }.channel-card-m { width:220rpx; padding:16rpx; }.channel-logo-m { width:56rpx;height:56rpx; }.channel-row-m { padding-left:0; }.product-name { white-space:normal; line-height:1.5; }


/* 2026-11-20：逐页实测控件的48px触控区。 */
.round-button, .search-box { min-width:48px; min-height:48px; }
.category-card { width:auto; min-width:48px; justify-self:stretch; }
.category-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
</style>
