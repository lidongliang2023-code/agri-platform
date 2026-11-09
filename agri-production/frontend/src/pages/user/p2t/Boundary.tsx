import BusinessRecordList from '@/components/BusinessRecordList'
import { DetailInfoGrid } from '@/components'
/**
 * 页面名称：边界与归位说明
 * 路由路径：/production/p2t/boundary
 * 所属模块：产销对接
 *
 * 生产管「能产出什么」，交易管「能卖出什么」。
 * 本页是两模块的边界页：每个页面归谁、每个字段归谁、哪些事坚决不做。
 */
import { Card, Tag, Typography } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'

/**
 * 归属口径（2026-11-03 纠正）：产销对接是**两个经营主体之间**的事——
 * 生产主体在本端发起供给意向，交易撮合平台的供应商（卖家主体）自己认领并建品上架。
 * 平台运营方不做对接：不代发布意向、不代认领建品、不代定价，只留规则、对账与差异兜底。
 */
const PAGES = [
  { page: '产销对接总览', owner: '生产管理 · 用户端（经营主体发起）', group: '产销对接 / 总览', note: '以生产视角看供给与认购，交易侧指标只读' },
  { page: '品种对接表', owner: '生产管理 · 用户端（经营主体发起）', group: '产销对接 / 基础配置', note: '映射关系由生产端维护，交易端只引用品类码' },
  { page: '采收批次与可售量', owner: '生产管理 · 用户端（经营主体发起）', group: '产销对接 / 可供', note: '与既有采收管理页复用同一批次数据' },
  { page: '供给意向发布', owner: '生产管理 · 用户端（经营主体发起）', group: '产销对接 / 可供', note: '供给单唯一产生地，只有本主体能看到自己的量' },
  { page: '认购台账', owner: '生产管理 · 用户端（经营主体发起）', group: '产销对接 / 台账', note: '只读交易端回写结果' },
  { page: '生产直供供给池', owner: '交易撮合 · 供应商端（卖家主体承接）', group: '卖家中心 / 产销对接', note: '看可承接的供给意向，认领与否由卖家自己决定' },
  { page: '建品与上架', owner: '交易撮合 · 供应商端（卖家主体承接）', group: '卖家中心 / 产销对接', note: '以认领方自己的卖家主体建品，货源主体记在来源供给上' },
  { page: '撮合订单与回写', owner: '交易撮合 · 供应商端（卖家主体承接）', group: '订单管理 / 生产直供', note: '复用既有订单页，增加回写状态列' },
  { page: '产销对账', owner: '交易撮合 · 运营端（平台兜底，不做对接）', group: '数据 / 产销对账', note: '三方数据汇聚，不产生新单据' },
  { page: '全链路追踪', owner: '双端各一份', group: '—', note: '生产端看「我的货卖到哪」，交易端看「这个商品从哪来」' },
  { page: '需求反哺与排产建议', owner: '生产管理 · 用户端（经营主体发起）', group: '产销对接 / 决策', note: '信号来自交易端，建议归生产端' },
  { page: '差异与异常处置', owner: '双端各一份', group: '—', note: '短装归生产，促销归交易，各处置各的' },
  { page: '对接规则配置', owner: '交易撮合 · 运营端（平台兜底，不做对接）', group: '系统配置 / 产销对接', note: '品类映射与容差是平台规则，不替任何一方认领' },
]

export default function P2tBoundary(): JSX.Element {
  return (
    <PageContainer header={{ title: '边界与归位说明' }}>
      <Card style={{ marginBottom: 16 }}>
        <Typography.Title level={5}>一句话裁决</Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          <b>生产管「能产出什么」，交易管「能卖出什么」。</b>
          生产端只发布可供事实（品种 · 批次 · 量 · 窗口 · 等级），不碰价格、不建商品、不接订单；
          交易端只做建品、定价、上架、接单，不改产量、不改采收、不判等级。
          中间靠「供给意向」和「认购回写」两件事连起来。
          <br />
          <b>对接由两边主体自己做</b>：意向由生产主体在本端发起，承接由交易撮合平台的供应商（卖家主体）
          在卖家中心决定；平台运营方不代发意向、不代认领建品、不代定价，只保留规则、对账与差异兜底。
        </Typography.Paragraph>
      </Card>

      <Card title="页面归位表" style={{ marginBottom: 16 }}>
        <BusinessRecordList
          rowKey="page"
          size="small"
          pagination={false}
          dataSource={PAGES}
          columns={[
            { title: '页面', dataIndex: 'page' },
            { title: '落地归属', dataIndex: 'owner', render: (v: string) => <Tag color={v.includes('交易') ? 'blue' : v.includes('双端') ? 'default' : 'green'}>{v}</Tag> },
            { title: '归位后分组', dataIndex: 'group' },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>

      <Card title="字段归属">
        <DetailInfoGrid columns={1} items={[
{ label: '品种 / 品类', value: <>品种归主数据，品类归交易；本通道只存映射关系</> },
{ label: '产量 / 可上市量', value: <>生产端唯一产生，交易端只读</> },
{ label: '等级 / 质检', value: <>生产端判定，交易端引用，不可改</> },
{ label: '价格 / 商品 / 订单', value: <>交易端唯一产生，生产端不接收价格</> },
{ label: '已认购量', value: <>交易端产生，回写生产端，生产端不可手改</> },
{ label: '入仓量 / 库存', value: <>仓储管理产生，产销对账只读</> }
]} />
      </Card>

      <Card title="四条不做的事" style={{ marginTop: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>不建第二套商品</b>：生产端不建 SPU，不写商品标题、不设价格</li>
          <li><b>不建第二套库存</b>：可上市量不是库存，库存只在仓储管理</li>
          <li><b>不建第二套订单</b>：生产端不接单、不生成销售订单，只收认购回写</li>
          <li><b>不建第二套价格</b>：价格参考区间只在内部可见，不对外、不参与撮合</li>
        </ul>
      </Card>
    </PageContainer>
  )
}
