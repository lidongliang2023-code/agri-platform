<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // 多端统一入口：H5、微信小程序与 App 共用同一套平台统一账号会话。
  if (!uni.getStorageSync('info_unified_token')) {
    setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 0)
  }
})
</script>

<style lang="scss">
/* ===== 平台移动端设计令牌（与综合服务、政府监管等模块保持同一套视觉语言） ===== */
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

.tag.purple {
  background: #f3eaf9;
  color: #6b418d;
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

/* uni-app 的 input 组件在 H5 / 小程序都自带固定高度（1.4em）且 overflow:hidden。
   若再叠加垂直内边距，内容区会被压成 1~2px —— 表现为「看得到输入框、点不进、输不了字」。
   所以这里显式给高度，内边距只留水平方向。 */
.input,
.select {
  width: 100%;
  height: 82rpx;
  min-height: 82rpx;
  padding: 0 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  background: #ffffff;
  color: #0b1a12;
  font-size: 26rpx;
  line-height: normal;
}

.textarea {
  width: 100%;
  height: 200rpx;
  min-height: 150rpx;
  padding: 16rpx 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  background: #ffffff;
  color: #0b1a12;
  font-size: 26rpx;
  line-height: 1.6;
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

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
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
  flex: 1;
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 700;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-nav .right {
  min-width: 96rpx;
  color: #12764a;
  font-size: 24rpx;
  text-align: right;
}

.custom-nav.light .back,
.custom-nav.light .title,
.custom-nav.light .right {
  color: #ffffff;
}

.safe-bottom {
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

/* ===== 信息资讯模块通用样式（行情涨跌、分区、标签页、列表） ===== */

/* 行情涨跌：A 股/国内农产品惯例，涨红跌绿。 */
.up {
  color: #c62828;
}

.down {
  color: #2e7d32;
}

.flat {
  color: #718277;
}

.price {
  font-family: "DIN Alternate", "SF Pro Display", monospace;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.price-unit {
  margin-left: 4rpx;
  color: #94a198;
  font-size: 24rpx;
  font-weight: 400;
}

.chg {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  font-family: "DIN Alternate", monospace;
  font-size: 24rpx;
  font-weight: 600;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 26rpx 2rpx 14rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
}

.seg {
  display: flex;
  gap: 8rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: #eef3ef;
}

.seg > view {
  flex: 1;
  padding: 12rpx 0;
  border-radius: 12rpx;
  color: #718277;
  font-size: 24rpx;
  text-align: center;
}

.seg > view.active {
  background: #ffffff;
  color: #0e5233;
  font-weight: 650;
  box-shadow: 0 4rpx 12rpx rgba(20, 64, 40, 0.08);
}

.chips {
  width: 100%;
  white-space: nowrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  margin-right: 12rpx;
  padding: 12rpx 24rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 30rpx;
  background: #ffffff;
  color: #53665a;
  font-size: 24rpx;
}

.chip.active {
  border-color: #12764a;
  background: #12764a;
  color: #ffffff;
  font-weight: 600;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.list-item:last-child {
  border-bottom: 0;
}

.item-icon {
  display: flex;
  width: 74rpx;
  height: 74rpx;
  flex: 0 0 74rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #eef6f1;
  font-size: 34rpx;
}

.item-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.item-title {
  overflow: hidden;
  color: #0b1a12;
  font-size: 27rpx;
  font-weight: 620;
  line-height: 1.42;
  text-overflow: ellipsis;
}

.item-title.clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.item-sub {
  overflow: hidden;
  color: #94a198;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-arrow {
  color: #c3cec6;
  font-size: 30rpx;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #f2fbf5;
  color: #0e5233;
  font-size: 24rpx;
  line-height: 1.6;
}

.notice.ai {
  border: 1rpx solid #e2d4ec;
  background: #faf7fc;
  color: #6b418d;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.stat-cell {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 4rpx;
}

.stat-num {
  color: #0e5233;
  font-family: "DIN Alternate", monospace;
  font-size: 34rpx;
  font-weight: 700;
}

.stat-label {
  color: #94a198;
  font-size: 24rpx;
}

.divider {
  height: 1rpx;
  margin: 18rpx 0;
  background: #edf2ee;
}

/* 悬浮操作条（详情页底部） */
.action-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e8efea;
  background: rgba(255, 255, 255, 0.97);
}

.action-bar .icon-btn {
  display: flex;
  width: 84rpx;
  flex: 0 0 84rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2rpx;
  color: #718277;
  font-size: 24rpx;
}

.action-bar .icon-btn text:first-child {
  font-size: 32rpx;
}

.action-bar .grow {
  flex: 1;
}

/* 富文本正文 */
.article-body {
  color: #2c3a31;
  font-size: 27rpx;
  line-height: 1.85;
}

.article-body text {
  display: block;
  margin-bottom: 18rpx;
}

.article-body .h {
  margin: 24rpx 0 14rpx;
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
}

.article-body .quote {
  margin: 18rpx 0;
  padding: 18rpx 20rpx;
  border-left: 6rpx solid #12764a;
  border-radius: 0 12rpx 12rpx 0;
  background: #f4f9f6;
  color: #34473b;
  font-size: 24rpx;
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

  .action-bar {
    right: auto;
    left: 50%;
    width: 750rpx;
    max-width: 750px;
    transform: translateX(-50%);
  }
}
</style>
