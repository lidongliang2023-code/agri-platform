import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { PRODUCTS, PROVINCES, TAXONOMY } from '../data/portal'
import type { PortalProduct } from '../data/portal'
import { hallUrl, useHashRoute } from '../utils'

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

function ProductCard({ product }: { product: PortalProduct }): JSX.Element {
  return (
    <a className="card card-hover" href={hallUrl()} target="_blank" rel="noreferrer">
      <div className="card-b">
        <div className={`portal-thumb theme-${product.theme}`}><Icon name={product.icon} size={44} /></div>
        <div className="row between center mt-12 gap-8">
          <span className="strong ellipsis">{product.name}</span>
          <span className={`tag ${product.tagCls}`}>{product.tag}</span>
        </div>
        <div className="muted t-xs mt-8">{product.loc} · {product.spec}</div>
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
  const [state, setState] = useState<FilterState>({
    l1: '', l2: '', l3: '', loc: '', sort: '综合', page: 1, q: '',
  })

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
    const list = PRODUCTS.filter((product) => {
      const locHit = !state.loc || product.loc === state.loc
        || product.loc.startsWith(`${state.loc}·`) || product.loc.startsWith(`${state.loc} `)
      const keywordHit = !keyword || [product.name, product.l1, product.l2, product.l3, product.loc, product.spec]
        .some((value) => value.toLowerCase().includes(keyword))
      return (!state.l1 || product.l1 === state.l1)
        && (!state.l2 || product.l2 === state.l2)
        && (!state.l3 || product.l3 === state.l3)
        && locHit && keywordHit
    })
    if (state.sort === '价格从低到高') {
      list.sort((a, b) => (a.priceVal ?? Number.POSITIVE_INFINITY) - (b.priceVal ?? Number.POSITIVE_INFINITY))
    } else if (state.sort === '价格从高到低') {
      list.sort((a, b) => (b.priceVal ?? Number.NEGATIVE_INFINITY) - (a.priceVal ?? Number.NEGATIVE_INFINITY))
    }
    return list
  }, [state])

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
          本页货源为原型目录示例，用于展示分类与筛选能力；实时库存、报价与供应商信息请进入
          <a href={hallUrl()} target="_blank" rel="noreferrer"> 交易大厅 </a>查看。
        </div>

        {visible.length === 0 ? (
          <div className="empty card">
            <Icon name="search" size={34} />
            <div className="mt-12 strong">没有匹配的货源</div>
            <div className="muted t-sm mt-8">试试更换分类或产地，或到交易大厅发布采购需求由平台智能匹配。</div>
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
