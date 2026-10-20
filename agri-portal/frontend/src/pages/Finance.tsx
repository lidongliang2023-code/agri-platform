import { Icon } from '../components/Icon'
import { ssoRegister, tradeUrl } from '../utils'
import './finance.css'

const FUNDING_URL = tradeUrl('/member/seller?tab=fund')

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
  icon: string
  title: string
  desc: string
  tags: string[]
  rate: string
  tone: string
  cooperation?: boolean
}

const PRODUCTS: FinanceProduct[] = [
  {
    icon: 'clipboard',
    title: '订单融资',
    desc: '卖家凭已成交的平台订单申请融资，资金方放款后，买家付款自动用于清偿。',
    tags: ['额度 500 万', '期限 1-6 月', '最快 1 天'],
    rate: '4.5',
    tone: 'green',
  },
  {
    icon: 'file',
    title: '应收账款质押',
    desc: '供应商将对核心企业的应收账款质押给资金方，核心企业确权后完成放款。',
    tags: ['额度 2,000 万', '期限 1-12 月', '核心企业增信'],
    rate: '5.2',
    tone: 'tech',
  },
  {
    icon: 'box',
    title: '存货质押融资',
    desc: '以监管仓中的农产品存货作为质押物，结合出入库与物联网数据动态估值。',
    tags: ['额度 1,000 万', '期限 1-9 月', '物联网估值'],
    rate: '5.8',
    tone: 'emerald',
  },
  {
    icon: 'cpu',
    title: '农机 / 设备贷',
    desc: '合作社与农户购买智能农机、水肥一体机、物联网设备可申请专项信贷。',
    tags: ['额度 100 万', '期限 1-3 年', '政府贴息'],
    rate: '3.8',
    tone: 'sky',
  },
  {
    icon: 'cart',
    title: '农资采购贷',
    desc: '种植户、合作社采购种子、化肥、农药时可申请分期融资，按季安排还款。',
    tags: ['额度 50 万', '期限 3-12 月', '零首付'],
    rate: '6.0',
    tone: 'violet',
  },
  {
    icon: 'users',
    title: '核心企业赋能',
    desc: '核心企业可为上下游提供确权、信用背书与反向保理，共同拓展产业链金融生态。',
    tags: ['反向保理', '信用背书', '授信额度'],
    rate: '',
    tone: 'amber',
    cooperation: true,
  },
]

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
              <button className="btn btn-lg fin-btn-ghost" type="button" onClick={() => scrollTo('fin-partner')}>我是资金方</button>
              <button className="btn btn-lg fin-btn-line" type="button" onClick={() => scrollTo('fin-products')}>查看金融产品</button>
            </div>
            <div className="fin-hero-points">
              <span><i><Icon name="check" size={12} /></i>审批最快 1 天</span>
              <span><i><Icon name="check" size={12} /></i>年化利率低至 4.5%</span>
              <span><i><Icon name="check" size={12} /></i>全程线上办理</span>
            </div>
            <p className="fin-demo-line">页面额度、利率、时效与机构数据均为原型示例，最终以资金方审批为准。</p>
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
            <h2>五大专属金融产品 · 覆盖产业链全环节</h2>
            <p>基于平台交易、物流、仓储与生产数据设计融资场景，额度与利率为原型示例。</p>
          </div>
          <div className="grid grid-3 fin-product-grid">
            {PRODUCTS.map((product) => (
              <article className="card card-hover fin-product" key={product.title}>
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
                    {product.rate
                      ? <span className="fin-rate">年化 <b>{product.rate}%</b> 起</span>
                      : <span className="fin-muted">成为核心企业，赋能上下游</span>}
                    {product.cooperation
                      ? <button className="btn btn-sm btn-outline" type="button" onClick={() => scrollTo('fin-partner')}>咨询合作</button>
                      : <a className="btn btn-sm btn-primary" href={FUNDING_URL} target="_blank" rel="noreferrer">立即申请</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="fin-section-note">
            当前门户未接入授信申请接口，“立即申请”将进入会员中心资金服务；请登录并完成实名认证后办理。
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
              <p>当前门户尚未开放资金方线上入驻。机构可围绕订单融资、仓单质押与核心企业确权场景，与平台运营对接联合风控和数据服务方案。</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={() => scrollTo('fin-products')}>返回金融产品</button>
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
