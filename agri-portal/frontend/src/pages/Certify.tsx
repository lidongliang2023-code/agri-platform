import { useState } from 'react'
import { Icon } from '../components/Icon'
import { CERT_BENEFITS, CERT_FAQ, CERT_MATERIALS, CERT_STEPS } from '../data/portal'
import { productionLogin, ssoRegister } from '../utils'

export function Certify(): JSX.Element {
  const [open, setOpen] = useState(0)

  return (
    <>
      <section className="portal-cert-hero">
        <div className="container portal-cert-hero-inner">
          <div>
            <div className="tag tag-tech"><Icon name="shield" size={13} />平台认证</div>
            <h1>认证中心</h1>
            <p>完成企业资质或个人实名认证，解锁大宗交易、供应链金融、质量溯源等平台权益。</p>
          </div>
          <div className="portal-cert-hero-stats">
            <div><strong>12,800+</strong><span>已认证企业</span></div>
            <div><strong>1-3</strong><span>工作日审核</span></div>
            <div><strong>96.5%</strong><span>认证通过率</span></div>
          </div>
        </div>
      </section>

      <section className="container portal-cert-body">
        <div className="card portal-status-card">
          <div className="card-h">
            <h3><Icon name="award" size={18} />我的认证状态</h3>
            <span className="tag tag-ghost">登录后查看</span>
          </div>
          <div className="card-b portal-status-body">
            <div className="portal-status-copy">
              <div className="strong t-lg">登录后查看实名与企业认证进度</div>
              <p className="muted t-sm mt-8">
                认证状态与申请材料只对账号本人可见。登录后可查看审核进度、补充材料或更新证件有效期。
              </p>
              <div className="row gap-8 mt-16 portal-wrap">
                <a className="btn btn-primary" href={productionLogin()}>登录查看</a>
                <a className="btn btn-outline" href={ssoRegister()}>注册账号</a>
              </div>
            </div>
            <div className="portal-status-track">
              {['账号注册', '实名认证', '企业认证', '认证完成'].map((step, index) => (
                <div className={`portal-status-node${index === 0 ? ' done' : ''}`} key={step}>
                  <span>{index === 0 ? <Icon name="check" size={14} /> : index + 1}</span>
                  <div><strong>{step}</strong><small>{index === 0 ? '创建账号即可开始' : '登录后按指引办理'}</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section-head portal-cert-head">
          <div>
            <div className="bar-title">认证入口</div>
            <div className="sub">按经营主体类型选择认证方式</div>
          </div>
        </div>
        <div className="grid grid-2">
          <div className="card card-hover">
            <div className="card-b portal-entry-card">
              <div className="stat-icon tech"><Icon name="user" size={22} /></div>
              <div>
                <div className="row center gap-8">
                  <strong className="t-lg">个人实名认证</strong>
                  <span className="tag">自然人</span>
                </div>
                <p className="muted t-sm mt-8">适合家庭农场、农民专业合作社成员、个体采购户与农产品经纪人。</p>
                <div className="row gap-8 mt-16 portal-wrap">
                  <a className="btn btn-outline" href="#/certify/personal">查看办理说明</a>
                  <a className="btn btn-ghost" href={productionLogin()}>登录后办理</a>
                </div>
              </div>
            </div>
          </div>
          <div className="card card-hover">
            <div className="card-b portal-entry-card">
              <div className="stat-icon"><Icon name="factory" size={22} /></div>
              <div>
                <div className="row center gap-8">
                  <strong className="t-lg">企业认证</strong>
                  <span className="tag tag-amber">经营主体</span>
                </div>
                <p className="muted t-sm mt-8">适合公司、合作社等需要开具企业票据、参与大宗交易与申请供应链金融的主体。</p>
                <div className="row gap-8 mt-16 portal-wrap">
                  <a className="btn btn-outline" href="#/certify/enterprise">查看办理说明</a>
                  <a className="btn btn-ghost" href={productionLogin()}>登录后办理</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="section portal-cert-section">
          <div className="section-head">
            <div>
              <div className="bar-title">认证后解锁的权益</div>
              <div className="sub">平台担保交易、金融与溯源服务的前提</div>
            </div>
          </div>
          <div className="grid grid-4">
            {CERT_BENEFITS.map((benefit) => (
              <div className="card card-hover" key={benefit.title}>
                <div className="card-b">
                  <div className="stat-icon mb-12"><Icon name={benefit.icon} size={20} /></div>
                  <div className="strong">{benefit.title}</div>
                  <div className="muted t-sm mt-8 portal-two-line">{benefit.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section portal-cert-section">
          <div className="section-head">
            <div>
              <div className="bar-title">认证流程</div>
              <div className="sub">资料齐全时通常 1-3 个工作日内完成</div>
            </div>
          </div>
          <div className="portal-process">
            {CERT_STEPS.map((step, index) => (
              <div className="portal-process-step" key={step.title}>
                <span className="portal-process-no">{index + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section portal-cert-section">
          <div className="section-head">
            <div>
              <div className="bar-title">所需材料清单</div>
              <div className="sub">提前准备可减少驳回与补正</div>
            </div>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-h"><h3><Icon name="factory" size={18} />企业认证材料</h3></div>
              <div className="card-b">
                <ul className="portal-material-list">
                  {CERT_MATERIALS.enterprise.map((item) => <li key={item}><Icon name="check" size={13} />{item}</li>)}
                </ul>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3><Icon name="user" size={18} />个人实名材料</h3></div>
              <div className="card-b">
                <ul className="portal-material-list">
                  {CERT_MATERIALS.personal.map((item) => <li key={item}><Icon name="check" size={13} />{item}</li>)}
                </ul>
                <div className="portal-security-note">
                  <Icon name="shield" size={14} />
                  身份证号仅存掩码与加盐摘要，平台不保存明文。
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section portal-cert-section">
          <div className="section-head">
            <div>
              <div className="bar-title">常见问题</div>
              <div className="sub">关于认证类型、审核时效与材料变更</div>
            </div>
          </div>
          <div className="portal-faq">
            {CERT_FAQ.map((item, index) => (
              <div className={`portal-faq-item${open === index ? ' open' : ''}`} key={item.q}>
                <button type="button" onClick={() => setOpen(open === index ? -1 : index)}>
                  {item.q}<Icon name={open === index ? 'close' : 'plus'} size={16} />
                </button>
                {open === index && <p>{item.a}</p>}
              </div>
            ))}
          </div>
        </section>

        <div className="portal-cert-cta">
          <div>
            <strong>准备好开始认证了吗？</strong>
            <span>注册账号后即可在认证中心提交材料并跟踪审核进度。</span>
          </div>
          <div className="row gap-8 portal-wrap">
            <a className="btn btn-lg portal-btn-light" href={ssoRegister()}>免费注册</a>
            <a className="btn btn-lg portal-btn-ghost" href={productionLogin()}>已有账号，去登录</a>
          </div>
        </div>
      </section>
    </>
  )
}
