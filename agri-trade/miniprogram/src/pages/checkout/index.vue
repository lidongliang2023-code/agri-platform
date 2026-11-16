<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { tradeApi, money, type TradeProduct } from '../../api'
import { requireTradeLogin, requireTradeRole } from '../../auth'

const product = ref<TradeProduct | null>(null), skuIndex = ref(0), quantity = ref(''), busy = ref(false), error = ref('')
const loading = ref(true), loadError = ref('')
const form = ref({ deliveryProvince: '', deliveryCity: '', deliveryAddress: '', deliveryContact: '', deliveryPhone: '' })
const fields = [
  { key: 'deliveryContact' as const, label: '收货人', type: 'text' },
  { key: 'deliveryPhone' as const, label: '联系电话', type: 'number' },
  { key: 'deliveryProvince' as const, label: '省份', type: 'text' },
  { key: 'deliveryCity' as const, label: '城市', type: 'text' },
  { key: 'deliveryAddress' as const, label: '详细地址', type: 'text' },
]
const skus = computed(() => product.value?.skus?.filter(s => s.status === 1) || [])
const selected = computed(() => skus.value[skuIndex.value])
const price = computed(() => selected.value?.price ?? product.value?.price ?? product.value?.priceMin ?? 0)
const min = computed(() => selected.value?.minOrderQuantity ?? product.value?.minOrderQuantity ?? 1)
const stock = computed(() => selected.value?.stockQuantity ?? product.value?.stockQuantity ?? 0)
const unit = computed(() => selected.value?.unit || product.value?.unit || '')
const estimate = computed(() => price.value * (Number(quantity.value) || 0))
let id = 0
onLoad((p?: Record<string, string>) => { id = Number(p?.id); quantity.value = p?.quantity || '' })
onShow(() => void load())
async function load() {
  if (!requireTradeRole('buyer') || !requireTradeLogin()) return
  loading.value = true; loadError.value = ''
  try {
    if (!Number.isFinite(id) || id <= 0) throw new Error('商品链接无效')
    product.value = await tradeApi.product(id)
    if (!product.value) throw new Error('商品不存在或已下架')
    if (!quantity.value) quantity.value = String(min.value)
  } catch (e) { loadError.value = e instanceof Error ? e.message : '商品加载失败' } finally { loading.value = false }
}
function pickSku(e: any) { skuIndex.value = Number(e.detail.value); quantity.value = String(min.value) }
function step(delta: number) { const q = (Number(quantity.value) || 0) + delta; quantity.value = String(Math.max(min.value, Math.min(stock.value || q, q))) }
async function submit() {
  if (!requireTradeRole('buyer')) return
  if (busy.value || loading.value || loadError.value || !product.value) return
  error.value = ''
  const q = Number(quantity.value)
  if (!Number.isFinite(q) || q < min.value || q > stock.value) { error.value = '采购数量须在起订量与库存之间'; return }
  if (fields.some(f => !form.value[f.key].trim())) { error.value = '请完整填写收货信息'; return }
  if (!/^[\d+\-\s]{6,20}$/.test(form.value.deliveryPhone)) { error.value = '请填写有效的联系电话'; return }
  const ok = await new Promise<boolean>(resolve => uni.showModal({ title: '确认采购', content: '确认提交采购订单？最终金额以订单为准。', success: r => resolve(r.confirm), fail: () => resolve(false) }))
  if (!ok) return
  busy.value = true
  try {
    const order = await tradeApi.createOrderFromProduct({ productId: id, skuId: selected.value?.id, quantity: q, ...form.value })
    uni.redirectTo({ url: '/pages/order-detail/index?id=' + order.id })
  } catch (e) { error.value = e instanceof Error ? e.message : '下单失败' } finally { busy.value = false }
}
</script>

<template>
  <view class="page" :class="{ 'with-bar': product && !loadError }">
    <view v-if="loading && !product" class="loading">正在加载采购信息…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载商品</button></view>
    <template v-else-if="product">
      <view class="card goods">
        <view class="glyph">{{ product.productName?.slice(0, 1) || '农' }}</view>
        <view class="grow">
          <text class="goods-name">{{ product.productName }}</text>
          <text class="tiny ellipsis">{{ product.sellerName || '认证供应商' }}</text>
          <view><text class="price">{{ money(price) }}</text><text class="tiny"> /{{ unit }}</text></view>
        </view>
      </view>

      <view class="card">
        <text class="card-title">采购规格与数量</text>
        <picker v-if="skus.length" :range="skus" range-key="skuName" @change="pickSku">
          <view class="kv tap"><text class="kv-label">规格</text><text class="kv-value">{{ selected?.skuName }} ›</text></view>
        </picker>
        <view class="kv"><text class="kv-label">起订量 / 库存</text><text class="kv-value">{{ min }} / {{ stock }} {{ unit }}</text></view>
        <view class="qty-row">
          <text class="kv-label">采购数量</text>
          <view class="stepper">
            <view class="step" @tap="step(-1)">−</view>
            <input v-model="quantity" type="digit" class="qty-input" />
            <view class="step" @tap="step(1)">＋</view>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="card-title">收货信息</text>
        <view v-for="f in fields" :key="f.key" class="form-item">
          <text class="form-label">{{ f.label }}<text class="req"> *</text></text>
          <input v-model="form[f.key]" class="input" :type="f.type" :placeholder="'请输入' + f.label" />
        </view>
      </view>

      <view v-if="error" class="notice error">{{ error }}</view>

      <view class="bottom-bar">
        <view class="grow"><text class="tiny">预估货款</text><text class="price total">{{ money(estimate) }}</text></view>
        <button class="btn btn-primary submit" :disabled="busy" :loading="busy" @tap="submit">提交订单</button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.goods { display: flex; align-items: center; gap: 20rpx; }
.goods-name { display: block; font-size: 30rpx; font-weight: 700; }
.goods .tiny { display: block; margin: 4rpx 0; }
.card-title { display: block; margin-bottom: 8rpx; }
.kv.tap .kv-value { color: var(--c-primary); }
.qty-row { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 0 4rpx; font-size: 26rpx; }
.stepper { display: flex; align-items: center; overflow: hidden; border: 1rpx solid #e0e8e3; border-radius: 16rpx; }
.step { display: flex; width: 80rpx; height: 80rpx; align-items: center; justify-content: center; background: #f5f8f6; color: var(--c-primary); font-size: 34rpx; }
.qty-input { width: 160rpx; height: 80rpx; font-size: 30rpx; text-align: center; }
.total { display: block; font-size: 36rpx; }
.bottom-bar .submit { flex: 0 0 260rpx; }
</style>
