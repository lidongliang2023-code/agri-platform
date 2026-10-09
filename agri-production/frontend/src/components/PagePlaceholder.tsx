/**
 * 页面占位组件
 *
 * 在本轮「基建与占位」阶段，全部 75 个页面统一使用该组件渲染标准骨架：
 * Card（页面标题） + Alert（待实现提示） + Empty（内容区占位）。
 * 后续按原型填充页面时，只需替换本组件为真实的 ProTable / Form / Row-Col 结构。
 *
 * 标准骨架参考（填充页面时按页型选用）：
 *
 * 列表页：
 *   <ProTable columns={columns} request={...} rowKey="id" search={{ labelWidth: 'auto' }} />
 *
 * 表单页：
 *   <ProForm onFinish={...}><ProFormText name="x" label="y" /></ProForm>
 *
 * 详情 / 看板页：
 *   <Row gutter={16}><Col span={12}><Card>...</Card></Col></Row>
 */
import { Alert, Card, Empty, Space, Tag, Typography } from 'antd'
import type { ReactNode } from 'react'

/** 占位页类型，仅影响骨架提示文案 */
export type PlaceholderKind = 'table' | 'form' | 'detail' | 'dashboard'

/** 占位组件入参 */
export interface PagePlaceholderProps {
  /** 页面标题 */
  title: string
  /** 页面描述：通常写清楚该页后续要承载的业务 */
  description?: string
  /** 页面类型，用于给出对应的骨架建议 */
  kind?: PlaceholderKind
  /** 标题右侧额外操作区 */
  extra?: ReactNode
}

/** 各页型对应的骨架建议 */
const SKELETON_HINT: Record<PlaceholderKind, string> = {
  table: '骨架：ProTable（columns + request + search + toolBarRender）',
  form: '骨架：ProForm（分组表单 + 校验规则 + 提交/重置）',
  detail: '骨架：Row/Col + Descriptions + Tabs + 时间线',
  dashboard: '骨架：Row/Col + 指标卡 + ECharts 图表（ReactECharts）',
}

/**
 * 页面占位组件
 * @param props 见 PagePlaceholderProps
 * @returns 标准化的占位页面内容
 */
export default function PagePlaceholder({
  title,
  description,
  kind = 'table',
  extra,
}: PagePlaceholderProps): JSX.Element {
  return (
    <Card title={title} extra={extra} className="agri-page-placeholder">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="该页面待实现"
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text type="secondary">
                {description ?? '本页将在原型评审后按 PRD 细则填充业务实现。'}
              </Typography.Text>
              <Typography.Text type="secondary">{SKELETON_HINT[kind]}</Typography.Text>
            </Space>
          }
        />
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Tag color="default">暂无数据</Tag>} />
      </Space>
    </Card>
  )
}
