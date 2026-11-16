<script setup lang="ts">
import { ref } from 'vue'
import { API_ORIGIN, getTradeToken, handleTradeUnauthorized } from '../auth'
const props = defineProps<{ model: Record<string, any> }>()
const uploading = ref(false)
const skuText = [{ key: 'skuName', label: '规格名称' }, { key: 'skuCode', label: '规格编码' }, { key: 'barcode', label: '条码' }, { key: 'unit', label: '单位' }]
const skuNumber = [{ key: 'price', label: '单价' }, { key: 'stockQuantity', label: '库存' }, { key: 'minOrderQuantity', label: '起订量' }]
function toggle(sku: Record<string, any>, event: any) { sku.status = event.detail.value ? 1 : 0 }
function addSku() { (props.model.skus ||= []).push({ skuCode: 'SKU-' + Date.now(), skuName: '', unit: props.model.unit || '吨', price: props.model.price || 0, stockQuantity: 0, minOrderQuantity: 1, status: 1, sortOrder: props.model.skus.length + 1 }) }
async function upload() {
  if (uploading.value) return
  uploading.value = true
  try {
    const paths = await new Promise<string[]>((resolve, reject) => uni.chooseImage({ count: Math.max(1, 9 - (props.model.images || []).length), sizeType: ['compressed'], success: r => resolve(r.tempFilePaths as string[]), fail: reject }))
    for (const path of paths) {
      const url = await new Promise<string>((resolve, reject) => uni.uploadFile({
        url: API_ORIGIN + '/api/trade/seller/product/image', filePath: path, name: 'file', timeout: 20000, header: { Authorization: 'Bearer ' + getTradeToken() },
        success: r => { try { const b = JSON.parse(r.data); if (r.statusCode === 401 || b.code === 401) handleTradeUnauthorized(); if (r.statusCode >= 400 || b.code !== 200 || !b.data?.url) throw new Error(b.message || '图片上传失败'); resolve(b.data.url) } catch (e) { reject(e) } },
        fail: reject,
      }))
      ;(props.model.images ||= []).push(url)
    }
  } catch (e) { uni.showToast({ title: e instanceof Error ? e.message : '图片上传未完成', icon: 'none' }) } finally { uploading.value = false }
}
function imageUrl(url: string) { return url.startsWith('/') ? API_ORIGIN + url : url }
</script>

<template>
  <view class="product-fields">
    <text class="form-label">商品图片（最多 9 张）<text class="req"> *</text></text>
    <view class="images">
      <view v-for="(url, i) in model.images || []" :key="url" class="thumb">
        <image :src="imageUrl(url)" mode="aspectFill" />
        <view class="remove" @tap="model.images.splice(i, 1)">×</view>
      </view>
      <view v-if="(model.images || []).length < 9" class="thumb add" @tap="upload"><text>{{ uploading ? '上传中…' : '＋ 添加' }}</text></view>
    </view>

    <view class="form-item">
      <text class="form-label">认证资料</text>
      <textarea v-model="model.certificationsText" class="textarea" placeholder="多个认证用逗号分隔" />
    </view>

    <text class="form-label">规格与库存</text>
    <text class="hint">未添加规格时使用上方单价、库存和起订量；添加后按各规格汇总。</text>
    <view v-for="(sku, i) in model.skus || []" :key="i" class="sku">
      <view class="between sku-head"><text class="sku-title">规格 {{ i + 1 }}</text><text class="sku-del" @tap="model.skus.splice(i, 1)">删除</text></view>
      <view v-for="field in skuText" :key="field.key" class="sku-row"><text class="sku-label">{{ field.label }}</text><input v-model="sku[field.key]" class="input" :placeholder="field.label" /></view>
      <view v-for="field in skuNumber" :key="field.key" class="sku-row"><text class="sku-label">{{ field.label }}</text><input v-model="sku[field.key]" type="digit" class="input" /></view>
      <view class="sku-row"><text class="sku-label">启用规格</text><switch :checked="sku.status === 1" color="#12764a" @change="toggle(sku, $event)" /></view>
    </view>
    <button class="btn btn-line btn-block" @tap="addSku">＋ 添加规格</button>
  </view>
</template>

<style scoped>
.product-fields { margin-top: 8rpx; }
.images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16rpx; margin-bottom: 28rpx; }
.thumb { position: relative; overflow: hidden; height: 180rpx; border-radius: 16rpx; background: #fff; }
.thumb image { width: 100%; height: 100%; }
.thumb.add { display: flex; align-items: center; justify-content: center; border: 2rpx dashed #c5d6cb; color: var(--c-primary); font-size: 26rpx; }
.remove { position: absolute; top: 0; right: 0; display: flex; width: 56rpx; height: 56rpx; align-items: center; justify-content: center; border-radius: 0 0 0 16rpx; background: rgba(0, 0, 0, .5); color: #fff; font-size: 32rpx; }
.hint { display: block; margin: -4rpx 0 16rpx; color: var(--c-text-3); font-size: 24rpx; line-height: 1.6; }
.sku { margin-bottom: 20rpx; padding: 8rpx 24rpx 16rpx; border-radius: 20rpx; background: #fff; }
.sku-head { min-height: 72rpx; }
.sku-title { font-size: 28rpx; font-weight: 700; }
.sku-del { display: flex; min-height: 64rpx; align-items: center; padding-left: 24rpx; color: var(--c-danger); font-size: 26rpx; }
.sku-row { display: flex; align-items: center; gap: 20rpx; margin: 12rpx 0; }
.sku-label { width: 140rpx; flex-shrink: 0; color: var(--c-text-2); font-size: 26rpx; }
.sku-row .input { min-width: 0; flex: 1; min-height: 76rpx; }
</style>
