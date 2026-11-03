import { useEffect, useState } from 'react'
import { CheckCircleFilled, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Drawer, Input, Tag, message } from 'antd'
import { infoApi } from '../api'
import type { Attestation } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile } from '../components/ui'

interface VerifyResult {
  valid: boolean
  message: string
  record?: Attestation
}

/**
 * 内容存证：展示已上链的内容清单，并提供公开验真入口。
 * 验真只校验编号与哈希，不返回原文，避免内容被爬取。
 */
export function AttestPage(): JSX.Element {
  const [items, setItems] = useState<Attestation[] | null>(null)
  const [error, setError] = useState('')
  const [attestNo, setAttestNo] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [detail, setDetail] = useState<Attestation | null>(null)

  const load = (): void => {
    setError('')
    infoApi.attestations()
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  // 显式传入编号，避免刚 setAttestNo 就立即验真时读到旧 state。
  const verify = (target?: string): void => {
    const no = (target ?? attestNo).trim()
    if (!no) { message.warning('请输入存证编号'); return }
    setAttestNo(no)
    setVerifying(true)
    infoApi.verifyAttestation(no)
      .then(setResult)
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setVerifying(false))
  }

  if (!items && !error) return <LoadingBlock rows={4} />
  if (error || !items) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="BLOCKCHAIN ATTESTATION"
        title="内容存证与验真"
        description="行情分析、政策解读、研究报告等关键内容上链存证 · 任何人可凭存证编号在线验证内容未被篡改"
      />

      <div className="grid-4">
        <StatTile label="已存证内容" value={items.length} unit="条" note="覆盖资讯、报告、行情分析" />
        <StatTile label="累计验真" value={items.reduce((sum, item) => sum + item.verifyCount, 0)} unit="次" note="含第三方验证" tone="up" />
        <StatTile label="存证链" value="农业联盟链" note="多节点共识" />
        <StatTile label="确认状态" value={items.filter((item) => item.status === 'confirmed').length} unit="条" note="全部已确认" tone="warn" />
      </div>

      <section className="surface-card">
        <SectionHeading kicker="VERIFY" title="在线验真" />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Input
            style={{ maxWidth: 380 }}
            value={attestNo}
            placeholder="输入存证编号，例：AT-20260627-0001"
            onChange={(event) => setAttestNo(event.target.value)}
            onPressEnter={() => verify()}
          />
          <Button type="primary" loading={verifying} onClick={() => verify()}>立即验真</Button>
          <span className="small muted">存证编号可在资讯详情页右侧「内容存证」中查看</span>
        </div>

        {result && (
          <div className={`verify-result ${result.valid ? 'ok' : 'bad'}`}>
            <CheckCircleFilled />
            <div>
              <b>{result.message}</b>
              {result.record && (
                <p className="small muted" style={{ marginTop: 6 }}>
                  {result.record.attestNo} · {result.record.title} · 上链时间 {result.record.attestedAt} · 区块高度 {result.record.blockHeight}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="surface-card">
        <SectionHeading kicker="LEDGER" title="存证清单" />
        {items.length === 0 && <EmptyState icon="🔗" title="暂无存证记录" description="内容审核通过后会自动触发存证。" />}
        <div className="stack" style={{ gap: 12 }}>
          {items.map((item) => (
            <article className="attest-row" key={item.id} onClick={() => infoApi.attestation(item.id).then(setDetail).catch((reason: Error) => message.error(reason.message))}>
              <span className="attest-icon"><SafetyCertificateOutlined /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13 }}>{item.title}</b>
                  <Tag className="soft-tag tone-green">{item.contentType === 'report' ? '研究报告' : item.contentType === 'quote' ? '行情数据' : '资讯内容'}</Tag>
                  <Tag className="soft-tag tone-purple">已确认</Tag>
                </div>
                <p className="small muted" style={{ margin: '6px 0' }}>
                  {item.attestNo} · {item.chainName} · 区块 {item.blockHeight} · {item.attestedAt}
                </p>
                <p className="hash-box">{item.contentHash}</p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="small muted">验真 {item.verifyCount} 次</span>
                <Button size="small" onClick={(event) => { event.stopPropagation(); setResult(null); verify(item.attestNo) }}>
                  验真
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={560} title={detail?.attestNo ?? ''}>
        {detail && (
          <div className="stack">
            <b>{detail.title}</b>
            <div className="kv-list">
              <div className="kv"><span>内容类型</span><b>{detail.contentType === 'report' ? '研究报告' : '资讯内容'}</b></div>
              <div className="kv"><span>存证链</span><b>{detail.chainName}</b></div>
              <div className="kv"><span>区块高度</span><b>{detail.blockHeight}</b></div>
              <div className="kv"><span>上链时间</span><b>{detail.attestedAt}</b></div>
              <div className="kv"><span>存证主体</span><b>{detail.owner}</b></div>
              <div className="kv"><span>验真次数</span><b>{detail.verifyCount}</b></div>
            </div>
            <div>
              <p className="small muted">内容哈希（SHA-256）</p>
              <p className="hash-box">{detail.contentHash}</p>
            </div>
            <div>
              <p className="small muted">交易 ID</p>
              <p className="hash-box">{detail.txId}</p>
            </div>

            {(detail.steps ?? []).length > 0 && (
              <>
                <SectionHeading kicker="PROCESS" title="存证流程" />
                <div className="timeline">
                  {(detail.steps ?? []).map((step) => (
                    <div className={`timeline-item${step.done ? ' done' : ''}`} key={step.title}>
                      <span className="todo-dot" />
                      <div>
                        <b>{step.title}</b>
                        <p className="small muted">{step.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
