<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

// 与PC一致：大厅允许游客浏览，写操作与私有页面单独校验登录。
onLaunch(() => {})
</script>

<style lang="scss">
/* ========== 交易撮合移动端统一样式（H5 / 微信小程序 / APP 共用） ========== */
page {
  --c-primary: #12764a;
  --c-primary-dark: #0b4d30;
  --c-primary-soft: #e8f6ee;
  --c-bg: #f3f6f4;
  --c-card: #ffffff;
  --c-text: #17271e;
  --c-text-2: #53665a;
  --c-text-3: #666666;
  --c-line: #e8eeea;
  --c-price: #e53935;
  --c-danger: #b71c1c;
  min-height: 100%;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

view, text, button, input, textarea, scroll-view, image, picker {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: inherit;
}
button::after { display: none; }

/* #ifdef H5 */
/* uni-app H5 内置样式会在启动 3 秒后从 cdn.dcloud.net.cn 预取导航栏阴影图；本应用不用该阴影，
   内网环境下这是一条必定失败的外网请求，关掉。 */
body::after { animation: none !important; }
/* #endif */
button[disabled] { opacity: .5; }

/* ---------- 页面骨架 ---------- */
.page { min-height: 100vh; padding: 24rpx 24rpx calc(32rpx + env(safe-area-inset-bottom)); background: var(--c-bg); }
.page.flush { padding: 0 0 calc(32rpx + env(safe-area-inset-bottom)); }
.page.with-bar { padding-bottom: calc(160rpx + env(safe-area-inset-bottom)); }
.pad { padding: 0 24rpx; }
.section { margin-top: 24rpx; }

/* ---------- 卡片 ---------- */
.card { margin-bottom: 20rpx; padding: 28rpx; border-radius: 24rpx; background: var(--c-card); overflow-wrap: anywhere; }
.card.tight { padding: 8rpx 28rpx; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 56rpx; margin-bottom: 12rpx; }
.card-title { font-size: 30rpx; font-weight: 700; color: var(--c-text); }
.card-more { display: flex; align-items: center; min-height: 64rpx; padding-left: 24rpx; color: var(--c-text-3); font-size: 24rpx; }
.section-title { display: flex; align-items: center; justify-content: space-between; min-height: 64rpx; margin: 8rpx 4rpx 12rpx; font-size: 30rpx; font-weight: 700; }

/* ---------- 文字 ---------- */
.muted { color: var(--c-text-2); font-size: 24rpx; line-height: 1.6; }
.tiny { color: var(--c-text-3); font-size: 24rpx; }
.price { color: var(--c-danger); font-size: 32rpx; font-weight: 700; font-family: "DIN Alternate", "Helvetica Neue", Arial, sans-serif; }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.between { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.grow { min-width: 0; flex: 1; }

/* ---------- 按钮 ---------- */
.btn { display: flex; min-height: 88rpx; align-items: center; justify-content: center; gap: 8rpx; padding: 0 32rpx; border-radius: 44rpx; background: #f1f4f2; color: var(--c-text); font-size: 28rpx; font-weight: 600; text-align: center; }
.btn-primary { background: var(--c-primary); color: #fff; }
.btn-ghost { background: var(--c-primary-soft); color: var(--c-primary); }
.btn-line { border: 1rpx solid #cfe3d6; background: #fff; color: var(--c-primary); }
.btn-danger { background: #fdeceb; color: var(--c-danger); }
.btn-sm { min-height: 64rpx; padding: 0 24rpx; border-radius: 32rpx; font-size: 24rpx; }
.btn-block { width: 100%; }
.btn + .btn.btn-block { margin-top: 20rpx; }

/* ---------- 标签 ---------- */
.tag { display: inline-flex; flex-shrink: 0; align-items: center; padding: 4rpx 14rpx; border-radius: 8rpx; background: var(--c-primary-soft); color: var(--c-primary); font-size: 24rpx; line-height: 1.5; }
.tag.amber { background: #fff4e0; color: #8f4500; }
.tag.red { background: #fdeceb; color: var(--c-danger); }
.tag.blue { background: #e9f1fd; color: #2f64b7; }
.tag.gray { background: #f0f2f1; color: var(--c-text-3); }

/* ---------- 表单 ---------- */
.form-item { margin-bottom: 28rpx; }
.form-label { display: block; margin-bottom: 12rpx; color: var(--c-text-2); font-size: 26rpx; font-weight: 600; }
.form-label .req { color: var(--c-danger); }
.input, .textarea { display: flex; width: 100%; min-height: 88rpx; align-items: center; padding: 0 24rpx; border: 1rpx solid #e0e8e3; border-radius: 16rpx; background: #fff; color: var(--c-text); font-size: 28rpx; }
.textarea { min-height: 180rpx; padding: 20rpx 24rpx; line-height: 1.6; }
.input.placeholder { color: #a6b2aa; }
.picker-arrow { margin-left: auto; color: var(--c-text-3); }

/* ---------- 键值行 ---------- */
.kv { display: flex; justify-content: space-between; gap: 24rpx; padding: 20rpx 0; border-bottom: 1rpx solid var(--c-line); font-size: 26rpx; }
.kv:last-child { border-bottom: 0; }
.kv-label { flex-shrink: 0; color: var(--c-text-3); }
.kv-value { min-width: 0; color: var(--c-text); text-align: right; overflow-wrap: anywhere; }

/* ---------- 搜索 / 分段 / 筛选 ---------- */
.search-bar { display: flex; align-items: center; gap: 16rpx; height: 80rpx; padding: 0 8rpx 0 28rpx; border-radius: 40rpx; background: #fff; }
.search-bar .search-icon { color: var(--c-text-3); font-size: 28rpx; }
.search-bar input { min-width: 0; flex: 1; height: 80rpx; font-size: 28rpx; }
.search-bar button { height: 64rpx; padding: 0 28rpx; border-radius: 32rpx; background: var(--c-primary); color: #fff; font-size: 26rpx; line-height: 64rpx; }
.seg { display: flex; padding: 6rpx; border-radius: 40rpx; background: #e7eee9; }
.seg-item { display: flex; min-height: 68rpx; flex: 1; align-items: center; justify-content: center; border-radius: 34rpx; color: var(--c-text-2); font-size: 26rpx; }
.seg-item.on { background: #fff; color: var(--c-primary); font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(14, 60, 36, .08); }
.chips { white-space: nowrap; }
.chip { display: inline-flex; min-height: 64rpx; align-items: center; margin-right: 16rpx; padding: 0 28rpx; border-radius: 32rpx; background: #fff; color: var(--c-text-2); font-size: 26rpx; }
.chip.on { background: var(--c-primary); color: #fff; font-weight: 600; }

/* ---------- 宫格入口 ---------- */
.entry-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); row-gap: 28rpx; }
.entry { display: flex; min-width: 0; align-items: center; flex-direction: column; gap: 12rpx; color: var(--c-text); font-size: 24rpx; text-align: center; }
.entry-icon { display: flex; width: 84rpx; height: 84rpx; align-items: center; justify-content: center; border-radius: 26rpx; background: var(--c-primary-soft); color: var(--c-primary); font-size: 32rpx; font-weight: 700; }
.entry-icon.amber { background: #fff4e0; color: #8f4500; }
.entry-icon.blue { background: #e9f1fd; color: #2f64b7; }
.entry-icon.violet { background: #f1ecfd; color: #6b4bc4; }
.entry-icon.red { background: #fdeceb; color: #b71c1c; }
.entry-label { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---------- 列表菜单 ---------- */
.menu-list { overflow: hidden; border-radius: 24rpx; background: #fff; }
.menu-row { display: flex; min-height: 104rpx; align-items: center; gap: 20rpx; padding: 0 28rpx; border-bottom: 1rpx solid var(--c-line); }
.menu-row:last-child { border-bottom: 0; }
.menu-row .entry-icon { width: 60rpx; height: 60rpx; border-radius: 18rpx; font-size: 26rpx; }
.menu-row .menu-text { min-width: 0; flex: 1; font-size: 28rpx; }
.menu-row .menu-desc { color: var(--c-text-3); font-size: 24rpx; }
.arrow { color: #b8c3bc; font-size: 32rpx; }

/* ---------- 底部操作栏 ---------- */
.bottom-bar { position: fixed; z-index: 30; right: 0; bottom: 0; left: 0; display: flex; align-items: center; gap: 20rpx; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid var(--c-line); background: rgba(255, 255, 255, .98); }
.bottom-bar .btn { flex: 1; }

/* ---------- 底部弹层 ---------- */
.sheet-mask { position: fixed; z-index: 50; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: flex-end; background: rgba(8, 24, 15, .45); }
.sheet { display: flex; width: 100%; max-height: 88vh; flex-direction: column; border-radius: 32rpx 32rpx 0 0; background: var(--c-bg); }
.sheet-head { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 20rpx; padding: 28rpx 28rpx 20rpx; }
.sheet-title { min-width: 0; font-size: 32rpx; font-weight: 700; }
.sheet-close { display: flex; width: 64rpx; height: 64rpx; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 50%; background: #e7eee9; color: var(--c-text-2); font-size: 32rpx; }
.sheet-body { min-height: 0; flex: 1; padding: 0 28rpx; }
.sheet-body-inner { padding-bottom: 24rpx; }
.sheet-foot { flex-shrink: 0; padding: 16rpx 28rpx calc(16rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid var(--c-line); background: #fff; }

/* ---------- 状态提示 ---------- */
.notice { margin-bottom: 20rpx; padding: 20rpx 24rpx; border-radius: 16rpx; background: #fff6e5; color: #8a5a12; font-size: 26rpx; line-height: 1.6; }
.notice.error { background: #fdeeec; color: #a8372c; }
.empty, .loading { padding: 64rpx 24rpx; color: var(--c-text-3); font-size: 26rpx; text-align: center; }
.load-error { display: flex; align-items: center; flex-direction: column; gap: 24rpx; margin-bottom: 20rpx; padding: 48rpx 32rpx; border-radius: 24rpx; background: #fff; color: #a8372c; font-size: 26rpx; line-height: 1.6; text-align: center; }
.load-error .btn { min-width: 280rpx; }

/* ---------- 页面标题行 ---------- */
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; min-height: 72rpx; margin-bottom: 20rpx; }
.page-title { min-width: 0; font-size: 34rpx; font-weight: 700; }
.page-sub { display: block; margin-top: 4rpx; color: var(--c-text-3); font-size: 24rpx; font-weight: 400; }

/* ---------- 列表卡片 ---------- */
.list-card { display: block; }
.list-card .line { display: block; margin-top: 10rpx; }
.list-card .foot { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid var(--c-line); }
.list-title { display: block; margin-top: 14rpx; font-size: 30rpx; font-weight: 700; }
.glyph { display: flex; width: 88rpx; height: 88rpx; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 22rpx; background: var(--c-primary-soft); color: var(--c-primary-dark); font-size: 34rpx; font-weight: 700; }
.action-row { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 20rpx; }
.action-row .btn { flex: 1 1 auto; }

/* ---------- 悬浮按钮 ---------- */
.fab { position: fixed; z-index: 20; right: 32rpx; bottom: calc(var(--window-bottom, 0px) + 32rpx); display: flex; height: 96rpx; align-items: center; padding: 0 40rpx; border-radius: 48rpx; background: var(--c-primary); color: #fff; font-size: 28rpx; font-weight: 700; box-shadow: 0 12rpx 32rpx rgba(18, 118, 74, .32); }

/* ---------- 移动端交互强化 ---------- */
.card { box-shadow: 0 6rpx 20rpx rgba(17, 57, 35, .045); }
.card:active, .menu-row:active, .entry:active, .product-card:active, .list-card:active { opacity: .78; transform: scale(.995); }
.mobile-toolbar { display: flex; align-items: center; gap: 16rpx; min-height: 88rpx; margin-bottom: 16rpx; }
.mobile-toolbar .search-bar { min-width: 0; flex: 1; }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16rpx; }
.quick-item { display: flex; min-height: 96rpx; align-items: center; gap: 16rpx; padding: 0 20rpx; border: 1rpx solid var(--c-line); border-radius: 20rpx; background: #fff; }
.quick-item .entry-icon { width: 56rpx; height: 56rpx; border-radius: 18rpx; font-size: 24rpx; }
.quick-item .quick-label { min-width: 0; flex: 1; font-size: 26rpx; font-weight: 600; }
.section-label { display: block; margin: 28rpx 8rpx 12rpx; color: var(--c-text-3); font-size: 24rpx; font-weight: 600; }
.tap-row { transition: opacity .12s, transform .12s; }

/* ---------- 宽屏（H5 在电脑上打开）按手机宽度居中显示 ---------- */
/* #ifdef H5 */
@media (min-width: 560px) {
  body { background: #dfe7e2; }
  uni-page-body, uni-page-wrapper { display: block; max-width: 480px; margin: 0 auto; }
  .uni-page-head, .uni-tabbar, .bottom-bar, .sheet-mask { left: 50% !important; right: auto !important; width: 100% !important; max-width: 480px; transform: translateX(-50%); }
}
/* #endif */
@import '../../../shared/mobile-ui-v1.scss';

/* ---------- UI 规范 V1.0 逐页验收（2026-11-20）：触控目标不小于 44 × 44px ---------- */
.chip { min-height: 88rpx; border-radius: 44rpx; }
.card-more { min-height: 88rpx; }
.search-bar { height: 96rpx; border-radius: 48rpx; }
.search-bar input { height: 96rpx; }
.search-bar button { height: 88rpx; line-height: 88rpx; border-radius: 44rpx; }
.page-head .link, .notice .link { display: inline-flex; align-items: center; min-height: 88rpx; vertical-align: middle; }
/* 空状态：第一行说明为什么空，第二行说明能做什么，再给一个操作 */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 64rpx 24rpx; text-align: center; }
.empty-state .empty-title { color: var(--c-text-2); font-size: 28rpx; font-weight: 600; }
.empty-state .empty-desc { color: var(--c-text-3); font-size: 25rpx; line-height: 1.5; }
.empty-state .btn { margin-top: 12rpx; min-width: 240rpx; }

/* 2026-11-20：逐页实测控件的48px触控区。 */
.card-more, .child.tap-row { min-width:48px; min-height:48px; }
</style>
