<template>
  <view class="page checkout-page">
    <view class="address-card" @tap="chooseAddress">
      <view class="address-icon">址</view>
      <view v-if="selectedAddress" class="address-copy">
        <view class="address-person">
          <text>{{ selectedAddress.name }}</text>
          <text>{{ selectedAddress.phone }}</text>
          <text v-if="selectedAddress.isDefault" class="tag tag-green">默认</text>
        </view>
        <text class="address-detail">{{ fullAddress(selectedAddress) }}</text>
      </view>
      <view v-else class="address-copy">
        <text class="address-empty">请选择收货地址</text>
        <text class="address-detail">用于订单配送与售后联系</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <view class="card order-products">
      <view class="card-head">
        <text class="card-title">商品清单</text>
        <text class="card-sub">共 {{ totalQuantity }} 件</text>
      </view>
      <view v-for="item in items" :key="item.id" class="order-item">
        <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
        <view v-else class="item-image item-placeholder">丰</view>
        <view class="item-copy">
          <text class="item-name">{{ item.name }}</text>
          <text class="item-spec">{{ item.spec }}</text>
          <view class="item-bottom">
            <text class="price">{{ money(item.price) }}</text>
            <text class="quantity">× {{ item.quantity }}</text>
          </view>
        </view>
      </view>
      <view v-if="!items.length" class="empty-mini">暂未选择结算商品</view>
    </view>

    <view class="card fee-card">
      <view class="fee-row"><text>商品总价</text><text>{{ money(totalAmount) }}</text></view>
      <view class="fee-row"><text>配送费</text><text>{{ money(freightAmount) }}</text></view>
      <view v-if="usableCoupons.length" class="coupon-block">
        <text class="coupon-title">优惠券</text>
        <view class="coupon-chips">
          <view class="coupon-chip" :class="{ active: couponIndex === 0 }" @tap="couponIndex = 0">不使用</view>
          <view v-for="(coupon, index) in usableCoupons" :key="coupon.id"
                class="coupon-chip" :class="{ active: couponIndex === index + 1 }"
                @tap="couponIndex = index + 1">
            {{ coupon.name }}
          </view>
        </view>
      </view>
      <view v-else class="fee-row"><text>优惠券</text><text class="coupon-empty">暂无可用</text></view>
      <view class="fee-row"><text>优惠金额</text><text class="discount">-{{ money(discountAmount) }}</text></view>
      <view class="fee-row total"><text>应付合计</text><text class="price">{{ money(payAmount) }}</text></view>
    </view>

    <view class="card remark-card">
      <text class="remark-label">订单备注</text>
      <textarea v-model="remark" class="textarea" placeholder="选填，可填写配送时间或包装要求" />
    </view>

    <view class="security-note">
      <text class="security-mark">保</text>
      <view><b>平台担保交易</b><text>订单、支付与售后全流程留痕</text></view>
    </view>

    <view class="fixed-bottom submit-bar">
      <view class="submit-total">
        <text>应付</text>
        <text class="price">{{ money(payAmount) }}</text>
      </view>
      <button class="btn btn-primary submit-button" :loading="submitting" @tap="submitOrder">提交订单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { mallApi, type Address, type CartItem, type CouponItem } from '../../api'
import { session } from '../../session'
import { money, toast } from '../../utils'

const items = ref<CartItem[]>([])
const addresses = ref<Address[]>([])
const selectedAddress = ref<Address | null>(null)
const coupons = ref<CouponItem[]>([])
const couponIndex = ref(0)
const remark = ref('')
const submitting = ref(false)
const freightAmount = ref(0)

const totalAmount = computed(() => items.value.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))
const totalQuantity = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

const usableCoupons = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return coupons.value.filter((coupon) => {
    if (String(coupon.status || '').toUpperCase() !== 'UNUSED') return false
    if (coupon.validStart && today < String(coupon.validStart).slice(0, 10)) return false
    if (coupon.validEnd && today > String(coupon.validEnd).slice(0, 10)) return false
    if (Number(coupon.minAmount || 0) > totalAmount.value) return false
    return couponDiscount(coupon) > 0
  })
})

const selectedCoupon = computed(() => couponIndex.value > 0 && couponIndex.value <= usableCoupons.value.length
  ? usableCoupons.value[couponIndex.value - 1]
  : null)
const discountAmount = computed(() => selectedCoupon.value ? couponDiscount(selectedCoupon.value) : 0)
const payAmount = computed(() => Math.max(0, totalAmount.value + freightAmount.value - discountAmount.value))

function couponDiscount(coupon: CouponItem) {
  if (String(coupon.type || '').toUpperCase() === 'DISCOUNT' && coupon.discountRate != null) {
    const rate = Number(coupon.discountRate)
    if (!Number.isFinite(rate) || rate <= 0 || rate >= 10) return 0
    return Math.min(totalAmount.value, round2(totalAmount.value * (1 - rate / 10)))
  }
  const amount = Number(coupon.amount)
  if (coupon.amount != null && Number.isFinite(amount) && amount > 0) {
    return Math.min(totalAmount.value, round2(amount))
  }
  return 0
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

onShow(load)

async function load() {
  if (!session.user) {
    uni.redirectTo({ url: '/pages/login/index?redirect=%2Fpages%2Fcheckout%2Findex' })
    return
  }
  try {
    const [cart, addressList] = await Promise.all([
      mallApi.getCart(session.user.id),
      mallApi.getAddresses(session.user.id),
    ])
    const storedIds = uni.getStorageSync('s2b2c_checkout_item_ids')
    const ids: string[] = Array.isArray(storedIds) ? storedIds.map(String) : []
    items.value = ids.length ? cart.filter((item) => ids.includes(String(item.id))) : cart
    addresses.value = addressList || []
    const chosenId = String(uni.getStorageSync('s2b2c_selected_address_id') || '')
    selectedAddress.value =
      addresses.value.find((item) => String(item.id) === chosenId) ||
      addresses.value.find((item) => item.isDefault) ||
      addresses.value[0] ||
      null
    try {
      coupons.value = (await mallApi.getCoupons(session.user.id)) || []
    } catch {
      coupons.value = []
    }
    if (couponIndex.value > usableCoupons.value.length) couponIndex.value = 0
  } catch (error) {
    toast((error as Error).message)
  }
}

function chooseAddress() {
  uni.navigateTo({ url: '/pages/addresses/index?select=1' })
}

function fullAddress(address: Address) {
  return `${address.province}${address.city}${address.district}${address.address}`
}

async function submitOrder() {
  if (!session.user) return
  if (!selectedAddress.value) return toast('请选择收货地址')
  if (!items.value.length) return toast('请选择结算商品')
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      consumerId: session.user.id,
      addressId: selectedAddress.value.id,
      freightAmount: freightAmount.value.toFixed(2),
      remark: remark.value,
    }
    if (selectedCoupon.value) payload.couponUserId = selectedCoupon.value.id
    const result = await mallApi.createOrder(payload)
    if (!result.success) throw new Error(result.message || '订单提交失败')
    uni.removeStorageSync('s2b2c_checkout_item_ids')
    uni.removeStorageSync('s2b2c_selected_address_id')
    toast('下单成功', 'success')
    setTimeout(() => uni.redirectTo({ url: '/pages/orders/index' }), 400)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.checkout-page {
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom));
}

.address-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 22rpx;
  padding: 25rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.address-icon {
  display: grid;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  place-items: center;
  border-radius: 17rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 26rpx;
  font-weight: 800;
}

.address-copy {
  min-width: 0;
  flex: 1;
}

.address-person {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.address-person > text:nth-child(2) {
  color: #718277;
  font-size: 21rpx;
  font-weight: 400;
}

.address-detail,
.address-empty {
  display: block;
}

.address-detail {
  margin-top: 8rpx;
  color: #718277;
  font-size: 20rpx;
  line-height: 1.5;
}

.address-empty {
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.arrow {
  color: #a1ada6;
  font-size: 44rpx;
}

.order-item {
  display: flex;
  gap: 16rpx;
  padding: 17rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.order-item:first-of-type {
  border-top: 0;
}

.item-image,
.item-placeholder {
  width: 128rpx;
  height: 128rpx;
  flex: 0 0 128rpx;
  border-radius: 14rpx;
}

.item-image {
  background: #eef7f1;
}

.item-placeholder {
  display: grid;
  place-items: center;
  background: #edf7f1;
  color: rgba(18, 118, 74, 0.18);
  font-size: 46rpx;
  font-weight: 800;
}

.item-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.item-name {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.item-spec {
  margin-top: 7rpx;
  color: #84938a;
  font-size: 19rpx;
}

.item-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: auto;
}

.price {
  font-size: 29rpx;
}

.quantity {
  color: #718277;
  font-size: 20rpx;
}

.empty-mini {
  padding: 60rpx 0;
  color: #94a198;
  text-align: center;
}

.fee-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  color: #52665a;
  font-size: 22rpx;
}

.fee-row.total {
  margin-top: 4rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf2ee;
  color: #0b1a12;
  font-weight: 700;
}

.fee-row.total .price {
  font-size: 32rpx;
}

.discount {
  color: #12764a;
}

.coupon-block {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.coupon-title {
  color: #52665a;
  font-size: 22rpx;
}

.coupon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.coupon-chip {
  padding: 8rpx 18rpx;
  border: 1rpx solid #dcebe2;
  border-radius: 999rpx;
  background: #f7fbf8;
  color: #52665a;
  font-size: 20rpx;
}

.coupon-chip.active {
  border-color: #12764a;
  background: #eaf7ef;
  color: #12764a;
  font-weight: 700;
}

.coupon-empty {
  color: #94a198;
}

.remark-label {
  display: block;
  margin-bottom: 13rpx;
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 0 22rpx 20rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid #dcebe2;
  border-radius: 18rpx;
  background: #f5fbf7;
}

.security-mark {
  display: grid;
  width: 44rpx;
  height: 44rpx;
  place-items: center;
  border-radius: 12rpx;
  background: #e1f3e8;
  color: #12764a;
  font-size: 20rpx;
  font-weight: 800;
}

.security-note b,
.security-note text {
  display: block;
}

.security-note b {
  color: #0e5233;
  font-size: 21rpx;
}

.security-note text {
  margin-top: 4rpx;
  color: #84938a;
  font-size: 17rpx;
}

.submit-bar {
  justify-content: space-between;
}

.submit-total {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  color: #718277;
  font-size: 20rpx;
}

.submit-total .price {
  font-size: 36rpx;
}

.submit-button {
  width: 280rpx;
  height: 82rpx;
}
</style>
