<template>
  <view class="page apply-page">
    <view v-if="loading" class="empty"><text>正在读取订单…</text></view>
    <view v-else-if="!order" class="empty">
      <view class="empty-icon">!</view>
      <text>订单不存在或无权查看</text>
    </view>
    <template v-else>
      <view class="card order-card">
        <view class="card-head">
          <text class="card-title">售后订单</text>
          <text class="tag" :class="`tag-${statusMeta(order.status).tone}`">{{ order.statusText || statusMeta(order.status).label }}</text>
        </view>
        <view v-for="item in order.items || []" :key="item.id" class="item-row">
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
          <view v-else class="item-image item-placeholder">丰</view>
          <view class="item-copy">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-spec">{{ item.spec }} × {{ item.quantity }}</text>
          </view>
          <text class="item-price">{{ money(item.totalAmount || item.price * item.quantity) }}</text>
        </view>
        <view class="order-foot"><text>订单号 {{ order.orderNo }}</text><text>实付 <text class="price">{{ money(order.payAmount) }}</text></text></view>
      </view>

      <view class="card">
        <text class="block-title">售后类型</text>
        <view class="type-grid">
          <view v-for="item in AFTER_SALE_TYPES" :key="item.value" class="type-card" :class="{ active: form.type === item.value }" @tap="form.type = item.value">
            <text class="type-name">{{ item.label }}</text>
            <text class="type-desc">{{ item.desc }}</text>
          </view>
        </view>

        <text class="block-title">退款金额</text>
        <view class="amount-box">
          <text class="currency">¥</text>
          <input v-model="form.amount" class="amount-input" type="digit" placeholder="0.00" />
          <text class="amount-max ui-action-target" @tap="form.amount = maxAmount.toFixed(2)">最多 {{ money(maxAmount) }}</text>
        </view>

        <text class="block-title">售后原因</text>
        <view class="reason-chips">
          <text v-for="reason in reasons" :key="reason" class="reason-chip ui-action-target" :class="{ active: form.reason === reason }" @tap="form.reason = reason">{{ reason }}</text>
        </view>
        <textarea v-model="form.detail" class="textarea" maxlength="200" placeholder="补充说明（选填），例如破损情况、期望处理方式" />
      </view>

      <view class="tips">
        <text>· 商家会在 48 小时内处理，处理结果会出现在「我的售后」。</text>
        <text>· 选择退货退款时，商家同意后请在「我的售后」里填写退货物流。</text>
      </view>

      <view class="action-spacer" />
      <view class="fixed-bottom">
        <button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting" @tap="submit">提交申请</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { mallApi, type Order } from '../../api'
import { ensureLogin } from '../../session'
import { AFTER_SALE_ALLOWED, AFTER_SALE_TYPES, money, statusMeta, toast } from '../../utils'

const order = ref<Order | null>(null)
const loading = ref(true)
const submitting = ref(false)
const reasons = ['商品破损', '质量问题', '与描述不符', '少件 / 漏发', '不想要了', '其他原因']
const form = reactive({ type: 'REFUND', amount: '', reason: '', detail: '' })
const maxAmount = computed(() => Number(order.value?.payAmount || 0))

onLoad(async (options) => {
  if (!ensureLogin()) return
  const id = String(options?.orderId || '')
  if (!id) {
    loading.value = false
    return
  }
  try {
    order.value = await mallApi.getOrder(id)
    form.amount = maxAmount.value.toFixed(2)
    // 未发货只能仅退款，避免出现"退货"却没有货可退
    form.type = order.value.status === 'PENDING_SHIP' ? 'REFUND' : form.type
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
})

async function submit() {
  if (!order.value) return
  if (!AFTER_SALE_ALLOWED.includes(order.value.status)) return toast('当前订单状态不能申请售后')
  if (form.type === 'RETURN' && order.value.status === 'PENDING_SHIP') return toast('商品尚未发货，请选择仅退款')
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return toast('请输入正确的退款金额')
  if (amount > maxAmount.value) return toast(`退款金额不能超过实付 ${money(maxAmount.value)}`)
  if (!form.reason) return toast('请选择售后原因')
  submitting.value = true
  try {
    const result = await mallApi.createAfterSale({
      orderId: order.value.id,
      type: form.type,
      amount: Math.round(amount * 100) / 100,
      reason: form.detail.trim() ? `${form.reason}：${form.detail.trim()}` : form.reason,
    })
    if (!result.success) throw new Error(result.message || '售后提交失败')
    toast('售后申请已提交', 'success')
    setTimeout(() => uni.redirectTo({ url: '/pages/aftersale/index' }), 500)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.apply-page {
  padding-top: 4rpx;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
}

.item-image {
  width: 110rpx;
  height: 110rpx;
  flex: 0 0 110rpx;
  border-radius: 14rpx;
  background: #eef7f1;
}

.item-placeholder {
  display: grid;
  place-items: center;
  color: rgba(18, 118, 74, 0.25);
  font-size: 40rpx;
  font-weight: 800;
}

.item-copy {
  min-width: 0;
  flex: 1;
}

.item-name,
.item-spec {
  display: block;
}

.item-name {
  overflow: hidden;
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-spec {
  margin-top: 6rpx;
  color: #666666;
  font-size: 24rpx;
}

.item-price {
  color: #33453b;
  font-size: 26rpx;
}

.order-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #edf2ee;
  color: #666666;
  font-size: 24rpx;
}

.block-title {
  display: block;
  margin: 8rpx 0 14rpx;
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 700;
}

.type-grid {
  display: flex;
  gap: 14rpx;
  margin-bottom: 26rpx;
}

.type-card {
  flex: 1;
  padding: 20rpx;
  border: 2rpx solid #e3eae5;
  border-radius: 18rpx;
  background: #fbfdfb;
}

.type-card.active {
  border-color: #12764a;
  background: #effaf3;
}

.type-name,
.type-desc {
  display: block;
}

.type-name {
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 700;
}

.type-desc {
  margin-top: 6rpx;
  color: #666666;
  font-size: 24rpx;
  line-height: 1.5;
}

.amount-box {
  display: flex;
  height: 92rpx;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 26rpx;
  padding: 0 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
}

.currency {
  color: #e53935;
  font-size: 34rpx;
  font-weight: 800;
}

.amount-input {
  flex: 1;
  color: #e53935;
  font-size: 36rpx;
  font-weight: 800;
}

.amount-max {
  color: #12764a;
  font-size: 24rpx;
}

.reason-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.reason-chip {
  padding: 12rpx 22rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 999rpx;
  color: #52665a;
  font-size: 24rpx;
}

.reason-chip.active {
  border-color: #12764a;
  background: #e9f6ee;
  color: #0e5233;
  font-weight: 700;
}

.tips {
  margin: 0 24rpx;
  color: #666666;
  font-size: 24rpx;
  line-height: 1.7;
}

.tips text {
  display: block;
}

.action-spacer {
  height: calc(130rpx + env(safe-area-inset-bottom));
}
</style>
