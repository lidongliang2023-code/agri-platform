/**
 * IoT 设备 / 设备绑定 实体类型
 */

/** 设备类型：1 传感器 2 摄像头 3 控制器 4 气象站 5 无人机 */
export type DeviceType = 1 | 2 | 3 | 4 | 5

/** 设备在线状态：1 在线 2 离线 3 故障 */
export type DeviceOnlineStatus = 1 | 2 | 3

/** 绑定对象类型：1 地块 2 大棚 3 农场 */
export type BindTargetType = 1 | 2 | 3

/** IoT 设备 */
export interface IotDevice {
  /** 设备 ID */
  deviceId: string
  /** 设备编码 */
  deviceCode: string
  /** 设备名称 */
  deviceName: string
  /** 设备类型：1 传感器 2 摄像头 3 控制器 4 气象站 5 无人机 */
  deviceType: DeviceType
  /** 设备型号 */
  model?: string
  /** 厂商 */
  manufacturer?: string
  /** 固件版本 */
  firmwareVersion?: string
  /** 所属农场 ID */
  farmId?: string
  /** 所属农场名称（冗余） */
  farmName?: string
  /** 在线状态：1 在线 2 离线 3 故障 */
  onlineStatus: DeviceOnlineStatus
  /** 电量百分比 */
  battery?: number
  /** 信号强度（dBm） */
  signal?: number
  /** 最近心跳时间 */
  lastHeartbeatAt?: string
  /** 安装位置描述 */
  location?: string
  /** 经度 */
  longitude?: number
  /** 纬度 */
  latitude?: number
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 设备绑定关系
 *
 * @deprecated 该结构是「后端 `/iot/bindings` 改造前」的前端本地形态。
 * 后端现已返回真正的绑定关系对象 {@link IotBinding}（bindType 为字符串枚举、
 * status 为 BOUND/UNBOUND/PAUSED、metrics 已是数组）。
 * 本接口仅为兼容既有页面（DeviceBindings）保留，`@/api/iot` 内部已做双向映射，
 * **新代码请直接使用 `IotBinding`**。
 */
export interface DeviceBinding {
  /** 绑定 ID */
  bindingId: string
  /** 设备 ID */
  deviceId: string
  /** 设备名称（冗余） */
  deviceName?: string
  /** 绑定对象类型：1 地块 2 大棚 3 农场 */
  targetType: BindTargetType
  /** 绑定对象 ID */
  targetId: string
  /** 绑定对象名称（冗余） */
  targetName?: string
  /** 采集指标列表 */
  metrics?: string[]
  /** 采集频率（分钟） */
  collectInterval?: number
  /** 绑定状态：1 已绑定 0 已解绑 */
  status: 0 | 1
  /** 绑定时间 */
  boundAt: string
}

/** 设备遥测数据点 */
export interface DeviceTelemetry {
  /** 数据点 ID */
  telemetryId: string
  /** 设备 ID */
  deviceId: string
  /** 指标编码 */
  metric: string
  /** 指标名称 */
  metricName?: string
  /** 指标值 */
  value: number
  /** 单位 */
  unit?: string
  /** 采集时间 */
  collectedAt: string
}

/* ============================================================================
 * 以下为后端 IoT 三个新域（prod_iot_binding / prod_iot_command / prod_iot_maintenance）
 * 落地后的真实契约类型，由 SE-1 提供，主键一律 string。
 * ========================================================================== */

/** 绑定对象类型（后端 bindType 枚举） */
export type IotBindType = 'PLOT' | 'GREENHOUSE' | 'FARM'

/** 绑定状态（后端 status 枚举；查询不传 status 时后端默认只返回 BOUND） */
export type IotBindingStatus = 'BOUND' | 'UNBOUND' | 'PAUSED'

/** 指令状态（后端 status 枚举；下发接口返回的已是服务端落库的终态） */
export type IotCommandStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

/** 维修类型（后端 maintainType 枚举） */
export type IotMaintainType = 'INSPECT' | 'REPAIR' | 'REPLACE' | 'CALIBRATE' | 'UPGRADE'

/** IoT 设备绑定关系（对齐后端 IotBindingVO） */
export interface IotBinding {
  /** 绑定 ID（BIND 前缀 + 时间戳） */
  bindingId: string
  /** 设备 ID */
  deviceId: string
  /** 设备编码（冗余） */
  deviceCode: string
  /** 设备名称（冗余） */
  deviceName: string
  /** 绑定对象类型：PLOT 地块 / GREENHOUSE 大棚 / FARM 农场 */
  bindType: IotBindType
  /** 绑定对象 ID（地块 ID / 大棚 ID / 农场 ID） */
  bindTargetId: string
  /** 绑定对象名称（冗余） */
  bindTargetName: string
  /** 采集指标（后端已转成数组，前端无需拆串） */
  metrics: string[]
  /** 采集频率（分钟），未设置时为 null */
  frequency: number | null
  /** 绑定状态 */
  status: IotBindingStatus
  /** 绑定时间 yyyy-MM-dd HH:mm:ss */
  boundAt: string
}

/** IoT 设备指令（对齐后端 IotCommandEntity） */
export interface IotCommand {
  /** 指令 ID（CMMD 前缀 + 时间戳） */
  commandId: string
  /** 设备 ID */
  deviceId: string
  /** 设备编码（冗余） */
  deviceCode: string
  /** 指令类型 */
  commandType: string
  /** 指令参数（文本） */
  params?: string
  /** 操作人 */
  operator?: string
  /** 指令状态（下发接口返回时已是终态，前端不要再用定时器模拟） */
  status: IotCommandStatus
  /** 回执说明 */
  receipt?: string
  /** 下发时间 */
  sendAt: string
  /** 回执时间 */
  receiptAt?: string
}

/** IoT 设备维修记录（对齐后端 IotMaintenanceEntity） */
export interface IotMaintenance {
  /** 维修记录 ID（MNTN 前缀 + 时间戳） */
  maintainId: string
  /** 设备 ID */
  deviceId: string
  /** 设备编码（冗余） */
  deviceCode: string
  /** 维修类型 */
  maintainType: IotMaintainType
  /** 维修内容 */
  content: string
  /** 操作人 */
  operator: string
  /** 维修时间（新增时不传由服务端取当前时间） */
  maintainAt: string
  /** 维修结果 */
  result?: string
}
