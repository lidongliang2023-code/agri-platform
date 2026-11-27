<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  // 移动端启动不做隐式登录：没有令牌时由各 Tab 页 onShow 的 ensureLogin() 送登录页，
  // 这样"未登录却停在空白页"不会发生（也没有本地假数据兜底）。
})
</script>

<style lang="scss">
/*
 * 生产管理移动端设计规范（H5 / 微信小程序 / APP 共用）
 * 色彩：品牌绿 #13a05a，深绿 #16462e 用于标题；背景 #f5f6fa；卡片白底 20rpx 圆角。
 * 尺寸：正文 28rpx、辅助 24rpx、标题 32rpx；可点区域最小 88rpx（约 44px）。
 * 页面左右统一留白 24rpx，卡片之间 20rpx。
 */
page {
  --brand: #159a5e;
  --brand-dark: #123f2a;
  --brand-soft: #e6f5ed;
  --brand-pale: #f3faf6;
  --text: #17231c;
  --text-2: #607067;
  --text-3: #666666;
  --line: #e7eee9;
  --bg: #f5f7f5;
  --danger: #cf3f34;
  --warning: #b97808;
  background-color: var(--bg);
  color: var(--text);
  font-size: 28rpx;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
}

/* 所有页面共享同一套手机安全区、横向留白和底部导航空间 */
.page,
.business-page,
.workspace-page {
  min-height: 100vh;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.page.has-fab { padding-bottom: calc(190rpx + env(safe-area-inset-bottom)); }

/* ---------- 移动端页头：短、清楚、保留上下文 ---------- */
.page-hero {
  padding: 28rpx 32rpx 84rpx;
  background: linear-gradient(135deg, #0d5d3a 0%, #159a5e 72%, #42bd80 100%);
  color: #fff;
}
.page-hero .hero-title { display: block; font-size: 38rpx; font-weight: 700; letter-spacing: .2rpx; }
.page-hero .hero-sub { display: block; margin-top: 8rpx; font-size: 24rpx; line-height: 1.45; opacity: 0.86; }
.page-hero + .card,
.page-hero + .stat-card { margin-top: -52rpx; }
.hero-chip {
  display: inline-flex; align-items: center; gap: 8rpx;
  max-width: 100%; box-sizing: border-box; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  margin-top: 18rpx; padding: 10rpx 20rpx; border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18); font-size: 24rpx; color: #fff;
}

.section-title {
  display: flex; align-items: center; justify-content: space-between;
  margin: 32rpx 32rpx 4rpx; font-size: 30rpx; font-weight: 600; color: var(--brand-dark);
}
.section-title .link { font-weight: 400; }

/* ---------- 卡片 ---------- */
.card {
  background-color: #ffffff;
  border: 1rpx solid rgba(231, 238, 233, .92);
  border-radius: 22rpx;
  margin: 18rpx 24rpx;
  padding: 28rpx;
  box-shadow: 0 8rpx 24rpx rgba(18, 63, 42, 0.045);
  box-sizing: border-box;
}
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 30rpx;
  font-weight: 650;
  color: var(--brand-dark);
  margin-bottom: 16rpx;
}
.card.is-tappable:active, .list-item:active, .grid-cell:active, .field:active { opacity: 0.68; }

/* 统计卡：数字优先，标签保持一行 */
.stat-card { display: flex; background: #fff; border: 1rpx solid var(--line); border-radius: 22rpx; margin: 18rpx 24rpx; padding: 26rpx 8rpx; box-shadow: 0 10rpx 26rpx rgba(18, 63, 42, 0.07); }
.stat { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; border-right: 1rpx solid var(--line); }
.stat:last-child { border-right: 0; }
.stat-value { font-size: 40rpx; font-weight: 700; color: var(--brand-dark); }
.stat-value.is-warn { color: var(--warning); }
.stat-value.is-danger { color: var(--danger); }
.stat-label { font-size: 24rpx; color: var(--text-3); }

/* 列表行：标题 + 说明 + 右侧状态 */
.list-item { padding: 24rpx 0; border-bottom: 1rpx solid var(--line); }
.list-item:last-child { border-bottom: 0; padding-bottom: 4rpx; }
.list-item:first-child { padding-top: 4rpx; }
.list-title { font-size: 30rpx; font-weight: 600; color: var(--text); }
.list-meta { margin-top: 8rpx; font-size: 24rpx; color: var(--text-2); }
.list-actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 20rpx; }

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.muted { color: var(--text-3); font-size: 24rpx; }
.overdue-text { color: var(--danger); font-weight: 600; }
.strong { font-weight: 600; }

/* 状态标签：文字色由页面按状态传入，背景自动取浅色 */
.tag {
  flex: none;
  font-size: 24rpx;
  line-height: 1.6;
  padding: 2rpx 14rpx;
  border-radius: 999rpx;
  border: 1rpx solid currentColor;
  margin-left: 8rpx;
  white-space: nowrap;
}
.chip { display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; background: var(--brand-soft); color: var(--brand); font-size: 24rpx; }

/* ---------- 按钮 ---------- */
.btn-primary {
  display: flex; align-items: center; justify-content: center;
  min-height: 88rpx;
  background-color: var(--brand);
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  box-sizing: border-box;
}
.btn-ghost {
  display: flex; align-items: center; justify-content: center;
  min-height: 80rpx;
  border: 1rpx solid #d6e2d9;
  color: var(--brand-dark);
  border-radius: 16rpx;
  font-size: 28rpx;
  background-color: #ffffff;
  box-sizing: border-box;
}
.btn-primary:active { opacity: 0.85; }
.btn-ghost:active { background-color: #f3f7f4; }
.btn-sm {
  display: inline-flex;
  min-height: 60rpx;
  padding: 0 28rpx;
  font-size: 26rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.link { color: var(--brand); font-size: 24rpx; }

/* 悬浮新建按钮：与原生 tabbar 保持安全距离 */
.fab {
  position: fixed; right: 28rpx; z-index: 30;
  bottom: calc(var(--window-bottom, 0px) + 76rpx + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 8rpx;
  height: 84rpx; padding: 0 30rpx; border-radius: 999rpx;
  background: #1e6b38; color: #fff; font-size: 27rpx; font-weight: 600;
  box-shadow: 0 12rpx 28rpx rgba(30, 107, 56, 0.30);
}
.fab:active { opacity: 0.85; }

/* ---------- 筛选与搜索 ---------- */
.tabs {
  display: flex;
  gap: 8rpx;
  overflow-x: auto;
  background-color: rgba(255,255,255,.96);
  padding: 0 20rpx;
  border-bottom: 1rpx solid var(--line);
  position: sticky;
  top: var(--window-top, 0px);
  z-index: 10;
  box-shadow: 0 4rpx 12rpx rgba(18,63,42,.03);
}
.tab-item {
  flex: 0 0 auto;
  min-width: 112rpx;
  text-align: center;
  padding: 24rpx 8rpx 20rpx;
  color: var(--text-2);
  font-size: 27rpx;
  border-bottom: 4rpx solid transparent;
}
.tab-item.active {
  color: #1e6b38;
  font-weight: 600;
  border-bottom-color: var(--brand);
}
.search-bar {
  display: flex; align-items: center; gap: 12rpx;
  margin: 20rpx 24rpx 0; padding: 0 24rpx; height: 80rpx;
  background: #fff; border-radius: 999rpx; border: 1rpx solid var(--line);
}
.search-bar input { flex: 1; font-size: 28rpx; height: 80rpx; }
.search-icon { color: var(--text-3); font-size: 28rpx; }

/* ---------- 状态 ---------- */
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 96rpx 24rpx;
  font-size: 26rpx;
}
.error-box {
  background-color: #fff4f0;
  border: 1rpx solid #ffd2c2;
  color: #c2410c;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin: 20rpx 24rpx;
  font-size: 26rpx;
}
.notice {
  background-color: #eef7ff;
  border: 1rpx solid #c3e0ff;
  color: #1f5fa8;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin: 20rpx 24rpx;
  font-size: 26rpx;
}

/* ---------- 宫格 ---------- */
.grid { display: flex; flex-wrap: wrap; }
.grid-cell {
  width: 33.33%;
  box-sizing: border-box;
  padding: 16rpx 0;
  text-align: center;
}
.grid.cols-4 .grid-cell { width: 25%; }
.grid-icon {
  display: flex; align-items: center; justify-content: center;
  width: 88rpx; height: 88rpx; margin: 0 auto 10rpx; border-radius: 24rpx;
  background: var(--brand-soft); font-size: 40rpx;
}
.grid-label { display: block; font-size: 24rpx; color: var(--text-2); }

/* ---------- 表单 ---------- */
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 96rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid var(--line);
  box-sizing: border-box;
}
.field:last-child { border-bottom: 0; }
.field-label { color: var(--text-2); width: 190rpx; flex: none; }
.field-value { flex: 1; min-width: 0; text-align: right; color: var(--text); word-break: break-all; }
.field-arrow { flex: none; color: #b6c2ba; margin-left: 8rpx; font-size: 34rpx; line-height: 1; }
.input { flex: 1; text-align: right; font-size: 28rpx; min-height: 64rpx; }
.divider { height: 1rpx; background-color: var(--line); margin: 16rpx 0; }

/* 移动端统一的工具栏、筛选行和状态块 */
.toolbar { display: flex; align-items: center; gap: 16rpx; margin: 18rpx 24rpx; }
.toolbar > view, .toolbar > text, .toolbar > input, .toolbar > button, .toolbar > picker { min-width: 0; }
.filter-pill { display: inline-flex; align-items: center; min-height: 64rpx; padding: 0 22rpx; border-radius: 999rpx; background: var(--brand-pale); color: var(--brand-dark); font-size: 24rpx; }
.page-intro { margin: 22rpx 32rpx 0; color: var(--text-2); font-size: 24rpx; line-height: 1.55; }

/* 原生 button 去掉默认描边，统一圆角 */
button { border-radius: 16rpx; font-size: 28rpx; margin: 0; }
button::after { border: 0; }
button[disabled] { opacity: .48; }

/* H5 和 APP 的内容不允许被横向挤出屏幕 */
view, text, input, button { box-sizing: border-box; }

/* 用户端：窄屏长内容、触控与固定操作栏 */
.row > .list-title, .row > .strong { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.search-bar input, .input { min-width: 0; }
.btn-sm { min-height: 84rpx; padding: 0 22rpx; line-height: 1.4; }
.link { display: inline-flex; align-items: center; min-height: 80rpx; }
.task-foot, .harvest-foot, .card-title { flex-wrap: wrap; }
.task-actions { margin-left: auto; }
.list-meta, .plot-meta, .inventory-meta, .harvest-foot > text { overflow-wrap: anywhere; }
.harvest-foot > text { flex: 1; min-width: 160rpx; }
.more-management { margin: 16rpx 24rpx 32rpx; text-align: center; }
.more-management > text { display: block; margin-top: 12rpx; }
.detail-page { padding-bottom: calc(160rpx + env(safe-area-inset-bottom)); }
.mobile-action-bar { position: fixed; left: 0; right: 0; bottom: var(--window-bottom, 0px); z-index: 25; display: flex; gap: 16rpx; background: #fff; border-top: 1rpx solid #e7eee9; padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom)); }
.mobile-action-bar:empty { display: none; }
.mobile-action-bar.busy { pointer-events: none; opacity: .6; }
@media screen and (max-width: 375px) { .field-label { width: 152rpx; } .grid.cols-4 .grid-cell { padding-left: 4rpx; padding-right: 4rpx; } .task-actions { width: 100%; justify-content: flex-end; } }
@import '../../../shared/mobile-ui-v1.scss';
</style>
