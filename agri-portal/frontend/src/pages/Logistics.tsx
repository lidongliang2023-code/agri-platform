import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { productionLogin, ssoRegister, tradeUrl } from '../utils'
import './logistics.css'

const SERVICES = [
  {
    icon: 'truck',
    title: '产地专线',
    desc: '从五常、寿光、赣州、湛江等核心产地直发全国销地，单程 5-15 吨整车。',
    tags: ['东北专线', '山东专线', '两广专线', '华中专线'],
    price: '¥ 0.35',
    unit: '/吨公里 起',
    tone: 'green',
  },
  {
    icon: 'activity',
    title: '冷链物流',
    desc: '蔬果 0-4℃ · 肉类 -18℃ · 水产 2-8℃ · 全程 GPS + 温湿度监控 · 异常自动报警。',
    tags: ['冷藏', '冷冻', '温控', '全程可视'],
    price: '¥ 0.98',
    unit: '/吨公里 起',
    tone: 'tech',
  },
  {
    icon: 'box',
    title: '城配末端',
    desc: '与本地生鲜配送网络合作，覆盖全国 280+ 地级市，T+1 送达城市超市与批发市场。',
    tags: ['280+ 城市', 'T+1 达', '超市直供', '批发市场'],
    price: '¥ 48',
    unit: '/票 起',
    tone: 'green',
  },
  {
    icon: 'shield',
    title: '监管仓服务',
    desc: '产地 + 销地双向监管仓 · 视频监控 + 称重 + 质量抽检 · 可做融资质押物。',
    tags: ['126 个仓', '融资质押', '智能抽检'],
    price: '¥ 2.5',
    unit: '/吨·天 起',
    tone: 'violet',
  },
]

const TRACK_STEPS = [
  { title: '五常基地装车完成 · 封签 FA-004862', meta: '2026-10-20 09:20 · 智能称重 24.08 吨 · 照片 12 张上链', state: 'done' },
  { title: '哈尔滨集散中心 入库分拣', meta: '2026-10-20 16:02 · 水分 14.2% 合格 · 温控 8℃ / 55% 正常', state: 'done' },
  { title: 'G1 高速 · 沈阳段行驶中', meta: '2026-10-21 08:45 · 距上海 1,248 km · 预计明日 14:30 到达', state: 'cur' },
  { title: '上海监管仓 待入库', meta: '预计 2026-10-22 14:30 · 入库质检 + 区块链二次存证', state: '' },
  { title: '中粮嘉定仓库 签收完成', meta: '预计 2026-10-22 16:00 · 收货方扫码签收', state: '' },
]

const NETWORK = [
  { value: '34', unit: '省', label: '全国省级行政区覆盖' },
  { value: '1,240', unit: '个', label: '合作网点' },
  { value: '126', unit: '个', label: '产地 / 销地监管仓' },
  { value: '280+', unit: '城', label: '城配末端覆盖' },
]

interface QuoteForm {
  origin: string
  originDetail: string
  destination: string
  destinationDetail: string
  cargoType: string
  weight: string
  unit: string
  truck: string
  date: string
  time: string
}

const INITIAL_QUOTE: QuoteForm = {
  origin: '黑龙江 哈尔滨 五常市',
  originDetail: '五常镇兴农街 128 号',
  destination: '上海 嘉定区',
  destinationDetail: '中粮集团嘉定仓库',
  cargoType: '粮油（常温）',
  weight: '24',
  unit: '吨',
  truck: '整车（5-15 吨）',
  date: '2026-10-22',
  time: '上午 8:00 前',
}

const scrollTo = (id: string): void => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function Logistics(): JSX.Element {
  const [form, setForm] = useState<QuoteForm>(INITIAL_QUOTE)
  const [notice, setNotice] = useState('')

  const patch = (next: Partial<QuoteForm>): void => {
    setForm((previous) => ({ ...previous, ...next }))
    setNotice('')
  }

  const submitQuote = (event: FormEvent): void => {
    event.preventDefault()
    if (!form.origin.trim() || !form.destination.trim() || !form.weight.trim()) {
      setNotice('请填写发货地、收货地和货物重量后再提交询价。')
      return
    }
    setNotice('询价信息已在本页校验通过，但当前门户尚未接入物流报价接口，不会生成正式运单。请登录后到会员中心「发货与物流」联系承运方确认报价。')
  }

  return (
    <>
      <section className="logi-hero">
        <div className="container logi-hero-inner">
          <div>
            <span className="logi-hero-badge"><Icon name="truck" size={14} />全国农业产地 · 销地一体化物流网络</span>
            <h1>从田间到餐桌<br />全程温控可追溯</h1>
            <p>
              整合产地专线、冷链物流、城配末端、监管仓四大网络，全程 GPS + 温湿度监控 + 区块链存证，
              让每一件农产品从采收、运输到上架都可追溯。
            </p>
            <div className="logi-hero-actions">
              <button type="button" className="btn btn-lg logi-btn-light" onClick={() => scrollTo('quote')}>在线询价</button>
              <a className="btn btn-lg logi-btn-ghost" href={tradeUrl('/member/seller?tab=ship')} target="_blank" rel="noreferrer">查看我的物流</a>
              <button type="button" className="btn btn-lg logi-btn-ghost" onClick={() => scrollTo('network')}>网络覆盖</button>
            </div>
            <div className="logi-hero-points">
              <span><Icon name="check" size={12} />全国 34 省覆盖</span>
              <span><Icon name="check" size={12} />全程温控 · 区块链存证</span>
              <span><Icon name="check" size={12} />T+1 时效达 82%</span>
            </div>
          </div>

          <div className="logi-live-card">
            <div className="logi-live-head">
              <span className="tag tag-tech">LIVE · 实时追踪</span>
              <span className="logi-demo-tag">演示轨迹</span>
            </div>
            <strong>运单号 YD-20261020-004862 · 五常 → 上海</strong>
            <small>货主：五常粮油合作社 · 收货：中粮上海仓库 · 富硒大米 24 吨</small>
            <div className="logi-live-steps">
              {TRACK_STEPS.slice(0, 4).map((step, index) => (
                <div className={`logi-step ${step.state}`} key={step.title}>
                  <span>{index + 1}</span>
                  <div><b>{step.title}</b><small>{step.meta}</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="logi-statbar">
        <div className="container logi-statgrid">
          <div><strong>12.8<small>万车</small></strong><span>近一年运输车次</span></div>
          <div><strong>3.8<small>亿吨公里</small></strong><span>累计货物流转</span></div>
          <div><strong>82<small>%</small></strong><span>T+1 次日达率</span></div>
          <div><strong>99.2<small>%</small></strong><span>温控达标率</span></div>
          <div><strong>1,240<small>个</small></strong><span>合作网点 + 监管仓</span></div>
        </div>
      </section>

      <section className="section logi-services">
        <div className="container">
          <div className="logi-section-head">
            <span className="tag tag-tech">服务矩阵</span>
            <h2>四大物流服务 · 覆盖从产地到餐桌全链路</h2>
            <p>产地专线 + 冷链物流 + 城配末端 + 监管仓，任一段都有农产云专属方案</p>
          </div>
          <div className="grid grid-4">
            {SERVICES.map((service) => (
              <div className={`card card-hover logi-service tone-${service.tone}`} key={service.title}>
                <div className="card-b">
                  <span className="logi-service-icon"><Icon name={service.icon} size={22} /></span>
                  <h3>{service.title}</h3>
                  <p>{service.desc}</p>
                  <div className="chips">{service.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
                  <div className="logi-service-foot">
                    <span><b>{service.price}</b><small>{service.unit}</small></span>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => scrollTo('quote')}>询价</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section logi-track-section" id="track">
        <div className="container">
          <div className="logi-section-head">
            <span className="tag">全程可视</span>
            <h2>GPS + 温湿度 + 区块链 · 让每一件货都在视线内</h2>
            <p>运输车辆实时上报位置与温湿度，关键节点自动上链</p>
          </div>
          <div className="logi-track-layout">
            <div className="card">
              <div className="card-b">
                <div className="logi-track-title">
                  <h3>运单追踪 · YD-20261020-004862</h3>
                  <span className="tag tag-tech">示例运单</span>
                </div>
                <dl className="logi-kv">
                  <dt>货主</dt><dd>五常粮油合作社</dd>
                  <dt>收货方</dt><dd>中粮集团 · 上海嘉定仓库</dd>
                  <dt>货物</dt><dd>富硒大米 24 吨 / 1,200 袋 / 5kg 装</dd>
                  <dt>承运方</dt><dd>农产云产地专线 · 东北-华东线</dd>
                  <dt>司机</dt><dd>张师傅 · 黑 A·D3821 · 驾龄 12 年</dd>
                </dl>
                <div className="logi-timeline">
                  {TRACK_STEPS.map((step, index) => (
                    <div className={`logi-step ${step.state}`} key={step.title}>
                      <span>{index + 1}</span>
                      <div><b>{step.title}</b><small>{step.meta}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="logi-capabilities">
              {[
                { icon: 'cpu', title: 'GPS + 北斗 双模定位', desc: '每 30 秒上报位置，精度 ≤ 10 米，偏离路线自动预警。' },
                { icon: 'activity', title: '温湿度实时监控', desc: '每 60 秒上报车厢温湿度，超限自动通知司机、调度与货主。' },
                { icon: 'shield', title: '区块链节点存证', desc: '装车、分拣、过检、签收节点自动上链，不可篡改。' },
                { icon: 'alert', title: '异常自动响应', desc: '温湿度超限 / 超时 / 位置异常自动派单最近救援点。' },
              ].map((item) => (
                <div className="card card-hover" key={item.title}>
                  <div className="card-b logi-capability">
                    <span><Icon name={item.icon} size={18} /></span>
                    <div><b>{item.title}</b><p>{item.desc}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="quote">
        <div className="container logi-quote-layout">
          <div className="card logi-quote-card">
            <div className="card-b">
              <h3>在线询价 · 收集运输需求</h3>
              <p>填写货物信息，当前页面会校验完整性；正式报价与承运方确认需登录后办理。</p>
              <form className="logi-quote-form" onSubmit={submitQuote}>
                <div className="logi-form-row">
                  <label>发货地<input className="input" value={form.origin} onChange={(event) => patch({ origin: event.target.value })} placeholder="省 / 市 / 区 或 基地名" /></label>
                  <label>详细地址<input className="input" value={form.originDetail} onChange={(event) => patch({ originDetail: event.target.value })} placeholder="详细地址" /></label>
                </div>
                <div className="logi-form-row">
                  <label>收货地<input className="input" value={form.destination} onChange={(event) => patch({ destination: event.target.value })} placeholder="省 / 市 / 区" /></label>
                  <label>详细地址<input className="input" value={form.destinationDetail} onChange={(event) => patch({ destinationDetail: event.target.value })} placeholder="仓库 / 收货点" /></label>
                </div>
                <div className="logi-field">
                  <span>货物类型</span>
                  <div className="chips">
                    {['粮油（常温）', '果蔬（冷藏）', '肉类（冷冻）', '水产', '农资'].map((type) => (
                      <button type="button" key={type} className={`chip${form.cargoType === type ? ' on' : ''}`}
                        onClick={() => patch({ cargoType: type })}>{type}</button>
                    ))}
                  </div>
                </div>
                <div className="logi-form-row logi-form-row-3">
                  <label>货物重量<input className="input" value={form.weight} onChange={(event) => patch({ weight: event.target.value })} /></label>
                  <label>单位<select className="select" value={form.unit} onChange={(event) => patch({ unit: event.target.value })}><option>吨</option><option>千克</option></select></label>
                  <label>运输方式<select className="select" value={form.truck} onChange={(event) => patch({ truck: event.target.value })}><option>整车（5-15 吨）</option><option>零担</option></select></label>
                </div>
                <div className="logi-form-row">
                  <label>期望发货日期<input className="input" type="date" value={form.date} onChange={(event) => patch({ date: event.target.value })} /></label>
                  <label>期望时段<select className="select" value={form.time} onChange={(event) => patch({ time: event.target.value })}><option>上午 8:00 前</option><option>下午 14:00 前</option><option>时间不限</option></select></label>
                </div>
                <button type="submit" className="btn btn-primary logi-quote-submit">提交询价意向</button>
                {notice && <div className="logi-notice">{notice}</div>}
              </form>
            </div>
          </div>

          <div className="logi-estimate">
            <div className="logi-estimate-card">
              <span>系统预估报价（演示 · 仅参考）</span>
              <strong>¥ 18,200</strong>
              <small>运价 ¥0.36 / 吨公里 × 5,050 吨公里 · 含保险 · 含装卸</small>
              <div className="logi-estimate-grid">
                <div><span>预计时效</span><b>2.5 天</b></div>
                <div><span>里程</span><b>2,525 km</b></div>
                <div><span>保险</span><b>已含 1%</b></div>
                <div><span>温控</span><b>常温车厢</b></div>
              </div>
            </div>
            <div className="card">
              <div className="card-b">
                <div className="logi-carrier-head"><b>推荐承运方</b><span>示例 · 按评分排序</span></div>
                {[
                  { short: '东', name: '东北快线 · 农产云认证承运方', meta: '¥17,800 · 时效 2 天 · 评分 4.9', tag: '首选' },
                  { short: '顺', name: '顺丰冷运 · 华东干线', meta: '¥18,600 · 时效 1.5 天 · 评分 4.8', tag: '冷链' },
                  { short: '京', name: '京东冷链 · 上海落地配', meta: '¥18,200 · 时效 2 天 · 评分 4.8', tag: '城配' },
                ].map((carrier) => (
                  <div className="logi-carrier" key={carrier.short}>
                    <span>{carrier.short}</span>
                    <div><b>{carrier.name}</b><small>{carrier.meta}</small></div>
                    <em className="tag tag-tech">{carrier.tag}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section logi-network-section" id="network">
        <div className="container">
          <div className="logi-section-head">
            <span className="tag">网络覆盖</span>
            <h2>全国 34 省 · 1,240 网点 · 126 监管仓</h2>
            <p>网络数据为原型示例，接入物流主数据后替换为真实网点与仓容</p>
          </div>
          <div className="grid grid-4">
            {NETWORK.map((item) => (
              <div className="card logi-network-card" key={item.label}>
                <div className="card-b"><strong>{item.value}<small>{item.unit}</small></strong><span>{item.label}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="logi-cta">
        <div className="container">
          <div>
            <h3>注册农产云，享受专属物流优惠</h3>
            <p>平台认证承运方、在线询价、全程温控与区块链存证，一站式完成。</p>
          </div>
          <div className="logi-cta-actions">
            <a className="btn btn-lg logi-btn-light" href={ssoRegister()}>免费注册</a>
            <a className="btn btn-lg logi-btn-ghost" href={productionLogin()}>已有账号，去登录</a>
          </div>
        </div>
      </section>
    </>
  )
}
