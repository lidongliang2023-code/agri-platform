import { request, normalizePage } from '@/utils/request'
export type Row = Record<string, any>
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export interface Choice { label: string; value: any }
export interface Field { key: string; label: string; readonly?: boolean; type?: 'text' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'boolean' | 'images' | 'array'; children?: Field[]; multiple?: boolean; required?: boolean; min?: number; max?: number; options?: Choice[]; source?: string; sourceParams?: Row; sourceArray?: string; id?: string; name?: string; default?: any; hint?: string }
export interface Action { key: string; label: string; url: string; method?: Method; query?: boolean; fields?: Field[]; defaults?: Row; states?: any[]; stateKey?: string; detail?: boolean; result?: boolean; danger?: boolean }
export interface Resource { key: string; label: string; url: string; id?: string; title: string; subtitle?: string[]; search?: string; filters?: Field[]; fields?: Field[]; create?: string; createQuery?: boolean; edit?: string; detail?: string; actions?: Action[]; params?: Row; singleton?: boolean; arrayKey?: string; hint?: string }
export interface Business { title: string; farm?: boolean; sections: Resource[] }
export const base = '/api/v1/production'
export function endpoint(url: string, row: Row = {}): string { return url.replace(/\{([^}]+)\}/g, (_, key) => { const value = row[key]; if (value === undefined || value === null || value === '') throw new Error('缺少操作所需的信息，请刷新后重试'); return encodeURIComponent(String(value)) }) }
export async function call(url: string, method: Method = 'GET', data?: Row, params?: Row): Promise<any> {
  return request({ url: base + url, method, data, params, timeout: 75000 })
}
export async function fetchResource(resource: Resource, params: Row, page: number) {
  const raw = await call(endpoint(resource.url, params), 'GET', undefined, { ...resource.params, ...params, pageNum: page, pageSize: 20, page, size: 20 })
  const value = resource.arrayKey ? raw?.[resource.arrayKey] : raw
  if (resource.singleton) return { list: value == null ? [] : [value], total: value == null ? 0 : 1 }
  if (!(Array.isArray(value) || Array.isArray(value?.records) || Array.isArray(value?.list))) throw new Error('业务数据格式异常，请稍后重试')
  return normalizePage<Row>(value, page, 20)
}
export const choice = (entries: Record<string, string>): Choice[] => Object.entries(entries).map(([value, label]) => ({ value, label }))
export const text = (key: string, label: string, required = false): Field => ({ key, label, required })
export const number = (key: string, label: string, required = false, min = 0): Field => ({ key, label, required, type: 'number', min })
export const date = (key: string, label: string, required = false): Field => ({ key, label, required, type: 'date' })
export const select = (key: string, label: string, options: Choice[], required = false): Field => ({ key, label, type: 'select', options, required })
export const reference = (key: string, label: string, source: string, id: string, name: string, required = false): Field => ({ key, label, type: 'select', source, id, name, required })
export const plot = () => reference('plotId', '地块', '/plots', 'plotId', 'plotName', true)
export const batch = () => reference('batchId', '采收批次', '/harvests', 'batchId', 'batchNo', true)
export const note = (key = 'remark', label = '备注', required = false): Field => ({ key, label, type: 'textarea', required })
export const yesno = (key: string, label: string): Field => ({ key, label, type: 'boolean', default: false })
export const statusLabels: Record<string, string> = { generated:'未激活',LISTED:'已上架',SOLD:'已售完', SEED:'种子',FERTILIZER:'肥料',PESTICIDE:'农药',FEED:'饲料',VET:'兽药',PENDING:'待处理',TESTING:'检测中',PRESENT:'已到岗',ABSENT:'缺勤',READY:'待开工',COMMISSIONED:'已委托',active:'有效',inactive:'停用',revoked:'已作废',expired:'已过期',draft:'草稿',pending:'待审批',completed:'已完成',DRAFT: '草稿', APPROVED: '已确认', PUBLISHED: '已发布', CLOSED: '已关闭', PLANNED: '待执行', RUNNING: '执行中', DONE: '已完成', FAILED: '失败', SUCCESS: '成功', ACTIVE: '启用', INACTIVE: '停用', BLOCKED: '阻塞', DEFERRED: '下一周期待复核', RESCHEDULED: '已转接续单', FAULT: '故障', REPLACED: '已换机', RECOVERED: '已恢复', OPEN: '待处理', PROCESSING: '处理中', PASSED: '通过', PASS: '合格', FAIL: '不合格', REJECTED: '已驳回', NEEDS_REVIEW: '待复核', DOING: '进行中', CANCELED: '已取消', HARVEST: '采收', MACHINE: '农机协作', DRIVER: '运输驾驶', MIXED: '综合工种', VILLAGE: '本村劳务', NEIGHBORING: '邻村调剂', AGENCY: '劳务合作社', OTHER: '其他' }

export function validateFields(fields:Field[],values:Row):Row {
 const result:Row={}
 for(const field of fields){const value=values[field.key];const blank=value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length)
 if(field.required&&blank)throw new Error('请填写'+field.label)
 if(blank)continue
 if(field.type==='array')result[field.key]=value.map((row:Row)=>validateFields(field.children||[],row))
 else if(field.type==='number'){const n=Number(value);if(!Number.isFinite(n)||(field.min!==undefined&&n<field.min)||(field.max!==undefined&&n>field.max))throw new Error(field.label+'超出有效范围');result[field.key]=n}
 else result[field.key]=typeof value==='string'?value.trim():value
 }
 return result
}
