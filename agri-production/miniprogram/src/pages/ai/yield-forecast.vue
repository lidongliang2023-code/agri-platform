<template>
  <AiUnavailable
    title="📈 AI 产量预测"
    description="PRD §11：按地块预测产量、置信区间、归因分析与同比/区域对比。本部署没有预测模型。"
    :loader="loadForecast"
    :fallbacks="fallbacks"
  />
</template>

<script setup lang="ts">
import AiUnavailable from '@/components/AiUnavailable.vue'
import { aiYieldForecast } from '@/api/production'
import { currentFarm } from '@/utils/auth-helper'

const loadForecast = async () => {
  const farm = currentFarm()
  return aiYieldForecast(farm?.farmId ? farm.farmId : '1')
}

/** 改走真实数据：预测没有，但历史实际产量是有的 */
const fallbacks = [
  { label: '采收台账（实际产量/等级）', path: '/pages/harvests/harvests', tab: true },
  { label: '地块列表（面积与当前作物）', path: '/pages/plots/plots', tab: true },
]
</script>
