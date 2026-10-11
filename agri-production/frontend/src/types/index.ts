/**
 * 实体类型统一出口
 *
 * 页面与 API 层统一从 '@/types' 引入，避免深层相对路径。
 *
 * B2a 迁移尝试（2026-10-11）已回退，原因见交付说明：
 *   1) TypeScript 模块解析不认 package.json 的 exports 子路径（@agri/shared/types/*）；
 *   2) ./common 被尚未迁移的 farm / task / harvest 依赖，无法单独搬走。
 * 共享包 packages/agri-shared/src/types/ 下保留了那 14 个文件的副本，供下一轮改用
 * tsconfig paths 映射（而非 exports 子路径）后重新迁移。
 */
export * from '@agri/shared/types/common'
export * from './farm'
export * from '@agri/shared/types/plan'
export * from './task'
export * from './input'
export * from '@agri/shared/types/growth'
export * from '@agri/shared/types/alert'
export * from '@agri/shared/types/iot'
export * from './harvest'
export * from '@agri/shared/types/quality'
export * from '@agri/shared/types/trace'
export * from '@agri/shared/types/blockchain'
export * from '@agri/shared/types/ai'
export * from '@agri/shared/types/analytics'
export * from './member'
export * from '@agri/shared/types/tenant'
export * from '@agri/shared/types/approval'
