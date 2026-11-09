export function parseImportCsv(text: string, maxRows = 200): Record<string, string>[] {
  const matrix: string[][] = []
  let row: string[] = [], cell = '', quoted = false, closed = false
  const input = text.replace(/^\uFEFF/, '')
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false }
  const pushRow = () => {
    pushCell()
    if (row.some(Boolean)) matrix.push(row)
    row = []
    if (matrix.length > maxRows + 1) throw new Error(`单次最多导入 ${maxRows} 条记录`)
  }
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') { quoted = false; closed = true }
      else cell += ch
    } else if (ch === '"') {
      if (cell.trim() || closed) throw new Error('CSV 引号格式错误')
      cell = ''; quoted = true
    } else if (ch === ',') pushCell()
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && input[i + 1] === '\n') i++; pushRow() }
    else if (closed && ch.trim()) throw new Error('CSV 引号闭合后存在非法字符')
    else if (!closed) cell += ch
  }
  if (quoted) throw new Error('CSV 存在未闭合引号')
  if (cell || row.length || closed) pushRow()
  if (matrix.length < 2) throw new Error('文件为空或没有数据行')
  const headers = matrix.shift()!
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('表头不能为空或重复')
  return matrix.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`第 ${index + 2} 行列数与表头不一致`)
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]))
  })
}

export function downloadImportCsv(name: string, headers: string[], rows: string[][]): void {
  const escape = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const blob = new Blob(['\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
