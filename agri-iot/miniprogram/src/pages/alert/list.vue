<template>
  <view class="page">
    <view class="header">
      <text class="header-title">告警管理</text>
      <text class="alert-count">共 {{ alertList.length }} 条告警</text>
    </view>

    <view class="stats-section">
      <view class="stats-grid">
        <view class="stat-card critical">
          <view class="stat-icon">🔴</view>
          <view class="stat-info">
            <text class="stat-num">{{ criticalCount }}</text>
            <text class="stat-text">紧急告警</text>
          </view>
        </view>
        <view class="stat-card warning">
          <view class="stat-icon">🟡</view>
          <view class="stat-info">
            <text class="stat-num">{{ warningCount }}</text>
            <text class="stat-text">警告</text>
          </view>
        </view>
        <view class="stat-card info">
          <view class="stat-icon">🔵</view>
          <view class="stat-info">
            <text class="stat-num">{{ infoCount }}</text>
            <text class="stat-text">信息</text>
          </view>
        </view>
      </view>
    </view>

    <view class="filter-section">
      <view class="filter-tabs">
        <view 
          class="filter-tab" 
          :class="{ active: statusFilter === '' }" 
          @click="statusFilter = ''"
        >全部</view>
        <view 
          class="filter-tab" 
          :class="{ active: statusFilter === 'pending' }" 
          @click="statusFilter = 'pending'"
        >待处理</view>
        <view 
          class="filter-tab" 
          :class="{ active: statusFilter === 'handled' }" 
          @click="statusFilter = 'handled'"
        >已处理</view>
      </view>
    </view>

    <scroll-view class="alert-scroll" scroll-y>
      <view class="alert-list">
        <view 
          class="alert-card" 
          v-for="alert in filteredList" 
          :key="alert.id"
          @click="handleAlert(alert)"
        >
          <view class="alert-indicator" :class="alert.level"></view>
          <view class="alert-content">
            <view class="alert-header">
              <view class="alert-level-badge" :class="alert.level">
                {{ alert.level === 'critical' ? '紧急' : alert.level === 'warning' ? '警告' : '信息' }}
              </view>
              <text class="alert-time">{{ alert.time }}</text>
            </view>
            <text class="alert-title">{{ alert.title }}</text>
            <text class="alert-device">{{ alert.device }}</text>
          </view>
          <view class="alert-action">
            <text class="action-btn" :class="alert.status">{{ alert.status === 'pending' ? '处理' : '查看' }}</text>
          </view>
        </view>
      </view>

      <view class="empty-state" v-if="filteredList.length === 0">
        <text class="empty-icon">✅</text>
        <text class="empty-text">暂无{{ statusFilter === 'pending' ? '待处理' : statusFilter === 'handled' ? '已处理' : '' }}告警</text>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const statusFilter = ref('')

const alertList = ref([
  { id: 1, title: '温度异常告警', device: '温湿度传感器-001', time: '10分钟前', level: 'critical', status: 'pending' },
  { id: 2, title: '湿度偏低警告', device: '土壤湿度传感器-002', time: '30分钟前', level: 'warning', status: 'pending' },
  { id: 3, title: '设备离线提醒', device: '灌溉控制器-004', time: '1小时前', level: 'critical', status: 'pending' },
  { id: 4, title: '光照强度不足', device: '光照传感器-003', time: '2小时前', level: 'warning', status: 'handled' },
  { id: 5, title: '土壤湿度正常', device: '土壤湿度传感器-002', time: '3小时前', level: 'info', status: 'handled' },
  { id: 6, title: '设备上线通知', device: '温湿度传感器-001', time: '4小时前', level: 'info', status: 'handled' }
])

const criticalCount = computed(() => alertList.value.filter(a => a.level === 'critical' && a.status === 'pending').length)
const warningCount = computed(() => alertList.value.filter(a => a.level === 'warning' && a.status === 'pending').length)
const infoCount = computed(() => alertList.value.filter(a => a.level === 'info' && a.status === 'pending').length)

const filteredList = computed(() => {
  if (!statusFilter.value) return alertList.value
  return alertList.value.filter(a => a.status === statusFilter.value)
})

const handleAlert = (alert: any) => {
  if (alert.status === 'pending') {
    uni.showModal({
      title: '处理告警',
      content: `确认处理"${alert.title}"告警？`,
      success: (res) => {
        if (res.confirm) {
          uni.showToast({ title: '告警已处理', icon: 'success' })
        }
      }
    })
  } else {
    uni.showToast({ title: '查看详情', icon: 'none' })
  }
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

.alert-count {
  font-size: 26rpx;
  color: #999;
}

.stats-section {
  padding: 20rpx 30rpx;
}

.stats-grid {
  display: flex;
  gap: 16rpx;
}

.stat-card {
  flex: 1;
  border-radius: 16rpx;
  padding: 20rpx;
  display: flex;
  align-items: center;
}

.stat-card.critical { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); }
.stat-card.warning { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
.stat-card.info { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }

.stat-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.stat-text {
  font-size: 22rpx;
  color: #999;
}

.filter-section {
  padding: 0 30rpx;
  margin-bottom: 20rpx;
}

.filter-tabs {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
}

.filter-tab {
  flex: 1;
  text-align: center;
  padding: 16rpx;
  font-size: 26rpx;
  color: #666;
  border-radius: 12rpx;
  transition: all 0.2s ease;

  &.active {
    background: #ff7d00;
    color: #fff;
  }
}

.alert-scroll {
  height: calc(100vh - 360rpx);
  padding: 0 30rpx;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.alert-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.alert-indicator {
  width: 8rpx;
  height: 60rpx;
  border-radius: 4rpx;
  margin-right: 20rpx;
}

.alert-indicator.critical { background: #ef4444; }
.alert-indicator.warning { background: #f59e0b; }
.alert-indicator.info { background: #3b82f6; }

.alert-content {
  flex: 1;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.alert-level-badge {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  font-weight: 500;
  color: #fff;
}

.alert-level-badge.critical { background: #ef4444; }
.alert-level-badge.warning { background: #f59e0b; }
.alert-level-badge.info { background: #3b82f6; }

.alert-time {
  font-size: 22rpx;
  color: #999;
}

.alert-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}

.alert-device {
  font-size: 24rpx;
  color: #999;
}

.alert-action {
  margin-left: 16rpx;
}

.action-btn {
  padding: 12rpx 24rpx;
  border-radius: 20rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.action-btn.pending {
  background: linear-gradient(135deg, #ff7d00 0%, #ff9533 100%);
  color: #fff;
}

.action-btn.handled {
  background: #f3f4f6;
  color: #6b7280;
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