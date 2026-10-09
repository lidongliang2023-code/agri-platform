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
   * 写操作提示语，默认给出通用口径：强调「仅本地生效、未写入服务端」。
   * 页面可按实际操作范围传入更具体的说明；确认为纯只读页面时传入空串可隐藏该条。
   */
  writeNote?: string
}

/** 默认写操作提示语（偏保守：宁可多提示，不可漏提示） */
const DEFAULT_WRITE_NOTE =
  '页面上的新增 / 编辑 / 审核 / 启用停用 / 删除等操作只会修改浏览器本地内存中的示例数据，未写入服务端，刷新页面后即失效。'

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
