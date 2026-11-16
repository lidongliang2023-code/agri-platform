<script setup lang="ts">
import { ref } from 'vue'
import { identitySessionReady, canOperate, currentWorkspace } from '../api/iot'
import { showError } from '../utils/ui'
const props = defineProps<{ active: 'overview' | 'business' | 'todo' | 'account' }>()
const busy = ref(false)
const items = [
  { key: 'overview', label: '概览', icon: 'home' },
  { key: 'business', label: '业务', icon: 'device' },
  { key: 'todo', label: '待办', icon: 'alert' },
  { key: 'account', label: '我的', icon: 'account' },
] as const
async function open(key: typeof items[number]['key']) {
  const pages = getCurrentPages()
  const route = pages[pages.length - 1]?.route
  if (busy.value || (key === props.active && (route === 'pages/ops/index' || route === 'pages/account/index'))) return
  busy.value = true
  try {
    await identitySessionReady()
    if (!canOperate() || currentWorkspace() !== 'ops') throw new Error('请先进入获授权的运营工作台')
    if (key === 'account') await uni.switchTab({ url: '/pages/account/index' })
    else await uni.reLaunch({ url: '/pages/ops/index?tab=' + key })
  } catch (error) { showError(error) }
  finally { busy.value = false }
}
</script>
<template>
  <view class="ops-nav-space" aria-hidden="true" />
  <view class="ops-nav" role="navigation" aria-label="运营底部导航">
    <view class="ops-nav-inner">
      <button v-for="item in items" :key="item.key" role="button" class="ops-nav-item" :class="{ selected: active === item.key }" :aria-label="'运营导航：' + item.label" :aria-current="active === item.key ? 'page' : undefined" :disabled="busy" @tap="open(item.key)">
        <image class="ops-nav-icon" :src="'/static/tabbar/' + item.icon + (active === item.key ? '-active' : '') + '.png'" mode="aspectFit" aria-hidden="true" />
        <text>{{ item.label }}</text>
      </button>
    </view>
  </view>
</template>
<style scoped>
.ops-nav-space{height:calc(68px + env(safe-area-inset-bottom));flex-shrink:0}
.ops-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;border-top:1px solid #e1e9e3;background:#fff;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -3px 16px rgba(20,64,40,.04)}
.ops-nav-inner{display:flex;max-width:750px;margin:0 auto;height:60px}
.ops-nav-item{flex:1;min-width:0;min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:5px 0;margin:0;border:0;border-radius:0;background:transparent;color:#718277;font-size:12px;line-height:18px}
.ops-nav-item::after{border:0}.ops-nav-item.selected{color:#12764a;font-weight:600}.ops-nav-icon{width:24px;height:24px}.ops-nav-item:focus-visible{outline:2px solid #12764a;outline-offset:-3px}.ops-nav-item:active{background:#f2f8f4}
</style>
