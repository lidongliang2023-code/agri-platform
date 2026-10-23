import { useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Spin, message } from 'antd'
import {
  AlertOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDispute,
  getDisputeById,
  getDisputeList,
  resolveDispute,
  type DisputeQuery,
  type DisputeVO,
} from '@/api/dispute'
import { getMyMerchants } from '@/api/identity'
import { getOrderList } from '@/api/order'
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared'
import './after-sales.css'

type DisputePageMode = 'list' | 'detail' | 'create' | 'resolve'

const DISPUTE_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待处理', tone: 'amber' },
  processing: { text: '处理中', tone: 'tech' },
  mediating: { text: '调解中', tone: 'tech' },
  arbitrating: { text: '仲裁中', tone: 'red' },
  resolved: { text: '已解决', tone: 'green' },
  closed: { text: '已关闭', tone: 'ghost' },
}

const DISPUTE_STAGE: Record<string, string> = {
  complain: '申请中',
  mediation: '调解中',
  arbitration: '仲裁中',
  resolved: '已了结',
  closed: '已关闭',
}

const DISPUTE_TYPE: Record<string, string> = {
  quality: '质量不符',
  delivery: '交付延误',
  delay: '交付延误',
  quantity: '数量短缺',
  price: '价格争议',
  payment: '货款结算',
  other: '其他',
}

function statusMeta(value: string): { text: string; tone: string } {
  return DISPUTE_STATUS[value] ?? { text: value || '未知', tone: 'ghost' }
}

function StatusTag({ value }: { value: string }): JSX.Element {
  const meta = statusMeta(value)
  return <span className={`mc-tag ${meta.tone}`}>{meta.text}</span>
}

function PartyBadge({ side }: { side: 'buyer' | 'seller' }): JSX.Element {
  return <span className={`after-party-badge ${side}`}>{side === 'buyer' ? '采' : '供'}</span>
}

/** 采购方和供货方共用的售后纠纷工作区。 */
export default function DisputeList(): JSX.Element {
  const queryClient = useQueryClient()
  const [pageMode, setPageMode] = useState<DisputePageMode>('list')
  const [activeDispute, setActiveDispute] = useState<DisputeVO | null>(null)
  const [query, setQuery] = useState<DisputeQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ disputeNo?: string; disputeStatus?: string }>({})
  const [saving, setSaving] = useState(false)
  const [resolveForm] = Form.useForm()
  const [createForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', query],
    queryFn: () => getDisputeList(query),
  })
  const { data: merchantData } = useQuery({ queryKey: ['my-merchants'], queryFn: getMyMerchants })
  const { data: orderData } = useQuery({
    queryKey: ['orders-for-dispute'],
    queryFn: () => getOrderList({ pageNum: 1, pageSize: 100 }),
  })
  const merchants = merchantData?.code === 200 ? merchantData.data ?? [] : []
  const identityError = merchantData && merchantData.code !== 200
    ? merchantData.message ?? '无法解析你的经营主体'
    : ''
  const myOrders = orderData?.code === 200 ? orderData.data?.records ?? [] : []
  const rows: DisputeVO[] = data?.data?.records ?? []
  const total = Number(data?.data?.total ?? 0)
  const currentPage = Number(data?.data?.current ?? query.pageNum ?? 1)
  const pageCount = Math.max(1, Math.ceil(total / Number(query.pageSize ?? 10)))
  const pageSummary = useMemo(() => ({
    open: rows.filter((row) => row.disputeStatus !== 'resolved' && row.disputeStatus !== 'closed').length,
    resolved: rows.filter((row) => row.disputeStatus === 'resolved' || row.disputeStatus === 'closed').length,
    claim: rows.reduce((sum, row) => sum + Number(row.claimAmount ?? 0), 0),
  }), [rows])

  const showList = (): void => {
    setPageMode('list')
    setActiveDispute(null)
  }

  const showDetail = (row: DisputeVO): void => {
    setActiveDispute(row)
    setPageMode('detail')
  }

  const showCreate = (): void => {
    createForm.resetFields()
    if (merchants.length === 1) {
      createForm.setFieldValue('complainantId', merchants[0].merchantId)
    }
    setPageMode('create')
  }

  const showResolve = (row: DisputeVO): void => {
    setActiveDispute(row)
    resolveForm.resetFields()
    setPageMode('resolve')
  }

  const submitCreate = async (): Promise<void> => {
    const values = await createForm.validateFields()
    setSaving(true)
    try {
      const response = await createDispute({
        orderId: values.orderId,
        complainantId: values.complainantId,
        disputeType: values.disputeType,
        disputeReason: values.disputeReason,
        disputeDescription: values.disputeDescription,
        claimAmount: values.claimAmount,
      })
      if (response?.code === 200) {
        message.success('售后工单已发起')
        await queryClient.invalidateQueries({ queryKey: ['disputes'] })
        showList()
      } else {
        message.error(response?.message ?? '发起失败')
      }
    } catch {
      message.error('发起失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  const submitResolve = async (): Promise<void> => {
    if (!activeDispute) return
    const values = await resolveForm.validateFields()
    setSaving(true)
    try {
      const response = await resolveDispute(activeDispute.id, values)
      if (response?.code === 200) {
        message.success('售后工单已了结')
        await queryClient.invalidateQueries({ queryKey: ['disputes'] })
        const refreshed = await getDisputeById(activeDispute.id)
        if (refreshed?.code === 200 && refreshed.data) setActiveDispute(refreshed.data)
        setPageMode('detail')
      } else {
        message.error(response?.message ?? '处理失败')
      }
    } catch {
      message.error('处理失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  if (pageMode === 'create') {
    return (
      <div className="after-workbench dispute-workbench">
        <button type="button" className="after-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回售后工单
        </button>
        <section className="after-hero">
          <span className="after-hero-icon"><PlusOutlined /></span>
          <div><small>AFTER-SALES REQUEST</small><h2>发起售后纠纷</h2><p>仅可对当前主体参与的订单发起，被申请人由订单另一方自动确定。</p></div>
        </section>
        <div className="after-form-layout">
          <Panel title="工单信息">
            <Form form={createForm} layout="vertical" onFinish={() => void submitCreate()} className="after-form">
              {merchants.length > 1 && (
                <Form.Item name="complainantId" label="发起主体" rules={[{ required: true, message: '请选择主体' }]}>
                  <Select options={merchants.map((item) => ({ value: item.merchantId, label: item.merchantName }))} />
                </Form.Item>
              )}
              <Form.Item name="orderId" label="关联订单" rules={[{ required: true, message: '请选择订单' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择当前主体参与的订单"
                  options={myOrders.map((order: {
                    id: number
                    orderNo?: string
                    productName?: string
                    totalAmount?: number
                  }) => ({
                    value: order.id,
                    label: `${order.orderNo ?? order.id} · ${order.productName ?? '订单商品'} · ¥${order.totalAmount ?? '—'}`,
                  }))}
                />
              </Form.Item>
              <div className="after-form-grid">
                <Form.Item name="disputeType" label="纠纷类型" rules={[{ required: true, message: '请选择类型' }]}>
                  <Select options={Object.entries(DISPUTE_TYPE).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
                <Form.Item name="claimAmount" label="索赔金额（元）">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="可选" />
                </Form.Item>
              </div>
              <Form.Item name="disputeReason" label="纠纷事由" rules={[{ required: true, message: '请填写事由' }]}>
                <Input placeholder="例如：到货品质与约定不符" />
              </Form.Item>
              <Form.Item name="disputeDescription" label="详细说明">
                <Input.TextArea rows={5} placeholder="请描述发生经过、已有沟通和期望处理方式" />
              </Form.Item>
              <div className="after-form-actions">
                <button type="submit" className="mc-btn" disabled={saving}>{saving ? '正在提交…' : '提交售后工单'}</button>
                <button type="button" className="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="after-side-stack">
            <Panel title="发起条件">
              <ul className="after-guidance">
                <li><CheckCircleOutlined /> 只能选择当前经营主体参与的订单。</li>
                <li><CheckCircleOutlined /> 同一订单只能存在一条未结纠纷。</li>
                <li><CheckCircleOutlined /> 平台运营负责调解、仲裁和赔付执行。</li>
              </ul>
            </Panel>
            <Panel title="处理时效">
              <div className="after-duration"><strong>48h</strong><span>建议响应时间</span><small>及时响应有助于维护店铺信用和采购方体验。</small></div>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (pageMode === 'resolve' && activeDispute) {
    return (
      <div className="after-workbench dispute-workbench">
        <button type="button" className="after-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回工单详情
        </button>
        <section className="after-hero">
          <span className="after-hero-icon"><SettingOutlined /></span>
          <div><small>DISPUTE RESOLUTION</small><h2>处理售后工单</h2><p>{activeDispute.disputeNo} · {DISPUTE_TYPE[activeDispute.disputeType] ?? activeDispute.disputeType}</p></div>
          <StatusTag value={activeDispute.disputeStatus} />
        </section>
        <div className="after-form-layout">
          <Panel title="双方处理结果">
            <Form form={resolveForm} layout="vertical" onFinish={() => void submitResolve()} className="after-form">
              <Form.Item name="result" label="处理结果" rules={[{ required: true, message: '请选择处理结果' }]}>
                <Select options={[
                  { value: 'agreed', label: '双方达成和解' },
                  { value: 'withdrawn', label: '申请人撤回' },
                ]} />
              </Form.Item>
              <Form.Item name="remark" label="处理说明">
                <Input.TextArea rows={5} placeholder="填写和解方案、补偿方式或撤回原因" />
              </Form.Item>
              <div className="after-form-actions">
                <button type="submit" className="mc-btn" disabled={saving}>{saving ? '正在处理…' : '确认了结'}</button>
                <button type="button" className="mc-btn ghost" onClick={() => setPageMode('detail')}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="after-side-stack">
            <Panel title="处理说明">
              <ul className="after-guidance">
                <li><CheckCircleOutlined /> 这里用于双方自行和解或申请人撤回。</li>
                <li><SafetyCertificateOutlined /> 需要平台介入时，请等待运营调解或仲裁。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (pageMode === 'detail' && activeDispute) {
    return (
      <div className="after-workbench dispute-workbench">
        <button type="button" className="after-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回售后工单
        </button>
        <section className="after-hero">
          <span className="after-hero-icon"><AlertOutlined /></span>
          <div>
            <small>AFTER-SALES CASE · {activeDispute.disputeNo}</small>
            <h2>{DISPUTE_TYPE[activeDispute.disputeType] ?? activeDispute.disputeType}</h2>
            <p>关联订单 {activeDispute.orderId} · 创建于 {shortDate(activeDispute.createTime)}</p>
          </div>
          <StatusTag value={activeDispute.disputeStatus} />
          {activeDispute.disputeStatus !== 'resolved' && activeDispute.disputeStatus !== 'closed' && (
            <button type="button" className="mc-btn" onClick={() => showResolve(activeDispute)}>
              <SettingOutlined /> 处理工单
            </button>
          )}
        </section>
        <div className="after-detail-layout">
          <div className="after-detail-main">
            <Panel title="争议双方">
              <div className="after-party-grid">
                <div><PartyBadge side="buyer" /><span>申请人</span><strong>{activeDispute.complainantName || '—'}</strong><small>主体 ID {String(activeDispute.complainantId ?? '—')}</small></div>
                <div><PartyBadge side="seller" /><span>被申请人</span><strong>{activeDispute.respondentName || '—'}</strong><small>主体 ID {String(activeDispute.respondentId ?? '—')}</small></div>
              </div>
            </Panel>
            <Panel title="售后诉求">
              <div className="after-case-grid">
                <div><span>纠纷类型</span><strong>{DISPUTE_TYPE[activeDispute.disputeType] ?? activeDispute.disputeType}</strong></div>
                <div><span>索赔金额</span><strong className="after-amount">{activeDispute.claimAmount == null ? '—' : money(activeDispute.claimAmount)}</strong></div>
                <div><span>当前阶段</span><strong>{DISPUTE_STAGE[activeDispute.processStage] ?? activeDispute.processStage}</strong></div>
                <div><span>关联订单</span><strong>{activeDispute.orderId}</strong></div>
              </div>
              <div className="after-description">
                <span>售后事由</span><strong>{activeDispute.disputeReason || '—'}</strong>
                <p>{activeDispute.disputeDescription || '暂无详细说明'}</p>
              </div>
            </Panel>
            <Panel title="处理记录">
              <div className="after-result-list">
                <div><span>调解结果</span><p>{activeDispute.mediationResult || '尚未形成调解结果'}</p></div>
                <div><span>仲裁结果</span><p>{activeDispute.arbitrationResult || '尚未进入仲裁'}</p></div>
                <div><span>了结说明</span><p>{activeDispute.closeReason || '工单处理中'}</p></div>
              </div>
            </Panel>
          </div>
          <aside className="after-detail-aside">
            <Panel title="处理进度">
              <div className="after-timeline">
                <div className="on"><span><CheckCircleOutlined /></span><div><strong>工单已提交</strong><small>{shortDate(activeDispute.createTime)}</small></div></div>
                <div className={activeDispute.processStage !== 'complain' ? 'on' : ''}><span><ClockCircleOutlined /></span><div><strong>平台处理中</strong><small>{DISPUTE_STAGE[activeDispute.processStage] ?? '等待响应'}</small></div></div>
                <div className={activeDispute.disputeStatus === 'resolved' || activeDispute.disputeStatus === 'closed' ? 'on' : ''}><span><SafetyCertificateOutlined /></span><div><strong>工单了结</strong><small>{shortDate(activeDispute.closeTime)}</small></div></div>
              </div>
            </Panel>
            <Panel title="处理建议">
              <div className="after-advice">
                <p><FileSearchOutlined /> 核对订单、商品交付记录和双方沟通证据。</p>
                <p><CheckCircleOutlined /> 优先与对方协商和解，处理结果会写入交易留痕。</p>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="after-workbench dispute-workbench">
      {identityError && <div className="after-alert"><AlertOutlined />{identityError}</div>}
      {!identityError && merchantData && merchants.length === 0 && (
        <div className="after-alert"><AlertOutlined />当前账号尚未绑定经营主体，无法查询售后工单。</div>
      )}
      <section className="after-overview">
        <div className="after-overview-title">
          <span className="after-overview-icon"><AlertOutlined /></span>
          <div><small>AFTER-SALES CASES</small><h2>纠纷管理</h2><p>集中处理质量问题、交付延误、数量短缺与货款争议。</p></div>
        </div>
        <div className="after-overview-actions">
          <button type="button" className="mc-btn" onClick={showCreate}><PlusOutlined /> 发起售后</button>
        </div>
        <div className="after-overview-stats">
          <div><span>本页待处理</span><strong>{pageSummary.open}</strong></div>
          <div><span>本页已了结</span><strong>{pageSummary.resolved}</strong></div>
          <div><span>本页索赔金额</span><strong>{money(pageSummary.claim)}</strong></div>
        </div>
      </section>

      <Panel title="售后工单" extra={<span className="after-count">共 {total} 条</span>}>
        <div className="after-toolbar">
          <Input
            prefix={<SearchOutlined />}
            allowClear
            placeholder="输入纠纷编号"
            value={draft.disputeNo}
            onChange={(event) => setDraft((previous) => ({
              ...previous,
              disputeNo: event.target.value || undefined,
            }))}
          />
          <Select
            allowClear
            placeholder="全部状态"
            value={draft.disputeStatus}
            onChange={(value) => setDraft((previous) => ({ ...previous, disputeStatus: value }))}
            options={Object.entries(DISPUTE_STATUS).map(([value, item]) => ({ value, label: item.text }))}
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
          <div className="after-loading"><Spin /><span>正在读取售后工单…</span></div>
        ) : rows.length === 0 ? (
          <EmptyState title="暂无售后工单" desc="采购方发起售后后会显示在这里。" />
        ) : (
          <>
            <div className="mc-table-wrap">
              <table className="mc-table after-table">
                <thead><tr><th>工单 / 类型</th><th>关联订单</th><th>争议双方</th><th>诉求</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button type="button" className="after-name-link" onClick={() => showDetail(row)}>
                          <strong>{DISPUTE_TYPE[row.disputeType] ?? row.disputeType}</strong>
                          <span className="mc-mono">{row.disputeNo}</span>
                        </button>
                      </td>
                      <td className="mc-mono">{row.orderId}</td>
                      <td>
                        <div className="after-parties-cell">
                          <div><PartyBadge side="buyer" />{row.complainantName || '—'}</div>
                          <div><PartyBadge side="seller" />{row.respondentName || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <div className="after-claim-cell">
                          <span>{row.claimAmount == null ? '未填写索赔金额' : money(row.claimAmount)}</span>
                          <small>{row.disputeReason || row.disputeDescription || '—'}</small>
                        </div>
                      </td>
                      <td><StatusTag value={row.disputeStatus} /><small className="after-stage">{DISPUTE_STAGE[row.processStage] ?? row.processStage}</small></td>
                      <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                      <td>
                        <div className="mc-actions">
                          <button type="button" className="mc-link after-action" onClick={() => showDetail(row)}><EyeOutlined /> 查看</button>
                          {row.disputeStatus !== 'resolved' && row.disputeStatus !== 'closed' && (
                            <button type="button" className="mc-link after-action" onClick={() => showResolve(row)}><SettingOutlined /> 处理</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mc-pager">
              <button type="button" disabled={currentPage <= 1}
                onClick={() => setQuery((previous) => ({ ...previous, pageNum: currentPage - 1 }))}>上一页</button>
              <span>第 {currentPage} / {pageCount} 页 · 共 {total} 条</span>
              <button type="button" disabled={currentPage >= pageCount}
                onClick={() => setQuery((previous) => ({ ...previous, pageNum: currentPage + 1 }))}>下一页</button>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
