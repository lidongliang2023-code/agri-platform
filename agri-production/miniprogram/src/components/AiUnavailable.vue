<template>
  <view class="page">
    <view class="card">
      <view class="card-title"><text>{{ title }}</text></view>
      <view class="muted">{{ description }}</view>
    </view>

    <view v-if="loading" class="card muted">正在请求服务端…</view>
    <view v-else-if="backendMessage" class="error-box">
      <view><text class="strong">服务端返回：</text></view>
      <view style="margin-top: 8rpx">{{ backendMessage }}</view>
    </view>
    <view v-else-if="error" class="error-box">请求失败：{{ error }}</view>

    <view v-if="fallbacks.length > 0" class="card">
      <view class="card-title"><text>可用的替代路径</text></view>
      <view v-for="item in fallbacks" :key="item.path" class="field" @click="go(item)">
        <text class="field-label">{{ item.label }}</text>
        <text class="field-value link">前往 →</text>
      </view>
      <view class="muted" style="margin-top: 12rpx">
        这些路径走的是已入库的真实数据，不是本页能力的近似替代。
      </view>
    </view>

    <view style="margin: 24rpx">
      <view class="btn-ghost" @click="retry">重新请求</view>
    </view>

    <view class="muted" style="text-align: center; padding: 0 40rpx">
      页面按 PRD 契约接的是真接口；接口返回 501 时把后端原文原样展示，不在前端造结果。
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

/**
 * AI 能力页的公共壳（PRD §11 的 5 个页面共用）。

 *
 * <p>这些能力在本部署都没有模型/数据源，后端统一返回 501 + 原因。这个组件负责：
 * 调真接口 → 把后端原文展示出来 → 给出**走真实数据**的替代路径。
 * 它不生成任何"预测/识别"结果，避免把占位做成假功能。</p>
 */
const props = defineProps<{
  /** 页面标题 */
  title: string
  /** 这个页面本该做什么（取自 PRD） */
  description: string
  /** 调用的接口（返回 Promise；预期抛 501） */
  loader: () => Promise<unknown>
  /** 替代路径：{ label, path, tab? } */
  fallbacks: { label: string; path: string; tab?: boolean }[]
}>()

const loading = ref(true)
/** 后端原文（501 的 message） */
const backendMessage = ref('')
const error = ref('')

async function run(): Promise<void> {
  loading.value = true
  backendMessage.value = ''
  error.value = ''
  try {
    await props.loader()
    // 若哪天真接上了，这里就是"有结果"的分支；当前所有 AI 端点都会走 catch
    backendMessage.value = '接口已返回结果（本页暂未渲染，请按新契约补展示）。'
  } catch (err: any) {
    const message = String(err?.message ?? '')
    if (message.indexOf('未接入') >= 0 || message.indexOf('501') >= 0) {
      backendMessage.value = message
    } else {
      error.value = message || '未知错误'
    }
  } finally {
    loading.value = false
  }
}

function go(item: { label: string; path: string; tab?: boolean }): void {
  if (item.tab) {
    uni.switchTab({ url: item.path })
  } else {
    uni.navigateTo({ url: item.path })
  }
}

const retry = (): void => {
  void run()
}

onMounted(() => {
  void run()
})
</script>
