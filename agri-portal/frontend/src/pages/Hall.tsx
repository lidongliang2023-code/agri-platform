import { PortalPageHero } from '../components/PortalPageHero'
import { useEffect, useMemo, useRef, useState } from 'react'
import { tradeUrl, useHashRoute, usePageMeta } from '../utils'
import './hall-embed.css'

/** 门户筛选参数 → 交易大厅参数；产业链频道并入后，旧的 l1/l2/l3/loc/q 深链继续可用。 */
const FILTER_PARAMS: Array<[string, string]> = [
  ['l1', 'l1'],
  ['l2', 'l2'],
  ['l3', 'l3'],
  ['loc', 'province'],
  ['q', 'keyword'],
  ['tab', 'tab'],
]

export function Hall(): JSX.Element {
  const route = useHashRoute()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(1600)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // 显式维护门户页面标题，解决从价格指数/资讯等页面切换后标题未更新的问题
  usePageMeta('交易大厅', '汇聚农业产业链优质货源与采购需求，支持在线议价与撮合交易')

  const src = useMemo(() => {
    const params = new URLSearchParams({ embed: '1', portalHero: '1' })
    FILTER_PARAMS.forEach(([from, to]) => {
      const value = route.query.get(from)
      if (value) params.set(to, value)
    })
    return `${tradeUrl('/hall')}?${params.toString()}`
  }, [route])

  useEffect(() => {
    setLoading(true)
    setLoadError(false)
  }, [src, refreshKey])

  useEffect(() => {
    if (!loading) return
    const timer = window.setTimeout(() => {
      setLoading(false)
      setLoadError(true)
    }, 15000)
    return () => window.clearTimeout(timer)
  }, [loading, src, refreshKey])

  useEffect(() => {
    const hallOrigin = new URL(tradeUrl('/')).origin
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== hallOrigin || event.source !== frameRef.current?.contentWindow) return
      const data = event.data as { type?: string; height?: number } | null
      if (!data || typeof data !== 'object') return

      if (data.type === 'agri-hall-height' && typeof data.height === 'number' && Number.isFinite(data.height)) {
        setHeight(Math.max(900, Math.ceil(data.height)))
        setLoading(false)
        setLoadError(false)
      } else if (data.type === 'agri-hall-ready') {
        setLoading(false)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div className="portal-hall-page">
      <PortalPageHero badge="交易大厅 · 产销对接" title="交易大厅" description="汇聚农业产业链优质货源与采购需求，支持在线议价与平台撮合，让产销对接更高效。">
        <div className="portal-page-hero-actions"><a className="btn portal-page-btn-light" href="#/info/market">查看价格指数 →</a><a className="btn portal-page-btn-ghost" href="#/quality-trace">查询质量溯源 →</a></div>
      </PortalPageHero>
    <section className="portal-hall-embed" aria-label="交易大厅内容区域">
      {loading && !loadError && (
        <div className="portal-hall-skeleton" role="status" aria-live="polite">
          <div className="skeleton-bar title-bar" />
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
          <div className="skeleton-hint">正在加载交易大厅现货与需求数据…</div>
        </div>
      )}

      {loadError && (
        <div className="portal-hall-fallback">
          <div className="fallback-title">交易大厅嵌入加载遇到异常</div>
          <div className="fallback-desc">
            若长时间未展示，可直接前往独立交易大厅浏览，或点击重试。
          </div>
          <div className="fallback-actions">
            <button
              type="button"
              className="fallback-btn fallback-btn-primary"
              onClick={() => {
                setRefreshKey((v) => v + 1)
              }}
            >
              重新加载
            </button>
            <a
              className="fallback-btn fallback-btn-subtle"
              href={src}
              target="_blank"
              rel="noreferrer"
            >
              在新标签页打开交易大厅
            </a>
          </div>
        </div>
      )}

      <iframe
        ref={frameRef}
        key={`${src}-${refreshKey}`}
        src={src}
        title="丰链云交易大厅"
        className={loading ? 'is-loading' : 'is-ready'}
        style={{ height }}
        scrolling="no"
        onLoad={(event) => {
          setLoading(false)
          setLoadError(false)
          try {
            event.currentTarget.contentWindow?.postMessage({ type: 'agri-hall-ready' }, new URL(src).origin)
          } catch {
            // 忽略跨域常规派发提示
          }
        }}
        onError={() => {
          setLoading(false)
          setLoadError(true)
        }}
      />
    </section>
    </div>
  )
}
