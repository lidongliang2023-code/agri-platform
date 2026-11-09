/**
 * 门户主导航在交易端的**唯一一份**实现。
 *
 * <p>之前大厅、下单页、商品详情、店铺详情四个页面各自抄了一遍 `<nav className="main-nav">`，
 * 抄完就再没人跟门户对齐：门户已经把「价格指数 / 产业资讯」从首页锚点改成独立频道
 * （`PortalLayout.tsx` 里专门写了原因——点锚点会在首页原地打转）、导航加了「政府监管」，
 * 而交易端这四份还停在旧链接和旧顺序上。</p>
 *
 * <p>链接目标一律指向门户页面上的同一入口；本站内部的差异（比如卖家中心资金页）
 * 由各页面自己的按钮承担，不再靠导航项区分。</p>
 */
const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`

/** 政府监管用户端与门户用的是同一个本机端口约定（见门户 utils.governmentUrl）。 */
const GOVERNMENT = `${window.location.protocol}//${window.location.hostname}:8108/`

const NAV_ITEMS: Array<{ label: string; href: string; key?: string }> = [
  { label: '首页', href: PORTAL },
  { label: '产业资讯', href: `${PORTAL}#/info` },
  { label: '交易大厅', href: '/hall', key: 'hall' },
  { label: '价格指数', href: `${PORTAL}#/info/market` },
  { label: '供应链金融', href: `${PORTAL}#/finance` },
  { label: '物流服务', href: `${PORTAL}#/logistics` },
  { label: '政府监管', href: GOVERNMENT },
]

/** @param active 当前高亮项的 key；这四个页面都属于「交易大厅」这条主线，默认 hall。 */
export function PortalNav({ active = 'hall' }: { active?: string }): JSX.Element {
  return (
    <nav className="main-nav">
      {NAV_ITEMS.map((item) => (
        <a key={item.label} className={item.key === active ? 'active' : undefined} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  )
}

export { PORTAL as PORTAL_ORIGIN }
