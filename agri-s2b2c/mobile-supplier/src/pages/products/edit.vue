<template>
  <view class="page edit-page">
    <view class="card form-card">
      <view class="card-head"><text class="card-title">{{ id ? '编辑商品' : '发布商品' }}</text><text class="card-sub">PRODUCT FORM</text></view>
      <view class="form-item"><text class="form-label">商品名称 *</text><input v-model="form.name" class="input" placeholder="请输入商品名称" /></view>
      <view class="form-item"><text class="form-label">商品卖点</text><input v-model="form.sellingPoint" class="input" placeholder="一句话说明产品优势" /></view>
      <view class="two-column">
        <view class="form-item half">
          <text class="form-label">商品分类 *</text>
          <picker :range="categories" range-key="name" @change="selectCategory">
            <view class="input picker-value">{{ selectedCategoryName || '请选择分类' }}</view>
          </picker>
        </view>
        <view class="form-item half"><text class="form-label">产地</text><input v-model="form.origin" class="input" placeholder="例如黑龙江五常" /></view>
      </view>
      <view class="two-column">
        <view class="form-item half"><text class="form-label">规格</text><input v-model="form.spec" class="input" placeholder="例如 5kg/袋" /></view>
        <view class="form-item half"><text class="form-label">单位</text><input v-model="form.unit" class="input" placeholder="袋 / 箱 / 斤" /></view>
      </view>
      <view class="two-column">
        <view class="form-item half"><text class="form-label">等级</text><input v-model="form.grade" class="input" placeholder="例如一级" /></view>
        <view class="form-item half"><text class="form-label">认证信息</text><input v-model="form.certifications" class="input" placeholder="有机认证" /></view>
      </view>
      <view class="two-column">
        <view class="form-item half"><text class="form-label">售价 *</text><input v-model="form.price" class="input" type="digit" placeholder="0.00" /></view>
        <view class="form-item half"><text class="form-label">原价</text><input v-model="form.originalPrice" class="input" type="digit" placeholder="0.00" /></view>
      </view>
      <view class="two-column">
        <view class="form-item half"><text class="form-label">库存 *</text><input v-model="form.stock" class="input" type="number" placeholder="0" /></view>
        <view class="form-item half"><text class="form-label">佣金比例(%)</text><input v-model="form.commissionRate" class="input" type="digit" placeholder="10" /></view>
      </view>
      <view class="form-item"><text class="form-label">商品主图地址</text><input v-model="imageUrl" class="input" placeholder="https://..." /></view>
      <view v-if="imageUrl" class="image-preview"><image :src="imageUrl" mode="aspectFill" /><text>主图预览</text></view>
      <view class="form-item"><text class="form-label">商品详情</text><textarea v-model="form.detail" class="textarea" placeholder="填写产地、种植方式、储存方式等" /></view>
      <view class="notice">提交后进入平台审核，审核通过后自动上架。</view>
    </view>
    <view class="fixed-bottom submit-bar">
      <button class="btn btn-block" @tap="goBack">取消</button>
      <button class="btn btn-primary btn-block" :loading="submitting" @tap="submit">提交审核</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { supplierApi } from '../../api'
import { supplierSession } from '../../session'
import { parseImages, toast } from '../../utils'

const categories = [
  { id: 7, name: '大米' }, { id: 8, name: '面粉' }, { id: 9, name: '食用油' },
  { id: 10, name: '调味品' }, { id: 11, name: '时令蔬菜' }, { id: 12, name: '新鲜水果' },
  { id: 14, name: '猪肉' }, { id: 16, name: '鲜蛋' }, { id: 17, name: '绿茶' }, { id: 18, name: '红茶' },
]
const id = ref(0)
const imageUrl = ref('')
const submitting = ref(false)
const form = reactive({
  supplierId: supplierSession.account?.id || 1,
  name: '',
  sellingPoint: '',
  categoryId: null as number | null,
  origin: '',
  grade: '',
  spec: '',
  unit: '',
  price: '' as number | string,
  originalPrice: '' as number | string,
  costPrice: '' as number | string,
  stock: 0 as number | string,
  stockWarning: 10 as number | string,
  commissionRate: 10 as number | string,
  certifications: '',
  detail: '',
  status: 'PENDING',
})
const selectedCategoryName = computed(() => categories.find((item) => item.id === form.categoryId)?.name || '')

onLoad(async (options) => {
  id.value = Number(options?.id || 0)
  if (!id.value) return
  try {
    const product = await supplierApi.getProductDetail(id.value)
    Object.assign(form, {
      supplierId: product.supplierId,
      name: product.name,
      sellingPoint: product.sellingPoint,
      categoryId: product.categoryId,
      origin: product.origin,
      grade: product.grade,
      spec: product.spec,
      unit: product.unit,
      price: product.price || '',
      originalPrice: product.originalPrice || '',
      costPrice: product.costPrice || '',
      stock: product.stock,
      stockWarning: product.stockWarning || 10,
      commissionRate: product.commissionRate || 10,
      certifications: product.certifications || '',
      detail: product.detail || '',
      status: product.status,
    })
    imageUrl.value = parseImages(product.images)[0] || ''
  } catch (error) {
    toast((error as Error).message)
  }
})

function selectCategory(event: any) {
  const index = Number(event.detail.value)
  form.categoryId = categories[index]?.id || null
}

async function submit() {
  if (!form.name.trim()) return toast('请输入商品名称')
  if (!form.categoryId) return toast('请选择商品分类')
  if (!Number(form.price)) return toast('请输入商品售价')
  if (!Number(form.stock)) return toast('请输入商品库存')
  submitting.value = true
  try {
    const payload = {
      ...form,
      id: id.value || undefined,
      images: JSON.stringify(imageUrl.value ? [imageUrl.value] : []),
    }
    const result = id.value
      ? await supplierApi.updateProduct(payload)
      : await supplierApi.createProduct(payload)
    if (!result.success) throw new Error(result.message || '商品保存失败')
    toast(result.message || '商品已提交审核', 'success')
    setTimeout(() => uni.navigateBack(), 350)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped lang="scss">
.edit-page {
  padding-bottom: calc(130rpx + env(safe-area-inset-bottom));
}

.form-card {
  margin-top: 20rpx;
}

.two-column {
  display: flex;
  gap: 12rpx;
}

.half {
  min-width: 0;
  flex: 1;
}

.picker-value {
  color: #0b1a12;
}

.image-preview {
  position: relative;
  width: 190rpx;
  height: 190rpx;
  margin: -4rpx 0 18rpx;
  overflow: hidden;
  border-radius: 16rpx;
}

.image-preview image {
  width: 100%;
  height: 100%;
}

.image-preview text {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8rpx;
  background: rgba(6,40,26,.66);
  color: #fff;
  font-size: 16rpx;
  text-align: center;
}

.notice {
  padding: 17rpx;
  border: 1rpx solid #dcebe2;
  border-radius: 14rpx;
  background: #f5fbf7;
  color: #668074;
  font-size: 18rpx;
  line-height: 1.6;
}

.submit-bar {
  gap: 12rpx;
  bottom: 0;
}

.submit-bar .btn:first-child {
  width: 180rpx;
}
</style>
