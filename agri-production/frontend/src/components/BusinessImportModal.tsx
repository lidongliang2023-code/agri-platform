import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Button, Modal, Progress, Space, Tag, Upload, message } from 'antd'
import BusinessRecordList from './BusinessRecordList'
import { downloadImportCsv, parseImportCsv } from '@/utils/import-csv'
import { downloadImportExcel, parseImportExcel } from '@/utils/import-excel'

type RawRow = Record<string, string>
type ImportStatus = 'ready' | 'invalid' | 'success' | 'failed' | 'uncertain'
interface PreviewRow { key: number; raw: RawRow; errors: string[]; status: ImportStatus; result?: string }
export interface BusinessImportModalProps<T> {
  open: boolean
  title: string
  headers: string[]
  requiredHeaders: string[]
  contextKey: string
  getContextKey: () => string
  contextReady: boolean
  contextControl?: ReactNode
  prepare: (raw: RawRow, index: number, all: RawRow[]) => { payload?: T; errors: string[] }
  submit: (payload: T) => Promise<unknown>
  beforeSubmit?: () => Promise<void>
  onComplete: () => unknown
  onClose: () => void
}
const statuses: Record<ImportStatus, { text: string; color: string }> = {
  ready: { text: '待导入', color: 'blue' }, invalid: { text: '校验失败', color: 'red' },
  success: { text: '已导入', color: 'green' }, failed: { text: '提交失败', color: 'red' },
  uncertain: { text: '待核对', color: 'orange' },
}

/** 通用 Excel / CSV 导入：业务方提供上下文、校验与保存回调，组件负责预览和逐行结果。 */
export default function BusinessImportModal<T>(props: BusinessImportModalProps<T>): JSX.Element {
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [done, setDone] = useState(0)
  const lock = useRef(false)
  const sourceContext = useRef('')
  const sameContext = sourceContext.current === props.contextKey
  const readyCount = rows.filter(row => row.status === 'ready').length
  const readFile = async (file: File) => {
    if (lock.current) return
    lock.current = true; setReading(true); setRows([]); setError(''); setAttempted(false); setDone(0); setFileName(file.name)
    sourceContext.current = props.getContextKey()
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('请选择 .xlsx 或 UTF-8 CSV 文件；旧版 .xls 请另存为 .xlsx')
      if (file.size > 5 * 1024 * 1024) throw new Error('文件不能超过 5MB')
      const raw = /\.xlsx$/i.test(file.name) ? await parseImportExcel(await file.arrayBuffer()) : parseImportCsv(await file.text())
      const missing = props.requiredHeaders.filter(header => !(header in raw[0]))
      const unknown = Object.keys(raw[0]).filter(header => !props.headers.includes(header))
      if (missing.length) throw new Error(`缺少必填列：${missing.join('、')}`)
      if (unknown.length) throw new Error(`无法识别的列：${unknown.join('、')}`)
      if (sourceContext.current !== props.getContextKey()) throw new Error('操作上下文已变化，请重新选择文件')
      setRows(raw.map((record, index) => {
        const result = props.prepare(record, index, raw)
        return { key: index + 2, raw: record, errors: result.errors, status: result.errors.length ? 'invalid' : 'ready' }
      }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败，请重新选择文件') }
    finally { lock.current = false; setReading(false) }
  }
  const run = async () => {
    if (lock.current || attempted || !sameContext || !props.contextReady || !rows.length) return
    lock.current = true; setBusy(true); setError('')
    let started = false
    try {
      await props.beforeSubmit?.()
      if (sourceContext.current !== props.getContextKey()) throw new Error('操作上下文已变化，请重新选择文件')
      const raw = rows.map(row => row.raw)
      const prepared = raw.map((record, index) => props.prepare(record, index, raw))
      if (prepared.some(result => result.errors.length || !result.payload)) {
        setRows(rows.map((row, index) => ({ ...row, errors: prepared[index].errors, status: prepared[index].errors.length ? 'invalid' : 'ready' })))
        throw new Error('数据已变化或存在校验错误，请修正文件后重新选择')
      }
      started = true; setAttempted(true)
      for (let index = 0; index < rows.length; index++) {
        if (sourceContext.current !== props.getContextKey()) throw new Error('登录或所属主体已变化，已停止后续导入')
        try {
          const result = await props.submit(prepared[index].payload!)
          if (result === undefined || result === null || result === '') throw new Error('接口未返回新增结果，请核对台账')
          setRows(current => current.map((row, i) => i === index ? { ...row, status: 'success', result: `保存成功（${String(result)}）` } : row))
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : '提交异常'
          const response = (cause as { response?: { status?: number } })?.response
          const rejected = response?.status && [400, 401, 403, 404, 409, 422].includes(response.status)
          setRows(current => current.map((row, i) => i === index ? { ...row, status: rejected ? 'failed' : 'uncertain', result: detail } : row))
          throw new Error('导入已暂停，请核对失败或待核对记录；已成功记录不会再次提交')
        } finally { setDone(index + 1) }
      }
      message.success(`已导入 ${rows.length} 条记录`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败') }
    finally {
      if (started) { try { await props.onComplete() } catch { setError('导入结果已保留，列表刷新失败，请手动刷新') } }
      lock.current = false; setBusy(false)
    }
  }
  return <Modal open={props.open} title={props.title} width={1100} maskClosable={!busy && !reading} closable={!busy && !reading}
    keyboard={!busy && !reading} onCancel={() => { if (!lock.current) props.onClose() }} destroyOnClose
    footer={<Space><Button disabled={busy || reading} onClick={props.onClose}>关闭</Button><Button type="primary" loading={busy}
      disabled={reading || attempted || !sameContext || !props.contextReady || !readyCount || rows.some(row => row.status === 'invalid')} onClick={() => void run()}>确认导入（{readyCount}）</Button></Space>}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <fieldset disabled={busy || reading || attempted} style={{ border: 0, padding: 0, margin: 0 }}>{props.contextControl}</fieldset>
      <Space wrap>
        <Button disabled={busy || reading} loading={downloading} onClick={async () => {
          setDownloading(true)
          try { await downloadImportExcel(`${props.title}模板.xlsx`, props.headers) }
          catch { message.error('Excel 模板下载失败，请重试或下载 CSV 模板') }
          finally { setDownloading(false) }
        }}>下载 Excel 模板</Button>
        <Button disabled={busy || reading} onClick={() => downloadImportCsv(`${props.title}模板.csv`, props.headers, [])}>下载 CSV 模板</Button>
        <Upload accept=".xlsx,.csv" showUploadList={false} disabled={busy || reading || !props.contextReady} beforeUpload={file => { void readFile(file); return false }}><Button loading={reading}>选择 Excel / CSV 文件</Button></Upload>
        {fileName && <span>{fileName} · {rows.length} 条</span>}
        {!!rows.length && <Button disabled={busy || reading} onClick={() => {
          const failed = rows.filter(row => row.status !== 'success')
          downloadImportCsv(`${props.title}未成功记录.csv`, props.headers, failed.map(row => props.headers.map(header => row.raw[header] ?? '')))
        }}>导出未成功记录</Button>}
      </Space>
      <Alert type="info" showIcon message="支持 Excel（.xlsx，单个数据工作表）和 UTF-8 CSV，单次最多 200 条、5MB；Excel 不支持公式、合并单元格或加密文件；校验全部通过后逐行保存。部分成功不回滚，待核对记录请先检查台账再处理。" />
      {!sameContext && !!rows.length && <Alert type="warning" showIcon message="所属农场或登录主体已变化，请重新选择文件" />}
      {error && <Alert type="error" showIcon message={error} />}
      {attempted && <Progress percent={rows.length ? Math.round(done / rows.length * 100) : 0} format={() => `已处理 ${done}/${rows.length}`} />}
      <BusinessRecordList<PreviewRow> rowKey="key" dataSource={rows} pagination={{ pageSize: 10 }} toolbarTitle="导入预览" columnWidthStorageKey="business-import-preview"
        columns={[
          { title: '文件行', dataIndex: 'key', width: 85, fixed: 'left' },
          ...props.headers.map(header => ({ title: header, key: header, width: 150, render: (_: unknown, row: PreviewRow) => row.raw[header] || '—' })),
          { title: '状态', key: 'status', width: 110, fixed: 'right', render: (_, row) => <Tag color={statuses[row.status].color}>{statuses[row.status].text}</Tag> },
          { title: '校验与处理结果', key: 'result', width: 300, render: (_, row) => row.errors.join('；') || row.result || '校验通过' },
        ]} />
    </Space>
  </Modal>
}
