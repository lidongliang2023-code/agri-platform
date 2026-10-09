/**
 * 运营端 - SOP 模板审核 与 农业知识库 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { KnowledgeArticle, SopTemplate } from '@/types'

const SOP_BASE = '/admin/sop'
const KB_BASE = '/admin/knowledge'

/** 分页查询 SOP 模板（待审核 / 已通过 / 已驳回） */
export function listSopTemplates(
  params: PageQuery & { templateName?: string; auditStatus?: number; cropId?: string },
): Promise<PageResult<SopTemplate>> {
  return http.get<PageResult<SopTemplate>>(SOP_BASE, params)
}

/** 查询 SOP 模板详情 */
export function getSopTemplate(templateId: string): Promise<SopTemplate> {
  return http.get<SopTemplate>(`${SOP_BASE}/${templateId}`)
}

/** 新增 SOP 模板 */
export function createSopTemplate(payload: Partial<SopTemplate>): Promise<string> {
  return http.post<string>(SOP_BASE, payload)
}

/** 更新 SOP 模板 */
export function updateSopTemplate(
  templateId: string,
  payload: Partial<SopTemplate>,
): Promise<SopTemplate> {
  return http.put<SopTemplate>(`${SOP_BASE}/${templateId}`, payload)
}

/** 删除 SOP 模板 */
export function deleteSopTemplate(templateId: string): Promise<boolean> {
  return http.delete<boolean>(`${SOP_BASE}/${templateId}`)
}

/** 审核 SOP 模板 */
export function auditSopTemplate(
  templateId: string,
  payload: { auditStatus: number; auditRemark?: string },
): Promise<boolean> {
  return http.patch<boolean>(`${SOP_BASE}/${templateId}/audit`, payload)
}

/** 分页查询农业知识库文章 */
export function listKnowledgeArticles(
  params: PageQuery & { title?: string; category?: number; status?: number },
): Promise<PageResult<KnowledgeArticle>> {
  return http.get<PageResult<KnowledgeArticle>>(KB_BASE, params)
}

/** 查询知识库文章详情 */
export function getKnowledgeArticle(articleId: string): Promise<KnowledgeArticle> {
  return http.get<KnowledgeArticle>(`${KB_BASE}/${articleId}`)
}

/** 新增知识库文章 */
export function createKnowledgeArticle(
  payload: Partial<KnowledgeArticle>,
): Promise<string> {
  return http.post<string>(KB_BASE, payload)
}

/** 更新知识库文章 */
export function updateKnowledgeArticle(
  articleId: string,
  payload: Partial<KnowledgeArticle>,
): Promise<KnowledgeArticle> {
  return http.put<KnowledgeArticle>(`${KB_BASE}/${articleId}`, payload)
}

/** 删除知识库文章 */
export function deleteKnowledgeArticle(articleId: string): Promise<boolean> {
  return http.delete<boolean>(`${KB_BASE}/${articleId}`)
}

/** 发布 / 下架知识库文章 */
export function publishKnowledgeArticle(
  articleId: string,
  status: number,
): Promise<boolean> {
  return http.patch<boolean>(`${KB_BASE}/${articleId}/publish`, { status })
}
