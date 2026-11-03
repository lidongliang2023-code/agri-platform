import { useEffect, useState } from 'react'
import { ArrowLeftOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons'
import { Button, Input, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { SupplyDemandDetail } from '../types'
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, SectionHeading } from '../components/ui'

/**
 * 供需详情：左侧信息主体 + 右侧价格参照与撮合建议，底部为站内沟通。
 * 沟通消息按供需单维度存储，direction=in/out 区分对方与我方。
 */
export function SupplyDemandDetailPage(): JSX.Element {
  const { id, query, navigate } = useApp()
  // 供应与需求 id 各自自增、可能撞号，列表跳转时带了 type 就必须透传，
  // 否则会先按供应查、查不到再退到需求，打开的是另一条信息。
  const sdType = query.get('type') || undefined
  const [data, setData] = useState<SupplyDemandDetail | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const load = (): void => {
    if (!id) { setError('缺少供需编号'); return }
    setError('')
    infoApi.supplyDemand(id, sdType)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [id])

  const send = (): void => {
    if (!id || !draft.trim()) return
    setSending(true)
    infoApi.sendSdMessage(id, { content: draft.trim() }, data?.sdType)
      .then((result) => {
        setDraft('')
        setData((previous) => (previous ? { ...previous, messages: result.messages } : previous))
        message.success(result.message)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSending(false))
  }

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SUPPLY & DEMAND · DETAIL"
        title={data.title}
        description={`${data.sdNo} · ${data.orgName} · 发布 ${data.createdAt} · 浏览 ${data.viewCount} · 沟通 ${data.chatCount}`}
        actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate('sd')}>返回大厅</Button>}
      />

      <div className="grid-main-aside">
        <div className="stack">
          <section className="surface-card">
            <div className="row" style={{ gap: 8, marginBottom: 12 }}>
              <span className={`soft-tag ${data.sdType === 'supply' ? 'tone-green' : 'tone-blue'}`}>
                {data.sdType === 'supply' ? '供应' : '需求'}
              </span>
              {data.verified && <span className="soft-tag tone-green">✓ 已认证</span>}
              {data.badge && data.badge !== '—' && <span className="soft-tag tone-amber">{data.badge}</span>}
              <span className="soft-tag">{statusLabel(data.status)}</span>
            </div>

            <div className="price-block">
              <span className="sd-price">
                {Number(data.price).toFixed(2)}<small>{data.priceUnit}</small>
              </span>
              <span className="small muted">{data.marketRef}</span>
            </div>

            <div className="kv-list" style={{ marginTop: 14 }}>
              <div className="kv"><span>品类 / 品种</span><b>{data.category} · {data.variety}</b></div>
              <div className="kv"><span>规格</span><b>{data.spec || '—'}</b></div>
              <div className="kv"><span>{data.sdType === 'supply' ? '可供数量' : '求购数量'}</span><b>{data.quantity}</b></div>
              <div className="kv"><span>产地 / 交货地</span><b>{data.origin}</b></div>
              <div className="kv"><span>上市时间</span><b>{data.availableDate}</b></div>
              <div className="kv"><span>有效期</span><b>{data.durationDays} 天（至 {data.expireDate}）</b></div>
              <div className="kv">
                <span>联系人</span>
                <b>
                  {data.contactName}
                  {data.contactPhone
                    ? ` · ${data.contactPhone}`
                    : '（未公开电话，请通过站内沟通联系）'}
                </b>
              </div>
              <div className="kv"><span>主体类型</span><b>{data.orgType}</b></div>
            </div>

            {data.auditNote && (
              <p className="source-note" style={{ marginTop: 12 }}>审核意见：{data.auditNote}</p>
            )}

            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <Button type="primary" icon={<MessageOutlined />} onClick={() => {
                const input = document.querySelector<HTMLTextAreaElement>('.chat-window textarea')
                input?.focus()
              }}>
                立即沟通
              </Button>
              <Button
                icon={<PhoneOutlined />}
                disabled={!data.contactPhone}
                title={data.contactPhone ? undefined : '发布者未公开电话，请使用站内沟通'}
                onClick={() => message.info(`联系方式：${data.contactName} ${data.contactPhone}`)}
              >
                {data.contactPhone ? '查看联系方式' : '未公开电话'}
              </Button>
              <Button onClick={() => navigate('sd-match')}>查看全部撮合建议</Button>
            </div>
          </section>

          <section className="surface-card">
            <SectionHeading kicker="COMMUNICATION" title="站内沟通记录" />
            <div className="chat-window">
              {data.messages.length === 0 && <p className="muted small">还没有沟通记录，发送第一条消息开始洽谈。</p>}
              {data.messages.map((item) => (
                <div className={`chat-item ${item.direction === 'out' ? 'out' : 'in'}`} key={item.id}>
                  <span className="chat-avatar">{item.fromName.slice(0, 1)}</span>
                  <div className="chat-content">
                    <div className="chat-meta"><b>{item.fromName}</b><span>{item.createdAt}</span></div>
                    <div className="chat-msg">{item.content}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <Input.TextArea
                rows={2}
                maxLength={200}
                showCount
                value={draft}
                placeholder="输入沟通内容，平台会同步通知对方（勿在消息中留银行卡等敏感信息）"
                onChange={(event) => setDraft(event.target.value)}
                onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); send() } }}
              />
              <Button type="primary" loading={sending} onClick={send}>发送</Button>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="surface-card">
            <SectionHeading kicker="PRICE REFERENCE" title="平台价格参照" />
            {data.priceRef.available ? (
              <>
                <div className="price-block">
                  <span className="price-value">
                    {Number(data.priceRef.price).toFixed(2)}<small>{data.priceRef.priceUnit}</small>
                  </span>
                  <ChangePct value={data.priceRef.changePct ?? 0} />
                </div>
                <div className="kv-list" style={{ marginTop: 10 }}>
                  <div className="kv"><span>参照品种</span><b>{data.priceRef.variety}</b></div>
                  <div className="kv"><span>参照产地</span><b>{data.priceRef.origin}</b></div>
                </div>
              </>
            ) : (
              <p className="muted small">该品种暂无平台监测价，建议参考周边产地报价议价。</p>
            )}
            <p className="source-note" style={{ marginTop: 10 }}>{data.priceRef.note}</p>
          </section>

          <section className="surface-card">
            <SectionHeading kicker="AI MATCHING" title={`撮合建议（${data.matches.length}）`} />
            {data.matches.length === 0 && <p className="muted small">暂未匹配到合适对手方，可放宽规格或延长有效期。</p>}
            <div className="stack" style={{ gap: 10 }}>
              {data.matches.map((match) => (
                <div className="match-card" key={match.id}>
                  <div className="row between">
                    <b style={{ fontSize: 13 }}>{match.targetTitle}</b>
                    <span className="soft-tag tone-purple">✦ {match.score}%</span>
                  </div>
                  <p className="small muted" style={{ margin: '6px 0 4px' }}>
                    {match.targetOrg} · {match.targetRegion} · 运距 {match.distanceKm} 公里 · 价差 {match.priceGap}
                  </p>
                  <p className="small">{match.reason}</p>
                </div>
              ))}
            </div>
            {data.matches.length > 0 && (
              <Button block style={{ marginTop: 12 }} onClick={() => navigate('sd-match')}>进入智能撮合工作台</Button>
            )}
          </section>

          <section className="surface-card">
            <SectionHeading kicker="SAFETY" title="交易安全提示" />
            <ul className="safety-list">
              <li>平台仅提供信息撮合，不介入资金结算，请勿提前支付定金至个人账户。</li>
              <li>建议先小批量试单，验货合格后再签正式合同。</li>
              <li>保留沟通记录与物流单据，出现纠纷可提交平台协助调解。</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function statusLabel(status: string): string {
  return ({ online: '在线', pending: '待审核', offline: '已下架', rejected: '未通过' } as Record<string, string>)[status] ?? status
}
