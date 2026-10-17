<template>
  <AiUnavailable
    title="🔍 消费者 AI 验真"
    description="PRD §10.4：消费者扫码 + 拍照 → AI 比对品种/成熟度/化学处理 → 溯源完整度评分。本部署没有验真模型。"
    :loader="loadVerify"
    :fallbacks="fallbacks"
  />
</template>

<script setup lang="ts">
import AiUnavailable from '@/components/AiUnavailable.vue'
import { aiVerify } from '@/api/production'

/** 按契约调真接口（没有图片也照调，目的是拿到后端"未接入"的原文而不是本地硬编码一句话） */
const loadVerify = () => aiVerify({ traceCode: '', image: '' })

/** 改走真实数据：验真没有，但溯源码背后的链路是真的 */
const fallbacks = [
  { label: '扫码溯源（真实链路）', path: '/pages/trace/scan' },
  { label: '消息中心（系统通知）', path: '/pages/messages/messages' },
]
</script>
