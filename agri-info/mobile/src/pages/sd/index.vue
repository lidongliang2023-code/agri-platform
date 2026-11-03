<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, money, timeAgo, toast, type SupplyDemand, type SupplyDemandList } from '../../api'

const data = ref<SupplyDemandList | null>(null)
const type = ref<'supply' | 'demand'>('supply')
const category = ref('')
const keyword = ref('')
const loading = ref(true)
const statusBarHeight = ref(0)

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const items = computed(() => data.value?.items || [])
const categories = computed(() => ['全部', ...(data.value?.categories || [])])

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    data.value = await infoApi.supplyDemands({
      type: type.value,
      category: category.value || undefined,
      keyword: keyword.value || undefined,
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function switchType(value: 'supply' | 'demand') {
  type.value = value
  load()
}

function switchCategory(name: string) {
  category.value = name === '全部' ? '' : name
  load()
}

function openDetail(item: SupplyDemand) {
  uni.navigateTo({ url: `/pages/sd/detail?id=${item.id}` })
}

function openMatch(item: SupplyDemand) {
  uni.navigateTo({ url: `/pages/sd/match?id=${item.id}` })
}

function publish() {
  uni.navigateTo({ url: `/pages/sd/publish?type=${type.value}` })
}

function openMine() {
  uni.navigateTo({ url: '/pages/sd/mine' })
}

function badgeTone(badge: string) {
  if (!badge) return 'gray'
  if (badge.includes('AAA')) return 'green'
  if (badge.includes('AA')) return 'blue'
  return 'orange'
}
</script>

<template>
  <view class="page sd-page">
    <view class="hero-block" :style="{ paddingTop: `${statusBarHeight + 8}px` }">
      <view class="search-row">
        <view class="search-box">
          <text class="search-icon">⌕</text>
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜品种 / 产地 / 采购商"
            placeholder-class="ph"
            confirm-type="search"
            @confirm="load()"
          />
        </view>
        <text class="mine-link" @click="openMine">我的发布</text>
      </view>

      <view class="stat-grid">
        <view class="stat-cell">
          <text class="stat-num light">{{ data?.stats.todayCount || 0 }}</text>
          <text class="stat-label light">今日新增</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ data?.stats.supplyCount || 0 }}</text>
          <text class="stat-label light">供应信息</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ data?.stats.demandCount || 0 }}</text>
          <text class="stat-label light">采购需求</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ data?.stats.matchRate || 0 }}%</text>
          <text class="stat-label light">AI 撮合率</text>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view v-if="data?.ai" class="ai-card" @click="openMine">
        <view class="ai-icon">✦</view>
        <view class="ai-copy">
          <text>AI 智能匹配</text>
          <text>{{ data.ai.headline }}</text>
          <text>{{ data.ai.content }}</text>
        </view>
        <text class="arrow">›</text>
      </view>

      <view class="seg" style="margin: 18rpx 0 14rpx">
        <view :class="{ active: type === 'supply' }" @click="switchType('supply')">供应 {{ data?.stats.supplyCount || 0 }}</view>
        <view :class="{ active: type === 'demand' }" @click="switchType('demand')">需求 {{ data?.stats.demandCount || 0 }}</view>
      </view>

      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view
          v-for="name in categories"
          :key="name"
          :class="['chip', { active: (category || '全部') === name }]"
          @click="switchCategory(name)"
        >
          {{ name }}
        </view>
      </scroll-view>

      <view v-if="loading" class="loading">正在加载供需信息…</view>
      <view v-else-if="!items.length" class="empty">
        <text class="empty-icon">🤝</text>
        <text>暂无该类供需信息</text>
        <button class="btn btn-ghost btn-sm" style="margin-top: 12rpx" @click="publish">发布一条</button>
      </view>

      <view v-else class="sd-list">
        <view v-for="item in items" :key="item.id" class="sd-card" @click="openDetail(item)">
          <view class="sd-head">
            <text class="sd-icon">{{ item.sdType === 'supply' ? '📦' : '🛒' }}</text>
            <view class="sd-title-wrap">
              <text class="sd-title">{{ item.title }}</text>
              <text class="tiny">{{ item.origin }}</text>
            </view>
            <text v-if="item.matchScore" class="match">✦ {{ item.matchScore }}%</text>
          </view>

          <text class="sd-spec">{{ item.spec }}</text>

          <view class="sd-price-row">
            <view class="sd-price">
              <text class="price">{{ money(item.price) }}</text>
              <text class="price-unit">{{ item.priceUnit }}</text>
            </view>
            <text class="tiny">{{ item.sdType === 'supply' ? '可供' : '采购量' }} {{ item.quantity }}</text>
          </view>

          <view class="sd-tags">
            <text v-if="item.verified" class="tag green">✓ 已认证</text>
            <text v-if="item.badge" :class="['tag', badgeTone(item.badge)]">{{ item.badge }}</text>
            <text v-if="item.availableDate" class="tag gray">交期 {{ item.availableDate }}</text>
            <text class="tag gray">剩余 {{ item.durationDays }} 天</text>
          </view>

          <view class="sd-foot">
            <text class="tiny">{{ item.orgName }} · {{ timeAgo(item.createdAt) }}</text>
            <view class="sd-actions">
              <text class="tiny">👁 {{ item.viewCount }}</text>
              <text class="tiny">💬 {{ item.chatCount }}</text>
              <text class="link" @click.stop="openMatch(item)">智能匹配 ›</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="fab" @click="publish">＋ 发布</view>
  </view>
</template>

<style lang="scss" scoped>
.sd-page {
  padding-bottom: 60rpx;
  background: #f4f7f5;
}

.hero-block {
  padding: 0 24rpx 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.search-box {
  display: flex;
  height: 74rpx;
  flex: 1;
  align-items: center;
  gap: 10rpx;
  padding: 0 20rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.95);
}

.search-icon {
  color: #94a198;
  font-size: 28rpx;
}

.search-input {
  height: 100%;
  flex: 1;
  color: #0b1a12;
  font-size: 23rpx;
}

.ph {
  color: #b3c0b7;
}

.mine-link {
  padding: 10rpx 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 14rpx;
  font-size: 21rpx;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 20rpx;
}

.stat-num.light {
  color: #ffffff;
}

.stat-label.light {
  color: rgba(255, 255, 255, 0.55);
}

.page-body {
  padding: 18rpx 24rpx 0;
}

.arrow {
  color: #a395ab;
  font-size: 32rpx;
}

.sd-list {
  margin-top: 16rpx;
}

.sd-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 22rpx;
  background: #ffffff;
}

.sd-head {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.sd-icon {
  font-size: 30rpx;
}

.sd-title-wrap {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3rpx;
}

.sd-title {
  font-size: 27rpx;
  font-weight: 650;
  line-height: 1.42;
}

.match {
  padding: 3rpx 10rpx;
  border-radius: 8rpx;
  background: #f3eaf9;
  color: #6b418d;
  font-size: 19rpx;
  font-weight: 650;
}

.sd-spec {
  display: block;
  margin-top: 10rpx;
  color: #718277;
  font-size: 21rpx;
  line-height: 1.55;
}

.sd-price-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 12rpx;
}

.sd-price {
  display: flex;
  align-items: baseline;
}

.sd-price .price {
  color: #0e5233;
}

.sd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.sd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #f1f5f2;
}

.sd-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.link {
  color: #12764a;
  font-size: 21rpx;
  font-weight: 600;
}

.fab {
  position: fixed;
  right: 28rpx;
  bottom: calc(48rpx + env(safe-area-inset-bottom));
  z-index: 20;
  padding: 18rpx 30rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 650;
  box-shadow: 0 12rpx 28rpx rgba(18, 118, 74, 0.28);
}
</style>
