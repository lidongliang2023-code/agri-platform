<template>
  <view class="workspace-page">
    <view v-if="error" class="workspace-state">
      <view class="state-icon">!</view>
      <text class="state-title">业务页面暂时打不开</text>
      <text class="state-desc">{{ error }}</text>
      <button class="btn-primary state-btn" @click="load">重新连接</button>
      <button class="btn-ghost state-btn" @click="backToBusiness">返回全部业务</button>
      <view class="btn-ghost state-btn" @tap="connection">设置服务地址</view>
      <text class="muted state-tip">微信真机须配置 HTTPS 请求域名与业务域名；APP 须能连接同一生产网关。</text>
    </view>
    <view v-else-if="!src" class="workspace-state">
      <view class="state-spinner" />
      <text class="state-desc">正在核实账号与业务权限…</text>
    </view>
    <web-view v-else :src="src" @error="failed" />
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { workspaceUrl, workspaceMode, ensureWorkspaceSession, openWorkspace } from '@/utils/workspace'
const target = ref('/production/dashboard'); const src = ref(''); const error = ref(''); let busy = false
async function load(): Promise<void> {
  if (busy) return
  busy = true; error.value = ''; src.value = ''
  try {
    if (!await ensureWorkspaceSession()) return
    if (!/^\/(production|admin\/production)\/[a-zA-Z0-9/_-]+$/.test(target.value)) throw new Error('业务地址无效，请返回全部业务重新选择')
    if (target.value.startsWith('/admin/production/') !== (workspaceMode() === 'ops')) throw new Error('该页面与当前工作模式不一致，请返回全部业务重新选择')
    if (target.value.startsWith('/production/')) { openWorkspace(target.value); return }
    src.value = await workspaceUrl(target.value)
  } catch (e: any) { error.value = e.message || '业务服务连接失败' } finally { busy = false }
}
function backToBusiness(): void { uni.switchTab({ url: '/pages/business/business' }) }
function failed(): void { src.value = ''; error.value = '请检查网络、服务地址及微信业务域名配置' }
function connection(): void { uni.navigateTo({ url: '/pages/connection/connection' }) }

// H5 下业务页运行在同源 iframe 中：内嵌会话过期或退出时回到客户端，由客户端统一处理登录。
// #ifdef H5
function onShellMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin || event.data?.type !== 'agri-workspace-ended') return
  uni.showToast({ title: event.data.reason === 'logout' ? '已退出业务页面' : '登录已失效，请重新进入', icon: 'none' })
  setTimeout(() => uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workbench/workbench' }) }), 600)
}
// #endif

onLoad(options => {
  target.value = String(options?.target || '/production/dashboard')
  const title = String(options?.title || '生产业务')
  uni.setNavigationBarTitle({ title })
  // #ifdef H5
  window.addEventListener('message', onShellMessage)
  // #endif
  void load()
})
onUnload(() => {
  // #ifdef H5
  window.removeEventListener('message', onShellMessage)
  // #endif
})
</script>
<style scoped>
.workspace-page { min-height: 100vh; background: #f5f6fa; }
.workspace-state { display: flex; flex-direction: column; align-items: center; padding: 160rpx 48rpx 48rpx; text-align: center; }
.state-icon { width: 112rpx; height: 112rpx; border-radius: 50%; background: #fff4f0; color: #d4380d; font-size: 56rpx; font-weight: 700; line-height: 112rpx; margin-bottom: 32rpx; }
.state-title { font-size: 34rpx; font-weight: 600; color: #16462e; margin-bottom: 16rpx; }
.state-desc { font-size: 26rpx; color: #5b6b62; line-height: 1.7; margin-bottom: 40rpx; }
.state-btn { width: 100%; margin-bottom: 20rpx; }
.state-tip { line-height: 1.8; margin-top: 12rpx; }
.state-spinner { width: 72rpx; height: 72rpx; border-radius: 50%; border: 6rpx solid #d9efe2; border-top-color: #13a05a; animation: spin 0.9s linear infinite; margin-bottom: 32rpx; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
