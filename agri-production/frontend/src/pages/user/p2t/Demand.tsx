import useAuthStore from '@/store/auth'
import BusinessRecordList from '@/components/BusinessRecordList'
/**
 * 页面名称：需求分析建议
 * 路由路径：/production/p2t/demand
 * 所属模块：产销对接
 *
 * 成交量 + 认购率 + 在架可售量 → 供需判断 → 排产建议。
 * 建议不是指令，种什么、种多少仍由农场决定；算法不使用成交价格。
 */
import { Alert, Tag, DatePicker, Button, Space } from 'antd'
import { useState } from 'react'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import PageContainer from '@/components/ProductionPageContainer'
import { fetchP2tDemandSignals } from '@/api/p2t'
import type { P2tDemandSignal } from '@/api/p2t'
import { SCROLL_BY_CONTENT, wideTextCell } from '@/components/tableScroll'

const JUDGE_TAG: Record<string, string> = {
  认购较高: 'green', 认购适中: 'blue', 认购偏低: 'orange', 数据待核查: 'red',
}

export default function P2tDemand(): JSX.Element {
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const startDate = range?.[0].format('YYYY-MM-DD')
  const endDate = range?.[1].format('YYYY-MM-DD')
  const scoped = Boolean(range)
  const query = useQuery({ queryKey: ['p2t-demand', subjectId, startDate, endDate], queryFn: () => fetchP2tDemandSignals({ startDate, endDate }), enabled: Boolean(subjectId) })
  const rows = query.data ?? []

  return (
    <PageContainer header={{ title: '需求分析建议' }}>

      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={range} onChange={(dates) => setRange(dates?.[0] && dates?.[1] ? [dates[0], dates[1]] : null)}
          disabledDate={(date) => date.isAfter(dayjs(), 'day')}
          presets={[
            { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
            { label: '本季度', value: [dayjs().month(Math.floor(dayjs().month() / 3) * 3).startOf('month'), dayjs()] },
            { label: '本年', value: [dayjs().startOf('year'), dayjs()] },
            { label: '近30天', value: [dayjs().subtract(29, 'day'), dayjs()] },
          ]} />
        <Button onClick={() => setRange(null)}>全部累计</Button>
      </Space>
      {query.isError && <Alert type="error" showIcon message="需求统计加载失败，请刷新重试" />}
      <BusinessRecordList<P2tDemandSignal>
        rowKey={(row) => JSON.stringify([row.categoryCode, row.unit])}
        columnWidthStorageKey="p2t-demand"
        onReload={() => query.refetch()}
        toolbarTitle={range ? `${startDate} 至 ${endDate}` : '累计需求统计'}
        pagination={false}
        loading={query.isLoading}
        dataSource={rows}
        className="p2t-scroll-table" scroll={SCROLL_BY_CONTENT}
        columns={[
          { title: '品类', render: (_, r) => <b>{r.categoryName ?? r.categoryCode}（{r.cropName}）</b> },
          { title: '单位', dataIndex: 'unit', width: 90 },
          { title: scoped ? '期初净认购' : '期初净认购（全部）', dataIndex: 'openingNetQty', align: 'right', hidden: !scoped },
          { title: scoped ? '期间认购' : '累计认购', dataIndex: 'periodPaidQty', align: 'right' },
          { title: scoped ? '期间取消／释放' : '取消／释放', dataIndex: 'periodReleasedQty', align: 'right' },
          { title: '期间净变化', dataIndex: 'periodNetQty', align: 'right', hidden: !scoped },
          { title: scoped ? '期末净认购量' : '净认购量', dataIndex: 'tradedQty', align: 'right', render: (v) => `${v}` },
          { title: '历史承接供给量', dataIndex: 'supplyQty', align: 'right' },
          { title: '当前在架未认购意向量', dataIndex: 'onSaleQty', align: 'right' },
          { title: '净认购率', dataIndex: 'subscriptionRate', align: 'right', render: (v) => scoped ? '—' : `${v}%` },
          { title: '供给单数', dataIndex: 'offerCount', align: 'right' },
          {
            title: '认购状态',
            dataIndex: 'judgement',
            render: (v: string) => <Tag color={JUDGE_TAG[v] ?? 'default'}>{scoped && v !== '数据待核查' ? '期间统计' : v}</Tag>,
          },
          { title: '排产建议', dataIndex: 'suggestion', ...wideTextCell('suggestion', 280), render: (value, row) => scoped ? (row.dataAnomaly ? '数据待核查，暂停形成排产建议' : '缺少历史供给快照，不按期间数据推算认购率及排产建议') : value },
        ]}
        footer={() => scoped ? '按成功回写记录时间筛选，含结束日全天；期初净认购＋期间净变化＝期末净认购（异常冲销除外）。供给及在架量为当前值，不代表历史快照；缺失回写时间的记录不计入期间统计并标记待核查。' : '累计口径：成功支付认购减取消／释放；按品类和单位分组，包含关闭供给历史。在架未认购意向量不等于仓库可发布库存。'}
        locale={{ emptyText: '还没有可分析的数据：先发布供给并等待交易端回写认购' }}
      />
    </PageContainer>
  )
}
