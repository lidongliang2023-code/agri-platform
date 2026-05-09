<template>
  <view class="page">
    <view class="header">
      <text class="header-title">设备管理</text>
      <view class="header-right">
        <text class="device-count">{{ deviceList.length }} 台设备</text>
      </view>
    </view>

    <view class="search-section">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input class="search-input" placeholder="搜索设备名称或编号" v-model="searchText" />
        <view v-if="searchText" class="clear-btn" @click="clearSearch">✕</view>
      </view>
    </view>

    <view class="filter-section">
      <scroll-view scroll-x class="filter-scroll">
        <view class="filter-list">
          <view 
            class="filter-item" 
            :class="{ active: statusFilter === '' }" 
            @click="statusFilter = ''"
          >
            <text>全部</text>
            <text class="filter-count">{{ deviceList.length }}</text>
          </view>
          <view 
            class="filter-item" 
            :class="{ active: statusFilter === 'online' }" 
            @click="statusFilter = 'online'"
          >
            <view class="status-dot online"></view>
            <text>在线</text>
            <text class="filter-count">{{ onlineCount }}</text>
          </view>
          <view 
            class="filter-item" 
            :class="{ active: statusFilter === 'offline' }" 
            @click="statusFilter = 'offline'"
          >
            <view class="status-dot offline"></view>
            <text>离线</text>
            <text class="filter-count">{{ offlineCount }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <scroll-view class="device-scroll" scroll-y>
      <view class="device-list">
        <view 
          class="device-card" 
          v-for="device in filteredList" 
          :key="device.id" 
          @click="goToDetail(device.id)"
        >
          <view class="device-icon-wrap" :class="device.iconBg">
            <text class="device-icon">{{ device.icon }}</text>
          </view>
          <view class="device-info">
            <text class="device-name">{{ device.deviceName }}</text>
            <text class="device-meta">{{ device.deviceCode }} · {{ device.deviceType }}</text>
            <view class="device-tags">
              <view class="tag" :class="device.status">{{ device.status === 'online' ? '在线' : '离线' }}</view>
            </view>
          </view>
          <view class="device-data">
            <text class="data-value">{{ device.temperature }}</text>
            <text class="data-label">温度</text>
          </view>
        </view>
      </view>

      <view class="empty-state" v-if="filteredList.length === 0">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无符合条件的设备</text>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const searchText = ref('')
const statusFilter = ref('')

const deviceList = ref([
  { id: 1, deviceName: '温湿度传感器-001', deviceCode: 'D001', deviceType: '温湿度传感器', status: 'online', temperature: '25.6°C', icon: '🌡️', iconBg: 'temp-bg' },
  { id: 2, deviceName: '土壤湿度传感器-002', deviceCode: 'D002', deviceType: '土壤湿度传感器', status: 'online', temperature: '24.3°C', icon: '💧', iconBg: 'water-bg' },
  { id: 3, deviceName: '光照传感器-003', deviceCode: 'D003', deviceType: '光照传感器', status: 'offline', temperature: '--', icon: '☀️', iconBg: 'light-bg' },
  { id: 4, deviceName: '灌溉控制器-004', deviceCode: 'D004', deviceType: '灌溉控制器', status: 'online', temperature: '26.1°C', icon: '⛲', iconBg: 'irri-bg' },
  { id: 5, deviceName: 'CO2传感器-005', deviceCode: 'D005', deviceType: 'CO2传感器', status: 'online', temperature: '23.8°C', icon: '🫧', iconBg: 'co2-bg' },
  { id: 6, deviceName: '风速传感器-006', deviceCode: 'D006', deviceType: '风速传感器', status: 'offline', temperature: '--', icon: '💨', iconBg: 'wind-bg' }
])

const onlineCount = computed(() => deviceList.value.filter(d => d.status === 'online').length)
const offlineCount = computed(() => deviceList.value.filter(d => d.status === 'offline').length)

const filteredList = computed(() => {
  let list = deviceList.value
  
  if (statusFilter.value) {
    list = list.filter(d => d.status === statusFilter.value)
  }
  
  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()
    list = list.filter(d => 
      d.deviceName.toLowerCase().includes(keyword) || 
      d.deviceCode.toLowerCase().includes(keyword)
    )
  }
  
  return list
})

const clearSearch = () => {
  searchText.value = ''
}

const goToDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/device/detail?id=${id}` })
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

.device-count {
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

.filter-section {
  padding: 0 30rpx;
  margin-bottom: 20rpx;
}

.filter-scroll {
  white-space: nowrap;
}

.filter-list {
  display: inline-flex;
  gap: 16rpx;
}

.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  background: #fff;
  padding: 16rpx 24rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #666;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  &.active {
    background: #ff7d00;
    color: #fff;
    .filter-count {
      background: rgba(255, 255, 255, 0.3);
      color: #fff;
    }
  }
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.status-dot.online { background: #10b981; }
.status-dot.offline { background: #999; }

.filter-count {
  background: #f0f0f0;
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
}

.device-scroll {
  height: calc(100vh - 320rpx);
  padding: 0 30rpx;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.device-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.device-icon-wrap {
  width: 90rpx;
  height: 90rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.temp-bg { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); }
.water-bg { background: linear-gradient(135deg, #4ecdc4 0%, #44a3a0 100%); }
.light-bg { background: linear-gradient(135deg, #ffe66d 0%, #ffd93d 100%); }
.irri-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.co2-bg { background: linear-gradient(135deg, #95e1d3 0%, #7dd3c5 100%); }
.wind-bg { background: linear-gradient(135deg, #a29bfe 0%, #8e87fa 100%); }

.device-icon {
  font-size: 44rpx;
}

.device-info {
  flex: 1;
}

.device-name {
  display: block;
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.device-meta {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.device-tags {
  display: flex;
  gap: 12rpx;
}

.tag {
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.tag.online {
  background: #d1fae5;
  color: #065f46;
}

.tag.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.device-data {
  text-align: center;
  padding: 16rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
}

.data-value {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #ff7d00;
}

.data-label {
  font-size: 22rpx;
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