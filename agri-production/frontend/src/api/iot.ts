/**
 * IoT 设备管理 API（设备 / 绑定 / 遥测）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type {
  DeviceBinding,
  DeviceTelemetry,
  IotBinding,
  IotBindingStatus,
  IotBindType,
  IotCommand,
  IotCommandStatus,
  IotDevice,
  IotMaintainType,
  IotMaintenance,
} from '@/types'

const BASE = '/iot'

/** 设备列表查询参数 */
export interface DeviceListParams extends PageQuery {
  farmId?: string
  deviceName?: string
  deviceType?: number
  onlineStatus?: number
}

/** 设备新增 / 编辑入参 */
export type DevicePayload = Partial<IotDevice>

/** 分页查询设备列表 */
export function listDevices(params: DeviceListParams): Promise<PageResult<IotDevice>> {
  return http.get<PageResult<IotDevice>>(`${BASE}/devices`, params)
}

/** 查询设备详情 */
export function getDevice(deviceId: string): Promise<IotDevice> {
  return http.get<IotDevice>(`${BASE}/devices/${deviceId}`)
}

/** 新增设备 */
export function createDevice(payload: DevicePayload): Promise<string> {
  return http.post<string>(`${BASE}/devices`, payload)
}

/** 更新设备 */
export function updateDevice(deviceId: string, payload: DevicePayload): Promise<IotDevice> {
  return http.put<IotDevice>(`${BASE}/devices/${deviceId}`, payload)
}

/** 删除设备 */
export function deleteDevice(deviceId: string): Promise<void> {
  return http.delete<void>(`${BASE}/devices/${deviceId}`)
}

/** 查询设备遥测数据 */
export function listDeviceTelemetry(
  deviceId: string,
  params: { metric?: string; startDate?: string; endDate?: string },
): Promise<DeviceTelemetry[]> {
  return http.get<DeviceTelemetry[]>(
    `${BASE}/devices/${deviceId}/telemetry`,
    params,
  )
}

/* ============================================================================
 * 绑定关系（/iot/bindings）
 *
 * ⚠️ 破坏性变更：后端 `GET /iot/bindings` 原来返回设备列表 `IotDeviceEntity[]`，
 * 现在返回真正的绑定关系对象 `IotBindingVO[]`（见 `@/types` 的 IotBinding）。
 * 为不让既有页面（DeviceBindings / DeviceDetail / DeviceList）返工，
 * 本段保留旧的 `DeviceBinding` 出参形状，内部做「新 VO ↔ 旧结构」双向映射：
 *   页面               后端
 *   targetType 1/2/3 ⇄ bindType PLOT / GREENHOUSE / FARM
 *   status     1/0   ⇄ status   BOUND / UNBOUND（PAUSED 归为 1 已绑定）
 *   metrics string[] ⇄ metrics  逗号分隔字符串
 *   新代码请直接用下方 `listBindings` / `bindDevice` 等原生契约函数。
 * ========================================================================== */

/** 旧结构 targetType（1 地块 2 大棚 3 农场）→ 后端 bindType 枚举 */
const BIND_TYPE_BY_TARGET: Record<number, IotBindType> = {
  1: 'PLOT',
  2: 'GREENHOUSE',
  3: 'FARM',
}

/** 后端 bindType 枚举 → 旧结构 targetType */
const TARGET_BY_BIND_TYPE: Record<IotBindType, number> = {
  PLOT: 1,
  GREENHOUSE: 2,
  FARM: 3,
}

/**
 * 后端绑定关系对象 → 旧版 DeviceBinding 结构。
 *
 * @param vo 后端 IotBindingVO
 * @returns 旧版绑定结构
 */
export function toDeviceBinding(vo: IotBinding): DeviceBinding {
  return {
    bindingId: vo.bindingId,
    deviceId: vo.deviceId,
    deviceName: vo.deviceName,
    targetType: (TARGET_BY_BIND_TYPE[vo.bindType] ?? 1) as DeviceBinding['targetType'],
    targetId: vo.bindTargetId,
    targetName: vo.bindTargetName,
    metrics: vo.metrics ?? [],
    collectInterval: vo.frequency ?? undefined,
    status: vo.status === 'UNBOUND' ? 0 : 1,
    boundAt: vo.boundAt,
  }
}

/** 分页查询设备绑定关系（走 `/iot/bindings/page`，返回旧版结构） */
export function listDeviceBindings(
  params: PageQuery & { deviceId?: string; targetType?: number; status?: IotBindingStatus },
): Promise<PageResult<DeviceBinding>> {
  const { targetType, ...rest } = params
  return http
    .get<PageResult<IotBinding>>(`${BASE}/bindings/page`, {
      ...rest,
      bindType: targetType ? BIND_TYPE_BY_TARGET[targetType] : undefined,
    })
    .then((page) => ({
      ...page,
      list: (page?.list ?? []).map(toDeviceBinding),
    }))
}

/** 新增设备绑定（后端以 query 参数接收，metrics 传逗号分隔字符串） */
export function createDeviceBinding(payload: Partial<DeviceBinding>): Promise<DeviceBinding> {
  return http
    .post<IotBinding>(`${BASE}/bindings`, undefined, {
      params: {
        deviceId: payload.deviceId,
        bindType: BIND_TYPE_BY_TARGET[payload.targetType ?? 1],
        bindTargetId: payload.targetId,
        targetName: payload.targetName,
        metrics: (payload.metrics ?? []).join(','),
        frequency: payload.collectInterval,
      },
    })
    .then(toDeviceBinding)
}

/** 更新设备绑定：status 传 0 视为解绑，其余按状态变更处理 */
export function updateDeviceBinding(
  bindingId: string,
  payload: Partial<DeviceBinding>,
): Promise<DeviceBinding> {
  if (payload.status === 0) {
    return http
      .post<IotBinding>(`${BASE}/bindings/${bindingId}/unbind`)
      .then(toDeviceBinding)
  }
  return http
    .post<IotBinding>(`${BASE}/bindings/${bindingId}/status`, undefined, {
      params: { status: 'BOUND' },
    })
    .then(toDeviceBinding)
}

/** 解绑设备（记录保留，状态置 UNBOUND） */
export function deleteDeviceBinding(bindingId: string): Promise<boolean> {
  return http
    .post<IotBinding>(`${BASE}/bindings/${bindingId}/unbind`)
    .then(() => true)
}

/* ============================================================================
 * 以下为「IoT / 生长监测页面填充」追加内容，纯新增，不改动既有定义。
 * ========================================================================== */

/** IoT 读数点（对齐后端 IotReadingEntity） */
export interface IotReading {
  /** 读数 ID */
  readingId: string
  /** 设备 ID */
  deviceId: string
  /** 设备编码（冗余） */
  deviceCode?: string
  /** 地块 ID */
  plotId?: string
  /** 指标编码，如 airTemperature / soilMoisture */
  metric: string
  /** 指标值 */
  metricValue: number
  /** 单位 */
  unit?: string
  /** 读取时间 */
  readTime: string
  /** 数据质量标记：1 正常 0 异常 */
  qualityFlag?: number
}

/**
 * 将后端「分页结构 / 纯数组」两种返回形态统一为数组。
 *
 * `/iot/bindings`、`/growth/environment` 等端点返回纯数组，
 * 而 API 声明为分页结构，页面层统一用本函数取值，避免 `res.list` 为空。
 *
 * @param res 接口返回值
 * @returns 数据行数组
 */
export function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && typeof res === 'object') {
    const list = (res as { list?: unknown }).list
    if (Array.isArray(list)) return list as T[]
  }
  return []
}

/** 查询设备指标时序（GET /iot/readings/series） */
export function listReadingSeries(deviceId: string, metric?: string): Promise<IotReading[]> {
  return http.get<IotReading[]>(`${BASE}/readings/series`, { deviceId, metric })
}

/** 查询设备最新读数（GET /iot/readings/latest） */
export function getLatestReading(deviceId: string): Promise<IotReading | null> {
  return http.get<IotReading | null>(`${BASE}/readings/latest`, { deviceId })
}

/** 查询离线设备（GET /iot/devices/offline） */
export function listOfflineDevices(minutes = 10): Promise<IotDevice[]> {
  return http.get<IotDevice[]>(`${BASE}/devices/offline`, { minutes })
}

/** 设备心跳上报（POST /iot/devices/{deviceId}/heartbeat） */
export function heartbeatDevice(deviceId: string): Promise<IotDevice> {
  return http.post<IotDevice>(`${BASE}/devices/${deviceId}/heartbeat`)
}

/**
 * 查询已绑定的设备（按地块过滤）。
 *
 * 后端 `/iot/bindings` 改为返回绑定关系对象后，本函数改为「先取绑定关系、
 * 再按 deviceId 回查设备列表」的两步实现，保证出参仍是完整的 `IotDevice[]`。
 *
 * @param plotId 地块 ID，不传表示全部已绑定设备
 * @returns 设备列表
 */
export async function listBoundDevices(plotId?: string): Promise<IotDevice[]> {
  const bindings = await http.get<IotBinding[]>(`${BASE}/bindings`, {
    bindTargetId: plotId,
  })
  const boundIds = (Array.isArray(bindings) ? bindings : [])
    .filter((item) => item.status === 'BOUND')
    .map((item) => item.deviceId)
  if (boundIds.length === 0) return []
  const page = await http.get<PageResult<IotDevice>>(`${BASE}/devices`, {
    pageNum: 1,
    pageSize: Math.max(boundIds.length, 100),
  })
  const devices = page?.list ?? []
  return devices.filter((device) => boundIds.includes(device.deviceId))
}

/** 设备在线状态：1 在线 2 离线 3 故障 */
export const DEVICE_ONLINE_META: Record<number, { label: string; color: string }> = {
  1: { label: '在线', color: 'green' },
  2: { label: '离线', color: 'default' },
  3: { label: '故障', color: 'red' },
}

/** 设备类型标签（兼容后端字符串类型与实体枚举值两种形态） */
export const DEVICE_TYPE_LABEL_MAP: Record<string, string> = {
  '1': '传感器',
  '2': '摄像头',
  '3': '控制器',
  '4': '气象站',
  '5': '无人机',
  sensor: '传感器',
  soil: '土壤监测',
  camera: '视频监控',
  video: '视频监控',
  controller: '灌溉控制',
  irrigation: '灌溉控制',
  weather: '气象站',
  weatherstation: '气象站',
  drone: '无人机',
}

/**
 * 解析设备在线状态展示元数据。
 *
 * @param status 在线状态（1 在线 / 2 离线 / 3 故障），异常值兜底为离线
 * @returns 展示文案与 Tag 颜色
 */
export function onlineStatusMeta(status: unknown): { label: string; color: string } {
  const key = Number(status)
  if (key === 1 || key === 2 || key === 3) return DEVICE_ONLINE_META[key]
  return DEVICE_ONLINE_META[2]
}

/**
 * 解析设备类型展示文案。
 *
 * @param deviceType 设备类型（枚举值或中文名）
 * @returns 展示文案
 */
export function deviceTypeLabel(deviceType: unknown): string {
  if (deviceType === null || deviceType === undefined || deviceType === '') return '-'
  const key = String(deviceType)
  return DEVICE_TYPE_LABEL_MAP[key] ?? DEVICE_TYPE_LABEL_MAP[key.toLowerCase()] ?? key
}

/** 环境 / 遥测指标定义（页面共享，避免多处重复定义） */
export interface EnvMetricDef {
  /** 指标编码 */
  key: string
  /** 指标名称 */
  label: string
  /** 单位 */
  unit: string
  /** Y 轴索引：0 左轴（温湿度类）1 右轴（光照 / CO₂ 大量纲） */
  axis: 0 | 1
  /** 曲线颜色 */
  color: string
}

/** 环境指标定义表 */
export const ENV_METRIC_DEFS: EnvMetricDef[] = [
  { key: 'airTemperature', label: '空气温度', unit: '℃', axis: 0, color: '#ff7875' },
  { key: 'airHumidity', label: '空气湿度', unit: '%', axis: 0, color: '#40a9ff' },
  { key: 'soilTemperature', label: '土壤温度', unit: '℃', axis: 0, color: '#ffa940' },
  { key: 'soilMoisture', label: '土壤湿度', unit: '%', axis: 0, color: '#52c41a' },
  { key: 'rainfall', label: '降雨量', unit: 'mm', axis: 0, color: '#36cfc9' },
  { key: 'illuminance', label: '光照强度', unit: 'lux', axis: 1, color: '#fadb14' },
  { key: 'co2', label: 'CO₂浓度', unit: 'ppm', axis: 1, color: '#9254de' },
]

/** 默认展示指标 */
export const DEFAULT_ENV_METRICS: string[] = ['airTemperature', 'airHumidity', 'soilMoisture']

/** 后端指标命名别名 → 前端标准编码 */
const METRIC_ALIAS: Record<string, string> = {
  air_temperature: 'airTemperature',
  air_temp: 'airTemperature',
  temperature: 'airTemperature',
  temp: 'airTemperature',
  air_humidity: 'airHumidity',
  humidity: 'airHumidity',
  soil_temperature: 'soilTemperature',
  soil_temp: 'soilTemperature',
  soil_moisture: 'soilMoisture',
  soil_humidity: 'soilMoisture',
  soil_water: 'soilMoisture',
  illuminance: 'illuminance',
  light: 'illuminance',
  co2: 'co2',
  rainfall: 'rainfall',
  rain: 'rainfall',
}

/**
 * 标准化指标编码（兼容后端下划线命名）。
 *
 * @param metric 原始指标编码
 * @returns 标准编码
 */
export function normalizeMetric(metric: string): string {
  if (!metric) return ''
  return METRIC_ALIAS[metric] ?? METRIC_ALIAS[metric.toLowerCase()] ?? metric
}

/**
 * 查询指标中文名（未登记指标回退原始编码）。
 *
 * @param metric 指标编码
 * @returns 指标名称
 */
export function metricLabel(metric: string): string {
  const key = normalizeMetric(metric)
  return ENV_METRIC_DEFS.find((item) => item.key === key)?.label ?? metric
}

/* ============================================================================
 * 设备运维端点就绪状态
 *
 * `prod_iot_command` / `prod_iot_maintenance` 两张表及 17 个 IoT 端点已由 SE-1 上线，
 * 指令回执由服务端按设备 `online_flag` + 10 分钟心跳窗口判定并落库：
 *   在线 → SUCCESS（回执「设备在线，指令已送达」）
 *   离线 → FAILED（回执「送达失败：设备离线或无有效心跳」）
 * 下发接口返回的 status 已是终态，前端**不再做任何本地暂存或 setTimeout 模拟**。
 * 页面统一使用下方「原生契约层」的 sendCommand / listCommands /
 * createIotMaintenance / listIotMaintenances。
 * ========================================================================== */

/**
 * 设备运维端点（指令 / 维修）就绪开关。
 * 已置为 true；本地 localStorage 暂存分支连同兜底代码已整体删除。
 */
export const DEVICE_OPS_BACKEND_READY = true

/**
 * `/iot/bindings` 返回真实绑定关系（bindType / bindTargetId / metrics / frequency / status）的开关。
 * 已置为 true；页面直接使用服务端数据，本地暂存兜底已整体删除。
 */
export const DEVICE_BINDING_BACKEND_READY = true

/* ============================================================================
 * IoT 新端点原生契约层（绑定 / 指令 / 维修）
 *
 * 后端 `prod_iot_binding` / `prod_iot_command` / `prod_iot_maintenance` 三张表
 * 与 17 个端点已上线（SE-1），本段严格按后端契约定，不再做本地兜底：
 * - 主键一律 string（bindingId / commandId / maintainId）
 * - 指令状态由服务端落库，下发接口返回的已是终态，前端不要再用 setTimeout 模拟
 * - 查询绑定不传 status 时后端默认只返回 BOUND
 * 与上方「旧结构适配层」互不干扰，页面可按需选用。
 * ========================================================================== */

/** 绑定关系查询参数 */
export interface BindingQuery {
  /** 设备 ID */
  deviceId?: string
  /** 绑定对象类型 */
  bindType?: IotBindType
  /** 绑定对象 ID（地块 / 大棚 / 农场） */
  bindTargetId?: string
  /** 绑定状态，不传时后端默认 BOUND */
  status?: IotBindingStatus
}

/** 建立绑定入参 */
export interface BindDevicePayload {
  /** 设备 ID */
  deviceId: string
  /** 绑定对象类型 */
  bindType: IotBindType
  /** 绑定对象 ID */
  bindTargetId: string
  /** 绑定对象名称 */
  targetName?: string
  /** 采集指标（本层负责拼成后端要求的逗号分隔字符串） */
  metrics?: string[]
  /** 采集频率（分钟） */
  frequency?: number
}

/** 查询绑定关系（GET /iot/bindings，返回纯数组） */
export function listBindings(params: BindingQuery = {}): Promise<IotBinding[]> {
  return http.get<IotBinding[]>(`${BASE}/bindings`, params)
}

/** 分页查询绑定关系（GET /iot/bindings/page） */
export function pageBindings(
  params: PageQuery & BindingQuery,
): Promise<PageResult<IotBinding>> {
  return http.get<PageResult<IotBinding>>(`${BASE}/bindings/page`, params)
}

/** 查询绑定详情（GET /iot/bindings/{bindingId}） */
export function getBinding(bindingId: string): Promise<IotBinding> {
  return http.get<IotBinding>(`${BASE}/bindings/${bindingId}`)
}

/** 建立绑定（POST /iot/bindings，参数走 query；同「设备+类型+对象」重复绑定会重新置为 BOUND） */
export function bindDevice(payload: BindDevicePayload): Promise<IotBinding> {
  return http.post<IotBinding>(`${BASE}/bindings`, undefined, {
    params: {
      deviceId: payload.deviceId,
      bindType: payload.bindType,
      bindTargetId: payload.bindTargetId,
      targetName: payload.targetName,
      metrics: (payload.metrics ?? []).join(','),
      frequency: payload.frequency,
    },
  })
}

/** 解绑（POST /iot/bindings/{bindingId}/unbind，记录保留） */
export function unbindBinding(bindingId: string): Promise<IotBinding> {
  return http.post<IotBinding>(`${BASE}/bindings/${bindingId}/unbind`)
}

/** 变更绑定状态（POST /iot/bindings/{bindingId}/status?status=BOUND|UNBOUND|PAUSED） */
export function setBindingStatus(
  bindingId: string,
  status: IotBindingStatus,
): Promise<IotBinding> {
  return http.post<IotBinding>(`${BASE}/bindings/${bindingId}/status`, undefined, {
    params: { status },
  })
}

/** 绑定状态展示元数据 */
export const BINDING_STATUS_META: Record<IotBindingStatus, { label: string; color: string }> = {
  BOUND: { label: '已绑定', color: 'green' },
  UNBOUND: { label: '已解绑', color: 'default' },
  PAUSED: { label: '已暂停', color: 'orange' },
}

/**
 * 解析绑定状态展示元数据。
 *
 * @param status 绑定状态
 * @returns 展示文案与 Tag 颜色
 */
export function bindingStatusMeta(status: unknown): { label: string; color: string } {
  const key = String(status) as IotBindingStatus
  return BINDING_STATUS_META[key] ?? { label: String(status ?? '-'), color: 'default' }
}

/** 指令下发入参 */
export interface SendCommandPayload {
  /** 指令类型 */
  commandType: string
  /** 指令参数 */
  params?: string
  /** 操作人 */
  operator?: string
}

/**
 * 下发设备指令（POST /iot/devices/{deviceId}/commands）。
 *
 * 服务端会按设备真实在线状态落库终态：在线 → SUCCESS（回执「设备在线，指令已送达」），
 * 离线或无有效心跳 → FAILED（回执「送达失败：设备离线或无有效心跳」）。
 * 返回的 status 已是最终值，**页面直接渲染，不要再用定时器轮询模拟**。
 */
export function sendCommand(
  deviceId: string,
  payload: SendCommandPayload,
): Promise<IotCommand> {
  return http.post<IotCommand>(`${BASE}/devices/${deviceId}/commands`, undefined, {
    params: {
      commandType: payload.commandType,
      params: payload.params,
      operator: payload.operator,
    },
  })
}

/** 查询设备指令记录（GET /iot/devices/{deviceId}/commands，按下发时间倒序） */
export function listCommands(
  deviceId: string,
  params: { status?: IotCommandStatus; limit?: number } = {},
): Promise<IotCommand[]> {
  return http.get<IotCommand[]>(`${BASE}/devices/${deviceId}/commands`, params)
}

/** 查询指令详情（GET /iot/commands/{commandId}） */
export function getCommand(commandId: string): Promise<IotCommand> {
  return http.get<IotCommand>(`${BASE}/commands/${commandId}`)
}

/** 上报指令真实回执（POST /iot/commands/{commandId}/receipt，卫星服务回调） */
export function reportCommandReceipt(
  commandId: string,
  success: boolean,
  receipt?: string,
): Promise<IotCommand> {
  return http.post<IotCommand>(`${BASE}/commands/${commandId}/receipt`, undefined, {
    params: { success, receipt },
  })
}

/** 跨设备分页查询指令（GET /iot/commands） */
export function pageCommands(
  params: PageQuery & { deviceId?: string; status?: IotCommandStatus },
): Promise<PageResult<IotCommand>> {
  return http.get<PageResult<IotCommand>>(`${BASE}/commands`, params)
}

/** 指令状态展示元数据 */
export const COMMAND_STATUS_META: Record<IotCommandStatus, { label: string; color: string }> = {
  PENDING: { label: '下发中', color: 'blue' },
  SUCCESS: { label: '执行成功', color: 'green' },
  FAILED: { label: '执行失败', color: 'red' },
}

/**
 * 解析指令状态展示元数据。
 *
 * @param status 指令状态
 * @returns 展示文案与 Tag 颜色
 */
export function commandStatusMeta(status: unknown): { label: string; color: string } {
  const key = String(status) as IotCommandStatus
  return COMMAND_STATUS_META[key] ?? { label: String(status ?? '-'), color: 'default' }
}

/** 维修记录入参（maintainAt 不传由服务端取当前时间） */
export type MaintenancePayload = Omit<
  Partial<IotMaintenance>,
  'maintainId' | 'deviceId' | 'deviceCode'
>

/** 登记维修记录（POST /iot/devices/{deviceId}/maintenances） */
export function createIotMaintenance(
  deviceId: string,
  payload: MaintenancePayload,
): Promise<IotMaintenance> {
  return http.post<IotMaintenance>(`${BASE}/devices/${deviceId}/maintenances`, payload)
}

/** 查询设备维修记录（GET /iot/devices/{deviceId}/maintenances，按维修时间倒序） */
export function listIotMaintenances(
  deviceId: string,
  limit = 100,
): Promise<IotMaintenance[]> {
  return http.get<IotMaintenance[]>(`${BASE}/devices/${deviceId}/maintenances`, { limit })
}

/** 查询维修记录详情（GET /iot/maintenances/{maintainId}） */
export function getMaintenance(maintainId: string): Promise<IotMaintenance> {
  return http.get<IotMaintenance>(`${BASE}/maintenances/${maintainId}`)
}

/** 更新维修记录（PUT /iot/maintenances/{maintainId}） */
export function updateMaintenance(
  maintainId: string,
  payload: MaintenancePayload,
): Promise<IotMaintenance> {
  return http.put<IotMaintenance>(`${BASE}/maintenances/${maintainId}`, payload)
}

/** 删除维修记录（DELETE /iot/maintenances/{maintainId}） */
export function deleteMaintenance(maintainId: string): Promise<void> {
  return http.delete<void>(`${BASE}/maintenances/${maintainId}`)
}

/** 跨设备分页查询维修记录（GET /iot/maintenances） */
export function pageMaintenances(
  params: PageQuery & { deviceId?: string },
): Promise<PageResult<IotMaintenance>> {
  return http.get<PageResult<IotMaintenance>>(`${BASE}/maintenances`, params)
}

/** 维修类型展示文案 */
export const MAINTAIN_TYPE_LABEL: Record<IotMaintainType, string> = {
  INSPECT: '巡检',
  REPAIR: '维修',
  REPLACE: '更换',
  CALIBRATE: '校准',
  UPGRADE: '升级',
}

/**
 * 解析维修类型展示文案。
 *
 * @param maintainType 维修类型
 * @returns 展示文案
 */
export function maintainTypeLabel(maintainType: unknown): string {
  const key = String(maintainType) as IotMaintainType
  return MAINTAIN_TYPE_LABEL[key] ?? String(maintainType ?? '-')
}
