import useAuthStore from '@/store/auth'
import Table from '@/components/BusinessRecordList'
/**
 * 页面名称：产销对接总览
 * 路由路径：/production/p2t
 * 所属模块：产销对接
 *
 * 以生产视角看供给与认购：KPI、最近供给意向、待办提醒。
 * 交易侧指标只读；价格不在本模块展示。
 */
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '@/components/ProductionPageContainer'
import { Link } from 'react-router-dom'
import { fetchP2tOverview, listP2tOffers } from '@/api/p2t'
import type { P2tOffer } from '@/api/p2t'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'

const AUDIT_TAG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待承接', color: 'orange' },
  APPROVED: { text: '已承接', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
}

const TRADE_TAG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待建品', color: 'default' },
  LISTED: { text: '已上架', color: 'green' },
  SOLD: { text: '已售罄', color: 'blue' },
  CLOSED: { text: '已关闭', color: 'default' },
}

export default function P2tOverview(): JSX.Element {
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const overviewQuery = useQuery({ queryKey: ['p2t-overview', subjectId], queryFn: fetchP2tOverview })
  const offersQuery = useQuery({
    queryKey: ['p2t-overview-offers', subjectId],
    queryFn: () => listP2tOffers({ pageNum: 1, pageSize: 6 }),
  })
  const formatUnits = (values?: Record<string, number>) => Object.entries(values ?? {}).map(([unit, qty]) => `${qty} ${unit}`).join(" / ") || "—"
  const data = overviewQuery.data
  const offers = offersQuery.data?.list ?? []

  return (
    <PageContainer header={{ title: '产销工作台' }}>


      {overviewQuery.isError && <Alert type="error" showIcon message="工作台统计加载失败，未取得的数据不按零处理" action={<Button onClick={() => void overviewQuery.refetch()}>重试</Button>} />}
      {overviewQuery.isPending && <Alert type="info" message="正在加载工作台统计…" />}
      <Space wrap style={{ marginBottom: 16 }}><Link to="/production/p2t/offers">管理供给</Link><Link to="/production/p2t/batches">选择可发布批次</Link><Link to="/production/p2t/boundary">业务口径与协作说明</Link></Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="供给占用" value={formatUnits(data?.supplyByUnit)} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已认购量" value={formatUnits(data?.reservedByUnit)} />

          </Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待承接供给" value={data?.pendingAudit ?? '—'} suffix="笔" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待处置差异" value={data?.pendingDiff ?? '—'} suffix="笔" /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="采收批次" value={data?.batchCount ?? '—'} suffix="批" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="批次总产量" value={formatUnits(data?.harvestByUnit)} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已对接品种" value={data?.mappedVarieties ?? '—'} suffix="个" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已上架供给" value={data?.listedCount ?? '—'} suffix="笔" /></Card>
        </Col>
      </Row>

      <Card
        title="最近供给意向"
        extra={<Link to="/production/p2t/offers">全部 ↗</Link>}
        style={{ marginBottom: 16 }}
      >
        {offersQuery.isError ? <Alert type="error" message="最近供给加载失败" action={<Button onClick={() => void offersQuery.refetch()}>重试</Button>} /> : offersQuery.isPending ? <Typography.Text>正在加载供给…</Typography.Text> : offers.length === 0 ? (
          <Empty description="还没有供给意向，请到供给管理选择可发布批次创建" />
        ) : (
          <Table<P2tOffer>
            rowKey="offerNo"
            size="small"
            pagination={false}
            dataSource={offers}
            className="p2t-scroll-table" scroll={SCROLL_BY_CONTENT}
            columns={[
              { title: '供给单号', dataIndex: 'offerNo', width: 170, render: (_, row) => <Link to={`/production/p2t/offers?offerNo=${encodeURIComponent(row.offerNo)}`}>{row.offerNo}</Link> },
              {
                title: '品种 / 批次',
                render: (_, row) => (
                  <div>
                    <b>{row.cropName}{row.varietyName ? `·${row.varietyName}` : ''}</b>
                    <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.batchNo}</Typography.Text></div>
                  </div>
                ),
              },
              { title: '可供量', dataIndex: 'availableQty', align: 'right', render: (v, r) => `${v} ${r.unit}` },
              { title: '已认购', dataIndex: 'reservedQty', align: 'right', render: (v, r) => `${v} ${r.unit}` },
              { title: '上市窗口', render: (_, r) => (r.windowStart ? `${r.windowStart} ~ ${r.windowEnd}` : '—') },
              {
                title: '审核',
                dataIndex: 'auditStatus',
                render: (v: string) => <Tag color={AUDIT_TAG[v]?.color}>{AUDIT_TAG[v]?.text ?? v}</Tag>,
              },
              {
                title: '交易状态',
                dataIndex: 'tradeStatus',
                render: (v: string) => <Tag color={TRADE_TAG[v]?.color}>{TRADE_TAG[v]?.text ?? v}</Tag>,
              },
            ]}
          />
        )}
      </Card>

      <Card title="协同事项（待承接由交易方处理）">
        {data && (data?.pendingAudit ?? '—') === 0 && (data?.pendingDiff ?? '—') === 0 ? (
          <Typography.Text type="secondary">暂无待办</Typography.Text>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data && (data?.pendingAudit ?? 0) > 0 && (
              <li style={{ marginBottom: 6 }}>
                <Tag color="orange">待承接</Tag> 还有 {data?.pendingAudit} 笔供给在等供应商承接 ·
                <Link to="/production/p2t/offers"> 查看供给单</Link>
              </li>
            )}
            {(data?.pendingDiff ?? 0) > 0 && (
              <li>
                <Tag color="red">差异</Tag> 有 {data?.pendingDiff} 笔差异待处置 ·
                <Link to="/production/p2t/diffs"> 去处置</Link>
              </li>
            )}
          </ul>
        )}
      </Card>
    </PageContainer>
  )
}
