<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type AiAnswer, type PestResult } from '../../api'
import { currentOwner, isLoggedIn } from '../../auth'

interface ChatItem {
  id: number
  role: 'user' | 'ai'
  text: string
  answer?: AiAnswer
  time: string
}

const messages = ref<ChatItem[]>([])
const question = ref('')
const sending = ref(false)
const statusBarHeight = ref(0)
const scrollInto = ref('')
const pestOpen = ref(false)
const pestBusy = ref(false)
const pestCrop = ref('大蒜')
const pestSymptom = ref('')
const pestResult = ref<PestResult | null>(null)

const crops = ['大蒜', '番茄', '草莓', '小麦', '玉米', '水稻', '苹果']
const hotQuestions = [
  '大蒜叶子发黄是什么原因？',
  '草莓烂果怎么防治？',
  '小麦赤霉病用什么药？',
  '大蒜现在该不该卖？',
]
const followups = ['大蒜现在该不该卖？', '大棚草莓温度怎么管？', '今年种什么效益好？']

let seq = 0
const now = () => {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

onShow(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }
  if (!messages.value.length) {
    messages.value.push({
      id: ++seq,
      role: 'ai',
      text: `您好，${currentOwner() || '农户'}！我是平台农技 AI 助手，基于农技知识库与病虫害图谱回答。置信度低于 80% 时我会建议转接在线专家。`,
      time: now(),
    })
  }
  const pending = uni.getStorageSync('info_ai_question')
  if (pending) {
    uni.removeStorageSync('info_ai_question')
    send(String(pending))
  }
})

async function send(text?: string) {
  const content = (text ?? question.value).trim()
  if (!content || sending.value) return
  messages.value.push({ id: ++seq, role: 'user', text: content, time: now() })
  question.value = ''
  sending.value = true
  scrollToEnd()
  try {
    const answer = await infoApi.askAi({ question: content })
    messages.value.push({ id: ++seq, role: 'ai', text: answer.answer, answer, time: now() })
  } catch (error) {
    messages.value.push({
      id: ++seq,
      role: 'ai',
      text: error instanceof Error ? error.message : 'AI 服务暂时不可用，请稍后再试。',
      time: now(),
    })
  } finally {
    sending.value = false
    scrollToEnd()
  }
}

function scrollToEnd() {
  nextTick(() => {
    scrollInto.value = ''
    setTimeout(() => {
      scrollInto.value = 'chat-bottom'
    }, 30)
  })
}

function openHistory() {
  uni.navigateTo({ url: '/pages/ai/history' })
}

function transferExpert() {
  uni.navigateTo({ url: '/pages/expert/detail?id=1' })
}

function markUseful() {
  toast('感谢反馈，已记录', 'success')
}

function openPest() {
  pestOpen.value = true
  pestResult.value = null
}

async function runPest() {
  if (pestBusy.value) return
  if (!pestSymptom.value.trim()) {
    toast('请描述症状，例如「叶片出现褐色斑点」')
    return
  }
  pestBusy.value = true
  try {
    pestResult.value = await infoApi.pestIdentify({
      crop: pestCrop.value,
      symptom: pestSymptom.value.trim(),
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '识别失败')
  } finally {
    pestBusy.value = false
  }
}

function choosePhoto() {
  uni.chooseImage({
    count: 1,
    success: () => toast('图片已就绪，请补充作物与症状后识别'),
    fail: () => toast('已取消选择'),
  })
}

function askPestToChat() {
  if (!pestResult.value) return
  const top = pestResult.value.candidates?.[0]
  pestOpen.value = false
  send(`我的${pestCrop.value}出现${pestSymptom.value}，可能是${top?.name || '病害'}，怎么防治？`)
}
</script>

<template>
  <view class="page ai-page">
    <view class="ai-head" :style="{ paddingTop: `${statusBarHeight + 14}px` }">
      <view class="ai-nav">
        <view class="ai-title">
          <text class="robot">🤖</text>
          <text class="title">农技 AI 助手</text>
        </view>
        <text class="history" @click="openHistory">历史</text>
      </view>
      <view class="ai-note">
        <text class="tag purple">✦ AI</text>
        <text class="note-text">基于平台农技知识库与病虫害图谱回答，置信度低于 80% 将提示转接专家</text>
      </view>
    </view>

    <scroll-view scroll-y class="chat" :scroll-into-view="scrollInto" :scroll-with-animation="true">
      <view class="chat-inner">
        <view v-if="messages.length <= 1" class="hot-block">
          <text class="hot-title">🔥 热门问题</text>
          <view class="hot-list">
            <view v-for="item in hotQuestions" :key="item" class="hot-q" @click="send(item)">{{ item }}</view>
          </view>
        </view>

        <view v-for="item in messages" :key="item.id" :class="['msg', item.role]">
          <view v-if="item.role === 'ai'" class="avatar">AI</view>
          <view class="bubble-wrap">
            <view class="bubble">
              <text class="bubble-text">{{ item.text }}</text>

              <template v-if="item.answer">
                <view v-if="item.answer.related?.length" class="sources">
                  <text class="src-title">参考来源</text>
                  <view v-for="src in item.answer.related" :key="src.id" class="src-item">
                    <text class="src-name">· {{ src.title }}</text>
                    <text class="tiny">{{ src.summary }}</text>
                  </view>
                </view>
                <view class="confidence">
                  <text class="tiny">置信度 {{ item.answer.confidence }}% · {{ item.answer.category }}</text>
                  <text v-if="item.answer.sourceRefs?.length" class="tiny">
                    {{ item.answer.sourceRefs.join(' / ') }}
                  </text>
                </view>
                <view class="ai-actions">
                  <text class="act" @click="transferExpert">转接专家</text>
                  <text class="act" @click="markUseful">👍 有用</text>
                </view>
              </template>
            </view>
            <text class="time">{{ item.time }}</text>
          </view>
        </view>

        <view v-if="sending" class="msg ai">
          <view class="avatar">AI</view>
          <view class="bubble"><text class="bubble-text typing">正在检索农技知识库…</text></view>
        </view>

        <view v-if="messages.length > 1" class="followups">
          <text v-for="item in followups" :key="item" class="follow" @click="send(item)">{{ item }}</text>
        </view>

        <view id="chat-bottom" style="height: 20rpx" />
      </view>
    </scroll-view>

    <view class="input-bar">
      <text class="icon" @click="openPest">📷</text>
      <input
        v-model="question"
        class="chat-input"
        placeholder="描述你的问题，例如：大蒜叶尖发黄怎么办"
        placeholder-class="ph"
        confirm-type="send"
        @confirm="send()"
      />
      <button class="send-btn" :disabled="sending" @click="send()">发送</button>
    </view>

    <view v-if="pestOpen" class="mask" @click="pestOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <text class="card-title">病虫害拍照识别</text>
          <text class="card-sub" @click="pestOpen = false">关闭</text>
        </view>

        <view class="form-item">
          <text class="form-label">作物</text>
          <picker mode="selector" :range="crops" :value="crops.indexOf(pestCrop)" @change="pestCrop = crops[Number($event.detail.value)]">
            <view class="picker">
              <text>{{ pestCrop }}</text>
              <text class="item-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">症状描述</text>
          <textarea v-model="pestSymptom" class="textarea" placeholder="例如：叶片出现褐色斑点，边缘发黄" auto-height />
        </view>

        <view class="photo-row" @click="choosePhoto">
          <text class="photo-icon">📷</text>
          <text class="tiny">拍照或从相册选择病叶照片（可选）</text>
        </view>

        <button class="btn btn-primary btn-block" :disabled="pestBusy" @click="runPest">
          {{ pestBusy ? '识别中…' : '开始识别' }}
        </button>

        <view v-if="pestResult" class="result">
          <text class="tag green">识别结果</text>
          <view v-for="item in pestResult.candidates" :key="item.name" class="cand">
            <view class="between">
              <text class="strong">{{ item.name }}</text>
              <text class="tiny">{{ Math.round(item.probability * 100) }}%</text>
            </view>
            <text class="tiny">{{ item.note }}</text>
            <view class="progress" style="margin-top: 8rpx">
              <view :style="{ width: `${Math.round(item.probability * 100)}%` }" />
            </view>
          </view>
          <view class="notice ai" style="margin-top: 12rpx">
            <text>✦</text>
            <text>{{ pestResult.advice }}</text>
          </view>
          <button class="btn btn-ghost btn-block" style="margin-top: 14rpx" @click="askPestToChat">
            继续追问防治方案
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ai-page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: #f4f7f5;
}

.ai-head {
  padding: 0 24rpx 18rpx;
  border-radius: 0 0 28rpx 28rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 360rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.ai-nav {
  display: flex;
  height: 70rpx;
  align-items: center;
  justify-content: space-between;
}

.ai-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.robot {
  font-size: 32rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 700;
}

.history {
  padding: 8rpx 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 14rpx;
  font-size: 24rpx;
}

.ai-note {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 6rpx;
  padding: 12rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.1);
}

.note-text {
  flex: 1;
  color: rgba(255, 255, 255, 0.72);
  font-size: 24rpx;
  line-height: 1.5;
}

.chat {
  flex: 1;
  overflow: hidden;
}

.chat-inner {
  padding: 20rpx 24rpx 0;
}

.hot-block {
  margin-bottom: 20rpx;
}

.hot-title {
  display: block;
  margin-bottom: 12rpx;
  color: #53665a;
  font-size: 24rpx;
  font-weight: 650;
}

.hot-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.hot-q {
  padding: 12rpx 20rpx;
  border: 1rpx solid #dbe7df;
  border-radius: 16rpx;
  background: #ffffff;
  color: #34473b;
  font-size: 24rpx;
}

.msg {
  display: flex;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.msg.user {
  flex-direction: row-reverse;
}

.avatar {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  flex: 0 0 60rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #765097, #56346f);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}

.bubble-wrap {
  display: flex;
  max-width: 78%;
  flex-direction: column;
  gap: 6rpx;
}

.msg.user .bubble-wrap {
  align-items: flex-end;
}

.bubble {
  padding: 20rpx 22rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 6rpx 18rpx rgba(20, 64, 40, 0.04);
}

.msg.user .bubble {
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
}

.bubble-text {
  font-size: 25rpx;
  line-height: 1.72;
  white-space: pre-wrap;
}

.typing {
  color: #94a198;
}

.time {
  color: #b3c0b7;
  font-size: 24rpx;
}

.sources {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #edf2ee;
}

.src-title {
  display: block;
  margin-bottom: 8rpx;
  color: #94a198;
  font-size: 24rpx;
}

.src-item {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  margin-bottom: 8rpx;
}

.src-name {
  color: #176c93;
  font-size: 24rpx;
}

.confidence {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  margin-top: 12rpx;
}

.ai-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #edf2ee;
}

.act {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 600;
}

.followups {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin: 6rpx 0 20rpx;
}

.follow {
  padding: 10rpx 18rpx;
  border: 1rpx dashed #cfe0d6;
  border-radius: 14rpx;
  color: #53665a;
  font-size: 24rpx;
}

.input-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 20rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e8efea;
  background: #ffffff;
}

.icon {
  font-size: 34rpx;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  background: #f2f5f3;
  font-size: 24rpx;
}

.ph {
  color: #b3c0b7;
}

.send-btn {
  display: flex;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  padding: 0 26rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 650;
}

.mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  background: rgba(6, 26, 16, 0.44);
}

.sheet {
  width: 100%;
  max-height: 82vh;
  overflow-y: auto;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 26rpx 26rpx 0 0;
  background: #ffffff;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.picker {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  font-size: 25rpx;
}

.photo-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx dashed #cfe0d6;
  border-radius: 16rpx;
  background: #f8fbf9;
}

.photo-icon {
  font-size: 30rpx;
}

.result {
  margin-top: 20rpx;
}

.cand {
  margin-top: 14rpx;
  padding: 16rpx;
  border: 1rpx solid #e6ede9;
  border-radius: 16rpx;
}
</style>
