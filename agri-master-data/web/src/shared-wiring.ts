/**
 * 共享包接线自检（由 ops/workspace/onboard-app.mjs 生成，请勿手工删除）。
 *
 * 作用是把「本子系统与 @agri/shared 的接线是否成立」变成会立刻报错的事实：
 * import type 走 tsconfig 的 paths 映射（写错则编译失败）；运行时 import 走 Vite alias
 * （写错则构建失败）。两条都通过，才说明共享包真的接上了。
 *
 * 它同时把平台品牌色注入为 CSS 变量 --agri-brand-color（与共享包 global.less 同名）：
 * 即使本子系统尚未切换到统一 antd 主题，品牌色也只有一个来源，而不是各写一个色值。
 */
import type { Task } from '@agri/shared/types/task'
import { BRAND_COLOR } from '@agri/shared/styles/theme'

/** 类型侧接线证明：能用共享包的类型即说明 paths 生效 */
export type WiringProbe = Pick<Task, 'taskId' | 'taskNo'>

/** 运行时侧接线证明：值取自共享包 */
export const SHARED_BRAND_COLOR: string = BRAND_COLOR

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--agri-brand-color', BRAND_COLOR)
}
