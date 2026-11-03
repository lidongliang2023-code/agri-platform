/**
 * 农场 / 地块 / 土壤档案 实体类型
 */
import type { EnableStatus } from '@agri/shared/types/common'

/** 农场类型：1 种植 2 养殖 3 混合 */
export type FarmType = 1 | 2 | 3

/** 农场 */
export interface Farm {
  /** 农场 ID */
  farmId: string
  /** 农场编码 */
  farmCode: string
  /** 农场名称 */
  farmName: string
  /** 农场类型：1 种植 2 养殖 3 混合 */
  farmType: FarmType
  /** 所属租户 ID */
  tenantId: string
  /** 省份 */
  province: string
  /** 城市 */
  city: string
  /** 区县 */
  district: string
  /** 详细地址 */
  address: string
  /** 总面积（亩） */
  areaTotal: number
  /** 负责人姓名 */
  managerName: string
  /** 负责人电话 */
  managerPhone: string
  /** 经度 */
  longitude?: number
  /** 纬度 */
  latitude?: number
  /** 状态：1 正常 0 停用 */
  status: EnableStatus
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 地块种植类型：1 露天 2 大棚 3 水田 4 山地 */
export type PlantingType = 1 | 2 | 3 | 4

/** 地块状态：1 空闲 2 在种 3 采收期 4 休耕 0 停用 */
export type PlotStatus = 0 | 1 | 2 | 3 | 4

/** 地块 */
export interface Plot {
  /** 地块 ID */
  plotId: string
  /** 地块编码 */
  plotCode: string
  /** 地块名称 */
  plotName: string
  /** 所属农场 ID */
  farmId: string
  /** 所属农场名称（冗余） */
  farmName?: string
  /** 农场编码（后端 farm_code） */
  farmCode?: string
  /** 地块形状（后端 shape） */
  shape?: string
  /** 面积（亩） */
  area: number
  /**
   * 种植类型：1 露天 2 大棚 3 水田 4 山地。
   *
   * <p>2026-10-19 起有真实列 `planting_type`（补列前建的存量行为 NULL，页面显示「—」）。
   * 仍保持可选：历史数据确实没有值，调用方要按"缺失即不显示"处理，
   * 不能像以前那样用默认值 1 把整片农场都说成「露天」。</p>
   */
  plantingType?: PlantingType
  /** 土壤类型 */
  soilType: string
  /** 土壤 pH（后端 soil_ph，详情更新时必须回传，否则整表提交会清空） */
  soilPh?: number
  /** 土壤有机质（后端 soil_organic_matter，详情更新时必须回传） */
  soilOrganicMatter?: number
  /** 灌溉方式 */
  irrigationType: string
  /** 种植日期（后端 planting_date，详情更新时必须回传） */
  plantingDate?: string
  /** 预计采收日期（后端 expected_harvest_date，详情更新时必须回传） */
  expectedHarvestDate?: string
  /** 备注（后端 remark，详情更新时必须回传） */
  remark?: string
  /** 当前作物 ID */
  cropId?: string
  /**
   * 当前作物名称（地块列表 / 详情「当前作物」显示的就是它）。
   *
   * <p>与 {@link cropId} 成对：名称给页面直接显示，ID 用来关联作物主数据（{@code agri_prod_crop_info}）。
   * 历史行可能只有名称没有 ID（作物做成主数据之前登记的）。</p>
   */
  currentCrop?: string
  /** 当前作物品种 */
  cropVariety?: string
  /** 当前种养计划 ID */
  currentPlanId?: string
  /** 地块边界 GeoJSON 字符串 */
  geoBoundary?: string
  /** 地块边界 GeoJSON（后端真实列 `boundary`；与 geoBoundary 并存，前者是历史自造键） */
  boundary?: string
  /** 地块中心经度（后端 `center_longitude`） */
  centerLongitude?: number
  /** 地块中心纬度（后端 `center_latitude`） */
  centerLatitude?: number
  /** 状态：1 空闲 2 在种 3 采收期 4 休耕 0 停用 */
  status: PlotStatus
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 种植标准：ORGANIC 有机 / GREEN 绿色 / NORMAL 普通 */
export type PlantingStandard = 'ORGANIC' | 'GREEN' | 'NORMAL'

/** 地块品种的种植方式：TRANSPLANT 移栽 / DIRECT 直播 */
export type PlotPlantingMethod = 'TRANSPLANT' | 'DIRECT'

/** 地块品种的作业方式：MANUAL 人工 / MECHANICAL 机械 */
export type PlotOperationMethod = 'MANUAL' | 'MECHANICAL'

/**
 * 地块种养品种（一个地块可登记多个）。
 *
 * <p>与地块上的 `currentCrop / cropId / cropVariety` 是两层口径：地块字段是「当前作物」单值，
 * 列表与计划用它显示；本台账负责详情页的多品种明细（种类、品种、种植标准、种植/作业方式、
 * 移栽时间、预计采收、预计亩产、株数、株间距）。</p>
 */
export interface PlotCrop {
  /** 品种记录 ID（页面 cropRecordId） */
  cropRecordId: string
  /** 所属地块 ID */
  plotId: string
  /** 作物主数据 ID（后端 Long，JSON 为数字） */
  cropId?: number | string
  /** 作物名称（种类） */
  cropName: string
  /** 品种 */
  cropVariety?: string
  /** 种植标准 */
  plantingStandard?: PlantingStandard
  /** 种植方式 */
  plantingMethod?: PlotPlantingMethod
  /** 作业方式 */
  operationMethod?: PlotOperationMethod
  /** 移栽时间 YYYY-MM-DD */
  transplantDate?: string
  /** 预计采收时间 YYYY-MM-DD */
  expectedHarvestDate?: string
  /** 预计亩产（公斤/亩） */
  expectedYieldPerMu?: number
  /** 株数 */
  plantCount?: number
  /** 株间距（cm） */
  plantSpacing?: number
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

/** 土壤检测档案 */
export interface SoilTestRecord {
  /** 记录 ID */
  recordId: string
  /** 地块 ID */
  plotId: string
  /** 检测日期 */
  testDate: string
  /** pH 值 */
  ph: number
  /** 有机质含量（g/kg） */
  organicMatter: number
  /** 全氮含量（g/kg） */
  totalNitrogen: number
  /** 有效磷（mg/kg） */
  availablePhosphorus: number
  /** 速效钾（mg/kg） */
  availablePotassium: number
  /** 土壤含水量（%） */
  moisture: number
  /** 电导率（mS/cm） */
  conductivity?: number
  /** 检测机构 */
  testOrg?: string
  /** 检测报告附件地址 */
  reportUrl?: string
  /** 检测结论 */
  conclusion?: string
  /** 创建时间 */
  createdAt: string
}

/**
 * 地块状态展示元数据。
 *
 * 全局唯一定义（原在 FarmDetail / PlotDetail / PlotList 各存一份，已收敛到此处）。
 * 取值与 {@link PlotStatus} 对齐：0 已停用 1 空闲 2 在种 3 采收期 4 休耕。
 */
export const PLOT_STATUS_META: Record<number, { label: string; color: string }> = {
  0: { label: '已停用', color: 'default' },
  1: { label: '空闲', color: 'blue' },
  2: { label: '在种', color: 'green' },
  3: { label: '采收期', color: 'orange' },
  4: { label: '休耕', color: 'gold' },
}

/**
 * 作物 emoji 映射（原型 P2 地块卡 / P4 列表共用）。
 *
 * 全局唯一定义（原在 FarmDetail / PlotList 各存一份，已收敛到此处）。
 * 未登记的作物回退 🌱。
 */
export const CROP_EMOJI_MAP: Record<string, string> = {
  番茄: '🍅',
  黄瓜: '🥒',
  辣椒: '🌶️',
  茄子: '🍆',
  白菜: '🥬',
  水稻: '🌾',
  玉米: '🌽',
  苹果: '🍎',
}

/** 农场资质证照类型：GREEN 绿色食品 / ORGANIC 有机产品 / GEO 地理标志 / HACCP 体系认证 */
export type FarmCertType = 'GREEN' | 'ORGANIC' | 'GEO' | 'HACCP'

/** 农场资质证照状态：0 作废 1 有效 2 临期 3 过期 */
export type FarmCertStatus = 0 | 1 | 2 | 3

/**
 * 农场资质证照（对齐后端 FarmCertEntity）
 *
 * 注意：字段名以**后端实体命名**为准（`issueDate` / `expireDate` / `certNo` …），
 * 不要与 `SoilTestRecord` 的 `testDate` / `testOrg` 那套命名混用。
 */
export interface FarmCert {
  /** 证照 ID */
  certId: string
  /** 农场 ID */
  farmId: string
  /** 证照类型 */
  certType: FarmCertType
  /** 证照名称 */
  certName: string
  /** 证书编号 */
  certNo: string
  /** 发证机构 */
  issuer?: string
  /** 发证日期 YYYY-MM-DD（LocalDate） */
  issueDate?: string
  /** 有效期至 YYYY-MM-DD（LocalDate） */
  expireDate?: string
  /** 附件地址 */
  attachUrl?: string
  /** 状态：0 作废 1 有效 2 临期 3 过期 */
  status: FarmCertStatus
  /** 创建时间 */
  createdAt?: string
}
