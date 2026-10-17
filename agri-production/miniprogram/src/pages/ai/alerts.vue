<template>
  <AiUnavailable
    title="🔮 AI 预警中心"
    description="PRD §11.5：预测性预警（pest / drought / frost / flood 等）、AI 建议行动与历史准确率。本部署没有预测模型。"
    :loader="loadAlerts"
    :fallbacks="fallbacks"
  />
</template>

<script setup lang="ts">
import AiUnavailable from '@/components/AiUnavailable.vue'
import { aiAlerts } from '@/api/production'

const loadAlerts = () => aiAlerts()

/** 改走真实数据：已发生的告警是真的，只是"预测"没有 */
const fallbacks = [
  { label: '告警中心（已入库的真实告警）', path: '/pages/alerts/alerts' },
  { label: '工作台（告警摘要）', path: '/pages/workbench/workbench', tab: true },
]
</script>
