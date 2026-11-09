import { useState } from 'react'
import { PortalPageHero } from './PortalPageHero'
import { certificationGuides } from '../pages/certifyModel'
import '../pages/certify.css'

export function CertificationGuide({ kind }: { kind: keyof typeof certificationGuides }): JSX.Element {
  const guide = certificationGuides[kind]
  const [checked, setChecked] = useState<number[]>([])
  return <main className="portal-channel-page certify-page">
    <PortalPageHero badge={guide.badge} title={guide.title} description={guide.description}>
      <div className="certify-actions"><a className="btn portal-page-btn-light" href={guide.target}>{guide.action}</a><a className="btn portal-page-btn-ghost" href="#/certify">返回认证中心</a></div>
    </PortalPageHero>
    <div className="container certify-body">
      <nav aria-label="面包屑" className="certify-breadcrumb"><a href="#/">首页</a><span> / </span><a href="#/certify">认证中心</a><span> / {guide.title}</span></nav>
      <section className="certify-panel"><span className="certify-eyebrow">WHO CAN APPLY</span><h2>适用主体</h2><p>{guide.audience}</p></section>
      <div className="certify-guide-grid"><section className="certify-panel"><div className="certify-heading"><div><span className="certify-eyebrow">PREPARATION CHECKLIST</span><h2>办理前准备</h2></div><span className="certify-tag neutral">{checked.length} / {guide.materials.length} 已准备</span></div><p>此清单仅帮助自行准备，不保存材料、不提交申请，离开页面后重置。</p><div className="certify-checklist">{guide.materials.map((item, index) => <label key={item}><input type="checkbox" checked={checked.includes(index)} onChange={e => setChecked(values => e.target.checked ? [...values, index] : values.filter(value => value !== index))} /><span>{item}</span></label>)}</div><p className="certify-muted">实际必填项和核验方式以账号中心当前页面为准。</p></section>
      <section className="certify-panel"><span className="certify-eyebrow">APPLICATION PROCESS</span><h2>办理流程</h2><ol className="certify-steps">{guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span><div>{step}</div></li>)}</ol></section></div>
      <section className="certify-panel"><h2>办理须知</h2><ul className="certify-notes">{guide.notes.map(note => <li key={note}>{note}</li>)}</ul><div className="certify-actions"><a className="btn btn-primary" href={guide.target}>{guide.action}</a><a className="btn btn-outline" href="#/certify">查看我的认证状态</a><a href={kind === 'personal' ? '#/certify/enterprise' : '#/certify/personal'}>了解{kind === 'personal' ? '企业认证' : '个人实名'} →</a></div></section>
    </div>
  </main>
}
