<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import {
  infoApi,
  mediaUrl,
  toast,
  type CourseDetail,
  type CourseLesson,
  type PlayTicket,
} from '../../api'

/**
 * 课程播放页。
 *
 * 三端都用 uni 的 <video>（小程序/App 是原生组件，不能塞 DOM 播放器），
 * 所以控制条是各端原生样式 —— 这是三端一致性与"能播"之间的必要取舍。
 *
 * 视频源是短时签名地址（默认 5 分钟），播放器不自己续期，
 * 拉流失败时由本页重新换一次票（只重试一次，避免死循环）。
 */
const courseId = ref(0)
const lessonId = ref(0)
const detail = ref<CourseDetail | null>(null)
const lesson = ref<CourseLesson | null>(null)
const ticket = ref<PlayTicket | null>(null)
const loading = ref(true)
const errorText = ref('')
const positionSec = ref(0)
const retried = ref(false)

/** 进度上报节流：每累计 15 秒发一次，暂停/播完再补一次。 */
const REPORT_STEP = 15
let lastReported = 0
let dirty = false

const playUrl = computed(() => (ticket.value ? mediaUrl(ticket.value.url) : ''))
const progress = computed(() => {
  const total = lesson.value?.durationSec || ticket.value?.durationSec || 0
  if (total <= 0) return 0
  return Math.min(100, Math.round((positionSec.value / total) * 100))
})

const index = computed(() => {
  const list = detail.value?.lessons || []
  return list.findIndex((item) => item.id === lessonId.value)
})
const prevLesson = computed(() => (index.value > 0 ? detail.value?.lessons[index.value - 1] : null))
const nextLesson = computed(() => {
  const list = detail.value?.lessons || []
  return index.value >= 0 && index.value < list.length - 1 ? list[index.value + 1] : null
})

onLoad((options) => {
  courseId.value = Number(options?.courseId || 0)
  lessonId.value = Number(options?.lessonId || 0)
  void boot()
})

// 离开页面时把最后的位置补报一次，否则"看到 90% 就退出"会丢掉这段进度
onUnload(() => {
  if (dirty && lessonId.value) {
    void infoApi.reportProgress(courseId.value, lessonId.value, { positionSec: positionSec.value })
      .catch(() => undefined)
  }
})

async function boot() {
  loading.value = true
  errorText.value = ''
  try {
    const data = await infoApi.courseDetail(courseId.value)
    detail.value = data
    lesson.value = data.lessons.find((item) => item.id === lessonId.value) || null
    if (!lesson.value) {
      errorText.value = '章节不存在'
      return
    }
    positionSec.value = lesson.value.positionSec || 0
    lastReported = positionSec.value
    await loadTicket()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadTicket() {
  try {
    ticket.value = await infoApi.playTicket(courseId.value, lessonId.value)
  } catch (error) {
    ticket.value = null
    errorText.value = error instanceof Error ? error.message : '无法获取播放地址'
  }
}

/**
 * timeupdate 的载荷三端不一致：H5 是原生 Event（currentTime 在 target 上），
 * 小程序/App 把数据放在 detail 里。这里两个来源都读一次，避免某一端进度恒为 0。
 */
function onTimeUpdate(event: Event) {
  const payload = event as unknown as {
    detail?: { currentTime?: number }
    target?: { currentTime?: number }
  }
  const current = Number(payload.detail?.currentTime ?? payload.target?.currentTime ?? 0)
  positionSec.value = Math.floor(current)
  dirty = true
  if (current - lastReported >= REPORT_STEP) {
    lastReported = current
    report(Math.floor(current))
  }
}

function onPause() {
  if (dirty) {
    dirty = false
    report(positionSec.value)
  }
}

function onEnded() {
  report(lesson.value?.durationSec || positionSec.value, true)
  if (nextLesson.value) {
    toast('本节已学完，可继续下一节')
  } else {
    toast('本课程已学完', 'success')
  }
}

/** 视频拉流失败：签名过期与网络问题都会落到这里，换一次票重试即可。 */
function onError() {
  if (retried.value) {
    toast('视频加载失败，请稍后重试')
    return
  }
  retried.value = true
  void loadTicket()
}

function report(position: number, finished = false) {
  if (!lessonId.value) return
  infoApi.reportProgress(courseId.value, lessonId.value, { positionSec: Math.floor(position), finished })
    .catch(() => undefined)
}

function switchLesson(target: CourseLesson | null | undefined) {
  if (!target) return
  if (!target.playable) {
    toast('本节需报名后学习')
    return
  }
  uni.redirectTo({ url: `/pages/course/play?courseId=${courseId.value}&lessonId=${target.id}` })
}

function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="page">
    <view class="custom-nav">
      <text class="nav-back" @click="goBack">‹ 返回</text>
      <text class="nav-title">{{ lesson ? lesson.title : '课程播放' }}</text>
      <text class="nav-back" />
    </view>

    <view v-if="loading" class="loading">正在获取播放地址…</view>

    <view v-else-if="errorText && !playUrl" class="empty">
      <text class="empty-icon">📵</text>
      <text class="muted">{{ errorText }}</text>
    </view>

    <block v-else>
      <video
        v-if="playUrl"
        class="player"
        :src="playUrl"
        :initial-time="lesson?.positionSec || 0"
        :poster="lesson?.coverUrl || ''"
        controls
        show-center-play-btn
        enable-progress-gesture
        object-fit="contain"
        @timeupdate="onTimeUpdate"
        @pause="onPause"
        @ended="onEnded"
        @error="onError"
      />

      <view class="page-pad">
        <view class="card">
          <text class="play-title">{{ lesson?.title }}</text>
          <text class="tiny muted" style="display: block; margin-top: 8rpx">
            {{ detail?.title }} · {{ detail?.teacher }}
          </text>

          <view class="row between" style="margin-top: 20rpx">
            <text class="tiny muted">本节进度</text>
            <text class="tiny strong">{{ progress }}%</text>
          </view>
          <view class="progress" style="margin-top: 10rpx">
            <view class="progress-bar" :style="{ width: progress + '%' }" />
          </view>

          <view class="row" style="margin-top: 24rpx; gap: 16rpx">
            <button class="btn btn-block" :disabled="!prevLesson" @click="switchLesson(prevLesson)">上一节</button>
            <button class="btn btn-primary btn-block" :disabled="!nextLesson" @click="switchLesson(nextLesson)">
              下一节
            </button>
          </view>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">课程目录</text>
      </view>

      <view class="page-pad">
        <view class="card">
          <view
            v-for="item in detail?.lessons || []"
            :key="item.id"
            class="list-item lesson"
            :class="{ current: item.id === lessonId, locked: !item.playable }"
            @click="switchLesson(item)"
          >
            <view class="lesson-seq">
              <text v-if="item.finished">✓</text>
              <text v-else-if="!item.playable">🔒</text>
              <text v-else>{{ item.seq }}</text>
            </view>
            <view class="item-body">
              <text class="item-title">{{ item.title }}</text>
              <text class="item-sub">{{ item.durationLabel }}<text v-if="item.freePreview"> · 试看</text></text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>
      </view>
    </block>

    <view class="safe-bottom" />
  </view>
</template>

<style lang="scss" scoped>
.player {
  width: 100%;
  height: 422rpx;
  background: #0b1a12;
}

.play-title {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.45;
}

.progress {
  height: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #eef2ef;
}

.progress-bar {
  height: 100%;
  border-radius: 999rpx;
  background: #12764a;
  transition: width 0.3s;
}

.lesson {
  border-bottom: 1rpx solid #f0f4f1;
}

.lesson:last-child {
  border-bottom: 0;
}

.lesson.locked {
  opacity: 0.55;
}

.lesson.current {
  background: #eef8f2;
  border-radius: 12rpx;
}

.lesson-seq {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: #eef7f1;
  color: #12764a;
  font-size: 22rpx;
  font-weight: 600;
}
</style>
