/**
 * 农场批量导入：模板生成 / CSV 解析 / 逐行校验。
 *
 * <p>页面侧（FarmList）只负责交互与提交，字段口径与「新增农场」表单保持一致：</p>
 * - 必填：农场名称、农场类型、省份、城市、区县、详细地址、面积、负责人、联系电话；
 * - 农场类型取值与表单的六项业务类型一致；
 * - 后端 `FarmInfoEntity` 没有海拔 / 简介 / 业务类型列，与表单一样序列化进 `remark`
 *   （`海拔:35m；产业类型:蔬菜种植；简介:xxx`），列表页按同一格式回读。
 *
 * <p>模板是 UTF-8 BOM 的 CSV，Excel 可直接打开编辑；用户另存为 CSV 时中文版 Excel
 * 默认落 GBK，因此解析时先按 UTF-8 解码，出现替换符再回退 GBK。</p>
 */
import type { FarmPayload } from '@/api/farms'

/** 模板列（顺序即 CSV 列顺序） */
export const FARM_IMPORT_COLUMNS: string[] = [
  '农场名称',
  '农场类型',
  '省份',
  '城市',
  '区县',
  '详细地址',
  '面积（亩）',
  '海拔（米）',
  '负责人',
  '联系电话',
  '农场简介',
]

/** 农场业务类型选项（与新增农场表单的 radio 一致） */
export const FARM_TYPE_BUSINESS_OPTIONS: string[] = [
  '蔬菜种植',
  '水稻种植',
  '果树种植',
  '综合养殖',
  '畜牧养殖',
  '水产养殖',
]

/** 业务类型 → 后端 farmType（1 种植 2 养殖 3 混合） */
const BUSINESS_TYPE_VALUE_MAP: Record<string, number> = {
  蔬菜种植: 1,
  水稻种植: 1,
  果树种植: 1,
  综合养殖: 3,
  畜牧养殖: 2,
  水产养殖: 2,
}

/** 联系电话格式（与新增农场表单一致：11 位手机号） */
const MOBILE_PATTERN = /^1[3-9]\d{9}$/

/** 农场名称长度（与新增农场表单一致） */
const FARM_NAME_MIN_LENGTH = 2
const FARM_NAME_MAX_LENGTH = 50

/** 单行导入值（已按模板列归位，未做类型转换） */
export interface FarmImportValues {
  /** 农场名称 */
  farmName: string
  /** 农场类型（六项业务类型之一） */
  farmTypeLabel: string
  /** 省份 */
  province: string
  /** 城市 */
  city: string
  /** 区县 */
  district: string
  /** 详细地址 */
  address: string
  /** 面积（亩） */
  area: string
  /** 海拔（米） */
  altitude: string
  /** 负责人 */
  managerName: string
  /** 联系电话 */
  managerPhone: string
  /** 农场简介 */
  profile: string
}

/** 解析后的单行结果 */
export interface FarmImportRow {
  /** 文件中的行号（含表头，从 2 开始，便于用户定位） */
  rowNumber: number
  /** 原始字段值 */
  values: FarmImportValues
  /** 校验错误；为空才允许导入 */
  errors: string[]
  /** 校验通过后的提交体 */
  payload?: FarmPayload
}

/** 文件解析结果 */
export interface FarmImportParseResult {
  /** 数据行（含校验结果） */
  rows: FarmImportRow[]
  /** 表头级错误（如缺少必填列） */
  headerErrors: string[]
}

/** 空字段模板 */
function emptyValues(): FarmImportValues {
  return {
    farmName: '',
    farmTypeLabel: '',
    province: '',
    city: '',
    district: '',
    address: '',
    area: '',
    altitude: '',
    managerName: '',
    managerPhone: '',
    profile: '',
  }
}

/**
 * 表头别名 → 内部字段。
 *
 * <p>键是「去空格、去星号、全角括号转半角、转小写」后的表头，值是对应字段。
 * 用户稍改模板列名（如「面积」而不是「面积（亩）」）也能识别。</p>
 */
const HEADER_ALIASES: Record<string, keyof FarmImportValues> = {
  农场名称: 'farmName',
  农场名: 'farmName',
  农场类型: 'farmTypeLabel',
  产业类型: 'farmTypeLabel',
  省份: 'province',
  省: 'province',
  城市: 'city',
  市: 'city',
  区县: 'district',
  '区/县': 'district',
  区: 'district',
  详细地址: 'address',
  地址: 'address',
  '面积(亩)': 'area',
  面积: 'area',
  '总面积(亩)': 'area',
  总面积: 'area',
  '海拔(米)': 'altitude',
  海拔: 'altitude',
  负责人: 'managerName',
  负责人姓名: 'managerName',
  联系电话: 'managerPhone',
  手机号: 'managerPhone',
  电话: 'managerPhone',
  农场简介: 'profile',
  简介: 'profile',
}

/**
 * 生成 CSV 导入模板内容。
 *
 * <p>带 UTF-8 BOM（Excel 打开不乱码）+ CRLF；只放表头，不放示例行，
 * 避免用户忘记删除示例数据而导入一条假农场。</p>
 *
 * @returns CSV 文本
 */
export function buildFarmImportTemplate(): string {
  return `\uFEFF${FARM_IMPORT_COLUMNS.map(escapeCsvCell).join(',')}\r\n`
}

/**
 * 触发浏览器下载农场导入模板。
 */
export function downloadFarmImportTemplate(): void {
  const blob = new Blob([buildFarmImportTemplate()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '农场导入模板.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 读取并解析用户选择的 CSV 文件。
 *
 * @param file 用户上传的文件
 * @returns 逐行校验结果
 * @throws 文件无法解码时抛出
 */
export async function parseFarmImportFile(file: File): Promise<FarmImportParseResult> {
  const buffer = await file.arrayBuffer()
  const text = decodeCsvBuffer(buffer)
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return { rows: [], headerErrors: ['文件内容为空'] }
  }

  const headerRow = rows[0]
  const fields: Partial<Record<keyof FarmImportValues, number>> = {}
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)]
    if (key && fields[key] === undefined) fields[key] = index
  })

  const headerErrors: string[] = []
  if (fields.farmName === undefined) headerErrors.push('缺少「农场名称」列')
  if (fields.farmTypeLabel === undefined) headerErrors.push('缺少「农场类型」列')

  const valuesList = rows.slice(1).map((cells, index) => {
    const values = emptyValues()
    ;(Object.keys(values) as (keyof FarmImportValues)[]).forEach((key) => {
      const columnIndex = fields[key]
      values[key] = columnIndex === undefined ? '' : (cells[columnIndex] ?? '').trim()
    })
    return { rowNumber: index + 2, values }
  })

  const nameSeen = new Map<string, number>()
  const resultRows: FarmImportRow[] = valuesList.map(({ rowNumber, values }) => {
    const errors = validateRow(values)
    const duplicateKey = values.farmName.trim().toLowerCase()
    if (duplicateKey) {
      const firstRow = nameSeen.get(duplicateKey)
      if (firstRow !== undefined) {
        errors.push(`农场名称与第 ${firstRow} 行重复`)
      } else {
        nameSeen.set(duplicateKey, rowNumber)
      }
    }
    return {
      rowNumber,
      values,
      errors,
      payload: errors.length === 0 ? toPayload(values) : undefined,
    }
  })

  return { rows: resultRows, headerErrors }
}

/**
 * 解析单行并生成提交体。
 *
 * @param values 单行原始值
 * @returns 校验错误列表
 */
function validateRow(values: FarmImportValues): string[] {
  const errors: string[] = []
  const farmName = values.farmName.trim()
  if (!farmName) {
    errors.push('农场名称为空')
  } else if (farmName.length < FARM_NAME_MIN_LENGTH || farmName.length > FARM_NAME_MAX_LENGTH) {
    errors.push(`农场名称需为 ${FARM_NAME_MIN_LENGTH}-${FARM_NAME_MAX_LENGTH} 个字符`)
  }

  const farmType = values.farmTypeLabel.trim()
  if (!farmType) {
    errors.push('农场类型为空')
  } else if (!FARM_TYPE_BUSINESS_OPTIONS.includes(farmType)) {
    errors.push(`农场类型需为：${FARM_TYPE_BUSINESS_OPTIONS.join(' / ')}`)
  }

  if (!values.province.trim()) errors.push('省份为空')
  if (!values.city.trim()) errors.push('城市为空')
  if (!values.district.trim()) errors.push('区县为空')
  if (!values.address.trim()) errors.push('详细地址为空')

  const area = parseNumeric(values.area)
  if (values.area.trim() === '') {
    errors.push('面积为空')
  } else if (area === null || area < 0) {
    errors.push('面积需为非负数字（单位：亩）')
  }

  const altitude = values.altitude.trim() === '' ? 0 : parseNumeric(values.altitude)
  if (altitude === null || altitude < 0) {
    errors.push('海拔需为非负数字（单位：米）')
  }

  if (!values.managerName.trim()) errors.push('负责人为空')
  const phone = values.managerPhone.replace(/[\s-]/g, '')
  if (!phone) {
    errors.push('联系电话为空')
  } else if (!MOBILE_PATTERN.test(phone)) {
    errors.push('联系电话需为 11 位手机号')
  }

  if (values.profile.length > 500) errors.push('农场简介不超过 500 字')

  return errors
}

/**
 * 将校验通过的单行转换为后端入参。
 *
 * @param values 单行原始值
 * @returns 农场新增入参
 */
function toPayload(values: FarmImportValues): FarmPayload {
  const altitude = values.altitude.trim() === '' ? undefined : parseNumeric(values.altitude) ?? undefined
  const remarkParts: string[] = []
  if (altitude !== undefined) remarkParts.push(`海拔:${altitude}m`)
  remarkParts.push(`产业类型:${values.farmTypeLabel.trim()}`)
  if (values.profile.trim()) {
    remarkParts.push(`简介:${values.profile.trim().replace(/[；;]/g, '，')}`)
  }
  return {
    farmName: values.farmName.trim(),
    farmType: (BUSINESS_TYPE_VALUE_MAP[values.farmTypeLabel.trim()] ?? 1) as 1 | 2 | 3,
    province: values.province.trim(),
    city: values.city.trim(),
    district: values.district.trim(),
    address: values.address.trim(),
    areaTotal: parseNumeric(values.area) ?? 0,
    managerName: values.managerName.trim(),
    managerPhone: values.managerPhone.replace(/[\s-]/g, ''),
    status: 1,
    remark: remarkParts.join('；'),
  }
}

/**
 * 按 UTF-8 解码；中文版 Excel 另存的 CSV 常是 GBK，出现替换符时回退。
 *
 * @param buffer 文件字节
 * @returns 解码后的文本
 */
function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('gbk').decode(buffer)
}

/**
 * 表头归一化（去 BOM / 空格 / 星号，全角括号转半角，转小写）。
 *
 * @param header 原始表头
 * @returns 归一化后的表头
 */
function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/[*＊]/g, '')
    .toLowerCase()
}

/**
 * 解析 CSV 文本（支持引号包裹、字段内逗号 / 换行、双引号转义、CRLF）。
 *
 * @param text CSV 文本
 * @returns 二维单元格数组，已去掉全空行
 */
function parseCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char === '\r') {
      // CRLF 的 \r 直接跳过；单独 \r 也作为换行
      if (content[index + 1] !== '\n') {
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
      }
    } else {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ''))
}

/**
 * 解析数字，允许带「亩 / 米 / m」单位后缀。
 *
 * @param text 原始文本
 * @returns 数字；非法时返回 null
 */
function parseNumeric(text: string): number | null {
  const cleaned = text.trim().replace(/(亩|米|m)$/i, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * CSV 单元格转义。
 *
 * @param cell 原始值
 * @returns 可安全写入 CSV 的值
 */
function escapeCsvCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
  return cell
}

/** 统一导入组件使用相同的农场字段校验与转换。 */
export function prepareFarmImportRecord(raw: Record<string, string>): { payload?: FarmPayload; errors: string[] } {
  const values = emptyValues()
  for (const [header, value] of Object.entries(raw)) {
    const key = HEADER_ALIASES[normalizeHeader(header)]
    if (key) values[key] = value
  }
  const errors = validateRow(values)
  return { errors, payload: errors.length ? undefined : toPayload(values) }
}
