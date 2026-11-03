/**
 * 生产监控看板 API（`/production/monitor`）
 *
 * 看板的数据来源分两块，刻意不合并成一个"大接口"：
 *   · 环境态势 —— 生产端自己的传感器长表（`agri_prod_sensor_data`），走 `env-summary`；
 *   · 设备台账 —— 物联网系统（`agri_iot.iot_device`），走 `@/api/iot` 的
 *     `getDeviceStats` / `listDevices`。
 *
 * 这样设备数据只有一条链路（物联网端），看板不会因为"再算一遍设备数"而与设备列表页对不上。
 */
import { http } from '@/utils/request'

const BASE = '/monitor'

/** 环境概览查询参数 */
export interface MonitorEnvParams {
  /** 农场标识（数字 id / 农场编码 / 平台标识 DEMO-FARM-001），为空表示不按农场过滤 */
  farmId?: string
  /** 地块标识，为空表示不按地块过滤 */
  plotId?: string
  /** 窗口长度（小时），默认 24，上限 168 */
  hours?: number
}

/** 按小时聚合的曲线点（指标缺失为 null，曲线断开而不是补 0） */
export interface MonitorEnvPoint {
  /** 小时标签，如 `10-13 16:00` */
  time: string
  airTemperature: number | null
  airHumidity: number | null
  soilTemperature: number | null
  soilMoisture: number | null
  illuminance: number | null
  co2: number | null
}

/**
 * 环境实时概览（对齐后端 `MonitorEnvVO`）。
 *
 * 窗口终点是**最新一次采样时间**而不是当前时间；`staleHours` 是它距现在的小时数，
 * 页面必须把它显示出来 —— 否则用户会把上周的数据当成"刚刚"。
 */
export interface MonitorEnvVO {
  /** 窗口长度（小时） */
  windowHours: number
  /** 窗口起点 `yyyy-MM-dd HH:mm:ss` */
  windowFrom?: string
  /** 窗口终点（= 最新一次采样时间） */
  windowTo?: string
  /** 最新采样距现在的小时数；无数据时为 null */
  staleHours?: number | null
  /** 参与聚合的读数条数（长表行数） */
  sampleCount: number
  /** 覆盖的地块数量 */
  plotCount: number
  /** 指标平均值（规范码 → 值）。**缺键表示该指标无数据**，不是 0 */
  summary: Record<string, number>
  /** 窗口内降雨累计（mm）；无降雨数据为 null */
  rainfallTotal?: number | null
  /** 按小时聚合的曲线点（升序） */
  series: MonitorEnvPoint[]
}

/** 查询环境实时概览（GET /production/monitor/env-summary） */
export function getMonitorEnvSummary(params: MonitorEnvParams): Promise<MonitorEnvVO> {
  return http.get<MonitorEnvVO>(`${BASE}/env-summary`, params)
}
