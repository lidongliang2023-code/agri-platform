import axios from 'axios'

/**
 * 风控管理（运营端）。
 *
 * 告警是**扫描时用真实数据算出来的**，detail 里带着当时的数字（例如"该货源 ¥12/吨，
 * 同品类均价 ¥128/吨"），运营可以自己复核。规则与阈值都在系统配置里。
 */
export interface RiskRule {
  ruleCode: string
  ruleName: string
  alertLevel: string
  thresholdKey: string
  thresholdValue: string | null
  description: string
}

export interface RiskAlertRow {
  id: number
  alertNo: string
  ruleCode: string
  ruleName: string
  alertLevel: string
  subjectType: string
  subjectId: number
  subjectName: string
  title: string
  detail: string
  alertStatus: string
  handler: string | null
  handleTime: string | null
  handleRemark: string | null
  detectedAt: string
}

export interface RiskSummary {
  newCount: number
  handledCount: number
  ignoredCount: number
}

export async function getRiskRules() {
  const response = await axios.get('/api/trade/admin/risk/rule/list')
  return response.data
}

export async function getRiskSummary() {
  const response = await axios.get('/api/trade/admin/risk/summary')
  return response.data
}

export async function getRiskAlerts(params: {
  pageNum: number
  pageSize: number
  alertStatus?: string
  ruleCode?: string
  alertLevel?: string
}) {
  const response = await axios.get('/api/trade/admin/risk/alert/page', { params })
  return response.data
}

export async function scanRisk() {
  const response = await axios.post('/api/trade/admin/risk/scan')
  return response.data
}

export async function handleRiskAlert(id: number, status: 'handled' | 'ignored', remark?: string) {
  const response = await axios.post(`/api/trade/admin/risk/alert/${id}/handle`, { status, remark })
  return response.data
}
