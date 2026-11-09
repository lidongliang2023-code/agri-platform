/** 完整读取分页快照；失败不返回局部结果。单页大小服从服务端实际返回值。 */
export async function loadCompletePages<T>(
  fetchPage: (params: { pageNum: number; pageSize: number }) => Promise<{
    list: T[]; total: number; pageNum: number; pageSize: number
  }>,
  keyOf: (row: T) => string,
): Promise<{ list: T[]; total: number }> {
  const list: T[] = []
  const seen = new Set<string>()
  let total: number | undefined
  let size = 100
  for (let pageNum = 1; ; pageNum += 1) {
    const page = await fetchPage({ pageNum, pageSize: size })
    const count = Number(page.total)
    const returnedSize = Number(page.pageSize)
    if (!Number.isSafeInteger(count) || count < 0 || Number(page.pageNum) !== pageNum ||
        !Number.isSafeInteger(returnedSize) || returnedSize <= 0 || !Array.isArray(page.list)) {
      throw new Error('分页响应异常，请刷新后重试')
    }
    if (total !== undefined && (count !== total || returnedSize !== size)) {
      throw new Error('加载期间数据发生变化，请刷新后重试')
    }
    total = count
    size = returnedSize
    for (const row of page.list) {
      const key = keyOf(row)
      if (!key || seen.has(key)) throw new Error('分页记录缺失或重复，请刷新后重试')
      seen.add(key)
      list.push(row)
    }
    if (list.length > total) throw new Error('分页总数不一致，请刷新后重试')
    if (list.length === total) return { list, total }
    if (page.list.length !== size) throw new Error('分页数据不完整，请刷新后重试')
  }
}
