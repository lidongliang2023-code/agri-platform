<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // 多端统一入口：H5、微信小程序和 App 共用统一账号会话。
  if (!uni.getStorageSync('service_unified_token')) {
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

view,
text,
button,
input,
textarea,
scroll-view {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

button::after {
  display: none;
  border: 0;
}

.page {
  min-height: 100vh;
  padding-bottom: 36rpx;
}

.page-pad {
  padding: 24rpx;
}

.row {
  display: flex;
  align-items: center;
}

.between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.muted {
  color: #718277;
  font-size: 24rpx;
}

.tiny {
  color: #94a198;
  font-size: 24rpx;
}

.strong {
  font-weight: 650;
}

.card {
  margin-bottom: 20rpx;
  padding: 26rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 28rpx rgba(20, 64, 40, 0.03);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
}

.card-sub {
  color: #94a198;
  font-size: 24rpx;
}

.btn {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: center;
  padding: 0 28rpx;
  border: 1rpx solid #dce7df;
  border-radius: 18rpx;
  background: #ffffff;
  color: #34473b;
  font-size: 26rpx;
  font-weight: 600;
}

.btn-primary {
  border-color: #12764a;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
  box-shadow: 0 10rpx 26rpx rgba(18, 118, 74, 0.2);
}

.btn-ghost {
  border-color: #a9d6ba;
  background: #f2fbf5;
  color: #0e5233;
}

.btn-danger {
  border-color: #efcccc;
  background: #fff2f2;
  color: #c54b4b;
}

.btn-sm {
  display: inline-flex;
  min-height: 58rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-block {
  width: 100%;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.tag.green {
  background: #e5f5eb;
  color: #0e5233;
}

.tag.blue {
  background: #e7f3fa;
  color: #176c93;
}

.tag.orange {
  background: #fff3dd;
  color: #a96a08;
}

.tag.red {
  background: #feebeb;
  color: #c54b4b;
}

.tag.gray {
  background: #eef2ef;
  color: #718277;
}

.field {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #edf2ee;
}

.field:last-child {
  border-bottom: 0;
}

.field-label {
  color: #718277;
  font-size: 24rpx;
}

.field-value {
  max-width: 62%;
  color: #34473b;
  font-size: 24rpx;
  text-align: right;
}

.input,
.textarea,
.select {
  width: 100%;
  padding: 20rpx 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  background: #ffffff;
  color: #0b1a12;
  font-size: 26rpx;
}

.textarea {
  min-height: 150rpx;
}

.form-item {
  margin-bottom: 20rpx;
}

.form-label {
  display: block;
  margin-bottom: 9rpx;
  color: #53665a;
  font-size: 24rpx;
  font-weight: 600;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.progress {
  height: 8rpx;
  overflow: hidden;
  border-radius: 5rpx;
  background: #e7eee9;
}

.progress > view {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #12764a, #3bbb79);
}

.empty {
  display: flex;
  min-height: 420rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12rpx;
  color: #94a198;
  font-size: 24rpx;
}

.empty-icon {
  font-size: 58rpx;
}

.loading {
  padding: 30rpx;
  color: #718277;
  text-align: center;
}

.hero {
  position: relative;
  overflow: hidden;
  padding: 34rpx 30rpx;
  border-radius: 0 0 40rpx 40rpx;
  background: radial-gradient(circle at 90% 0, rgba(83, 213, 138, 0.28), transparent 460rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.hero-title {
  margin-top: 8rpx;
  font-size: 44rpx;
  font-weight: 750;
  letter-spacing: -1rpx;
}

.hero-desc {
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 24rpx;
  line-height: 1.65;
}

.ai-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx;
  border: 1rpx solid #e2d4ec;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #faf7fc, #f1e9f7);
}

.ai-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #765097, #56346f);
  color: #ffffff;
  font-size: 34rpx;
}

.ai-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.ai-copy text:first-child {
  color: #6b418d;
  font-size: 24rpx;
  font-weight: 700;
}

.ai-copy text:nth-child(2) {
  font-size: 28rpx;
  font-weight: 650;
}

.ai-copy text:last-child {
  color: #718277;
  font-size: 24rpx;
}

.custom-nav {
  display: flex;
  height: 88rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 28rpx;
}

.custom-nav .back {
  width: 64rpx;
  color: #0b1a12;
  font-size: 54rpx;
  font-weight: 300;
  line-height: 1;
}

.custom-nav .title {
  font-size: 32rpx;
  font-weight: 700;
}

.custom-nav .right {
  min-width: 96rpx;
  color: #12764a;
  font-size: 24rpx;
  text-align: right;
}

.safe-bottom {
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

@media (min-width: 768px) {
  page {
    background: #e4ebe6;
  }

  .page {
    width: 750rpx;
    max-width: 750px;
    margin: 0 auto;
    min-height: 100vh;
    background: #f4f7f5;
  }
}
</style>
