<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { serviceApi, statusMeta } from '../../api'
const rows = ref<Awaited<ReturnType<typeof serviceApi.complaints>>>([])
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const form = reactive({ orderNo: '', category: '服务纠纷', description: '', demand: '' })
const categories = ['服务纠纷', '预约问题', '平台建议', '其他问题']
onLoad(options => { form.orderNo = String(options?.orderNo || '') })
onShow(load)
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try { rows.value = await serviceApi.complaints() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '反馈加载失败' }
  finally { loading.value = false }
}
async function submit() {
  if (submitting.value) return
  if (!form.description.trim()) return uni.showToast({ title: '请填写问题描述', icon: 'none' })
  submitting.value = true
  try {
    await serviceApi.createComplaint({ ...form, orderNo: form.orderNo.trim(), description: form.description.trim(), demand: form.demand.trim() })
    form.description = ''; form.demand = ''
    uni.showToast({ title: '反馈已提交', icon: 'success' })
    await load()
  } catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '提交失败', icon: 'none' }) }
  finally { submitting.value = false }
}
</script>
<template>
  <view class="page page-pad">
    <view class="card">
      <view class="card-head"><text class="card-title">提交问题</text><text class="muted">平台受理后同步处理进度</text></view>
      <view class="form-item"><text class="form-label">关联订单（选填，仅限本主体订单）</text><input class="input" v-model="form.orderNo" maxlength="40" placeholder="从订单详情进入时自动填写" /></view>
      <view class="form-item"><text class="form-label">问题类型</text><picker :range="categories" @change="form.category = categories[Number($event.detail.value)]"><view class="input">{{ form.category }} ▾</view></picker></view>
      <view class="form-item"><text class="form-label">问题描述</text><textarea class="textarea" v-model="form.description" maxlength="1000" placeholder="请说明发生的情况、时间及需要核实的问题" /></view>
      <view class="form-item"><text class="form-label">期望处理方式（选填）</text><textarea class="textarea" v-model="form.demand" maxlength="500" placeholder="例如：希望平台协调重新安排作业时间" /></view>
      <button class="btn btn-primary btn-block" :disabled="submitting" :loading="submitting" @click="submit">提交反馈</button>
    </view>
    <view class="card-head"><text class="card-title">我的反馈</text><button class="btn btn-sm" @click="load">刷新</button></view>
    <view v-if="loading" class="loading">正在加载处理记录…</view>
    <view v-else-if="error" class="empty"><text>{{ error }}</text><button class="btn" @click="load">重试</button></view>
    <view v-else-if="!rows.length" class="empty">暂无反馈记录</view>
    <view v-else v-for="row in rows" :key="row.id" class="card feedback-row"><view class="between"><text class="strong">{{ row.complaintNo }}</text><text class="tag" :class="statusMeta(row.status).tone">{{ statusMeta(row.status).label }}</text></view><text>{{ row.description }}</text><text v-if="row.orderNo" class="tiny">订单 {{ row.orderNo }}</text><text v-if="row.resolution" class="muted">处理结果：{{ row.resolution }}</text><view class="progress"><view :style="{ width: `${row.progress}%` }" /></view></view>
  </view>
</template>
<style scoped>
.feedback-row { display: flex; flex-direction: column; gap: 16rpx; overflow-wrap: anywhere; }
.card-head { flex-wrap: wrap; }
</style>
