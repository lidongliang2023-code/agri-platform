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

      <view v-if="loading" class="list-feedback">正在同步购物车…</view>
      <view v-else-if="loadError" class="empty"><text>{{ loadError }}</text><button class="btn" @tap="loadCart">重新加载</button></view>
      <view v-else-if="items.length" class="cart-list">
        <view v-for="item in items" :key="item.id" class="cart-item">
          <button class="check-hit" :disabled="syncing" :aria-label="item.selected ? '取消选择商品' : '选择商品'" @tap="toggleItem(item)"><view class="check" :class="{ checked: item.selected }"><text v-if="item.selected">✓</text></view></button>
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" @tap="openProduct(item.productId)" />
          <view v-else class="item-image item-placeholder" @tap="openProduct(item.productId)">丰</view>
          <view class="item-body">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-spec">{{ item.spec }}</text>
            <view class="item-bottom">
              <text class="price">{{ money(item.price) }}</text>
              <view class="stepper">
                <button class="stepper-btn" :disabled="syncing || item.quantity <= 1" aria-label="减少数量" @tap="changeQuantity(item, -1)">−</button>
                <text class="stepper-value">{{ item.quantity }}</text>
                <button class="stepper-btn" :disabled="syncing || item.quantity >= item.stock" aria-label="增加数量" @tap="changeQuantity(item, 1)">+</button>
              </view>
            </view>
          </view>
          <button class="delete" :disabled="syncing" aria-label="移除商品" @tap="removeItem(item.id)">移除</button>
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
        <button class="btn btn-primary checkout" :disabled="selectedCount === 0 || syncing || loading || !!loadError" @tap="checkout">
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
const syncing = ref(false)
const loadError = ref('')

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
  loadError.value = ''
  try {
    const result = await mallApi.getCart(session.user.id)
    items.value = result.map((item) => ({ ...item, selected: Boolean(item.selected) }))
  } catch (error) {
    loadError.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

function login() {
  uni.navigateTo({ url: '/pages/login/index?redirect=%2Fpages%2Fcart%2Findex' })
}

async function sync(action: () => Promise<{ success: boolean; message?: string }>, done: () => void) {
  if (syncing.value || loading.value) return
  syncing.value = true
  try {
    const result = await action()
    if (!result.success) throw new Error(result.message || '同步失败，请重试')
    done()
    await loadCart()
  } catch (error) { toast((error as Error).message) }
  finally { syncing.value = false }
}
function toggleItem(item: CartItem) {
  const selected = !item.selected
  return sync(() => mallApi.selectCart(item.id, selected), () => { item.selected = selected })
}
function toggleAll() {
  if (!session.user) return
  const selected = !allSelected.value
  return sync(() => mallApi.selectAllCart(session.user!.id, selected), () => { items.value.forEach(item => { item.selected = selected }) })
}
function changeQuantity(item: CartItem, delta: number) {
  const next = item.quantity + delta
  if (next < 1 || next > item.stock) return
  return sync(() => mallApi.updateCart(item.id, next), () => { item.quantity = next })
}

function removeItem(id: number) {
  if (syncing.value || loading.value) return
  uni.showModal({
    title: '移除商品',
    content: '确定将这件商品移出购物车吗？',
    success: async (result) => {
      if (!result.confirm) return
      await sync(() => mallApi.deleteCart(id), () => { items.value = items.value.filter(item => item.id !== id) })
    },
  })
}

function checkout() {
  if (syncing.value || loading.value || loadError.value) return
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
  color: #666666;
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
  color: #666666;
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
  background: #f5f6fa;
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
  color: #666666;
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
  color: #666666;
  font-size: 24rpx;
}

.total-price {
  margin-top: 3rpx;
  color: #e53935;
  font-size: 16px;
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

.cart-item { display:grid; grid-template-columns:44px 112rpx minmax(0,1fr); align-items:start; gap:12rpx; padding:20rpx 16rpx; }.check-hit { display:flex; width:44px; min-height:44px; align-items:center; justify-content:center; }.check { width:24px;height:24px;flex-basis:24px; }.item-image,.item-placeholder { width:112rpx;height:112rpx; }.item-body { min-width:0; }.item-name { white-space:normal; padding-right:0; font-size:28rpx; line-height:1.45; }.item-bottom { flex-wrap:wrap; gap:16rpx; align-items:flex-start; }.stepper { height:44px; margin-left:auto; }.stepper-btn { width:44px; height:44px; display:flex; align-items:center;justify-content:center; }.stepper-value { min-width:32px; }.delete { position:static;grid-column:3;justify-self:end;min-height:44px;padding:0 12rpx;font-size:24rpx;line-height:44px;color:#666666; }.cart-bottom { gap:12rpx; }.select-all { min-height:44px; }.checkout { padding:0 20rpx; }.cart-head { padding:20rpx 24rpx; }.cart-title { font-size:30rpx; }
/* #ifdef H5 */
.cart-bottom { bottom:var(--window-bottom, 50px);padding-bottom:14rpx; }
/* #endif */

</style>
