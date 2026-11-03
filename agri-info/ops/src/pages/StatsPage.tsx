import { useEffect, useState } from 'react'
import { Button, Table } from 'antd'
import { opsApi } from '../api'
import type { StatsAdmin } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui'

/** 统计报表：内容、渠道、供需、AI 与专家的运营成效汇总，支持导出（演示环境提示）。 */
export function StatsPage(): JSX.Element {
  const [data, setData] = useState<StatsAdmin | null>(null)
  const [error, setError] = useState('')

  const load = (): void => {
    setError('')
    opsApi.stats().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  const maxChannelRead = Math.max(...data.channelStats.map((item) => item.readTotal), 1)

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="STATISTICS"
        title="统计报表"
        description="内容生产与消费、供需撮合、AI 服务与专家答疑的运营成效汇总 · 数据 T+0 更新"
        actions={<Button onClick={() => window.print()}>导出 / 打印</Button>}
      />

      <div className="grid-4">
        <StatTile label="内容总量" value={data.content.total} unit="篇" note={`已发布 ${data.content.published} 篇`} />
        <StatTile label="累计阅读" value={formatCount(data.content.readTotal)} unit="次" note="全站 PV" tone="up" />
        <StatTile label="互动总量" value={formatCount(data.content.likeTotal + data.content.commentTotal)} unit="次" note={`赞 ${formatCount(data.content.likeTotal)} · 评 ${data.content.commentTotal}`} />
        <StatTile label="供需浏览" value={formatCount(data.sdStats.viewTotal)} unit="次" note={`在线 ${data.sdStats.online} 条`} tone="up" />
      </div>

      <div className="grid-main-aside">
        <section className="surface-card">
          <SectionHeading kicker="CHANNEL PERFORMANCE" title="栏目表现" />
          <Table
            rowKey="channel"
            size="middle"
            pagination={false}
            dataSource={data.channelStats}
            columns={[
              { title: '栏目', dataIndex: 'channel', width: 140 },
              { title: '内容量', dataIndex: 'total', width: 100 },
              { title: '阅读量', dataIndex: 'readTotal', width: 140, render: (value: number) => formatCount(value) },
              {
                title: '占比',
                dataIndex: 'readTotal',
                render: (value: number) => (
                  <div className="bar-cell">
                    <span className="bar-track"><i style={{ width: `${(value / maxChannelRead) * 100}%` }} /></span>
                    <small>{((value / Math.max(data.content.readTotal, 1)) * 100).toFixed(1)}%</small>
                  </div>
                ),
              },
            ]}
          />
        </section>

        <div className="stack">
          <section className="surface-card">
            <SectionHeading kicker="SUPPLY & DEMAND" title="供需结构" />
            <div className="kv-list">
              <div className="kv"><span>在线信息</span><b>{data.sdStats.online} 条</b></div>
              <div className="kv"><span>供应</span><b>{data.sdStats.supply} 条</b></div>
              <div className="kv"><span>需求</span><b>{data.sdStats.demand} 条</b></div>
              <div className="kv"><span>累计浏览</span><b>{formatCount(data.sdStats.viewTotal)} 次</b></div>
            </div>
          </section>

          <section className="surface-card">
            <SectionHeading kicker="EXPERT" title="专家服务" />
            <div className="kv-list">
              <div className="kv"><span>已认证专家</span><b>{data.expertStats.approved} 位</b></div>
              <div className="kv"><span>待审核</span><b>{data.expertStats.pending} 位</b></div>
              <div className="kv"><span>累计答疑</span><b>{data.expertStats.answers} 条</b></div>
            </div>
          </section>
        </div>
      </div>

      <section className="surface-card">
        <SectionHeading kicker="AI PERFORMANCE" title="AI 问答分类表现" />
        <Table
          rowKey="category"
          size="middle"
          pagination={false}
          dataSource={data.aiStats}
          columns={[
            { title: '知识分类', dataIndex: 'category', width: 180 },
            { title: '问答次数', dataIndex: 'total', width: 120 },
            {
              title: '平均置信度',
              dataIndex: 'avgConfidence',
              render: (value: number) => (
                <div className="bar-cell">
                  <span className="bar-track"><i style={{ width: `${value}%` }} /></span>
                  <small>{Number(value).toFixed(1)}%</small>
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  )
}
