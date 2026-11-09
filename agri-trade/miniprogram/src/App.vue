<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  if (!uni.getStorageSync('trade_unified_token')) {
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 0)
  }
})
</script>

<style lang="scss">
page {
  min-height: 100%;
  background: #f4f7f5;
  color: #0b1a12;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
}

view, text, button, input, textarea, scroll-view, image {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

button::after { display: none; }
.page { min-height: 100vh; padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); }
.pad { padding: 24rpx; }
.card { margin-bottom: 20rpx; padding: 24rpx; border: 1rpx solid #e1e9e3; border-radius: 22rpx; background: #fff; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-bottom: 16rpx; }
.card-title { font-size: 29rpx; font-weight: 700; }
.muted { color: #718277; font-size: 24rpx; line-height: 1.55; }
.tiny { color: #94a198; font-size: 24rpx; }
.btn { display: flex; min-height: 78rpx; align-items: center; justify-content: center; padding: 0 24rpx; border: 1rpx solid #dce7df; border-radius: 16rpx; background: #fff; color: #34473b; font-size: 24rpx; font-weight: 650; }
.btn-primary { border-color: #12764a; background: linear-gradient(135deg, #159a5e, #12764a); color: #fff; }
.btn-ghost { border-color: #a9d6ba; background: #f2fbf5; color: #0e5233; }
.tag { display: inline-flex; padding: 4rpx 11rpx; border-radius: 8rpx; background: #e5f5eb; color: #0e5233; font-size: 24rpx; }
.price { color: #d45b32; font-size: 26rpx; font-weight: 800; }
.input, .textarea { width: 100%; padding: 19rpx 21rpx; border: 1rpx solid #dfe8e2; border-radius: 15rpx; background: #fff; font-size: 24rpx; }
.textarea { min-height: 150rpx; }
.form-item { margin-bottom: 20rpx; }
.form-label { display: block; margin-bottom: 9rpx; color: #53665a; font-size: 24rpx; font-weight: 600; }
.empty { padding: 80rpx 20rpx; color: #94a198; text-align: center; font-size: 24rpx; }
.loading { padding: 40rpx; color: #718277; text-align: center; }
@media (min-width: 768px) {
  page { background: #e4ebe6; }
  .page { width: 750rpx; max-width: 750px; margin: 0 auto; background: #f4f7f5; }
}
</style>
