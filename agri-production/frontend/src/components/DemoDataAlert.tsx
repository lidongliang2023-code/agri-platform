/**
 * 示例数据提示条（演示模式）
 *
 * 使用场景：页面数据层已降级为本地内置示例数据（queryFn 返回 `demo: true`）时，
 * 必须在页面顶部渲染本组件，明确告知使用者：
 *   ① 当前看到的是示例数据；
 *   ② 数据来自前端本地样例，不是服务端返回；
 *   ③ 页面上的写操作（如有）不会落库。
 *
 * 设计原则（项目铁规矩）：可以降级，不能骗人——降级必须让用户看得见。
 * 因此本组件使用 warning 类型 + banner 样式，占据整行宽度，不允许弱化成一
 * 行灰色小字。
 */
import { Alert, Space, Tag, Typography } from 'antd'

/** 示例数据提示条入参 */
export interface DemoDataAlertProps {
  /**
   * 示例数据的覆盖范围说明，用于把「表格之外」的示例数据也点出来，
   * 例如：'顶部统计卡、左侧分类树条目数与下方列表'
   */
  scope: string
  /**
   * 写操作提示语。强烈建议每个页面按实际行为显式传入：
   * - 若写操作会改本地示例数据 → 说明「仅改本地内存，未写入服务端，刷新后失效」；
   * - 若写操作已改为诚实失败（既不落库也不改本地）→ 说明「不会写入服务端，失败会如实提示」。
   *
   * 默认值只陈述「演示模式下一定成立」的那部分（写操作不会写入服务端），
   * **不**断言是否会改动本地内存——因为各模块实现不一致，断言具体行为会对
   * 部分模块失真。因此默认值仅作兜底，不能替代各页的准确口径。
   */
  writeNote?: string
}

/**
 * 默认写操作提示语（兜底用，偏保守：宁可多提示，不可漏提示）
 *
 * 只写「不会写入服务端」这一条在演示模式下恒真的结论；是否改动本地示例数据
 * 由各页通过 writeNote 自行说明，避免默认值对「已改为诚实失败」的模块失真。
 */
const DEFAULT_WRITE_NOTE =
  '页面上的新增 / 编辑 / 审核 / 启用停用 / 删除等写操作不会写入服务端；其具体行为（是仅改动本地示例数据，还是直接失败并如实提示）以本页实际操作提示为准。'

/**
 * 示例数据提示条
 * @param props 见 DemoDataAlertProps
 * @returns 醒目（warning + banner）的示例数据提示
 */
export default function DemoDataAlert({
  scope,
  writeNote = DEFAULT_WRITE_NOTE,
}: DemoDataAlertProps): JSX.Element {
  return (
    <Alert
      banner
      showIcon
      type="warning"
      message={
        <Space size={8} wrap>
          <Typography.Text strong>当前展示的是示例数据（演示模式）</Typography.Text>
          <Tag color="orange" style={{ marginInlineEnd: 0 }}>
            非服务端真实数据
          </Tag>
        </Space>
      }
      description={
        <Space direction="vertical" size={2}>
          <Typography.Text>
            数据来源为前端本地内置样例，后端接口未返回数据（接口不可用或暂无数据），页面已自动降级展示。
          </Typography.Text>
          <Typography.Text>示例数据覆盖范围：{scope}。</Typography.Text>
          {writeNote ? <Typography.Text>{writeNote}</Typography.Text> : null}
        </Space>
      }
    />
  )
}
