import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { PROVINCES, TAXONOMY } from '../data/portal'
import { tradeUrl, useHashRoute } from '../utils'

const PAGE_SIZE = 8
const PROVINCE_GROUPS = ['华北', '东北', '华东', '华中', '华南', '西南', '西北', '港澳台']

interface FilterState {
  l1: string
  l2: string
  l3: string
  loc: string
  sort: string
  page: number
  q: string
}

interface LiveProduct {
  id: number
  productName: string
  sellerName?: string
  categoryName?: string
  origin?: string
  province?: string
  specification?: string
  price?: number
  unit?: string
}

interface ChainProduct {
  id: number
  name: string
  l1: string
  l2: string
  l3: string
  loc: string
  spec: string
  priceNum: string
  unit: string
  priceVal: number | null
  tag: string
  tagCls: string
  icon: string
  theme: string
  href: string
}

const CATEGORY_MAP: Record<string, { l1: string; l2: string }> = {
  大米: { l1: '粮油产业', l2: '稻谷·大米' },
  稻谷: { l1: '粮油产业', l2: '稻谷·大米' },
  小麦: { l1: '粮油产业', l2: '小麦·面粉' },
  玉米: { l1: '粮油产业', l2: '玉米' },
  粮食: { l1: '粮油产业', l2: '稻谷·大米' },
  苹果: { l1: '果蔬产业', l2: '苹果' },
  柑橘: { l1: '果蔬产业', l2: '柑橘' },
  水果: { l1: '果蔬产业', l2: '柑橘' },
  大白菜: { l1: '果蔬产业', l2: '设施蔬菜' },
  蔬菜: { l1: '果蔬产业', l2: '设施蔬菜' },
  牛肉: { l1: '畜禽产业', l2: '肉牛' },
  猪肉: { l1: '畜禽产业', l2: '生猪' },
  禽蛋: { l1: '畜禽产业', l2: '蛋奶' },
  畜牧: { l1: '畜禽产业', l2: '肉牛' },
  大闸蟹: { l1: '水产产业', l2: '虾蟹' },
  水产: { l1: '水产产业', l2: '淡水鱼' },
  茶叶: { l1: '茶药产业', l2: '茶叶' },
  中药材: { l1: '茶药产业', l2: '中药材' },
  饲料: { l1: '饲料农资', l2: '饲料' },
}

function mapProduct(product: LiveProduct): ChainProduct {
  const category = product.categoryName || ''
  const taxonomy = CATEGORY_MAP[category]
    ?? Object.entries(CATEGORY_MAP).find(([key]) => category.includes(key))?.[1]
    ?? { l1: '粮油产业', l2: '稻谷·大米' }
  return {
    id: product.id,
    name: product.productName,
    l1: taxonomy.l1,
    l2: taxonomy.l2,
    l3: category || product.productName,
    loc: product.origin || product.province || '产地待补充',
    spec: product.specification || '规格待补充',
    priceNum: product.price == null ? '' : String(product.price),
    unit: product.unit ? ` / ${product.unit}` : '',
    priceVal: product.price == null ? null : Number(product.price),
    tag: product.sellerName || '平台在售',
    tagCls: '',
    icon: taxonomy.l1 === '水产产业' ? 'drop'
      : taxonomy.l1 === '畜禽产业' ? 'activity'
        : taxonomy.l1 === '果蔬产业' ? 'sun'
          : taxonomy.l1 === '茶药产业' ? 'leaf' : 'seed',
    theme: taxonomy.l1 === '水产产业' ? 't'
      : taxonomy.l1 === '畜禽产业' ? 'a'
        : taxonomy.l1 === '果蔬产业' ? 'o'
          : taxonomy.l1 === '茶药产业' ? 'g' : 'g',
    href: tradeUrl(`/product/detail/${product.id}`),
  }
}

function ProvinceChips({ state, onPick }: { state: FilterState; onPick: (value: string) => void }): JSX.Element {
  return (
    <div className="portal-province-chips">
      <button type="button" className={`chip${state.loc === '' ? ' on' : ''}`} onClick={() => onPick('')}>全部省份</button>
      {PROVINCE_GROUPS.map((group) => {
        const items = PROVINCES.filter((province) => province.group === group)
        if (items.length === 0) return null
        return (
          <div className="portal-province-group" key={group}>
            <span>{group}</span>
            {items.map((province) => (
              <button type="button" key={province.code}
                className={`chip${state.loc === province.name ? ' on' : ''}`}
                onClick={() => onPick(province.name)}>{province.name}</button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ProductCard({ product }: { product: ChainProduct }): JSX.Element {
  return (
    <a className="card card-hover" href={product.href} target="_blank" rel="noreferrer">
      <div className="card-b">
        <div className={`portal-thumb theme-${product.theme}`}><Icon name={product.icon} size={44} /></div>
        <div className="row between center mt-12 gap-8">
          <span className="strong ellipsis">{product.name}</span>
          <span className={`tag ${product.tagCls}`}>{product.tag}</span>
        </div>
        <div className="muted t-xs mt-8 ellipsis">{product.loc} · {product.spec}</div>
        <div className="row between center mt-12">
          {product.priceVal == null ? (
            <span className="price t-md portal-inquiry">询价</span>
          ) : (
            <span className="price"><span className="cur">¥</span>{product.priceNum}<span className="unit">{product.unit}</span></span>
          )}
        </div>
        <div className="muted t-xs mt-8 ellipsis">{product.l1} / {product.l2} / {product.l3}</div>
      </div>
    </a>
  )
}

export function Chains(): JSX.Element {
  const route = useHashRoute()
  const [products, setProducts] = useState<ChainProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [state, setState] = useState<FilterState>({
    l1: '', l2: '', l3: '', loc: '', sort: '综合', page: 1, q: '',
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetch('/api/trade/public/products?limit=100')
      .then((response) => response.json())
      .then((body: { code?: number; data?: LiveProduct[] | { records?: LiveProduct[] } }) => {
        if (cancelled) return
        const records = Array.isArray(body.data) ? body.data : body.data?.records
        if ((body.code === 0 || body.code === 200) && records) {
          setProducts(records.map(mapProduct))
        } else {
          setProducts([])
          setLoadError(body.code === 0 || body.code === 200 ? '' : '交易服务未返回可用商品')
        }
      })
      .catch(() => {
        if (cancelled) return
        setProducts([])
        setLoadError('交易服务暂时不可用')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // 首页产业链卡片 / 频道栏通过 hash query 深链进来时同步筛选条件
  useEffect(() => {
    const l1 = route.query.get('l1') ?? ''
    const l2 = route.query.get('l2') ?? ''
    const l3 = route.query.get('l3') ?? ''
    const loc = route.query.get('loc') ?? ''
    const q = route.query.get('q') ?? ''
    setState((previous) => ({
      ...previous,
      l1: TAXONOMY[l1] ? l1 : '',
      l2: TAXONOMY[l1] && TAXONOMY[l1][l2] ? l2 : '',
      l3: TAXONOMY[l1] && TAXONOMY[l1][l2]?.includes(l3) ? l3 : '',
      loc: PROVINCES.some((province) => province.name === loc) ? loc : '',
      q,
      page: 1,
    }))
  }, [route])

  const filtered = useMemo(() => {
    const keyword = state.q.trim().toLowerCase()
    const list = products.filter((product) => {
      const locHit = !state.loc || product.loc.startsWith(state.loc)
      const keywordHit = !keyword || [product.name, product.l1, product.l2, product.l3, product.loc, product.spec]
        .some((value) => value.toLowerCase().includes(keyword))
      return (!state.l1 || product.l1 === state.l1)
        && (!state.l2 || product.l2 === state.l2)
        && (!state.l3 || product.l3 === state.l3)
        && locHit && keywordHit
    })
    if (state.sort === '最新发布') {
      list.sort((a, b) => Number(b.id) - Number(a.id))
    } else if (state.sort === '价格从低到高') {
      list.sort((a, b) => (a.priceVal ?? Number.POSITIVE_INFINITY) - (b.priceVal ?? Number.POSITIVE_INFINITY))
    } else if (state.sort === '价格从高到低') {
      list.sort((a, b) => (b.priceVal ?? Number.NEGATIVE_INFINITY) - (a.priceVal ?? Number.NEGATIVE_INFINITY))
    }
    return list
  }, [products, state])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(state.page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const l2Options = state.l1 ? Object.keys(TAXONOMY[state.l1] ?? {}) : []
  const l3Options = state.l1 && state.l2 ? TAXONOMY[state.l1]?.[state.l2] ?? [] : []

  const patch = (next: Partial<FilterState>): void => {
    setState((previous) => ({ ...previous, ...next }))
  }

  return (
    <>
      <section className="portal-chain-hero">
        <div className="container">
          <div className="tag tag-tech"><Icon name="layers" size={14} />产业链频道</div>
          <h1>按产业链找货源，按产地找供应商</h1>
          <p>覆盖粮油、果蔬、畜禽、茶药、饲料农资、水产、预制菜与冷链物流，支持三级分类与产地筛选。</p>
        </div>
      </section>

      <section className="container portal-chain-body">
        <div className="card">
          <div className="card-h">
            <h3><Icon name="settings" size={16} />产业链筛选</h3>
            <div className="row center gap-8">
              <span className="tag tag-tech"><Icon name="layers" size={13} />支持三级分类</span>
              <button className="btn btn-ghost btn-sm" type="button"
                onClick={() => patch({ l1: '', l2: '', l3: '', loc: '', sort: '综合', page: 1, q: '' })}>
                <Icon name="close" size={13} />清空筛选
              </button>
            </div>
          </div>
          <div className="card-b">
            <div className="portal-trail">
              <a href="#/chains">全部产业链</a>
              <span>/</span><strong>{state.l1 || '全部产业'}</strong>
              {state.l2 && <><span>/</span><strong>{state.l2}</strong></>}
              {state.l3 && <><span>/</span><strong>{state.l3}</strong></>}
              {state.loc && <><span>·</span><strong>产地：{state.loc}</strong></>}
              {state.q && <><span>·</span><strong>搜索：{state.q}</strong></>}
              <span>·</span><span className="muted">匹配 <b className="mono c-green">{filtered.length}</b> 个货源</span>
            </div>

            <div className="portal-filter-row">
              <span className="portal-filter-label">一级产业</span>
              <div className="chips">
                <button type="button" className={`chip${state.l1 === '' ? ' on' : ''}`}
                  onClick={() => patch({ l1: '', l2: '', l3: '', page: 1 })}>全部产业</button>
                {Object.keys(TAXONOMY).map((l1) => (
                  <button type="button" key={l1} className={`chip${state.l1 === l1 ? ' on' : ''}`}
                    onClick={() => patch({ l1, l2: '', l3: '', page: 1 })}>{l1}</button>
                ))}
              </div>
            </div>

            <div className="portal-filter-row">
              <span className="portal-filter-label">二级品类</span>
              <div className="chips">
                {!state.l1 && <span className="muted t-sm">请先选择一级产业</span>}
                {state.l1 && (
                  <>
                    <button type="button" className={`chip${state.l2 === '' ? ' on' : ''}`}
                      onClick={() => patch({ l2: '', l3: '', page: 1 })}>全部品类</button>
                    {l2Options.map((l2) => (
                      <button type="button" key={l2} className={`chip${state.l2 === l2 ? ' on' : ''}`}
                        onClick={() => patch({ l2, l3: '', page: 1 })}>{l2}</button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="portal-filter-row">
              <span className="portal-filter-label">三级品种</span>
              <div className="chips">
                {!state.l2 && <span className="muted t-sm">请先选择二级品类</span>}
                {state.l2 && (
                  <>
                    <button type="button" className={`chip${state.l3 === '' ? ' on' : ''}`}
                      onClick={() => patch({ l3: '', page: 1 })}>全部品种</button>
                    {l3Options.map((l3) => (
                      <button type="button" key={l3} className={`chip${state.l3 === l3 ? ' on' : ''}`}
                        onClick={() => patch({ l3, page: 1 })}>{l3}</button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="portal-filter-row portal-filter-last">
              <span className="portal-filter-label">产地</span>
              <ProvinceChips state={state} onPick={(loc) => patch({ loc, page: 1 })} />
            </div>
          </div>
        </div>

        <div className="portal-list-head">
          <div>
            <span className="strong">在售商品</span>
            <span className="muted t-sm">共 <b className="mono">{filtered.length}</b> 个货源</span>
          </div>
          <div className="chips">
            {['综合', '最新发布', '价格从低到高', '价格从高到低'].map((sort) => (
              <button type="button" key={sort} className={`chip${state.sort === sort ? ' on' : ''}`}
                onClick={() => patch({ sort, page: 1 })}>{sort}</button>
            ))}
          </div>
        </div>

        <div className="portal-data-note">
          {loading
            ? '正在从交易平台读取已发布货源…'
            : loadError
              ? `${loadError}，当前不展示示例货源。`
              : `已连接交易平台，展示 ${products.length} 条已发布在售货源。库存、报价与供应商信息以交易记录为准。`}
        </div>

        {loading ? (
          <div className="empty card"><div className="muted t-sm">正在读取货源…</div></div>
        ) : visible.length === 0 ? (
          <div className="empty card">
            <Icon name="search" size={34} />
            <div className="mt-12 strong">{products.length === 0 ? '暂无在售货源' : '没有匹配的货源'}</div>
            <div className="muted t-sm mt-8">
              {products.length === 0 ? '供应商发布商品后会实时展示；本页不使用模拟货源。' : '试试更换分类或产地，或到交易大厅发布采购需求。'}
            </div>
          </div>
        ) : (
          <div className="grid grid-4 portal-product-grid">
            {visible.map((product) => <ProductCard key={`${product.name}-${product.loc}`} product={product} />)}
          </div>
        )}

        {pages > 1 && (
          <div className="pager">
            <button type="button" disabled={currentPage <= 1} onClick={() => patch({ page: currentPage - 1 })}>上一页</button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((page) => (
              <button type="button" key={page} className={page === currentPage ? 'on' : ''}
                onClick={() => patch({ page })}>{page}</button>
            ))}
            <button type="button" disabled={currentPage >= pages} onClick={() => patch({ page: currentPage + 1 })}>下一页</button>
          </div>
        )}
      </section>
    </>
  )
}
