import { http } from '@/utils/request'
import { safeImageUrl } from '@/components/richTextContent'

export const CONTENT_IMAGE_MAX_SIZE = 5 * 1024 * 1024
export function validateContentImage(file: File): void {
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('仅支持 PNG、JPEG 图片，请转换格式后上传')
  if (!file.size) throw new Error('图片文件为空，请重新选择')
  if (file.size > CONTENT_IMAGE_MAX_SIZE) throw new Error('单张图片不能超过5MB，请压缩后上传')
}

/** 上传入口独立翻译网络/网关错误，不向用户展示英文Axios错误或HTML错误页。 */
export function contentImageUploadError(error: unknown): string {
  const failure = error as { httpStatus?: number; bizCode?: number; code?: string; message?: string; response?: { status?: number; data?: { message?: string } } } | null
  const status = failure?.httpStatus ?? failure?.response?.status ?? failure?.bizCode
  const reason = failure?.response?.data?.message ?? failure?.message
  if (status === 401 || reason === '登录已失效，请重新登录') return '登录已失效，请重新登录后上传'
  if (status === 403) return '当前账号没有正文图片上传权限，请联系管理员'
  if (status === 413) return '单张图片不能超过5MB，请压缩后上传'
  if (status === 415) return '图片或上传请求格式不支持，请选择PNG、JPEG图片重新上传'
  if (status === 429) return '上传过于频繁，请稍候再试'
  if (status === 502 || status === 504) return '图片上传服务暂时无法响应，请稍后重试'
  if (status === 503) return '图片存储服务暂不可用，请稍后重试；正文内容已保留'
  if (status && status >= 500) return '图片上传服务异常，请稍后重试；正文内容已保留'
  if (status === 404) return '图片上传接口暂不可用，请刷新页面后重试'
  if (status === 400 || status === 422) return reason && /[\u4e00-\u9fff]/.test(reason) ? reason : '图片无效或上传参数不完整，请重新选择图片'
  if (failure?.code === 'ECONNABORTED' || failure?.code === 'ETIMEDOUT') return '图片上传超时，请检查网络后重试；本次图片尚未插入正文'
  if (failure?.code === 'ERR_NETWORK' || (typeof navigator !== 'undefined' && !navigator.onLine)) return '网络连接失败，请检查网络后重新上传；正文内容已保留'
  return '图片上传失败，请稍后重试；正文内容已保留'
}

/** 统一正文附件入口：复用生产请求的鉴权、刷新令牌和错误处理。 */
export async function uploadContentImage(file: File): Promise<string> {
  validateContentImage(file)
  const data = new FormData()
  data.append('file', file)
  let result: { url: string }
  try {
    result = await http.post<{ url: string }>('/admin/knowledge/images', data, {
      headers: { 'Content-Type': undefined }, timeout: 60000, silent: true,
    })
  } catch (error) { throw new Error(contentImageUploadError(error)) }
  const url = safeImageUrl(result?.url)
  if (!url) throw new Error('上传响应缺少有效图片地址，本次图片尚未插入，请重试')
  return url
}
