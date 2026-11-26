/**
 * Ant Design Vue 主题（由框架无关的设计令牌派生）
 */
import { antdvTheme, BRAND_COLOR, LAYOUT_SIZE } from '../vue/antdv/theme'

export { BRAND_COLOR, LAYOUT_SIZE, antdvTheme }
// 历史主题出口保持浅色容器默认值；工作区深色侧栏由布局样式控制。
export const antdTheme = {
  ...antdvTheme,
  components: {
    ...antdvTheme.components,
    Layout: { ...antdvTheme.components.Layout, siderBg: '#ffffff' },
  },
}
