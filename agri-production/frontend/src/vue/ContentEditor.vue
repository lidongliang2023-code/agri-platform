<template>
  <div class="production-content-editor" :class="{ 'is-disabled': disabled }">
    <div class="production-content-editor-heading">
      <a-space wrap><strong>富文本正文</strong><a-segmented v-model:value="mode" aria-label="正文显示模式" :disabled="uploading" :options="['编辑', '分屏', '预览']" /></a-space>
      <a-space><a-button size="small" :disabled="locked" @click="editor?.history.undo()">撤销</a-button><a-button size="small" :disabled="locked" @click="editor?.history.redo()">重做</a-button></a-space>
    </div>
    <a-alert v-if="uploading" type="info" show-icon message="图片上传中，请稍候；完成后再保存正文。" />
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <div class="production-content-editor-body" :class="`mode-${mode === '分屏' ? 'split' : mode === '预览' ? 'preview' : 'edit'}`">
      <div class="production-content-editor-input" :style="{ display: mode === '预览' ? 'none' : undefined }"><div ref="host" /></div>
      <div v-if="mode !== '编辑'" class="production-content-editor-preview" aria-label="正文预览区"><div class="production-rich-content" v-html="preview" /></div>
    </div>
    <div class="production-content-editor-footer"><span>支持富文本粘贴、Ctrl+B 加粗；图片支持 PNG / JPEG、单张5MB，可粘贴或拖入；链接仅支持 HTTP / HTTPS</span><span>{{ contentText(value).length.toLocaleString() }} 字 · 存储 {{ (value ?? '').length.toLocaleString() }} / {{ CONTENT_LIMIT.toLocaleString() }}</span></div>
    <input ref="fileInput" type="file" accept="image/png,image/jpeg" hidden aria-label="选择正文图片" @change="chooseFile" />
    <a-modal title="插入正文图片" :open="imageOpen" :mask-closable="!uploading" :closable="!uploading" :confirm-loading="uploading" ok-text="插入链接图片" cancel-text="取消" :ok-button-props="{ disabled: disabled || uploading || !imageUrl.trim() }" @cancel="!uploading && (imageOpen = false)" @ok="applyImage">
      <a-space direction="vertical" style="width:100%">
        <a-button :loading="uploading" :disabled="disabled" @click="fileInput?.click()">选择本机图片并上传</a-button>
        <span>PNG / JPEG，单张不超过5MB；上传后插入光标位置。</span>
        <a-input v-model:value="imageUrl" aria-label="图片地址" placeholder="或填写 https:// 图片地址" :disabled="uploading" />
        <a-input v-model:value="imageAlt" aria-label="图片说明" placeholder="图片说明（可选）" :maxlength="200" :disabled="uploading" />
      </a-space>
    </a-modal>
    <a-modal title="设置正文链接" :open="linkOpen" ok-text="插入链接" cancel-text="取消" :ok-button-props="{ disabled }" @cancel="linkOpen = false" @ok="applyLink">
      <a-input v-model:value="linkValue" aria-label="链接地址" placeholder="https://" :status="linkError ? 'error' : undefined" @change="linkError = ''" @press-enter="applyLink" />
      <span v-if="linkError" style="color:#d4380d">{{ linkError }}</span>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Alert as AAlert, Button as AButton, Input as AInput, Modal as AModal, Segmented as ASegmented, Space as ASpace } from 'ant-design-vue'
import Quill, { Delta } from 'quill'
import 'quill/dist/quill.snow.css'
import '../components/ContentEditor.css'
import { CONTENT_LIMIT, contentHtml, contentText, normalizeContent, safeContentUrl, safeImageUrl } from '../components/richTextContent'
import { uploadContentImage, validateContentImage } from '../api/content-images'

const props = withDefaults(defineProps<{ value?: string | null; disabled?: boolean; id?: string; placeholder?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' }>(), { value: '', disabled: false, placeholder: '请输入正文，可粘贴文字并使用上方工具栏排版。' })
const emit = defineEmits<{ 'update:value': [value: string]; change: [value: string]; uploadingChange: [uploading: boolean] }>()
for (const name of ['align', 'color', 'background']) Quill.register(`formats/${name}`, Quill.import(`attributors/style/${name}`), true)
const SizeStyle = Quill.import('attributors/style/size') as { whitelist: string[] }
SizeStyle.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']
Quill.register('formats/size', SizeStyle, true)
const formats = ['header', 'size', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'align', 'list', 'blockquote', 'code-block', 'link', 'script', 'image']
type Selection = { index: number; length: number }
const host = shallowRef<HTMLDivElement>(), fileInput = shallowRef<HTMLInputElement>(), editor = shallowRef<Quill>()
const mode = ref('编辑'), error = ref(''), uploading = ref(false)
const imageOpen = ref(false), imageUrl = ref(''), imageAlt = ref('')
const linkOpen = ref(false), linkValue = ref(''), linkError = ref('')
const preview = computed(() => contentHtml(props.value))
const locked = computed(() => props.disabled || uploading.value || mode.value === '预览')
let selection: Selection | null = null, lastValue = props.value ?? '', cleanup: (() => void) | undefined
let alive = true
function insertImage(quill: Quill, src: string, alt: string, range: Selection | null) {
  const index = Math.min(range?.index ?? quill.getLength() - 1, quill.getLength() - 1)
  const image = document.createElement('img'); image.src = src; image.alt = alt.slice(0, 200)
  if (normalizeContent(quill.getSemanticHTML()).length + image.outerHTML.length + 50 > CONTENT_LIMIT) throw new Error('插入图片后正文超过100000字符，请缩减正文')
  const enabled = quill.isEnabled(); quill.history.cutoff(); quill.enable(true)
  try { quill.updateContents(new Delta().retain(Math.max(0, index)).insert({ image: src }, { alt: alt.slice(0, 200) }), 'user'); quill.history.cutoff(); quill.setSelection(Math.max(0, index) + 1, 0, 'silent') }
  finally { quill.enable(enabled) }
}
async function uploadImages(quill: Quill, files: File[], range: Selection | null) {
  if (uploading.value || props.disabled || !quill.isEnabled()) return
  try { for (const file of files) { try { validateContentImage(file) } catch (e) { throw new Error(`「${file.name}」：${(e as Error).message}`) } } }
  catch (e) { error.value = (e as Error).message; return }
  let inserted = 0, failedFile = ''
  uploading.value = true; emit('uploadingChange', true); error.value = ''; quill.enable(false)
  try {
    let current = range
    for (const file of files) {
      failedFile = file.name
      const url = await uploadContentImage(file)
      if (!alive || editor.value !== quill) return
      insertImage(quill, url, file.name, current); inserted++; current = quill.getSelection()
    }
    imageOpen.value = false
  } catch (e) {
    if (alive && editor.value === quill) error.value = `「${failedFile}」：${(e as Error).message}。${inserted ? `已插入${inserted}张图片，剩余${files.length - inserted}张未插入，请仅重试未插入的图片。` : '本次图片未插入，原正文已保留。'}`
  } finally { if (alive && editor.value === quill) { uploading.value = false; emit('uploadingChange', false); syncDisabled() } }
}
function syncDisabled() {
  const quill = editor.value
  if (!quill) return
  quill.enable(!locked.value)
  quill.root.setAttribute('aria-label', '正文编辑区'); quill.root.setAttribute('role', 'textbox'); quill.root.setAttribute('aria-multiline', 'true')
  if (props.id) quill.root.id = props.id
  for (const key of ['aria-describedby', 'aria-invalid'] as const) { const value = props[key]; if (value === undefined) quill.root.removeAttribute(key); else quill.root.setAttribute(key, String(value)) }
  host.value?.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('.ql-toolbar button,.ql-toolbar select').forEach(control => { control.disabled = locked.value })
}
function initialize() {
  cleanup?.()
  if (!host.value || !alive) return
  const container = host.value, mount = document.createElement('div'); container.appendChild(mount)
  const quill = new Quill(mount, { theme: 'snow', bounds: container, readOnly: props.disabled, placeholder: props.placeholder, formats,
    modules: {
      toolbar: { container: [[{ header: [1, 2, 3, false] }, { size: SizeStyle.whitelist }], ['bold', 'italic', 'underline', 'strike'], [{ color: [] }, { background: [] }], [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }], ['blockquote', 'code-block', 'link', 'image', 'clean']], handlers: {
        link: (active: boolean) => { if (props.disabled) return; if (!active) { quill.format('link', false, 'user'); return }; selection = quill.getSelection(true); const link = quill.getFormat(selection ?? undefined).link; linkValue.value = typeof link === 'string' ? link : ''; linkError.value = ''; linkOpen.value = true },
        image: () => { if (props.disabled || uploading.value) return; selection = quill.getSelection(true); imageUrl.value = ''; imageAlt.value = ''; error.value = ''; imageOpen.value = true },
      } },
      history: { delay: 600, maxStack: 100, userOnly: true },
      uploader: { mimetypes: ['image/png', 'image/jpeg'], handler: (range: Selection, files: File[]) => { void uploadImages(quill, files, range) } },
    },
  })
  editor.value = quill
  const receiveFiles = (event: ClipboardEvent | DragEvent) => {
    const transfer = 'clipboardData' in event ? event.clipboardData : event.dataTransfer
    const files = Array.from(transfer?.files ?? []); if (!files.length) return
    event.preventDefault(); event.stopImmediatePropagation(); void uploadImages(quill, files, quill.getSelection() ?? selection)
  }
  quill.root.addEventListener('paste', receiveFiles, true); quill.root.addEventListener('drop', receiveFiles, true)
  quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
    if (node instanceof Element && ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG'].includes(node.tagName)) return delta.slice(0, 0)
    if (node instanceof HTMLImageElement && !safeImageUrl(node.getAttribute('src'))) return delta.slice(0, 0)
    return delta
  })
  quill.setContents(quill.clipboard.convert({ html: contentHtml(props.value) }), 'silent'); quill.history.clear(); lastValue = props.value ?? ''
  const labels: Record<string, string> = { header: '标题层级', size: '字号', bold: '加粗（Ctrl+B）', italic: '斜体（Ctrl+I）', underline: '下划线（Ctrl+U）', strike: '删除线', color: '文字颜色', background: '背景颜色', list: '列表', align: '段落对齐', blockquote: '引用', 'code-block': '代码块', link: '插入或编辑链接', image: '插入图片', clean: '清除格式' }
  container.querySelectorAll<HTMLElement>('.ql-toolbar button,.ql-toolbar .ql-picker').forEach(element => { const key = Object.keys(labels).find(name => element.classList.contains(`ql-${name}`)); if (key) { element.title = labels[key]; element.setAttribute('aria-label', labels[key]) } })
  container.querySelectorAll<HTMLButtonElement>('.ql-toolbar button').forEach(button => { button.type = 'button' })
  const change = (_delta: unknown, old: ReturnType<Quill['getContents']>, source: string) => {
    if (source !== 'user') return
    const html = normalizeContent(quill.getSemanticHTML())
    if (html.length > CONTENT_LIMIT) { const range = quill.getSelection(); quill.setContents(old, 'silent'); if (range) quill.setSelection(Math.min(range.index, Math.max(0, quill.getLength() - 1)), 0, 'silent'); error.value = '正文（含格式标记）最多100000个字符，本次超长输入未写入。'; return }
    error.value = ''; lastValue = html; emit('update:value', html); emit('change', html)
  }
  quill.on('text-change', change)
  cleanup = () => { quill.off('text-change', change); quill.root.removeEventListener('paste', receiveFiles, true); quill.root.removeEventListener('drop', receiveFiles, true); quill.disable(); editor.value = undefined; container.replaceChildren() }
  syncDisabled()
}
onMounted(initialize)
onBeforeUnmount(() => { alive = false; cleanup?.(); emit('uploadingChange', false) })
watch(() => props.placeholder, () => { if (host.value) initialize() })
watch(() => props.value, value => { const quill = editor.value; if (!quill || value === lastValue) return; quill.setContents(quill.clipboard.convert({ html: contentHtml(value) }), 'silent'); quill.history.clear(); lastValue = value ?? ''; error.value = '' })
watch([locked, () => props.id, () => props['aria-describedby'], () => props['aria-invalid']], syncDisabled)
function applyLink() {
  const quill = editor.value, href = safeContentUrl(linkValue.value)
  if (!href) { linkError.value = '请输入完整的 HTTP 或 HTTPS 链接'; return }
  if (!quill || locked.value) return
  const range = selection ?? { index: quill.getLength() - 1, length: 0 }
  if (range.length) { quill.setSelection(range, 'silent'); quill.format('link', href, 'user') }
  else { quill.insertText(range.index, href, { link: href }, 'user'); quill.setSelection(Math.min(range.index + href.length, quill.getLength() - 1), 0, 'silent') }
  linkOpen.value = false
}
function applyImage() {
  const url = safeImageUrl(imageUrl.value), quill = editor.value
  if (!url) { error.value = '请输入完整的 HTTP / HTTPS 图片地址'; return }
  if (!quill || locked.value) return
  try { insertImage(quill, url, imageAlt.value, selection); imageOpen.value = false; error.value = '' } catch (e) { error.value = (e as Error).message }
}
function chooseFile(event: Event) { const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''; if (file && editor.value) void uploadImages(editor.value, [file], selection) }
</script>
