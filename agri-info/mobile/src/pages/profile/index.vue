<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getViews, infoApi, toast } from '../../api'
import { currentOwner, getInfoUser, hasInfoPermission, isLoggedIn } from '../../auth'

const favorites = ref(0)
const views = ref(0)
const subs = ref(0)
const alerts = ref(0)
const myPosts = ref(0)
const expertCount = ref(0)
const reports = ref(0)
const attestations = ref(0)
const statusBarHeight = ref(0)

const user = computed(() => getInfoUser())
const owner = computed(() => currentOwner() || '平台用户')
const isExpert = computed(() => expertCount.value > 0 || hasInfoPermission('info:admin'))

const menus = [
  { icon: '🔔', title: '价格预警', desc: '突破阈值即时提醒', url: '/pages/alert/setup', badge: () => alerts.value },
  { icon: '⭐', title: '订阅管理', desc: '品种、频道与推送时间', url: '/pages/subscription/index', badge: () => subs.value },
  { icon: '🤖', title: '我的 AI 提问', desc: '历史对话与专家回答', url: '/pages/ai/history', badge: () => 0 },
  { icon: '🎓', title: '培训课堂', desc: '农技课程与直播回放', url: '/pages/course/index', badge: () => 0 },
  { icon: '💬', title: '我的收藏', desc: '资讯、品种与报告', url: '/pages/favorite/index', badge: () => favorites.value },
  { icon: '📦', title: '我的发布', desc: '供需信息与询价', url: '/pages/sd/mine', badge: () => myPosts.value },
  { icon: '📑', title: '我的报告', desc: '已购报告与下载记录', url: '/pages/report/mine', badge: () => reports.value },
  { icon: '🔗', title: '我的存证', desc: '内容上链与校验结果', url: '/pages/attest/index', badge: () => attestations.value },
  { icon: '🎖', title: '我的认证', desc: '专家认证与有效期', url: '/pages/expert/cert', badge: () => expertCount.value },
  { icon: '🕘', title: '浏览历史', desc: '最近看过的内容', url: '/pages/history/index', badge: () => 0 },
  { icon: '❓', title: '帮助与反馈', desc: '常见问题与客服', url: '/pages/help/index', badge: () => 0 },
  { icon: '⚙️', title: '设置', desc: '通知、缓存与账号', url: '/pages/settings/index', badge: () => 0 },
]

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
  views.value = getViews().length
  load()
})

async function load() {
  try {
    const [favList, subList, alertList, mine, expertList, reportList, attestList] = await Promise.all([
      infoApi.favorites(),
      infoApi.subscriptions(),
      infoApi.alertRules(),
      infoApi.mySupplyDemands(),
      infoApi.myExpert(),
      infoApi.myReports(),
      infoApi.attestations(),
    ])
    favorites.value = favList.length
    subs.value = subList.filter((item) => item.enabled).length
    alerts.value = alertList.filter((item) => item.enabled).length
    myPosts.value = mine.items?.length || 0
    expertCount.value = expertList.length
    reports.value = reportList.length
    attestations.value = attestList.length
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  }
}

function go(url: string) {
  uni.navigateTo({ url })
}

function toSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function toEdit() {
  uni.navigateTo({ url: '/pages/profile/edit' })
}

function toSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}
</script>

<template>
  <view class="page profile-page">
    <view class="profile-hero" :style="{ paddingTop: `${statusBarHeight + 20}px` }">
      <view class="hero-top">
        <view class="avatar">👨‍🌾</view>
        <view class="hero-copy">
          <view class="name-row">
            <text class="name">{{ owner }}</text>
            <text v-if="isExpert" class="cert">认证专家 ✓</text>
          </view>
          <text class="hero-sub">{{ user?.username || '统一账号' }} · 山东潍坊</text>
          <view class="cat-row">
            <text class="cat">大蒜</text>
            <text class="cat">番茄</text>
            <text class="cat">苹果</text>
          </view>
        </view>
        <text class="settings" @click="toSettings">设置 ›</text>
      </view>

      <view class="hero-stats">
        <view class="stat-cell" @click="go('/pages/favorite/index')">
          <text class="stat-num light">{{ favorites }}</text>
          <text class="stat-label light">收藏</text>
        </view>
        <view class="stat-cell" @click="go('/pages/history/index')">
          <text class="stat-num light">{{ views }}</text>
          <text class="stat-label light">浏览</text>
        </view>
        <view class="stat-cell" @click="go('/pages/subscription/index')">
          <text class="stat-num light">{{ subs }}</text>
          <text class="stat-label light">订阅</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ reports + attestations }}</text>
          <text class="stat-label light">报告/存证</text>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="search-box" @click="toSearch">
        <text class="search-icon">⌕</text>
        <text class="search-ph">搜资讯 · 查行情 · 问农技</text>
      </view>

      <view class="card menu-card">
        <view v-for="item in menus" :key="item.title" class="menu-row" @click="go(item.url)">
          <view class="menu-icon">{{ item.icon }}</view>
          <view class="menu-body">
            <text class="menu-title">{{ item.title }}</text>
            <text class="menu-desc">{{ item.desc }}</text>
          </view>
          <text v-if="item.badge()" class="menu-badge">{{ item.badge() }}</text>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <view class="card creator-card" @click="go('/pages/sd/publish?type=supply')">
        <view class="creator-icon">✍️</view>
        <view class="creator-copy">
          <text class="strong">创作中心</text>
          <text class="tiny">发布田间动态与供需信息，成为认证创作者</text>
        </view>
        <text class="item-arrow">›</text>
      </view>

      <button class="btn btn-ghost btn-block" @click="toEdit">编辑资料</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.profile-page {
  background: #f4f7f5;
}

.profile-hero {
  padding: 0 26rpx 28rpx;
  border-radius: 0 0 40rpx 40rpx;
  background: radial-gradient(circle at 88% 0, rgba(83, 213, 138, 0.28), transparent 420rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin-top: 16rpx;
}

.avatar {
  display: flex;
  width: 116rpx;
  height: 116rpx;
  flex: 0 0 116rpx;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgba(255, 255, 255, 0.24);
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.12);
  font-size: 52rpx;
}

.hero-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.name {
  font-size: 36rpx;
  font-weight: 750;
}

.cert {
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.18);
  font-size: 24rpx;
}

.hero-sub {
  color: rgba(255, 255, 255, 0.6);
  font-size: 24rpx;
}

.cat-row {
  display: flex;
  gap: 8rpx;
  margin-top: 4rpx;
}

.cat {
  padding: 3rpx 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
}

.settings {
  padding: 8rpx 14rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 14rpx;
  font-size: 24rpx;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 26rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
}

.stat-num.light {
  color: #ffffff;
}

.stat-label.light {
  color: rgba(255, 255, 255, 0.55);
}

.page-body {
  padding: 20rpx 24rpx 40rpx;
}

.search-box {
  display: flex;
  height: 76rpx;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 18rpx;
  padding: 0 22rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 18rpx;
  background: #ffffff;
}

.search-icon {
  color: #94a198;
  font-size: 28rpx;
}

.search-ph {
  color: #b3c0b7;
  font-size: 24rpx;
}

.menu-card {
  padding: 4rpx 24rpx;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.menu-row:last-child {
  border-bottom: 0;
}

.menu-icon {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 68rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: #eef6f1;
  font-size: 30rpx;
}

.menu-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3rpx;
}

.menu-title {
  font-size: 26rpx;
  font-weight: 620;
}

.menu-desc {
  overflow: hidden;
  color: #94a198;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-badge {
  min-width: 36rpx;
  height: 32rpx;
  padding: 0 10rpx;
  border-radius: 16rpx;
  background: #eef7f2;
  color: #0e5233;
  font-size: 24rpx;
  line-height: 32rpx;
  text-align: center;
}

.creator-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: linear-gradient(135deg, #f7fbf8, #eef6f1);
}

.creator-icon {
  font-size: 34rpx;
}

.creator-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
</style>
