<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, money, pushView, timeAgo, toast, type SupplyDemandDetail } from '../../api'

const id = ref(0)
const detail = ref<SupplyDemandDetail | null>(null)
const loading = ref(true)
const statusBarHeight = ref(0)
const favorited = ref(false)

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const topMatch = computed(() => detail.value?.matches?.[0])

const isSupply = computed(() => detail.value?.sdType === 'supply')

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    const data = await infoApi.supplyDemand(id.value)
    detail.value = data
    pushView({
      type: 'sd',
      id: data.id,
      title: data.title,
      summary: `${data.origin} · ${data.quantity} · ${money(data.price)} ${data.priceUnit}`,
      icon: data.sdType === 'supply' ? '📦' : '🛒',
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function toggleFavorite() {
  if (!detail.value) return
  try {
    if (favorited.value) {
      toast('已取消收藏')
      favorited.value = false
      return
    }
    await infoApi.addFavorite({
      targetType: 'sd',
      targetId: detail.value.id,
      title: detail.value.title,
      summary: `${detail.value.origin} · ${detail.value.quantity}`,
    })
    favorited.value = true
    toast('已收藏', 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : '操作失败')
  }
}

function openChat() {
  uni.navigateTo({ url: `/pages/sd/chat?id=${id.value}` })
}

function openMatch() {
  uni.navigateTo({ url: `/pages/sd/match?id=${id.value}` })
}

function openAttest() {
  uni.navigateTo({ url: '/pages/attest/index' })
}

function share() {
  uni.setClipboardData({
    data: `丰链云供需：${detail.value?.title || ''}（编号 ${detail.value?.sdNo || ''}）`,
    success: () => toast('链接已复制'),
  })
}

function trade() {
  uni.showModal({
    title: '去交易下单',
    content:
      '平台担保交易在「交易撮合」子系统中完成。确认后将跳转交易模块，以本条供需信息作为订单标的。',
    success: (result: { confirm: boolean }) => {
      if (result.confirm) toast('交易模块接入中，可先在线沟通议价')
    },
  })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<template>
  <view class="page sd-detail">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">供需详情</text>
        <text class="right" @click="share">分享</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载…</view>

    <template v-else-if="detail">
      <view class="head">
        <view class="head-top">
          <text class="head-icon">{{ isSupply ? '📦' : '🛒' }}</text>
          <view class="head-copy">
            <text class="head-title">{{ detail.title }}</text>
            <text class="tiny">{{ detail.sdNo }} · {{ detail.orgName }}</text>
          </view>
          <text :class="['tag', detail.status === 'online' ? 'green' : 'orange']">
            {{ detail.status === 'online' ? '展示中' : '审核中' }}
          </text>
        </view>

        <view class="price-row">
          <view class="price-block">
            <text class="price big">{{ money(detail.price) }}</text>
            <text class="price-unit">{{ detail.priceUnit }}</text>
          </view>
          <text v-if="detail.priceRef?.changePct !== undefined" :class="['chg', (detail.priceRef.changePct || 0) >= 0 ? 'up' : 'down']">
            较行情 {{ (detail.priceRef.changePct || 0) >= 0 ? '+' : '' }}{{ detail.priceRef.changePct }}%
          </text>
        </view>

        <view class="meta-row">
          <text class="tiny">{{ isSupply ? '可供' : '采购量' }} {{ detail.quantity }}</text>
          <text class="tiny">{{ detail.origin }}</text>
          <text class="tiny">发布于 {{ detail.createdAt }} · 浏览 {{ detail.viewCount }}</text>
        </view>

        <view class="tag-row">
          <text v-if="detail.verified" class="tag green">✓ 已实名认证</text>
          <text v-if="detail.badge" class="tag blue">{{ detail.badge }}</text>
          <text class="tag gray">剩余 {{ detail.durationDays }} 天</text>
        </view>
      </view>

      <view class="page-pad">
        <view class="attest" @click="openAttest">
          <text class="attest-icon">🔗</text>
          <view class="attest-copy">
            <text class="strong">内容已上链存证</text>
            <text class="tiny">哈希一致 · 可在「内容验证」中随时复核</text>
          </view>
          <text class="item-arrow">›</text>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">规格与交易条件</text>
          </view>
          <view class="field">
            <text class="field-label">品种规格</text>
            <text class="field-value">{{ detail.variety }} · {{ detail.spec || '—' }}</text>
          </view>
          <view class="field">
            <text class="field-label">数量</text>
            <text class="field-value">{{ detail.quantity }}</text>
          </view>
          <view class="field">
            <text class="field-label">单价</text>
            <text class="field-value">{{ money(detail.price) }} {{ detail.priceUnit }}</text>
          </view>
          <view class="field">
            <text class="field-label">产地 / 收货地</text>
            <text class="field-value">{{ detail.origin }}</text>
          </view>
          <view class="field">
            <text class="field-label">{{ isSupply ? '可供应时间' : '交货期' }}</text>
            <text class="field-value">{{ detail.availableDate || '面议' }}</text>
          </view>
          <view class="field">
            <text class="field-label">有效期</text>
            <text class="field-value">剩余 {{ detail.durationDays }} 天（{{ detail.expireDate }}）</text>
          </view>
          <view class="field">
            <text class="field-label">结算方式</text>
            <text class="field-value">现款现货，支持平台担保交易</text>
          </view>
        </view>

        <view v-if="topMatch" class="card match-card">
          <view class="card-head">
            <text class="card-title">✦ AI 匹配度 {{ topMatch.score }}%</text>
            <text class="card-sub" @click="openMatch">全部匹配 ›</text>
          </view>
          <view class="progress">
            <view :style="{ width: `${topMatch.score}%` }" />
          </view>
          <text class="match-reason">{{ topMatch.reason }}</text>
          <view class="match-meta">
            <text class="tiny">目标：{{ topMatch.targetTitle }}</text>
            <text class="tiny">距离 {{ topMatch.distanceKm }}km · 价差 {{ topMatch.priceGap }}</text>
          </view>
        </view>

        <view v-if="detail.priceRef" class="card">
          <view class="card-head">
            <text class="card-title">AI 议价参考</text>
            <text class="card-sub">{{ detail.priceRef.note }}</text>
          </view>
          <view class="field">
            <text class="field-label">对标品种</text>
            <text class="field-value">{{ detail.priceRef.variety }}</text>
          </view>
          <view v-if="detail.priceRef.available" class="field">
            <text class="field-label">当前行情</text>
            <text class="field-value">
              {{ money(detail.priceRef.price || 0) }} {{ detail.priceRef.priceUnit || '' }}
              <text :class="['chg', (detail.priceRef.changePct || 0) >= 0 ? 'up' : 'down']">
                {{ (detail.priceRef.changePct || 0) >= 0 ? '+' : '' }}{{ detail.priceRef.changePct }}%
              </text>
            </text>
          </view>
          <view class="field">
            <text class="field-label">产地</text>
            <text class="field-value">{{ detail.priceRef.origin || '—' }}</text>
          </view>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">发布者</text>
          </view>
          <view class="publisher">
            <view class="avatar">{{ detail.orgName.slice(0, 1) }}</view>
            <view class="publisher-copy">
              <view class="name-row">
                <text class="strong">{{ detail.orgName }}</text>
                <text v-if="detail.badge" class="tag green">{{ detail.badge }}</text>
              </view>
              <text class="tiny">{{ detail.contactName }} · {{ detail.orgType }}</text>
              <text class="tiny">近 30 天成交活跃 · 平台担保交易</text>
            </view>
          </view>
        </view>

        <view v-if="detail.matches?.length > 1" class="section-head">
          <text class="section-title">相似货源</text>
          <text class="card-sub" @click="openMatch">更多 ›</text>
        </view>
        <view v-if="detail.matches?.length > 1" class="card">
          <view
            v-for="item in detail.matches.slice(1, 4)"
            :key="item.id"
            class="list-item"
            @click="openMatch"
          >
            <view class="item-icon">📦</view>
            <view class="item-body">
              <text class="item-title">{{ item.targetTitle }}</text>
              <text class="item-sub">{{ item.targetRegion }} · {{ item.targetOrg }}</text>
            </view>
            <text class="match-tag">{{ item.score }}%</text>
          </view>
        </view>
      </view>

      <view class="action-bar">
        <view class="icon-btn" @click="toggleFavorite">
          <text>{{ favorited ? '★' : '☆' }}</text>
          <text>收藏</text>
        </view>
        <button class="btn grow" @click="openChat">在线沟通</button>
        <button class="btn btn-primary grow" @click="trade">去交易下单</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.sd-detail {
  padding-bottom: 180rpx;
  background: #f4f7f5;
}

.nav-holder {
  background: #ffffff;
}

.head {
  padding: 20rpx 24rpx 24rpx;
  background: #ffffff;
}

.head-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.head-icon {
  font-size: 34rpx;
}

.head-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.head-title {
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.4;
}

.price-row {
  display: flex;
  align-items: flex-end;
  gap: 14rpx;
  margin-top: 18rpx;
}

.price.big {
  color: #0e5233;
  font-size: 58rpx;
  line-height: 1;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 14rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.attest {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx solid #d9e9df;
  border-radius: 18rpx;
  background: #f4faf6;
}

.attest-icon {
  font-size: 30rpx;
}

.attest-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.match-card .progress {
  height: 12rpx;
  margin: 8rpx 0 14rpx;
}

.match-reason {
  display: block;
  color: #53665a;
  font-size: 23rpx;
  line-height: 1.68;
}

.match-meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 12rpx;
}

.publisher {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.avatar {
  display: flex;
  width: 84rpx;
  height: 84rpx;
  flex: 0 0 84rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #e5f5eb;
  color: #0e5233;
  font-size: 32rpx;
  font-weight: 700;
}

.publisher-copy {
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

.match-tag {
  padding: 3rpx 10rpx;
  border-radius: 8rpx;
  background: #f3eaf9;
  color: #6b418d;
  font-size: 19rpx;
}
</style>
