<template>
  <view class="page checkout-page">
    <view v-if="loading" class="list-feedback">正在确认商品与收货信息…</view>
    <view v-if="loadError" class="empty"><text>{{ loadError }}</text><button class="btn" @tap="load">重新加载</button></view>
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

    <view v-if="groupBuyId" class="card"><text>拼团订单 · {{groupInstanceId?'加入拼团':'发起拼团'}}，按当前活动价格结算，不叠加优惠券</text></view>
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
          <view class="coupon-chip" :class="{ active: !couponId }" @tap="couponId = ''">不使用</view>
          <view v-for="(coupon, index) in usableCoupons" :key="coupon.id"
                class="coupon-chip" :class="{ active: couponId === String(coupon.id) }"
                @tap="couponId = String(coupon.id)">
            {{ coupon.name }} · 省 {{ money(couponDiscount(coupon)) }}
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
      <view><text class="strong-copy">平台担保交易</text><text>订单、支付与售后全流程留痕</text></view>
    </view>

    <view class="fixed-bottom submit-bar">
      <view class="submit-total">
        <text>应付</text>
        <text class="price">{{ money(payAmount) }}</text>
      </view>
      <button class="btn btn-primary submit-button" :loading="submitting" :disabled="submitting || loading || !!loadError || !items.length || !selectedAddress" @tap="submitOrder">提交订单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { mallApi, request, type Address, type CartItem, type CouponItem } from '../../api'
import { session, ensureLogin } from '../../session'
import { money, toast } from '../../utils'

const items = ref<CartItem[]>([])
const addresses = ref<Address[]>([])
const selectedAddress = ref<Address | null>(null)
const coupons = ref<CouponItem[]>([])
const couponId = ref('')
const loading = ref(true)
const loadError = ref('')
const remark = ref('')
const submitting = ref(false)
const freightAmount = ref(0)
const groupBuyId = ref(''), groupInstanceId = ref(''), groupPrice = ref<number|null>(null)
let rawCartSignature = ''
onLoad(options => { groupBuyId.value=String(options?.groupBuyId || ''); groupInstanceId.value=String(options?.groupInstanceId || '') })
const cartSignature = (rows: CartItem[]) => rows.map(item => `${item.id}:${item.quantity}:${Number(item.price)}`).sort().join('|')

const totalAmount = computed(() => items.value.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))
const totalQuantity = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

const usableCoupons = computed(() => {
  if (groupBuyId.value) return []
  const date = new Date()
  const today = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  return coupons.value.filter((coupon) => {
    if (String(coupon.status || '').toUpperCase() !== 'UNUSED') return false
    if (coupon.validStart && today < String(coupon.validStart).slice(0, 10)) return false
    if (coupon.validEnd && today > String(coupon.validEnd).slice(0, 10)) return false
    if (Number(coupon.minAmount || 0) > totalAmount.value) return false
    return couponDiscount(coupon) > 0
  })
})

const selectedCoupon = computed(() => usableCoupons.value.find(coupon => String(coupon.id) === couponId.value) || null)
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
  if (!ensureLogin() || !session.user) return
  loading.value = true
  loadError.value = ''
  try {
    const [cart, addressList] = await Promise.all([
      mallApi.getCart(session.user.id),
      mallApi.getAddresses(session.user.id),
    ])
    // Spring Boot 按服务端全部勾选项结算；展示必须使用完全相同的集合。
    items.value = cart.filter(item => item.selected)
    rawCartSignature = cartSignature(items.value)
    if(groupBuyId.value) {
      const detail = await request<{activity:{productId:string|number;groupPrice:number;leaderPrice?:number;status:string};instances:{instanceId:string|number}[]}>(`/consumer/group-buy/${groupBuyId.value}`)
      const activity = detail.activity
      if(activity.status!=='ACTIVE' || items.value.length!==1 || String(items.value[0].productId)!==String(activity.productId)) throw new Error('拼团活动或结算商品已变化，请重新选择')
      if(groupInstanceId.value && !detail.instances.some(x=>String(x.instanceId)===groupInstanceId.value)) throw new Error('所选拼团已结束，请返回重新选择')
      groupPrice.value=Number(!groupInstanceId.value && Number(activity.leaderPrice)>0 ? activity.leaderPrice : activity.groupPrice)
      items.value=items.value.map(item=>({...item,price:groupPrice.value!}))
      couponId.value=''
    }
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
    if (!selectedCoupon.value) couponId.value = ''
  } catch (error) {
    loadError.value = (error as Error).message
  } finally { loading.value = false }
}

function chooseAddress() {
  uni.navigateTo({ url: '/pages/addresses/index?select=1' })
}

function fullAddress(address: Address) {
  return `${address.province}${address.city}${address.district}${address.address}`
}

async function submitOrder() {
  if (submitting.value || loading.value || loadError.value || !session.user) return
  if (!selectedAddress.value) return toast('请选择收货地址')
  if (!items.value.length) return toast('请选择结算商品')
  submitting.value = true
  try {
    const current = (await mallApi.getCart(session.user.id)).filter(item => item.selected)
    if (cartSignature(current) !== rawCartSignature) {
      await load()
      throw new Error('购物车已更新，请核对商品和金额后重新提交')
    }
    const payload: Record<string, unknown> = {
      consumerId: session.user.id,
      addressId: selectedAddress.value.id,
      freightAmount: freightAmount.value.toFixed(2),
      remark: remark.value,
    }
    if(groupBuyId.value) {
      const detail = await request<{activity:{groupPrice:number;leaderPrice?:number}}>(`/consumer/group-buy/${groupBuyId.value}`)
      const latestPrice=Number(!groupInstanceId.value && Number(detail.activity.leaderPrice)>0 ? detail.activity.leaderPrice : detail.activity.groupPrice)
      if(latestPrice!==groupPrice.value) { await load(); throw new Error('拼团价格已变化，请核对后重新提交') }
      payload.groupBuyId=groupBuyId.value
      if(groupInstanceId.value) payload.groupInstanceId=groupInstanceId.value
    }
    if (selectedCoupon.value && !groupBuyId.value) payload.couponUserId = selectedCoupon.value.id
    const result = await mallApi.createOrder(payload)
    if (!result.success) throw new Error(result.message || '订单提交失败')
    uni.removeStorageSync('s2b2c_checkout_item_ids')
    uni.removeStorageSync('s2b2c_selected_address_id')
    toast('下单成功', 'success')
    uni.redirectTo({ url: '/pages/orders/index', fail: () => { submitting.value = false } })
  } catch (error) {
    toast((error as Error).message)
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
  color: #666666;
  font-size: 24rpx;
  font-weight: 400;
}

.address-detail,
.address-empty {
  display: block;
}

.address-detail {
  margin-top: 8rpx;
  color: #666666;
  font-size: 24rpx;
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
  color: #666666;
  font-size: 24rpx;
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
  color: #666666;
  font-size: 24rpx;
}

.empty-mini {
  padding: 60rpx 0;
  color: #666666;
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
  font-size: 24rpx;
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
  font-size: 24rpx;
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
  font-size: 24rpx;
}

.coupon-chip.active {
  border-color: #12764a;
  background: #eaf7ef;
  color: #12764a;
  font-weight: 700;
}

.coupon-empty {
  color: #666666;
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
  font-size: 24rpx;
  font-weight: 800;
}

.security-note .strong-copy,
.security-note text {
  display: block;
}

.security-note .strong-copy {
  color: #0e5233;
  font-size: 24rpx;
}

.security-note text {
  margin-top: 4rpx;
  color: #666666;
  font-size: 24rpx;
}

.submit-bar {
  justify-content: space-between;
}

.submit-total {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  color: #666666;
  font-size: 24rpx;
}

.submit-total .price {
  font-size: 36rpx;
}

.submit-button {
  width: 280rpx;
  height: 82rpx;
}
.coupon-chips { flex-direction:column; }.coupon-chip { min-height:44px;display:flex;align-items:center;padding:16rpx 20rpx; }.security-note { margin-bottom:24rpx; }.address-person { flex-wrap:wrap; }.submit-bar { gap:16rpx; }
</style>
