/**
 * 设计令牌（**框架无关**）—— 品牌色 / 语义色 / 布局尺寸 / 圆角 / 字号。
 *
 * <p>为什么单独抽出这一层：平台的前端不是同一套栈 —— 生产管理与主数据是 React + TS + antd，
 * 供应链金融与 S2B2C 是 Vue 3 + element-plus / vant 且没有 TS。此前品牌色与布局尺寸只以
 * `antd ThemeConfig` 的形式存在，Vue 侧**无处可取**，结果就是各子系统各写一个色值，
 * 「同一平台看起来像好几个产品」。</p>
 *
 * <p>所以令牌的权威定义放在这里（纯 TS 常量，无框架依赖），再由两侧各自投影：</p>
 * <ul>
 *   <li>React 侧：`styles/theme.ts` 把它转成 antd 主题；</li>
 *   <li>Vue / 任意栈：`tokens/tokens.css` 把它们投影成 CSS 变量，`import '@agri/shared/tokens/tokens.css'` 即可。</li>
 * </ul>
 *
 * <p>两份投影的一致性由 `tests/tokens.test.ts` 把关：改了一处忘另一处，门禁会红，
 * 而不是等某个子系统颜色不对了才被人发现。</p>
 */

/**
 * 品牌主色（农业绿）。
 *
 * 用户端与运营端**共用**一个主色：此前运营端另设深蓝主色与深色侧边栏来「区分两端」，
 * 导致同一套业务页在两端视觉不一致，已按「运营端风格对齐用户端」的要求统一。
 */
export const BRAND_COLOR = '#13a05a'

/** 语义色（成功 / 警告 / 错误 / 信息），与 antd 默认语义色保持一致，避免两套色板并存 */
export const SEMANTIC_COLORS = {
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1677ff',
} as const

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

/** 表面色：内容区底色 / 容器（卡片、顶栏、侧栏）底色 */
export const SURFACE = {
  contentBg: '#f5f7fa',
  containerBg: '#ffffff',
} as const

/** 圆角 */
export const BORDER = {
  radius: 6,
} as const

/** 字号 */
export const FONT = {
  sizeBase: 14,
  sizeCardHeader: 15,
} as const

/**
 * 令牌 → CSS 变量名映射。
 *
 * <p>这是 CSS 侧的唯一真源：`tokens/tokens.css` 必须与它逐项一致（有单测逐项比对）。
 * 命名统一用 `--agri-` 前缀，避免与被集成方（antd / element-plus）自己的变量撞名。</p>
 */
export const CSS_VARIABLES: Record<string, string> = {
  '--agri-brand-color': BRAND_COLOR,
  '--agri-color-success': SEMANTIC_COLORS.success,
  '--agri-color-warning': SEMANTIC_COLORS.warning,
  '--agri-color-error': SEMANTIC_COLORS.error,
  '--agri-color-info': SEMANTIC_COLORS.info,
  '--agri-content-bg': SURFACE.contentBg,
  '--agri-container-bg': SURFACE.containerBg,
  '--agri-radius': `${BORDER.radius}px`,
  '--agri-font-size-base': `${FONT.sizeBase}px`,
  '--agri-font-size-card-header': `${FONT.sizeCardHeader}px`,
  '--agri-sider-width': `${LAYOUT_SIZE.siderWidth}px`,
  '--agri-sider-collapsed-width': `${LAYOUT_SIZE.siderCollapsedWidth}px`,
  '--agri-header-height': `${LAYOUT_SIZE.headerHeight}px`,
  '--agri-content-padding': `${LAYOUT_SIZE.contentPadding}px`,
}
