<template>
  <view class="page">
    <TiandituH5Map
      v-if="points.length"
      :points="points"
      height="100vh"
    />
    <view v-else class="empty">地图点位参数为空</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import TiandituH5Map from '@/components/TiandituH5Map.vue'

const points = ref<Array<{
  id: string
  longitude: number
  latitude: number
  title: string
}>>([])

onLoad((options?: Record<string, string>) => {
  try {
    const parsed = JSON.parse(decodeURIComponent(options?.points || '[]'))
    if (Array.isArray(parsed)) points.value = parsed
  } catch {
    points.value = []
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0;
}
</style>
