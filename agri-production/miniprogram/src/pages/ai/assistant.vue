<template>
  <AiUnavailable
    title="👩‍🌾 AI 农艺师"
    description="PRD §11.2：多智能体路由（生长监测 / 水肥优化 / 病虫害防控）的对话式问答。本部署没有对话模型。"
    :loader="loadChat"
    :fallbacks="fallbacks"
  />
</template>

<script setup lang="ts">
import AiUnavailable from '@/components/AiUnavailable.vue'
import { aiChat } from '@/api/production'

/** 按契约调真接口（固定一句占位提问，只为拿到后端"未接入"的原文） */
const loadChat = () =>
  aiChat({ inputType: 'text', text: '本季水肥该怎么调整？', plotId: '' })

const fallbacks = [
  { label: '农事任务（已排的作业）', path: '/pages/tasks/tasks', tab: true },
  { label: '地块详情（最近农事与投入品）', path: '/pages/plots/plots', tab: true },
]
</script>
