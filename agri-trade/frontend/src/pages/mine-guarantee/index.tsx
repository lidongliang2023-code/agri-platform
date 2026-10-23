import { useCallback, useEffect, useState } from 'react'
import { Form, Input, InputNumber, Spin, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import {
  getMyGuaranteeLogs,
  getMyGuarantees,
  replenishMyGuarantee,
  type GuaranteeLogRow,
  type GuaranteeRow,
} from '@/api/guarantee'
import { getMyMerchants } from '@/api/identity'
import { EmptyState, Panel, money, shortDate } from '../member-center/shared'
import './guarantee.css'

type GuaranteeMode = 'list' | 'replenish' | 'logs'

const STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待审核', tone: 'amber' },
  active: { text: '生效中', tone: 'green' },
  rejected: { text: '已驳回', tone: 'red' },
  expired: { text: '已到期', tone: 'ghost' },
}

const TYPE: Record<string, string> = {
  cash: '现金保证金',
  bank: '银行保函',
  insurance: '保险保单',
}

const ACTION: Record<string, string> = {
  create: '账户开立',
  verify: '账户审核',
  freeze: '保证金冻结',
  unfreeze: '保证金解冻',
  replenish: '保证金补缴',
  deduct: '保证金扣划',
}

function statusMeta(value: string): { text: string; tone: string } {
  return STATUS[value] ?? { text: value || '未知', tone: 'ghost' }
}

/** 卖家保证金账户、补缴和资金流水工作区。 */
export default function MyGuarantee(): JSX.Element {
  const [rows, setRows] = useState<GuaranteeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<GuaranteeMode>('list')
  const [active, setActive] = useState<GuaranteeRow | null>(null)
  const [logs, setLogs] = useState<GuaranteeLogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const replenishAmount = Form.useWatch('amount', form) as number | undefined

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [guaranteeResponse, merchantResponse] = await Promise.all([
        getMyGuarantees(),
        getMyMerchants(),
      ])
      if (guaranteeResponse?.code !== 200) {
        message.error(guaranteeResponse?.message ?? '加载保证金账户失败')
        return
      }
      const merchantNames = new Map(
        (merchantResponse?.code === 200 ? merchantResponse.data ?? [] : [])
          .map((item) => [String(item.merchantId), item.merchantName]),
      )
      const now = Date.now()
      const guaranteeRows: GuaranteeRow[] = Array.isArray(guaranteeResponse.data)
        ? guaranteeResponse.data
        : []
      setRows(guaranteeRows.map((row) => ({
        ...row,
        merchantName: merchantNames.get(String(row.merchantId)) ?? row.merchantName,
        guaranteeStatus: row.guaranteeStatus === 'active'
          && row.expireTime
          && new Date(row.expireTime).getTime() < now
          ? 'expired'
          : row.guaranteeStatus,
      })))
    } catch {
      message.error('加载保证金账户失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openLogs = async (row: GuaranteeRow): Promise<void> => {
    setActive(row)
    setLogs([])
    setMode('logs')
    setLogsLoading(true)
    try {
      const response = await getMyGuaranteeLogs(row.id)
      if (response?.code === 200) setLogs(response.data ?? [])
      else message.error(response?.message ?? '加载保证金流水失败')
    } catch {
      message.error('加载保证金流水失败（请检查后端是否在运行）')
    } finally {
      setLogsLoading(false)
    }
  }

  const openReplenish = (row: GuaranteeRow): void => {
    setActive(row)
    form.resetFields()
    setMode('replenish')
  }

  const submitReplenish = async (): Promise<void> => {
    if (!active) return
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      const response = await replenishMyGuarantee(active.id, values.amount, values.reason)
      if (response?.code === 200) {
        message.success('保证金补缴成功')
        await load()
        await openLogs(active)
      } else {
        message.error(response?.message ?? '补缴失败')
      }
    } catch {
      message.error('补缴失败（请检查后端是否在运行）')
    } finally {
      setSubmitting(false)
    }
  }

  const effectiveRows = rows.filter((row) => row.guaranteeStatus === 'active')
  const total = effectiveRows.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0)
  const available = effectiveRows.reduce((sum, row) => sum + Number(row.availableAmount ?? 0), 0)
  const frozen = effectiveRows.reduce((sum, row) => sum + Number(row.frozenAmount ?? 0), 0)
  const used = effectiveRows.reduce((sum, row) => sum + Number(row.usedAmount ?? 0), 0)
  const projectedAvailable = Number(active?.availableAmount ?? 0) + Number(replenishAmount ?? 0)

  if (mode === 'replenish' && active) {
    return (
      <div className="guarantee-workbench guarantee-action-page">
        <button type="button" className="guarantee-back" onClick={() => setMode('list')}>
          <ArrowLeftOutlined /> 返回保证金账户
        </button>
        <section className="guarantee-action-hero">
          <span className="guarantee-action-icon"><PlusOutlined /></span>
          <div><small>GUARANTEE REPLENISHMENT</small><h2>补缴保证金</h2><p>{active.guaranteeNo} · {active.merchantName}</p></div>
          <span className={`mc-tag ${statusMeta(active.guaranteeStatus).tone}`}>{statusMeta(active.guaranteeStatus).text}</span>
        </section>
        <div className="guarantee-action-layout">
          <Panel title="补缴信息">
            <Form form={form} layout="vertical" onFinish={() => void submitReplenish()} className="guarantee-form">
              <div className="guarantee-account-strip">
                <div><span>保证金总额</span><strong>{money(active.totalAmount)}</strong></div>
                <div><span>当前可用</span><strong>{money(active.availableAmount)}</strong></div>
                <div><span>当前冻结</span><strong>{money(active.frozenAmount)}</strong></div>
              </div>
              <Form.Item name="amount" label="补缴金额（元）" rules={[{ required: true, message: '请输入补缴金额' }]}>
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入大于 0 的补缴金额" />
              </Form.Item>
              <div className="guarantee-quick-amounts" aria-label="快捷补缴金额">
                <span>快捷金额</span>
                {[100, 500, 1000, 5000].map((value) => (
                  <button type="button" key={value} onClick={() => form.setFieldValue('amount', value)}>
                    ¥{value.toLocaleString('zh-CN')}
                  </button>
                ))}
              </div>
              <Form.Item name="reason" label="补缴说明">
                <Input.TextArea rows={4} placeholder="例如：按平台要求补足交易保证金" showCount maxLength={200} />
              </Form.Item>
              <div className="guarantee-replenish-preview">
                <div><span>本次补缴</span><strong>{money(replenishAmount ?? 0)}</strong></div>
                <div><span>补缴后可用</span><strong>{money(projectedAvailable)}</strong></div>
                <p>提交成功后，补缴金额会即时计入当前经营主体的可用保证金，并生成可追溯流水。</p>
              </div>
              <div className="guarantee-actions">
                <button type="submit" className="mc-btn" disabled={submitting}>{submitting ? '正在提交…' : '确认补缴'}</button>
                <button type="button" className="mc-btn ghost" onClick={() => setMode('list')}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside className="guarantee-action-aside">
            <Panel title="补缴说明">
              <ul className="guarantee-guidance">
                <li><CheckCircleOutlined /> 补缴金额会同时增加保证金总额与可用金额。</li>
                <li><FileTextOutlined /> 每次补缴都会生成一条完整资金流水。</li>
                <li><SafetyCertificateOutlined /> 补缴只对生效中的账户开放。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (mode === 'logs' && active) {
    return (
      <div className="guarantee-workbench guarantee-action-page">
        <button type="button" className="guarantee-back" onClick={() => setMode('list')}>
          <ArrowLeftOutlined /> 返回保证金账户
        </button>
        <section className="guarantee-action-hero">
          <span className="guarantee-action-icon"><FileTextOutlined /></span>
          <div><small>GUARANTEE LEDGER · {active.guaranteeNo}</small><h2>保证金流水</h2><p>{active.merchantName} · {TYPE[active.guaranteeType] ?? active.guaranteeType}</p></div>
          <span className={`mc-tag ${statusMeta(active.guaranteeStatus).tone}`}>{statusMeta(active.guaranteeStatus).text}</span>
        </section>
        <div className="guarantee-log-summary">
          <div><span>总额</span><strong>{money(active.totalAmount)}</strong></div>
          <div><span>可用</span><strong>{money(active.availableAmount)}</strong></div>
          <div><span>冻结</span><strong>{money(active.frozenAmount)}</strong></div>
          <div><span>已用于赔付</span><strong>{money(active.usedAmount)}</strong></div>
        </div>
        <Panel title={`资金流水（${logs.length}）`} extra={
          active.guaranteeStatus === 'active'
            ? <button type="button" className="mc-btn" onClick={() => openReplenish(active)}><PlusOutlined /> 补缴</button>
            : null
        }>
          {logsLoading ? (
            <div className="guarantee-loading"><Spin /><span>正在读取资金流水…</span></div>
          ) : logs.length === 0 ? (
            <EmptyState title="暂无资金流水" desc="账户审核、补缴、冻结或解冻后，会在这里形成可追溯记录。" />
          ) : (
            <div className="guarantee-log-list">
              {logs.map((log) => (
                <div className="guarantee-log" key={log.id}>
                  <span className={`guarantee-log-icon ${log.action}`}><FileTextOutlined /></span>
                  <div>
                    <span className="guarantee-log-action">{ACTION[log.action] ?? log.action}</span>
                    <strong>{log.reason || '无备注'}</strong>
                    <small>{log.operator || 'system'} · {shortDate(log.createTime)}</small>
                  </div>
                  <div className="guarantee-log-amount">
                    <strong className={log.action === 'replenish' || log.action === 'unfreeze' ? 'increase' : log.action === 'deduct' || log.action === 'freeze' ? 'decrease' : ''}>
                      {log.action === 'freeze' || log.action === 'deduct' ? '-' : log.action === 'replenish' || log.action === 'unfreeze' ? '+' : ''}{money(log.amount)}
                    </strong>
                    <span>可用 {money(log.availableBefore)} → {money(log.availableAfter)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    )
  }

  return (
    <div className="guarantee-workbench">
      <div className="guarantee-overview-head">
        <div className="guarantee-overview-copy"><strong>我的保证金账户</strong><span>用于订单履约、纠纷赔付和平台信用保障</span></div>
        <div className="guarantee-overview-actions">
          <span>共 {rows.length} 个账户 · {effectiveRows.length} 个生效中</span>
          <button type="button" className="mc-btn ghost" onClick={() => void load()} disabled={loading}>
            <ReloadOutlined /> 刷新
          </button>
        </div>
      </div>
      <div className="guarantee-metrics">
        <div><span>保证金总额</span><strong>{money(total)}</strong><small>账户累计担保金额</small></div>
        <div><span>可用金额</span><strong>{money(available)}</strong><small>可用于新增交易保障</small></div>
        <div><span>冻结金额</span><strong>{money(frozen)}</strong><small>订单或纠纷暂时占用</small></div>
        <div><span>已用于赔付</span><strong>{money(used)}</strong><small>累计扣划赔付金额</small></div>
      </div>
      {loading ? (
        <div className="guarantee-loading"><Spin /><span>正在读取保证金账户…</span></div>
      ) : rows.length === 0 ? (
        <Panel><EmptyState title="暂无保证金账户" desc="保证金账户由平台运营审核开立，完成后会在这里展示余额和流水。" /></Panel>
      ) : (
        <div className="guarantee-account-list">
          {rows.map((row) => {
            const status = statusMeta(row.guaranteeStatus)
            return (
              <div className={`guarantee-account-card ${row.guaranteeStatus}`} key={row.id}>
                <div className="guarantee-account-head">
                  <span className="guarantee-account-icon"><WalletOutlined /></span>
                  <div><small>账户编号 · {row.guaranteeNo}</small><strong>{row.merchantName || '当前经营主体'}</strong><p>{TYPE[row.guaranteeType] ?? row.guaranteeType}</p></div>
                  <span className={`mc-tag ${status.tone}`}>{status.text}</span>
                </div>
                <div className="guarantee-account-balances">
                  <div><span>总额</span><strong>{money(row.totalAmount)}</strong></div>
                  <div><span>可用</span><strong>{money(row.availableAmount)}</strong></div>
                  <div><span>冻结</span><strong>{money(row.frozenAmount)}</strong></div>
                  <div><span>已用</span><strong>{money(row.usedAmount)}</strong></div>
                </div>
                <div className="guarantee-account-meta">
                  <span><ClockCircleOutlined /> 到期时间 {shortDate(row.expireTime)}</span>
                  <span><SafetyCertificateOutlined /> {row.verifiedBy ? `审核人 ${row.verifiedBy}` : '等待平台审核'}</span>
                </div>
                <div className="guarantee-account-actions">
                  <button type="button" className="mc-btn ghost" onClick={() => void openLogs(row)}>
                    <EyeOutlined /> 查看流水
                  </button>
                  {row.guaranteeStatus === 'active' && (
                    <button type="button" className="mc-btn" onClick={() => openReplenish(row)}>
                      <PlusOutlined /> 补缴保证金
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="guarantee-note">
        <ShopOutlined />
        <div><strong>资金安全说明</strong><span>冻结与扣划由平台按订单或纠纷规则执行，所有余额变化均保留操作人、原因及变动前后金额。</span></div>
      </div>
    </div>
  )
}
