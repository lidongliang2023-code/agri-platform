import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Form, Input, Modal, Select, message } from 'antd'
import {
  AlertOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HeartOutlined,
  HomeOutlined,
  ShoppingCartOutlined,
  StarOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { updateOrderStatus } from '@/api/order'
import { applyInvoice, getMyInvoices, type InvoiceRow } from '@/api/invoice'
import { MemberCenterShell, type MemberNavItem } from './MemberCenterShell'
import {
  EmptyState,
  Panel,
  StatusTag,
  money,
  shortDate,
  useDemands,
  useDisputes,
  useEvaluations,
  useGuarantees,
  useMemberBase,
  useMyInquiryRows,
  useOrders,
  type OrderRow,
} from './shared'

const NAV: MemberNavItem[] = [
  { key: 'overview', label: '首页概览', icon: <HomeOutlined /> },
  { key: 'purchase', label: '采购订单', icon: <ShoppingCartOutlined /> },
  { key: 'inquiry', label: '我的询价', icon: <FileSearchOutlined /> },
  { key: 'after', label: '收货与售后', icon: <TruckOutlined /> },
  { key: 'rate', label: '采购评价', icon: <StarOutlined /> },
  { key: 'fund', label: '资金与发票', icon: <DollarOutlined /> },
  { key: 'favorite', label: '收藏与关注', icon: <HeartOutlined /> },
  { key: 'profile', label: '企业资料与认证', icon: <UserOutlined /> },
]

const BUYER_STATUS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '待收货' },
  { value: 'completed', label: '已完成' },
]

function Kpi({ label, value, unit, desc, tone = '' }: {
  label: string
  value: string | number
  unit?: string
  desc?: string
  tone?: string
}): JSX.Element {
  return (
    <div className={`mc-stat ${tone}`}>
      <div className="mc-stat-k">{label}</div>
      <div className="mc-stat-v">{value}<small>{unit}</small></div>
      {desc && <div className="mc-stat-d">{desc}</div>}
    </div>
  )
}

export default function BuyerCenter(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') || 'overview'
  const setActive = (key: string): void => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    setParams(next, { replace: true })
  }

  const base = useMemberBase()
  // 同一账号可能同时绑定多个主体：买家中心优先用 buyer 角色的主体展示与筛选需求。
  const buyerMerchant = base.merchants.find((item) => item.roleInMerchant === 'buyer') ?? base.primary
  const buyerId = buyerMerchant ? Number(buyerMerchant.merchantId) : null
  const allOrders = useOrders('buyer', '', 1, 100)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const pagedOrders = useOrders('buyer', status, page, 10)
  const demands = useDemands(buyerId)
  const inquiries = useMyInquiryRows()
  const disputes = useDisputes()
  const evaluations = useEvaluations({ evaluatorId: buyerId ?? undefined })
  const guarantees = useGuarantees()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false)
  const [invoiceForm] = Form.useForm<{ orderId: number; invoiceType: string; title: string; taxNo?: string; remark?: string }>()

  const loadInvoices = useCallback(() => {
    getMyInvoices()
      .then((body) => {
        if (body?.code === 200) setInvoices(Array.isArray(body.data) ? body.data : [])
      })
      .catch(() => { /* 页面显示未接入/重试提示 */ })
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  useEffect(() => {
    setPage(1)
  }, [status])

  const orderStats = useMemo(() => {
    const rows = allOrders.rows
    const evaluated = new Set(evaluations.rows.map((item) => item.orderId))
    return {
      pendingPay: rows.filter((item) => item.orderStatus === 'pending' || item.orderStatus === 'pending_confirm').length,
      pendingShip: rows.filter((item) => item.orderStatus === 'paid').length,
      pendingReceive: rows.filter((item) => item.orderStatus === 'shipped').length,
      pendingRate: rows.filter((item) => item.orderStatus === 'completed' && !evaluated.has(item.id)).length,
    }
  }, [allOrders.rows, evaluations.rows])

  const guaranteeTotal = guarantees.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0)
  const guaranteeAvailable = guarantees.reduce((sum, item) => sum + Number(item.availableAmount ?? 0), 0)
  const guaranteeFrozen = guarantees.reduce((sum, item) => sum + Number(item.frozenAmount ?? 0), 0)

  const myDisputes = disputes.rows.filter((item) => base.merchantIds.includes(Number(item.complainantId)))
  const evaluatedOrderIds = new Set(evaluations.rows.map((item) => item.orderId))
  const pendingEvaluations = allOrders.rows.filter((item) => item.orderStatus === 'completed' && !evaluatedOrderIds.has(item.id))
  const invoicedOrderIds = new Set(invoices.map((item) => item.orderId))
  const eligibleInvoiceOrders = allOrders.rows.filter((item) =>
    ['paid', 'shipped', 'received', 'completed'].includes(item.orderStatus) && !invoicedOrderIds.has(item.id))

  const openInvoice = (): void => {
    setInvoiceOpen(true)
  }

  const submitInvoice = async (): Promise<void> => {
    try {
      const values = await invoiceForm.validateFields()
      setInvoiceSubmitting(true)
      const body = await applyInvoice(values)
      if (body?.code === 200) {
        message.success('开票申请已提交')
        setInvoiceOpen(false)
        loadInvoices()
      } else {
        message.error(body?.message ?? '提交开票申请失败')
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error('提交开票申请失败（请检查后端是否在运行）')
    } finally {
      setInvoiceSubmitting(false)
    }
  }

  const confirmReceive = (order: OrderRow): void => {
    Modal.confirm({
      title: '确认已收到货物？',
      content: `订单 ${order.orderNo} · ${order.productName}。确认后订单将进入已完成状态。`,
      okText: '确认收货',
      cancelText: '取消',
      onOk: async () => {
        try {
          const body = await updateOrderStatus(order.id, 'received')
          if (body?.code === 200) {
            message.success('已确认收货')
            allOrders.reload()
            pagedOrders.reload()
          } else {
            message.error(body?.message ?? '确认收货失败')
          }
        } catch {
          message.error('确认收货失败（请检查后端是否在运行）')
        }
      },
    })
  }

  const orderActions = (order: OrderRow): JSX.Element => (
    <div className="mc-actions">
      <a className="mc-link" href={`/order/detail/${order.id}`}>查看详情</a>
      {order.orderStatus === 'shipped' && (
        <button type="button" className="mc-link" onClick={() => confirmReceive(order)}>确认收货</button>
      )}
      {order.orderStatus === 'completed' && !evaluatedOrderIds.has(order.id) && (
        <a className="mc-link" href="/evaluation">去评价</a>
      )}
    </div>
  )

  const renderOverview = (): JSX.Element => (
    <>
      <div className="mc-grid mc-grid-4">
        <Kpi label="待付款订单" value={orderStats.pendingPay} unit="笔" desc="待支付的采购订单" />
        <Kpi label="待发货" value={orderStats.pendingShip} unit="笔" desc="供应方备货中" />
        <Kpi label="待收货" value={orderStats.pendingReceive} unit="笔" desc="运输中或已到货" tone="tech" />
        <Kpi label="待评价" value={orderStats.pendingRate} unit="笔" desc="已完成且尚未评价" />
      </div>

      <Panel
        title="资金账户概览"
        extra={<><a className="mc-btn ghost" href="/my-guarantee">保证金账户</a><a className="mc-btn" href="/demand/create">发起采购</a></>}
      >
        <div className="mc-grid mc-grid-4">
          <Kpi label="累计采购额" value={money(base.dashboard?.buyer?.totalSpent ?? 0)} desc="不含已取消订单" />
          <Kpi label="今日采购额" value={money(base.dashboard?.buyer?.todaySpent ?? 0)} desc="按支付口径统计" tone="tech" />
          <Kpi label="可用保证金" value={money(guaranteeAvailable)} desc={`保证金总额 ${money(guaranteeTotal)}`} />
          <Kpi label="冻结保证金" value={money(guaranteeFrozen)} desc="在途订单占用" tone="amber" />
        </div>
      </Panel>

      <Panel title="最近采购订单" extra={<button type="button" className="mc-link" onClick={() => setActive('purchase')}>查看全部订单 →</button>}>
        {renderOrdersTable(allOrders.rows.slice(0, 5), allOrders.loading, allOrders.error, orderActions)}
      </Panel>

      <div className="mc-section-title">快捷入口</div>
      <div className="mc-grid mc-grid-4">
        {[
          { icon: <FileTextOutlined />, title: '发布采购需求', desc: '发布需求，平台智能匹配供应方', href: '/demand/create' },
          { icon: <FileSearchOutlined />, title: '我的询价', desc: '查看报价进展与在线议价', tab: 'inquiry' },
          { icon: <TruckOutlined />, title: '收货与售后', desc: '确认收货 / 退货换货 / 质量申诉', tab: 'after' },
          { icon: <DollarOutlined />, title: '保证金账户', desc: '查看冻结、可用与流水明细', href: '/my-guarantee' },
        ].map((item) => (
          <a
            className="mc-quick"
            key={item.title}
            href={item.href ?? '#'}
            onClick={(event) => {
              if (item.tab) {
                event.preventDefault()
                setActive(item.tab)
              }
            }}
          >
            <span className="mc-quick-icon">{item.icon}</span>
            <strong>{item.title}</strong>
            <small>{item.desc}</small>
          </a>
        ))}
      </div>
    </>
  )

  const renderPurchase = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-label">状态</span>
        <div className="mc-chips">
          {BUYER_STATUS.map((item) => (
            <button type="button" key={item.value} className={status === item.value ? 'on' : ''}
              onClick={() => setStatus(item.value)}>{item.label}</button>
          ))}
        </div>
        <span className="mc-spacer" />
        <a className="mc-btn ghost" href="/demand/create">发起新采购</a>
      </div>
      <Panel>
        {renderOrdersTable(pagedOrders.rows, pagedOrders.loading, pagedOrders.error, orderActions)}
        <div className="mc-pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>第 {page} / {Math.max(1, Math.ceil(pagedOrders.total / 10))} 页 · 共 {pagedOrders.total} 笔</span>
          <button type="button" disabled={page >= Math.ceil(pagedOrders.total / 10)} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      </Panel>
    </>
  )

  const renderInquiry = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">我发布的采购需求 · 供应方报价进展</span>
        <span className="mc-spacer" />
        <a className="mc-btn" href="/demand/create">发布新采购需求</a>
      </div>
      <Panel title="采购需求">
        {demands.rows.length === 0 ? (
          <EmptyState title="还没有采购需求" desc="发布需求后，供应方的报价会汇总到这里。"
            action={<a className="mc-btn" href="/demand/create">发布采购需求</a>} />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>需求编号</th><th>品类 / 品种</th><th>采购量</th><th>期望价</th><th>报价数</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
              <tbody>
                {demands.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.demandNo}</td>
                    <td>{row.categoryName ?? '—'} / {row.variety ?? '—'}</td>
                    <td className="mc-mono">{row.quantity ?? '—'}</td>
                    <td className="mc-mono">{row.priceMin != null || row.priceMax != null
                      ? `${row.priceMin ?? '—'} ~ ${row.priceMax ?? '—'}` : '—'}</td>
                    <td className="mc-mono">{row.responseCount ?? 0}</td>
                    <td><span className="mc-tag tech">{demandStatusText(row.demandStatus)}</span></td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                    <td><a className="mc-link" href={`/demand/detail/${row.id}`}>查看</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="货源询价进展">
        {inquiries.rows.length === 0 ? (
          <EmptyState title="还没有询价单" desc="在交易大厅对货源发起询价后，会在这里跟踪报价与议价进展。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>询价单号</th><th>商品</th><th>供应方</th><th>数量</th><th>报价数</th><th>截止时间</th><th>状态</th></tr></thead>
              <tbody>
                {inquiries.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.inquiryNo}</td>
                    <td>{row.productName}</td>
                    <td>{row.sellerName}</td>
                    <td className="mc-mono">{row.quantity} {row.unit}</td>
                    <td className="mc-mono">{row.replyCount ?? 0}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.replyDeadline)}</td>
                    <td><span className="mc-tag tech">{row.inquiryStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderAfter = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">售后申请 · 退换货 · 质量申诉 · 平台仲裁</span>
        <span className="mc-spacer" />
        <a className="mc-btn ghost" href="/dispute">发起 / 查看售后工单</a>
      </div>
      <Panel title="售后与争议工单">
        {myDisputes.length === 0 ? (
          <EmptyState title="没有进行中的售后工单" desc="从订单详情或纠纷管理发起售后，工单会在这里汇总。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>工单号</th><th>关联订单</th><th>类型</th><th>问题描述</th><th>状态</th><th>提交时间</th></tr></thead>
              <tbody>
                {myDisputes.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.disputeNo}</td>
                    <td className="mc-mono">{row.orderId}</td>
                    <td>{row.disputeType ?? '—'}</td>
                    <td className="mc-wrap-text">{row.disputeDescription ?? row.disputeReason ?? '—'}</td>
                    <td><span className="mc-tag amber">{row.disputeStatus ?? '处理中'}</span></td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderRate = (): JSX.Element => (
    <>
      <div className="mc-toolbar">
        <span className="mc-toolbar-muted">采购评价 · 供应方评分</span>
        <span className="mc-spacer" />
        <span className="mc-tag amber">待评价 {pendingEvaluations.length} 笔</span>
      </div>
      <Panel title="待评价订单">
        {pendingEvaluations.length === 0 ? (
          <EmptyState title="没有待评价订单" desc="订单完成后可以评价供应方，评价会公开展示。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>订单号</th><th>商品</th><th>供应方</th><th>金额</th><th>完成时间</th><th>操作</th></tr></thead>
              <tbody>
                {pendingEvaluations.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.orderNo}</td>
                    <td>{row.productName}</td>
                    <td>{row.sellerName}</td>
                    <td className="mc-price">{money(row.totalAmount)}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                    <td><a className="mc-link" href="/evaluation">去评价</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="我发出的评价">
        {evaluations.rows.length === 0 ? (
          <EmptyState title="还没有评价记录" desc="完成订单后可对供应方进行评价。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>订单</th><th>被评价方</th><th>综合评分</th><th>评价内容</th><th>时间</th></tr></thead>
              <tbody>
                {evaluations.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.orderId}</td>
                    <td>{row.evaluateeName}</td>
                    <td><span className="mc-stars">{'★'.repeat(Math.round(row.ratingOverall))}</span> {row.ratingOverall}</td>
                    <td className="mc-wrap-text">{row.evaluationContent ?? '—'}</td>
                    <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )

  const renderFund = (): JSX.Element => (
    <>
      <div className="mc-grid mc-grid-3">
        <Kpi label="累计采购支出" value={money(base.dashboard?.buyer?.totalSpent ?? 0)} desc="不含已取消订单" />
        <Kpi label="可用保证金" value={money(guaranteeAvailable)} desc={`冻结 ${money(guaranteeFrozen)}`} tone="tech" />
        <Kpi label="平均客单价" value={money(base.dashboard?.buyer?.avgOrderValue ?? 0)} desc="按真实订单计算" tone="amber" />
      </div>
      <Panel title="保证金账户" extra={<a className="mc-link" href="/my-guarantee">查看流水 →</a>}>
        {guarantees.length === 0 ? (
          <EmptyState title="还没有保证金账户" desc="参与平台担保交易后，保证金账户与流水会在这里展示。" />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>保证金编号</th><th>主体</th><th>总额</th><th>可用</th><th>冻结</th><th>状态</th></tr></thead>
              <tbody>
                {guarantees.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.guaranteeNo}</td>
                    <td>{row.merchantName}</td>
                    <td className="mc-price">{money(row.totalAmount)}</td>
                    <td>{money(row.availableAmount)}</td>
                    <td>{money(row.frozenAmount)}</td>
                    <td><span className="mc-tag green">{row.guaranteeStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="发票申请与记录">
        <div className="mc-toolbar">
          <span className="mc-toolbar-muted">已付款订单可申请开票；一笔订单仅一张申请。</span>
          <span className="mc-spacer" />
          <button type="button" className="mc-btn" onClick={openInvoice} disabled={eligibleInvoiceOrders.length === 0}>
            申请开票
          </button>
        </div>
        {invoices.length === 0 ? (
          <EmptyState title="还没有开票申请" desc={eligibleInvoiceOrders.length ? '选择一笔已付款订单申请开票。' : '暂无可开票订单。'}
            action={eligibleInvoiceOrders.length ? <button type="button" className="mc-btn" onClick={openInvoice}>申请开票</button> : undefined} />
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead><tr><th>申请单号</th><th>订单号</th><th>开票金额</th><th>类型</th><th>抬头</th><th>状态</th><th>申请时间</th></tr></thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.id}>
                    <td className="mc-mono">{row.invoiceNo}</td>
                    <td className="mc-mono">{row.orderNo}</td>
                    <td className="mc-price">{money(row.amount)}</td>
                    <td>{row.invoiceType}</td>
                    <td className="mc-wrap-text">{row.title}</td>
                    <td><span className={`mc-tag ${row.invoiceStatus === 'issued' ? 'green' : row.invoiceStatus === 'rejected' ? 'red' : 'amber'}`}>{invoiceStatusText(row.invoiceStatus)}</span></td>
                    <td className="mc-mono mc-xs">{shortDate(row.applyTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Modal title="申请开票" open={invoiceOpen} onCancel={() => setInvoiceOpen(false)}
        onOk={() => void submitInvoice()} confirmLoading={invoiceSubmitting} okText="提交申请" cancelText="取消"
        destroyOnClose afterOpenChange={(open) => {
          if (open) {
            invoiceForm.setFieldsValue({
              orderId: eligibleInvoiceOrders[0]?.id,
              invoiceType: '增值税专用发票',
              title: buyerMerchant?.merchantName ?? '',
              taxNo: '',
              remark: '',
            })
          }
        }}>
        <Form form={invoiceForm} layout="vertical" preserve={false}>
          <Form.Item name="orderId" label="采购订单" rules={[{ required: true, message: '请选择订单' }]}>
            <Select placeholder="选择已付款订单" options={eligibleInvoiceOrders.map((order) => ({
              value: order.id,
              label: `${order.orderNo} · ${order.productName || order.categoryName || '订单商品'} · ${money(order.totalAmount)}`,
            }))} />
          </Form.Item>
          <Form.Item name="invoiceType" label="发票类型" rules={[{ required: true, message: '请选择发票类型' }]}>
            <Select options={['增值税专用发票', '增值税普通发票', '电子普通发票'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="title" label="发票抬头" rules={[{ required: true, message: '请填写发票抬头' }]}>
            <Input placeholder="与企业营业执照一致" />
          </Form.Item>
          <Form.Item name="taxNo" label="纳税人识别号">
            <Input placeholder="统一社会信用代码" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )

  const renderFavorite = (): JSX.Element => (
    <Panel title="收藏与关注">
      <EmptyState title="收藏与关注尚未接入" desc="当前交易域没有收藏/关注接口。可以先到交易大厅浏览货源，后续接入后会在这里展示关注的供应商与商品。"
        action={<a className="mc-btn" href="/product">去交易大厅</a>} />
    </Panel>
  )

  const renderProfile = (): JSX.Element => (
    <>
      <Panel title="企业资料与认证" extra={<a className="mc-btn ghost" href={`${window.location.protocol}//${window.location.hostname}:8098/portal/#/certify`} target="_blank" rel="noreferrer">认证中心</a>}>
        {base.merchants.length === 0 ? (
          <EmptyState title="当前账号还没有绑定经营主体" desc={base.error || '请先完成企业注册或联系平台运营绑定主体。'} />
        ) : (
          <div className="mc-grid mc-grid-2">
            {base.merchants.map((merchant) => (
              <div className="mc-profile-card" key={merchant.id}>
                <div className="mc-profile-head">
                  <CheckCircleOutlined />
                  <strong>{merchant.merchantName}</strong>
                  <span className="mc-tag green">{merchant.roleInMerchant || '成员'}</span>
                </div>
                <dl>
                  <dt>经营主体 ID</dt><dd className="mc-mono">{merchant.merchantId}</dd>
                  <dt>主体类型</dt><dd>{merchant.merchantType || '—'}</dd>
                  <dt>绑定状态</dt><dd>{merchant.status === 1 ? '正常' : '停用'}</dd>
                  <dt>个人实名</dt><dd>{realNameText(base.realName)}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="资质证照">
        <EmptyState title="证照文件不在交易域" desc="交易域只保存经营主体绑定关系；营业执照、许可证等材料请到认证中心查看或更新。"
          action={<a className="mc-btn" href={`${window.location.protocol}//${window.location.hostname}:8098/portal/#/certify/enterprise`} target="_blank" rel="noreferrer">去认证中心</a>} />
      </Panel>
    </>
  )

  const content = active === 'purchase' ? renderPurchase()
    : active === 'inquiry' ? renderInquiry()
      : active === 'after' ? renderAfter()
        : active === 'rate' ? renderRate()
          : active === 'fund' ? renderFund()
            : active === 'favorite' ? renderFavorite()
              : active === 'profile' ? renderProfile()
                : renderOverview()

  return (
    <MemberCenterShell role="buyer" active={active} navItems={NAV}
      merchantName={buyerMerchant?.merchantName ?? ''} onNavigate={setActive}>
      {base.loading && <div className="mc-loading">正在加载会员数据…</div>}
      {base.error && <div className="mc-alert"><AlertOutlined />{base.error}</div>}
      {content}
    </MemberCenterShell>
  )
}

function renderOrdersTable(
  rows: OrderRow[],
  loading: boolean,
  error: string,
  actions: (order: OrderRow) => JSX.Element,
): JSX.Element {
  if (loading) return <div className="mc-loading">加载订单中…</div>
  if (error) return <div className="mc-alert">{error}</div>
  if (rows.length === 0) return <EmptyState title="还没有采购订单" desc="在交易大厅选择货源下单后，订单会出现在这里。" />
  return (
    <div className="mc-table-wrap">
      <table className="mc-table">
        <thead>
          <tr><th>订单号</th><th>商品</th><th>数量</th><th>金额</th><th>供应方</th><th>状态</th><th>下单时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td className="mc-mono">{order.orderNo}</td>
              <td>{order.productName || order.categoryName || '—'}</td>
              <td className="mc-mono">{order.totalQuantity ?? '—'}</td>
              <td className="mc-price">{money(order.totalAmount)}</td>
              <td>{order.sellerName ?? '—'}</td>
              <td><StatusTag status={order.orderStatus} side="buyer" /></td>
              <td className="mc-mono mc-xs">{shortDate(order.createTime)}</td>
              <td>{actions(order)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function demandStatusText(status: string | undefined): string {
  const map: Record<string, string> = {
    pending: '待匹配',
    matching: '匹配中',
    quoted: '报价中',
    completed: '已成交',
    closed: '已关闭',
  }
  return status ? map[status] ?? status : '—'
}

function realNameText(record: { status: string } | null): string {
  if (!record) return '未提交'
  if (record.status === 'verified') return '已认证'
  if (record.status === 'pending') return '审核中'
  if (record.status === 'rejected') return '已驳回'
  return record.status
}

function invoiceStatusText(status: string): string {
  if (status === 'issued') return '已开票'
  if (status === 'rejected') return '已驳回'
  if (status === 'pending') return '待开票'
  return status
}
