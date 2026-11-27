<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'

const categories = ref<string[]>(['农机作业'])
const applicant = ref('')
const availableProviders = ref(0)
const submitting = ref(false)
const success = ref<{ name: string; status: string; message: string } | null>(null)
const form = reactive({ name: '', category: '农机作业', phone: '', region: '', certifications: '', description: '' })

onShow(async () => {
  try {
    const [dict, identity, providers] = await Promise.all([serviceApi.dictionaries(), serviceApi.identity().catch(() => null), serviceApi.providers({})])
    if (dict.categories?.length) { categories.value = dict.categories; if (!dict.categories.includes(form.category)) form.category = dict.categories[0] }
    applicant.value = identity?.merchantName || ''
    availableProviders.value = providers.length
  } catch { availableProviders.value = 0 }
})

async function submit() {
  if (submitting.value) return
  if (!form.name.trim() || !form.category || !/^1[3-9]\d{9}$/.test(form.phone) || !form.region.trim() || !form.certifications.trim() || !form.description.trim()) {
    uni.showToast({ title: '请补全入驻资料，电话需为 11 位手机号', icon: 'none' }); return
  }
  submitting.value = true
  try {
    success.value = await serviceApi.applyProvider({ ...form, name: form.name.trim(), region: form.region.trim(), certifications: form.certifications.trim(), description: form.description.trim() })
    uni.showToast({ title: '申请已提交', icon: 'success' })
  } catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '申请失败', icon: 'none' }) }
  finally { submitting.value = false }
}
function reset() { success.value = null; form.name = ''; form.phone = ''; form.region = ''; form.certifications = ''; form.description = '' }
</script>

<template>
  <view class="page page-pad join-page">
    <view class="hero"><text class="hero-kicker">PROVIDER ONBOARDING</text><text class="hero-title">让专业能力被看见</text><text class="hero-desc">面向农机、农技、检测、培训与涉农服务机构。入驻档案归属当前登录经营主体，审核通过后进入服务超市。</text><view class="metric"><text><b>{{ availableProviders }}</b> 家在营服务商</text><text><b>{{ applicant || '未解析' }}</b> · 本次申请主体</text></view></view>
    <view v-if="success" class="card success-card"><text class="success-icon">✓</text><text class="card-title">申请已提交</text><text class="muted">{{ success.name }} 的入驻资料已进入审核队列，审核结论会写入消息中心。</text><view class="field"><text class="field-label">申请状态</text><text class="tag tag-orange">{{ success.status === 'pending' ? '待审核' : success.status }}</text></view><button class="btn btn-primary btn-block" @click="reset">继续提交资料</button></view>
    <view v-else class="card"><view class="section-head"><text class="card-title">提交入驻资料</text><text class="muted">当前主体：{{ applicant || '由登录令牌解析' }}</text></view><view class="form-item"><text class="form-label">服务商名称</text><input class="input" v-model="form.name" placeholder="公司、合作社或服务队名称" /></view><view class="form-item"><text class="form-label">服务类型</text><picker :range="categories" @change="form.category = categories[Number($event.detail.value)]"><view class="input">{{ form.category }} ▾</view></picker></view><view class="form-item"><text class="form-label">联系电话</text><input class="input" type="number" v-model="form.phone" placeholder="11 位手机号" /></view><view class="form-item"><text class="form-label">主要服务区域</text><input class="input" v-model="form.region" placeholder="如：望城区乔口镇及周边 30km" /></view><view class="form-item"><text class="form-label">资质与证照名称</text><input class="input" v-model="form.certifications" placeholder="如：营业执照、农机作业许可" /></view><view class="form-item"><text class="form-label">服务能力与优势</text><textarea class="textarea" v-model="form.description" placeholder="服务项目、设备数量、人员资质、过往服务规模等" /></view><text class="tiny">本版接收资质名称，不上传证照图片；平台审核时线下查验原件。</text><button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting" @click="submit">提交入驻审核</button></view>
    <view class="benefits"><view class="card"><text class="benefit-icon">⚡</text><text class="strong">获得服务需求</text><text class="muted">进入需求大厅的抢单池</text></view><view class="card"><text class="benefit-icon">🛠️</text><text class="strong">建立服务档案</text><text class="muted">展示资质、评价与服务区域</text></view><view class="card"><text class="benefit-icon">🤝</text><text class="strong">履约协同</text><text class="muted">订单、进度和验收统一留痕</text></view></view>
  </view>
</template>

<style lang="scss" scoped>
.hero { margin: -24rpx -24rpx 24rpx; padding: 34rpx 28rpx 30rpx; border-radius: 0 0 30rpx 30rpx; background: linear-gradient(145deg,#063521,#0f8150); color: #fff; }
.hero-kicker { display: block; color: #bfe6cd; font-size: 13px; letter-spacing: 2rpx; }
.hero-title { display: block; margin-top: 12rpx; font-size: 40rpx; font-weight: 750; }
.hero-desc { display: block; margin-top: 12rpx; color: rgba(255,255,255,.72); font-size: 13px; line-height: 1.65; }
.metric { display: flex; justify-content: space-between; gap: 15rpx; margin-top: 24rpx; color: #d7f0df; font-size: 13px; }
.metric text { min-width: 0; flex: 1; }
.metric b { display: block; overflow: hidden; color: #fff; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; margin-bottom: 20rpx; }
.section-head > text:last-child { max-width: 47%; text-align: right; }
.success-card { display: flex; align-items: center; flex-direction: column; gap: 12rpx; text-align: center; }
.success-icon { display: flex; width: 84rpx; height: 84rpx; align-items: center; justify-content: center; border-radius: 50%; background: #e5f5eb; color: #12764a; font-size: 50rpx; font-weight: 700; }
.success-card .field { width: 100%; margin: 12rpx 0; padding: 12rpx 0; }
.benefits { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10rpx; margin-top: 18rpx; }
.benefits .card { display: flex; align-items: center; flex-direction: column; gap: 7rpx; margin: 0; padding: 18rpx 8rpx; text-align: center; }
.benefits .strong { font-size: 13px; }
.benefits .muted { font-size: 13px; }
.benefit-icon { font-size: 34rpx; }
</style>
