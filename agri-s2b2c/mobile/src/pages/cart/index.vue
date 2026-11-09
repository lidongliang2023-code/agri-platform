<template>
  <view class="page cart-page">
    <view v-if="!session.user" class="login-empty">
      <view class="empty-icon">丰</view>
      <text class="empty-title">登录后查看购物车</text>
      <text class="muted">收藏每一份来自产地的当季好货</text>
      <button class="btn btn-primary login-button" @tap="login">统一账号登录</button>
    </view>

    <template v-else>
      <view class="cart-head">
        <view>
          <text class="cart-kicker">SHOPPING CART</text>
          <text class="cart-title">我的购物车</text>
        </view>
        <text class="cart-count">{{ items.length }} 件</text>
      </view>

      <view v-if="items.length" class="cart-list">
        <view v-for="item in items" :key="item.id" class="cart-item">
          <view class="check" :class="{ checked: item.selected }" @tap="toggleItem(item)">
            <text v-if="item.selected">✓</text>
          </view>
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" @tap="openProduct(item.productId)" />
          <view v-else class="item-image item-placeholder" @tap="openProduct(item.productId)">丰</view>
          <view class="item-body">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-spec">{{ item.spec }}</text>
            <view class="item-bottom">
              <text class="price">{{ money(item.price) }}</text>
              <view class="stepper">
                <view class="stepper-btn" @tap="changeQuantity(item, -1)">−</view>
                <text class="stepper-value">{{ item.quantity }}</text>
                <view class="stepper-btn" @tap="changeQuantity(item, 1)">+</view>
              </view>
            </view>
          </view>
          <text class="delete" @tap="removeItem(item.id)">×</text>
        </view>
      </view>

      <view v-else class="empty">
        <view class="empty-icon">袋</view>
        <text>购物车还是空的</text>
        <button class="btn btn-ghost empty-button" @tap="goShopping">去逛逛</button>
      </view>

      <view v-if="items.length" class="fixed-bottom cart-bottom">
        <view class="select-all" @tap="toggleAll">
          <view class="check" :class="{ checked: allSelected }"><text v-if="allSelected">✓</text></view>
          <text>全选</text>
        </view>
        <view class="total-copy">
          <text>合计</text>
          <text class="total-price">{{ money(total) }}</text>
        </view>
        <button class="btn btn-primary checkout" :disabled="selectedCount === 0" @tap="checkout">
          结算 ({{ selectedCount }})
        </button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { mallApi, type CartItem } from '../../api'
import { session } from '../../session'
import { money, toast } from '../../utils'

const items = ref<CartItem[]>([])
const loading = ref(false)

const selectedItems = computed(() => items.value.filter((item) => item.selected))
const selectedCount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0))
const total = computed(() => selectedItems.value.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))
const allSelected = computed(() => items.value.length > 0 && items.value.every((item) => item.selected))

onShow(() => {
  if (session.user) loadCart()
})

async function loadCart() {
  if (!session.user) return
  loading.value = true
  try {
    const result = await mallApi.getCart(session.user.id)
    items.value = result.map((item) => ({ ...item, selected: true }))
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function login() {
  uni.navigateTo({ url: '/pages/login/index?redirect=%2Fpages%2Fcart%2Findex' })
}

function toggleItem(item: CartItem) {
  item.selected = !item.selected
}

function toggleAll() {
  const next = !allSelected.value
  items.value.forEach((item) => { item.selected = next })
}

async function changeQuantity(item: CartItem, delta: number) {
  const next = item.quantity + delta
  if (next < 1 || next > item.stock) return
  item.quantity = next
  try {
    await mallApi.updateCart(item.id, next)
  } catch (error) {
    toast((error as Error).message)
    await loadCart()
  }
}

function removeItem(id: number) {
  uni.showModal({
    title: '移除商品',
    content: '确定将这件商品移出购物车吗？',
    success: async (result) => {
      if (!result.confirm) return
      try {
        const response = await mallApi.deleteCart(id)
        if (response.success) {
          items.value = items.value.filter((item) => item.id !== id)
        }
      } catch (error) {
        toast((error as Error).message)
      }
    },
  })
}

function checkout() {
  const ids = selectedItems.value.map((item) => item.id)
  if (!ids.length) return toast('请选择商品')
  uni.setStorageSync('s2b2c_checkout_item_ids', ids)
  uni.navigateTo({ url: '/pages/checkout/index' })
}

function goShopping() {
  uni.switchTab({ url: '/pages/home/index' })
}

function openProduct(id: number) {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` })
}
</script>

<style scoped lang="scss">
.cart-page {
  padding-bottom: calc(190rpx + env(safe-area-inset-bottom));
}

/* #ifndef H5 */
.cart-page {
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
/* #endif */

.login-empty {
  display: flex;
  min-height: 75vh;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
  padding: 40rpx;
}

.empty-title {
  color: #0b1a12;
  font-size: 29rpx;
  font-weight: 700;
}

.login-button {
  width: 320rpx;
  margin-top: 20rpx;
}

.cart-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 24rpx;
}

.cart-kicker,
.cart-title {
  display: block;
}

.cart-kicker {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.cart-title {
  margin-top: 5rpx;
  color: #0b1a12;
  font-size: 34rpx;
  font-weight: 800;
}

.cart-count {
  color: #93a29a;
  font-size: 24rpx;
}

.cart-list {
  padding: 0 22rpx;
}

.cart-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 14rpx;
  padding: 18rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.check {
  display: grid;
  width: 38rpx;
  height: 38rpx;
  flex: 0 0 38rpx;
  place-items: center;
  border: 1rpx solid #cdd8d1;
  border-radius: 50%;
  color: #fff;
  font-size: 24rpx;
}

.check.checked {
  border-color: #12764a;
  background: #12764a;
}

.item-image,
.item-placeholder {
  width: 150rpx;
  height: 150rpx;
  flex: 0 0 150rpx;
  border-radius: 16rpx;
}

.item-image {
  background: #eef7f1;
}

.item-placeholder {
  display: grid;
  place-items: center;
  background: #edf7f1;
  color: rgba(18, 118, 74, 0.18);
  font-size: 52rpx;
  font-weight: 800;
}

.item-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.item-name,
.item-spec {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-name {
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.item-spec {
  margin-top: 7rpx;
  color: #84938a;
  font-size: 24rpx;
}

.item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 17rpx;
}

.price {
  font-size: 28rpx;
}

.stepper {
  display: flex;
  height: 52rpx;
  align-items: center;
  overflow: hidden;
  border: 1rpx solid #dfe8e2;
  border-radius: 12rpx;
}

.stepper-btn,
.stepper-value {
  display: grid;
  width: 50rpx;
  height: 100%;
  place-items: center;
}

.stepper-btn {
  background: #f4f7f5;
  color: #12764a;
  font-size: 27rpx;
}

.stepper-value {
  min-width: 52rpx;
  font-size: 24rpx;
}

.delete {
  position: absolute;
  top: 10rpx;
  right: 14rpx;
  color: #a8b1ab;
  font-size: 32rpx;
}

.empty-button {
  min-width: 240rpx;
  margin-top: 18rpx;
}

.cart-bottom {
  gap: 18rpx;
}

/* #ifdef H5 */
.cart-bottom {
  bottom: 50px;
}
/* #endif */

.select-all {
  display: flex;
  align-items: center;
  gap: 9rpx;
  color: #52665a;
  font-size: 24rpx;
}

.total-copy {
  display: flex;
  margin-left: auto;
  align-items: flex-end;
  flex-direction: column;
  color: #718277;
  font-size: 24rpx;
}

.total-price {
  margin-top: 3rpx;
  color: #d45b32;
  font-size: 31rpx;
  font-weight: 800;
}

.checkout {
  width: 220rpx;
  height: 78rpx;
  font-size: 24rpx;
}

.checkout[disabled] {
  opacity: 0.5;
}
</style>
