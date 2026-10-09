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
  /** 单位后缀 */
  suffix?: string
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
