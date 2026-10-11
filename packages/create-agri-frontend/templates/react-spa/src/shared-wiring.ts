/**
 * 共享包接线自检 —— 本子系统与 `@agri/shared` 之间唯一的显式契约点。
 *
 * 它存在的意义是把「接线是否正确」变成会立刻报错的事实，而不是等写业务时才发现：
 *
 * - `import type` 走 tsc 的 `paths` 映射 → 映射写错会编译失败（TS2307）；
 * - 运行时 import 走 Vite alias → alias 写错会构建失败；
 * - 二者都通过，才说明「共享包接上了」。
 *
 * 请不要因为「这里没有业务」而删掉本文件；删掉之后接线断了也不会有人发现。
 */
import type { Task, TaskStatus } from '@agri/shared/types/task'
import { PLOT_STATUS_META } from '@agri/shared/types/farm'
import { BRAND_COLOR, LAYOUT_SIZE } from '@agri/shared/styles/theme'

/** 运行时取自共享包的值（页面会渲染出来，肉眼可核对）。 */
export const WIRING_CHECK = {
  brandColor: BRAND_COLOR,
  siderWidth: LAYOUT_SIZE.siderWidth,
  plotStatusCount: Object.keys(PLOT_STATUS_META).length,
} as const

/** 类型取自共享包（能通过编译即证明类型路径映射生效）。 */
export type WiringCheckTask = Pick<Task, 'taskId' | 'taskNo'> & { status: TaskStatus }
