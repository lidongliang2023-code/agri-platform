import { parseImportCsv } from './import-csv'

/** 只在选择 Excel 或下载模板时加载解析库。 */
async function excelModule() {
  const module = await import('exceljs')
  return module.default
}

export async function parseImportExcel(data: ArrayBuffer, maxRows = 200): Promise<Record<string, string>[]> {
  const ExcelJS = await excelModule()
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(data as Parameters<typeof workbook.xlsx.load>[0])
  } catch {
    throw new Error('无法读取 Excel，请使用未加密的 .xlsx 文件；旧版 .xls 请另存为 .xlsx')
  }
  const sheets = workbook.worksheets.filter(sheet => sheet.actualRowCount > 0)
  if (sheets.length !== 1) throw new Error('Excel 必须且只能包含一个有数据的工作表，请删除其他数据工作表')
  const sheet = sheets[0]
  if (sheet.rowCount > maxRows + 1) throw new Error(`Excel 最多 ${maxRows} 条数据，请删除多余行（含空白格式行）后重试`)
  if (sheet.columnCount > 100) throw new Error('Excel 列数超过限制，请使用下载的模板')
  const matrix: string[][] = []
  for (let rowIndex = 1; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex)
    const values: string[] = []
    for (let column = 1; column <= sheet.columnCount; column++) {
      const cell = row.getCell(column)
      if (cell.isMerged) throw new Error(`第 ${rowIndex} 行含合并单元格，请取消合并后重试`)
      const value = cell.value
      if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
        throw new Error(`第 ${rowIndex} 行第 ${column} 列含公式，请粘贴为文本或数值后导入`)
      }
      if (value && typeof value === 'object' && 'error' in value) throw new Error(`第 ${rowIndex} 行第 ${column} 列为错误值`)
      if (value instanceof Date) throw new Error(`第 ${rowIndex} 行第 ${column} 列为日期，请按模板要求改为文本`)
      // 使用显示文本保留手机号、行政区代码等带前导零的数据。
      values.push((value === null || value === undefined ? '' : cell.text).trim())
    }
    matrix.push(values)
  }
  while (matrix.length && !matrix[matrix.length - 1].some(Boolean)) matrix.pop()
  if (matrix.length < 2) throw new Error('文件为空或没有数据行')
  let width = matrix[0].length
  while (width > 0 && matrix.every(row => !row[width - 1])) width--
  for (let index = 0; index < matrix.length; index++) {
    matrix[index] = matrix[index].slice(0, width)
    if (!matrix[index].some(Boolean)) throw new Error(`第 ${index + 1} 行为空，请删除中间空行后重试`)
  }
  const csv = matrix.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n')
  return parseImportCsv(csv, maxRows)
}

export async function downloadImportExcel(name: string, headers: string[]): Promise<void> {
  const ExcelJS = await excelModule()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('导入数据', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF23744C' } }
  sheet.getRow(1).height = 26
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).width = 22
    sheet.getColumn(index + 1).numFmt = '@'
  })
  const bytes = await workbook.xlsx.writeBuffer()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
