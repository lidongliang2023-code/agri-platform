<template>
  <AiUnavailable
    title="🛰️ AI 遥感监测"
    description="PRD §11.4：地块遥感识别、NDVI 长势分级与灾害评估。本部署没有遥感影像源。"
    :loader="loadRemoteSensing"
    :fallbacks="fallbacks"
  />
</template>

<script setup lang="ts">
import AiUnavailable from '@/components/AiUnavailable.vue'
import { aiRemoteSensing } from '@/api/production'
import { currentFarm } from '@/utils/auth-helper'

/** 按契约调真接口（需要一个地块；没选地块就先用工农场下的首块地，拿不到就传 1 —— 目的只是触发契约调用） */
const loadRemoteSensing = async () => {
  const farm = currentFarm()
  const plotId = farm?.farmId ? farm.farmId : '1'
  return aiRemoteSensing(plotId)
}

const fallbacks = [
  { label: '地块列表（面积/作物/土壤类型）', path: '/pages/plots/plots', tab: true },
  { label: '地块地图（边界与中心点）', path: '/pages/plots/map' },
]
</script>
