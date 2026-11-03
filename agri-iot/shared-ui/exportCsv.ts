/**
 * 报表导出（web 与 ops 共用）。
 *
 * 之前两个"导出报表"按钮点了只弹一句"已导出"，浏览器里什么文件都没有。
 * 这里把当前页面已经加载的数据真正落成 CSV：带 BOM，Excel 打开中文不乱码。
 */
export interface CsvColumn<T> {
  key: keyof T & string
  title: string
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // 制表符/公式前缀会被 Excel 当作公式执行，导出前先中和掉
  const neutralized = text.replace(/^[=+\-@\t]/, ' $&')
  return `"${neutralized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

export function buildCsv<T extends Record<string, unknown>>(
  columns: Array<CsvColumn<T>>,
  rows: T[],
): string {
  const head = columns.map((column) => cell(column.title)).join(',')
  const body = rows.map((row) => columns.map((column) => cell(row[column.key])).join(','))
  return [head, ...body].join('\r\n')
}

/** 触发浏览器下载，返回导出的行数（供页面提示"已导出 N 行"）。 */
const EXPORT_BOM = String.fromCharCode(0xfeff)


export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  columns: Array<CsvColumn<T>>,
  rows: T[],
): number {
  const blob = new Blob([EXPORT_BOM + buildCsv(columns, rows)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return rows.length
}

/** 导出文件名带上当次时间，避免多次导出互相覆盖。 */
export function stampFilename(prefix: string): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}.csv`
}
