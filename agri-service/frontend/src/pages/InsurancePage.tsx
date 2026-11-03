import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { App, Button, Form, Input, InputNumber, Modal, Select } from 'antd'
import { serviceApi } from '../api'
import type { InsuranceClaim, InsurancePolicy, InsuranceProduct } from '../types'
import { EmptyState, INSURANCE_STATUS, LoadingBlock, PageTitle, StatusTag } from '../components/ui'

const CLAIM_STEPS = ['报案提交', '查勘定损', '公示', '赔款支付']

function stepDone(progress: number, index: number): boolean {
  if (index === 0) return progress >= 20
  if (index === 1) return progress >= 45
  if (index === 2) return progress >= 85
  return progress >= 100
}

export function InsurancePage(): JSX.Element {
  const { message } = App.useApp()
  const [products, setProducts] = useState<InsuranceProduct[]>([])
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<InsuranceProduct | null>(null)
  const [detailPolicy, setDetailPolicy] = useState<InsurancePolicy | null>(null)
  const [claimPolicy, setClaimPolicy] = useState<InsurancePolicy | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [insureForm] = Form.useForm()
  const [claimForm] = Form.useForm()
  const watchedAmount = Form.useWatch('insuredAmount', insureForm)

  const load = useCallback((): void => {
    setLoading(true)
    Promise.all([
      serviceApi.insuranceProducts(),
      serviceApi.insurancePolicies(),
      serviceApi.insuranceClaims(),
      serviceApi.identity().catch(() => null),
    ])
      .then(([productList, policyList, claimList, identity]) => {
        setProducts(productList)
        setPolicies(policyList)
        setClaims(claimList)
        setSubjectName(identity?.merchantName ?? '')
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoading(false))
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const openInsure = (product: InsuranceProduct): void => {
    setSelectedProduct(product)
    insureForm.setFieldsValue({ insuredAmount: undefined })
  }

  const estimate = (): { premium: number; coverage: number } | null => {
    const amount = Number(watchedAmount)
    if (!selectedProduct || !amount || amount <= 0) return null
    return {
      premium: Math.round(Number(selectedProduct.premiumRate) * amount * 100) / 100,
      coverage: Math.round(Number(selectedProduct.coveragePerUnit) * amount * 100) / 100,
    }
  }

  const submitInsure = async (): Promise<void> => {
    if (!selectedProduct) return
    setSubmitting(true)
    try {
      const values = await insureForm.validateFields()
      const policy = await serviceApi.insure({ productId: selectedProduct.id, ...values })
      setSelectedProduct(null)
      message.success(`投保成功，保单 ${policy.policyNo} 自 ${policy.effectiveDate} 起保障`)
      load()
    } catch (reason) {
      if (reason instanceof Error) message.error(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openClaim = (policy?: InsurancePolicy): void => {
    const chosen = policy ?? policies.find((item) => item.status !== 'expired')
    if (!chosen) {
      message.warning('当前没有可报案的保单')
      return
    }
    setClaimPolicy(chosen)
    claimForm.setFieldsValue({ policyId: chosen.id, disasterType: '暴雨内涝', lossArea: '', description: '' })
  }

  const submitClaim = async (): Promise<void> => {
    setSubmitting(true)
    try {
      const values = await claimForm.validateFields()
      const claim = await serviceApi.createClaim(values)
      setClaimPolicy(null)
      message.success(`报案 ${claim.claimNo} 已提交，进入查勘后会在此更新进度`)
      load()
    } catch (reason) {
      if (reason instanceof Error) message.error(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openCount = claims.filter((claim) => !['paid', 'closed', 'rejected'].includes(claim.status)).length

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AGRICULTURAL INSURANCE"
        title="农险服务"
        description="在售险种按费率实时测算保费与保额；保单、报案与理赔进度都归属当前经营主体。"
        actions={<Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => openClaim()}>出险报案</Button>}
      />

      <section className="insurance-banner">
        <div>
          <span className="hero-kicker"><i /> 平台协办 · 主体名下</span>
          <h2>{subjectName || '未解析到经营主体'}</h2>
          <p>保费 = 险种费率 × 投保数量，保额 = 单位保额 × 投保数量，两个数字都由服务端算出。</p>
        </div>
        <div className="insurance-banner-stats">
          <div><b>{products.length}</b><span>在售险种</span></div>
          <div><b>{policies.length}</b><span>我的保单</span></div>
          <div><b>{openCount}</b><span>在途理赔</span></div>
        </div>
      </section>

      {loading ? <LoadingBlock rows={3} /> : (
        <>
          <section className="surface-card detail-section">
            <div className="section-heading compact">
              <div><span className="section-kicker">PRODUCTS</span><h2>在售险种</h2></div>
              <span className="section-note">费率与单位保额来自险种配置</span>
            </div>
            <div className="insurance-product-grid">
              {products.map((product) => (
                <article className="insurance-product-card" key={product.id}>
                  <div className="insurance-product-head">
                    <span>{product.icon}</span>
                    <div><small>{product.category}</small><h3>{product.name}</h3></div>
                  </div>
                  <p>{product.summary}</p>
                  <div className="insurance-product-tags">{product.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <div className="insurance-product-price">
                    <span><small>展示保费</small><b>{product.premium}</b></span>
                    <span><small>展示保额</small><b>{product.coverage}</b></span>
                  </div>
                  <div className="insurance-product-price">
                    <span><small>费率</small><b>¥{product.premiumRate}/{product.unitMeasure}</b></span>
                    <span><small>单位保额</small><b>¥{product.coveragePerUnit}</b></span>
                  </div>
                  <Button block onClick={() => openInsure(product)}>测算并投保</Button>
                </article>
              ))}
            </div>
          </section>

          <div className="insurance-lower-grid">
            <section className="surface-card detail-section">
              <div className="section-heading compact">
                <div><span className="section-kicker">MY POLICIES</span><h2>我的保单</h2></div>
                <span className="section-note">{policies.length} 份保单</span>
              </div>
              {policies.length === 0 ? <EmptyState icon="🛡️" title="本主体还没有保单" description="可在上方选择险种投保" /> : (
                <div className="policy-list">
                  {policies.map((policy) => (
                    <article key={policy.id}>
                      <div className="policy-list-head">
                        <span><SafetyCertificateOutlined /></span>
                        <div><b>{policy.productName}</b><small>{policy.policyNo} · {policy.insuredSubject}</small></div>
                        <StatusTag status={policy.status} labels={INSURANCE_STATUS} />
                      </div>
                      <div className="policy-list-meta">
                        <span><small>承保标的</small><b>{policy.insuredArea}</b></span>
                        <span><small>自缴保费</small><b>¥{policy.premium.toLocaleString('zh-CN')}</b></span>
                        <span><small>保障额度</small><b>¥{policy.coverageAmount.toLocaleString('zh-CN')}</b></span>
                        <span><small>生效日期</small><b>{policy.effectiveDate}</b></span>
                      </div>
                      <div className="policy-list-actions">
                        <Button size="small" onClick={() => setDetailPolicy(policy)}>保单要素</Button>
                        {policy.status !== 'expired' && <Button size="small" type="primary" ghost onClick={() => openClaim(policy)}>出险报案</Button>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="surface-card detail-section">
              <div className="section-heading compact">
                <div><span className="section-kicker">CLAIMS</span><h2>理赔进度</h2></div>
                <span className="section-note">状态由平台案件流转推进</span>
              </div>
              {claims.length === 0 ? <EmptyState icon="🛡️" title="暂无理赔案件" /> : claims.map((claim) => (
                <article className="claim-card" key={claim.id}>
                  <div className="claim-card-head">
                    <span><ClockCircleOutlined /></span>
                    <div><b>{claim.disasterType}</b><small>{claim.claimNo} · {claim.policyNo}</small></div>
                    <StatusTag status={claim.status} labels={INSURANCE_STATUS} />
                  </div>
                  <p>{claim.description}</p>
                  <div className="claim-progress"><i style={{ width: `${claim.progress}%` }} /><span>{claim.progress}%</span></div>
                  <div className="claim-steps">
                    {CLAIM_STEPS.map((step, index) => (
                      <span className={stepDone(claim.progress, index) ? 'done' : ''} key={step}>
                        <CheckCircleFilled />{step}
                      </span>
                    ))}
                  </div>
                  <small>查勘与定损由保险机构执行，平台只同步案件状态；进度更新会写入消息中心。</small>
                </article>
              ))}
            </section>
          </div>
        </>
      )}

      <Modal title={`测算并投保 · ${selectedProduct?.name ?? ''}`} open={Boolean(selectedProduct)} onCancel={() => setSelectedProduct(null)} onOk={() => void submitInsure()} confirmLoading={submitting} okText="确认投保">
        <Form form={insureForm} layout="vertical">
          <Form.Item label="投保主体（登录令牌解析）">
            <Input value={subjectName || '未解析到经营主体'} readOnly disabled />
          </Form.Item>
          <Form.Item label={`投保数量（${selectedProduct?.unitMeasure ?? '单位'}）`} name="insuredAmount"
            rules={[{ required: true, message: '请填写投保数量' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <div className="insurance-confirm-note">
            {(() => {
              const values = estimate()
              return values
                ? `按费率 ¥${selectedProduct?.premiumRate}/${selectedProduct?.unitMeasure} 测算：应交保费 ¥${values.premium}，保障额度 ¥${values.coverage}。`
                : '填写数量后按险种费率测算；最终以服务端计算为准。'
            })()}
          </div>
          <div className="insurance-confirm-note">政府补贴比例以保险机构核保与地方政策为准，平台不在本环节计算补贴。</div>
        </Form>
      </Modal>

      <Modal title="出险报案" open={Boolean(claimPolicy)} onCancel={() => setClaimPolicy(null)} onOk={() => void submitClaim()} confirmLoading={submitting} okText="提交报案">
        <Form form={claimForm} layout="vertical">
          <Form.Item name="policyId" hidden><Input /></Form.Item>
          <div className="claim-policy-summary">{claimPolicy?.productName} · {claimPolicy?.policyNo} · {claimPolicy?.insuredArea}</div>
          <Form.Item label="灾害类型" name="disasterType" rules={[{ required: true }]}>
            <Select options={['暴雨内涝', '干旱', '风灾', '冻害', '病虫害', '意外事故'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item label="受灾面积" name="lossArea" rules={[{ required: true, message: '请填写受灾面积，如 12亩' }]}>
            <Input placeholder="如 12亩" />
          </Form.Item>
          <Form.Item label="受灾情况" name="description" rules={[{ required: true, message: '请描述受灾情况' }]}>
            <Input.TextArea rows={5} placeholder="请说明发生时间、受灾范围、当前水位或作物状态" />
          </Form.Item>
          <div className="insurance-confirm-note">本版不接收照片附件；现场查勘由保险机构安排，案件状态变化会在理赔进度与消息中心同步。</div>
        </Form>
      </Modal>

      <Modal title={`保单要素 · ${detailPolicy?.policyNo ?? ''}`} open={Boolean(detailPolicy)} onCancel={() => setDetailPolicy(null)} footer={<Button onClick={() => setDetailPolicy(null)}>关闭</Button>} width={620}>
        {detailPolicy && (
          <div className="contract-preview">
            <dl>
              <dt>险种</dt><dd>{detailPolicy.productName}</dd>
              <dt>投保主体</dt><dd>{detailPolicy.insuredSubject}</dd>
              <dt>承保标的</dt><dd>{detailPolicy.insuredArea}</dd>
              <dt>自缴保费</dt><dd>¥{detailPolicy.premium.toLocaleString('zh-CN')}</dd>
              <dt>保障额度</dt><dd>¥{detailPolicy.coverageAmount.toLocaleString('zh-CN')}</dd>
              <dt>生效日期</dt><dd>{detailPolicy.effectiveDate}</dd>
              <dt>保单状态</dt><dd>{INSURANCE_STATUS[detailPolicy.status]?.label ?? detailPolicy.status}</dd>
            </dl>
            <p className="contract-clause">以上是平台侧记录的保单要素；正式保单与免责条款以保险机构出具的文件为准。</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
