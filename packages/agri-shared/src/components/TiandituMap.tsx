import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getTiandituNamespace,
  isValidLngLat,
  loadTianditu,
  parseBoundaryRings,
  resolveTiandituToken,
  type TiandituLoadState,
  type TiandituMapInstance,
} from './tianditu'
import './TiandituMap.css'

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

export interface TiandituMapProps {
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
  onPointClick?: (point: TiandituMapPoint) => void
  onMapClick?: (point: { longitude: number; latitude: number }) => void
}

const TONE_COLORS: Record<TiandituTone, string> = {
  green: '#159a5e',
  blue: '#3276b1',
  orange: '#c87b19',
  red: '#c54b4b',
  gray: '#7b8a80',
}

export default function TiandituMap({
  points = [],
  height = 420,
  className = '',
  centerLongitude = 104.2,
  centerLatitude = 35.8,
  zoom = 4.5,
  selectable = false,
  selectedPoint = null,
  showLegend = true,
  compact = false,
  onPointClick,
  onMapClick,
}: TiandituMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<TiandituMapInstance | null>(null)
  const mapClickRef = useRef(onMapClick)
  const pointClickRef = useRef(onPointClick)
  const [state, setState] = useState<TiandituLoadState>('loading')
  const [error, setError] = useState('')
  mapClickRef.current = onMapClick
  pointClickRef.current = onPointClick

  const validPoints = useMemo(
    () => points.filter((point) => isValidLngLat(point.longitude, point.latitude)),
    [points],
  )
  const pointsKey = useMemo(
    () =>
      validPoints
        .map(
          (point) =>
            `${point.id}:${point.longitude}:${point.latitude}:${point.boundary ?? ''}`,
        )
        .join('|'),
    [validPoints],
  )
  const selectedKey = selectedPoint
    ? `${selectedPoint.longitude}:${selectedPoint.latitude}`
    : ''

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
        map.centerAndZoom(new namespace.LngLat(centerLongitude, centerLatitude), zoom)
        map.enableScrollWheelZoom?.()
        if (namespace.Control?.Zoom) map.addControl(new namespace.Control.Zoom())
        if (namespace.Control?.Scale) map.addControl(new namespace.Control.Scale())
        map.addEventListener('click', (event) => {
          const longitude = event.lnglat?.getLng?.()
          const latitude = event.lnglat?.getLat?.()
          if (longitude !== undefined && latitude !== undefined && isValidLngLat(longitude, latitude)) {
            mapClickRef.current?.({ longitude, latitude })
          }
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
  }, [centerLongitude, centerLatitude, zoom])

  useEffect(() => {
    const namespace = getTiandituNamespace()
    const map = mapRef.current
    if (state !== 'ready' || !namespace || !map) return
    map.clearOverLays()
    const positions: unknown[] = []
    for (const point of validPoints) {
      const lngLat = new namespace.LngLat(point.longitude, point.latitude)
      positions.push(lngLat)
      for (const ring of parseBoundaryRings(point.boundary)) {
        const polygonPoints = ring
          .filter((position) => Array.isArray(position) && position.length >= 2)
          .map(([longitude, latitude]) => new namespace.LngLat(Number(longitude), Number(latitude)))
        if (polygonPoints.length >= 3) {
          const color = TONE_COLORS[point.tone ?? 'green']
          map.addOverLay(new namespace.Polygon(polygonPoints, {
            color,
            weight: 2,
            opacity: 0.85,
            fillColor: color,
            fillOpacity: 0.16,
          }))
          // 把边界顶点也纳入取景范围：只有中心点时地图会停在 zoom 10，
          // 百米级地块的边界在视野里几乎看不见。
          positions.push(...polygonPoints)
        }
      }
      const marker = new namespace.Marker(lngLat)
      marker.addEventListener('click', () => pointClickRef.current?.(point))
      map.addOverLay(marker)
    }
    if (selectedPoint && isValidLngLat(selectedPoint.longitude, selectedPoint.latitude)) {
      const selectedLngLat = new namespace.LngLat(selectedPoint.longitude, selectedPoint.latitude)
      positions.push(selectedLngLat)
      const marker = new namespace.Marker(selectedLngLat)
      marker.addEventListener('click', () => {
        mapClickRef.current?.(selectedPoint)
      })
      map.addOverLay(marker)
      map.centerAndZoom(selectedLngLat, Math.max(zoom, 12))
    } else if (positions.length > 1 && map.setViewport) {
      map.setViewport(positions)
    } else if (positions.length === 1) {
      map.centerAndZoom(positions[0], Math.max(zoom, 10))
    }
    map.checkResize?.()
  }, [state, pointsKey, selectedKey, zoom])

  const statusText = state === 'missing-token'
    ? '尚未配置天地图访问密钥'
    : state === 'error'
      ? error
      : ''

  return (
    <div className={`tianditu-map-shell ${compact ? 'compact' : ''} ${className}`.trim()} style={{ height }}>
      <div ref={containerRef} className="tianditu-map-canvas" />
      {state === 'loading' && (
        <div className="tianditu-map-state">
          <b>正在加载天地图</b>
          <span>地图服务初始化中…</span>
        </div>
      )}
      {(state === 'missing-token' || state === 'error') && (
        <div className="tianditu-map-state">
          <b>{statusText}</b>
          <span>
            {state === 'missing-token'
              ? '构建时设置 VITE_TIANDITU_TOKEN，或在 window.__TIANDITU_TOKEN__ 中提供密钥。'
              : '请检查网络、密钥域名白名单和天地图服务状态。'}
          </span>
        </div>
      )}
      {state === 'ready' && showLegend && (
        <div className="tianditu-map-legend">
          <span><i className="green" />正常</span>
          <span><i className="orange" />关注</span>
          <span><i className="red" />异常</span>
          <em>{validPoints.length} 个点位</em>
        </div>
      )}
      {state === 'ready' && selectable && (
        <div className="tianditu-map-pick-hint">点击地图选择坐标</div>
      )}
    </div>
  )
}
