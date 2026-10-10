/**
 * 指标值展示组件（数据源缺失时显式降级）
 *
 * 背景：此前看板类页面把「后端没返回的字段」用本地示例值 / 0 顶上，
 * 用户在同一张卡片上看到真数和假数混排却分不出来。
 *
 * 纪律（项目铁规矩）：
 * - 后端没有的字段显示「—」，不许本地算、不许填 0、不许填随机数；
 * - 降级必须让用户看得见：缺失值旁给出警示图标 + Tooltip 说明「后端暂无该指标数据源」。
 *
 * 因此本组件在 `value === null` 时渲染灰色「—」+ 橙色信息图标（hover 出提示），
 * 而不是渲染一个看起来正常的数字。
 */
import type { CSSProperties, ReactNode } from 'react'
import { Space, Statistic, Tooltip, Typography } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { formatMetric, toFiniteNumber } from '@/utils/metric-format'

/** 缺失值展示文案 */
export const MISSING_VALUE_TEXT = '—'

/** 缺失值默认提示语 */
export const MISSING_VALUE_TIP = '后端暂无该指标数据源，显示为「—」，接口补齐后自动填充'

/** 指标值展示组件入参 */
export interface MetricStatisticProps {
  /** 指标标题 */
  title: string
  /** 指标值；null 表示后端未提供该数据源 */
  value: number | null
  /** 小数位，缺省 0 */
  precision?: number
  /** 单位后缀（与 antd `Statistic` 一致，允许传图标等节点） */
  suffix?: ReactNode
  /** 前置内容（图标等） */
  prefix?: ReactNode
  /** 数值样式 */
  valueStyle?: CSSProperties
  /** 缺失时的自定义提示语 */
  missingTip?: string
}

/**
 * 指标值展示组件。
 *
 * @param props 见 MetricStatisticProps
 * @returns 数值，或带可见提示的「—」
 */
export default function MetricStatistic({
  title,
  value,
  precision = 0,
  suffix,
  prefix,
  valueStyle,
  missingTip = MISSING_VALUE_TIP,
}: MetricStatisticProps): JSX.Element {
  if (value === null) {
    return (
      <Tooltip title={missingTip}>
        <Statistic
          title={
            <Space size={4}>
              <span>{title}</span>
              <InfoCircleOutlined style={{ fontSize: 12, color: '#faad14' }} />
            </Space>
          }
          value={MISSING_VALUE_TEXT}
          valueStyle={{ color: '#bfbfbf', ...valueStyle }}
        />
      </Tooltip>
    )
  }
  return (
    <Statistic
      title={title}
      value={value}
      precision={precision}
      suffix={suffix}
      prefix={prefix}
      valueStyle={valueStyle}
    />
  )
}

/** 行内数值入参（表格列 / 描述项 / 卡片大数等任意位置） */
export interface MetricNumberProps {
  /**
   * 指标值。
   *
   * 类型是 `unknown` 而不是 `number`：调用方拿到的本来就是后端原始字段，
   * 运行时可能是 undefined / 数字字符串 / null。若这里仍标 `number`，
   * TypeScript 会「担保」`value.toLocaleString()` 一定安全，
   * 而这个担保正是本项目两处整页崩溃（`DisasterReview` / `KnowledgeBase`）的来源。
   */
  value: unknown
  /** 小数位，缺省 0 */
  precision?: number
  /** 区域，缺省 zh-CN */
  locale?: string
  /** 单位后缀，如「 亩」 */
  suffix?: string
  /** 前置内容，如「¥ 」 */
  prefix?: ReactNode
  /** 数值样式 */
  style?: CSSProperties
  /** 缺失时的自定义提示语 */
  missingTip?: string
}

/**
 * 行内数值（表格列 / Descriptions / 卡片大数通用）。
 *
 * 与 `MetricText` 的区别：入参收 `unknown`（后端原始字段），
 * 内部先经 `toFiniteNumber` 判定，缺失时渲染「—」+ 橙色信息图标（hover 出提示），
 * **不渲染 0、不渲染空白**。
 *
 * @param props 见 MetricNumberProps
 * @returns 千分位数值，或带可见提示的「—」
 */
export function MetricNumber({
  value,
  precision = 0,
  locale = 'zh-CN',
  suffix = '',
  prefix,
  style,
  missingTip = MISSING_VALUE_TIP,
}: MetricNumberProps): JSX.Element {
  const numeric = toFiniteNumber(value)
  if (numeric === null) {
    return (
      <Tooltip title={missingTip}>
        <Typography.Text type="secondary" style={{ cursor: 'help', ...style }}>
          {MISSING_VALUE_TEXT}
          <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
        </Typography.Text>
      </Tooltip>
    )
  }
  return (
    <Typography.Text style={style}>
      {prefix}
      {formatMetric(numeric, {
        locale,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })}
      {suffix}
    </Typography.Text>
  )
}

/** 行内指标文案入参 */
export interface MetricTextProps {
  /** 指标值；null 表示后端未提供该数据源 */
  value: number | null
  /** 小数位，缺省 0 */
  precision?: number
  /** 单位后缀 */
  suffix?: string
  /** 缺失时的自定义提示语 */
  missingTip?: string
}

/**
 * 行内指标文案（用于副标题 / 表格等不适合放整块 Statistic 的位置）。
 *
 * @param props 见 MetricTextProps
 * @returns 数值文案，或带可见提示的「—」
 */
export function MetricText({
  value,
  precision = 0,
  suffix = '',
  missingTip = MISSING_VALUE_TIP,
}: MetricTextProps): JSX.Element {
  if (value === null) {
    return (
      <Tooltip title={missingTip}>
        <Typography.Text type="secondary" style={{ cursor: 'help' }}>
          {MISSING_VALUE_TEXT}
          <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
        </Typography.Text>
      </Tooltip>
    )
  }
  return (
    <Typography.Text>
      {value.toLocaleString('zh-CN', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })}
      {suffix}
    </Typography.Text>
  )
}
