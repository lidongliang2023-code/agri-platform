import { useCallback, useEffect, useState } from 'react'
import { DatePicker, Form, Input, InputNumber, Select, Spin, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  ShopOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  acceptQuote,
  convertQuoteToOrder,
  createQuote,
  deleteQuote,
  getQuoteList,
  updateQuote,
  type QuoteQuery,
  type QuoteVO,
} from '@/api/quote'
import { getMyMerchants } from '@/api/identity'
import { getReceivedInquiries, quoteInquiry, type InquiryVO } from '@/api/inquiry'
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared'
import './quote.css'

type QuoteMode = 'list' | 'inquiryQuote' | 'standaloneQuote'

const STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待受理', tone: 'amber' },
  approved: { text: '已通过', tone: 'green' },
  rejected: { text: '已拒绝', tone: 'red' },
  accepted: { text: '已受理', tone: 'green' },
  expired: { text: '已过期', tone: 'ghost' },
}

const INQUIRY_STATUS: Record<string, { text: string; tone: string }> = {
  pending_reply: { text: '待报价', tone: 'amber' },
  quoted: { text: '已报价', tone: 'tech' },
  converted: { text: '已成交', tone: 'green' },
  closed: { text: '已关闭', tone: 'ghost' },
}

function qualityCode(label?: string): string | undefined {
  const map: Record<string, string> = { 特级: 'premium', 一级: 'level1', 二级: 'level2', 三级: 'level3' }
  return label ? map[label] ?? label : undefined
}

function StatusTag({ status }: { status: string }): JSX.Element {
  const meta = STATUS[status] ?? { text: status || '未知', tone: 'ghost' }
  return <span className={`mc-tag ${meta.tone}`}>{meta.text}</span>
}

/** 卖家报价与询价响应工作区。 */
export default function QuoteList(): JSX.Element {
  const navigate = useNavigate()
  const [mode, setMode] = useState<QuoteMode>('list')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<QuoteVO[]>([])
  const [total, setTotal] = useState(0)
  const [queryParams, setQueryParams] = useState<QuoteQuery>({ pageNum: 1, pageSize: 10 })
  const [currentItem, setCurrentItem] = useState<QuoteVO | null>(null)
  const [quoteTarget, setQuoteTarget] = useState<InquiryVO | null>(null)
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])
  const [received, setReceived] = useState<InquiryVO[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [standaloneForm] = Form.useForm()
  const [inquiryForm] = Form.useForm()

  useEffect(() => {
    getMyMerchants()
      .then((response) => {
        if (response?.code === 200) {
          setMyMerchantIds((response.data ?? []).map((item) => String(item.merchantId)))
        }
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  const isMyQuoteAsBuyer = (record: QuoteVO): boolean =>
    record.buyerId != null && myMerchantIds.includes(String(record.buyerId))

  const loadReceived = useCallback((): void => {
    getReceivedInquiries()
      .then((response: { code: number; data?: InquiryVO[] }) => {
        if (response?.code === 200) setReceived(response.data ?? [])
      })
      .catch(() => setReceived([]))
  }, [])

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const response = await getQuoteList(queryParams)
      if (response.code === 200) {
        setData(response.data?.records ?? [])
        setTotal(Number(response.data?.total ?? 0))
      } else {
        message.error(response.message ?? '加载报价失败')
      }
    } catch {
      message.error('加载报价失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [queryParams])

  useEffect(() => {
    loadReceived()
  }, [loadReceived])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const showList = (): void => {
    setMode('list')
    setCurrentItem(null)
    setQuoteTarget(null)
  }

  const openInquiryQuote = (inquiry: InquiryVO): void => {
    setQuoteTarget(inquiry)
    inquiryForm.resetFields()
    inquiryForm.setFieldsValue({ quantity: inquiry.quantity, freightAmount: 0 })
    setMode('inquiryQuote')
  }

  const openStandalone = (record?: QuoteVO): void => {
    setCurrentItem(record ?? null)
    standaloneForm.resetFields()
    if (record) {
      standaloneForm.setFieldsValue({
        ...record,
        deliveryTime: record.deliveryTime ? dayjs(record.deliveryTime) : null,
        validDays: record.validUntil
          ? Math.max(1, Math.ceil(dayjs(record.validUntil).diff(dayjs(), 'day', true)))
          : 7,
        qualityLevel: qualityCode(record.qualityDescription),
      })
    } else {
      standaloneForm.setFieldsValue({ validDays: 7, freightAmount: 0 })
    }
    setMode('standaloneQuote')
  }

  const submitInquiryQuote = async (): Promise<void> => {
    if (!quoteTarget) return
    const values = await inquiryForm.validateFields()
    setSubmitting(true)
    try {
      const response = await quoteInquiry({
        inquiryId: quoteTarget.id,
        unitPrice: values.unitPrice,
        quantity: values.quantity ?? quoteTarget.quantity,
        freightAmount: values.freightAmount,
        remark: values.remark,
      })
      if (response?.code === 200) {
        message.success('报价已提交，采购方可在报价管理中受理')
        loadReceived()
        await loadData()
        showList()
      } else {
        message.error(response?.message ?? '报价失败')
      }
    } catch {
      message.error('报价失败（请检查后端是否在运行）')
    } finally {
      setSubmitting(false)
    }
  }

  const submitStandalone = async (): Promise<void> => {
    const values = await standaloneForm.validateFields()
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        deliveryTime: values.deliveryTime?.format('YYYY-MM-DD'),
      }
      const response = currentItem
        ? await updateQuote(currentItem.id, payload)
        : await createQuote(payload)
      if (response?.code === 200) {
        message.success(currentItem ? '报价已更新' : '报价已创建')
        await loadData()
        showList()
      } else {
        message.error(response?.message ?? '报价保存失败')
      }
    } catch {
      message.error('报价保存失败（请检查后端是否在运行）')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: QuoteVO): Promise<void> => {
    if (!window.confirm(`确定删除报价 ${record.quoteNo}？已生成订单的报价不能删除。`)) return
    try {
      const response = await deleteQuote(record.id)
      if (response.code === 200) {
        message.success('报价已删除')
        await loadData()
      } else {
        message.error(response.message ?? '删除失败')
      }
    } catch {
      message.error('删除失败（请检查后端是否在运行）')
    }
  }

  const handleAccept = async (record: QuoteVO): Promise<void> => {
    try {
      const response = await acceptQuote(record.id)
      if (response.code === 200) {
        message.success('报价已受理')
        await loadData()
      } else {
        message.error(response.message ?? '接受报价失败')
      }
    } catch {
      message.error('接受报价失败')
    }
  }

  const handleConvert = async (record: QuoteVO): Promise<void> => {
    try {
      const response = await convertQuoteToOrder(record.id)
      if (response.code === 200 && response.data) {
        message.success('已生成采购订单')
        navigate(`/order/confirm?orderId=${response.data.id}`)
      } else {
        message.error(response.message ?? '生成订单失败')
      }
    } catch {
      message.error('生成订单失败')
    }
  }

  if (mode === 'inquiryQuote' && quoteTarget) {
    return (
      <div className="quote-workbench quote-action-page">
        <button type="button" className="quote-back" onClick={showList}><ArrowLeftOutlined /> 返回报价与撮合</button>
        <section className="quote-action-hero">
          <span className="quote-action-icon"><SendOutlined /></span>
          <div><small>RESPOND TO INQUIRY</small><h2>询价报价</h2><p>{quoteTarget.inquiryNo} · {quoteTarget.productName || `商品 #${quoteTarget.productId}`}</p></div>
          <span className="mc-tag amber">{quoteTarget.inquiryStatus === 'quoted' ? '已报价' : '待报价'}</span>
        </section>
        <div className="quote-action-layout">
          <Panel title="报价信息">
            <Form form={inquiryForm} layout="vertical" onFinish={() => void submitInquiryQuote()} className="quote-form">
              <div className="quote-inquiry-brief">
                <div><span>采购方</span><strong>{quoteTarget.buyerName || '—'}</strong></div>
                <div><span>需求数量</span><strong>{quoteTarget.quantity} {quoteTarget.unit}</strong></div>
                <div><span>期望价格</span><strong>{money(quoteTarget.priceMin)} - {money(quoteTarget.priceMax)}</strong></div>
                <div><span>报价截止</span><strong>{shortDate(quoteTarget.replyDeadline)}</strong></div>
              </div>
              <div className="quote-form-grid">
                <Form.Item name="unitPrice" label={`单价（元/${quoteTarget.unit}）`} rules={[{ required: true, message: '请输入报价单价' }]}>
                  <InputNumber min={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入正式报价" />
                </Form.Item>
                <Form.Item name="quantity" label="报价数量">
                  <InputNumber min={0.001} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="freightAmount" label="运费（元）">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <Form.Item name="remark" label="报价说明">
                <Input.TextArea rows={5} placeholder="例如：含包装、7 天内发货、可提供质检报告" showCount maxLength={500} />
              </Form.Item>
              <div className="quote-form-actions">
                <button type="submit" className="mc-btn" disabled={submitting}>{submitting ? '正在提交…' : '提交正式报价'}</button>
                <button type="button" className="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="quote-action-aside">
            <Panel title="报价提示">
              <ul className="quote-guidance">
                <li><CheckCircleOutlined /> 总价由平台按“单价 × 数量 + 运费”计算。</li>
                <li><ClockCircleOutlined /> 请在报价截止前提交，报价会被平台留痕。</li>
                <li><SafetyCertificateOutlined /> 采购方受理后，平台可依据报价生成订单。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (mode === 'standaloneQuote') {
    return (
      <div className="quote-workbench quote-action-page">
        <button type="button" className="quote-back" onClick={showList}><ArrowLeftOutlined /> 返回报价管理</button>
        <section className="quote-action-hero">
          <span className="quote-action-icon"><EditOutlined /></span>
          <div><small>{currentItem ? 'EDIT QUOTATION' : 'NEW QUOTATION'}</small><h2>{currentItem ? '编辑报价' : '新增报价'}</h2><p>{currentItem ? currentItem.quoteNo : '创建不关联询价单的独立报价'}</p></div>
          {currentItem && <StatusTag status={currentItem.quoteStatus} />}
        </section>
        <div className="quote-action-layout">
          <Panel title="报价内容">
            <Form form={standaloneForm} layout="vertical" onFinish={() => void submitStandalone()} className="quote-form">
              <div className="quote-form-grid">
                <Form.Item name="productName" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
                  <Input placeholder="请输入产品名称" />
                </Form.Item>
                <Form.Item name="unitPrice" label="销售单价（元）" rules={[{ required: true, message: '请输入单价' }]}>
                  <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="quantity" label="可供数量" rules={[{ required: true, message: '请输入数量' }]}>
                  <InputNumber min={0.001} precision={4} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="unit" label="计量单位" rules={[{ required: true, message: '请选择单位' }]}>
                  <Select options={['吨', '千克', '斤', '件', '箱', '袋'].map((value) => ({ value, label: value }))} />
                </Form.Item>
                <Form.Item name="freightAmount" label="运费（元）">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="validDays" label="有效期（天）" rules={[{ required: true, message: '请输入有效期' }]}>
                  <InputNumber min={1} max={365} precision={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="qualityLevel" label="质量等级">
                  <Select options={[
                    { value: 'premium', label: '特级' },
                    { value: 'level1', label: '一级' },
                    { value: 'level2', label: '二级' },
                    { value: 'level3', label: '三级' },
                  ]} />
                </Form.Item>
                <Form.Item name="deliveryTime" label="交货时间">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <Form.Item name="deliveryAddress" label="交货地址">
                <Input.TextArea rows={3} placeholder="请输入交货地址" />
              </Form.Item>
              <Form.Item name="remark" label="报价备注">
                <Input.TextArea rows={4} placeholder="补充包装、质量标准、发货安排等" showCount maxLength={500} />
              </Form.Item>
              <div className="quote-form-actions">
                <button type="submit" className="mc-btn" disabled={submitting}>{submitting ? '正在保存…' : currentItem ? '保存报价' : '创建报价'}</button>
                <button type="button" className="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="quote-action-aside">
            <Panel title="报价说明">
              <ul className="quote-guidance">
                <li><TagOutlined /> 卖方主体由当前登录卖家自动确定。</li>
                <li><CheckCircleOutlined /> 总价由平台按单价与数量计算。</li>
                <li><SafetyCertificateOutlined /> 已受理或已生成订单的报价不能修改。</li>
              </ul>
            </Panel>
            <div className="quote-aside-tip">
              <ShopOutlined />
              <div><strong>提示</strong><span>独立报价用于主动展示供应价格；采购方若要直接成交，请优先响应其询价单。</span></div>
            </div>
          </aside>
        </div>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(total / Number(queryParams.pageSize ?? 10)))
  const pendingCount = data.filter((item) => item.quoteStatus === 'pending').length

  return (
    <div className="quote-workbench">
      <Panel title={`收到的询价（${received.length}）`} extra={<span className="quote-section-note">采购方询价等待响应</span>}>
        {received.length === 0 ? (
          <EmptyState title="暂无采购询价" desc="采购方针对你的货源发起询价后，会显示在这里。" />
        ) : (
          <div className="quote-inquiry-grid">
            {received.map((inquiry) => {
              const meta = INQUIRY_STATUS[inquiry.inquiryStatus] ?? { text: inquiry.inquiryStatus, tone: 'ghost' }
              return (
                <div className="quote-inquiry-card" key={inquiry.id}>
                  <div className="quote-inquiry-head">
                    <span className="quote-inquiry-icon"><FileSearchOutlined /></span>
                    <div><small>{inquiry.inquiryNo}</small><strong>{inquiry.productName || `商品 #${inquiry.productId}`}</strong><p>{inquiry.buyerName || '采购方'} · {inquiry.quantity} {inquiry.unit}</p></div>
                    <span className={`mc-tag ${meta.tone}`}>{meta.text}</span>
                  </div>
                  <div className="quote-inquiry-data">
                    <div><span>期望价格</span><strong>{money(inquiry.priceMin)} - {money(inquiry.priceMax)}</strong></div>
                    <div><span>报价数量</span><strong>{inquiry.quantity} {inquiry.unit}</strong></div>
                    <div><span>报价截止</span><strong>{shortDate(inquiry.replyDeadline)}</strong></div>
                  </div>
                  <div className="quote-inquiry-foot">
                    <span>{inquiry.replyCount ?? 0} 份已提交报价</span>
                    <button type="button" className="mc-btn" onClick={() => openInquiryQuote(inquiry)}><SendOutlined /> 去报价</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="报价管理" extra={<button type="button" className="mc-btn" onClick={() => openStandalone()}><PlusOutlined /> 新增报价</button>}>
        <div className="quote-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="报价编号"
            value={queryParams.quoteNo}
            onChange={(event) => setQueryParams((previous) => ({ ...previous, quoteNo: event.target.value }))}
          />
          <Input
            allowClear
            placeholder="产品名称"
            value={queryParams.productName}
            onChange={(event) => setQueryParams((previous) => ({ ...previous, productName: event.target.value }))}
          />
          <Select
            allowClear
            placeholder="报价状态"
            value={queryParams.quoteStatus}
            onChange={(value) => setQueryParams((previous) => ({ ...previous, quoteStatus: value }))}
            options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.text }))}
          />
          <button type="button" className="mc-btn" onClick={() => setQueryParams((previous) => ({ ...previous, pageNum: 1 }))}>搜索</button>
          <button type="button" className="mc-btn ghost" onClick={() => setQueryParams({ pageNum: 1, pageSize: 10 })}>重置</button>
        </div>
        <div className="quote-list-summary">
          <span>本页 {data.length} 份报价</span>
          <span>待受理 {pendingCount} 份</span>
          <span>报价总数 {total} 份</span>
        </div>
        {loading ? (
          <div className="quote-loading"><Spin /><span>正在读取报价记录…</span></div>
        ) : data.length === 0 ? (
          <EmptyState title="暂无报价记录" desc="响应采购询价或新增独立报价后，记录会显示在这里。" />
        ) : (
          <div className="quote-card-list">
            {data.map((record) => {
              const expired = record.validUntil && dayjs(record.validUntil).isBefore(dayjs())
              return (
                <div className="quote-card" key={record.id}>
                  <div className="quote-card-main">
                    <span className="quote-card-icon"><TagOutlined /></span>
                    <div>
                      <div className="quote-card-title"><strong>{record.productName || '未命名报价'}</strong><StatusTag status={record.quoteStatus} /></div>
                      <small>{record.quoteNo} · {record.sellerName || '当前卖家'} · {shortDate(record.createTime)}</small>
                      <p>{record.remark || '暂无报价说明'}</p>
                    </div>
                  </div>
                  <div className="quote-card-numbers">
                    <div><span>单价</span><strong>{money(record.unitPrice)}/{record.unit}</strong></div>
                    <div><span>数量</span><strong>{record.quantity} {record.unit}</strong></div>
                    <div><span>总价</span><strong className="quote-price">{money(record.totalAmount)}</strong></div>
                  </div>
                  <div className="quote-card-validity">
                    <span>有效期至</span><strong className={expired ? 'expired' : ''}>{shortDate(record.validUntil)}</strong>
                  </div>
                  <div className="quote-card-actions">
                    {record.quoteStatus === 'pending' && (
                      <button type="button" className="mc-link quote-action" onClick={() => openStandalone(record)}><EditOutlined /> 编辑</button>
                    )}
                    {record.orderId ? (
                      <a className="mc-link quote-action" href={`/order/detail/${record.orderId}`}>查看订单</a>
                    ) : (
                      <button type="button" className="mc-link quote-action" onClick={() => void handleDelete(record)}><DeleteOutlined /> 删除</button>
                    )}
                    {record.quoteStatus === 'pending' && isMyQuoteAsBuyer(record) && (
                      <button type="button" className="mc-link quote-action" onClick={() => void handleAccept(record)}><CheckCircleOutlined /> 接受</button>
                    )}
                    {record.quoteStatus === 'accepted' && isMyQuoteAsBuyer(record) && (
                      <button type="button" className="mc-link quote-action" onClick={() => void handleConvert(record)}>生成订单</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {data.length > 0 && (
          <div className="mc-pager quote-pager">
            <button type="button" disabled={Number(queryParams.pageNum) <= 1}
              onClick={() => setQueryParams((previous) => ({ ...previous, pageNum: Number(previous.pageNum) - 1 }))}>上一页</button>
            <span>第 {queryParams.pageNum} / {pageCount} 页 · 共 {total} 份</span>
            <button type="button" disabled={Number(queryParams.pageNum) >= pageCount}
              onClick={() => setQueryParams((previous) => ({ ...previous, pageNum: Number(previous.pageNum) + 1 }))}>下一页</button>
          </div>
        )}
      </Panel>
    </div>
  )
}
