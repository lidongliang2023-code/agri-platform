<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type CourseDetail, type CourseLesson } from '../../api'

/**
 * 课程详情：课程元信息 + 章节目录 + 个人学习进度。
 *
 * 章节目录里没有播放地址，点开某节才去换票（后端 play-ticket），
 * 这样"未报名只能试看第一节"的限制才拦得住。
 */
const courseId = ref(0)
const detail = ref<CourseDetail | null>(null)
const loading = ref(true)
const enrolling = ref(false)
const firstShow = ref(true)

onLoad((options) => {
  courseId.value = Number(options?.id || 0)
  firstShow.value = true
  load()
})

// 从播放页返回时进度已变，静默刷新一次（不闪 loading）
onShow(() => {
  if (firstShow.value) {
    firstShow.value = false
    return
  }
  if (courseId.value) load(true)
})

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    detail.value = await infoApi.courseDetail(courseId.value)
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function enroll() {
  if (enrolling.value || !detail.value) return
  enrolling.value = true
  try {
    const result = await infoApi.enrollCourse(courseId.value)
    toast(result.message, 'success')
    await load(true)
    const first = detail.value?.lessons.find((item) => item.playable)
    if (first) openLesson(first)
  } catch (error) {
    toast(error instanceof Error ? error.message : '报名失败')
  } finally {
    enrolling.value = false
  }
}

function openLesson(lesson: CourseLesson) {
  if (!lesson.playable) {
    toast('本节需报名后学习')
    return
  }
  uni.navigateTo({ url: `/pages/course/play?courseId=${courseId.value}&lessonId=${lesson.id}` })
}

function continueStudy() {
  const target = detail.value?.lessons.find((item) => item.id === detail.value?.lastLessonId && item.playable)
    || detail.value?.lessons.find((item) => item.playable)
  if (target) {
    openLesson(target)
  } else {
    toast('暂无可学习章节')
  }
}

function goBack() {
  uni.navigateBack()
}

const stateHint = computed(() => {
  const course = detail.value
  if (!course) return ''
  return course.enrolled
    ? `已加入学习 · 共 ${course.lessonCount} 节`
    : `未报名 · 可试看标注「试看」的章节`
})

const totalLabel = computed(() => {
  const seconds = detail.value?.totalDurationSec || 0
  if (seconds <= 0) return ''
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} 分钟`
  return `${(seconds / 3600).toFixed(1)} 小时`
})
</script>

<template>
  <view class="page">
    <view class="custom-nav">
      <text class="nav-back" @click="goBack">‹ 返回</text>
      <text class="nav-title">培训课程</text>
      <text class="nav-back" />
    </view>

    <view v-if="loading" class="loading">正在加载课程…</view>

    <view v-else-if="!detail" class="empty">
      <text class="empty-icon">🎓</text>
      <text class="muted">课程不存在或已下架</text>
    </view>

    <block v-else>
      <view class="page-pad">
        <view class="card">
          <view class="course-head">
            <view class="course-cover">{{ detail.coverIcon }}</view>
            <view class="course-title-box">
              <text class="course-title">{{ detail.title }}</text>
              <text class="tiny muted">{{ detail.teacher }} · {{ detail.mode }}</text>
            </view>
          </view>

          <view class="stat-row" style="margin-top: 18rpx">
            <view class="stat-cell">
              <text class="stat-num">{{ detail.lessonCount }}</text>
              <text class="stat-label">章节</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num">{{ totalLabel || '—' }}</text>
              <text class="stat-label">总时长</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num">{{ detail.learners }}</text>
              <text class="stat-label">在学</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num">{{ detail.rating }}</text>
              <text class="stat-label">评分</text>
            </view>
          </view>

          <text class="tiny muted" style="display: block; margin-top: 16rpx">{{ detail.summary }}</text>

          <view class="chips" style="margin-top: 16rpx">
            <text v-for="tag in detail.tags" :key="tag" class="chip">{{ tag }}</text>
          </view>

          <view style="margin-top: 22rpx">
            <view class="row between">
              <text class="tiny muted">我的学习进度</text>
              <text class="tiny strong">{{ detail.progress }}%</text>
            </view>
            <view class="progress" style="margin-top: 10rpx">
              <view class="progress-bar" :style="{ width: detail.progress + '%' }" />
            </view>
          </view>

          <view class="row" style="margin-top: 22rpx; gap: 16rpx">
            <button class="btn btn-primary btn-block" :loading="enrolling" @click="continueStudy">
              {{ detail.progress > 0 ? '继续学习' : '开始学习' }}
            </button>
            <button
              v-if="!detail.enrolled"
              class="btn btn-ghost"
              :loading="enrolling"
              style="flex: 0 0 200rpx"
              @click="enroll"
            >
              立即报名
            </button>
          </view>
          <text class="tiny muted" style="display: block; margin-top: 12rpx; text-align: center">{{ stateHint }}</text>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">课程目录</text>
      </view>

      <view class="page-pad">
        <view class="card">
          <view
            v-for="lesson in detail.lessons"
            :key="lesson.id"
            class="list-item lesson"
            :class="{ locked: !lesson.playable }"
            @click="openLesson(lesson)"
          >
            <view class="lesson-seq">
              <text v-if="lesson.finished">✓</text>
              <text v-else-if="!lesson.playable">🔒</text>
              <text v-else>{{ lesson.seq }}</text>
            </view>
            <view class="item-body">
              <text class="item-title">{{ lesson.title }}</text>
              <text class="item-sub">
                {{ lesson.durationLabel }}
                <text v-if="lesson.freePreview"> · 试看</text>
                <text v-if="lesson.positionSec > 0"> · 已学 {{ lesson.progress }}%</text>
              </text>
            </view>
            <text class="item-arrow">›</text>
          </view>

          <view v-if="detail.lessons.length === 0" class="empty">
            <text class="empty-icon">📺</text>
            <text class="muted">课程章节正在准备中</text>
          </view>
        </view>
      </view>
    </block>

    <view class="safe-bottom" />
  </view>
</template>

<style lang="scss" scoped>
.course-head {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

/* 全局 .stat-row 是 3 列，这里 4 项（章节/时长/在学/评分）会挤成 3+1 换行，
   改成 2×2 更舒展，也避免"55 分钟"这类长值被压断。 */
.stat-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx 10rpx;
}

.course-cover {
  display: flex;
  width: 108rpx;
  height: 108rpx;
  flex: 0 0 108rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #eaf6ef, #d9efe3);
  font-size: 48rpx;
}

.course-title-box {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.course-title {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.4;
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
