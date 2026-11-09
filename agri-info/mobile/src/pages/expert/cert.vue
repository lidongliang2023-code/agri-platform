<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type Expert } from '../../api'

const records = ref<Expert[]>([])
const loading = ref(true)

const current = computed(() => records.value[0])
const approved = computed(() =>
  records.value.find((item) => item.status === 'approved' || item.status === 'active'),
)
const pending = computed(() => records.value.find((item) => item.status === 'pending'))

const validDays = computed(() => {
  const date = approved.value?.auditAt
  if (!date) return 0
  const target = new Date(String(date).replace(/-/g, '/'))
  if (Number.isNaN(target.getTime())) return 0
  target.setFullYear(target.getFullYear() + 2)
  return Math.max(0, Math.round((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
})

const steps = computed(() => {
  const item = approved.value || current.value
  if (!item) return []
  return [
    { title: '提交申请', note: item.applyAt || '—', done: true },
    { title: '材料初审', note: '材料齐全，初审通过', done: true },
    { title: '专家评审', note: item.auditNote || '同领域专家交叉评审', done: item.status !== 'pending' },
    { title: '链上存证并公示', note: '生成认证编号与链上凭证', done: item.status === 'approved' || item.status === 'active' },
  ]
})

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    records.value = await infoApi.myExpert()
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function toApply() {
  uni.navigateTo({ url: '/pages/expert/apply' })
}

function toVerify() {
  uni.navigateTo({ url: '/pages/expert/verify' })
}

function openProfile() {
  const item = approved.value || current.value
  if (!item) return
  uni.navigateTo({ url: `/pages/expert/detail?id=${item.id}` })
}

function renew() {
  uni.showModal({
    title: '认证续期',
    content: '续期需重新提交资质材料，到期前 30 / 15 / 7 天平台会分别提醒。确认后进入申请页。',
    success: (result: { confirm: boolean }) => {
      if (result.confirm) toApply()
    },
  })
}

function downloadCert() {
  uni.showModal({
    title: '下载认证证书',
    content: `将生成《${current.value?.name || ''} · ${current.value?.certNo || ''} 专家认证证书》PDF。`,
    success: (result: { confirm: boolean }) => {
      if (result.confirm) toast('已生成下载任务')
    },
  })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">正在加载…</view>

    <template v-else-if="!records.length">
      <view class="empty" style="min-height: 60vh">
        <text class="empty-icon">🎖</text>
        <text>还没有提交专家认证</text>
        <text class="tiny">认证通过后可在主页、回答与供需信息展示认证徽章</text>
        <button class="btn btn-primary btn-sm" style="margin-top: 16rpx" @click="toApply">立即申请认证</button>
      </view>
    </template>

    <template v-else>
      <view class="cert-card" @click="openProfile">
        <view class="cert-top">
          <text class="cert-icon">🎖</text>
          <view class="cert-copy">
            <text class="cert-title">
              {{ approved ? `${approved.level} · 有效` : pending ? '认证审核中' : current?.level }}
            </text>
            <text class="cert-sub">{{ current?.name }} · {{ current?.field }}</text>
          </view>
          <text :class="['tag', approved ? 'green' : 'orange']">
            {{ approved ? '已上链' : '待审核' }}
          </text>
        </view>

        <view class="cert-fields">
          <view class="cert-field">
            <text class="cert-label">认证编号</text>
            <text class="cert-value">{{ current?.certNo }}</text>
          </view>
          <view class="cert-field">
            <text class="cert-label">认证等级</text>
            <text class="cert-value">{{ current?.level }}</text>
          </view>
          <view class="cert-field">
            <text class="cert-label">审核时间</text>
            <text class="cert-value">{{ current?.auditAt || '—' }}</text>
          </view>
        </view>
      </view>

      <view class="page-pad">
        <view v-if="approved" class="card">
          <view class="card-head">
            <text class="card-title">有效期</text>
            <text class="card-sub" @click="renew">续期 ›</text>
          </view>
          <view class="notice">
            <text>⏳</text>
            <text>距到期还有 {{ validDays }} 天，可提前续期；到期前 30 / 15 / 7 天将分别提醒，续期需重新提交资质材料。</text>
          </view>
        </view>

        <view v-if="pending" class="card">
          <view class="card-head">
            <text class="card-title">审核进度</text>
          </view>
          <view class="notice">
            <text>·</text>
            <text>{{ pending.auditNote || '材料已提交，平台将在 7 个工作日内完成审核。' }}</text>
          </view>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">审核进度</text>
          </view>
          <view v-for="(step, index) in steps" :key="index" class="step">
            <view :class="['step-dot', { done: step.done }]" />
            <view class="step-copy">
              <text class="strong">{{ step.title }}</text>
              <text class="tiny">{{ step.note }}</text>
            </view>
          </view>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">认证材料</text>
            <text class="card-sub" @click="toApply">补充材料 ›</text>
          </view>
          <view class="field">
            <text class="field-label">职称证书</text>
            <text class="field-value">{{ current?.title || '高级农艺师' }} · 已通过核验</text>
          </view>
          <view class="field">
            <text class="field-label">身份证</text>
            <text class="field-value">已通过核验</text>
          </view>
          <view class="field">
            <text class="field-label">从业证明</text>
            <text class="field-value">{{ current?.orgName || '合作社任职' }}</text>
          </view>
          <view class="field">
            <text class="field-label">学历证明</text>
            <text class="field-value">未上传（选填，上传可提升权重）</text>
          </view>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">认证权益</text>
          </view>
          <view class="benefit">
            <text class="benefit-icon">🎖</text>
            <view class="benefit-copy">
              <text class="strong">认证徽章展示</text>
              <text class="tiny">主页、回答、供需信息均展示认证标识</text>
            </view>
          </view>
          <view class="benefit">
            <text class="benefit-icon">📈</text>
            <view class="benefit-copy">
              <text class="strong">优先推荐</text>
              <text class="tiny">问答与专家列表优先曝光</text>
            </view>
          </view>
          <view class="benefit">
            <text class="benefit-icon">💰</text>
            <view class="benefit-copy">
              <text class="strong">咨询收益</text>
              <text class="tiny">图文 / 电话咨询收益 T+7 结算</text>
            </view>
          </view>
        </view>

        <view class="btn-row">
          <button class="btn grow" @click="downloadCert">下载证书</button>
          <button class="btn btn-primary grow" @click="toVerify">核验认证</button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.cert-card {
  margin: 20rpx 24rpx 0;
  padding: 26rpx;
  border-radius: 26rpx;
  background: radial-gradient(circle at 92% 0, rgba(255, 255, 255, 0.14), transparent 300rpx), linear-gradient(145deg, #0b5c3a, #12764a);
  color: #ffffff;
  box-shadow: 0 14rpx 32rpx rgba(18, 118, 74, 0.18);
}

.cert-top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.cert-icon {
  font-size: 40rpx;
}

.cert-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.cert-title {
  font-size: 30rpx;
  font-weight: 750;
}

.cert-sub {
  color: rgba(255, 255, 255, 0.72);
  font-size: 24rpx;
}

.cert-fields {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.16);
}

.cert-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cert-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 24rpx;
}

.cert-value {
  font-family: "DIN Alternate", monospace;
  font-size: 24rpx;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.step:last-child {
  border-bottom: 0;
}

.step-dot {
  width: 16rpx;
  height: 16rpx;
  margin-top: 10rpx;
  border-radius: 50%;
  background: #d5dfd8;
}

.step-dot.done {
  background: #12764a;
}

.step-copy {
  display: flex;
  flex-direction: column;
  gap: 3rpx;
}

.benefit {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.benefit:last-child {
  border-bottom: 0;
}

.benefit-icon {
  font-size: 28rpx;
}

.benefit-copy {
  display: flex;
  flex-direction: column;
  gap: 3rpx;
}

.btn-row {
  display: flex;
  gap: 14rpx;
  margin: 20rpx 0 40rpx;
}

.grow {
  flex: 1;
}
</style>
