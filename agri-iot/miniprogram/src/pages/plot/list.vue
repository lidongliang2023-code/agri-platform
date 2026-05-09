<template>
  <view class="page">
    <view class="header">
      <text class="header-title">地块管理</text>
      <text class="plot-count">{{ plotList.length }} 个地块</text>
    </view>

    <view class="search-section">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input class="search-input" placeholder="搜索地块名称或编号" v-model="searchText" />
        <view v-if="searchText" class="clear-btn" @click="clearSearch">✕</view>
      </view>
    </view>

    <scroll-view class="plot-scroll" scroll-y>
      <view class="plot-list">
        <view 
          class="plot-card" 
          v-for="plot in filteredList" 
          :key="plot.id"
          @click="goToDetail(plot.id)"
        >
          <view class="plot-header">
            <view class="plot-icon" :class="plot.iconBg">
              {{ plot.icon }}
            </view>
            <view class="plot-title-wrap">
              <text class="plot-name">{{ plot.plotName }}</text>
              <text class="plot-code">{{ plot.plotCode }}</text>
            </view>
            <view class="plot-status" :class="plot.status === 1 ? 'active' : 'inactive'">
              {{ plot.status === 1 ? '启用' : '停用' }}
            </view>
          </view>

          <view class="plot-info">
            <view class="info-grid">
              <view class="info-item">
                <text class="info-label">🌾 作物类型</text>
                <text class="info-value">{{ getCropTypeName(plot.cropType) }}</text>
              </view>
              <view class="info-item">
                <text class="info-label">📊 生长阶段</text>
                <text class="info-value">{{ getCropStageName(plot.cropStage) }}</text>
              </view>
              <view class="info-item">
                <text class="info-label">📏 面积</text>
                <text class="info-value">{{ plot.area }} 亩</text>
              </view>
              <view class="info-item">
                <text class="info-label">📱 设备数</text>
                <text class="info-value">{{ plot.deviceCount }} 台</text>
              </view>
            </view>
          </view>

          <view class="plot-data" v-if="plot.status === 1">
            <view class="data-card">
              <text class="data-value">{{ plot.temperature }}</text>
              <text class="data-label">温度</text>
            </view>
            <view class="data-card">
              <text class="data-value">{{ plot.humidity }}</text>
              <text class="data-label">湿度</text>
            </view>
          </view>
        </view>
      </view>

      <view class="empty-state" v-if="filteredList.length === 0">
        <text class="empty-icon">🌾</text>
        <text class="empty-text">暂无符合条件的地块</text>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const searchText = ref('')

const plotList = ref([
  { id: 1, plotName: '地块A-小麦区', plotCode: 'P001', cropType: 'wheat', cropStage: 'growing', area: 100, deviceCount: 15, status: 1, temperature: '25.6°C', humidity: '65%', icon: '🌾', iconBg: 'wheat-bg' },
  { id: 2, plotName: '地块B-玉米区', plotCode: 'P002', cropType: 'corn', cropStage: 'sowing', area: 50, deviceCount: 8, status: 1, temperature: '24.3°C', humidity: '70%', icon: '🌽', iconBg: 'corn-bg' },
  { id: 3, plotName: '地块C-水稻田', plotCode: 'P003', cropType: 'rice', cropStage: 'mature', area: 80, deviceCount: 12, status: 1, temperature: '26.1°C', humidity: '60%', icon: '🍚', iconBg: 'rice-bg' },
  { id: 4, plotName: '地块D-备用区', plotCode: 'P004', cropType: 'wheat', cropStage: 'growing', area: 120, deviceCount: 18, status: 0, temperature: '--', humidity: '--', icon: '🌱', iconBg: 'other-bg' }
])

const filteredList = computed(() => {
  if (!searchText.value) return plotList.value
  const keyword = searchText.value.toLowerCase()
  return plotList.value.filter(p => 
    p.plotName.toLowerCase().includes(keyword) || 
    p.plotCode.toLowerCase().includes(keyword)
  )
})

const getCropTypeName = (type: string) => {
  const map: Record<string, string> = {
    wheat: '小麦',
    corn: '玉米',
    rice: '水稻'
  }
  return map[type] || type
}

const getCropStageName = (stage: string) => {
  const map: Record<string, string> = {
    sowing: '播种期',
    growing: '生长期',
    mature: '成熟期'
  }
  return map[stage] || stage
}

const clearSearch = () => {
  searchText.value = ''
}

const goToDetail = (id: number) => {
  uni.showToast({ title: `查看地块 ${id}`, icon: 'none' })
}
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #f5f6f8;
}

.header {
  background: #fff;
  padding: 60rpx 30rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.plot-count {
  font-size: 26rpx;
  color: #999;
}

.search-section {
  padding: 20rpx 30rpx;
}

.search-box {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 40rpx;
  padding: 0 30rpx;
  height: 80rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.06);
}

.search-icon {
  font-size: 32rpx;
  margin-right: 16rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  background: transparent;
}

.clear-btn {
  font-size: 28rpx;
  color: #ccc;
  padding: 8rpx;
}

.plot-scroll {
  height: calc(100vh - 220rpx);
  padding: 0 30rpx;
}

.plot-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.plot-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.plot-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.plot-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 16rpx;
}

.wheat-bg { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
.corn-bg { background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%); }
.rice-bg { background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); }
.other-bg { background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%); }

.plot-title-wrap {
  flex: 1;
}

.plot-name {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 4rpx;
}

.plot-code {
  font-size: 24rpx;
  color: #999;
}

.plot-status {
  padding: 8rpx 20rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
}

.plot-status.active {
  background: #d1fae5;
  color: #065f46;
}

.plot-status.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.plot-info {
  margin-bottom: 20rpx;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.info-item {
  background: #f8f9fa;
  padding: 16rpx;
  border-radius: 12rpx;
}

.info-label {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-bottom: 4rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.plot-data {
  display: flex;
  gap: 16rpx;
}

.data-card {
  flex: 1;
  background: linear-gradient(135deg, rgba(255, 125, 0, 0.08) 0%, rgba(255, 149, 51, 0.06) 100%);
  border-radius: 16rpx;
  padding: 20rpx;
  text-align: center;
}

.data-value {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #ff7d00;
  margin-bottom: 8rpx;
}

.data-label {
  font-size: 24rpx;
  color: #999;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.bottom-space {
  height: 120rpx;
}
</style>