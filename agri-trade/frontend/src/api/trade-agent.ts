import axios from 'axios'
export type AgentRole = 'BUYER' | 'SELLER'
export interface AgentMandate { id: string; role: AgentRole; ref_id: number; merchant_id: number; target_price: number; limit_price: number; quantity: number; freight: number; max_rounds: number; delivery_date: string; expires_at: string; status: string }
export interface AgentSession { id: string; buyer_id: number; seller_id: number; demand_id: number; product_id: number; quantity: number; unit: string; agreed_price: number | null; freight: number; delivery_date: string; expires_at: string; status: string; revision: number; buyer_confirmed: number; seller_confirmed: number; quote_id?: number; order_id?: number; public_snapshot: string }
export interface AgentReference { id: number; demandName?: string; productName?: string; buyerName?: string; sellerName?: string; unit?: string; quantity?: number; demandQuantity?: number; stockQuantity?: number; price?: number; unitPrice?: number }
export interface AgentWorkspace { mandates: AgentMandate[]; sessions: AgentSession[]; references: AgentReference[]; policyVersion: string }
export interface AgentComparison { id: string; product_name: string; seller_name: string; quantity: number; unit: string; agreed_price: number | null; freight: number; total_amount: number | null; delivery_date: string; status: string; expires_at: string }
export interface AgentDetail extends AgentSession { effective: boolean; events: { event_type: string; actor: string; detail_json: string; created_at: string }[]; order?: { id: number; orderNo: string; orderStatus: string; paymentStatus: string }; logistics?: { id: number; logisticsNo: string; logisticsStatus: string }[]; contracts?: { id: number; contractNo: string; contractStatus: string }[]; fulfillmentWarnings?: string[] }
async function unwrap<T>(p: Promise<{data: {code: number; message: string; data: T}}>): Promise<T> { const {data} = await p; if (data.code !== 200 && data.code !== 0) throw new Error(data.message || '操作失败'); return data.data }
const base = '/api/trade/agents'
export const agentWorkspace = (role: AgentRole) => unwrap<AgentWorkspace>(axios.get(`${base}/workspace`, { params: { role } }))
export const createAgentMandate = (body: Record<string, unknown>) => unwrap<AgentMandate>(axios.post(`${base}/mandates`, body))
export const revokeAgentMandate = (id: string) => unwrap<void>(axios.post(`${base}/mandates/${id}/revoke`))
export const runAgent = (id: string) => unwrap<AgentComparison[]>(axios.post(`${base}/mandates/${id}/run`))
export const compareAgent = (id: string) => unwrap<AgentComparison[]>(axios.get(`${base}/mandates/${id}/comparison`))
export const agentDetail = (id: string) => unwrap<AgentDetail>(axios.get(`${base}/sessions/${id}`))
export const confirmAgent = (id: string, role: AgentRole, revision: number) => unwrap<AgentDetail>(axios.post(`${base}/sessions/${id}/confirm`, { role, revision }))
export const rejectAgent = (id: string, reason: string) => unwrap<void>(axios.post(`${base}/sessions/${id}/reject`, { reason }))
