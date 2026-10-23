import { useEffect, useMemo, useState } from 'react'
import { Form, Input, InputNumber, Select, Spin, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  SearchOutlined,
  ShopOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteLogistics,
  getCarriers,
  getLogisticsById,
  getLogisticsList,
  getLogisticsTraces,
  updateLogistics,
  updateLogisticsStatus,
  type CarrierVO,
  type LogisticsQuery,
  type LogisticsVO,
  type LogisticsTraceVO,
} from '@/api/logistics'
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared'
import '../../dispute/list/after-sales.css'

type LogisticsPageMode = 'list' | 'detail' | 'trace' | 'edit'

const LOGISTICS_TYPE: Record<string, string> = {
  cold_chain: '冷链运输',
  normal: '普通货运',
  express: '快递配送',
  self_pickup: '买家自提',
  road: '公路运输',
}

const LOGISTICS_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待揽收', tone: 'amber' },
  picked: { text: '已揽收', tone: 'tech' },
  in_transit: { text: '运输中', tone: 'tech' },
  delivering: { text: '派送中', tone: 'tech' },
  delivered: { text: '已签收', tone: 'green' },
  exception: { text: '运输异常', tone: 'red' },
}

function logisticsStatus(value: string): { text: string; tone: string } {
  return LOGISTICS_STATUS[value] ?? { text: value || '未知', tone: 'ghost' }
}

function LogisticsTag({ value }: { value: string }): JSX.Element {
  const meta = logisticsStatus(value)
  return <span className={`mc-tag ${meta.tone}`}>{meta.text}</span>
}

/** 买卖双方共用的物流管理工作区。 */
export default function LogisticsList(): JSX.Element {
  const queryClient = useQueryClient()
  const [pageMode, setPageMode] = useState<LogisticsPageMode>('list')
  const [active, setActive] = useState<LogisticsVO | null>(null)
  const [query, setQuery] = useState<LogisticsQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ logisticsNo?: string; logisticsStatus?: string }>({})
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [carriers, setCarriers] = useState<CarrierVO[]>([])
  const [traces, setTraces] = useState<LogisticsTraceVO[]>([])
  const [traceLoading, setTraceLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['logistics', query],
    queryFn: () => getLogisticsList(query),
  })
  const rows: LogisticsVO[] = data?.data?.records ?? []
  const total = Number(data?.data?.total ?? 0)
  const currentPage = Number(data?.data?.current ?? query.pageNum ?? 1)
  const pageCount = Math.max(1, Math.ceil(total / Number(query.pageSize ?? 10)))
  const summary = useMemo(() => ({
    transit: rows.filter((row) => ['picked', 'in_transit', 'delivering'].includes(row.logisticsStatus)).length,
    delivered: rows.filter((row) => row.logisticsStatus === 'delivered').length,
    exception: rows.filter((row) => row.logisticsStatus === 'exception').length,
    freight: rows.reduce((sum, row) => sum + Number(row.freightAmount ?? 0), 0),
  }), [rows])

  useEffect(() => {
    getCarriers()
      .then((response: { code: number; data?: CarrierVO[] }) => {
        if (response?.code === 200) setCarriers(response.data ?? [])
      })
      .catch(() => setCarriers([]))
  }, [])

  const showList = (): void => {
    setPageMode('list')
    setActive(null)
  }

  const showDetail = (row: LogisticsVO): void => {
    setActive(row)
    setPageMode('detail')
  }

  const openTrace = async (row: LogisticsVO): Promise<void> => {
    setActive(row)
    setPageMode('trace')
    setTraces([])
    setTraceLoading(true)
    try {
      const response = await getLogisticsTraces(row.id)
      if (response?.code === 200) setTraces(response.data ?? [])
      else message.error(response?.message ?? '加载物流轨迹失败')
    } catch {
      message.error('加载物流轨迹失败（请检查后端是否在运行）')
    } finally {
      setTraceLoading(false)
    }
  }

  const openEdit = (row: LogisticsVO): void => {
    setActive(row)
    setPageMode('edit')
    form.setFieldsValue({
      carrierId: row.carrierId ?? undefined,
      logisticsType: row.logisticsType ?? undefined,
      freightAmount: row.freightAmount ?? undefined,
      status: row.logisticsStatus,
      location: row.currentLocation ?? undefined,
      signReceiver: row.signReceiver ?? undefined,
      receiverContact: row.receiverContact ?? undefined,
      receiverPhone: row.receiverPhone ?? undefined,
      receiverAddress: row.receiverAddress ?? undefined,
    })
  }

  const submitEdit = async (): Promise<void> => {
    if (!active) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const basic = await updateLogistics(active.id, {
        carrierId: values.carrierId,
        logisticsType: values.logisticsType,
        freightAmount: values.freightAmount,
        receiverContact: values.receiverContact,
        receiverPhone: values.receiverPhone,
        receiverAddress: values.receiverAddress,
      })
      if (basic?.code !== 200) {
        message.error(basic?.message ?? '物流信息保存失败')
        return
      }
      const status = await updateLogisticsStatus(active.id, values.status, {
        location: values.location,
        signReceiver: values.signReceiver,
      })
      if (status?.code !== 200) {
        message.error(status?.message ?? '物流状态更新失败')
        return
      }
      message.success('物流信息与状态已更新')
      await queryClient.invalidateQueries({ queryKey: ['logistics'] })
      const refreshed = await getLogisticsById(active.id)
      if (refreshed?.code === 200 && refreshed.data) setActive(refreshed.data)
      setPageMode('detail')
    } catch {
      message.error('物流信息更新失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: LogisticsVO): Promise<void> => {
    if (!window.confirm(`确定删除物流单 ${row.logisticsNo}？已签收物流单不能删除。`)) return
    try {
      const response = await deleteLogistics(row.id)
      if (response?.code === 200) {
        message.success('物流单已删除')
        await queryClient.invalidateQueries({ queryKey: ['logistics'] })
        if (active?.id === row.id) showList()
      } else {
        message.error(response?.message ?? '删除失败')
      }
    } catch {
      message.error('删除失败（请检查后端是否在运行）')
    }
  }

  if (pageMode === 'trace' && active) {
    return (
      <div className="after-workbench logistics-workbench">
        <button type="button" className="after-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回物流详情
        </button>
        <section className="after-hero logistics-hero">
          <span className="after-hero-icon"><TruckOutlined /></span>
          <div><small>LOGISTICS TRACKING</small><h2>物流轨迹</h2><p>{active.logisticsNo} · {active.carrierName || '承运商待补充'}</p></div>
          <LogisticsTag value={active.logisticsStatus} />
        </section>
        <Panel title="运输节点">
          {traceLoading ? (
            <div className="after-loading"><Spin /><span>正在加载物流轨迹…</span></div>
          ) : traces.length === 0 ? (
            <EmptyState title="暂无物流轨迹" desc="物流状态更新后，运输节点会显示在这里。" />
          ) : (
            <div className="logistics-trace-list">
              {[...traces].sort((left, right) =>
                String(right.traceTime).localeCompare(String(left.traceTime))).map((trace, index) => (
                <div className={`logistics-trace-item ${index === 0 ? 'latest' : ''}`} key={trace.id}>
                  <span className="logistics-trace-dot"><CheckCircleOutlined /></span>
                  <div>
                    <strong>{trace.traceDescription || logisticsStatus(trace.traceStatus).text}</strong>
                    <p><EnvironmentOutlined /> {trace.traceLocation || '位置待更新'}</p>
                    <small>{shortDate(trace.traceTime)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    )
  }

  if (pageMode === 'edit' && active) {
    return (
      <div className="after-workbench logistics-workbench">
        <button type="button" className="after-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回物流详情
        </button>
        <section className="after-hero logistics-hero">
          <span className="after-hero-icon"><EditOutlined /></span>
          <div><small>DELIVERY UPDATE</small><h2>编辑物流信息</h2><p>{active.logisticsNo} · 更新承运商、收货信息与物流节点</p></div>
          <LogisticsTag value={active.logisticsStatus} />
        </section>
        <div className="after-form-layout">
          <Panel title="物流与收发货信息">
            <Form form={form} layout="vertical" onFinish={() => void submitEdit()} className="after-form">
              <div className="after-form-grid">
                <Form.Item name="carrierId" label="承运商">
                  <Select allowClear options={carriers.map((item) => ({ value: item.id, label: item.carrierName }))} />
                </Form.Item>
                <Form.Item name="logisticsType" label="物流类型">
                  <Select allowClear options={Object.entries(LOGISTICS_TYPE).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
                <Form.Item name="freightAmount" label="运费（元）">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="status" label="物流状态" rules={[{ required: true, message: '请选择物流状态' }]}>
                  <Select options={Object.entries(LOGISTICS_STATUS).map(([value, item]) => ({ value, label: item.text }))} />
                </Form.Item>
              </div>
              <div className="after-form-grid">
                <Form.Item name="location" label="当前位置">
                  <Input placeholder="例如：山东省潍坊市寒亭区" />
                </Form.Item>
                <Form.Item name="signReceiver" label="签收人">
                  <Input placeholder="状态为已签收时填写" />
                </Form.Item>
                <Form.Item name="receiverContact" label="收货人">
                  <Input />
                </Form.Item>
                <Form.Item name="receiverPhone" label="收货电话">
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="receiverAddress" label="收货地址">
                <Input.TextArea rows={3} />
              </Form.Item>
              <div className="after-form-actions">
                <button type="submit" className="mc-btn" disabled={saving}>{saving ? '正在保存…' : '保存物流信息'}</button>
                <button type="button" className="mc-btn ghost" onClick={() => setPageMode('detail')}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="after-side-stack">
            <Panel title="操作说明">
              <ul className="after-guidance">
                <li><TruckOutlined /> 修改物流状态会自动追加一条运输轨迹。</li>
                <li><CheckCircleOutlined /> 状态选择“已签收”时需要填写签收人。</li>
                <li><ShopOutlined /> 收发货信息会同步展示在订单物流详情中。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (pageMode === 'detail' && active) {
    return (
      <div className="after-workbench logistics-workbench">
        <button type="button" className="after-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回物流管理
        </button>
        <section className="after-hero logistics-hero">
          <span className="after-hero-icon"><TruckOutlined /></span>
          <div><small>LOGISTICS ORDER · {active.logisticsNo}</small><h2>{active.carrierName || '物流单详情'}</h2><p>关联订单 {active.orderId} · {LOGISTICS_TYPE[active.logisticsType] ?? active.logisticsType}</p></div>
          <LogisticsTag value={active.logisticsStatus} />
          <div className="logistics-hero-actions">
            <button type="button" className="mc-btn" onClick={() => void openTrace(active)}><TruckOutlined /> 查看轨迹</button>
            <button type="button" className="mc-btn ghost" onClick={() => openEdit(active)}><EditOutlined /> 编辑</button>
          </div>
        </section>
        <Panel title="运输路线">
          <div className="logistics-route">
            <div><span><ShopOutlined /></span><small>发货地</small><strong>{active.senderAddress || '发货地址待补充'}</strong></div>
            <div className="logistics-route-line"><i /><TruckOutlined /><i /></div>
            <div><span><EnvironmentOutlined /></span><small>收货地</small><strong>{active.receiverAddress || '收货地址待补充'}</strong></div>
          </div>
        </Panel>
        <div className="after-detail-layout">
          <div className="after-detail-main">
            <Panel title="物流信息">
              <div className="after-case-grid logistics-facts">
                <div><span>承运商</span><strong>{active.carrierName || '—'}</strong></div>
                <div><span>物流类型</span><strong>{LOGISTICS_TYPE[active.logisticsType] ?? active.logisticsType}</strong></div>
                <div><span>运费</span><strong className="after-amount">{money(active.freightAmount)}</strong></div>
                <div><span>当前位置</span><strong>{active.currentLocation || '—'}</strong></div>
                <div><span>收货人</span><strong>{active.receiverContact || '—'}</strong></div>
                <div><span>联系电话</span><strong>{active.receiverPhone || '—'}</strong></div>
              </div>
            </Panel>
            <Panel title="签收记录">
              <div className="after-result-list">
                <div><span>揽收时间</span><p>{shortDate(active.pickupTime)}</p></div>
                <div><span>送达时间</span><p>{shortDate(active.deliveryTime)}</p></div>
                <div><span>签收时间</span><p>{shortDate(active.signTime)}</p></div>
                <div><span>签收人</span><p>{active.signReceiver || '尚未签收'}</p></div>
              </div>
            </Panel>
          </div>
          <aside className="after-detail-aside">
            <Panel title="履约进度">
              <div className="after-timeline">
                <div className="on"><span><CheckCircleOutlined /></span><div><strong>物流单已创建</strong><small>{shortDate(active.createTime)}</small></div></div>
                <div className={['picked', 'in_transit', 'delivering', 'delivered'].includes(active.logisticsStatus) ? 'on' : ''}><span><TruckOutlined /></span><div><strong>运输与派送</strong><small>{logisticsStatus(active.logisticsStatus).text}</small></div></div>
                <div className={active.logisticsStatus === 'delivered' ? 'on' : ''}><span><CheckCircleOutlined /></span><div><strong>完成签收</strong><small>{shortDate(active.signTime)}</small></div></div>
              </div>
            </Panel>
            <Panel title="快捷操作">
              <div className="logistics-quick-actions">
                <button type="button" className="mc-btn ghost" onClick={() => void openTrace(active)}>查看完整轨迹</button>
                <button type="button" className="mc-btn ghost" onClick={() => openEdit(active)}>更新运输状态</button>
                <button type="button" className="mc-link after-delete" onClick={() => void handleDelete(active)}><DeleteOutlined /> 删除物流单</button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="after-workbench logistics-workbench">
      <section className="after-overview">
        <div className="after-overview-title">
          <span className="after-overview-icon"><TruckOutlined /></span>
          <div><small>LOGISTICS MANAGEMENT</small><h2>物流管理</h2><p>跟踪发货、运输、派送和签收节点，维护承运与收货信息。</p></div>
        </div>
        <div className="after-overview-stats">
          <div><span>本页运输中</span><strong>{summary.transit}</strong></div>
          <div><span>本页已签收</span><strong>{summary.delivered}</strong></div>
          <div><span>本页异常</span><strong>{summary.exception}</strong></div>
          <div><span>本页运费</span><strong>{money(summary.freight)}</strong></div>
        </div>
      </section>
      <Panel title="物流单" extra={<span className="after-count">共 {total} 条</span>}>
        <div className="after-toolbar">
          <Input
            prefix={<SearchOutlined />}
            allowClear
            placeholder="输入物流单号"
            value={draft.logisticsNo}
            onChange={(event) => setDraft((previous) => ({
              ...previous,
              logisticsNo: event.target.value || undefined,
            }))}
          />
          <Select
            allowClear
            placeholder="全部物流状态"
            value={draft.logisticsStatus}
            onChange={(value) => setDraft((previous) => ({ ...previous, logisticsStatus: value }))}
            options={Object.entries(LOGISTICS_STATUS).map(([value, item]) => ({ value, label: item.text }))}
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
          <div className="after-loading"><Spin /><span>正在读取物流单…</span></div>
        ) : rows.length === 0 ? (
          <EmptyState title="暂无物流单" desc="卖家发货后会自动生成物流单和运输轨迹。" />
        ) : (
          <>
            <div className="mc-table-wrap">
              <table className="mc-table logistics-table">
                <thead><tr><th>物流单号</th><th>关联订单</th><th>承运信息</th><th>收货信息</th><th>状态</th><th>当前位置</th><th>操作</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button type="button" className="after-name-link" onClick={() => showDetail(row)}>
                          <strong className="mc-mono">{row.logisticsNo}</strong>
                          <span>{shortDate(row.createTime)}</span>
                        </button>
                      </td>
                      <td className="mc-mono">{row.orderId}</td>
                      <td><div className="logistics-carrier-cell"><TruckOutlined /><span>{row.carrierName || '承运商待补充'}</span><small>{LOGISTICS_TYPE[row.logisticsType] ?? row.logisticsType}</small></div></td>
                      <td><div className="logistics-receiver-cell"><strong>{row.receiverContact || '—'}</strong><small>{row.receiverAddress || '地址待补充'}</small></div></td>
                      <td><LogisticsTag value={row.logisticsStatus} /></td>
                      <td className="logistics-location-cell">{row.currentLocation || '—'}</td>
                      <td>
                        <div className="mc-actions">
                          <button type="button" className="mc-link after-action" onClick={() => void openTrace(row)}><TruckOutlined /> 跟踪</button>
                          <button type="button" className="mc-link after-action" onClick={() => showDetail(row)}><EyeOutlined /> 查看</button>
                          <button type="button" className="mc-link after-action" onClick={() => openEdit(row)}><EditOutlined /> 编辑</button>
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
