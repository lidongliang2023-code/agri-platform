import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Empty, message, Spin } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { BrandMark } from '@/components/BrandMark'
import { deleteDemand, getDemandById, getDemandMatches, matchDemand } from '@/api/demand'
import {
  createInquiry,
  getInquiryQuotes,
  getMyInquiries,
  type InquiryVO,
} from '@/api/inquiry'
import { acceptQuote, convertQuoteToOrder, type QuoteVO } from '@/api/quote'
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared'
import './demand-detail.css'

interface Demand {
  id: number
  demandNo: string
  demandName: string
  buyerId: number | string
  buyerName: string
  buyerType: string
  categoryId: number
  categoryName: string
  variety: string
  productName: string
  quantity: number
  unit: string
  priceMin: number
  priceMax: number
  deliveryProvince: string
  deliveryCity: string
  deliveryAddress: string
  deliveryDeadline: string
  qualityRequirement: string
  certificationRequire: string
  packagingRequire: string
  sampleRequire: number
  demandType: string
  demandStatus: string
  responseCount: number
  createTime: string
}

interface MatchRow {
  id: number
  matchNo: string
  productId: number
  sellerId: number | string
  matchScore: number
  matchType: string
  matchReason: string
  orderId: number
  orderStatus: string
  createTime: string
}

const DEMAND_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待匹配', tone: 'amber' },
  matching: { text: '匹配中', tone: 'tech' },
  quoted: { text: '报价中', tone: 'tech' },
  completed: { text: '已成交', tone: 'green' },
  closed: { text: '已关闭', tone: 'ghost' },
}

const INQUIRY_STATUS: Record<string, { text: string; tone: string }> = {
  pending_reply: { text: '待报价', tone: 'amber' },
  quoted: { text: '已报价', tone: 'tech' },
  converted: { text: '已成交', tone: 'green' },
  closed: { text: '已关闭', tone: 'ghost' },
}

const QUOTE_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待受理', tone: 'amber' },
  accepted: { text: '已受理', tone: 'green' },
  rejected: { text: '已拒绝', tone: 'red' },
  expired: { text: '已过期', tone: 'ghost' },
}

/** 采购需求与询价详情工作台。 */
export default function DemandDetail(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [demand, setDemand] = useState<Demand | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [inquiries, setInquiries] = useState<InquiryVO[]>([])
  const [quotesByInquiry, setQuotesByInquiry] = useState<Record<string, QuoteVO[]>>({})
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [inquiryBusy, setInquiryBusy] = useState<number | null>(null)
  const [quoteBusy, setQuoteBusy] = useState<number | null>(null)

  const loadMatches = useCallback(() => {
    if (!id) return
    getDemandMatches(id)
      .then((response: { code: number; data?: MatchRow[] }) => {
        if (response?.code === 200) setMatches(response.data ?? [])
      })
      .catch(() => setMatches([]))
  }, [id])

  const loadInquiries = useCallback(async (): Promise<void> => {
    if (!id) return
    try {
      const response = await getMyInquiries() as { code: number; data?: InquiryVO[] }
      if (response?.code !== 200) return
      const mine = (response.data ?? []).filter((item) => String(item.demandId) === String(id))
      setInquiries(mine)
      const entries = await Promise.all(mine.map(async (inquiry) => {
        const quoteResponse = await getInquiryQuotes(inquiry.id)
        return [String(inquiry.id), quoteResponse?.code === 200 ? quoteResponse.data ?? [] : []] as const
      }))
      setQuotesByInquiry(Object.fromEntries(entries))
    } catch {
      setInquiries([])
      setQuotesByInquiry({})
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getDemandById(Number(id))
      .then((response: { code: number; data?: Demand; message?: string }) => {
        if (cancelled) return
        if (response?.code === 200) setDemand(response.data ?? null)
        else message.error(response?.message ?? '需求不存在')
      })
      .catch(() => message.error('加载需求失败（请检查后端是否在运行）'))
      .finally(() => { if (!cancelled) setLoading(false) })
    loadMatches()
    void loadInquiries()
    return () => { cancelled = true }
  }, [id, loadMatches, loadInquiries])

  const handleMatch = async (): Promise<void> => {
    if (!id) return
    setMatching(true)
    try {
      const response = await matchDemand(Number(id))
      if (response?.code === 200) {
        message.success('智能撮合完成')
        loadMatches()
      } else {
        message.error(response?.message ?? '触发撮合失败')
      }
    } finally {
      setMatching(false)
    }
  }

  const handleInquiry = async (productId: number): Promise<void> => {
    if (!id) return
    setInquiryBusy(productId)
    try {
      const response = await createInquiry(Number(id), productId)
      if (response?.code === 200) {
        message.success('已发起询价，等待供应商报价')
        await loadInquiries()
      } else {
        message.error(response?.message ?? '发起询价失败')
      }
    } catch {
      message.error('发起询价失败（请检查后端是否在运行）')
    } finally {
      setInquiryBusy(null)
    }
  }

  const handleAcceptQuote = async (quote: QuoteVO): Promise<void> => {
    setQuoteBusy(quote.id)
    try {
      const accepted = await acceptQuote(quote.id)
      if (accepted?.code !== 200) {
        message.error(accepted?.message ?? '接受报价失败')
        return
      }
      const converted = await convertQuoteToOrder(quote.id)
      if (converted?.code === 200 && converted.data?.id) {
        message.success('已接受报价并生成采购订单')
        navigate(`/order/confirm?orderId=${converted.data.id}`)
      } else {
        message.error(converted?.message ?? '报价已受理，但生成订单失败')
      }
    } catch {
      message.error('接受报价失败（请检查后端是否在运行）')
    } finally {
      setQuoteBusy(null)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!id || !window.confirm('确认下架这条采购需求？')) return
    const response = await deleteDemand(Number(id))
    if (response?.code === 200) {
      message.success('采购需求已下架')
      navigate('/member/buyer?tab=inquiry')
    } else {
      message.error(response?.message ?? '下架失败')
    }
  }

  const allQuotes = useMemo(() => Object.values(quotesByInquiry).flat(), [quotesByInquiry])
  const pendingQuotes = allQuotes.filter((quote) => quote.quoteStatus === 'pending')
  const demandMeta = statusMeta(demand?.demandStatus ?? 'pending')

  if (loading) {
    return <div className="demand-detail-page demand-detail-center"><Spin size="large" /><span>正在读取询价详情…</span></div>
  }
  if (!demand) {
    return (
      <div className="demand-detail-page demand-detail-center">
        <Empty description="没有找到这条采购需求" />
        <button type="button" className="mc-btn" onClick={() => navigate('/member/buyer?tab=inquiry')}>
          返回我的询价
        </button>
      </div>
    )
  }

  return (
    <div className="demand-detail-page">
      <header className="demand-detail-topbar">
        <a className="demand-detail-brand" href="/">
          <span><BrandMark size={32} /></span>
          <strong>丰链云<small>FENGCHAIN · AGRI</small></strong>
        </a>
        <nav>
          <a href="/member/buyer">买家中心</a><span>/</span>
          <a href="/member/buyer?tab=inquiry">我的询价</a><span>/</span>
          <strong>需求详情</strong>
        </nav>
        <a className="demand-detail-back" href="/member/buyer?tab=inquiry"><ArrowLeftOutlined /> 返回我的询价</a>
      </header>

      <main className="demand-detail-main">
        <section className="demand-detail-hero">
          <span className="demand-detail-hero-icon"><FileSearchOutlined /></span>
          <div>
            <small>PURCHASE REQUEST · {demand.demandNo}</small>
            <h1>{demand.demandName || demand.productName || '采购需求'}</h1>
            <p>{demand.categoryName || '农产品'} · {demand.variety || '品种待定'} · 发布于 {shortDate(demand.createTime)}</p>
          </div>
          <span className={`mc-tag ${demandMeta.tone}`}>{demandMeta.text}</span>
          <div className="demand-detail-actions">
            <button type="button" className="mc-btn" disabled={matching} onClick={() => void handleMatch()}>
              <ThunderboltOutlined /> {matching ? '撮合中…' : '触发智能撮合'}
            </button>
            <button type="button" className="mc-btn ghost"
              onClick={() => navigate(`/member/buyer?tab=publish&id=${demand.id}`)}>
              编辑需求
            </button>
            <button type="button" className="mc-btn ghost demand-detail-danger" onClick={() => void handleDelete()}>
              下架需求
            </button>
          </div>
        </section>

        <div className="demand-detail-layout">
          <div className="demand-detail-content">
            <Panel title="采购要求" extra={<span className="demand-detail-muted">需求核心信息</span>}>
              <div className="demand-detail-facts">
                <div><span>采购品类</span><strong>{demand.categoryName || '—'}</strong></div>
                <div><span>品种</span><strong>{demand.variety || '—'}</strong></div>
                <div><span>采购数量</span><strong>{demand.quantity} {demand.unit}</strong></div>
                <div><span>期望单价</span><strong className="demand-detail-price">{money(demand.priceMin)} - {money(demand.priceMax)}</strong></div>
                <div><span>交易类型</span><strong>{demand.demandType === 'long_term' ? '长期合作' : demand.demandType === 'presale' ? '订单农业 / 预售' : '现货采购'}</strong></div>
                <div><span>需要样品</span><strong>{demand.sampleRequire === 1 ? '需要' : '不需要'}</strong></div>
              </div>
              <div className="demand-detail-requirement">
                <div><span>收货地址</span><p><EnvironmentOutlined /> {[demand.deliveryProvince, demand.deliveryCity, demand.deliveryAddress].filter(Boolean).join(' ') || '待补充'}</p></div>
                <div><span>质量要求</span><p>{demand.qualityRequirement || '未填写'}</p></div>
                <div><span>资质与包装</span><p>{[demand.certificationRequire, demand.packagingRequire].filter(Boolean).join(' · ') || '未填写'}</p></div>
              </div>
            </Panel>

            <Panel
              title={`智能撮合（${matches.length}）`}
              extra={<span className="demand-detail-muted">按品类、价格、产地与信誉综合匹配</span>}
            >
              {matches.length === 0 ? (
                <EmptyState title="尚无撮合结果" desc="点击“触发智能撮合”，系统会从当前在售货源中寻找供应商。" />
              ) : (
                <div className="demand-match-list">
                  {matches.map((row) => (
                    <div className="demand-match-card" key={row.id}>
                      <span className="demand-match-score"><strong>{Number(row.matchScore ?? 0).toFixed(1)}</strong><small>匹配分</small></span>
                      <div>
                        <strong>商品 #{row.productId}</strong>
                        <p>{row.matchReason || '平台综合匹配推荐'}</p>
                        <small>{row.matchType === 'auto' ? '系统自动匹配' : '撮合推荐'} · {shortDate(row.createTime)}</small>
                      </div>
                      <a className="mc-btn ghost" href={`/product/detail/${row.productId}`}>查看商品</a>
                      <button type="button" className="mc-btn" disabled={inquiryBusy === row.productId}
                        onClick={() => void handleInquiry(row.productId)}>
                        {inquiryBusy === row.productId ? '发起中…' : '发起询价'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title={`询价与供应商报价（${inquiries.length} 张询价 / ${allQuotes.length} 份报价）`}
              extra={pendingQuotes.length > 0 ? <span className="mc-tag amber">待受理 {pendingQuotes.length}</span> : null}
            >
              {inquiries.length === 0 ? (
                <EmptyState title="尚未发起询价" desc="在撮合结果中点击“发起询价”，供应商报价会显示在这里。" />
              ) : (
                <div className="demand-inquiries">
                  {inquiries.map((inquiry) => {
                    const inquiryMeta = INQUIRY_STATUS[inquiry.inquiryStatus] ?? { text: inquiry.inquiryStatus, tone: 'ghost' }
                    const quotes = quotesByInquiry[String(inquiry.id)] ?? []
                    return (
                      <div className="demand-inquiry" key={inquiry.id}>
                        <div className="demand-inquiry-head">
                          <span className="demand-inquiry-icon"><ShopOutlined /></span>
                          <div>
                            <small>{inquiry.inquiryNo}</small>
                            <strong>{inquiry.productName || `商品 #${inquiry.productId}`}</strong>
                            <span>{inquiry.sellerName || '供应商'} · {inquiry.quantity} {inquiry.unit} · 截止 {shortDate(inquiry.replyDeadline)}</span>
                          </div>
                          <span className={`mc-tag ${inquiryMeta.tone}`}>{inquiryMeta.text}</span>
                          <span className="demand-inquiry-count">{quotes.length} 份报价</span>
                        </div>
                        {quotes.length === 0 ? (
                          <div className="demand-no-quote">等待供应商响应报价</div>
                        ) : (
                          <div className="demand-quote-list">
                            {quotes.map((quote) => {
                              const quoteMeta = QUOTE_STATUS[quote.quoteStatus] ?? { text: quote.quoteStatus, tone: 'ghost' }
                              return (
                                <div className="demand-quote" key={quote.id}>
                                  <div><small>{quote.quoteNo}</small><strong>{quote.sellerName}</strong></div>
                                  <div><span>单价</span><strong>{money(quote.unitPrice)}/{quote.unit}</strong></div>
                                  <div><span>数量</span><strong>{quote.quantity} {quote.unit}</strong></div>
                                  <div><span>含运费总价</span><strong className="demand-detail-price">{money(Number(quote.totalAmount ?? 0) + Number(quote.freightAmount ?? 0))}</strong></div>
                                  <span className={`mc-tag ${quoteMeta.tone}`}>{quoteMeta.text}</span>
                                  {quote.quoteStatus === 'pending' ? (
                                    <button type="button" className="mc-btn" disabled={quoteBusy === quote.id}
                                      onClick={() => void handleAcceptQuote(quote)}>
                                      {quoteBusy === quote.id ? '处理中…' : '接受报价并成单'}
                                    </button>
                                  ) : quote.orderId ? (
                                    <a className="mc-link" href={`/order/detail/${quote.orderId}`}>查看订单</a>
                                  ) : <span />}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>
          </div>

          <aside className="demand-detail-aside">
            <Panel title="需求概览">
              <div className="demand-summary">
                <div><span>采购方</span><strong>{demand.buyerName || '—'}</strong></div>
                <div><span>品类 / 品种</span><strong>{demand.categoryName || '—'} / {demand.variety || '—'}</strong></div>
                <div><span>采购数量</span><strong>{demand.quantity} {demand.unit}</strong></div>
                <div><span>报价数量</span><strong>{demand.responseCount ?? allQuotes.length} 份</strong></div>
                <div className="total"><span>期望总价</span><strong>{money(Number(demand.priceMin ?? 0) * Number(demand.quantity ?? 0))} - {money(Number(demand.priceMax ?? 0) * Number(demand.quantity ?? 0))}</strong></div>
              </div>
            </Panel>
            <Panel title="需求进度">
              <div className="demand-progress">
                <div className="on"><span><CheckCircleOutlined /></span><div><strong>需求已发布</strong><small>{shortDate(demand.createTime)}</small></div></div>
                <div className={matches.length ? 'on' : ''}><span><ThunderboltOutlined /></span><div><strong>智能撮合</strong><small>{matches.length ? `匹配 ${matches.length} 个货源` : '等待触发'}</small></div></div>
                <div className={inquiries.length ? 'on' : ''}><span><FileSearchOutlined /></span><div><strong>供应商报价</strong><small>{allQuotes.length ? `收到 ${allQuotes.length} 份报价` : '等待报价'}</small></div></div>
                <div className={demand.demandStatus === 'completed' ? 'on' : ''}><span><FileTextOutlined /></span><div><strong>报价成单</strong><small>{demand.demandStatus === 'completed' ? '已生成采购订单' : '尚未成交'}</small></div></div>
              </div>
            </Panel>
            <Panel title="操作提示">
              <div className="demand-tips">
                <p><SearchOutlined /> 先触发智能撮合，再从推荐货源发起询价。</p>
                <p><SafetyCertificateOutlined /> 报价成单后会自动生成待签合同。</p>
                <p><ClockCircleOutlined /> 供应商报价后请及时受理，报价存在有效期。</p>
              </div>
            </Panel>
          </aside>
        </div>
      </main>
    </div>
  )
}

function statusMeta(value: string): { text: string; tone: string } {
  return DEMAND_STATUS[value] ?? { text: value || '未知', tone: 'ghost' }
}
