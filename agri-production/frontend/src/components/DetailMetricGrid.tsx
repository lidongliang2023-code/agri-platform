/**
 * 详情页指标卡栅格。
 *
 * <p>各详情页的顶部指标（在田面积 / 本月产量 / 进度 / 延误天数 …）统一用这一套卡片：
 * 等宽自适应网格、白底圆角、缺数据时沿用 {@link MetricStatistic} 的「— + 说明」降级，
 * 不再各页各写一套 `Row + Col + Card + Statistic`。</p>
 */
import type { CSSProperties, ReactNode } from 'react'
import { Statistic, Tooltip } from 'antd'
import MetricStatistic from './MetricStatistic'
import './DetailMetricGrid.css'

/** 单个指标卡 */
export interface DetailMetricItem {
  /** 唯一键 */
  key: string
  /** 指标标题 */
  title: string
  /** 指标值；null 或非有限数字按「缺数据」处理，字符串用于日期等非数值指标 */
  value: number | string | null
  /** 小数位 */
  precision?: number
  /** 单位后缀 */
  suffix?: ReactNode
  /** 前置内容 */
  prefix?: ReactNode
  /** 数值为 null 时的缺失说明 */
  missingTip?: string
  /** 整卡悬停提示 */
  tooltip?: string
  /** 卡片底部补充说明（利用率 / 环比等） */
  extra?: ReactNode
  /** 数值样式 */
  valueStyle?: CSSProperties
}

/** 指标卡栅格入参 */
export interface DetailMetricGridProps {
  /** 指标项 */
  items: DetailMetricItem[]
  /** 附加类名 */
  className?: string
}

/**
 * 详情页指标卡栅格。
 *
 * @param props 见 DetailMetricGridProps
 * @returns 指标卡网格
 */
export default function DetailMetricGrid({
  items,
  className = '',
}: DetailMetricGridProps): JSX.Element {
  return (
    <div className={`detail-metric-grid ${className}`.trim()}>
      {items.map((item) => {
        const isNumeric = typeof item.value === 'number' || item.value === null
        const numericValue =
          typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : null
        const content = (
          <>
            {isNumeric ? (
              <MetricStatistic
                title={item.title}
                value={numericValue}
                precision={item.precision}
                suffix={item.suffix}
                prefix={item.prefix}
                valueStyle={item.valueStyle}
                missingTip={item.missingTip}
              />
            ) : (
              <Statistic
                title={item.title}
                value={item.value as string}
                suffix={item.suffix}
                valueStyle={item.valueStyle}
              />
            )}
            {item.extra ? <div className="detail-metric-extra">{item.extra}</div> : null}
          </>
        )
        if (item.tooltip) {
          return (
            <Tooltip key={item.key} title={item.tooltip}>
              <div className="detail-metric-card">{content}</div>
            </Tooltip>
          )
        }
        return (
          <div key={item.key} className="detail-metric-card">
            {content}
          </div>
        )
      })}
    </div>
  )
}
