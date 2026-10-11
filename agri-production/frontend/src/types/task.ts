/**
 * 再导出桩（B2 最后一刀，2026-10-11）
 *
 * 真源已迁至 @agri/shared/types/task。本文件保留，是为了让仍按子路径引用的
 * 消费方（@/types/task）无需改动即可继续工作 —— 其中有 2 处落在他人正在编辑的文件里
 * （TaskMonitor.tsx / DashboardHome.tsx），改它们会构成对他人在途文件的二次改动。
 * 待九大前端拆分、或那些文件的主人落库后，可直接把这些引用改指 @agri/shared 并删掉本桩。
 */
/**
 * @deprecated 真源已是 `@agri/shared/types/task`（唯一权威定义，含 TASK_STATUS_* 等
 * 运行时常量）；本桩仅为兼容仍按子路径引用的旧代码（`@/types/task`，共 8 处，
 * 其中 2 处落在 TaskMonitor.tsx / DashboardHome.tsx 这两个他人在途文件内）。
 * 按 V2.0 第 4.8 节「废弃策略」保留至少一个 major 过渡期后再删除。
 */
export * from '@agri/shared/types/task'
