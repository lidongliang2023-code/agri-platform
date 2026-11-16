<script setup lang="ts">
import { ref } from 'vue'
import { logoutUnifiedInfo, clearInfoCache } from '../../auth'
import { toast } from '../../api'

const cacheSize = ref('')
function refreshCacheSize() {
  const keys = uni.getStorageInfoSync().keys.filter((key: string) => key.startsWith('info_') && !key.startsWith('info_unified_'))
  const size = keys.reduce((sum: number, key: string) => sum + JSON.stringify(uni.getStorageSync(key) ?? '').length * 2, 0)
  cacheSize.value = `${(size / 1024).toFixed(1)} KB`
}
refreshCacheSize()
function open(url: string) { uni.navigateTo({ url }) }

function clearCache() {
  uni.showModal({
    title: '清理缓存',
    content: `当前缓存约 ${cacheSize.value}，将删除本机浏览、搜索、验证记录及临时草稿，保留登录会话和服务端业务数据。`,
    success: (result: { confirm: boolean }) => {
      if (!result.confirm) return
      clearInfoCache()
      refreshCacheSize()
      toast('缓存已清理', 'success')
    },
  })
}

function checkUpdate() {
  const info = uni.getSystemInfoSync()
  uni.showModal({
    title: '版本信息',
    content: `丰链云信息资讯 V1.0.0\n运行平台：${info.uniPlatform || 'web'}\n统一账号：平台 SSO`,
    showCancel: false,
  })
}

function openPolicy() {
  uni.showModal({
    title: '隐私政策与用户协议',
    content:
      '平台仅收集提供资讯、行情、供需撮合与农技问答所必需的信息。私域数据按统一账号隔离存储，未经授权不向第三方提供。完整条款见平台官网「隐私政策」页面。',
    showCancel: false,
  })
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后将返回统一登录页，本地会话立即清除。',
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      await logoutUnifiedInfo()
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="page-pad">
      <view class="group-label">消息与订阅</view>
      <view class="card">
        <view class="row-item" @click="open('/pages/alert/setup')">
          <view class="row-copy"><text class="row-title">价格预警规则</text><text class="tiny">设置阈值与启用状态</text></view><text class="item-arrow">›</text>
        </view>
        <view class="row-item" @click="open('/pages/subscription/index')">
          <view class="row-copy"><text class="row-title">资讯订阅管理</text><text class="tiny">管理品种和频道订阅</text></view><text class="item-arrow">›</text>
        </view>
      </view>

      <view class="group-label">通用</view>
      <view class="card">
        <view class="row-item" @click="checkUpdate">
          <text class="row-title">版本更新</text>
          <text class="row-value">V1.0.0 ›</text>
        </view>
        <view class="row-item" @click="clearCache">
          <text class="row-title">清理缓存</text>
          <text class="row-value">{{ cacheSize }} ›</text>
        </view>
        <view class="row-item" @click="openPolicy">
          <text class="row-title">隐私政策与用户协议</text>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <button class="btn btn-danger btn-block" style="margin-top: 10rpx" @click="logout">退出登录</button>

      <view class="foot">
        <text class="tiny">丰链云 · 信息资讯移动端 V1.0.0</text>
        <text class="tiny">支持 H5 / 微信小程序 / App 三端部署</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.group-label {
  margin: 14rpx 2rpx 10rpx;
  color: #718277;
  font-size: 24rpx;
  font-weight: 650;
}

.row-item {
  display: flex;
  min-height: 88rpx;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  border-bottom: 1rpx solid #edf2ee;
}

.row-item:last-child {
  border-bottom: 0;
}

.row-copy {
  display: flex;
  flex-direction: column;
  gap: 3rpx;
}

.row-title {
  font-size: 26rpx;
}

.row-value {
  color: #94a198;
  font-size: 24rpx;
}

.foot {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 6rpx;
  padding: 30rpx 0 10rpx;
}
</style>
