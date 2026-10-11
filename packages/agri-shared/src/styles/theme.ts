/**
 * antd 主题（由框架无关的设计令牌派生）
 *
 * 统一在 ConfigProvider 上注入，保证用户端 / 运营端视觉一致。
 *
 * <p>所有色值与尺寸都取自 `../tokens`，本文件不再自己写死任何值 —— 否则就会出现
 * 「antd 主题一套值、CSS 变量另一套值」，而 Vue 侧只能读后者，两边越走越远。</p>
 */
import type { ThemeConfig } from 'antd'
import { BORDER, BRAND_COLOR, FONT, LAYOUT_SIZE, SEMANTIC_COLORS, SURFACE } from '../tokens'

// 兼容既有引用路径：应用侧一直在用 `@agri/shared/styles/theme` 取这两项，改路径会波及全部消费方。
export { BRAND_COLOR, LAYOUT_SIZE } from '../tokens'

/** antd 主题配置 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLOR,
    colorSuccess: SEMANTIC_COLORS.success,
    colorWarning: SEMANTIC_COLORS.warning,
    colorError: SEMANTIC_COLORS.error,
    colorInfo: SEMANTIC_COLORS.info,
    borderRadius: BORDER.radius,
    fontSize: FONT.sizeBase,
    colorBgLayout: SURFACE.contentBg,
  },
  components: {
    Layout: {
      bodyBg: SURFACE.contentBg,
      headerBg: SURFACE.containerBg,
      headerHeight: LAYOUT_SIZE.headerHeight,
      siderBg: SURFACE.containerBg,
    },
    Menu: {
      itemBorderRadius: BORDER.radius,
      itemMarginInline: 8,
    },
    Card: {
      headerFontSize: FONT.sizeCardHeader,
    },
  },
}

