<template>
  <view ref="container" class="tdt-map" :style="{ height }" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

interface MapPoint {
  id: string
  longitude: number
  latitude: number
  title: string
}

const props = withDefaults(defineProps<{
  points: MapPoint[]
  centerLongitude?: number
  centerLatitude?: number
  height?: string
}>(), {
  centerLongitude: 104.2,
  centerLatitude: 35.8,
  height: '560rpx',
})

const emit = defineEmits<{ select: [id: string] }>()
const container = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
let map: any = null
let loadPromise: Promise<any> | null = null

function loadSdk(): Promise<any> {
  const runtime = window as any
  if (runtime.T?.Map) return Promise.resolve(runtime.T)
  if (loadPromise) return loadPromise
  const token = String(import.meta.env.VITE_TIANDITU_TOKEN || '').trim()
  if (!token) return Promise.reject(new Error('未配置 VITE_TIANDITU_TOKEN'))
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${encodeURIComponent(token)}`
    script.async = true
    script.onload = () => runtime.T?.Map ? resolve(runtime.T) : reject(new Error('天地图初始化失败'))
    script.onerror = () => reject(new Error('天地图加载失败'))
    document.head.appendChild(script)
  })
  return loadPromise
}

async function renderMap(): Promise<void> {
  // #ifdef H5
  if (!props.points.length) return
  await nextTick()
  try {
    const T = await loadSdk()
    const element = (container.value as any)?.$el ?? container.value
    if (!(element instanceof HTMLElement)) return
    if (!map) {
      map = new T.Map(element)
      map.enableScrollWheelZoom?.()
      if (T.Control?.Zoom) map.addControl(new T.Control.Zoom())
    }
    map.clearOverLays()
    const positions = props.points.map((point) => {
      const lngLat = new T.LngLat(point.longitude, point.latitude)
      const marker = new T.Marker(lngLat)
      marker.addEventListener('click', () => emit('select', point.id))
      map.addOverLay(marker)
      return lngLat
    })
    if (positions.length > 1) map.setViewport(positions)
    else map.centerAndZoom(positions[0], 13)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '天地图加载失败',
      icon: 'none',
    })
  }
  // #endif
}

onMounted(() => {
  void renderMap()
})

watch(() => props.points, () => {
  void renderMap()
}, { deep: true })
</script>

<style scoped>
.tdt-map {
  width: 100%;
  overflow: hidden;
  border-radius: 16rpx;
  background: #edf3ef;
}
</style>
