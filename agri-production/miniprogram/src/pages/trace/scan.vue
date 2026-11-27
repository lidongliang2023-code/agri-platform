<template>
  <view class="page">
    <view class="card">
      <view class="card-title"><text>📖 扫码溯源</text></view>
      <!-- #ifndef H5 -->
      <view class="btn-primary" @click="scan">扫描溯源码</view>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <view class="muted">当前环境（H5）不支持相机扫码，请手动输入溯源码。</view>
      <!-- #endif -->
      <view class="divider" /><view class="row"><button size="mini" @click="publicMode=false">本主体管理</button><button size="mini" @click="publicMode=true">公开核验</button></view><text class="muted">{{publicMode?'跨主体公开核验，仅显示可公开信息':'查询本主体溯源码并累计查询次数'}}</text>
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
      <view class="field"><text class="field-label">链上凭证</text><text class="field-value">{{codeInfo.onChain?'已确认上链':'未确认上链'}} · {{codeInfo.chainStatus || codeInfo.unavailableReason || '—'}}</text></view><view class="field"><text class="field-label">交易哈希</text><text class="field-value" selectable>{{codeInfo.txHash || '—'}}</text></view><view class="field" style="border-bottom: none">
        <text class="field-label">扫码次数</text><text class="field-value">{{ codeInfo.queryCount ?? '—' }}</text>
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
import { ref,watch } from 'vue'
import { request } from '@/utils/request'
import { onLoad } from '@dcloudio/uni-app'
import { scanTraceCode, traceFullChain } from '@/api/production'
import { fmtDate } from '@/utils/format'

const publicMode=ref(false),busy=ref(false)
let queryVersion=0
watch(publicMode,()=>{queryVersion++;codeInfo.value=null;nodes.value=[];queried.value=false})
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
 if(busy.value)return;const run=++queryVersion;error.value='';queried.value=true;nodes.value=[];codeInfo.value=null;const target=code.value.trim();if(!target){error.value='请输入溯源码';return}busy.value=true
 try {if(publicMode.value){const result:any=await request({url:'/api/v1/production/trace/public/verify/'+encodeURIComponent(target),auth:false});if(run!==queryVersion)return;codeInfo.value=result;nodes.value=result.nodes || result.timeline || []}
 else {const result=await scanTraceCode(target);if(run!==queryVersion)return;codeInfo.value=result;const chain=await traceFullChain(target);if(run===queryVersion)nodes.value=chain}}
 catch(e:any){if(run===queryVersion)error.value=e.message||'核验失败'}finally{busy.value=false}
}

onLoad((options) => {
  if (options?.code) {
    code.value = String(options.code)
    void query()
  }
})
</script>
