<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, money, toast, type SdMatch, type SupplyDemandDetail } from '../../api'

const id = ref(0)
const matches = ref<SdMatch[]>([])
const detail = ref<SupplyDemandDetail | null>(null)
const loading = ref(true)
const onlyHigh = ref(false)

const top = computed(() => matches.value[0])
const reasons = computed(() =>
  (top.value?.reason || '')
    .split(/[；;，,、]/)
    .map((item) => item.trim())
    .filter(Boolean),
)
const visible = computed(() =>
  onlyHigh.value ? matches.value.filter((item) => item.score >= 85) : matches.value,
)

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    const [list, data] = await Promise.all([infoApi.sdMatches(id.value), infoApi.supplyDemand(id.value)])
    matches.value = [...list].sort((a, b) => b.score - a.score)
    detail.value = data
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openDetail(match: SdMatch) {
  uni.navigateTo({ url: `/pages/sd/detail?id=${match.sdId || id.value}` })
}

function inquire(match: SdMatch) {
  uni.navigateTo({ url: `/pages/sd/chat?id=${match.sdId || id.value}` })
}

function toPreference() {
  uni.showModal({
    title: '匹配偏好',
    content:
      '匹配模型按「品类 30% / 规格 25% / 价格 25% / 地域 10% / 时效 10%」加权计算。偏好权重可在运营端按行业模板统一配置，移动端展示当前生效结果。',
    showCancel: false,
  })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">正在计算匹配度…</view>

    <template v-else>
      <view class="head">
        <view class="score-wrap">
          <text class="score">{{ top?.score || 0 }}</text>
          <text class="score-unit">%</text>
        </view>
        <text class="score-label">综合匹配度</text>
        <text class="tiny">基于品类、规格、价格、地域、时效加权计算</text>
        <text class="pref" @click="toPreference">查看权重说明 ›</text>
      </view>

      <view class="page-pad">
        <view v-if="top" class="card">
          <view class="card-head">
            <text class="card-title">匹配依据</text>
            <text class="card-sub">{{ top.targetTitle }}</text>
          </view>
          <view class="reason-row">
            <text v-for="item in reasons" :key="item" class="tag green">{{ item }}</text>
          </view>
          <view class="divider" />
          <view class="field">
            <text class="field-label">价格差异</text>
            <text class="field-value">{{ top.priceGap || '—' }}</text>
          </view>
          <view class="field">
            <text class="field-label">产地距离</text>
            <text class="field-value">{{ top.distanceKm }} km</text>
          </view>
          <view class="field">
            <text class="field-label">匹配对象</text>
            <text class="field-value">{{ top.targetOrg }} · {{ top.targetRegion }}</text>
          </view>
        </view>

        <view v-if="detail?.priceRef" class="ai-card">
          <view class="ai-icon">✦</view>
          <view class="ai-copy">
            <text>AI 议价参考</text>
            <text>
              {{ detail.priceRef.variety }}
              <template v-if="detail.priceRef.available">
                当前行情 {{ money(detail.priceRef.price || 0) }} {{ detail.priceRef.priceUnit || '' }}，
              </template>
              {{ detail.priceRef.note }}
            </text>
            <text>基于平台行情数据生成 · 仅供参考</text>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">为你推荐 {{ matches.length }} 条</text>
          <text :class="['filter', { active: onlyHigh }]" @click="onlyHigh = !onlyHigh">
            {{ onlyHigh ? '只看 85% 以上 ✓' : '只看 85% 以上' }}
          </text>
        </view>

        <view v-if="!visible.length" class="empty">
          <text class="empty-icon">🎯</text>
          <text>暂无匹配结果</text>
        </view>

        <view v-for="item in visible" :key="item.id" class="match-item">
          <view class="match-top">
            <text class="item-icon">📦</text>
            <view class="item-body">
              <text class="item-title">{{ item.targetTitle }}</text>
              <text class="item-sub">{{ item.targetOrg }} · {{ item.targetRegion }}</text>
            </view>
            <text class="match-score">✦ {{ item.score }}%</text>
          </view>
          <text class="match-reason">{{ item.reason }}</text>
          <view class="match-facts">
            <text class="tiny">价差 {{ item.priceGap || '—' }}</text>
            <text class="tiny">距离 {{ item.distanceKm }}km</text>
          </view>
          <view class="match-actions">
            <button class="btn btn-sm grow" @click="openDetail(item)">详情</button>
            <button class="btn btn-primary btn-sm grow" @click="inquire(item)">立即询价</button>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 6rpx;
  padding: 30rpx 24rpx 34rpx;
  background: radial-gradient(circle at 50% 0, rgba(83, 213, 138, 0.24), transparent 420rpx), linear-gradient(160deg, #073821, #0d5d3b);
  color: #ffffff;
}

.score-wrap {
  display: flex;
  align-items: baseline;
}

.score {
  font-family: "DIN Alternate", monospace;
  font-size: 88rpx;
  font-weight: 750;
  letter-spacing: -2rpx;
}

.score-unit {
  margin-left: 4rpx;
  color: #8be1af;
  font-size: 30rpx;
}

.score-label {
  font-size: 24rpx;
  font-weight: 600;
}

.head .tiny {
  color: rgba(255, 255, 255, 0.5);
}

.pref {
  margin-top: 8rpx;
  padding: 6rpx 14rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 12rpx;
  font-size: 24rpx;
}

.reason-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.filter {
  color: #94a198;
  font-size: 24rpx;
}

.filter.active {
  color: #12764a;
  font-weight: 650;
}

.match-item {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 22rpx;
  background: #ffffff;
}

.match-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.match-score {
  padding: 3rpx 10rpx;
  border-radius: 8rpx;
  background: #f3eaf9;
  color: #6b418d;
  font-size: 24rpx;
  font-weight: 650;
}

.match-reason {
  display: block;
  margin-top: 10rpx;
  color: #718277;
  font-size: 24rpx;
  line-height: 1.6;
}

.match-facts {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.match-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
}
</style>
