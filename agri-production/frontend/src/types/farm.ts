/**
 * 再导出桩（B2 最后一刀，2026-10-11）
 *
 * 真源已迁至 @agri/shared/types/farm。本文件保留，是为了让仍按子路径引用的
 * 消费方（@/types/farm）无需改动即可继续工作 —— 其中有 2 处落在他人正在编辑的文件里
 * （TaskMonitor.tsx / DashboardHome.tsx），改它们会构成对他人在途文件的二次改动。
 * 待九大前端拆分、或那些文件的主人落库后，可直接把这些引用改指 @agri/shared 并删掉本桩。
 */
/**
 * @deprecated 真源已是 `@agri/shared/types/farm`（唯一权威定义）；本桩仅为兼容
 * 仍按子路径引用的旧代码（`@/types/farm`）。按 V2.0 第 4.8 节「废弃策略」保留
 * 至少一个 major 过渡期后再删除。TypeScript 无法对 `export *` 做符号级标注，
 * 故废弃声明只能写在注释里 —— 编辑器不会显示删除线，这不是漏标。
 */
export * from '@agri/shared/types/farm'
