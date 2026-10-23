import { useEffect, useState } from 'react'
import { Form, Input, Select, Spin, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  appealEvaluation,
  getEvaluationList,
  replyEvaluation,
  type EvaluationQuery,
  type EvaluationVO,
} from '@/api/evaluation'
import { getMyMerchants } from '@/api/identity'
import { EmptyState, Panel, shortDate } from '../../member-center/shared'
import './evaluation.css'

type EvaluationMode = 'list' | 'reply' | 'appeal'

function Stars({ value }: { value: number }): JSX.Element {
  return <span className="credit-stars" aria-label={`${value}星`}>{'★'.repeat(Math.round(value))}<i>{'☆'.repeat(Math.max(0, 5 - Math.round(value)))}</i></span>
}

/** 卖家信用评价管理与回复、申诉工作区。 */
export default function EvaluationList(): JSX.Element {
  const [mode, setMode] = useState<EvaluationMode>('list')
  const [active, setActive] = useState<EvaluationVO | null>(null)
  const [query, setQuery] = useState<EvaluationQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ evaluationNo?: string; ratingOverall?: number }>({})
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [replyForm] = Form.useForm()
  const [appealForm] = Form.useForm()

  useEffect(() => {
    getMyMerchants()
      .then((response) => {
        if (response?.code === 200) {
          setMyMerchantIds((response.data ?? []).map((item) => String(item.merchantId)))
        }
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['evaluations', query],
    queryFn: () => getEvaluationList(query),
  })
  const rows: EvaluationVO[] = data?.data?.records ?? []
  const total = Number(data?.data?.total ?? 0)
  const currentPage = Number(data?.data?.current ?? query.pageNum ?? 1)
  const pageCount = Math.max(1, Math.ceil(total / Number(query.pageSize ?? 10)))
  const canReply = (row: EvaluationVO): boolean =>
    row.evaluateeId != null
    && myMerchantIds.includes(String(row.evaluateeId))
    && !row.replyContent
  const canAppeal = (row: EvaluationVO): boolean =>
    row.evaluateeId != null && myMerchantIds.includes(String(row.evaluateeId))

  const showList = (): void => {
    setMode('list')
    setActive(null)
  }

  const openReply = (row: EvaluationVO): void => {
    setActive(row)
    replyForm.resetFields()
    setMode('reply')
  }

  const openAppeal = (row: EvaluationVO): void => {
    setActive(row)
    appealForm.resetFields()
    setMode('appeal')
  }

  const submitReply = async (): Promise<void> => {
    if (!active) return
    const values = await replyForm.validateFields()
    setSubmitting(true)
    try {
      const response = await replyEvaluation(active.id, values.content)
      if (response?.code === 200) {
        message.success('评价回复已公开')
        await refetch()
        showList()
      } else {
        message.error(response?.message ?? '回复失败')
      }
    } catch {
      message.error('回复失败（请检查后端是否在运行）')
    } finally {
      setSubmitting(false)
    }
  }

  const submitAppeal = async (): Promise<void> => {
    if (!active) return
    const values = await appealForm.validateFields()
    setSubmitting(true)
    try {
      const response = await appealEvaluation(active.id, values)
      if (response?.code === 200) {
        message.success('评价申诉已提交，等待运营审核')
        showList()
      } else {
        message.error(response?.message ?? '申诉失败')
      }
    } catch {
      message.error('申诉失败（请检查后端是否在运行）')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'reply' && active) {
    return (
      <div className="credit-workbench credit-action-page">
        <button type="button" className="credit-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回信用评价
        </button>
        <section className="credit-action-hero">
          <span className="credit-action-icon"><MessageOutlined /></span>
          <div><small>PUBLIC REPLY</small><h2>回复买家评价</h2><p>{active.evaluationNo} · 订单 {active.orderId}</p></div>
          <Stars value={active.ratingOverall} />
        </section>
        <div className="credit-action-layout">
          <Panel title="公开回复">
            <Form form={replyForm} layout="vertical" onFinish={() => void submitReply()} className="credit-form">
              <div className="credit-evaluation-quote">
                <div><strong>{active.evaluatorName || '采购方'}</strong><Stars value={active.ratingOverall} /></div>
                <p>{active.evaluationContent || '未填写文字评价'}</p>
              </div>
              <Form.Item name="content" label="回复内容" rules={[{ required: true, message: '请填写回复内容' }]}>
                <Input.TextArea rows={6} placeholder="回应采购方反馈，例如说明品质、物流或后续改进措施" showCount maxLength={500} />
              </Form.Item>
              <div className="credit-action-buttons">
                <button type="submit" className="mc-btn" disabled={submitting}>{submitting ? '正在提交…' : '发布回复'}</button>
                <button type="button" className="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="credit-action-aside">
            <Panel title="回复说明">
              <ul className="credit-guidance">
                <li><CheckCircleOutlined /> 回复会以当前卖家主体名义公开展示。</li>
                <li><CheckCircleOutlined /> 每条评价只允许回复一次，请确认后再提交。</li>
                <li><SafetyCertificateOutlined /> 回复会与评价一起保留交易留痕。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (mode === 'appeal' && active) {
    return (
      <div className="credit-workbench credit-action-page">
        <button type="button" className="credit-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回信用评价
        </button>
        <section className="credit-action-hero appeal">
          <span className="credit-action-icon"><WarningOutlined /></span>
          <div><small>EVALUATION APPEAL</small><h2>发起评价申诉</h2><p>{active.evaluationNo} · 订单 {active.orderId}</p></div>
          <Stars value={active.ratingOverall} />
        </section>
        <div className="credit-action-layout">
          <Panel title="申诉信息">
            <Form form={appealForm} layout="vertical" onFinish={() => void submitAppeal()} className="credit-form">
              <div className="credit-evaluation-quote">
                <div><strong>{active.evaluatorName || '采购方'}</strong><Stars value={active.ratingOverall} /></div>
                <p>{active.evaluationContent || '未填写文字评价'}</p>
              </div>
              <Form.Item name="appealType" label="申诉类型" rules={[{ required: true, message: '请选择申诉类型' }]}>
                <Select options={[
                  { value: 'false_content', label: '评价内容不实' },
                  { value: 'not_my_order', label: '评价不属于本订单' },
                  { value: 'malicious', label: '恶意差评' },
                  { value: 'other', label: '其他情况' },
                ]} />
              </Form.Item>
              <Form.Item name="appealReason" label="申诉理由" rules={[{ required: true, message: '请填写申诉理由' }]}>
                <Input.TextArea rows={5} placeholder="请说明评价内容与真实交易情况不符的具体原因" showCount maxLength={500} />
              </Form.Item>
              <Form.Item name="appealEvidence" label="证据说明">
                <Input.TextArea rows={3} placeholder="可填写聊天记录、质检报告编号、物流凭证等" />
              </Form.Item>
              <div className="credit-action-buttons">
                <button type="submit" className="mc-btn" disabled={submitting}>{submitting ? '正在提交…' : '提交申诉'}</button>
                <button type="button" className="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="credit-action-aside">
            <Panel title="申诉须知">
              <ul className="credit-guidance">
                <li><WarningOutlined /> 只有被评价的卖家主体可以发起申诉。</li>
                <li><FileTextOutlined /> 运营审核通过后评价会被隐藏。</li>
                <li><SafetyCertificateOutlined /> 请提供客观证据，申诉过程会完整留痕。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="credit-workbench">
      <div className="credit-list-head">
        <div><strong>信用评价明细</strong><span>查看买家评价，进行公开回复或对异常评价发起申诉</span></div>
        <span className="mc-tag ghost">共 {total} 条</span>
      </div>
      <div className="credit-toolbar">
        <Input
          prefix={<SearchOutlined />}
          allowClear
          placeholder="输入评价编号"
          value={draft.evaluationNo}
          onChange={(event) => setDraft((previous) => ({
            ...previous,
            evaluationNo: event.target.value || undefined,
          }))}
        />
        <Select
          allowClear
          placeholder="综合评分"
          value={draft.ratingOverall}
          onChange={(value) => setDraft((previous) => ({ ...previous, ratingOverall: value }))}
          options={[5, 4, 3, 2, 1].map((value) => ({ value, label: `${value} 星` }))}
        />
        <button type="button" className="mc-btn" onClick={() => setQuery((previous) => ({
          ...previous,
          pageNum: 1,
          ...draft,
        }))}>搜索</button>
        <button type="button" className="mc-btn ghost" onClick={() => {
          setDraft({})
          setQuery({ pageNum: 1, pageSize: 10 })
        }}>重置</button>
      </div>

      {isLoading ? (
        <div className="credit-loading"><Spin /><span>正在读取评价记录…</span></div>
      ) : rows.length === 0 ? (
        <EmptyState title="没有符合条件的评价" desc="订单完成后采购方提交的评价会显示在这里。" />
      ) : (
        <div className="credit-evaluation-list">
          {rows.map((row) => (
            <div className="credit-evaluation-card" key={row.id}>
              <div className="credit-evaluation-main">
                <span className="credit-evaluation-avatar">{row.evaluatorName?.slice(0, 1) || '客'}</span>
                <div>
                  <div className="credit-evaluation-meta">
                    <strong>{row.evaluatorName || '采购方'}</strong>
                    <Stars value={row.ratingOverall} />
                    <span className={`mc-tag ${row.evaluationStatus === 'hidden' ? 'ghost' : 'green'}`}>
                      {row.evaluationStatus === 'hidden' ? '已隐藏' : '展示中'}
                    </span>
                    <span className="mc-tag ghost">{row.isAnonymous === 1 ? '匿名' : '实名'}</span>
                  </div>
                  <p>{row.evaluationContent || '未填写文字评价'}</p>
                  {row.replyContent && <div className="credit-existing-reply"><MessageOutlined /> 我方回复：{row.replyContent}</div>}
                  <small>{row.evaluationNo} · 订单 {row.orderId} · {shortDate(row.createTime)}</small>
                </div>
              </div>
              <div className="credit-evaluation-actions">
                {canReply(row) && (
                  <button type="button" className="mc-btn" onClick={() => openReply(row)}>
                    <MessageOutlined /> 回复评价
                  </button>
                )}
                {canAppeal(row) && (
                  <button type="button" className="mc-btn ghost" onClick={() => openAppeal(row)}>
                    <WarningOutlined /> 发起申诉
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="mc-pager">
          <button type="button" disabled={currentPage <= 1}
            onClick={() => setQuery((previous) => ({ ...previous, pageNum: currentPage - 1 }))}>上一页</button>
          <span>第 {currentPage} / {pageCount} 页 · 共 {total} 条</span>
          <button type="button" disabled={currentPage >= pageCount}
            onClick={() => setQuery((previous) => ({ ...previous, pageNum: currentPage + 1 }))}>下一页</button>
        </div>
      )}
    </div>
  )
}
