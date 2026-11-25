import { BORDER, BRAND_COLOR, FONT, LAYOUT_SIZE, SEMANTIC_COLORS, SURFACE } from '../../tokens'

export { BRAND_COLOR, LAYOUT_SIZE } from '../../tokens'

/**
 * Ant Design Vue 4 统一主题配置（与全平台 tokens / pc-ui-v1 保持一致）。
 * 使用普通结构类型，避免纯 Vue 工程缺少 ant-design-vue 类型时报错。
 */
export const antdvTheme = {
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
      siderBg: '#001529',
    },
    Menu: {
      itemBorderRadius: BORDER.radius,
      itemMarginInline: 8,
    },
    Card: {
      headerFontSize: FONT.sizeCardHeader,
    },
  },
} as const
