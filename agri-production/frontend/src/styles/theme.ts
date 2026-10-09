/**
 * 全局主题 Token
 *
 * 统一在 ConfigProvider 上注入，保证用户端 / 运营端视觉一致。
 */
import type { ThemeConfig } from 'antd'

/** 品牌主色（农业绿） */
export const BRAND_COLOR = '#13a05a'
/** 运营端主色（深蓝，用于区分用户端） */
export const ADMIN_COLOR = '#1677ff'

/** 布局尺寸常量 */
export const LAYOUT_SIZE = {
  /** 侧边栏展开宽度 */
  siderWidth: 220,
  /** 侧边栏折叠宽度 */
  siderCollapsedWidth: 72,
  /** 顶栏高度 */
  headerHeight: 56,
  /** 内容区内边距 */
  contentPadding: 16,
} as const

/** antd 主题配置 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLOR,
    borderRadius: 6,
    fontSize: 14,
    colorBgLayout: '#f5f7fa',
  },
  components: {
    Layout: {
      bodyBg: '#f5f7fa',
      headerBg: '#ffffff',
      headerHeight: LAYOUT_SIZE.headerHeight,
      siderBg: '#ffffff',
    },
    Menu: {
      itemBorderRadius: 6,
      itemMarginInline: 8,
    },
    Card: {
      headerFontSize: 15,
    },
  },
}

/** 运营端主题配置（深色侧边栏由 Layout 组件单独控制） */
export const antdAdminTheme: ThemeConfig = {
  ...antdTheme,
  token: {
    ...antdTheme.token,
    colorPrimary: ADMIN_COLOR,
  },
}
