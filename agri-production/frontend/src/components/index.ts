/**
 * 通用组件统一出口
 */
export { default as PagePlaceholder } from './PagePlaceholder'
export type { PagePlaceholderProps, PlaceholderKind } from './PagePlaceholder'
export { default as PageLoading } from './PageLoading'
export { default as DemoDataAlert } from './DemoDataAlert'
export type { DemoDataAlertProps } from './DemoDataAlert'
export {
  default as MetricStatistic,
  MetricText,
  MetricNumber,
  MISSING_VALUE_TEXT,
  MISSING_VALUE_TIP,
} from './MetricStatistic'
export type {
  MetricStatisticProps,
  MetricTextProps,
  MetricNumberProps,
} from './MetricStatistic'
