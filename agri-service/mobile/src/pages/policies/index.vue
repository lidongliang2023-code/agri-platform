<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi, statusMeta, type Policy } from '../../api'

const policies = ref<Policy[]>([])
const applications = ref<Array<{ id: number; applicationNo: string; policyTitle: string; status: string; progress: number; amountText: string; submittedAt: string }>>([])
const applyOpen = ref(false)
const selected = ref<Policy | null>(null)
/** 申报主体由后端从令牌取，前端只展示；表单里只留真正会落库的联系电话。 */
const subjectName = ref('')
const form = reactive({ contactPhone: '' })

onShow(async () => {
  await load()
  const identity = await serviceApi.identity().catch(() => null)
  subjectName.value = identity?.merchantName ?? ''
})

async function load() {
  try {
    const [policyList, appList] = await Promise.all([serviceApi.policies(), serviceApi.policyApplications()])
    policies.value = policyList
    applications.value = appList
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
}

function openApply(policy: Policy) {
  if (policy.status !== 'open') {
    uni.showToast({ title: `《${policy.title}》当前不在申报期`, icon: 'none' })
    return
  }
  selected.value = policy
  applyOpen.value = true
}

async function submit() {
  if (!selected.value) return
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) {
    uni.showToast({ title: '请填写 11 位联系电话', icon: 'none' })
    return
  }
  try {
    const result = await serviceApi.applyPolicy({ policyId: selected.value.id, ...form }) as { applicationNo?: string }
    applyOpen.value = false
    uni.showToast({ title: `申报 ${result?.applicationNo ?? ''} 已提交`, icon: 'none' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '申报失败', icon: 'none' })
  }
}
</script>

<template>
  <view class="page page-pad policy-page">
    <view class="policy-summary"><text class="summary-icon">⚡</text><view><text class="tiny green">按经营主体匹配</text><text class="summary-title">发现 {{ policies.filter((item) => item.status === 'open').length }} 项在申报期内的政策</text><text class="tiny">{{ subjectName || '未取到经营主体，请先在统一登录中绑定主体' }}</text></view></view>
    <view class="card"><view class="card-head"><text class="card-title">为您匹配</text><text class="card-sub">按匹配度排序</text></view><view class="policy-row" v-for="policy in policies" :key="policy.id" @click="openApply(policy)"><view class="score">{{ policy.matchScore }}<text>匹配</text></view><view class="policy-copy"><text class="tag green">{{ policy.level }} · {{ policy.status === 'open' ? '申报中' : '已截止' }}</text><text class="policy-title">{{ policy.title }}</text><text class="muted">{{ policy.conditions }}</text><text class="tiny">{{ policy.amountText }} · {{ policy.deadline }} 截止</text></view><text class="chev">›</text></view></view>
    <view class="card"><view class="card-head"><text class="card-title">我的申报</text></view><view class="application" v-for="app in applications" :key="app.id"><view class="between"><text class="strong">{{ app.policyTitle }}</text><text class="tag" :class="statusMeta(app.status).tone">{{ statusMeta(app.status).label }}</text></view><text class="tiny">{{ app.applicationNo }} · {{ app.amountText }}</text><view class="progress"><view :style="{ width: `${app.progress}%` }" /></view><text class="tiny">{{ app.progress }}% · {{ app.submittedAt }}</text></view><view v-if="applications.length === 0" class="empty">暂无申报记录</view></view>
    <view v-if="applyOpen" class="overlay" @click.self="applyOpen = false">
      <view class="sheet">
        <view class="between"><text class="card-title">申报 · {{ selected?.title }}</text><text class="sheet-close" @click="applyOpen = false">×</text></view>
        <view class="form-item"><text class="form-label">申报主体（登录令牌解析）</text><view class="readonly">{{ subjectName || '—' }}</view></view>
        <view class="form-item"><text class="form-label">联系电话</text><input class="input" type="number" v-model="form.contactPhone" placeholder="11 位手机号" /></view>
        <view class="form-item"><text class="form-label">拟申报额度</text><view class="readonly">{{ selected?.amountText || '—' }}</view></view>
        <view class="materials"><text v-for="material in selected?.materials" :key="material">✓ {{ material }}</text></view>
        <button class="btn btn-primary btn-block" @click="submit">提交申报</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.policy-page { padding: 24rpx; }
.policy-summary { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; padding: 24rpx; border: 1rpx solid #d3e7da; border-radius: 22rpx; background: linear-gradient(135deg,#fff,#eff9f3); }
.summary-icon { display: flex; width: 72rpx; height: 72rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: #12764a; color: #fff; font-size: 32rpx; }
.policy-summary > view { display: flex; flex-direction: column; gap: 4rpx; }
.green { color: #12764a; }
.summary-title { font-size: 29rpx; font-weight: 700; }
.policy-row { display: flex; align-items: center; gap: 14rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf2ee; }
.policy-row:last-child { border-bottom: 0; }
.score { display: flex; width: 76rpx; height: 76rpx; flex: 0 0 76rpx; align-items: center; justify-content: center; flex-direction: column; border-radius: 50%; background: #f2fbf5; color: #0e5233; font-family: monospace; font-size: 25rpx; font-weight: 700; }
.score text { font-family: sans-serif; font-size: 24rpx; font-weight: 400; }
.policy-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5rpx; }
.policy-title { font-size: 24rpx; font-weight: 650; }
.chev { color: #94a198; font-size: 38rpx; }
.application { margin-bottom: 14rpx; padding: 16rpx; border: 1rpx solid #e1e9e3; border-radius: 15rpx; }
.application > text { display: block; margin: 5rpx 0; }
.overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; background: rgba(5,25,15,.45); }
.sheet { width: 100%; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 30rpx 30rpx 0 0; background: #fff; }
.sheet-close { color: #718277; font-size: 44rpx; }
.materials { display: flex; gap: 8rpx; flex-wrap: wrap; margin-bottom: 20rpx; padding: 16rpx; border-radius: 13rpx; background: #f2fbf5; }
.materials text { color: #0e5233; font-size: 24rpx; }
.readonly { min-height: 68rpx; padding: 18rpx 20rpx; border: 1rpx solid #e6ede8; border-radius: 14rpx; background: #f6f9f7; color: #55655b; font-size: 24rpx; }
</style>
