import DOMPurify from 'dompurify'
import { marked, Renderer } from 'marked'

/** 与生产知识正文接口保持一致，长度包含 HTML 标记。 */
export const CONTENT_LIMIT = 100000
export type ContentFormat = 'auto' | 'html' | 'markdown'

export function safeContentUrl(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(value.trim())
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

/** 仅接受稳定的 HTTP(S) 图片或本站正文附件，不保存 data/blob 地址。 */
export function safeImageUrl(value?: string | null): string | undefined {
  const text = value?.trim()
  if (!text || text.length > 2048) return undefined
  if (/^\/api\/v1\/production\/knowledge-images\/[a-f0-9]{32}\.(png|jpg)$/.test(text)) return text
  return safeContentUrl(text)
}

const renderer = new Renderer()
const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Markdown 历史记录中的原始 HTML 仍作为文字展示。
renderer.html = ({ text }) => escapeHtml(text)
const HTML_BLOCK = /<(?:p|h[1-6]|div|ol|ul|li|blockquote|pre|table|img)(?:\s|>)/i
const TAGS = ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'span', 'div', 'ol', 'ul', 'li', 'blockquote', 'pre', 'code', 'a', 'sub', 'sup', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img']
const safeColor = /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]{1,24})$/i

/** 编辑、粘贴、保存及详情展示使用同一白名单，保留受控图片，不允许脚本、事件或嵌入页面。 */
export function sanitizeRichText(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ['href', 'title', 'style', 'start', 'src', 'alt'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  })
  const template = document.createElement('template')
  template.innerHTML = clean
  template.content.querySelectorAll<HTMLElement>('*').forEach((node) => {
    const safeStyles: string[] = []
    for (const property of ['color', 'background-color', 'text-align', 'font-size']) {
      const value = node.style.getPropertyValue(property).trim()
      const allowed = property === 'text-align' ? /^(left|right|center|justify)$/.test(value)
        : property === 'font-size' ? /^(12|14|16|18|20|24|28|32|36|48)px$/.test(value)
          : safeColor.test(value)
      if (value && allowed) safeStyles.push(`${property}: ${value}`)
    }
    node.removeAttribute('style')
    if (safeStyles.length) node.setAttribute('style', safeStyles.join('; '))
    if (node.tagName === 'IMG') {
      const src = safeImageUrl(node.getAttribute('src'))
      if (!src) { node.remove(); return }
      node.setAttribute('src', src)
      node.setAttribute('alt', (node.getAttribute('alt') ?? '').slice(0, 200))
      node.setAttribute('referrerpolicy', 'no-referrer')
      node.removeAttribute('style')
    } else {
      node.removeAttribute('src'); node.removeAttribute('alt')
    }
    if (node.tagName === 'A') {
      const href = safeContentUrl(node.getAttribute('href'))
      node.removeAttribute('href')
      if (href) {
        node.setAttribute('href', href)
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    }
  })
  return template.innerHTML
}

export function contentHtml(value?: string | null, format: ContentFormat = 'auto'): string {
  if (!value) return ''
  const text = value.replace(/\r\n?/g, '\n')
  if (format === 'html' || (format === 'auto' && HTML_BLOCK.test(text))) return sanitizeRichText(text)
  return sanitizeRichText(marked.parse(text, { async: false, breaks: true, gfm: true, renderer }) as string)
}

export function contentText(value?: string | null, format: ContentFormat = 'auto'): string {
  const template = document.createElement('template')
  template.innerHTML = contentHtml(value, format)
  return (template.content.textContent ?? '').replace(/[\u00a0\u200b-\u200d\ufeff]/g, ' ').trim()
}

export function hasContent(value?: string | null): boolean {
  const html = contentHtml(value)
  return contentText(html, 'html').length > 0 || /<img\s/i.test(html)
}

/** 空段落按空字符串保存，避免 <p><br></p> 绕过必填校验。 */
export function normalizeContent(value?: string | null): string {
  const html = contentHtml(value)
  return hasContent(html) ? html : ''
}
