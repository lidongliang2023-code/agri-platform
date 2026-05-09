<template>
  <view class="container">
    <view class="detail-header">
      <view class="device-name">{{ deviceDetail.deviceName }}</view>
      <view class="device-status" :class="deviceDetail.status">
        {{ deviceDetail.status === 'online' ? '在线' : '离线' }}
      </view>
    </view>

    <view class="info-card">
      <view class="info-title">基本信息</view>
      <view class="info-item">
        <text class="info-label">设备编号</text>
        <text class="info-value">{{ deviceDetail.deviceCode }}</text>
      </view>
      <view class="info-item">
        <text class="info-label">设备类型</text>
        <text class="info-value">{{ deviceDetail.deviceType }}</text>
      </view>
      <view class="info-item">
        <text class="info-label">所属地块</text>
        <text class="info-value">{{ deviceDetail.plotName }}</text>
      </view>
      <view class="info-item">
        <text class="info-label">固件版本</text>
        <text class="info-value">{{ deviceDetail.firmwareVersion }}</text>
      </view>
      <view class="info-item">
        <text class="info-label">安装位置</text>
        <text class="info-value">{{ deviceDetail.installLocation }}</text>
      </view>
      <view class="info-item">
        <text class="info-label">最后在线</text>
        <text class="info-value">{{ deviceDetail.lastOnline }}</text>
      </view>
    </view>

    <view class="data-card">
      <view class="data-title">实时数据</view>
      <view class="data-grid">
        <view class="data-item">
          <text class="data-icon">🌡️</text>
          <text class="data-value">{{ deviceDetail.temperature }}</text>
          <text class="data-label">温度</text>
        </view>
        <view class="data-item">
          <text class="data-icon">💧</text>
          <text class="data-value">{{ deviceDetail.humidity }}</text>
          <text class="data-label">湿度</text>
        </view>
        <view class="data-item">
          <text class="data-icon">⚡</text>
          <text class="data-value">{{ deviceDetail.battery }}</text>
          <text class="data-label">电量</text>
        </view>
        <view class="data-item">
          <text class="data-icon">📶</text>
          <text class="data-value">{{ deviceDetail.signal }}</text>
          <text class="data-label">信号</text>
        </view>
      </view>
    </view>

    <view class="control-card">
      <view class="control-title">设备控制</view>
      <view class="control-buttons">
        <view class="control-btn" @click="handleControl('on')">
          <text class="btn-icon">▶️</text>
          <text class="btn-text">开启</text>
        </view>
        <view class="control-btn" @click="handleControl('off')">
          <text class="btn-icon">⏹️</text>
          <text class="btn-text">关闭</text>
        </view>
        <view class="control-btn" @click="handleControl('reboot')">
          <text class="btn-icon">🔄</text>
          <text class="btn-text">重启</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const deviceDetail = reactive({
  deviceName: '温湿度传感器-001',
  deviceCode: 'D001',
  deviceType: '温湿度传感器',
  plotName: '地块A',
  firmwareVersion: 'V1.0.2',
  installLocation: '地块A-区域1',
  status: 'online',
  lastOnline: '刚刚',
  temperature: '25.6°C',
  humidity: '65%',
  battery: '88%',
  signal: '-65dBm'
})

const handleControl = (command: string) => {
  const commandMap: Record<string, string> = {
    on: '开启',
    off: '关闭',
    reboot: '重启'
  }
  uni.showToast({ title: `${commandMap[command]}命令已发送`, icon: 'success' })
}
</script>

<style lang="scss">
.container {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.device-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.device-status {
  padding: 12rpx 24rpx;
  border-radius: 20rpx;
  font-size: 26rpx;

  &.online {
    background: rgba(7, 193, 96, 0.3);
    color: #07c160;
  }

  &.offline {
    background: rgba(153, 153, 153, 0.3);
    color: #999;
  }
}

.info-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.info-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 28rpx;
  color: #999;
}

.info-value {
  font-size: 28rpx;
  color: #333;
}

.data-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.data-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.data-item {
  background: #f9f9f9;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
}

.data-icon {
  display: block;
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.data-value {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.data-label {
  font-size: 24rpx;
  color: #999;
}

.control-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
}

.control-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.control-buttons {
  display: flex;
  justify-content: space-around;
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 40rpx;
  background: #f9f9f9;
  border-radius: 16rpx;
}

.btn-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.btn-text {
  font-size: 26rpx;
  color: #666;
}
</style>