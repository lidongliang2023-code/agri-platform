<template>
  <div class="tianditu-boundary-editor" :class="className" :style="{ height: resolvedHeight }">
    <div ref="containerRef" class="tianditu-boundary-canvas" />
    <div v-if="state === 'loading'" class="tianditu-boundary-state">
      <b>正在加载天地图</b>
      <span>地图服务初始化中…</span>
    </div>
    <div v-else-if="state === 'missing-token' || state === 'error'" class="tianditu-boundary-state">
      <b>{{ statusText }}</b>
      <span>
        {{ state === 'missing-token' ? '构建时设置 VITE_TIANDITU_TOKEN，或在 window.__TIANDITU_TOKEN__ 中提供密钥。' : '请检查网络、密钥域名白名单和天地图服务状态。' }}
      </span>
    </div>
    <template v-else-if="state === 'ready'">
      <div class="tianditu-boundary-toolbar">
        <span class="tianditu-boundary-count">{{ value.length }} 个顶点</span>
        <button type="button" :disabled="disabled || selectionMode === 'point' || value.length === 0" @click="emitChange(value.slice(0, -1))">撤销上一点</button>
        <button type="button" :disabled="disabled || selectionMode === 'point' || value.length === 0" @click="emitChange([])">清空</button>
      </div>
      <div class="tianditu-boundary-hint">
        {{ selectionMode === 'point' ? '点击地图设置农场中心点，边界保持不变' : '点击地图添加顶点，点击顶点标记可删除' }}
      </div>
      <div class="tianditu-boundary-metrics">
        {{ hasPolygon ? `面积约 ${metrics.areaMu.toFixed(2)} 亩 · 周长约 ${Math.round(metrics.perimeterMeters)} 米` : value.length > 0 ? `还需 ${MIN_VERTICES - value.length} 个顶点才能构成边界` : '尚未绘制边界' }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  computePolygonMetrics,
  getTiandituNamespace,
  isValidLngLat,
  loadTianditu,
  parseBoundaryVertices,
  resolveTiandituToken,
  type TiandituLoadState,
  type TiandituMapInstance,
} from '../../components/tianditu'
import '../../components/TiandituBoundaryEditor.css'

const MIN_VERTICES = 3
const DUPLICATE_VERTEX_EPSILON = 1e-4
const OVERLAY_CLICK_GUARD_MS = 300

const props = withDefaults(defineProps<{
  referenceBoundary?: string | null
  value: number[][]
  height?: number | string
  className?: string
  focusPoint?: { longitude: number; latitude: number } | null
  focusZoom?: number
  locateSignal?: number
  showFocusMarker?: boolean
  selectionMode?: 'point' | 'boundary'
  showFocusMarkerWithBoundary?: boolean
  disabled?: boolean
}>(), {
  height: 380,
  className: '',
  focusPoint: null,
  focusZoom: 14,
  showFocusMarker: true,
  selectionMode: 'boundary',
  showFocusMarkerWithBoundary: false,
  disabled: false,
})

const emit = defineEmits<{
  change: [value: number[][]]
  'update:value': [value: number[][]]
  pointSelect: [point: { longitude: number; latitude: number }]
}>()

const containerRef = shallowRef<HTMLDivElement | null>(null)
const mapRef = shallowRef<TiandituMapInstance | null>(null)
const state = ref<TiandituLoadState>('loading')
const error = ref('')
let active = true
let overlayClickAt = 0
let hasFit = false
let lastLocateSignal = props.locateSignal
let removeMapListener: (() => void) | undefined

const emitChange = (next: number[][]) => { emit('change', next); emit('update:value', next) }
const resolvedHeight = computed(() => (typeof props.height === 'number' ? `${props.height}px` : props.height))
const valueKey = computed(() => props.value.map((p) => `${p[0]},${p[1]}`).join('|'))
const focusKey = computed(() => (props.focusPoint ? `${props.focusPoint.longitude}:${props.focusPoint.latitude}` : ''))
const referenceVertices = computed(() => parseBoundaryVertices(props.referenceBoundary))
const metrics = computed(() => computePolygonMetrics(props.value))
const hasPolygon = computed(() => props.value.length >= MIN_VERTICES)
const statusText = computed(() => (state.value === 'missing-token' ? '尚未配置天地图访问密钥' : state.value === 'error' ? error.value : ''))

function redraw() {
  if (state.value !== 'ready') return
  const ns = getTiandituNamespace(), map = mapRef.value
  if (!ns || !map) return
  map.clearOverLays()
  if (referenceVertices.value.length >= 3) {
    map.addOverLay(new ns.Polygon(referenceVertices.value.map(([x, y]) => new ns.LngLat(x, y)), {
      color: '#1677ff', weight: 3, opacity: 0.9, fillColor: '#1677ff', fillOpacity: 0.06,
    }))
  }
  const positions = props.value.map(([lng, lat]) => new ns.LngLat(lng, lat))
  if (props.value.length >= MIN_VERTICES) {
    map.addOverLay(new ns.Polygon(positions, { color: '#159a5e', weight: 3, opacity: 0.9, fillColor: '#159a5e', fillOpacity: 0.2 }))
  } else if (props.value.length >= 2) {
    map.addOverLay(new ns.Polyline(positions, { color: '#159a5e', weight: 3, opacity: 0.9 }))
  }
  props.value.forEach(([lng, lat], index) => {
    const marker = new ns.Marker(new ns.LngLat(lng, lat))
    marker.addEventListener('click', () => {
      overlayClickAt = Date.now()
      if (!active || props.disabled || props.selectionMode === 'point') return
      emitChange(props.value.filter((_, i) => i !== index))
    })
    map.addOverLay(marker)
  })
  if (props.showFocusMarker && (props.value.length === 0 || props.showFocusMarkerWithBoundary) && props.focusPoint && isValidLngLat(props.focusPoint.longitude, props.focusPoint.latitude)) {
    const marker = new ns.Marker(new ns.LngLat(props.focusPoint.longitude, props.focusPoint.latitude))
    marker.addEventListener('click', () => { overlayClickAt = Date.now() })
    map.addOverLay(marker)
  }
  if (!hasFit && props.value.length >= 2) { hasFit = true; map.setViewport?.(positions) }
  else if (!hasFit && referenceVertices.value.length >= 3) { hasFit = true; map.setViewport?.(referenceVertices.value.map(([x, y]) => new ns.LngLat(x, y))) }
  map.checkResize?.()
}

onMounted(() => {
  const token = resolveTiandituToken()
  if (!token) { state.value = 'missing-token'; return }
  void loadTianditu(token).then((ns) => {
    if (!active || !containerRef.value) return
    const map = new ns.Map(containerRef.value)
    mapRef.value = map
    const focus = props.focusPoint
    map.centerAndZoom(new ns.LngLat(focus?.longitude ?? 104.2, focus?.latitude ?? 35.8), focus ? Math.max(props.focusZoom, 12) : 5)
    map.enableScrollWheelZoom?.()
    if (ns.Control?.Zoom) map.addControl(new ns.Control.Zoom())
    const onMapClick: Parameters<TiandituMapInstance['addEventListener']>[1] = (event) => {
      if (!active || props.disabled) return
      const lng = event.lnglat?.getLng?.(), lat = event.lnglat?.getLat?.()
      if (lng === undefined || lat === undefined || !isValidLngLat(lng, lat)) return
      if (Date.now() - overlayClickAt < OVERLAY_CLICK_GUARD_MS) return
      if (props.selectionMode === 'point') { emit('pointSelect', { longitude: lng, latitude: lat }); return }
      const current = props.value
      if (current.some(([vx, vy]) => Math.abs(vx - lng) < DUPLICATE_VERTEX_EPSILON && Math.abs(vy - lat) < DUPLICATE_VERTEX_EPSILON)) return
      emitChange([...current, [Number(lng.toFixed(6)), Number(lat.toFixed(6))]])
    }
    map.addEventListener('click', onMapClick)
    const releasable = map as TiandituMapInstance & { removeEventListener?: (name: string, handler: typeof onMapClick) => void; destroy?: () => void }
    removeMapListener = () => { releasable.removeEventListener?.('click', onMapClick); map.clearOverLays(); releasable.destroy?.() }
    state.value = 'ready'
    redraw()
  }).catch((reason: unknown) => {
    if (!active) return
    error.value = reason instanceof Error ? reason.message : '天地图加载失败'
    state.value = 'error'
  })
})
onBeforeUnmount(() => { active = false; removeMapListener?.(); mapRef.value = null })
watch([state, focusKey], () => {
  if (state.value !== 'ready' || !focusKey.value || props.value.length > 0 || !props.focusPoint) return
  const ns = getTiandituNamespace(), map = mapRef.value
  if (ns && map) map.centerAndZoom(new ns.LngLat(props.focusPoint.longitude, props.focusPoint.latitude), Math.max(props.focusZoom, 12))
})
watch([state, () => props.locateSignal, focusKey], () => {
  if (state.value !== 'ready' || !focusKey.value || props.locateSignal === lastLocateSignal || !props.focusPoint) return
  lastLocateSignal = props.locateSignal
  const ns = getTiandituNamespace(), map = mapRef.value
  if (ns && map) map.centerAndZoom(new ns.LngLat(props.focusPoint.longitude, props.focusPoint.latitude), Math.max(props.focusZoom, 14))
})
watch([state, valueKey, () => props.disabled, focusKey, () => props.showFocusMarker, () => props.showFocusMarkerWithBoundary, referenceVertices], redraw)
</script>
