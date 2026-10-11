/**
 * 全局主题 Token
 *
 * 统一在 ConfigProvider 上注入，保证用户端 / 运营端视觉一致。
 */
import type { ThemeConfig } from 'antd'

/**
 * 品牌主色（农业绿）。
 *
 * 用户端与运营端**共用**一个主色：此前运营端另设深蓝主色与深色侧边栏来「区分两端」，
 * 导致同一套业务页在两端视觉不一致，已按「运营端风格对齐用户端」的要求统一。
 */
export const BRAND_COLOR = '#13a05a'

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

