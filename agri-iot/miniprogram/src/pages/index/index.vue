<template>
  <view class="page">
    <view class="header">
      <view class="header-content">
        <view class="user-info">
          <view class="user-avatar">👤</view>
          <view class="user-detail">
            <text class="user-name">智慧农业</text>
            <text class="user-desc">欢迎回来</text>
          </view>
        </view>
        <view class="header-actions">
          <view class="action-btn" @click="refreshData">🔄</view>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="content">
      <view class="stats-section">
        <view class="stats-grid">
          <view class="stat-card">
            <view class="stat-icon-wrap device-bg">
              <text class="stat-icon">📱</text>
            </view>
            <view class="stat-info">
              <text class="stat-num">{{ deviceCount }}</text>
              <text class="stat-text">设备总数</text>
            </view>
          </view>
          <view class="stat-card">
            <view class="stat-icon-wrap online-bg">
              <text class="stat-icon">🟢</text>
            </view>
            <view class="stat-info">
              <text class="stat-num">{{ onlineCount }}</text>
              <text class="stat-text">在线</text>
            </view>
          </view>
          <view class="stat-card">
            <view class="stat-icon-wrap alert-bg">
              <text class="stat-icon">🔔</text>
            </view>
            <view class="stat-info">
              <text class="stat-num">{{ alertCount }}</text>
              <text class="stat-text">告警</text>
            </view>
          </view>
        </view>
      </view>

      <view class="realtime-section">
        <view class="section-header">
          <text class="section-title">🌡️ 实时监测</text>
          <text class="update-time">更新于 {{ updateTime }}</text>
        </view>
        <view class="sensor-grid">
          <view class="sensor-item">
            <text class="sensor-value">{{ realtimeData.temperature }}</text>
            <text class="sensor-label">温度</text>
          </view>
          <view class="sensor-item">
            <text class="sensor-value">{{ realtimeData.humidity }}</text>
            <text class="sensor-label">湿度</text>
          </view>
          <view class="sensor-item">
            <text class="sensor-value">{{ realtimeData.light }}</text>
            <text class="sensor-label">光照</text>
          </view>
          <view class="sensor-item">
            <text class="sensor-value">{{ realtimeData.soilHumidity }}</text>
            <text class="sensor-label">土壤湿度</text>
          </view>
        </view>
      </view>

      <view class="alert-section">
        <view class="section-header">
          <text class="section-title">⚠️ 最新告警</text>
          <text class="view-all" @click="goToAlert">查看全部</text>
        </view>
        <view class="alert-list">
          <view class="alert-card" v-for="alert in alertList" :key="alert.id">
            <view class="alert-level" :class="alert.level">
              {{ alert.level === 'critical' ? '紧急' : '警告' }}
            </view>
            <view class="alert-body">
              <text class="alert-title">{{ alert.title }}</text>
              <text class="alert-desc">{{ alert.device }}</text>
            </view>
            <text class="alert-time">{{ alert.time }}</text>
          </view>
        </view>
      </view>

      <view class="quick-section">
        <view class="section-header">
          <text class="section-title">⚡ 快捷操作</text>
        </view>
        <view class="quick-grid">
          <view class="quick-item" @click="controlDevice">
            <view class="quick-icon control-icon">📡</view>
            <text class="quick-text">远程控制</text>
          </view>
          <view class="quick-item" @click="goToPlot">
            <view class="quick-icon plot-icon">🌾</view>
            <text class="quick-text">地块管理</text>
          </view>
          <view class="quick-item">
            <view class="quick-icon chart-icon">📊</view>
            <text class="quick-text">数据分析</text>
          </view>
          <view class="quick-item">
            <view class="quick-icon setting-icon">⚙️</view>
            <text class="quick-text">系统设置</text>
          </view>
        </view>
      </view>

      <view class="tips-section">
        <view class="tips-card">
          <text class="tips-icon">💡</text>
          <view class="tips-content">
            <text class="tips-title">今日农事提醒</text>
            <text class="tips-desc">根据实时监测数据，建议今日灌溉时间为上午10:00-11:00</text>
          </view>
        </view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const deviceCount = ref(156)
const onlineCount = ref(142)
const alertCount = ref(3)
const updateTime = ref('刚刚')

const realtimeData = reactive({
  temperature: '25.6°C',
  humidity: '65%',
  light: '8500lux',
  soilHumidity: '45%'
})

const alertList = ref([
  { id: 1, title: '温度异常', device: '温湿度传感器-001', time: '10分钟前', level: 'critical' },
  { id: 2, title: '湿度偏低', device: '土壤传感器-002', time: '30分钟前', level: 'warning' },
  { id: 3, title: '设备离线', device: '灌溉控制器-004', time: '1小时前', level: 'critical' }
])

const refreshData = () => {
  uni.showToast({ title: '数据已刷新', icon: 'success' })
}

const goToAlert = () => {
  uni.switchTab({ url: '/pages/alert/list' })
}

const goToPlot = () => {
  uni.switchTab({ url: '/pages/plot/list' })
}

const controlDevice = () => {
  uni.navigateTo({ url: '/pages/device/list' })
}
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #f5f6f8;
}

.header {
  background: linear-gradient(135deg, #ff7d00 0%, #ff9533 100%);
  padding: 60rpx 30rpx 40rpx;
  border-radius: 0 0 40rpx 40rpx;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 20rpx;
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.user-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.action-btn {
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.content {
  height: calc(100vh - 180rpx);
  padding: 20rpx;
}

.stats-section {
  margin-top: -30rpx;
}

.stats-grid {
  display: flex;
  gap: 20rpx;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.stat-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.device-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.online-bg { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
.alert-bg { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }

.stat-icon {
  font-size: 40rpx;
}

.stat-info {
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.stat-text {
  font-size: 24rpx;
  color: #999;
}

.realtime-section,
.alert-section,
.quick-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-top: 20rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.update-time {
  font-size: 22rpx;
  color: #999;
}

.view-all {
  font-size: 26rpx;
  color: #ff7d00;
}

.sensor-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.sensor-item {
  background: #f8f9fa;
  border-radius: 16rpx;
  padding: 20rpx;
  text-align: center;
}

.sensor-value {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.sensor-label {
  font-size: 24rpx;
  color: #999;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.alert-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
}

.alert-level {
  width: 60rpx;
  height: 32rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #fff;
  margin-right: 16rpx;
}

.alert-level.critical { background: #ef4444; }
.alert-level.warning { background: #f59e0b; }

.alert-body {
  flex: 1;
}

.alert-title {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.alert-desc {
  font-size: 24rpx;
  color: #999;
}

.alert-time {
  font-size: 22rpx;
  color: #bbb;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
}

.quick-icon {
  width: 90rpx;
  height: 90rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  margin-bottom: 12rpx;
}

.control-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.plot-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
.chart-icon { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
.setting-icon { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }

.quick-text {
  font-size: 24rpx;
  color: #666;
}

.tips-section {
  margin-top: 20rpx;
}

.tips-card {
  display: flex;
  align-items: flex-start;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-radius: 20rpx;
  padding: 24rpx;
  border: 1rpx solid #fde68a;
}

.tips-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
}

.tips-content {
  flex: 1;
}

.tips-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #92400e;
  margin-bottom: 8rpx;
}

.tips-desc {
  font-size: 24rpx;
  color: #b45309;
  line-height: 1.5;
}

.bottom-space {
  height: 120rpx;
}
</style>