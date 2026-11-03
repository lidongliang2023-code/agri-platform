/**
 * 天地图 JS API 公共能力。
 *
 * <p>从 `TiandituMap.tsx` 抽出：脚本加载 / 密钥解析 / 类型定义 / 边界几何工具。
 * 地图展示（{@link TiandituMap}）与边界绘制（TiandituBoundaryEditor）共用同一份加载器，
 * 避免同一页面两个地图组件各自加载一遍 SDK。</p>
 *
 * <p><b>坐标口径</b>：经纬度数组统一为 {@code [经度, 纬度]}（GeoJSON 顺序），
 * 单位度；面积按米制计算后换算为亩（1 亩 = 666.6667 平方米）。</p>
 */

/** 天地图命名空间（仅声明本项目用到的成员） */
export interface TiandituNamespace {
  Map: new (container: HTMLElement) => TiandituMapInstance
  LngLat: new (longitude: number, latitude: number) => TiandituLngLat
  Marker: new (lngLat: unknown) => TiandituOverlay
  Polygon: new (positions: unknown[], options?: Record<string, unknown>) => TiandituOverlay
  Polyline: new (positions: unknown[], options?: Record<string, unknown>) => TiandituOverlay
  Point: new (x: number, y: number) => unknown
  Control?: {
    Zoom?: new () => unknown
    Scale?: new () => unknown
  }
}

/** 经纬度对象 */
export interface TiandituLngLat {
  getLng: () => number
  getLat: () => number
}

/** 地图覆盖物（Marker / Polygon / Polyline） */
export interface TiandituOverlay {
  addEventListener: (event: string, listener: () => void) => void
}

/** 地图点击事件 */
export interface TiandituMapClickEvent {
  lnglat?: TiandituLngLat
}

/** 地图实例（仅声明本项目用到的成员） */
export interface TiandituMapInstance {
  centerAndZoom: (center: unknown, zoom: number) => void
  addControl: (control: unknown) => void
  addOverLay: (overlay: TiandituOverlay) => void
  clearOverLays: () => void
  setViewport?: (points: unknown[]) => void
  enableScrollWheelZoom?: () => void
  checkResize?: () => void
  addEventListener: (
    event: string,
    listener: (event: TiandituMapClickEvent) => void,
  ) => void
}

interface TiandituWindow extends Window {
  T?: TiandituNamespace
  __TIANDITU_TOKEN__?: string
}

/** 地图加载状态 */
export type TiandituLoadState = 'loading' | 'ready' | 'missing-token' | 'error'

/** 地球平均半径（WGS84 长半轴，米） */
const EARTH_RADIUS_METERS = 6_378_137

/** 每度弧度 */
const DEGREE_RADIANS = Math.PI / 180

/** 1 亩折算平方米 */
const SQUARE_METERS_PER_MU = 666.6666666666666

/** SDK 加载超时（毫秒） */
const LOAD_TIMEOUT_MS = 15_000

let tiandituLoader: Promise<TiandituNamespace> | null = null

/**
 * 读取天地图浏览器端密钥。
 *
 * <p>优先级：运行时注入 `window.__TIANDITU_TOKEN__` → 构建变量 `VITE_TIANDITU_TOKEN`
 * → 本地缓存 `tianditu_token`。都没有时返回空串，由组件显式提示"未配置密钥"。</p>
 *
 * @returns 密钥字符串（已去空格）
 */
export function resolveTiandituToken(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  const runtime = window as TiandituWindow
  return (
    runtime.__TIANDITU_TOKEN__ ||
    env?.VITE_TIANDITU_TOKEN ||
    window.localStorage.getItem('tianditu_token') ||
    ''
  ).trim()
}

/**
 * 获取已初始化的天地图命名空间。
 *
 * @returns SDK 未加载完成时返回 undefined
 */
export function getTiandituNamespace(): TiandituNamespace | undefined {
  return (window as TiandituWindow).T
}

/**
 * 加载天地图 JS API（全页面共享同一个 Promise）。
 *
 * @param token 浏览器端密钥
 * @returns 加载完成后的命名空间
 */
export function loadTianditu(token: string): Promise<TiandituNamespace> {
  const runtime = window as TiandituWindow
  if (runtime.T?.Map) return Promise.resolve(runtime.T)
  if (tiandituLoader) return tiandituLoader

  tiandituLoader = new Promise<TiandituNamespace>((resolve, reject) => {
    let existing = document.querySelector<HTMLScriptElement>('script[data-tianditu-sdk="true"]')
    if (existing && !runtime.T?.Map) {
      existing.remove()
      existing = null
    }
    const script = existing ?? document.createElement('script')
    const timeout = window.setTimeout(() => {
      tiandituLoader = null
      reject(new Error('天地图服务加载超时'))
    }, LOAD_TIMEOUT_MS)
    const finish = () => {
      window.clearTimeout(timeout)
      if (runtime.T?.Map) {
        resolve(runtime.T)
        return
      }
      tiandituLoader = null
      reject(new Error('天地图 SDK 已加载但未初始化'))
    }
    script.addEventListener('load', finish, { once: true })
    script.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeout)
        tiandituLoader = null
        reject(new Error('天地图 SDK 加载失败，请检查网络和访问密钥'))
      },
      { once: true },
    )
    if (!existing) {
      script.dataset.tiandituSdk = 'true'
      script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${encodeURIComponent(token)}`
      script.async = true
      document.head.appendChild(script)
    }
  })
  return tiandituLoader
}

/**
 * 天地图地理编码结果。
 */
export interface TiandituGeocodeResult {
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 匹配级别（如「区县及以上行政区划」「门址」） */
  level?: string
  /** 实际匹配到的地址文本 */
  matchedAddress?: string
}

/**
 * 按地址文本定位（天地图地理编码 REST 接口）。
 *
 * <p>地址只用于地图定位，不写进地块档案；接口已带 `Access-Control-Allow-Origin: *`，
 * 可在浏览器直接请求。</p>
 *
 * @param keyword 地址关键字（建议带省市区）
 * @returns 匹配到的经纬度与级别
 * @throws 未配置密钥、网络失败或未匹配到地址时抛出可读错误
 */
export async function geocodeAddress(keyword: string): Promise<TiandituGeocodeResult> {
  const token = resolveTiandituToken()
  if (!token) throw new Error('尚未配置天地图访问密钥，无法按地址定位')
  const trimmed = keyword.trim()
  if (!trimmed) throw new Error('请输入要定位的地址')

  const ds = JSON.stringify({ keyWord: trimmed })
  const response = await fetch(
    `https://api.tianditu.gov.cn/geocoder?ds=${encodeURIComponent(ds)}&tk=${encodeURIComponent(token)}`,
  )
  if (!response.ok) throw new Error(`地址定位失败（HTTP ${response.status}）`)

  const payload = (await response.json()) as {
    status?: string
    msg?: string
    location?: {
      lon?: string
      lat?: string
      level?: string
      keyWord?: string
    }
  }
  const longitude = Number(payload.location?.lon)
  const latitude = Number(payload.location?.lat)
  if (
    payload.status !== '0' ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    throw new Error(
      payload.msg && payload.msg.toLowerCase() !== 'ok'
        ? payload.msg
        : '未找到匹配的地址，请补充到区县 / 乡镇后再定位',
    )
  }
  return {
    longitude,
    latitude,
    level: payload.location?.level,
    matchedAddress: payload.location?.keyWord,
  }
}

/**
 * 校验经纬度是否在合法范围内。
 *
 * @param longitude 经度
 * @param latitude 纬度
 * @returns 是否合法
 */
export function isValidLngLat(longitude: number, latitude: number): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  )
}

/**
 * 解析地块边界 GeoJSON 的外环。
 *
 * @param boundary GeoJSON 字符串（Polygon / MultiPolygon）
 * @returns 外环数组列表；非法或空时返回空数组
 */
export function parseBoundaryRings(boundary?: string | null): number[][][] {
  if (!boundary) return []
  try {
    const geometry = JSON.parse(boundary) as {
      type?: string
      coordinates?: unknown
    }
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
      const ring = geometry.coordinates[0]
      return Array.isArray(ring) ? [ring as number[][]] : []
    }
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates
        .map((polygon) => (Array.isArray(polygon) ? polygon[0] : null))
        .filter((ring): ring is number[][] => Array.isArray(ring))
    }
  } catch {
    return []
  }
  return []
}

/**
 * 解析地块边界顶点（去掉闭合重复点），供绘制编辑器回填。
 *
 * <p>GeoJSON Polygon 的外环首尾同点；编辑器内部只存"顶点"，保存时再闭合。</p>
 *
 * @param boundary GeoJSON 字符串
 * @returns 顶点数组 `[经度, 纬度]`；无有效边界时返回空数组
 */
export function parseBoundaryVertices(boundary?: string | null): number[][] {
  const rings = parseBoundaryRings(boundary)
  if (rings.length === 0) return []
  const outer = rings[0]
    .filter(
      (position) =>
        Array.isArray(position) &&
        position.length >= 2 &&
        isValidLngLat(Number(position[0]), Number(position[1])),
    )
    .map(([longitude, latitude]) => [Number(longitude), Number(latitude)])
  if (outer.length >= 2) {
    const first = outer[0]
    const last = outer[outer.length - 1]
    if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
      outer.pop()
    }
  }
  return outer
}

/** 多边形测量结果 */
export interface PolygonMetrics {
  /** 面积（亩） */
  areaMu: number
  /** 面积（平方米） */
  areaSquareMeters: number
  /** 周长（米） */
  perimeterMeters: number
}

/**
 * 计算多边形面积与周长。
 *
 * <p>按顶点平均纬度做等距投影后使用鞋带公式。地块尺度（百米级）下误差可忽略，
 * 不需要引入完整地理库。</p>
 *
 * @param vertices 顶点数组 `[经度, 纬度]`，不需要闭合
 * @returns 面积与周长；顶点不足 3 个时面积/周长均为 0
 */
export function computePolygonMetrics(vertices: number[][]): PolygonMetrics {
  const perimeterMeters =
    vertices.length < 2
      ? 0
      : vertices.reduce((sum, point, index) => {
          const next = vertices[(index + 1) % vertices.length]
          return sum + haversineMeters(point, next)
        }, 0)
  if (vertices.length < 3) {
    return { areaMu: 0, areaSquareMeters: 0, perimeterMeters }
  }
  const areaSquareMeters = Math.abs(shoelaceArea(projectToMeters(vertices)))
  return {
    areaMu: areaSquareMeters / SQUARE_METERS_PER_MU,
    areaSquareMeters,
    perimeterMeters,
  }
}

/**
 * 计算多边形质心（面积加权）；退化多边形退回顶点平均值。
 *
 * @param vertices 顶点数组 `[经度, 纬度]`
 * @returns 质心经纬度；无有效顶点时返回 null
 */
export function polygonCentroid(
  vertices: number[][],
): { longitude: number; latitude: number } | null {
  const valid = vertices.filter((point) =>
    isValidLngLat(Number(point[0]), Number(point[1])),
  )
  if (valid.length === 0) return null
  if (valid.length < 3) return averagePoint(valid)
  const { projected, latitudeOrigin } = projectToMetersWithOrigin(valid)
  let twiceArea = 0
  let weightedX = 0
  let weightedY = 0
  for (let index = 0; index < projected.length; index += 1) {
    const [x1, y1] = projected[index]
    const [x2, y2] = projected[(index + 1) % projected.length]
    const cross = x1 * y2 - x2 * y1
    twiceArea += cross
    weightedX += (x1 + x2) * cross
    weightedY += (y1 + y2) * cross
  }
  if (Math.abs(twiceArea) < 1e-9) return averagePoint(valid)
  const centerX = weightedX / (3 * twiceArea)
  const centerY = weightedY / (3 * twiceArea)
  const longitudeScale = EARTH_RADIUS_METERS * Math.cos(latitudeOrigin)
  return {
    longitude: (centerX / longitudeScale) / DEGREE_RADIANS,
    latitude: (centerY / EARTH_RADIUS_METERS) / DEGREE_RADIANS,
  }
}

/** 顶点平均经纬度（退化多边形兜底） */
function averagePoint(points: number[][]): { longitude: number; latitude: number } {
  const longitude = points.reduce((sum, point) => sum + Number(point[0]), 0) / points.length
  const latitude = points.reduce((sum, point) => sum + Number(point[1]), 0) / points.length
  return { longitude, latitude }
}

/** 等距投影（以顶点平均纬度为基准） */
function projectToMeters(vertices: number[][]): [number, number][] {
  return projectToMetersWithOrigin(vertices).projected
}

/** 等距投影并返回基准纬度 */
function projectToMetersWithOrigin(vertices: number[][]): {
  projected: [number, number][]
  latitudeOrigin: number
} {
  const latitudeOrigin =
    (vertices.reduce((sum, point) => sum + Number(point[1]), 0) / vertices.length) *
    DEGREE_RADIANS
  const longitudeScale = EARTH_RADIUS_METERS * Math.cos(latitudeOrigin)
  return {
    latitudeOrigin,
    projected: vertices.map(([longitude, latitude]) => [
      Number(longitude) * DEGREE_RADIANS * longitudeScale,
      Number(latitude) * DEGREE_RADIANS * EARTH_RADIUS_METERS,
    ]),
  }
}

/** 鞋带公式（有符号面积，平方米） */
function shoelaceArea(projected: [number, number][]): number {
  let sum = 0
  for (let index = 0; index < projected.length; index += 1) {
    const [x1, y1] = projected[index]
    const [x2, y2] = projected[(index + 1) % projected.length]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

/** 两点球面距离（米） */
function haversineMeters(from: number[], to: number[]): number {
  const fromLatitude = Number(from[1]) * DEGREE_RADIANS
  const toLatitude = Number(to[1]) * DEGREE_RADIANS
  const deltaLatitude = toLatitude - fromLatitude
  const deltaLongitude = (Number(to[0]) - Number(from[0])) * DEGREE_RADIANS
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
}
