<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // 移动端启动不做隐式登录：没有令牌时由各 Tab 页 onShow 的 ensureLogin() 送登录页，
  // 这样"未登录却停在空白页"不会发生（也没有本地假数据兜底）。
})
</script>

<style lang="scss">
/* 全局样式：移动端各页共用的一套轻量原子类，避免每页重复写卡片/标签样式 */
page {
  background-color: #f5f6f8;
  color: #1f2329;
  font-size: 28rpx;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.page {
  min-height: 100vh;
  padding-bottom: 40rpx;
  box-sizing: border-box;
}

.card {
  background-color: #ffffff;
  border-radius: 16rpx;
  margin: 20rpx 24rpx;
  padding: 24rpx;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.muted {
  color: #8c8c8c;
  font-size: 24rpx;
}

.strong {
  font-weight: 600;
}

.tag {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  border: 1rpx solid currentColor;
  margin-left: 8rpx;
}

.btn-primary {
  background-color: #13a05a;
  color: #ffffff;
  border-radius: 12rpx;
  text-align: center;
  padding: 20rpx 0;
  font-size: 30rpx;
}

.btn-ghost {
  border: 1rpx solid #d9d9d9;
  color: #1f2329;
  border-radius: 12rpx;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  background-color: #ffffff;
}

.btn-sm {
  padding: 8rpx 20rpx;
  font-size: 24rpx;
  border-radius: 8rpx;
}

.link {
  color: #13a05a;
  font-size: 24rpx;
}

.tabs {
  display: flex;
  background-color: #ffffff;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  color: #8c8c8c;
  font-size: 28rpx;
}

.tab-item.active {
  color: #13a05a;
  font-weight: 600;
  border-bottom: 4rpx solid #13a05a;
}

.empty {
  text-align: center;
  color: #8c8c8c;
  padding: 80rpx 24rpx;
  font-size: 26rpx;
}

.error-box {
  background-color: #fff2f0;
  border: 1rpx solid #ffccc7;
  color: #cf1322;
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 20rpx 24rpx;
  font-size: 26rpx;
}

.notice {
  background-color: #e6f4ff;
  border: 1rpx solid #91caff;
  color: #0958d9;
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 20rpx 24rpx;
  font-size: 26rpx;
}

.grid {
  display: flex;
  flex-wrap: wrap;
}

.grid-cell {
  width: 33.33%;
  box-sizing: border-box;
  padding: 16rpx 0;
  text-align: center;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.field-label {
  color: #4b5563;
  width: 200rpx;
}

.field-value {
  flex: 1;
  text-align: right;
  color: #1f2329;
}

.input {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
}

.divider {
  height: 1rpx;
  background-color: #f0f0f0;
  margin: 16rpx 0;
}
</style>
