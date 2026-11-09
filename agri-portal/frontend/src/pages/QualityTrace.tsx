import { PortalPageHero } from '../components/PortalPageHero'
import { useRef, useState } from 'react'
import { usePageMeta } from '../utils'
import './info/info.css'
import './quality-trace.css'

type Node = { seq?: number; title?: string; stageName?: string; detail?: string; occurredAt?: string; onChain?: boolean; chainType?: string; chainStatus?: string }
type Trace = { matched?: boolean; reason?: string; productName?: string; batchNo?: string; farmName?: string; codeStatus?: string; verifiable?: boolean; conclusion?: string; nodes?: Node[]; circulation?: { boundAt?: string; orderStatus?: string; logisticsCompany?: string }[] }
const STATUS: Record<string, string> = { generated: '未激活', active: '已激活', scanned: '已扫码', revoked: '已作废', expired: '已过期' }
const ORDER_STATUS: Record<string, string> = { PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', COMPLETED: '已完成', CANCELLED: '已取消', REFUNDED: '已退款' }
export function QualityTrace(): JSX.Element {
  usePageMeta('质量溯源', '一物一码，查询农产品从种植、采收到仓储及零售履约的真实记录。')
  const [code, setCode] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || '').get('code') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trace, setTrace] = useState<Trace | null>(null)
  const request = useRef(0)
  const search = async () => {
    const value = code.trim()
    if (!value || value.length > 100) { setError('请输入包装上的有效单品码，长度不超过100个字符'); return }
    const id = ++request.current
    setLoading(true); setError(''); setTrace(null)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(`/api/public/trace/code/${encodeURIComponent(value)}`, { signal: controller.signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || (response.status === 404 ? '未查询到该单品码' : '核验服务暂不可用'))
      if (typeof result.matched !== 'boolean' || !Array.isArray(result.nodes)) throw new Error('核验结果格式异常，请稍后重试')
      if (id === request.current) setTrace(result)
    } catch (e) { if (id === request.current) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '核验请求超时，请重试') }
    finally { window.clearTimeout(timer); if (id === request.current) setLoading(false) }
  }
  return <div className="info-page quality-public-page portal-channel-page">
    <PortalPageHero badge="质量溯源 · 一物一码" title="质量溯源" description="一物一码，追查从种植到流通的真实记录。质量结论、单品状态和存证结果分别展示。">
      <div className="portal-page-hero-actions"><a className="btn portal-page-btn-light" href="#/hall">前往交易大厅 →</a><a className="btn portal-page-btn-ghost" href="#/info">浏览产业资讯 →</a></div>
    </PortalPageHero>
    <form className="info-filter quality-code-query" onSubmit={e => { e.preventDefault(); void search() }}>
      <label htmlFor="unit-trace-code">单品码</label><input id="unit-trace-code" value={code} maxLength={100} onChange={e => setCode(e.target.value)} placeholder="输入产品包装上的单品溯源码" />
      <button type="submit" className="info-chip on" disabled={loading}>{loading ? '正在核验…' : '查询溯源'}</button>
    </form>
    <p className="quality-scope-note">同批次共享生产记录，每件销售单位使用独立单品码。未记录、未核验和查询失败会分别说明；存证成功不等于质量合格，也不证明包装上的码没有被复制。</p>
    {error && <div className="quality-query-error" role="alert">{error}</div>}
    {!trace && !error && !loading && <div className="quality-query-empty">输入单品码，查看来源批次、生产事实和已登记的流转记录。</div>}
    {trace && <>
      <div className="info-section-head"><h2>单品核验 <small>{trace.verifiable ? '当前符合生产核验规则' : '当前不可核验'}</small></h2><span>{STATUS[trace.codeStatus || ''] || trace.codeStatus || '状态未记录'}</span></div>
      <dl className="quality-source-grid"><div><dt>产品</dt><dd>{trace.productName || '未记录'}</dd></div><div><dt>生产批次</dt><dd>{trace.batchNo || '未记录'}</dd></div><div><dt>生产基地</dt><dd>{trace.farmName || '未记录'}</dd></div></dl>
      {!trace.verifiable && <p className="quality-query-error">该码可能未激活、已失效或关联批次不满足质检要求，请联系经营方核对原始记录。</p>}
      <div className="info-section-head"><h2>生产事实 <small>种植 · 农事 · 采收 · 加工 · 质检 · 仓储</small></h2></div>
      <ol className="quality-event-list">{(trace.nodes || []).map((node, i) => <li key={i}><div><strong>{node.title || node.stageName || '业务记录'}</strong><span>{node.occurredAt?.replace('T', ' ') || '未记录时间'}</span></div><p>{node.detail || '未记录详情'}</p><small>{node.onChain ? node.chainType === 'SIMULATED' ? '模拟存证成功' : '存证成功' : node.chainStatus === 'FAILED' ? '存证失败' : node.chainStatus === 'PENDING' ? '存证处理中' : '无存证记录'}</small></li>)}</ol>
      {!trace.nodes?.length && <p className="quality-query-empty">暂无生产事实记录</p>}
      <div className="info-section-head"><h2>零售履约与流转 <small>仅展示实际绑定到该码的商城记录</small></h2></div>
      {trace.circulation?.length ? <ol className="quality-event-list">{trace.circulation.map((event, i) => <li key={i}><strong>{ORDER_STATUS[event.orderStatus || ''] || event.orderStatus || '状态未记录'}</strong><p>{event.logisticsCompany || '承运方未记录'} · 绑定时间 {event.boundAt || '未记录'}</p></li>)}</ol> : <p className="quality-query-empty">暂无该单品码的商城履约记录，不能据此认定已发货或已签收。</p>}
      <p className="quality-scope-note">大宗交易按供给与合同追踪；本查询不把批次的其他交易当作当前单品的物流，也不展示客户、收货地址、价格及订单号。</p>
    </>}
  </div>
}
