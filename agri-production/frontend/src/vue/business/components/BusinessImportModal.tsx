import { computed, defineComponent, ref, shallowRef, type PropType, type VNodeChild } from 'vue'
import { Alert, Button, Modal, Progress, Space, Tag, Upload, message } from '@/vue/ui'
import BusinessRecordList from './BusinessRecordList'
import { downloadImportCsv, parseImportCsv } from '@/utils/import-csv'
import { downloadImportExcel, parseImportExcel } from '@/utils/import-excel'

type RawRow = Record<string, string>
type ImportStatus = 'ready' | 'invalid' | 'success' | 'failed' | 'uncertain'
interface PreviewRow { key: number; raw: RawRow; errors: string[]; status: ImportStatus; result?: string }

export interface BusinessImportModalProps<T = any> {
  open: boolean
  title: string
  headers: string[]
  requiredHeaders: string[]
  contextKey: string
  getContextKey: () => string
  contextReady: boolean
  contextControl?: VNodeChild
  prepare: (raw: RawRow, index: number, all: RawRow[]) => { payload?: T; errors: string[] }
  submit: (payload: T) => Promise<unknown>
  beforeSubmit?: () => Promise<void>
  onComplete: () => unknown
  onClose: () => void
}

const statuses: Record<ImportStatus, { text: string; color: string }> = {
  ready: { text: '待导入', color: 'blue' },
  invalid: { text: '校验失败', color: 'red' },
  success: { text: '已导入', color: 'green' },
  failed: { text: '提交失败', color: 'red' },
  uncertain: { text: '待核对', color: 'orange' },
}

/** 通用 Excel / CSV 导入：业务方提供上下文、校验与保存回调，组件负责预览和逐行结果。 */
export default defineComponent({
  name: 'ProductionVueBusinessImportModal',
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    headers: { type: Array as PropType<string[]>, required: true },
    requiredHeaders: { type: Array as PropType<string[]>, required: true },
    contextKey: { type: String, required: true },
    getContextKey: { type: Function as PropType<() => string>, required: true },
    contextReady: { type: Boolean, required: true },
    contextControl: null as unknown as PropType<VNodeChild>,
    prepare: { type: Function as PropType<(raw: RawRow, index: number, all: RawRow[]) => { payload?: any; errors: string[] }>, required: true },
    submit: { type: Function as PropType<(payload: any) => Promise<unknown>>, required: true },
    beforeSubmit: Function as PropType<() => Promise<void>>,
    onComplete: { type: Function as PropType<() => unknown>, required: true },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const rows = shallowRef<PreviewRow[]>([])
    const fileName = ref('')
    const error = ref('')
    const busy = ref(false)
    const reading = ref(false)
    const downloading = ref(false)
    const attempted = ref(false)
    const done = ref(0)
    const lock = ref(false)
    const sourceContext = ref('')
    const sameContext = computed(() => sourceContext.value === props.contextKey)
    const readyCount = computed(() => rows.value.filter(row => row.status === 'ready').length)

    const readFile = async (file: File) => {
      if (lock.value) return
      lock.value = true; reading.value = true; rows.value = []; error.value = ''; attempted.value = false; done.value = 0; fileName.value = file.name
      sourceContext.value = props.getContextKey()
      try {
        if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('请选择 .xlsx 或 UTF-8 CSV 文件；旧版 .xls 请另存为 .xlsx')
        if (file.size > 5 * 1024 * 1024) throw new Error('文件不能超过 5MB')
        const raw = /\.xlsx$/i.test(file.name) ? await parseImportExcel(await file.arrayBuffer()) : parseImportCsv(await file.text())
        const missing = props.requiredHeaders.filter(header => !(header in raw[0]))
        const unknown = Object.keys(raw[0]).filter(header => !props.headers.includes(header))
        if (missing.length) throw new Error(`缺少必填列：${missing.join('、')}`)
        if (unknown.length) throw new Error(`无法识别的列：${unknown.join('、')}`)
        if (sourceContext.value !== props.getContextKey()) throw new Error('操作上下文已变化，请重新选择文件')
        rows.value = raw.map((record, index) => {
          const result = props.prepare(record, index, raw)
          return { key: index + 2, raw: record, errors: result.errors, status: result.errors.length ? 'invalid' : 'ready' }
        })
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : '读取失败，请重新选择文件'
      } finally {
        lock.value = false; reading.value = false
      }
    }

    const run = async () => {
      if (lock.value || attempted.value || !sameContext.value || !props.contextReady || !rows.value.length) return
      lock.value = true; busy.value = true; error.value = ''
      let started = false
      try {
        await props.beforeSubmit?.()
        if (sourceContext.value !== props.getContextKey()) throw new Error('操作上下文已变化，请重新选择文件')
        const raw = rows.value.map(row => row.raw)
        const prepared = raw.map((record, index) => props.prepare(record, index, raw))
        if (prepared.some(result => result.errors.length || !result.payload)) {
          rows.value = rows.value.map((row, index) => ({ ...row, errors: prepared[index].errors, status: prepared[index].errors.length ? 'invalid' : 'ready' }))
          throw new Error('数据已变化或存在校验错误，请修正文件后重新选择')
        }
        started = true; attempted.value = true
        for (let index = 0; index < rows.value.length; index++) {
          if (sourceContext.value !== props.getContextKey()) throw new Error('登录或所属主体已变化，已停止后续导入')
          try {
            const result = await props.submit(prepared[index].payload!)
            if (result === undefined || result === null || result === '') throw new Error('接口未返回新增结果，请核对台账')
            rows.value = rows.value.map((row, i) => i === index ? { ...row, status: 'success', result: `保存成功（${String(result)}）` } : row)
          } catch (cause) {
            const detail = cause instanceof Error ? cause.message : '提交异常'
            const response = (cause as { response?: { status?: number } })?.response
            const rejected = response?.status && [400, 401, 403, 404, 409, 422].includes(response.status)
            rows.value = rows.value.map((row, i) => i === index ? { ...row, status: rejected ? 'failed' : 'uncertain', result: detail } : row)
            throw new Error('导入已暂停，请核对失败或待核对记录；已成功记录不会再次提交')
          } finally {
            done.value = index + 1
          }
        }
        message.success(`已导入 ${rows.value.length} 条记录`)
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : '导入失败'
      } finally {
        if (started) {
          try { await props.onComplete() } catch { error.value = '导入结果已保留，列表刷新失败，请手动刷新' }
        }
        lock.value = false; busy.value = false
      }
    }

    return () => <Modal
      open={props.open}
      title={props.title}
      width={1100}
      maskClosable={!busy.value && !reading.value}
      closable={!busy.value && !reading.value}
      keyboard={!busy.value && !reading.value}
      onCancel={() => { if (!lock.value) props.onClose() }}
      destroyOnClose
      footer={<Space>
        <Button disabled={busy.value || reading.value} onClick={props.onClose}>关闭</Button>
        <Button type="primary" loading={busy.value} disabled={reading.value || attempted.value || !sameContext.value || !props.contextReady || !readyCount.value || rows.value.some(row => row.status === 'invalid')} onClick={() => void run()}>确认导入（{readyCount.value}）</Button>
      </Space>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <fieldset disabled={busy.value || reading.value || attempted.value} style={{ border: 0, padding: 0, margin: 0 }}>{props.contextControl}</fieldset>
        <Space wrap>
          <Button disabled={busy.value || reading.value} loading={downloading.value} onClick={async () => {
            downloading.value = true
            try { await downloadImportExcel(`${props.title}模板.xlsx`, props.headers) }
            catch { message.error('Excel 模板下载失败，请重试或下载 CSV 模板') }
            finally { downloading.value = false }
          }}>下载 Excel 模板</Button>
          <Button disabled={busy.value || reading.value} onClick={() => downloadImportCsv(`${props.title}模板.csv`, props.headers, [])}>下载 CSV 模板</Button>
          <Upload accept=".xlsx,.csv" showUploadList={false} disabled={busy.value || reading.value || !props.contextReady} beforeUpload={(file: any) => { void readFile(file as File); return false }}>
            <Button loading={reading.value}>选择 Excel / CSV 文件</Button>
          </Upload>
          {fileName.value && <span>{fileName.value} · {rows.value.length} 条</span>}
          {!!rows.value.length && <Button disabled={busy.value || reading.value} onClick={() => {
            const failed = rows.value.filter(row => row.status !== 'success')
            downloadImportCsv(`${props.title}未成功记录.csv`, props.headers, failed.map(row => props.headers.map(header => row.raw[header] ?? '')))
          }}>导出未成功记录</Button>}
        </Space>
        <Alert type="info" showIcon message="支持 Excel（.xlsx，单个数据工作表）和 UTF-8 CSV，单次最多 200 条、5MB；Excel 不支持公式、合并单元格或加密文件；校验全部通过后逐行保存。部分成功不回滚，待核对记录请先检查台账再处理。" />
        {!sameContext.value && !!rows.value.length && <Alert type="warning" showIcon message="所属农场或登录主体已变化，请重新选择文件" />}
        {error.value && <Alert type="error" showIcon message={error.value} />}
        {attempted.value && <Progress percent={rows.value.length ? Math.round(done.value / rows.value.length * 100) : 0} format={() => `已处理 ${done.value}/${rows.value.length}`} />}
        <BusinessRecordList
          rowKey="key"
          dataSource={rows.value}
          pagination={{ pageSize: 10 }}
          toolbarTitle="导入预览"
          columnWidthStorageKey="business-import-preview"
          columns={[
            { title: '文件行', dataIndex: 'key', width: 85, fixed: 'left' },
            ...props.headers.map(header => ({ title: header, key: header, width: 150, render: (_: unknown, row: PreviewRow) => row.raw[header] || '—' })),
            { title: '状态', key: 'status', width: 110, fixed: 'right', render: (_: unknown, row: PreviewRow) => <Tag color={statuses[row.status].color}>{statuses[row.status].text}</Tag> },
            { title: '校验与处理结果', key: 'result', width: 300, render: (_: unknown, row: PreviewRow) => row.errors.join('；') || row.result || '校验通过' },
          ]}
        />
      </Space>
    </Modal>
  },
})
