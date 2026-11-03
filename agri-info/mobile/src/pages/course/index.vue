<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, toast, type Course } from '../../api'

/**
 * 培训课堂列表。
 *
 * progress 是后端按当前统一账号算出来的个人进度（不是全站共享的那个数字），
 * 所以这里可以直接显示"已学 45%"而不会串到别人的进度。
 */
const courses = ref<Course[]>([])
const live = ref<Course | null>(null)
const learners = ref(0)
const loading = ref(true)
const mode = ref('全部')

const modes = ['全部', '直播', '录播']

const visible = computed(() => (
  mode.value === '全部' ? courses.value : courses.value.filter((item) => item.mode === mode.value)
))

onLoad(() => {
  void load()
})

async function load() {
  loading.value = true
  try {
    const data = await infoApi.courses()
    courses.value = data.items
    live.value = data.live
    learners.value = data.learners
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCourse(course: Course) {
  uni.navigateTo({ url: `/pages/course/detail?id=${course.id}` })
}

function goBack() {
  uni.navigateBack()
}

/**
 * 节数用 lessonCount（真实章节数），时长用 totalDurationSec 现场算。
 * 不能直接用 info_course.duration：那是后端章节增删时同步的字符串，
 * 演示数据没走过同步流程，会出现"5 节 · 12 节 / 4.5 小时"这种自相矛盾。
 */
function durationText(course: Course): string {
  const seconds = course.totalDurationSec || 0
  const total = seconds >= 3600
    ? `${(seconds / 3600).toFixed(1)} 小时`
    : seconds > 0 ? `${Math.max(1, Math.round(seconds / 60))} 分钟` : ''
  if (!course.lessonCount) {
    return total || course.duration
  }
  return total ? `${course.lessonCount} 节 · ${total}` : `${course.lessonCount} 节`
}
</script>

<template>
  <view class="page">
    <view class="custom-nav">
      <text class="nav-back" @click="goBack">‹ 返回</text>
      <text class="nav-title">培训课堂</text>
      <text class="nav-back" />
    </view>

    <view class="hero">
      <text class="hero-title">学一门用得上的农技</text>
      <text class="hero-desc">专家录播课程 · 学完记录进度 · 支持碎片化学习</text>
      <view class="stat-row" style="margin-top: 20rpx">
        <view class="stat-cell">
          <text class="stat-num">{{ courses.length }}</text>
          <text class="stat-label">门课程</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num">{{ learners }}</text>
          <text class="stat-label">人次在学</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num">{{ live ? 1 : 0 }}</text>
          <text class="stat-label">直播回放</text>
        </view>
      </view>
    </view>

    <view class="page-pad">
      <view class="chips" style="margin-bottom: 16rpx">
        <text
          v-for="item in modes"
          :key="item"
          class="chip"
          :class="{ on: mode === item }"
          @click="mode = item"
        >{{ item }}</text>
      </view>

      <view v-if="loading" class="loading">正在加载课程…</view>

      <view v-else-if="visible.length === 0" class="empty">
        <text class="empty-icon">🎓</text>
        <text class="muted">暂无课程</text>
      </view>

      <view v-else>
        <view
          v-for="course in visible"
          :key="course.id"
          class="card course-card"
          @click="openCourse(course)"
        >
          <view class="row" style="gap: 20rpx">
            <view class="course-cover">{{ course.coverIcon }}</view>
            <view class="course-body">
              <view class="row between">
                <text class="course-title">{{ course.title }}</text>
                <text class="tag" :class="course.mode === '直播' ? 'up' : 'gray'">{{ course.mode }}</text>
              </view>
              <text class="tiny muted" style="display: block; margin-top: 6rpx">{{ course.teacher }}</text>
              <text class="tiny muted" style="display: block; margin-top: 4rpx">
                {{ durationText(course) }} · {{ course.learners }} 人在学 · {{ course.rating }} 分
              </text>
            </view>
          </view>

          <text class="tiny muted course-summary">{{ course.summary }}</text>

          <view v-if="course.progress > 0" style="margin-top: 14rpx">
            <view class="row between">
              <text class="tiny muted">我的学习进度</text>
              <text class="tiny strong">{{ course.progress }}%</text>
            </view>
            <view class="progress" style="margin-top: 8rpx">
              <view class="progress-bar" :style="{ width: course.progress + '%' }" />
            </view>
          </view>

          <view class="row between" style="margin-top: 16rpx">
            <text class="tiny" :class="course.enrolled ? 'strong' : 'muted'">
              {{ course.enrolled ? '已加入学习' : '未报名 · 可试看第一节' }}
            </text>
            <text class="tiny strong" style="color: #12764a">
              {{ course.enrolled ? (course.progress > 0 ? '继续学习 ›' : '开始学习 ›') : '查看详情 ›' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-bottom" />
  </view>
</template>

<style lang="scss" scoped>
/* text 默认是行内元素，不加 block 会让标题与副标题挤在同一行。 */
.hero-title,
.hero-desc {
  display: block;
}

/* 深色 hero 背景上沿用默认的深色数字等于看不见，这里反白。 */
.hero .stat-num {
  color: #ffffff;
}

.hero .stat-label {
  color: rgba(255, 255, 255, 0.62);
}

.course-card {
  margin-bottom: 18rpx;
}

.course-cover {
  display: flex;
  width: 96rpx;
  height: 96rpx;
  flex: 0 0 96rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #eaf6ef, #d9efe3);
  font-size: 44rpx;
}

.course-body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.course-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-summary {
  display: block;
  margin-top: 14rpx;
  line-height: 1.65;
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
</style>
