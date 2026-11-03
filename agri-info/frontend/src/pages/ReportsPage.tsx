import { useEffect, useState } from 'react'
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { Button, Drawer, Tag, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { Report } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui'

/**
 * 研究报告：按类别浏览，免费报告可直接下载（后端累加下载量），
 * 付费报告展示价格与购买入口；已下载的报告在「我的下载」中回看。
 */
export function ReportsPage(): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<{ items: Report[]; categories: string[]; downloads: number } | null>(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('全部')
  const [detail, setDetail] = useState<Report | null>(null)
  const [mine, setMine] = useState<Report[] | null>(null)
  const [downloading, setDownloading] = useState(0)

  const load = (nextCategory: string): void => {
    setCategory(nextCategory)
    setError('')
    infoApi.reports(nextCategory === '全部' ? undefined : nextCategory)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load('全部') }, [])

  const openDetail = (id: number): void => {
    infoApi.report(id).then(setDetail).catch((reason: Error) => message.error(reason.message))
  }

  const download = (report: Report): void => {
    setDownloading(report.id)
    infoApi.downloadReport(report.id)
      .then((result) => {
        message.success(result.message)
        setData((previous) => previous
          ? { ...previous, downloads: result.downloads, items: previous.items.map((item) => (item.id === report.id ? { ...item, downloads: item.downloads + 1 } : item)) }
          : previous)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setDownloading(0))
  }

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load(category)} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="RESEARCH REPORTS"
        title="研究报告"
        description="单品月报、周报、专题分析与遥感监测 · 报告关键结论可链上存证，支持在线验真"
        actions={
          <>
            <Button onClick={() => infoApi.myReports().then(setMine).catch((reason: Error) => message.error(reason.message))}>
              我的下载
            </Button>
            <Button onClick={() => navigate('attest')}>存证查询</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="在架报告" value={data.items.length} unit="份" note={`${data.categories.length} 个类别`} />
        <StatTile label="免费报告" value={data.items.filter((item) => item.isFree).length} unit="份" note="登录即可下载" tone="up" />
        <StatTile label="累计下载" value={formatCount(data.downloads)} unit="次" note="全平台统计" />
        <StatTile label="已存证报告" value={data.items.filter((item) => item.attestation).length} unit="份" note="关键结论上链" tone="warn" />
      </div>

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {['全部', ...data.categories].map((item) => (
            <button type="button" key={item} className={`chip${category === item ? ' on' : ''}`} onClick={() => load(item)}>{item}</button>
          ))}
        </div>

        {data.items.length === 0 && <EmptyState icon="📄" title="该类别暂无报告" description="换个类别看看。" />}

        <div className="stack" style={{ gap: 12 }}>
          {data.items.map((report) => (
            <article className="report-row" key={report.id}>
              <span className="report-icon"><FileTextOutlined /></span>
              <div className="report-main">
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{report.title}</b>
                  <Tag className="soft-tag tone-green">{report.category}</Tag>
                  {report.isFree ? <Tag className="soft-tag">免费</Tag> : <Tag className="soft-tag tone-amber">¥{Number(report.price).toFixed(2)}</Tag>}
                  {report.attestation && <Tag className="soft-tag tone-purple">✓ 已存证</Tag>}
                </div>
                <p className="small muted" style={{ margin: '6px 0' }}>{report.summary}</p>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                  <span className="small muted">{report.reportNo}</span>
                  <span className="small muted">{report.period}</span>
                  <span className="small muted">{report.pageCount} 页</span>
                  <span className="small muted">下载 {formatCount(report.downloads)}</span>
                  <span className="small muted">{report.publishedAt}</span>
                </div>
              </div>
              <div className="report-actions">
                <Button size="small" onClick={() => openDetail(report.id)}>查看目录</Button>
                {report.isFree ? (
                  <Button size="small" type="primary" icon={<DownloadOutlined />} loading={downloading === report.id} onClick={() => download(report)}>
                    下载
                  </Button>
                ) : (
                  <Button size="small" type="primary" onClick={() => message.info('演示环境未接入支付，正式版对接平台统一支付')}>
                    购买
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={560} title={detail?.title ?? ''}>
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag className="soft-tag tone-green">{detail.category}</Tag>
              <Tag className="soft-tag">{detail.period}</Tag>
              {detail.attestation && <Tag className="soft-tag tone-purple">已存证 {detail.attestation.attestNo}</Tag>}
            </div>
            <p className="small">{detail.summary}</p>
            <div className="kv-list">
              <div className="kv"><span>报告编号</span><b>{detail.reportNo}</b></div>
              <div className="kv"><span>页数</span><b>{detail.pageCount} 页</b></div>
              <div className="kv"><span>发布时间</span><b>{detail.publishedAt}</b></div>
              <div className="kv"><span>下载次数</span><b>{formatCount(detail.downloads)}</b></div>
              <div className="kv"><span>价格</span><b>{detail.isFree ? '免费' : `¥${Number(detail.price).toFixed(2)}`}</b></div>
            </div>

            <SectionHeading kicker="CONTENTS" title="报告目录" />
            <ol className="step-list">
              {(Array.isArray(detail.sections) ? detail.sections : String(detail.sections).split(',')).map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ol>

            {(detail.related ?? []).length > 0 && (
              <>
                <SectionHeading kicker="RELATED" title="相关报告" />
                <div className="stack" style={{ gap: 8 }}>
                  {(detail.related ?? []).map((item) => (
                    <button type="button" className="related-row" key={item.id} onClick={() => openDetail(item.id)}>
                      <b>{item.title}</b>
                      <span className="small muted">{item.category} · {item.period}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {detail.isFree
              ? <Button type="primary" icon={<DownloadOutlined />} loading={downloading === detail.id} onClick={() => download(detail)}>下载 PDF</Button>
              : <Button type="primary" onClick={() => message.info('演示环境未接入支付，正式版对接平台统一支付')}>购买后下载</Button>}
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(mine)} onClose={() => setMine(null)} width={520} title="我的下载">
        {(mine ?? []).length === 0 && <p className="muted small">还没有下载记录。</p>}
        <div className="stack" style={{ gap: 10 }}>
          {(mine ?? []).map((report) => (
            <div className="surface-card flat" key={report.id} onClick={() => { setMine(null); openDetail(report.id) }}>
              <b style={{ fontSize: 13 }}>{report.title}</b>
              <p className="small muted" style={{ marginTop: 6 }}>{report.category} · {report.period} · {report.publishedAt}</p>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
