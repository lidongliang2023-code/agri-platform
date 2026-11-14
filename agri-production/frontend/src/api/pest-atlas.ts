import { http } from '@/utils/request'
import type { PageResult } from '@/types'

export interface PestAtlasEntry {
  id: string
  revision: number
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  cropName: string
  cropAliases: string[]
  diseaseName: string
  diseaseAliases: string[]
  symptomKeywords: string[]
  affectedParts: string[]
  growthStages: string[]
  identification: string
  differential: string
  measures: string
  source: string
  sourceVersion: string
  sourceRef: string
  articleId?: string
  quarantine: boolean
}
export interface AtlasReference extends PestAtlasEntry {
  referenceId: string
  matchedKeywords: string[]
  retrievalScore: number
}
export interface KnowledgeSnapshot {
  status: 'MATCHED' | 'NO_MATCH'
  method: string
  retrievedAt: string
  cropName: string
  references: AtlasReference[]
  notice: string
}
export interface PestImageSample {
  id: string
  atlas_id: string
  atlas_revision: number
  sample_revision: number
  crop_name: string
  disease_name: string
  image_url: string
  image_sha256: string
  image_phash: string
  width: number
  height: number
  source: string
  source_version: string
  source_ref: string
  note?: string
  status: 'DRAFT' | 'PUBLISHED' | 'OFFLINE'
  created_by: string
  created_at: string
  updated_at: string
  published_at?: string
}
export interface ImageSearchReference {
  sampleId: string
  atlasId: string
  revision: number
  cropName: string
  diseaseName: string
  imageUrl: string
  distance: number
  similarity: number
  source: string
  sourceVersion: string
  sourceRef: string
}
export interface ImageSearchSnapshot {
  status: 'MATCHED' | 'NO_MATCH'
  method: string
  references: ImageSearchReference[]
  notice: string
}
const BASE = '/admin/knowledge/pest-atlas'
export const listPestAtlas = (params: { keyword?: string; status?: string; pageNum: number; pageSize: number }): Promise<PageResult<PestAtlasEntry>> => http.get(BASE, params)
export const savePestAtlas = (entry: Partial<PestAtlasEntry>): Promise<PestAtlasEntry> => entry.id ? http.put(`${BASE}/${entry.id}`, entry) : http.post(BASE, entry)
export const publishPestAtlas = (entry: PestAtlasEntry): Promise<PestAtlasEntry> => http.patch(`${BASE}/${entry.id}/publish`, { revision: entry.revision, published: entry.status !== 'PUBLISHED' })
export const searchPestAtlas = (params: { cropName: string; symptoms: string; growthStage?: string }): Promise<KnowledgeSnapshot> => http.get('/ai/pest-detection/knowledge-search', params)
export const listPestImageSamples = (params: { atlasId?: string; status?: string }): Promise<PestImageSample[]> => http.get('/admin/knowledge/pest-images', params)
export async function uploadPestImageSample(file: File, values: { atlasId: string; atlasRevision: number; source: string; sourceVersion: string; sourceRef: string; note?: string }): Promise<{ id: string; imageUrl: string; width: number; height: number }> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('仅支持JPEG或PNG病斑图片')
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('病斑图片大小需在1字节至5MB之间')
  const form = new FormData()
  form.append('file', file)
  Object.entries(values).forEach(([key, value]) => form.append(key, String(value ?? '')))
  return http.post('/admin/knowledge/pest-images', form, { headers: { 'Content-Type': undefined }, timeout: 60000 })
}
export const publishPestImageSample = (row: PestImageSample): Promise<PestImageSample> => http.patch(`/admin/knowledge/pest-images/${row.id}/publish`, { published: row.status !== 'PUBLISHED' })
