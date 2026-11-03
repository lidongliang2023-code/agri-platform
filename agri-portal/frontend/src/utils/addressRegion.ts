/**
 * 全国行政区划（省 / 市 / 区县）读取。
 *
 * <p>数据源是**主数据管理的行政区划表**（`agri_md_address_region`），门户不另存副本：
 * 经 `72-portal.conf` 的 `/api/master-data/` 反代到主数据后端，按层级一次拉全量后在内存里级联，
 * 避免每选一次省就发一次请求。</p>
 *
 * <p>行政编码是 6 位 GB/T 2260 码（省 110000 / 市 110100 / 区 110101），
 * 主数据端可能继续维护（增补、停用），所以缓存只放在当前页面会话，刷新即重新拉取。</p>
 */
import { getPlatformAccessToken } from './platformToken'

export interface RegionOption {
  code: string
  name: string
  parentCode: string
  level: number
}

export interface RegionCatalog {
  provinces: RegionOption[]
  cities: RegionOption[]
  districts: RegionOption[]
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

let cache: RegionCatalog | null = null
let inflight: Promise<RegionCatalog> | null = null

async function fetchLevel(level: number, token: string): Promise<RegionOption[]> {
  const response = await fetch(`/api/master-data/address/regions/level/${level}`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
  })
  let body: ApiBody<Array<Record<string, unknown>>>
  try {
    body = (await response.json()) as ApiBody<Array<Record<string, unknown>>>
  } catch {
    throw new Error('行政区划接口返回异常')
  }
  // 主数据后端成功码是 200（平台侧是 0），这里两种都接受，其余一律当失败
  if (!response.ok || (body.code !== 200 && body.code !== 0)) {
    throw new Error(body.message || '行政区划加载失败')
  }
  return (body.data ?? []).map((row) => ({
    code: String(row.regionCode ?? ''),
    name: String(row.regionName ?? ''),
    parentCode: String(row.parentCode ?? ''),
    level: Number(row.level ?? level),
  })).filter((row) => row.code !== '' && row.name !== '')
}

/** 拉取省 / 市 / 区三级目录；同一页面会话内只拉一次。 */
export async function loadRegionCatalog(): Promise<RegionCatalog> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = (async () => {
    const token = await getPlatformAccessToken()
    const [provinces, cities, districts] = await Promise.all([
      fetchLevel(1, token),
      fetchLevel(2, token),
      fetchLevel(3, token),
    ])
    cache = { provinces, cities, districts }
    return cache
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** 清缓存（行政区划在运营端维护后，页面刷新即可生效；这里给需要强制重载的调用方留口子） */
export function clearRegionCatalog(): void {
  cache = null
}

export const childrenOf = (rows: RegionOption[], parentCode: string): RegionOption[] =>
  parentCode ? rows.filter((row) => row.parentCode === parentCode) : []

/**
 * 展示用城市名：直辖市的市级节点在国家区划里叫「市辖区」，
 * 拼地址时显示成「市辖区」很别扭，这里统一回退成省级名称。
 */
export const displayCityName = (city: RegionOption | undefined, province: RegionOption | undefined): string => {
  if (!city) return ''
  if (city.name === '市辖区' || city.name === '县') {
    return province?.name ?? ''
  }
  return city.name
}
