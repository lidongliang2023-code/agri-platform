<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // H5、微信小程序和 App 共用同一套业务页面与接口。
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
scroll-view,
image {
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
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
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
  font-weight: 700;
}

.card {
  margin: 20rpx 24rpx;
  padding: 26rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 24rpx;
  background: #ffffff;
}

.card-flat {
  margin: 0 0 20rpx;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.card-title {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
}

.card-sub {
  color: #94a198;
  font-size: 24rpx;
}

.btn {
  display: flex;
  min-height: 80rpx;
  align-items: center;
  justify-content: center;
  padding: 0 26rpx;
  border: 1rpx solid #dce7df;
  border-radius: 16rpx;
  background: #ffffff;
  color: #33453b;
  font-size: 26rpx;
  font-weight: 600;
}

.btn-primary {
  border-color: #12764a;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(18, 118, 74, 0.18);
}

.btn-ghost {
  border-color: #b9dfc9;
  background: #f1fbf5;
  color: #0e5233;
}

.btn-danger {
  border-color: #efcccc;
  background: #fff2f2;
  color: #c54b4b;
}

.btn-sm {
  display: inline-flex;
  min-height: 56rpx;
  padding: 0 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-block {
  width: 100%;
}

.price {
  color: #d45b32;
  font-weight: 800;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.tag-green {
  background: #e5f5eb;
  color: #0e5233;
}

.tag-orange {
  background: #fff3dd;
  color: #a96a08;
}

.tag-blue {
  background: #e7f3fa;
  color: #176c93;
}

.tag-red {
  background: #feebeb;
  color: #c54b4b;
}

.tag-gray {
  background: #eef2ef;
  color: #718277;
}

.empty {
  display: flex;
  min-height: 390rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10rpx;
  color: #94a198;
  font-size: 24rpx;
}

.empty-icon {
  display: grid;
  width: 92rpx;
  height: 92rpx;
  place-items: center;
  border-radius: 26rpx;
  background: #edf4ef;
  color: #12764a;
  font-size: 38rpx;
  font-weight: 750;
}

.field {
  display: flex;
  min-height: 86rpx;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #edf2ee;
}

.field:last-child {
  border-bottom: 0;
}

.field-label {
  width: 160rpx;
  color: #718277;
  font-size: 24rpx;
}

.field input,
.field textarea {
  flex: 1;
  color: #0b1a12;
  font-size: 25rpx;
}

.form-item {
  margin-bottom: 20rpx;
}

.form-label {
  display: block;
  margin-bottom: 9rpx;
  color: #52665a;
  font-size: 24rpx;
  font-weight: 600;
}

.input,
.textarea {
  width: 100%;
  padding: 20rpx 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 14rpx;
  background: #ffffff;
  color: #0b1a12;
  font-size: 25rpx;
}

.textarea {
  min-height: 160rpx;
}

.fixed-bottom {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  min-height: 108rpx;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e3eae5;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -10rpx 26rpx rgba(17, 62, 41, 0.06);
}

.status-bar {
  width: 100%;
  background: #ffffff;
}

.custom-nav {
  display: flex;
  height: 88rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 26rpx;
  border-bottom: 1rpx solid #e9efe9;
  background: #ffffff;
}

.custom-nav .back {
  width: 60rpx;
  color: #0b1a12;
  font-size: 50rpx;
  line-height: 1;
}

.custom-nav .title {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
}

.custom-nav .right {
  min-width: 88rpx;
  color: #12764a;
  font-size: 24rpx;
  text-align: right;
}

@media (min-width: 768px) {
  page {
    background: #e6ede8;
  }

  .page,
  .fixed-bottom {
    width: 750rpx;
    max-width: 750px;
    margin: 0 auto;
  }

  .page {
    background: #f4f7f5;
  }
}
</style>
