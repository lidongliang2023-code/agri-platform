/**
 * 运营端 - SOP 标准作业规程库 与 农业知识库 API
 *
 * <p>契约以 `AdminSopController`（`/api/v1/production/admin/sop`）源码为准。
 * 此前这里的 `listSopTemplates` 传的是 `templateName` / `auditStatus` / `cropId`，
 * 而后端 `page()` 只认 `keyword`（匹配 sop_name）与 `status`（1发布 0草稿）——
 * 三个参数全被静默丢弃；`auditSopTemplate`（PATCH `/{id}/audit`）后端**根本不存在**，
 * 实测任何不存在的子路径都返回 HTTP 200 + `code:500`，属于「看起来调通了其实没写进去」。</p>
 *
 * <p>本轮已按后端真实模型重写：**没有审核这个概念**。`prod_sop_library` 只有
 * `status`（1发布/0草稿），没有 audit_status / 审核意见 / 审核人。审核流程若产品上确实需要，
 * 属于后端缺口，另行排期，不在前端凭空造。</p>
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { KnowledgeArticle } from '@/types'

const SOP_BASE = '/admin/sop'
const KB_BASE = '/admin/knowledge'

/**
 * SOP 标准作业规程库条目。
 *
 * 字段与 `GET /admin/sop` 真实返回体逐字段对应（已实测比对，勿凭原型增改）。
 */
export interface SopLibraryItem {
  /** 规程业务主键 */
  sopId: string
  /** 作物ID（后端不返回作物名称，前端不做本地映射） */
  cropId?: string | null
  /** 规程编码 */
  sopCode?: string | null
  /** 规程名称 */
  sopName?: string | null
  /** 规程类型 PLANT 种植 / PEST 植保 / HARVEST 采收 */
  sopType?: string | null
  /** 版本号 */
  versionNo?: string | null
  /** 规程文件地址 */
  contentUrl?: string | null
  /** 适用阶段序号 */
  stageSeq?: number | null
  /** 适用区域 */
  applicableRegion?: string | null
  /** 发布人 */
  publisher?: string | null
  /** 状态 1发布 0草稿 */
  status?: number | null
  /** 创建时间 */
  createdAt?: string | null
  /** 更新时间 */
  updatedAt?: string | null
}

/**
 * 分页查询 SOP 规程库。
 *
 * @param params keyword 按规程名称模糊匹配；status 1发布 / 0草稿。两者均可空。
 */
export function listSopLibrary(
  params: PageQuery & { keyword?: string; status?: number },
): Promise<PageResult<SopLibraryItem>> {
  return http.get<PageResult<SopLibraryItem>>(SOP_BASE, params)
}

/** 查询 SOP 规程详情 */
export function getSopLibrary(sopId: string): Promise<SopLibraryItem> {
  return http.get<SopLibraryItem>(`${SOP_BASE}/${sopId}`)
}

/** 新增 SOP 规程 */
export function createSopLibrary(payload: Partial<SopLibraryItem>): Promise<string> {
  return http.post<string>(SOP_BASE, payload)
}

/** 更新 SOP 规程 */
export function updateSopLibrary(
  sopId: string,
  payload: Partial<SopLibraryItem>,
): Promise<SopLibraryItem> {
  return http.put<SopLibraryItem>(`${SOP_BASE}/${sopId}`, payload)
}

/** 删除 SOP 规程 */
export function deleteSopLibrary(sopId: string): Promise<boolean> {
  return http.delete<boolean>(`${SOP_BASE}/${sopId}`)
}

/** 按作物查规程 */
export function listSopLibraryByCrop(cropId: string): Promise<SopLibraryItem[]> {
  return http.get<SopLibraryItem[]>(`${SOP_BASE}/by-crop`, { cropId })
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
