<template>
  <view class="page detail-page">
    <view v-if="loading" class="loading">正在加载商品…</view>
    <template v-else-if="product">
      <view class="gallery">
        <swiper class="gallery-swiper" indicator-dots indicator-color="rgba(255,255,255,.5)" indicator-active-color="#9fe7b8">
          <swiper-item v-for="(image, index) in product.images || []" :key="index">
            <image class="gallery-image" :src="image" mode="aspectFill" />
          </swiper-item>
        </swiper>
        <view class="gallery-watermark">丰</view>
        <text class="gallery-caption">FARM ORIGIN</text>
      </view>

      <view class="summary-card">
        <text class="eyebrow">ORIGIN VERIFIED · 产地认证</text>
        <text class="product-name">{{ product.name }}</text>
        <text class="selling-point">{{ product.sellingPoint }}</text>
        <view class="price-row">
          <text class="price">{{ money(product.price) }}</text>
          <text v-if="product.originalPrice" class="original">{{ money(product.originalPrice) }}</text>
          <text class="sales">已售 {{ product.sales }}</text>
        </view>
        <view class="cert-row">
          <text class="tag tag-green">{{ certificationsText(product.certifications) || '平台认证' }}</text>
          <text class="tag tag-gray">{{ product.categoryName }}</text>
        </view>
      </view>

      <view class="assurance-row">
        <view><b>平台保障</b><text>交易售后留痕</text></view>
        <view><b>品质溯源</b><text>全流程可查询</text></view>
        <view><b>产地直供</b><text>认证供应商供货</text></view>
      </view>

      <view class="card spec-card">
        <view class="card-head"><text class="card-title">商品详情</text><text class="card-sub">PRODUCT SPEC</text></view>
        <view class="spec-grid">
          <view class="spec-item"><text>产地</text><b>{{ product.origin || '-' }}</b></view>
          <view class="spec-item"><text>规格</text><b>{{ product.spec || '-' }}</b></view>
          <view class="spec-item"><text>等级</text><b>{{ product.grade || '-' }}</b></view>
          <view class="spec-item"><text>库存</text><b>{{ product.stock }} {{ product.unit }}</b></view>
        </view>
      </view>

      <view class="trace-card" @tap="openTrace">
        <view class="trace-mark">溯</view>
        <view class="trace-copy">
          <text class="trace-kicker">TRACEABILITY</text>
          <text class="trace-title">全链路溯源信息</text>
          <text class="trace-desc">查看种植、采收、加工质检与仓储记录</text>
        </view>
        <text class="trace-arrow">›</text>
      </view>

      <view class="card quantity-card">
        <view>
          <text class="quantity-title">购买数量</text>
          <text class="quantity-stock">库存 {{ product.stock }} {{ product.unit }}</text>
        </view>
        <view class="stepper">
          <view class="stepper-btn" :class="{ disabled: quantity <= 1 }" @tap="decrease">−</view>
          <text class="stepper-value">{{ quantity }}</text>
          <view class="stepper-btn" :class="{ disabled: quantity >= product.stock }" @tap="increase">+</view>
        </view>
      </view>
    </template>

    <view v-if="product" class="fixed-bottom detail-actions">
      <view class="cart-entry" @tap="goCart">
        <text class="cart-icon">袋</text>
        <text>购物车</text>
      </view>
      <button class="btn btn-ghost action-button" :loading="submitting" @tap="addToCart(false)">加入购物车</button>
      <button class="btn btn-primary action-button" :loading="submitting" @tap="addToCart(true)">立即购买</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { mallApi, type Product } from '../../api'
import { ensureLogin, session } from '../../session'
import { certificationsText, money, toast } from '../../utils'

const product = ref<Product | null>(null)
const loading = ref(true)
const submitting = ref(false)
const quantity = ref(1)

onLoad((options) => {
  loadProduct(String(options?.id || '1'))
})

onShareAppMessage(() => ({
  title: product.value?.name || '丰链云优选产地好货',
  path: `/pages/product/detail?id=${product.value?.id || 1}`,
}))

async function loadProduct(id: string) {
  loading.value = true
  try {
    product.value = await mallApi.getProduct(id)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function decrease() {
  if (quantity.value > 1) quantity.value -= 1
}

function increase() {
  if (product.value && quantity.value < product.value.stock) quantity.value += 1
}

async function addToCart(buyNow: boolean) {
  if (!ensureLogin() || !product.value || !session.user) return
  submitting.value = true
  try {
    const result = await mallApi.addCart(session.user.id, product.value.id, quantity.value)
    if (!result.success) throw new Error(result.message || '加入购物车失败')
    toast(result.message || '已加入购物车', 'success')
    if (buyNow) {
      uni.removeStorageSync('s2b2c_checkout_item_ids')
      setTimeout(() => uni.navigateTo({ url: '/pages/checkout/index' }), 350)
    }
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}

function goCart() {
  uni.switchTab({ url: '/pages/cart/index' })
}

function openTrace() {
  uni.navigateTo({ url: `/pages/services/index?productId=${product.value?.id || 1}` })
}
</script>

<style scoped lang="scss">
.detail-page {
  padding-bottom: calc(128rpx + env(safe-area-inset-bottom));
}

.loading {
  padding: 120rpx 0;
  color: #84938a;
  font-size: 23rpx;
  text-align: center;
}

.gallery {
  position: relative;
  height: 580rpx;
  overflow: hidden;
  background: linear-gradient(135deg, #f2fbf6, #e1f0e7);
}

.gallery-swiper,
.gallery-image {
  width: 100%;
  height: 100%;
}

.gallery-image {
  background: #eef7f1;
}

.gallery-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  color: rgba(18, 118, 74, 0.08);
  font-size: 190rpx;
  font-weight: 800;
  line-height: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.gallery-caption {
  position: absolute;
  right: 24rpx;
  bottom: 20rpx;
  z-index: 2;
  color: rgba(18, 118, 74, 0.25);
  font-size: 17rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.summary-card {
  margin: -30rpx 22rpx 0;
  padding: 28rpx;
  position: relative;
  z-index: 2;
  border: 1rpx solid #e3eae5;
  border-radius: 24rpx;
  background: #fff;
}

.eyebrow {
  color: #12764a;
  font-size: 17rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.product-name {
  display: block;
  margin-top: 12rpx;
  color: #0b1a12;
  font-size: 38rpx;
  font-weight: 800;
  line-height: 1.38;
}

.selling-point {
  display: block;
  margin-top: 12rpx;
  color: #6b7c72;
  font-size: 23rpx;
  line-height: 1.65;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 24rpx;
}

.price {
  font-size: 46rpx;
}

.original {
  color: #a1ada6;
  font-size: 22rpx;
  text-decoration: line-through;
}

.sales {
  margin-left: auto;
  color: #93a29a;
  font-size: 19rpx;
}

.cert-row {
  display: flex;
  gap: 9rpx;
  margin-top: 20rpx;
}

.assurance-row {
  display: flex;
  margin: 14rpx 22rpx 0;
  overflow: hidden;
  border: 1rpx solid #e3eae5;
  border-radius: 18rpx;
  background: #f8fbf9;
}

.assurance-row > view {
  flex: 1;
  padding: 18rpx 8rpx;
  border-left: 1rpx solid #e3eae5;
  text-align: center;
}

.assurance-row > view:first-child {
  border-left: 0;
}

.assurance-row b,
.assurance-row text {
  display: block;
}

.assurance-row b {
  color: #0e5233;
  font-size: 20rpx;
}

.assurance-row text {
  margin-top: 5rpx;
  color: #8a9990;
  font-size: 16rpx;
}

.spec-card {
  margin-top: 14rpx;
}

.spec-grid {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  border: 1rpx solid #e3eae5;
  border-radius: 16rpx;
  background: #e3eae5;
  gap: 1rpx;
}

.spec-item {
  display: flex;
  width: calc(50% - 1rpx);
  justify-content: space-between;
  gap: 10rpx;
  padding: 18rpx;
  background: #f8fbf9;
}

.spec-item text {
  color: #718277;
  font-size: 20rpx;
}

.spec-item b {
  color: #33453b;
  font-size: 20rpx;
  font-weight: 600;
}

.trace-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin: 14rpx 22rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #073821, #12764a);
  color: #fff;
}

.trace-mark {
  display: grid;
  width: 74rpx;
  height: 74rpx;
  flex: 0 0 74rpx;
  place-items: center;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #b5e9c8;
  font-size: 31rpx;
  font-weight: 800;
}

.trace-copy {
  min-width: 0;
  flex: 1;
}

.trace-kicker,
.trace-title,
.trace-desc {
  display: block;
}

.trace-kicker {
  color: #9fe7b8;
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.trace-title {
  margin-top: 6rpx;
  font-size: 26rpx;
  font-weight: 700;
}

.trace-desc {
  margin-top: 6rpx;
  color: rgba(255, 255, 255, 0.64);
  font-size: 18rpx;
}

.trace-arrow {
  color: rgba(255, 255, 255, 0.56);
  font-size: 42rpx;
}

.quantity-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quantity-title,
.quantity-stock {
  display: block;
}

.quantity-title {
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.quantity-stock {
  margin-top: 6rpx;
  color: #93a29a;
  font-size: 18rpx;
}

.stepper {
  display: flex;
  height: 62rpx;
  align-items: center;
  overflow: hidden;
  border: 1rpx solid #dfe8e2;
  border-radius: 14rpx;
}

.stepper-btn,
.stepper-value {
  display: grid;
  width: 66rpx;
  height: 100%;
  place-items: center;
}

.stepper-btn {
  background: #f4f7f5;
  color: #12764a;
  font-size: 32rpx;
}

.stepper-btn.disabled {
  color: #c7d0ca;
}

.stepper-value {
  min-width: 68rpx;
  color: #0b1a12;
  font-size: 24rpx;
}

.detail-actions {
  gap: 10rpx;
}

.cart-entry {
  display: flex;
  width: 92rpx;
  flex: 0 0 92rpx;
  align-items: center;
  flex-direction: column;
  gap: 4rpx;
  color: #6b7c72;
  font-size: 17rpx;
}

.cart-icon {
  display: grid;
  width: 42rpx;
  height: 42rpx;
  place-items: center;
  border-radius: 12rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 19rpx;
  font-weight: 700;
}

.action-button {
  flex: 1;
  height: 80rpx;
  padding: 0 10rpx;
  font-size: 23rpx;
}
</style>
