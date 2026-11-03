/**
 * 天地图地块边界绘制编辑器。
 *
 * <p>与 {@link TiandituMap} 共用同一份 SDK 加载器，但职责不同：这里允许在地图上
 * 依次点击添加顶点、点击顶点标记删除顶点，并实时把边界（线 / 面）画在底图上，
 * 同时显示顶点数、面积（亩）与周长。</p>
 *
 * <p>受控组件：顶点数组由父级持有（`value` / `onChange`），保存时父级负责闭合环
 * 并转成 GeoJSON。顶点坐标顺序为 {@code [经度, 纬度]}，保留 6 位小数。</p>
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  computePolygonMetrics,
  getTiandituNamespace,
  isValidLngLat,
  loadTianditu,
  resolveTiandituToken,
  type TiandituLoadState,
  type TiandituMapInstance,
} from './tianditu'
import './TiandituBoundaryEditor.css'

export interface TiandituBoundaryEditorProps {
  /** 边界顶点（不闭合，至少 3 个才构成面） */
  value: number[][]
  /** 顶点变化回调 */
  onChange: (value: number[][]) => void
  /** 地图高度 */
  height?: number | string
  /** 附加类名 */
  className?: string
  /** 无顶点时的初始定位点（通常是已选中心点 / 农场坐标） */
  focusPoint?: { longitude: number; latitude: number } | null
  /** 有定位点时的缩放级别 */
  focusZoom?: number
  /** 地址定位成功后的递增信号：值变化时把地图居中到 focusPoint（有边界时也生效） */
  locateSignal?: number
  /** 无边界顶点时是否用地图标记显示 focusPoint（默认显示） */
  showFocusMarker?: boolean
  /** 是否禁用绘制（例如保存中） */
  disabled?: boolean
}

/** 构成边界所需的最少顶点数 */
const MIN_VERTICES = 3

/** 判定"点到了已有顶点"的经纬度阈值（约 10 米），避免点标记时误加一个重复顶点 */
const DUPLICATE_VERTEX_EPSILON = 1e-4

/** 覆盖物点击后忽略地图点击的时间窗（毫秒） */
const OVERLAY_CLICK_GUARD_MS = 300

export default function TiandituBoundaryEditor({
  value,
  onChange,
  height = 380,
  className = '',
  focusPoint = null,
  focusZoom = 14,
  locateSignal,
  showFocusMarker = true,
  disabled = false,
}: TiandituBoundaryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<TiandituMapInstance | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const disabledRef = useRef(disabled)
  const focusRef = useRef(focusPoint)
  const focusZoomRef = useRef(focusZoom)
  const overlayClickAtRef = useRef(0)
  const hasFitRef = useRef(false)
  const locateSignalRef = useRef(locateSignal)
  const [state, setState] = useState<TiandituLoadState>('loading')
  const [error, setError] = useState('')

  valueRef.current = value
  onChangeRef.current = onChange
  disabledRef.current = disabled
  focusRef.current = focusPoint
  focusZoomRef.current = focusZoom

  const valueKey = useMemo(
    () => value.map((point) => `${point[0]},${point[1]}`).join('|'),
    [value],
  )
  const focusKey = focusPoint
    ? `${focusPoint.longitude}:${focusPoint.latitude}`
    : ''
  const metrics = useMemo(() => computePolygonMetrics(value), [value])
  const hasPolygon = value.length >= MIN_VERTICES

  /** 初始化地图（只挂一次；定位点变化由下方 effect 处理） */
  useEffect(() => {
    const token = resolveTiandituToken()
    if (!token) {
      setState('missing-token')
      return
    }
    let active = true
    void loadTianditu(token)
      .then((namespace) => {
        if (!active || !containerRef.current) return
        const map = new namespace.Map(containerRef.current)
        mapRef.current = map
        const focus = focusRef.current
        map.centerAndZoom(
          new namespace.LngLat(focus?.longitude ?? 104.2, focus?.latitude ?? 35.8),
          focus ? Math.max(focusZoomRef.current, 12) : 5,
        )
        map.enableScrollWheelZoom?.()
        if (namespace.Control?.Zoom) map.addControl(new namespace.Control.Zoom())
        map.addEventListener('click', (event) => {
          if (disabledRef.current) return
          const longitude = event.lnglat?.getLng?.()
          const latitude = event.lnglat?.getLat?.()
          if (
            longitude === undefined ||
            latitude === undefined ||
            !isValidLngLat(longitude, latitude)
          ) {
            return
          }
          // 点顶点标记时地图 click 也可能触发，这里直接忽略；
          // 同时避免在同一位置重复添加顶点。
          if (Date.now() - overlayClickAtRef.current < OVERLAY_CLICK_GUARD_MS) return
          const current = valueRef.current
          const isDuplicate = current.some(
            ([vertexLongitude, vertexLatitude]) =>
              Math.abs(vertexLongitude - longitude) < DUPLICATE_VERTEX_EPSILON &&
              Math.abs(vertexLatitude - latitude) < DUPLICATE_VERTEX_EPSILON,
          )
          if (isDuplicate) return
          onChangeRef.current([
            ...current,
            [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))],
          ])
        })
        setState('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : '天地图加载失败')
        setState('error')
      })
    return () => {
      active = false
    }
  }, [])

  /** 无边界时跟随中心点 / 农场坐标重新定位（同一坐标对象重建不重复定位） */
  useEffect(() => {
    if (state !== 'ready' || !focusKey) return
    const namespace = getTiandituNamespace()
    const map = mapRef.current
    const focus = focusRef.current
    if (!namespace || !map || !focus || valueRef.current.length > 0) return
    map.centerAndZoom(
      new namespace.LngLat(focus.longitude, focus.latitude),
      Math.max(focusZoomRef.current, 12),
    )
  }, [state, focusKey])

  /** 地址定位成功：即使已有边界，也把地图居中到新的定位点 */
  useEffect(() => {
    if (state !== 'ready' || !focusKey) return
    if (locateSignal === locateSignalRef.current) return
    locateSignalRef.current = locateSignal
    const namespace = getTiandituNamespace()
    const map = mapRef.current
    const focus = focusRef.current
    if (!namespace || !map || !focus) return
    map.centerAndZoom(
      new namespace.LngLat(focus.longitude, focus.latitude),
      Math.max(focusZoomRef.current, 14),
    )
  }, [state, locateSignal, focusKey])

  /** 重绘边界与顶点（受控：value 变化时整体重绘，不做增量维护） */
  useEffect(() => {
    if (state !== 'ready') return
    const namespace = getTiandituNamespace()
    const map = mapRef.current
    if (!namespace || !map) return

    map.clearOverLays()
    const positions = value.map(
      ([longitude, latitude]) => new namespace.LngLat(longitude, latitude),
    )

    if (value.length >= MIN_VERTICES) {
      map.addOverLay(
        new namespace.Polygon(positions, {
          color: '#159a5e',
          weight: 3,
          opacity: 0.9,
          fillColor: '#159a5e',
          fillOpacity: 0.2,
        }),
      )
    } else if (value.length >= 2) {
      map.addOverLay(
        new namespace.Polyline(positions, {
          color: '#159a5e',
          weight: 3,
          opacity: 0.9,
        }),
      )
    }

    value.forEach(([longitude, latitude], index) => {
      const marker = new namespace.Marker(new namespace.LngLat(longitude, latitude))
      marker.addEventListener('click', () => {
        overlayClickAtRef.current = Date.now()
        if (disabledRef.current) return
        onChangeRef.current(valueRef.current.filter((_, vertexIndex) => vertexIndex !== index))
      })
      map.addOverLay(marker)
    })

    // 尚未绘制边界时，把定位点（地址搜索结果 / 中心点）用地图标记显示出来
    if (
      showFocusMarker &&
      value.length === 0 &&
      focusPoint &&
      isValidLngLat(focusPoint.longitude, focusPoint.latitude)
    ) {
      const marker = new namespace.Marker(
        new namespace.LngLat(focusPoint.longitude, focusPoint.latitude),
      )
      marker.addEventListener('click', () => {
        // 防地图 click 再补一个顶点
        overlayClickAtRef.current = Date.now()
      })
      map.addOverLay(marker)
    }

    // 编辑态回填的边界只适配一次视野，绘制过程中不再自动缩放，避免地图"跳来跳去"
    if (!hasFitRef.current && value.length >= 2) {
      hasFitRef.current = true
      map.setViewport?.(positions)
    }
    map.checkResize?.()
  }, [state, valueKey, disabled, focusKey, showFocusMarker])

  const statusText = state === 'missing-token'
    ? '尚未配置天地图访问密钥'
    : state === 'error'
      ? error
      : ''

  return (
    <div
      className={`tianditu-boundary-editor ${className}`.trim()}
      style={{ height }}
    >
      <div ref={containerRef} className="tianditu-boundary-canvas" />

      {state === 'loading' && (
        <div className="tianditu-boundary-state">
          <b>正在加载天地图</b>
          <span>地图服务初始化中…</span>
        </div>
      )}
      {(state === 'missing-token' || state === 'error') && (
        <div className="tianditu-boundary-state">
          <b>{statusText}</b>
          <span>
            {state === 'missing-token'
              ? '构建时设置 VITE_TIANDITU_TOKEN，或在 window.__TIANDITU_TOKEN__ 中提供密钥。'
              : '请检查网络、密钥域名白名单和天地图服务状态。'}
          </span>
        </div>
      )}

      {state === 'ready' && (
        <>
          <div className="tianditu-boundary-toolbar">
            <span className="tianditu-boundary-count">{value.length} 个顶点</span>
            <button
              type="button"
              disabled={disabled || value.length === 0}
              onClick={() => onChange(value.slice(0, -1))}
            >
              撤销上一点
            </button>
            <button
              type="button"
              disabled={disabled || value.length === 0}
              onClick={() => onChange([])}
            >
              清空
            </button>
          </div>
          <div className="tianditu-boundary-hint">
            点击地图添加顶点，点击顶点标记可删除
          </div>
          <div className="tianditu-boundary-metrics">
            {hasPolygon
              ? `面积约 ${metrics.areaMu.toFixed(2)} 亩 · 周长约 ${Math.round(metrics.perimeterMeters)} 米`
              : value.length > 0
                ? `还需 ${MIN_VERTICES - value.length} 个顶点才能构成边界`
                : '尚未绘制边界'}
          </div>
        </>
      )}
    </div>
  )
}
