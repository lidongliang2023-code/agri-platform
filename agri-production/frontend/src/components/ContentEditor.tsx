import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Segmented, Space, Typography } from 'antd'
import { RedoOutlined, UndoOutlined, UploadOutlined } from '@ant-design/icons'
import Quill, { Delta } from 'quill'
import 'quill/dist/quill.snow.css'
import './ContentEditor.css'
import { CONTENT_LIMIT, contentHtml, contentText, normalizeContent, safeContentUrl, safeImageUrl, hasContent } from './richTextContent'
import { uploadContentImage, validateContentImage } from '@/api/content-images'
import type { ContentFormat } from './richTextContent'
export { CONTENT_LIMIT, hasContent, normalizeContent, safeContentUrl } from './richTextContent'

// 使用行内样式存储，详情不依赖编辑器内部 class，复制与再次编辑均保留排版。
for (const name of ['align', 'color', 'background']) Quill.register(`formats/${name}`, Quill.import(`attributors/style/${name}`), true)
const SizeStyle = Quill.import('attributors/style/size') as { whitelist: string[] }
SizeStyle.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']
Quill.register('formats/size', SizeStyle, true)
const FORMATS = ['header', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'list', 'blockquote', 'code-block', 'link', 'script', 'image']

/** 所有富文本详情、编辑预览及历史 Markdown 使用统一安全渲染。 */
export function ContentPreview({ value, format = 'auto', emptyText = '暂无正文' }: {
  value?: string | null; format?: ContentFormat; emptyText?: string
}): JSX.Element {
  const html = useMemo(() => contentHtml(value, format), [value, format])
  if (!hasContent(html)) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
  return <div className="production-rich-content" dangerouslySetInnerHTML={{ __html: html }} />
}

export type ContentEditorProps = {
  value?: string | null
  onChange?: (value: string) => void
  disabled?: boolean
  onUploadingChange?: (uploading: boolean) => void
  id?: string
  placeholder?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
}

type Selection = { index: number; length: number }

/** 表单受控富文本组件：输出经过清理的 HTML，可直接保存至 content 字段。 */
export default function ContentEditor({ value, onChange, disabled = false, onUploadingChange, id, placeholder = '请输入正文，可粘贴文字并使用上方工具栏排版。', ...aria }: ContentEditorProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value ?? '')
  const disabledRef = useRef(disabled)
  const lastValue = useRef(value ?? '')
  const selection = useRef<Selection | null>(null)
  onChangeRef.current = onChange
  valueRef.current = value ?? ''
  disabledRef.current = disabled
  const [mode, setMode] = useState<string | number>('编辑')
  const [error, setError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState('')
  const [imageOpen, setImageOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [uploading, setUploading] = useState(false)
  const busy = useRef(false)
  const uploadChanged = useRef(onUploadingChange)
  uploadChanged.current = onUploadingChange
  const fileInput = useRef<HTMLInputElement>(null)
  const text = value ?? ''

  const insertImage = (quill: Quill, src: string, alt: string, range: Selection | null) => {
    const index = Math.min(range?.index ?? quill.getLength() - 1, quill.getLength() - 1)
    const image = document.createElement('img')
    image.setAttribute('src', src); image.setAttribute('alt', alt.slice(0, 200))
    if (normalizeContent(quill.getSemanticHTML()).length + image.outerHTML.length + 50 > CONTENT_LIMIT) {
      throw new Error('插入图片后正文超过100000字符，请缩减正文')
    }
    const enabled = quill.isEnabled()
    quill.history.cutoff()
    // 上传时输入锁定，仅在同步插入时启用，写入同一次撤销记录。
    quill.enable(true)
    try {
      quill.updateContents(new Delta().retain(Math.max(0, index)).insert({ image: src }, { alt: alt.slice(0, 200) }), 'user')
      quill.history.cutoff()
      quill.setSelection(Math.max(0, index) + 1, 0, 'silent')
    } finally { quill.enable(enabled) }
  }
  const uploadImages = async (quill: Quill, files: File[], range: Selection | null) => {
    if (busy.current || disabledRef.current || !quill.isEnabled()) return
    try {
      files.forEach(file => {
        try { validateContentImage(file) } catch (e) { throw new Error(`「${file.name}」：${(e as Error).message}`) }
      })
    } catch (e) { setError((e as Error).message); return }
    let inserted = 0
    let failedFile = ''
    busy.current = true; setUploading(true); uploadChanged.current?.(true); setError('')
    quill.enable(false)
    try {
      let current = range
      for (const file of files) {
        failedFile = file.name
        const url = await uploadContentImage(file)
        if (editor.current !== quill) return
        insertImage(quill, url, file.name, current)
        inserted += 1
        current = quill.getSelection()
      }
      setImageOpen(false)
    } catch (e) {
      if (editor.current === quill) setError(`「${failedFile}」：${(e as Error).message}。${inserted ? `已插入${inserted}张图片，剩余${files.length - inserted}张未插入，请仅重试未插入的图片。` : '本次图片未插入，原正文已保留。'}`)
    }
    finally {
      busy.current = false
      if (editor.current === quill) { setUploading(false); uploadChanged.current?.(false); quill.enable(!disabledRef.current) }
    }
  }

  useEffect(() => {
    const container = host.current
    if (!container) return
    const mount = document.createElement('div')
    container.appendChild(mount)
    const quill = new Quill(mount, {
      theme: 'snow', bounds: container, readOnly: disabledRef.current, placeholder,
      formats: FORMATS,
      modules: {
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }, { size: SizeStyle.whitelist }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }],
            ['blockquote', 'code-block', 'link', 'image', 'clean'],
          ],
          handlers: { link: (active: boolean) => {
            if (disabledRef.current) return
            if (!active) { quill.format('link', false, 'user'); return }
            selection.current = quill.getSelection(true)
            const current = quill.getFormat(selection.current ?? undefined).link
            setLinkValue(typeof current === 'string' ? current : '')
            setLinkError(''); setLinkOpen(true)
          }, image: () => {
            if (disabledRef.current || busy.current) return
            selection.current = quill.getSelection(true)
            setImageUrl(''); setImageAlt(''); setError(''); setImageOpen(true)
          } },
        },
        history: { delay: 600, maxStack: 100, userOnly: true },
        uploader: { mimetypes: ['image/png', 'image/jpeg'], handler: (range: Selection, files: File[]) => { void uploadImages(quill, files, range) } },
      },
    })
    editor.current = quill
    // 在Quill按MIME过滤前接管文件，避免不支持的粘贴/拖拽文件被静默忽略。
    const receiveFiles = (event: ClipboardEvent | DragEvent) => {
      const transfer = 'clipboardData' in event ? event.clipboardData : event.dataTransfer
      const files = Array.from(transfer?.files ?? [])
      if (!files.length) return
      event.preventDefault(); event.stopImmediatePropagation()
      void uploadImages(quill, files, quill.getSelection() ?? selection.current)
    }
    quill.root.addEventListener('paste', receiveFiles, true)
    quill.root.addEventListener('drop', receiveFiles, true)
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      // 粘贴时由 Quill 格式白名单与保存清理器共同收口。
      if (node instanceof Element && ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG'].includes(node.tagName)) return delta.slice(0, 0)
      if (node instanceof HTMLImageElement && !safeImageUrl(node.getAttribute('src'))) return delta.slice(0, 0)
      return delta
    })
    quill.setContents(quill.clipboard.convert({ html: contentHtml(valueRef.current) }), 'silent')
    quill.history.clear()
    lastValue.current = valueRef.current
    const labels: Record<string, string> = { header: '标题层级', size: '字号', bold: '加粗（Ctrl+B）', italic: '斜体（Ctrl+I）', underline: '下划线（Ctrl+U）', strike: '删除线', color: '文字颜色', background: '背景颜色', list: '列表', align: '段落对齐', blockquote: '引用', 'code-block': '代码块', link: '插入或编辑链接', image: '插入图片', clean: '清除格式' }
    container.querySelectorAll<HTMLElement>('.ql-toolbar button, .ql-toolbar .ql-picker').forEach((element) => {
      const key = Object.keys(labels).find((name) => element.classList.contains(`ql-${name}`))
      if (!key) return
      const label = key === 'list' ? (element.getAttribute('value') === 'ordered' ? '有序步骤' : '无序列表') : labels[key]
      element.title = label; element.setAttribute('aria-label', label)
    })
    container.querySelectorAll<HTMLButtonElement>('.ql-toolbar button').forEach((button) => { button.type = 'button' })
    const change = (_delta: unknown, old: ReturnType<Quill['getContents']>, source: string) => {
      if (source !== 'user') return
      const html = normalizeContent(quill.getSemanticHTML())
      if (html.length > CONTENT_LIMIT) {
        const range = quill.getSelection()
        quill.setContents(old, 'silent')
        if (range) quill.setSelection(Math.min(range.index, Math.max(0, quill.getLength() - 1)), 0, 'silent')
        setError('正文（含格式标记）最多100000个字符，本次超长输入未写入。')
        return
      }
      setError(''); lastValue.current = html; onChangeRef.current?.(html)
    }
    quill.on('text-change', change)
    return () => {
      quill.off('text-change', change)
      quill.root.removeEventListener('paste', receiveFiles, true)
      quill.root.removeEventListener('drop', receiveFiles, true)
      quill.disable()
      uploadChanged.current?.(false)
      editor.current = null
      container.replaceChildren()
    }
  }, [placeholder])

  useEffect(() => {
    const quill = editor.current
    if (!quill || text === lastValue.current) return
    quill.setContents(quill.clipboard.convert({ html: contentHtml(text) }), 'silent')
    quill.history.clear()
    lastValue.current = text
    setError('')
  }, [text])
  useEffect(() => {
    const quill = editor.current
    if (!quill) return
    quill.enable(!disabled && !uploading && mode !== '预览')
    quill.root.setAttribute('aria-label', '正文编辑区')
    quill.root.setAttribute('role', 'textbox')
    quill.root.setAttribute('aria-multiline', 'true')
    if (id) quill.root.id = id
    for (const attribute of ['aria-describedby', 'aria-invalid'] as const) {
      const val = aria[attribute]
      if (val === undefined) quill.root.removeAttribute(attribute)
      else quill.root.setAttribute(attribute, String(val))
    }
    host.current?.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('.ql-toolbar button, .ql-toolbar select').forEach((control) => { control.disabled = disabled || uploading || mode === '预览' })
  }, [disabled, uploading, mode, id, aria['aria-describedby'], aria['aria-invalid']])

  const applyLink = () => {
    const quill = editor.current
    const href = safeContentUrl(linkValue)
    if (!href) { setLinkError('请输入完整的 HTTP 或 HTTPS 链接'); return }
    if (!quill || disabled) return
    const range = selection.current ?? { index: quill.getLength() - 1, length: 0 }
    if (range.length) {
      quill.setSelection(range, 'silent'); quill.format('link', href, 'user')
    } else {
      quill.insertText(range.index, href, { link: href }, 'user')
      quill.setSelection(Math.min(range.index + href.length, quill.getLength() - 1), 0, 'silent')
    }
    setLinkOpen(false)
  }
  return <div className={`production-content-editor${disabled ? ' is-disabled' : ''}`}>
    <div className="production-content-editor-heading"><Space wrap><Typography.Text strong>富文本正文</Typography.Text><Segmented aria-label="正文显示模式" value={mode} disabled={uploading} onChange={setMode} options={['编辑', '分屏', '预览']} /></Space><Space><Button size="small" aria-label="撤销" icon={<UndoOutlined />} disabled={disabled || uploading || mode === '预览'} onClick={() => editor.current?.history.undo()}>撤销</Button><Button size="small" aria-label="重做" icon={<RedoOutlined />} disabled={disabled || uploading || mode === '预览'} onClick={() => editor.current?.history.redo()}>重做</Button></Space></div>
    {uploading && <Alert type="info" showIcon message="图片上传中，请稍候；完成后再保存正文。" />}
    {error && <Alert type="error" showIcon message={error} />}
    <div className={`production-content-editor-body mode-${mode === '分屏' ? 'split' : mode === '预览' ? 'preview' : 'edit'}`}>
      <div className="production-content-editor-input" style={{ display: mode === '预览' ? 'none' : undefined }}><div ref={host} /></div>
      {mode !== '编辑' && <div className="production-content-editor-preview" aria-label="正文预览区"><ContentPreview value={text} /></div>}
    </div>
    <div className="production-content-editor-footer"><Typography.Text type="secondary">支持富文本粘贴、Ctrl+B 加粗；图片支持 PNG / JPEG、单张5MB，可粘贴或拖入；链接仅支持 HTTP / HTTPS</Typography.Text><Typography.Text type={text.length > CONTENT_LIMIT ? 'danger' : 'secondary'}>{contentText(text).length.toLocaleString()} 字 · 存储 {text.length.toLocaleString()} / {CONTENT_LIMIT.toLocaleString()}</Typography.Text></div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg" hidden aria-label="选择正文图片" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''
      if (file && editor.current) void uploadImages(editor.current, [file], selection.current)
    }} />
    <Modal title="插入正文图片" open={imageOpen} onCancel={() => { if (!busy.current) setImageOpen(false) }} maskClosable={!uploading} closable={!uploading} okText="插入链接图片" cancelText="取消" confirmLoading={uploading} okButtonProps={{ disabled: disabled || uploading || !imageUrl.trim() }} onOk={() => {
      const url = safeImageUrl(imageUrl)
      if (!url) { setError('请输入完整的 HTTP / HTTPS 图片地址'); return }
      if (!editor.current || disabled || busy.current) return
      try { insertImage(editor.current, url, imageAlt, selection.current); setImageOpen(false); setError('') } catch (e) { setError((e as Error).message) }
    }} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button icon={<UploadOutlined />} loading={uploading} disabled={disabled} onClick={() => fileInput.current?.click()}>选择本机图片并上传</Button>
        <Typography.Text type="secondary">PNG / JPEG，单张不超过5MB；上传后插入光标位置。外部链接图片的可用性取决于原网站。</Typography.Text>
        <Input aria-label="图片地址" placeholder="或填写 https:// 图片地址" value={imageUrl} disabled={uploading} onChange={event => setImageUrl(event.target.value)} />
        <Input aria-label="图片说明" placeholder="图片说明（可选）" value={imageAlt} maxLength={200} disabled={uploading} onChange={event => setImageAlt(event.target.value)} />
        {error && <Typography.Text type="danger">{error}</Typography.Text>}
      </Space>
    </Modal>
    <Modal title="设置正文链接" open={linkOpen} onCancel={() => setLinkOpen(false)} onOk={applyLink} okText="插入链接" cancelText="取消" okButtonProps={{ disabled }} destroyOnHidden>
      <Input autoFocus aria-label="链接地址" placeholder="https://" value={linkValue} onChange={(event) => { setLinkValue(event.target.value); setLinkError('') }} onPressEnter={applyLink} status={linkError ? 'error' : undefined} />
      {linkError && <Typography.Text type="danger">{linkError}</Typography.Text>}
    </Modal>
  </div>
}
