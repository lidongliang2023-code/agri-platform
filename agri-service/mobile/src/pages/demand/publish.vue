<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'

const natural = ref('')
const submitting = ref(false)
const categories = ref<string[]>(['农机作业', '植保防疫', '粮食烘干', '检测认证', '农技问诊'])
const minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const form = reactive({
  category: '农机作业',
  serviceName: '',
  description: '',
  location: '',
  area: '',
  preferredDate: minDate,
  budgetMin: '',
  budgetMax: '',
  contactName: '',
  contactPhone: '',
})

onShow(async () => {
  try {
    const [dict, identity] = await Promise.all([
      serviceApi.dictionaries(),
      serviceApi.identity().catch(() => null),
    ])
    if (dict.categories?.length) {
      categories.value = dict.categories
      if (!dict.categories.includes(form.category)) form.category = dict.categories[0]
    }
    form.contactName = identity?.merchantName ?? ''
  } catch {
    // 字典取不到时保留内置候选，发布仍可提交，由服务端做最终校验
  }
})

function parseByAi() {
  const text = natural.value.trim()
  if (!text) {
    uni.showToast({ title: '先说一句需求', icon: 'none' })
    return
  }
  const area = text.match(/(\d+)\s*亩/)?.[1]
  if (text.includes('飞防') || text.includes('植保') || text.includes('施药')) form.category = '植保防疫'
  else if (text.includes('烘干')) form.category = '粮食烘干'
  else if (text.includes('检测')) form.category = '检测认证'
  else if (text.includes('问') || text.includes('诊断')) form.category = '农技问诊'
  else form.category = categories.value.includes('农机作业') ? '农机作业' : categories.value[0]
  const price = text.match(/(\d+(?:\.\d+)?)\s*元/)?.[1]
  form.serviceName = text.slice(0, 20)
  form.description = text
  form.area = area ? `${area}亩` : ''
  if (price) {
    form.budgetMin = price
    form.budgetMax = String(Math.round(Number(price) * 1.15 * 100) / 100)
  }
  uni.showToast({ title: '已按描述填充，请核对后再发布', icon: 'none' })
}

async function submit() {
  if (!form.serviceName || !form.location || !form.area) {
    uni.showToast({ title: '请补全需求标题、服务地点和面积', icon: 'none' })
    return
  }
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) {
    uni.showToast({ title: '请填写 11 位联系电话', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await serviceApi.createDemand(form) as { demandNo?: string; matchCount?: number }
    uni.showModal({
      title: '需求已发布',
      content: `需求号 ${result?.demandNo ?? ''}，同类目在营服务商 ${result?.matchCount ?? 0} 家已进入匹配池。`,
      showCancel: false,
      success: () => uni.switchTab({ url: '/pages/services/index' }),
    })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '发布失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page page-pad demand-page">
    <view class="ai-box">
      <view class="ai-title">
        <view class="ai-icon">✨</view>
        <view>
          <text class="strong">说一句话生成需求</text>
          <text class="muted">按关键词拆出类型、面积与预算，填充后仍可手工修改</text>
        </view>
      </view>
      <textarea class="textarea" v-model="natural" placeholder="例：我有 50 亩晚稻，在乔口镇，后天想找履带式收割机，预算 60 元一亩…" />
      <button class="btn btn-primary" @click="parseByAi">✨ 解析并填充</button>
    </view>
    <view class="card">
      <view class="form-item">
        <text class="form-label">服务类型</text>
        <picker :range="categories" @change="form.category = categories[Number($event.detail.value)]">
          <view class="input">{{ form.category }} ▾</view>
        </picker>
      </view>
      <view class="form-item"><text class="form-label">需求标题</text><input class="input" v-model="form.serviceName" placeholder="如：50 亩晚稻机收" /></view>
      <view class="form-item"><text class="form-label">详细描述</text><textarea class="textarea" v-model="form.description" placeholder="机型、作业标准、运输与验收要求" /></view>
      <view class="form-item"><text class="form-label">服务地点</text><input class="input" v-model="form.location" placeholder="村镇 + 地块" /></view>
      <view class="grid-2">
        <view class="form-item"><text class="form-label">面积 / 数量</text><input class="input" v-model="form.area" placeholder="如 50亩" /></view>
        <view class="form-item">
          <text class="form-label">期望日期</text>
          <picker mode="date" :start="minDate" @change="form.preferredDate = $event.detail.value">
            <view class="input">{{ form.preferredDate }} ▾</view>
          </picker>
        </view>
      </view>
      <view class="grid-2">
        <view class="form-item"><text class="form-label">最低预算</text><input class="input" type="digit" v-model="form.budgetMin" /></view>
        <view class="form-item"><text class="form-label">最高预算</text><input class="input" type="digit" v-model="form.budgetMax" /></view>
      </view>
      <view class="grid-2">
        <view class="form-item"><text class="form-label">联系人</text><input class="input" v-model="form.contactName" /></view>
        <view class="form-item"><text class="form-label">联系电话</text><input class="input" type="number" v-model="form.contactPhone" placeholder="11 位手机号" /></view>
      </view>
      <button class="btn btn-primary btn-block" :loading="submitting" @click="submit">发布需求并智能匹配</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.demand-page { padding: 24rpx; }
.ai-box { margin-bottom: 20rpx; padding: 24rpx; border: 1rpx solid #dfd1e9; border-radius: 24rpx; background: linear-gradient(145deg, #fbf8fd, #f2eaf8); }
.ai-title { display: flex; align-items: center; gap: 14rpx; margin-bottom: 16rpx; }
.ai-title > view:last-child { display: flex; flex-direction: column; gap: 4rpx; }
.ai-title .ai-icon { width: 64rpx; height: 64rpx; border-radius: 17rpx; background: #6b458b; color: #fff; font-size: 29rpx; }
.ai-box .btn { margin-top: 16rpx; }
</style>
