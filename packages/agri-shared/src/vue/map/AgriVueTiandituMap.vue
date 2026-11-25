<template>
  <div
    :class="['tianditu-map-shell', compact ? 'compact' : '', className].filter(Boolean).join(' ')"
    :style="{ height: typeof height === 'number' ? `${height}px` : height }"
  >
    <div ref="containerRef" class="tianditu-map-canvas" />
    <div v-if="state === 'loading'" class="tianditu-map-state">
      <b>正在加载天地图</b>
      <span>地图服务初始化中…</span>
    </div>
    <div v-if="state === 'missing-token' || state === 'error'" class="tianditu-map-state">
      <b>{{ statusText }}</b>
      <span>
        {{
          state === 'missing-token'
            ? '构建时设置 VITE_TIANDITU_TOKEN，或在 window.__TIANDITU_TOKEN__ 中提供密钥。'
            : '请检查网络、密钥域名白名单和天地图服务状态。'
        }}
      </span>
    </div>
    <div v-if="state === 'ready' && showLegend" class="tianditu-map-legend">
      <span><i class="green" />正常</span>
      <span><i class="orange" />关注</span>
      <span><i class="red" />异常</span>
      <em>{{ validPoints.length }} 个点位</em>
    </div>
    <div v-if="state === 'ready' && selectable" class="tianditu-map-pick-hint">点击地图选择坐标</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getTiandituNamespace,
  isValidLngLat,
  loadTianditu,
  parseBoundaryRings,
  resolveTiandituToken,
  type TiandituLoadState,
  type TiandituMapInstance,
} from '../../components/tianditu'
import '../../components/TiandituMap.css'

export type TiandituTone = 'green' | 'blue' | 'orange' | 'red' | 'gray'

export interface TiandituMapPoint {
  id: string | number
  longitude: number
  latitude: number
  title: string
  meta?: string
  tone?: TiandituTone
  boundary?: string | null
}

const props = withDefaults(
  defineProps<{
    points?: TiandituMapPoint[]
    height?: number | string
    className?: string
    centerLongitude?: number
    centerLatitude?: number
    zoom?: number
    selectable?: boolean
    selectedPoint?: { longitude: number; latitude: number } | null
    showLegend?: boolean
    compact?: boolean
  }>(),
  {
    points: () => [],
    height: 420,
    className: '',
    centerLongitude: 104.2,
    centerLatitude: 35.8,
    zoom: 4.5,
    selectable: false,
    selectedPoint: null,
    showLegend: true,
    compact: false,
  },
)

const emit = defineEmits<{
  'point-click': [point: TiandituMapPoint]
  'map-click': [point: { longitude: number; latitude: number }]
}>()

const TONE_COLORS: Record<TiandituTone, string> = {
  green: '#159a5e',
  blue: '#3276b1',
  orange: '#c87b19',
  red: '#c54b4b',
  gray: '#7b8a80',
}

const containerRef = ref<HTMLDivElement | null>(null)
const mapRef = ref<TiandituMapInstance | null>(null)
const state = ref<TiandituLoadState>('loading')
const error = ref('')
let active = true

const validPoints = computed(() => props.points.filter((point) => isValidLngLat(point.longitude, point.latitude)))
const pointsKey = computed(() =>
  validPoints.value
    .map((point) => `${point.id}:${point.longitude}:${point.latitude}:${point.boundary ?? ''}`)
    .join('|'),
)
const selectedKey = computed(() =>
  props.selectedPoint ? `${props.selectedPoint.longitude}:${props.selectedPoint.latitude}` : '',
)
const statusText = computed(() =>
  state.value === 'missing-token' ? '尚未配置天地图访问密钥' : state.value === 'error' ? error.value : '',
)

function renderOverlays() {
  const namespace = getTiandituNamespace()
  const map = mapRef.value
  if (state.value !== 'ready' || !namespace || !map) return
  map.clearOverLays()
  const positions: unknown[] = []
  for (const point of validPoints.value) {
    const lngLat = new namespace.LngLat(point.longitude, point.latitude)
    positions.push(lngLat)
    for (const ring of parseBoundaryRings(point.boundary)) {
      const polygonPoints = ring
        .filter((position) => Array.isArray(position) && position.length >= 2)
        .map(([longitude, latitude]) => new namespace.LngLat(Number(longitude), Number(latitude)))
      if (polygonPoints.length >= 3) {
        const color = TONE_COLORS[point.tone ?? 'green']
        map.addOverLay(
          new namespace.Polygon(polygonPoints, {
            color,
            weight: 2,
            opacity: 0.85,
            fillColor: color,
            fillOpacity: 0.16,
          }),
        )
        positions.push(...polygonPoints)
      }
    }
    const marker = new namespace.Marker(lngLat)
    marker.addEventListener('click', () => emit('point-click', point))
    map.addOverLay(marker)
  }
  if (props.selectedPoint && isValidLngLat(props.selectedPoint.longitude, props.selectedPoint.latitude)) {
    const selectedLngLat = new namespace.LngLat(props.selectedPoint.longitude, props.selectedPoint.latitude)
    positions.push(selectedLngLat)
    const marker = new namespace.Marker(selectedLngLat)
    marker.addEventListener('click', () => {
      if (props.selectedPoint) emit('map-click', props.selectedPoint)
    })
    map.addOverLay(marker)
    map.centerAndZoom(selectedLngLat, Math.max(props.zoom, 12))
  } else if (positions.length > 1 && map.setViewport) {
    map.setViewport(positions)
  } else if (positions.length === 1) {
    map.centerAndZoom(positions[0], Math.max(props.zoom, 10))
  }
  map.checkResize?.()
}

onMounted(() => {
  const token = resolveTiandituToken()
  if (!token) {
    state.value = 'missing-token'
    return
  }
  void loadTianditu(token)
    .then((namespace) => {
      if (!active || !containerRef.value) return
      const map = new namespace.Map(containerRef.value)
      mapRef.value = map
      map.centerAndZoom(new namespace.LngLat(props.centerLongitude, props.centerLatitude), props.zoom)
      map.enableScrollWheelZoom?.()
      if (namespace.Control?.Zoom) map.addControl(new namespace.Control.Zoom())
      if (namespace.Control?.Scale) map.addControl(new namespace.Control.Scale())
      map.addEventListener('click', (event) => {
        const longitude = event.lnglat?.getLng?.()
        const latitude = event.lnglat?.getLat?.()
        if (longitude !== undefined && latitude !== undefined && isValidLngLat(longitude, latitude)) {
          emit('map-click', { longitude, latitude })
        }
      })
      state.value = 'ready'
      renderOverlays()
    })
    .catch((reason: unknown) => {
      if (!active) return
      error.value = reason instanceof Error ? reason.message : '天地图加载失败'
      state.value = 'error'
    })
})

onUnmounted(() => {
  active = false
})

watch([state, pointsKey, selectedKey, () => props.zoom], renderOverlays)
</script>
