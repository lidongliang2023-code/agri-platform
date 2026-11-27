export function localDate(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise(resolve => uni.showModal({ title, content,
    success: result => resolve(Boolean(result.confirm)), fail: () => resolve(false),
  }))
}
