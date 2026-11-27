import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computePolygonMetrics,
  geocodeAddress,
  getTiandituNamespace,
  isValidLngLat,
  loadTianditu,
  parseBoundaryRings,
  parseBoundaryVertices,
  polygonCentroid,
  resolveTiandituToken,
} from '../src/components/tianditu'

describe('tianditu：几何计算与边界解析', () => {
  it('isValidLngLat 准确校验经纬度边界', () => {
    expect(isValidLngLat(116.4, 39.9)).toBe(true)
    expect(isValidLngLat(-180, -90)).toBe(true)
    expect(isValidLngLat(180, 90)).toBe(true)
    expect(isValidLngLat(181, 30)).toBe(false)
    expect(isValidLngLat(100, -91)).toBe(false)
    expect(isValidLngLat(Number.NaN, 30)).toBe(false)
  })

  it('parseBoundaryRings 与 parseBoundaryVertices 兼容标准 Polygon、历史外环、MultiPolygon 与异常输入', () => {
    expect(parseBoundaryRings(null)).toEqual([])
    expect(parseBoundaryRings('{bad json')).toEqual([])
    expect(parseBoundaryRings(JSON.stringify({ type: 'Point', coordinates: [116, 39] }))).toEqual([])
    expect(parseBoundaryRings(JSON.stringify({ type: 'Polygon', coordinates: [123] }))).toEqual([])

    const standardPolygon = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [116.0, 39.0],
          [116.001, 39.0],
          [116.001, 39.001],
          [116.0, 39.001],
          [116.0, 39.0],
        ],
      ],
    })
    expect(parseBoundaryVertices(standardPolygon)).toHaveLength(4)

    // 兼容历史地块外环直接写在 coordinates 下
    const legacyPolygon = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [116.0, 39.0],
        [116.001, 39.0],
        [116.001, 39.001],
      ],
    })
    expect(parseBoundaryRings(legacyPolygon)).toHaveLength(1)
    expect(parseBoundaryVertices(legacyPolygon)).toHaveLength(3)

    const multi = JSON.stringify({
      type: 'MultiPolygon',
      coordinates: [
        [[[116.0, 39.0], [116.01, 39.0], [116.01, 39.01]]],
        ['invalid'],
      ],
    })
    expect(parseBoundaryRings(multi)).toHaveLength(1)
    expect(parseBoundaryVertices('')).toEqual([])
  })

  it('computePolygonMetrics 与 polygonCentroid 准确计算面积、周长与质心', () => {
    expect(computePolygonMetrics([])).toEqual({ areaMu: 0, areaSquareMeters: 0, perimeterMeters: 0 })
    const twoPoints = computePolygonMetrics([
      [116.0, 39.0],
      [116.001, 39.0],
    ])
    expect(twoPoints.areaMu).toBe(0)
    expect(twoPoints.perimeterMeters).toBeGreaterThan(100)

    const rect = [
      [116.0, 39.0],
      [116.001, 39.0],
      [116.001, 39.001],
      [116.0, 39.001],
    ]
    const metrics = computePolygonMetrics(rect)
    expect(metrics.areaSquareMeters).toBeGreaterThan(9000)
    expect(metrics.areaSquareMeters).toBeLessThan(10500)
    expect(metrics.areaMu).toBeCloseTo(metrics.areaSquareMeters / 666.6666666666666, 6)

    expect(polygonCentroid([])).toBeNull()
    const twoMid = polygonCentroid([[116.0, 39.0], [116.002, 39.002]])
    expect(twoMid?.longitude).toBeCloseTo(116.001, 6)
    expect(twoMid?.latitude).toBeCloseTo(39.001, 6)
    // 共线退化多边形回退顶点均值
    const collinear = polygonCentroid([[116.0, 39.0], [116.001, 39.0], [116.002, 39.0]])
    expect(collinear?.longitude).toBeCloseTo(116.001, 6)
    expect(collinear?.latitude).toBeCloseTo(39.0, 6)

    const centroid = polygonCentroid(rect)
    expect(centroid?.longitude).toBeCloseTo(116.0005, 4)
    expect(centroid?.latitude).toBeCloseTo(39.0005, 4)
  })
})

describe('tianditu：密钥读取、地理编码与 SDK 加载器', () => {
  class FakeScriptElement {
    src = ''
    async = true
    dataset: Record<string, string> = {}
    listeners: Record<string, Array<() => void>> = {}
    removed = false
    addEventListener(ev: string, fn: () => void) {
      ;(this.listeners[ev] ??= []).push(fn)
    }
    emit(ev: string) {
      for (const fn of this.listeners[ev] ?? []) fn()
    }
    remove() {
      this.removed = true
    }
  }

  let appended: FakeScriptElement[] = []
  let fakeHead: any
  let storageMap: Map<string, string>

  beforeEach(() => {
    vi.useFakeTimers()
    appended = []
    storageMap = new Map()
    ;(globalThis as any).HTMLScriptElement = FakeScriptElement
    fakeHead = {
      appendChild(node: FakeScriptElement) {
        appended.push(node)
        return node
      },
    }
    ;(globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => storageMap.get(k) ?? null,
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    ;(globalThis as any).document = {
      head: fakeHead,
      querySelector: vi.fn().mockReturnValue(null),
      createElement: vi.fn(() => new FakeScriptElement()),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (globalThis as any).window
    delete (globalThis as any).document
    delete (globalThis as any).HTMLScriptElement
  })

  it('resolveTiandituToken 优先级与 getTiandituNamespace 正常', () => {
    expect(resolveTiandituToken()).toBe('')
    storageMap.set('tianditu_token', ' from-ls ')
    expect(resolveTiandituToken()).toBe('from-ls')
    ;(globalThis as any).window.__TIANDITU_TOKEN__ = ' from-win '
    expect(resolveTiandituToken()).toBe('from-win')

    expect(getTiandituNamespace()).toBeUndefined()
    ;(globalThis as any).window.T = { Map: class {} }
    expect(getTiandituNamespace()).toBeDefined()
  })

  it('geocodeAddress 覆盖缺密钥、空关键字、HTTP 错误、未匹配与成功解析', async () => {
    await expect(geocodeAddress('北京市')).rejects.toThrow('尚未配置天地图访问密钥')
    ;(globalThis as any).window.__TIANDITU_TOKEN__ = 'tk-test'
    await expect(geocodeAddress('   ')).rejects.toThrow('请输入要定位的地址')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(geocodeAddress('杭州市')).rejects.toThrow('HTTP 503')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: '1', msg: '无结果' }) }))
    await expect(geocodeAddress('未知地名')).rejects.toThrow('无结果')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: '1', msg: 'ok' }) }))
    await expect(geocodeAddress('模糊地名')).rejects.toThrow('未找到匹配的地址')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: '0',
          location: { lon: '120.155', lat: '30.274', level: '区县', keyWord: '浙江省杭州市' },
        }),
      }),
    )
    expect(await geocodeAddress('浙江省杭州市')).toEqual({
      longitude: 120.155,
      latitude: 30.274,
      level: '区县',
      matchedAddress: '浙江省杭州市',
    })
  })

  it('loadTianditu 覆盖错误、超时、组件脚本有序加载及成功初始化', async () => {
    // 1. 加载失败分支（顺便验证已有脏 script 被移除）
    const staleScript = new FakeScriptElement()
    ;(globalThis as any).document.querySelector.mockReturnValueOnce(staleScript)
    const errPromise = loadTianditu('tk-1')
    expect(staleScript.removed).toBe(true)
    const script1 = appended[0]
    expect(script1.src).toContain('tk=tk-1')
    // 验证加载期间插入的天地图组件脚本 async 会被改为 false
    const compScript = new FakeScriptElement()
    compScript.src = 'https://api.tianditu.gov.cn/v4.0/military.js'
    fakeHead.appendChild(compScript)
    expect(compScript.async).toBe(false)
    script1.emit('error')
    await expect(errPromise).rejects.toThrow('加载失败')

    // 2. 加载完成但未初始化 T.Map
    const noInitPromise = loadTianditu('tk-2')
    appended[appended.length - 1].emit('load')
    await expect(noInitPromise).rejects.toThrow('未初始化')

    // 3. 超时分支
    const timeoutPromise = loadTianditu('tk-3')
    const caught = timeoutPromise.catch((e) => e)
    vi.advanceTimersByTime(15_001)
    expect((await caught).message).toContain('加载超时')

    // 4. 并发复用 & 成功加载后直接命中缓存
    const p1 = loadTianditu('tk-4')
    const p2 = loadTianditu('tk-4')
    expect(p1).toBe(p2)
    ;(globalThis as any).window.T = { Map: class {} }
    appended[appended.length - 1].emit('load')
    const ns = await p1
    expect(ns.Map).toBeDefined()
    expect(await loadTianditu('tk-4')).toBe(ns)
  })
})
