/**
 * 页面名称：边界与归位说明（交易视角）
 * 路由路径：/admin/trade/p2t/boundary
 * 所属模块：产销对接
 *
 * 承接与定价是**供应商主体自己**的事；平台这一侧只做回写、对账、差异与规则。
 */
import { Card, Descriptions, Tag, Typography } from 'antd'

export default function P2tBoundary(): JSX.Element {
  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Typography.Title level={5}>一句话裁决</Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          <b>生产管「能产出什么」，交易管「能卖出什么」——而"能卖出什么"由供应商主体自己决定。</b>
          承接意向、建品、定价、上架都在<b>卖家中心</b>完成（我的卖家中心 → 产销对接），
          建出来的商品归承接方主体所有，货源主体只作为来源信息留档。
          <br />
          平台运营侧不做对接：原先这里的「生产直供供给池（审核）」与「建品与上架」两条路由
          已在后端返回 <b>410</b>，页面同步下线；这里只留撮合订单与回写重试、产销对账、
          差异处置、全链路追踪与规则配置。
        </Typography.Paragraph>
      </Card>

      <Card title="字段归属" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="品种 / 品类">品种归主数据，品类归交易；通道只存映射关系</Descriptions.Item>
          <Descriptions.Item label="产量 / 可上市量">生产端唯一产生，交易端只读</Descriptions.Item>
          <Descriptions.Item label="等级 / 质检">生产端判定，交易端引用，不可改</Descriptions.Item>
          <Descriptions.Item label="是否承接一张意向">承接方供应商主体自己决定，平台不代答</Descriptions.Item>
          <Descriptions.Item label="价格 / 商品 / 订单">交易端唯一产生（归属承接方卖家主体），生产端不接收价格</Descriptions.Item>
          <Descriptions.Item label="已认购量">交易端产生，回写生产端，生产端不可手改</Descriptions.Item>
          <Descriptions.Item label="入仓量 / 库存">仓储管理产生，产销对账只读</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="交易端四个不做的事">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>不修改生产端的产量、采收记录与等级判定 <Tag color="green">只读引用</Tag></li>
          <li>不替供应商决定接不接一张意向：承接只在卖家中心点一次，商品归属承接方主体</li>
          <li>不把成交价格回传给生产端：生产端只看认购率与结构</li>
          <li>不让可售量超过「供给量 − 已认购」：超卖必须为 0</li>
        </ul>
      </Card>
    </div>
  )
}
