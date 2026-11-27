<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { localDate } from '../../utils'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { serviceApi, statusMeta, type Policy } from '../../api'

const policies = ref<Policy[]>([])
const applications = ref<Array<{ id: string | number; applicationNo: string; policyTitle: string; status: string; progress: number; amountText: string; submittedAt: string }>>([])
const applyOpen = ref(false)
const submitting = ref(false)
const selected = ref<Policy | null>(null)
/** 申报主体由后端从令牌取，前端只展示；表单里只留真正会落库的联系电话。 */
const subjectName = ref('')
const form = reactive({ contactPhone: '' })

// H5 以可视视口为准；原生端仅扣除系统尚未通过 resize 消化的键盘高度。
const visibleHeight = ref(0)
const viewportTop = ref(0)
const restingHeight = ref(0)
const keyboardHeight = ref(0)
const phoneFocused = ref(false)
const scrollTarget = ref('')
let listening = false
let windowWidth = 0
let focusTimer: ReturnType<typeof setTimeout> | undefined
// #ifdef H5
let visualViewport: VisualViewport | null = null
// #endif
const keyboardVisible = computed(() => keyboardHeight.value > 0)
const overlayStyle = computed(() => ({ top: `${viewportTop.value}px`, height: `${visibleHeight.value}px`, bottom: 'auto' }))
const sheetStyle = computed(() => ({ height: `${Math.max(0, Math.min(restingHeight.value * 0.85, visibleHeight.value - 12))}px` }))

function windowSize() {
  const info = uni.getSystemInfoSync()
  return { height: info.windowHeight, width: info.windowWidth }
}
function revealPhone() {
  if (!phoneFocused.value || !applyOpen.value) return
  scrollTarget.value = ''
  void nextTick(() => { if (listening && phoneFocused.value) scrollTarget.value = 'policy-contact' })
}
function syncViewport() {
  if (!listening) return
  const size = windowSize()
  let available = size.height
  let top = 0
  // #ifdef H5
  available = visualViewport?.height ?? window.innerHeight
  top = visualViewport?.offsetTop ?? 0
  if (!phoneFocused.value && available > restingHeight.value) restingHeight.value = available
  keyboardHeight.value = phoneFocused.value && restingHeight.value - available > 100
    ? restingHeight.value - available : 0
  // #endif
  // #ifndef H5
  if (keyboardHeight.value === 0 && !phoneFocused.value) restingHeight.value = Math.max(restingHeight.value, size.height)
  // 覆盖模式：current=base；resize 模式：current=base-keyboard。二者不能重复扣减。
  available = Math.min(size.height, Math.max(0, restingHeight.value - keyboardHeight.value))
  // #endif
  visibleHeight.value = Math.max(0, available)
  viewportTop.value = Math.max(0, top)
  revealPhone()
}
function onKeyboardChange(event: { height: number }) {
  if (!listening) return
  keyboardHeight.value = Math.max(0, event.height || 0)
  syncViewport()
}
function onResize(event: { size: { windowWidth: number; windowHeight: number } }) {
  if (!listening) return
  if (event.size.windowWidth !== windowWidth) {
    windowWidth = event.size.windowWidth
    // 横竖屏切换先收起键盘，待恢复尺寸后重新测量，避免沿用旧方向基线。
    phoneFocused.value = false
    uni.hideKeyboard()
    restingHeight.value = event.size.windowHeight
  }
  syncViewport()
}
function startViewportTracking() {
  if (listening) return
  const size = windowSize()
  windowWidth = size.width
  restingHeight.value = size.height
  keyboardHeight.value = 0
  listening = true
  // #ifdef H5
  visualViewport = window.visualViewport
  restingHeight.value = visualViewport?.height ?? window.innerHeight
  visualViewport?.addEventListener('resize', syncViewport)
  visualViewport?.addEventListener('scroll', syncViewport)
  window.addEventListener('resize', syncViewport)
  // #endif
  // #ifndef H5
  uni.onKeyboardHeightChange(onKeyboardChange)
  // #endif
  uni.onWindowResize(onResize)
  syncViewport()
}
function stopViewportTracking() {
  listening = false
  if (focusTimer) clearTimeout(focusTimer)
  focusTimer = undefined
  // #ifdef H5
  visualViewport?.removeEventListener('resize', syncViewport)
  visualViewport?.removeEventListener('scroll', syncViewport)
  window.removeEventListener('resize', syncViewport)
  visualViewport = null
  // #endif
  // #ifndef H5
  uni.offKeyboardHeightChange(onKeyboardChange)
  // #endif
  uni.offWindowResize(onResize)
  phoneFocused.value = false
  keyboardHeight.value = 0
  scrollTarget.value = ''
}
function focusPhone(event: FocusEvent | { detail: { height?: number } }) {
  phoneFocused.value = true
  // #ifndef H5
  if (typeof event.detail === 'object' && event.detail.height) keyboardHeight.value = Math.max(0, event.detail.height)
  // #endif
  syncViewport()
  if (focusTimer) clearTimeout(focusTimer)
  focusTimer = setTimeout(syncViewport, 300)
}
function blurPhone() { phoneFocused.value = false }
function hideKeyboard() {
  phoneFocused.value = false
  uni.hideKeyboard()
  // 由视口/键盘事件恢复高度，不能在键盘动画结束前提前扩张弹层。
}
function closeApply() {
  if (submitting.value) return
  dismissApply()
}
function dismissApply() {
  const wasOpen = applyOpen.value
  applyOpen.value = false
  stopViewportTracking()
  if (wasOpen) uni.hideKeyboard()
}
onHide(dismissApply)
onUnload(dismissApply)

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
  if (policy.status !== 'open' || policy.deadline < localDate()) {
    uni.showToast({ title: `《${policy.title}》当前不在申报期`, icon: 'none' })
    return
  }
  selected.value = policy
  applyOpen.value = true
  startViewportTracking()
}

async function submit() {
  if (!selected.value || submitting.value) return
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) {
    uni.showToast({ title: '请填写 11 位联系电话', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await serviceApi.applyPolicy({ policyId: selected.value.id, ...form }) as { applicationNo?: string }
    dismissApply()
    uni.showToast({ title: `申报 ${result?.applicationNo ?? ''} 已提交`, icon: 'none' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '申报失败', icon: 'none' })
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="page page-pad policy-page">
    <view class="policy-summary"><text class="summary-icon">⚡</text><view><text class="tiny green">按经营主体匹配</text><text class="summary-title">发现 {{ policies.filter((item) => item.status === 'open' && item.deadline >= localDate()).length }} 项在申报期内的政策</text><text class="tiny">{{ subjectName || '未取到经营主体，请先在统一登录中绑定主体' }}</text></view></view>
    <view class="card"><view class="card-head"><text class="card-title">为您匹配</text><text class="card-sub">按匹配度排序</text></view><view class="policy-row" v-for="policy in policies" :key="policy.id" @click="openApply(policy)"><view class="score">{{ policy.matchScore }}<text>匹配</text></view><view class="policy-copy"><text class="tag green">{{ policy.level }} · {{ policy.status === 'open' && policy.deadline >= localDate() ? '申报中' : '已截止' }}</text><text class="policy-title">{{ policy.title }}</text><text class="muted">{{ policy.conditions }}</text><text class="tiny">{{ policy.amountText }} · {{ policy.deadline }} 截止</text></view><text class="chev">›</text></view></view>
    <view class="card"><view class="card-head"><text class="card-title">我的申报</text></view><view class="application" v-for="app in applications" :key="app.id"><view class="between"><text class="strong">{{ app.policyTitle }}</text><text class="tag" :class="statusMeta(app.status).tone">{{ statusMeta(app.status).label }}</text></view><text class="tiny">{{ app.applicationNo }} · {{ app.amountText }}</text><view class="progress"><view :style="{ width: `${app.progress}%` }" /></view><text class="tiny">{{ app.progress }}% · {{ app.submittedAt }}</text></view><view v-if="applications.length === 0" class="empty">暂无申报记录</view></view>
    <view v-if="applyOpen" class="overlay" :style="overlayStyle" @click.self="closeApply" @touchmove.stop.prevent>
      <view class="sheet" :class="{ 'keyboard-open': keyboardVisible }" :style="sheetStyle">
        <view class="between sheet-head"><text class="card-title">申报 · {{ selected?.title }}</text><button class="sheet-close" aria-label="关闭申报" :disabled="submitting" @click="closeApply">×</button></view>
        <scroll-view scroll-y class="sheet-body" :scroll-into-view="scrollTarget" :scroll-animated="false" @touchmove.stop>
          <view class="sheet-content">
            <view class="form-item"><text class="form-label">申报主体</text><view class="readonly">{{ subjectName || '—' }}</view></view>
            <view id="policy-contact" class="form-item"><text class="form-label">联系电话</text><input class="input" type="number" v-model="form.contactPhone" maxlength="11" :disabled="submitting" :adjust-position="false" :cursor-spacing="16" confirm-type="done" @focus="focusPhone" @blur="blurPhone" @confirm="hideKeyboard" placeholder="11 位手机号" /></view>
            <view class="form-item"><text class="form-label">拟申报额度</text><view class="readonly">{{ selected?.amountText || '—' }}</view></view>
            <view class="materials"><text v-for="material in selected?.materials" :key="material">✓ {{ material }}</text></view>
          </view>
        </scroll-view>
        <view class="sheet-actions"><button v-if="keyboardVisible || phoneFocused" class="keyboard-dismiss" @click="hideKeyboard">收起键盘</button><button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting" @click="submit">提交申报</button></view>
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
.summary-title { font-size: 15px; font-weight: 700; }
.policy-row { display: flex; align-items: center; gap: 14rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf2ee; }
.policy-row:last-child { border-bottom: 0; }
.score { display: flex; width: 76rpx; height: 76rpx; flex: 0 0 76rpx; align-items: center; justify-content: center; flex-direction: column; border-radius: 50%; background: #f2fbf5; color: #0e5233; font-family: monospace; font-size: 14px; font-weight: 700; }
.score text { font-family: sans-serif; font-size: 13px; font-weight: 400; }
.policy-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5rpx; }
.policy-title { font-size: 13px; font-weight: 650; }
.chev { color: #52665a; font-size: 38rpx; }
.application { margin-bottom: 14rpx; padding: 16rpx; border: 1rpx solid #e1e9e3; border-radius: 15rpx; }
.application > text { display: block; margin: 5rpx 0; }
/* H5 导航栏层级为 998；键盘压缩视口时弹层必须覆盖导航，避免关闭按钮被拦截。
   保持低于 uni-app 的系统提示层；原生端继续在当前页面可用窗口内布局。 */
.overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; padding-top: max(12px, env(safe-area-inset-top)); box-sizing: border-box; background: rgba(5,25,15,.45); }
.sheet { width: 100%; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 30rpx 30rpx 0 0; background: #fff; }
.sheet-close { color: #52665a; font-size: 44rpx; }
.materials { display: flex; gap: 8rpx; flex-wrap: wrap; margin-bottom: 20rpx; padding: 16rpx; border-radius: 13rpx; background: #f2fbf5; }
.materials text { color: #0e5233; font-size: 13px; }
.readonly { min-height: 44px; padding: 18rpx 20rpx; border: 1rpx solid #e6ede8; border-radius: 14rpx; background: #f6f9f7; color: #55655b; font-size: 13px; }

.policy-page { padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); }
.policy-summary > view { min-width: 0; }
.summary-icon { flex-shrink: 0; }
.sheet { display: flex; flex-direction: column; max-height: 100%; overflow: hidden; padding: 0; box-sizing: border-box; }
.sheet-head { flex-shrink: 0; padding: 12px 16px; }
.sheet-head .card-title { min-width: 0; max-height: 66px; overflow-y: auto; }
.sheet-body { height: 0; min-height: 0; flex: 1; overflow: hidden; overscroll-behavior: contain; }
.sheet-content { padding: 0 16px 16px; }
.sheet-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #e1e9e3; background: #fff; }
.sheet-actions .btn { flex: 1; min-width: 0; }
.keyboard-dismiss { flex-shrink: 0; margin: 0; padding: 0 10px; min-height: 44px; line-height: 44px; font-size: 13px; color: #345744; background: #f2f7f3; }
.keyboard-open .sheet-actions { padding-bottom: 8px; padding-top: 8px; }
.keyboard-open .sheet-head { padding-top: 6px; padding-bottom: 6px; }
.keyboard-open .sheet-head .card-title { max-height: 44px; }
.sheet-close { flex: 0 0 44px; min-width: 44px; min-height: 44px; padding: 0; margin: 0 0 0 8px; line-height: 44px; }
.sheet-content { overflow-wrap: anywhere; }
#policy-contact { scroll-margin-top: 8px; }
.materials text { max-width: 100%; }

</style>
