<script setup lang="ts">
import { reactive, ref } from 'vue'
import { tradeApi } from '../../api'

const form = reactive({
  demandName: '',
  productName: '',
  categoryName: '',
  quantity: '',
  unit: '吨',
  priceMin: '',
  priceMax: '',
  deliveryAddress: '',
  description: '',
})
const submitting = ref(false)

async function submit() {
  if (!form.demandName.trim() || !form.productName.trim() || !Number(form.quantity)) {
    uni.showToast({ title: '请填写需求名称、产品和采购数量', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await tradeApi.createDemand({
      ...form,
      quantity: Number(form.quantity),
      priceMin: form.priceMin ? Number(form.priceMin) : null,
      priceMax: form.priceMax ? Number(form.priceMax) : null,
    })
    uni.showToast({ title: '需求发布成功', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/demands/index' }), 300)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '发布失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page pad">
    <view class="card">
      <view class="card-head"><text class="card-title">发布采购需求</text><text class="tag">智能撮合</text></view>
      <view class="form-item"><text class="form-label">需求名称</text><input v-model="form.demandName" class="input" placeholder="如：国庆前采购优质苹果" /></view>
      <view class="form-item"><text class="form-label">采购产品</text><input v-model="form.productName" class="input" placeholder="请输入产品名称" /></view>
      <view class="form-item"><text class="form-label">产品品类</text><input v-model="form.categoryName" class="input" placeholder="水果、蔬菜、粮油等" /></view>
      <view class="two"><view class="form-item"><text class="form-label">采购数量</text><input v-model="form.quantity" class="input" type="digit" placeholder="数量" /></view><view class="form-item"><text class="form-label">单位</text><input v-model="form.unit" class="input" /></view></view>
      <view class="two"><view class="form-item"><text class="form-label">最低预算</text><input v-model="form.priceMin" class="input" type="digit" placeholder="选填" /></view><view class="form-item"><text class="form-label">最高预算</text><input v-model="form.priceMax" class="input" type="digit" placeholder="选填" /></view></view>
      <view class="form-item"><text class="form-label">交货地址</text><input v-model="form.deliveryAddress" class="input" placeholder="选填" /></view>
      <view class="form-item"><text class="form-label">详细说明</text><textarea v-model="form.description" class="textarea" placeholder="规格、质量、交付周期等要求" /></view>
      <button class="btn btn-primary" :loading="submitting" @tap="submit">提交采购需求</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.two { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14rpx; }
</style>
