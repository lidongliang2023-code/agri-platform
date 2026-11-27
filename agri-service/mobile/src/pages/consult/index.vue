<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onHide, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import { serviceApi, type Consultation, type Expert } from '../../api'
import { getServiceToken } from '../../auth'

const experts = ref<Expert[]>([])
const consultations = ref<Consultation[]>([])
const loading = ref(false)
const error = ref('')
const refreshError = ref('')
const loaded = ref(false)
let visible = false
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | null = null
const activeExpert = ref<Expert | null>(null)
const submitting = ref(false)
const form = reactive({ type: '图文问诊', subject: '', content: '' })

const consultTypes = ['图文问诊', '视频问诊', '预约上门']
// 问诊与需求共用状态码，但业务含义不同，不能复用接单状态文案。
const consultationStatus: Record<string, { label: string; tone: string }> = {
  accepted: { label: '专家已受理', tone: 'blue' },
  answered: { label: '已回复', tone: 'green' },
}
function statusLabel(status: string): { label: string; tone: string } {
  return consultationStatus[status] ?? { label: '状态待确认', tone: 'gray' }
}

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}
function scheduleRefresh() {
  clearTimer()
  if (visible && getServiceToken() && (error.value || refreshError.value || consultations.value.some(item => item.status === 'accepted'))) {
    timer = setTimeout(() => { void load(true) }, 15000)
  }
}
function pauseRefresh() {
  visible = false
  clearTimer()
  generation += 1
  inFlight = null
  loading.value = false
}
function resumeRefresh() {
  visible = true
  void load(loaded.value)
}
// #ifdef H5
function onVisibilityChange() {
  if (document.hidden) pauseRefresh()
  else resumeRefresh()
}
// #endif
onShow(() => {
  // #ifdef H5
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (document.hidden) return
  // #endif
  resumeRefresh()
})
function leavePage() {
  pauseRefresh()
  // #ifdef H5
  document.removeEventListener('visibilitychange', onVisibilityChange)
  // #endif
}
onHide(leavePage)
onUnload(leavePage)
onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } })

function load(silent = false): Promise<void> {
  if (inFlight) return inFlight
  clearTimer()
  const requestGeneration = ++generation
  const token = getServiceToken()
  loading.value = !silent
  error.value = ''
  refreshError.value = ''
  inFlight = (async () => {
    try {
      const [expertRows, history] = await Promise.all([serviceApi.experts(), serviceApi.consultations()])
      if (requestGeneration !== generation || token !== getServiceToken()) return
      experts.value = expertRows
      consultations.value = history
      loaded.value = true
    } catch (reason) {
      if (requestGeneration !== generation || token !== getServiceToken()) return
      const message = reason instanceof Error ? reason.message : '问诊数据暂不可用'
      if (loaded.value) refreshError.value = `刷新失败，当前显示上次记录：${message}`
      else error.value = message
    } finally {
      if (requestGeneration === generation) {
        loading.value = false
        inFlight = null
        scheduleRefresh()
      }
    }
  })()
  return inFlight
}

function openConsult(expert: Expert, type = '图文问诊') {
  activeExpert.value = expert
  form.type = type
  form.subject = ''
  form.content = ''
}

function closeConsult() { activeExpert.value = null }
function goAi() { uni.navigateTo({ url: '/pages/ai/index' }) }

async function submit() {
  if (!activeExpert.value || submitting.value) return
  if (!form.subject.trim() || !form.content.trim()) {
    uni.showToast({ title: '请填写主题和症状描述', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await serviceApi.createConsultation({
      type: form.type,
      expertId: activeExpert.value.id,
      subject: form.subject.trim(),
      content: form.content.trim(),
    })
    closeConsult()
    // 先等待已有读取完成，再拉取提交后的结果，避免旧请求覆盖新记录。
    if (inFlight) await inFlight
    await load(true)
    uni.showModal({
      title: '问诊已提交',
      content: `问诊号 ${result.consultNo} 已写入当前主体记录，专家复核后会在消息中心通知。`,
      showCancel: false,
    })
  } catch (reason) {
    uni.showToast({ title: reason instanceof Error ? reason.message : '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page page-pad consult-page">
    <view class="hero">
      <text class="hero-kicker">EXPERT CONSULTATION</text>
      <text class="hero-title">农技 / 兽医专家问诊</text>
      <text class="hero-desc">AI 预诊先整理症状，专家再复核判断。文字问诊、视频问诊和预约上门统一留痕。</text>
      <button class="btn btn-ghost hero-btn" @click="goAi">先让 AI 免费预诊 ›</button>
    </view>

    <view v-if="error" class="card error-state"><text>{{ error }}</text><button class="btn btn-ghost" @click="load()">重新加载</button></view>
    <view v-else-if="loading && !experts.length" class="loading">正在加载可接诊专家…</view>
    <template v-else>
      <view class="section-head"><text class="card-title">可接诊专家</text><text class="muted">共 {{ experts.length }} 位在册接诊</text></view>
      <view v-if="!experts.length" class="empty"><text class="empty-icon">👨‍🌾</text><text>当前没有可接诊专家</text></view>
      <view v-else class="expert-list">
        <view v-for="expert in experts" :key="expert.id" class="card expert-card">
          <view class="expert-avatar">{{ expert.avatarIcon || expert.name.slice(0, 1) }}</view>
          <view class="expert-main">
            <view class="between"><text class="strong">{{ expert.name }} · {{ expert.title }}</text><text class="rating">★ {{ expert.rating }}</text></view>
            <text class="muted">{{ expert.organization }}</text>
            <text class="tiny">{{ expert.serviceScope }} · 已接诊 {{ expert.consultCount }} 次</text>
            <text class="expert-summary">{{ expert.summary }}</text>
            <view class="expert-actions">
              <button class="btn btn-primary btn-sm" @click="openConsult(expert)">图文问诊</button>
              <button class="btn btn-sm" @click="openConsult(expert, '视频问诊')">视频问诊</button>
              <button class="btn btn-sm" @click="openConsult(expert, '预约上门')">预约上门</button>
            </view>
          </view>
        </view>
      </view>

      <view class="section-head history-head"><text class="card-title">我的问诊记录</text><button class="btn btn-ghost btn-sm" :disabled="loading" @click="load()">{{ loading ? '刷新中…' : '刷新记录' }}</button></view>
      <text class="tiny">{{ consultations.some(item => item.status === 'accepted') ? '有待回复问诊，停留本页时每 15 秒自动更新' : '回复意见以专家复核为准，可下拉刷新查看最新记录' }}</text>
      <view v-if="refreshError" class="card error-state"><text>{{ refreshError }}</text><button class="btn btn-ghost" @click="load()">重试刷新</button></view>
      <view v-if="!consultations.length" class="card empty-card"><text class="empty-icon">💬</text><text>暂无问诊记录</text></view>
      <view v-for="item in consultations" :key="item.id" class="card history-card">
        <view class="between"><view><text class="strong">{{ item.subject }}</text><text class="tiny">{{ item.consultNo }} · {{ item.type }} · {{ item.createdAt }}</text></view><text class="tag" :class="`tag-${statusLabel(item.status).tone}`">{{ statusLabel(item.status).label }}</text></view>
        <text class="tiny">{{ item.status === 'answered' ? '回复意见' : '受理进度' }}</text>
        <text class="history-text">{{ item.suggestion }}</text>
        <text class="muted">接诊专家：{{ item.expertName }}</text>
        <text v-if="item.status === 'answered'" class="tiny">专家已完成复核，请以回复意见为准</text>
        <text v-else-if="item.status === 'accepted'" class="tiny">等待专家复核，回复后将通过站内消息通知</text>
        <text v-if="item.aiLevel && item.aiLevel !== '待专家复核'" class="tiny">提交时 AI 初判：{{ item.aiLevel }}（仅供参考）</text>
      </view>
    </template>

    <view v-if="activeExpert" class="sheet-mask" @click.self="closeConsult">
      <view class="mobile-sheet">
        <view class="between"><text class="card-title">向 {{ activeExpert.name }} 发起问诊</text><text class="close" @click="closeConsult">×</text></view>
        <view class="form-item"><text class="form-label">问诊方式</text><picker :range="consultTypes" :value="Math.max(0, consultTypes.indexOf(form.type))" @change="form.type = consultTypes[Number($event.detail.value)]"><view class="input">{{ form.type }} ▾</view></picker></view>
        <view class="form-item"><text class="form-label">问诊主题</text><input class="input" v-model="form.subject" placeholder="如：晚稻叶片出现红褐色斑点" /></view>
        <view class="form-item"><text class="form-label">症状描述</text><textarea class="textarea" v-model="form.content" placeholder="发病时间、面积、天气、近期用药和作物阶段" /></view>
        <text class="tiny">本版接收文字描述，提交后结论会写入问诊记录和消息中心。</text>
        <button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting" @click="submit">提交问诊</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.hero { margin: -24rpx -24rpx 24rpx; padding: 34rpx 28rpx 30rpx; border-radius: 0 0 30rpx 30rpx; background: linear-gradient(145deg,#3d275f,#765097); color: #fff; }
.hero-kicker { display: block; color: #e9dafa; font-size: 13px; letter-spacing: 2rpx; }
.hero-title { display: block; margin-top: 12rpx; font-size: 40rpx; font-weight: 750; }
.hero-desc { display: block; margin-top: 12rpx; color: rgba(255,255,255,.75); font-size: 13px; line-height: 1.65; }
.hero-btn { margin-top: 22rpx; border-color: rgba(255,255,255,.5); background: rgba(255,255,255,.12); color: #fff; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 24rpx 0 14rpx; }
.history-head { margin-top: 34rpx; }
.expert-card { display: flex; gap: 18rpx; }
.expert-avatar { display: flex; width: 76rpx; height: 76rpx; flex: 0 0 76rpx; align-items: center; justify-content: center; border-radius: 22rpx; background: #ede4f5; color: #6b418d; font-size: 34rpx; }
.expert-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 7rpx; }
.rating { color: #8f4500; font-size: 13px; }
.expert-summary,.history-text { color: #53665a; font-size: 13px; line-height: 1.6; }
.expert-actions { display: flex; gap: 10rpx; margin-top: 8rpx; }
.expert-actions .btn { flex: 1; min-width: 0; }
.history-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.history-card { display: flex; flex-direction: column; gap: 12rpx; }
.history-card .between > view { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.tag-blue { background: #e7f3fa; color: #176c93; }
.tag-green { background: #e5f5eb; color: #0e5233; }
.tag-gray { background: #eef2ef; color: #52665a; }
.tag-orange { background: #fff3dd; color: #8f4500; }
.tag-red { background: #feebeb; color: #b71c1c; }
.error-state { display: flex; flex-direction: column; gap: 18rpx; }
.empty-card { min-height: 220rpx; }
.close { color: #52665a; font-size: 44rpx; }
</style>
