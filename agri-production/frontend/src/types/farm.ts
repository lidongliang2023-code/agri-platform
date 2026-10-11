/**
 * 再导出桩（B2 最后一刀，2026-10-11）
 *
 * 真源已迁至 @agri/shared/types/farm。本文件保留，是为了让仍按子路径引用的
 * 消费方（@/types/farm）无需改动即可继续工作 —— 其中有 2 处落在他人正在编辑的文件里
 * （TaskMonitor.tsx / DashboardHome.tsx），改它们会构成对他人在途文件的二次改动。
 * 待九大前端拆分、或那些文件的主人落库后，可直接把这些引用改指 @agri/shared 并删掉本桩。
 */
export * from '@agri/shared/types/farm'