/**
 * 生长监测（生长记录 / 环境数据）实体类型
 */

/** 长势评级：1 弱 2 偏弱 3 正常 4 旺盛 */
export type GrowthLevel = 1 | 2 | 3 | 4

/** 生长记录 */
export interface GrowthRecord {
  /** 记录 ID */
  recordId: string
  /** 地块 ID */
  plotId: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 种养计划 ID */
  planId?: string
  /** 作物 ID */
  cropId?: string
  /** 作物名称（冗余） */
  cropName?: string
  /** 生育期，如 苗期 / 花期 */
  growthStage: string
  /** 株高（cm） */
  plantHeight?: number
  /** 叶面积指数 */
  leafAreaIndex?: number
  /** 长势评级：1 弱 2 偏弱 3 正常 4 旺盛 */
  growthLevel: GrowthLevel
  /** 病虫害情况描述 */
  pestInfo?: string
  /** 备注（溯源 / 全链路展示用） */
  remark?: string
  /** 记录人 ID */
  recorderId?: string
  /** 记录人姓名 */
  recorderName?: string
  /** 记录日期 */
  recordDate: string
  /** 现场照片地址列表 */
  photoUrls?: string[]
  /** 是否已上链 */
  onChain: boolean
  /** 创建时间 */
  createdAt: string
}

/** 环境数据来源：1 物联网设备 2 人工录入 3 气象站 */
export type EnvDataSource = 1 | 2 | 3

/** 环境数据 */
export interface EnvironmentData {
  /** 数据 ID */
  dataId: string
  /** 地块 ID */
  plotId: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 设备 ID */
  deviceId?: string
  /** 空气温度（℃） */
  airTemperature?: number
  /** 空气湿度（%） */
  airHumidity?: number
  /** 土壤温度（℃） */
  soilTemperature?: number
  /** 土壤湿度（%） */
  soilMoisture?: number
  /** 光照强度（lux） */
  illuminance?: number
  /** 二氧化碳浓度（ppm） */
  co2?: number
  /** 降雨量（mm） */
  rainfall?: number
  /** 数据来源：1 物联网设备 2 人工录入 3 气象站 */
  source: EnvDataSource
  /** 采集时间 */
  collectedAt: string
}
