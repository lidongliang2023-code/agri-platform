import axios from 'axios'

/**
 * 合同模板（运营端）。
 *
 * 模板是全平台共用的格式（标准购销/远期购销/框架采购），所以维护入口在运营端；
 * 用户侧只保留 GET /contract/template/list 供起草合同时选用。
 */
export interface TemplateRow {
  id: number
  templateCode: string
  templateName: string
  templateType: string
  templateContent: string
  description: string
  sortOrder: number
  isDefault: number
  status: number
  isSystem?: number
  createTime: string
  updateTime: string
}

export async function getTemplates(params: { pageNum: number; pageSize: number; templateName?: string }) {
  const response = await axios.get('/api/trade/admin/contract-template/page', { params })
  return response.data
}

export async function createTemplate(data: Partial<TemplateRow>) {
  const response = await axios.post('/api/trade/admin/contract-template', data)
  return response.data
}

export async function updateTemplate(id: number, data: Partial<TemplateRow>) {
  const response = await axios.put(`/api/trade/admin/contract-template/${id}`, data)
  return response.data
}

export async function deleteTemplate(id: number) {
  const response = await axios.delete(`/api/trade/admin/contract-template/${id}`)
  return response.data
}
