<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { serviceApi, type Consultation, type ExpertProfile } from '../../api'
import { confirmAction } from '../../utils'

const expert = ref<ExpertProfile | null>(null)
const items = ref<Consultation[]>([])
const loading = ref(false)
const error = ref('')
const filter = ref('accepted')
const active = ref<Consultation | null>(null)
const content = ref('')
const submitting = ref(false)
const visible = computed(() => items.value.filter(item => item.status === filter.value))
const pending = computed(() => items.value.filter(item => item.status === 'accepted').length)
onShow(load)
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })
async function load() {
  if (loading.value || submitting.value) return
  loading.value = true; error.value = ''; active.value = null
  expert.value = null; items.value = []
  try {
    const [profile, rows] = await Promise.all([serviceApi.expertProfile(), serviceApi.expertConsultations()])
    expert.value = profile; items.value = rows
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '问诊暂时加载失败' }
  finally { loading.value = false }
}
function open(item: Consultation) { active.value = item; content.value = '' }
function close() { if (!submitting.value) active.value = null }
async function reply() {
  if (!active.value || submitting.value) return
  const text = content.value.trim()
  if (!text || Array.from(text).length > 1200) { uni.showToast({ title: '请填写 1 至 1200 字回复', icon: 'none' }); return }
  submitting.value = true
  const id = active.value.id
  try {
    if (!await confirmAction('发送专家回复', '回复将保存至问诊记录并通知用户，发送后不可重复修改。确认发送？')) return
    await serviceApi.replyConsultation(id, text)
    active.value = null
    uni.showToast({ title: '回复已发送', icon: 'success' })
    submitting.value = false
    await load()
  } catch (reason) { uni.showModal({ title: '回复未发送', content: reason instanceof Error ? reason.message : '请稍后重试', showCancel: false }) }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="page page-pad expert-page">
    <view class="intro"><text class="title">专家工作台</text><text class="muted">{{ expert ? `${expert.name} · ${expert.title || '接诊专家'}` : '统一账号 · 本人接诊' }}</text><text class="intro-note">查看分配给你的问诊，向用户提供清晰、可执行的复核意见。</text></view>
    <view v-if="error" class="card state"><text class="strong">暂时无法进入工作台</text><text>{{ error }}</text><button class="btn btn-primary" @click="load">重新加载</button><text class="tiny">专家账号由平台运营在“专家账号绑定”中配置，登录账号还需具有综合服务读写权限。</text></view>
    <view v-else-if="loading" class="loading">正在加载本人问诊…</view>
    <template v-else>
      <view class="filters"><button class="btn" :class="{ selected: filter === 'accepted' }" @click="filter = 'accepted'">待回复 {{ pending }}</button><button class="btn" :class="{ selected: filter === 'answered' }" @click="filter = 'answered'">已回复 {{ items.filter(item => item.status === 'answered').length }}</button></view>
      <view v-if="!visible.length" class="card state"><text class="strong">{{ filter === 'accepted' ? '当前没有待回复问诊' : '暂无已回复记录' }}</text><text class="muted">下拉刷新查看最新问诊。</text></view>
      <view v-for="item in visible" :key="item.id" class="card consultation">
        <view class="between"><text class="strong subject">{{ item.subject }}</text><text class="tag" :class="item.status === 'accepted' ? 'tag-orange' : 'tag-green'">{{ item.status === 'accepted' ? '待回复' : '已回复' }}</text></view>
        <text class="tiny">{{ item.consultNo }} · {{ item.type }}</text><text class="tiny">提交于 {{ item.createdAt }}</text>
        <text class="field-label">症状描述</text><text class="body-text">{{ item.content }}</text>
        <template v-if="item.status === 'answered'"><text class="field-label">回复意见</text><text class="body-text answer">{{ item.suggestion }}</text><text v-if="item.repliedAt" class="tiny">回复于 {{ item.repliedAt }}</text></template>
        <button v-else class="btn btn-primary btn-block" @click="open(item)">填写回复意见</button>
      </view>
    </template>
    <view v-if="active" class="sheet-mask expert-mask" @click.self="close">
      <view class="mobile-sheet reply-sheet">
        <view class="between sheet-header">
          <text class="card-title">回复问诊</text>
          <button class="btn btn-sm" :disabled="submitting" @click="close">关闭</button>
        </view>
        <scroll-view scroll-y class="reply-scroll">
          <view class="reply-form">
            <text class="strong subject">{{ active.subject }}</text>
            <text class="tiny">{{ active.consultNo }}</text>
            <text class="field-label">症状描述</text>
            <text class="body-text">{{ active.content }}</text>
            <text class="form-label">复核意见</text>
            <textarea v-model="content" class="textarea reply-input" :maxlength="1200" :disabled="submitting" :adjust-position="true" :cursor-spacing="24" :show-confirm-bar="true" placeholder="说明判断依据、建议措施、观察事项及需要线下复核的情况" />
            <text class="tiny">{{ Array.from(content).length }} / 1200 字 · 发送后会通知用户</text>
          </view>
        </scroll-view>
        <view class="sheet-footer">
          <button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting || !content.trim()" @click="reply">发送专家回复</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.expert-page { padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); font-size: 15px; }
.expert-page .btn { min-height: 44px; box-sizing: border-box; padding: 8px 14px; font-size: 15px; line-height: 1.4; }
.expert-page .tiny, .expert-page .muted, .expert-page .field-label, .expert-page .form-label { color: #53665a; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.intro { display: flex; flex-direction: column; gap: 12rpx; margin-bottom: 28rpx; padding: 12rpx 0 24rpx; border-bottom: 2rpx solid #dce8df; }
.title { color: #174a34; font-size: 22px; font-weight: 700; }
.intro-note { font-size: 14px; color: #53665a; line-height: 1.6; }
.filters { display: flex; gap: 12px; margin-bottom: 22rpx; }
.filters button { flex: 1; min-width: 0; }
.selected { background: #12764a; color: #fff; }
.consultation,.state { display: flex; flex-direction: column; gap: 12px; }
.consultation .between { gap: 10px; align-items: flex-start; }
.subject { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.6; }
.tag { flex-shrink: 0; font-size: 13px; }
.tag-orange { background: #fff3dd; color: #805000; }
.tag-green { background: #e5f5eb; color: #0e5233; }
.body-text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; line-height: 1.75; color: #314b3e; }
.answer { padding: 12px; background: #f0f7f2; border-radius: 12rpx; }
.expert-mask { justify-content: center; }
.reply-sheet { display: flex; flex-direction: column; height: 82vh; max-height: calc(100% - 12px); padding: 0; overflow: hidden; box-sizing: border-box; }
.sheet-header { flex-shrink: 0; padding: 12px 16px; gap: 12px; border-bottom: 1px solid #e1e9e3; }
.sheet-header .card-title { font-size: 18px; }
.reply-scroll { height: calc(82vh - 164px); min-height: 0; flex: 1; }
.reply-form { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.reply-form .subject { flex: none; }
.reply-form .form-label { margin: 4px 0 0; font-size: 15px; font-weight: 600; }
.reply-input { width: 100%; height: 160px; min-height: 160px; padding: 12px; box-sizing: border-box; font-size: 16px; line-height: 1.6; }
.sheet-footer { flex-shrink: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #e1e9e3; background: #fff; }
.reply-sheet .btn-block { margin-top: 0; }
/* #ifdef H5 */
@supports (height: 100dvh) {
  .reply-sheet { height: 82dvh; }
  .reply-scroll { height: calc(82dvh - 164px); }
}
/* #endif */
</style>
