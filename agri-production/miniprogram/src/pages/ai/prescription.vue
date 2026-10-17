<template>
  <AiUnavailable
    title="🧪 AI 种植处方"
    description="PRD §11.3：按地块给出种植处方，支持查看 / 确认 / 跟踪执行进度。本部署没有处方生成能力。"
    :loader="loadPrescriptions"
    :fallbacks="fallbacks"
  />
</template>

<script setup lang="ts">
import AiUnavailable from '@/components/AiUnavailable.vue'
import { aiPrescriptions } from '@/api/production'

/** 按 PRD 契约调真接口（后端 501 占位，组件会把原文展示出来） */
const loadPrescriptions = () => aiPrescriptions()

/** 改走真实数据：处方没接入，但"该做什么、做没做"在农事任务里是有的 */
const fallbacks = [
  { label: '农事任务（按地块/状态查看）', path: '/pages/tasks/tasks', tab: true },
  { label: '地块列表（看当前作物与品种）', path: '/pages/plots/plots', tab: true },
]
</script>
