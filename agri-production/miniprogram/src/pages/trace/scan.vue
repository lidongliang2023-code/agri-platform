<template>
  <view class="page">
    <view class="card">
      <view class="card-title"><text>📖 扫码溯源</text></view>
      <!-- #ifdef MP-WEIXIN -->
      <view class="btn-primary" @click="scan">扫描溯源码</view>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="muted">当前环境（H5）不支持相机扫码，请手动输入溯源码。</view>
      <!-- #endif -->
      <view class="divider" />
      <view class="row">
        <input v-model="code" class="input" style="text-align: left" placeholder="输入溯源码，如 AG010101202606010001" @confirm="query" />
        <text class="btn-ghost btn-sm" @click="query">查询</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>

    <view v-if="codeInfo" class="card">
      <view class="card-title"><text>🔗 {{ codeInfo.traceCode || codeInfo.code || code }}</text></view>
      <view class="field"><text class="field-label">批次</text><text class="field-value">{{ codeInfo.batchNo || '—' }}</text></view>
      <view class="field"><text class="field-label">状态</text><text class="field-value">{{ codeInfo.status ?? '—' }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">扫码次数</text><text class="field-value">{{ codeInfo.scanCount ?? '—' }}</text>
      </view>
    </view>

    <view v-if="nodes.length > 0" class="card">
      <view class="card-title"><text>🧭 全链路节点（{{ nodes.length }}）</text></view>
      <view v-for="(node, index) in nodes" :key="index" class="field">
        <text class="field-label">{{ fmtDate(node.occurredAt ?? node.createTime) }}</text>
        <text class="field-value">{{ node.nodeName ?? node.title ?? node.nodeType ?? '节点' }}</text>
      </view>
    </view>

    <view v-if="queried && !error && nodes.length === 0" class="empty">该溯源码暂无链路节点</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { scanTraceCode, traceFullChain } from '@/api/production'
import { fmtDate } from '@/utils/format'

const code = ref('')
const codeInfo = ref<any | null>(null)
const nodes = ref<any[]>([])
const error = ref('')
const queried = ref(false)

/** 扫码（小程序端）→ 直接把结果填进输入框并查询 */
function scan(): void {
  uni.scanCode({
    success: (res) => {
      code.value = res.result
      void query()
    },
    fail: () => uni.showToast({ title: '未获取到扫码结果', icon: 'none' }),
  })
}

/**
 * 查询链路：先 `POST /trace/scan` 记一次扫码（后端会累加扫码次数），
 * 再取全链路节点。扫码失败（码不存在）如实报错，不伪造链路。
 */
async function query(): Promise<void> {
  error.value = ''
  queried.value = true
  nodes.value = []
  codeInfo.value = null
  const target = code.value.trim()
  if (!target) {
    error.value = '请输入溯源码'
    return
  }
  try {
    codeInfo.value = await scanTraceCode(target)
  } catch (err: any) {
    error.value = err?.message ?? '溯源码查询失败'
    return
  }
  try {
    nodes.value = await traceFullChain(target)
  } catch (err: any) {
    error.value = `码信息已取到，但链路查询失败：${err?.message ?? ''}`
  }
}

onLoad((options) => {
  if (options?.code) {
    code.value = String(options.code)
    void query()
  }
})
</script>
