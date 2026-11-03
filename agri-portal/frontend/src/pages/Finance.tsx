import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { financeUrl, ssoRegister } from '../utils'
import './finance.css'

const FUNDING_URL = financeUrl('/borrower/home')
const FUND_PROVIDER_URL = financeUrl('/fund/workbench')

const HERO_STATS = [
  { icon: 'money', label: '累计放款', value: '¥ 86.4', unit: '亿', meta: '覆盖 3,820 家产业链企业' },
  { icon: 'zap', label: '放款效率', value: '1.2', unit: '天', meta: '原型示例审批时效' },
  { icon: 'shield', label: '不良率', value: '0.68', unit: '%', meta: '原型示例风控口径' },
  { icon: 'layers', label: '合作资金方', value: '12', unit: '家', meta: '原型示例机构数量' },
]

const STATS = [
  { value: '¥ 86.4', unit: '亿', label: '累计放款额' },
  { value: '3,820', unit: '家', label: '融资企业数' },
  { value: '1.2', unit: '天', label: '平均放款时效' },
  { value: '0.68', unit: '%', label: '不良率' },
  { value: '¥ 45', unit: '亿', label: '在途融资余额' },
]

interface FinanceProduct {
  key: string
  icon: string
  title: string
  desc: string
  tags: string[]
  rate: string
  tone: string
}

interface ConfiguredFinanceProduct {
  id: string
  productCode: string
  productName: string
  rate: number
  termMin: number
  termMax: number
  amountMin: number
  amountMax: number
  pledgeRate?: number
  status: string
  description?: string
}

const PRODUCT_TONES = ['green', 'tech', 'emerald', 'sky', 'violet', 'amber']

function compactAmount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`
  if (value >= 10000) return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`
  return Number(value || 0).toLocaleString('zh-CN')
}

function toFinanceProduct(product: ConfiguredFinanceProduct, index: number): FinanceProduct {
  const pledgeRate = Number(product.pledgeRate || 0)
  return {
    key: product.productCode,
    icon: ['clipboard', 'file', 'box', 'cpu', 'cart'][index % 5],
    title: product.productName,
    desc: product.description || '基于平台真实交易与经营数据提供的农业产业链融资产品。',
    tags: [
      `额度 ${compactAmount(product.amountMin)}-${compactAmount(product.amountMax)}元`,
      `期限 ${product.termMin}-${product.termMax} 月`,
      pledgeRate > 0 ? `质押率 ${pledgeRate}%` : '纯信用',
    ],
    rate: Number(product.rate || 0).toFixed(2),
    tone: PRODUCT_TONES[index % PRODUCT_TONES.length],
  }
}

const RISKS = [
  {
    icon: 'chart',
    title: '交易信用',
    desc: '以平台订单、履约与结算数据形成买卖双方信用画像，识别真实经营与回款能力。',
  },
  {
    icon: 'truck',
    title: '物流数据',
    desc: '结合运输轨迹、温湿度与签收节点交叉验证货物流转，降低虚假交易风险。',
  },
  {
    icon: 'box',
    title: '仓单监管',
    desc: '监管仓出入库、称重与视频数据联动，动态更新质押物估值并预警异常。',
  },
  {
    icon: 'cpu',
    title: '生产 IoT',
    desc: '接入种植、养殖与设施环境数据，辅助判断产能、品质与未来回款能力。',
  },
]

const PARTNERS = [
  '中国农业银行',
  '中国建设银行',
  '交通银行',
  '中国邮政储蓄',
  '民生银行',
  '浙江网商银行',
  '新希望产业基金',
  '中农科投资',
]

const scrollTo = (id: string): void => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function Finance(): JSX.Element {
  const [products, setProducts] = useState<FinanceProduct[]>([])
  const [productLoading, setProductLoading] = useState(true)
  const [productError, setProductError] = useState('')
  useEffect(() => {
    let active = true
    void fetch('/open/finance/products', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json() as {
          code?: number
          message?: string
          data?: ConfiguredFinanceProduct[]
        }
        if (!response.ok || body.code !== 200 || !Array.isArray(body.data)) {
          throw new Error(body.message || '金融产品加载失败')
        }
        if (active) setProducts(body.data.map(toFinanceProduct))
      })
      .catch((error: unknown) => {
        if (active) setProductError(error instanceof Error ? error.message : '金融产品加载失败')
      })
      .finally(() => {
        if (active) setProductLoading(false)
      })
    return () => { active = false }
  }, [])
  const applyUrl = (productCode: string): string =>
    financeUrl(`/borrower/loan-apply?product=${encodeURIComponent(productCode)}`)
  /**
   * 在架产品里的最低年化利率。
   *
   * <p>Hero 那句"年化利率低至 X%"原先写死 4.5%，而下面的产品卡早就改成读资金方配置了 ——
   * 两边一旦不一致，页面顶部就在替资金方报一个没人承诺过的价。读不到产品就不说这句话。</p>
   */
  const minRate = products.length > 0
    ? Math.min(...products.map((product) => Number(product.rate) || 0))
    : null

  return (
    <>
      <section className="fin-hero">
        <div className="container fin-hero-grid">
          <div className="fin-hero-copy">
            <span className="fin-badge"><Icon name="money" size={13} />农业产业链专属金融平台</span>
            <h1>让每一笔订单<br />都能快速拿到钱</h1>
            <p>
              以真实交易数据为信用基础，连接核心企业、上下游与资金方，为农户、合作社、
              供应商和采购商提供全流程线上融资服务。
            </p>
            <div className="fin-hero-actions">
              <a className="btn btn-lg fin-btn-light" href={FUNDING_URL} target="_blank" rel="noreferrer">我要融资</a>
              <a className="btn btn-lg fin-btn-ghost" href={FUND_PROVIDER_URL} target="_blank" rel="noreferrer">我是资金方</a>
              <button className="btn btn-lg fin-btn-line" type="button" onClick={() => scrollTo('fin-products')}>查看金融产品</button>
            </div>
            <div className="fin-hero-points">
              {minRate !== null && (
                <span><i><Icon name="check" size={12} /></i>年化利率 {minRate.toFixed(2)}% 起（在架产品最低价）</span>
              )}
              <span><i><Icon name="check" size={12} /></i>全程线上办理</span>
            </div>
            <p className="fin-demo-line">
              产品名称、利率、额度与期限取自资金方端在架配置；放款时效、风控指标与机构名称仍为原型示例，
              最终以资金方审批为准。
            </p>
          </div>

          <div className="fin-hero-stats">
            {HERO_STATS.map((item) => (
              <div className="fin-hero-stat" key={item.label}>
                <div className="fin-hero-stat-label"><Icon name={item.icon} size={14} />{item.label}<em>示例</em></div>
                <strong className="mono">{item.value}<small>{item.unit}</small></strong>
                <p>{item.meta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fin-statbar">
        <div className="container">
          <div className="fin-statbar-head">
            <span>平台金融数据</span>
            <span className="tag tag-ghost">原型示例数据</span>
          </div>
          <div className="fin-stat-grid">
            {STATS.map((item) => (
              <div key={item.label}>
                <strong className="mono">{item.value}<small>{item.unit}</small></strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section fin-products-section" id="fin-products">
        <div className="container">
          <div className="fin-section-head">
            <span className="tag tag-tech">产品矩阵</span>
            <h2>专属金融产品 · 覆盖产业链全环节</h2>
            <p>产品名称、利率、额度和期限与资金方端产品配置实时同步。</p>
          </div>
          <div className="grid grid-3 fin-product-grid">
            {products.map((product) => (
              <article className="card card-hover fin-product" key={product.key}>
                <div className="card-b">
                  <div className="fin-product-head">
                    <span className={`fin-icon tone-${product.tone}`}><Icon name={product.icon} size={22} /></span>
                    <span className="tag tag-ghost">示例产品</span>
                  </div>
                  <h3>{product.title}</h3>
                  <p>{product.desc}</p>
                  <div className="chips fin-product-tags">
                    {product.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
                  </div>
                  <div className="fin-product-foot">
                    <span className="fin-rate">年化 <b>{product.rate}%</b> 起</span>
                    <a className="btn btn-sm btn-primary" href={applyUrl(product.key)} target="_blank" rel="noreferrer">立即申请</a>
                  </div>
                </div>
              </article>
            ))}
            {productLoading && <div className="fin-product-state">正在读取资金方启用的融资产品…</div>}
            {!productLoading && productError && (
              <div className="fin-product-state error">产品加载失败：{productError}</div>
            )}
            {!productLoading && !productError && products.length === 0 && (
              <div className="fin-product-state">资金方暂未启用融资产品。</div>
            )}
          </div>
          <p className="fin-section-note">
            产品数据来自资金方端「产品配置」；点击立即申请将进入供应链金融融资端并在登录后恢复目标页面。
          </p>
        </div>
      </section>

      <section className="section fin-risk-section">
        <div className="container">
          <div className="fin-section-head">
            <span className="tag">风控中台</span>
            <h2>三角链风控 · 让资金方敢放款</h2>
            <p>订单、物流、仓储与生产数据多源交叉验证，形成农业产业链专属信用评估依据。</p>
          </div>
          <div className="grid grid-4 fin-risk-grid">
            {RISKS.map((item) => (
              <div className="card card-hover" key={item.title}>
                <div className="card-b">
                  <span className="fin-risk-icon"><Icon name={item.icon} size={20} /></span>
                  <b>{item.title}</b>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section fin-partner-section" id="fin-partner">
        <div className="container">
          <div className="fin-section-head">
            <span className="tag tag-tech">合作机构</span>
            <h2>合作资金方生态</h2>
            <p>以下为原型示例机构，非平台正式合作名单；资金方入驻与联合风控方案请联系平台运营。</p>
          </div>
          <div className="grid grid-4 fin-partner-grid">
            {PARTNERS.map((partner) => (
              <div className="fin-partner" key={partner}>
                <span>{partner.slice(0, 1)}</span>
                <b>{partner}</b>
                <em>示例机构</em>
              </div>
            ))}
          </div>
          <div className="card fin-partner-callout">
            <div>
              <b><Icon name="users" size={18} />资金方合作</b>
              <p>认证资金机构可登录资金方工作台，配置融资资产、审批融资申请并查看投资与风控数据。</p>
            </div>
            <a className="btn btn-outline" href={FUND_PROVIDER_URL} target="_blank" rel="noreferrer">进入资金方端</a>
          </div>
        </div>
      </section>

      <section className="fin-cta">
        <div className="container">
          <div>
            <h3>完成注册与认证，在线发起融资申请</h3>
            <p>3 步办理：平台注册 → 实名认证 → 选择金融产品。当前门户展示产品与流程，正式申请在会员中心办理。</p>
          </div>
          <div className="fin-cta-actions">
            <a className="btn btn-lg fin-btn-light" href={ssoRegister()}>免费注册</a>
            <a className="btn btn-lg fin-btn-line" href={FUNDING_URL} target="_blank" rel="noreferrer">登录后申请融资</a>
          </div>
        </div>
      </section>
    </>
  )
}
