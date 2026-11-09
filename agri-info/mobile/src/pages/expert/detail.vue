<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, toast, type Expert } from '../../api'

const id = ref(0)
const expert = ref<Expert | null>(null)
const loading = ref(true)
const followed = ref(false)
const statusBarHeight = ref(0)

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const fields = computed(() => (expert.value?.field || '').split(/[、,，]/).filter(Boolean))
const answers = computed(() => expert.value?.answers || [])

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    expert.value = await infoApi.expert(id.value)
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function toggleFollow() {
  followed.value = !followed.value
  toast(followed.value ? '已关注该专家' : '已取消关注')
}

function consult(mode: '图文咨询' | '电话咨询') {
  uni.showModal({
    title: mode,
    content:
      mode === '图文咨询'
        ? `¥39 / 次，24 小时内回复。提交问题后可上传图片，专家将给出图文方案。`
        : `¥99 / 30 分钟，预约制。确认预约时间后平台会电话通知双方。`,
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      try {
        await infoApi.createSubscription({
          targetType: '专家咨询',
          targetName: `${expert.value?.name || ''} · ${mode}`,
          channel: '站内消息',
          frequency: '单次',
        })
        toast('咨询需求已提交，专家将尽快响应', 'success')
      } catch (error) {
        toast(error instanceof Error ? error.message : '提交失败')
      }
    },
  })
}

function verify() {
  uni.navigateTo({ url: `/pages/expert/verify?keyword=${expert.value?.certNo || ''}` })
}

function openQuestion(question: string) {
  uni.setStorageSync('info_ai_question', question)
  uni.switchTab({ url: '/pages/ai/index' })
}

function share() {
  uni.setClipboardData({
    data: `丰链云专家：${expert.value?.name || ''}（${expert.value?.certNo || ''}）`,
    success: () => toast('链接已复制'),
  })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<template>
  <view class="page expert-page">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">专家主页</text>
        <text class="right" @click="share">分享</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载…</view>

    <template v-else-if="expert">
      <view class="head">
        <view class="head-top">
          <view class="avatar">👨‍🌾</view>
          <view class="head-copy">
            <view class="name-row">
              <text class="name">{{ expert.name }}</text>
              <text class="tag green">{{ expert.level }}</text>
            </view>
            <text class="head-sub">{{ expert.title }} · {{ expert.orgName }}</text>
            <text class="tiny">{{ expert.region }} · 服务 {{ expert.followers }} 人次</text>
          </view>
        </view>

        <view class="stat-grid">
          <view class="stat-cell">
            <text class="stat-num light">{{ expert.answerCount }}</text>
            <text class="stat-label light">回答问题</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num light">{{ expert.rating }}</text>
            <text class="stat-label light">用户评分</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num light">{{ expert.followers }}</text>
            <text class="stat-label light">关注人数</text>
          </view>
        </view>
      </view>

      <view class="page-pad">
        <view class="card">
          <view class="card-head">
            <text class="card-title">擅长领域</text>
          </view>
          <view class="chip-row">
            <text v-for="item in fields" :key="item" class="tag green">{{ item }}</text>
          </view>
          <text v-if="expert.intro" class="intro">{{ expert.intro }}</text>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">认证与链上信息</text>
            <text class="card-sub" @click="verify">核验 ›</text>
          </view>
          <view class="field">
            <text class="field-label">认证编号</text>
            <text class="field-value">{{ expert.certNo }}</text>
          </view>
          <view class="field">
            <text class="field-label">认证等级</text>
            <text class="field-value">{{ expert.level }}</text>
          </view>
          <view class="field">
            <text class="field-label">审核时间</text>
            <text class="field-value">{{ expert.auditAt || '—' }}</text>
          </view>
          <view class="field">
            <text class="field-label">认证状态</text>
            <text class="field-value" style="color: #2e7d32">
              {{ expert.status === 'approved' || expert.status === 'active' ? '有效' : expert.status }}
            </text>
          </view>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">咨询服务</text>
          </view>
          <view class="service" @click="consult('图文咨询')">
            <view class="service-copy">
              <text class="strong">图文咨询</text>
              <text class="tiny">24 小时内回复 · 可上传图片</text>
            </view>
            <view class="service-price">
              <text class="price-sm">¥39</text>
              <text class="tiny">/次</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
          <view class="service" @click="consult('电话咨询')">
            <view class="service-copy">
              <text class="strong">电话咨询</text>
              <text class="tiny">预约制 · 30 分钟一对一</text>
            </view>
            <view class="service-price">
              <text class="price-sm">¥99</text>
              <text class="tiny">/30分钟</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">TA 的回答</text>
          <text class="card-sub">全部 {{ expert.answerCount }} ›</text>
        </view>

        <view v-if="!answers.length" class="empty" style="min-height: 220rpx">
          <text>暂无公开回答</text>
        </view>
        <view v-else class="card">
          <view
            v-for="item in answers"
            :key="item.id"
            class="list-item"
            @click="openQuestion(item.question)"
          >
            <view class="item-icon">🌱</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.question }}</text>
              <text class="item-sub">{{ item.answer }}</text>
              <text class="tiny">{{ item.createdAt }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="action-bar">
        <view class="icon-btn" @click="toggleFollow">
          <text>{{ followed ? '★' : '☆' }}</text>
          <text>关注</text>
        </view>
        <button class="btn grow" @click="verify">核验认证</button>
        <button class="btn btn-primary grow" @click="consult('图文咨询')">咨询专家</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.expert-page {
  padding-bottom: 180rpx;
  background: #f4f7f5;
}

.nav-holder {
  background: #ffffff;
}

.head {
  padding: 22rpx 24rpx 26rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.head-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.avatar {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 112rpx;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgba(255, 255, 255, 0.22);
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.12);
  font-size: 50rpx;
}

.head-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.name {
  font-size: 34rpx;
  font-weight: 750;
}

.head-sub {
  color: rgba(255, 255, 255, 0.72);
  font-size: 24rpx;
}

.head .tiny {
  color: rgba(255, 255, 255, 0.5);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
}

.stat-num.light {
  color: #ffffff;
}

.stat-label.light {
  color: rgba(255, 255, 255, 0.55);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.intro {
  display: block;
  margin-top: 14rpx;
  color: #53665a;
  font-size: 24rpx;
  line-height: 1.72;
}

.service {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.service:last-child {
  border-bottom: 0;
}

.service-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3rpx;
}

.service-price {
  display: flex;
  align-items: baseline;
}

.price-sm {
  color: #0e5233;
  font-family: "DIN Alternate", monospace;
  font-size: 30rpx;
  font-weight: 700;
}
</style>
