import { useEffect, useMemo, useState } from 'react'
import { Checkbox, Form, Image, Input, Radio, Select, Spin, Upload, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileProtectOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveContract,
  getContractById,
  getContractList,
  signContract,
  uploadContractEvidence,
  type ContractQuery,
  type ContractVO,
} from '@/api/contract'
import { getMyMerchants } from '@/api/identity'
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared'
import './contract-management.css'

type PageMode = 'list' | 'detail' | 'sign'

const CONTRACT_STATUS: Record<string, { text: string; tone: string }> = {
  draft: { text: '待签署', tone: 'amber' },
  pending: { text: '待生效', tone: 'amber' },
  signed: { text: '已签署', tone: 'green' },
  effective: { text: '生效中', tone: 'green' },
  cancelled: { text: '已取消', tone: 'ghost' },
  expired: { text: '已到期', tone: 'ghost' },
  completed: { text: '已完成', tone: 'green' },
}

const SIGN_STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待签署', tone: 'amber' },
  signed: { text: '已签署', tone: 'green' },
  rejected: { text: '已拒签', tone: 'red' },
}

function statusMeta(
  map: Record<string, { text: string; tone: string }>,
  value: string,
): { text: string; tone: string } {
  return map[value] ?? { text: value || '未知', tone: 'ghost' }
}

function StatusPill({
  map,
  value,
}: {
  map: Record<string, { text: string; tone: string }>
  value: string
}): JSX.Element {
  const meta = statusMeta(map, value)
  return <span className={`mc-tag ${meta.tone}`}>{meta.text}</span>
}

function signatureInfo(value?: string | null): {
  mode: 'online' | 'offline' | 'legacy'
  signer: string
  url: string
} | null {
  if (!value) return null
  const [mode, signer, url] = value.split('|')
  if ((mode === 'ONLINE' || mode === 'OFFLINE') && url) {
    return { mode: mode === 'ONLINE' ? 'online' : 'offline', signer: signer || '', url }
  }
  return { mode: 'legacy', signer: '', url: '' }
}

function SignatureEvidence({ value }: { value?: string | null }): JSX.Element {
  const info = signatureInfo(value)
  if (!info) return <span className="contract-muted">尚未签署</span>
  if (info.mode === 'legacy') return <span className="contract-muted">历史在线签署</span>
  return (
    <div className="contract-evidence">
      <span className="contract-evidence-icon">
        {info.mode === 'online' ? <SafetyCertificateOutlined /> : <FileProtectOutlined />}
      </span>
      <div>
        <strong>{info.mode === 'online' ? '在线电子签章' : '线下签署文件'}</strong>
        <small>{info.signer || '经办人已确认'}</small>
        <a href={info.url} target="_blank" rel="noreferrer">
          {info.mode === 'online' ? '查看签章' : '查看签署文件'}
        </a>
      </div>
    </div>
  )
}

function PartyMark({ side }: { side: 'buyer' | 'seller' }): JSX.Element {
  return <span className={`contract-party-mark ${side}`}>{side === 'buyer' ? '买' : '卖'}</span>
}

/**
 * 会员中心合同工作区。
 *
 * 合同列表、详情与签署是两个中心共用的页面级工作区，不是后台弹窗。
 * 数据范围、签署方和存证仍由服务端按当前经营主体判定。
 */
export default function ContractManagement(): JSX.Element {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<ContractQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ contractNo?: string; contractStatus?: string }>({})
  const [pageMode, setPageMode] = useState<PageMode>('list')
  const [activeContract, setActiveContract] = useState<ContractVO | null>(null)
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])
  const [signing, setSigning] = useState(false)
  const [signMode, setSignMode] = useState<'online' | 'offline'>('online')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceName, setEvidenceName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [signForm] = Form.useForm()

  useEffect(() => {
    getMyMerchants()
      .then((response) => {
        if (response?.code === 200) {
          setMyMerchantIds((response.data ?? []).map((item) => String(item.merchantId)))
        }
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  const isBuyer = (row: ContractVO): boolean =>
    row.buyerId != null && myMerchantIds.includes(String(row.buyerId))
  const isSeller = (row: ContractVO): boolean =>
    row.sellerId != null && myMerchantIds.includes(String(row.sellerId))
  const canSign = (row: ContractVO): boolean =>
    row.contractStatus !== 'cancelled'
    && ((isBuyer(row) && row.buyerSignStatus !== 'signed')
      || (isSeller(row) && row.sellerSignStatus !== 'signed'))

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', query],
    queryFn: () => getContractList(query),
  })
  const rows: ContractVO[] = data?.data?.records ?? []
  const total = Number(data?.data?.total ?? 0)
  const currentPage = Number(data?.data?.current ?? query.pageNum ?? 1)
  const pageCount = Math.max(1, Math.ceil(total / Number(query.pageSize ?? 10)))
  const pageStats = useMemo(() => ({
    waiting: rows.filter(canSign).length,
    signed: rows.filter((item) => item.contractStatus === 'signed').length,
    archived: rows.filter((item) => item.archiveStatus === 'archived').length,
  }), [rows, myMerchantIds])

  const showList = (): void => {
    setPageMode('list')
    setActiveContract(null)
  }

  const showDetail = (row: ContractVO): void => {
    setActiveContract(row)
    setPageMode('detail')
  }

  const showSign = (row: ContractVO): void => {
    setActiveContract(row)
    setPageMode('sign')
    setSignMode('online')
    setEvidenceUrl('')
    setEvidenceName('')
    signForm.resetFields()
    signForm.setFieldsValue({
      signMode: 'online',
      signerName: isBuyer(row) ? row.buyerName : row.sellerName,
      confirmed: false,
    })
  }

  const refreshActiveContract = async (id: number): Promise<void> => {
    try {
      const response = await getContractById(id)
      if (response?.code === 200 && response.data) setActiveContract(response.data)
    } catch {
      // 列表仍会通过 queryClient 刷新，详情保持当前内容即可。
    }
  }

  const handleEvidenceUpload = async (file: File): Promise<void> => {
    if (!activeContract) return
    setUploading(true)
    try {
      const response = await uploadContractEvidence(activeContract.id, signMode, file)
      if (response?.code === 200 && response.data?.url) {
        setEvidenceUrl(response.data.url)
        setEvidenceName(response.data.originalName || file.name)
        message.success(signMode === 'online' ? '电子签章上传成功' : '线下签署文件上传成功')
      } else {
        message.error(response?.message ?? '签署文件上传失败')
      }
    } catch {
      message.error('签署文件上传失败（请检查后端是否在运行）')
    } finally {
      setUploading(false)
    }
  }

  const handleSign = async (): Promise<void> => {
    if (!activeContract) return
    const values = await signForm.validateFields()
    if (!evidenceUrl) {
      message.warning(signMode === 'online' ? '请先上传电子签章' : '请先上传线下签署合同文件')
      return
    }
    setSigning(true)
    try {
      const response = await signContract(activeContract.id, {
        signMode,
        signerName: values.signerName,
        evidenceUrl,
        confirmed: values.confirmed,
      })
      if (response?.code === 200) {
        message.success(signMode === 'online' ? '在线电子签章完成' : '线下签署确认完成')
        await queryClient.invalidateQueries({ queryKey: ['contracts'] })
        await refreshActiveContract(activeContract.id)
        setPageMode('detail')
      } else {
        message.error(response?.message ?? '签署失败')
      }
    } catch {
      message.error('签署失败（请检查后端是否在运行）')
    } finally {
      setSigning(false)
    }
  }

  const handleArchive = async (row: ContractVO): Promise<void> => {
    if (!window.confirm(`确认归档合同 ${row.contractNo}？归档后合同仍可查看。`)) return
    try {
      const response = await archiveContract(row.id)
      if (response?.code === 200) {
        message.success('合同已归档')
        await queryClient.invalidateQueries({ queryKey: ['contracts'] })
        if (activeContract?.id === row.id) await refreshActiveContract(row.id)
      } else {
        message.error(response?.message ?? '归档失败')
      }
    } catch {
      message.error('归档失败（请检查后端是否在运行）')
    }
  }

  if (pageMode === 'detail' && activeContract) {
    const contractState = statusMeta(CONTRACT_STATUS, activeContract.contractStatus)
    return (
      <div className="contract-page contract-detail-page">
        <button type="button" className="contract-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回合同列表
        </button>
        <section className="contract-detail-hero">
          <div className="contract-detail-icon"><FileProtectOutlined /></div>
          <div className="contract-detail-title">
            <span>电子合同 · {activeContract.contractNo}</span>
            <h2>{activeContract.contractName || '采购合同'}</h2>
            <p>关联订单 {activeContract.orderNo || activeContract.orderId || '—'} · 创建于 {shortDate(activeContract.createTime)}</p>
          </div>
          <span className={`mc-tag ${contractState.tone}`}>{contractState.text}</span>
          <div className="contract-detail-hero-actions">
            {canSign(activeContract) && (
              <button type="button" className="mc-btn" onClick={() => showSign(activeContract)}>
                <EditOutlined /> 立即签署
              </button>
            )}
            {activeContract.archiveStatus !== 'archived' && (
              <button type="button" className="mc-btn ghost" onClick={() => void handleArchive(activeContract)}>
                <InboxOutlined /> 归档
              </button>
            )}
          </div>
        </section>

        <div className="contract-detail-layout">
          <div className="contract-detail-main">
            <Panel title="合同主体">
              <div className="contract-party-grid">
                <div className="contract-party-card">
                  <PartyMark side="buyer" />
                  <div><span>采购方</span><strong>{activeContract.buyerName || '—'}</strong><small>经营主体 ID {String(activeContract.buyerId ?? '—')}</small></div>
                  <StatusPill map={SIGN_STATUS} value={activeContract.buyerSignStatus} />
                </div>
                <div className="contract-party-link"><span>↔</span><small>合同双方</small></div>
                <div className="contract-party-card">
                  <PartyMark side="seller" />
                  <div><span>供货方</span><strong>{activeContract.sellerName || '—'}</strong><small>经营主体 ID {String(activeContract.sellerId ?? '—')}</small></div>
                  <StatusPill map={SIGN_STATUS} value={activeContract.sellerSignStatus} />
                </div>
              </div>
            </Panel>

            <Panel title="交易条款">
              <div className="contract-terms-grid">
                <div><span>合同金额</span><strong className="contract-amount">{money(activeContract.contractAmount)}</strong></div>
                <div><span>关联订单</span><strong>{activeContract.orderNo || activeContract.orderId || '—'}</strong></div>
                <div><span>交付地址</span><strong>{activeContract.deliveryAddress || '—'}</strong></div>
                <div><span>约定交期</span><strong>{shortDate(activeContract.deliveryDate)}</strong></div>
                <div><span>合同类型</span><strong>{activeContract.contractType === 'sale' ? '采购销售合同' : activeContract.contractType || '—'}</strong></div>
                <div><span>归档状态</span><strong>{activeContract.archiveStatus === 'archived' ? '已归档' : '未归档'}</strong></div>
              </div>
            </Panel>

            <Panel title="签署记录">
              <div className="contract-signature-grid">
                <div className="contract-signature-card">
                  <div className="contract-signature-head">
                    <PartyMark side="buyer" />
                    <div><strong>采购方签署</strong><span>{activeContract.buyerName || '—'}</span></div>
                    <StatusPill map={SIGN_STATUS} value={activeContract.buyerSignStatus} />
                  </div>
                  <SignatureEvidence value={activeContract.buyerSignature} />
                  <small>签署时间：{shortDate(activeContract.buyerSignTime)}</small>
                </div>
                <div className="contract-signature-card">
                  <div className="contract-signature-head">
                    <PartyMark side="seller" />
                    <div><strong>供货方签署</strong><span>{activeContract.sellerName || '—'}</span></div>
                    <StatusPill map={SIGN_STATUS} value={activeContract.sellerSignStatus} />
                  </div>
                  <SignatureEvidence value={activeContract.sellerSignature} />
                  <small>签署时间：{shortDate(activeContract.sellerSignTime)}</small>
                </div>
              </div>
            </Panel>

            <Panel title="合同正文">
              <div className="contract-content">
                {activeContract.contractContent || '本合同由平台按订单成交信息生成，具体商品、数量、金额与交付要求以订单及双方确认内容为准。'}
              </div>
            </Panel>
          </div>

          <aside className="contract-detail-aside">
            <Panel title="签约进度">
              <div className="contract-timeline">
                <div className="on"><span><CheckCircleOutlined /></span><div><strong>合同已生成</strong><small>{shortDate(activeContract.createTime)}</small></div></div>
                <div className={activeContract.buyerSignStatus === 'signed' ? 'on' : ''}><span><ClockCircleOutlined /></span><div><strong>采购方签署</strong><small>{activeContract.buyerSignStatus === 'signed' ? shortDate(activeContract.buyerSignTime) : '等待采购方签署'}</small></div></div>
                <div className={activeContract.sellerSignStatus === 'signed' ? 'on' : ''}><span><ClockCircleOutlined /></span><div><strong>供货方签署</strong><small>{activeContract.sellerSignStatus === 'signed' ? shortDate(activeContract.sellerSignTime) : '等待供货方签署'}</small></div></div>
                <div className={activeContract.contractStatus === 'signed' ? 'on' : ''}><span><SafetyCertificateOutlined /></span><div><strong>合同生效</strong><small>{activeContract.effectiveDate ? shortDate(activeContract.effectiveDate) : '双方签署后生效'}</small></div></div>
              </div>
            </Panel>
            <Panel title="存证信息">
              <div className="contract-hash-list">
                <div><span>合同哈希</span><code>{activeContract.contractHash || '签署生成'}</code></div>
                <div><span>存证哈希</span><code>{activeContract.chainTxHash || '双方签署后生成'}</code></div>
                <div><span>存证状态</span><strong>{activeContract.chainStatus === 'success' ? '存证成功' : '待存证'}</strong></div>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  if (pageMode === 'sign' && activeContract) {
    return (
      <div className="contract-page contract-sign-page">
        <button type="button" className="contract-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回合同详情
        </button>
        <div className="contract-sign-heading">
          <div className="contract-detail-icon"><EditOutlined /></div>
          <div>
            <span>合同签署</span>
            <h2>{activeContract.contractName || '采购合同'}</h2>
            <p>{activeContract.contractNo} · {money(activeContract.contractAmount)}</p>
          </div>
          <span className="mc-tag amber">待我方签署</span>
        </div>

        <div className="contract-sign-layout">
          <Panel title="选择签署方式" className="contract-sign-form-panel">
            <Form form={signForm} layout="vertical" onFinish={() => void handleSign()}>
              <Form.Item name="signMode" rules={[{ required: true }]}>
                <Radio.Group
                  className="contract-method-group"
                  onChange={(event) => {
                    setSignMode(event.target.value)
                    setEvidenceUrl('')
                    setEvidenceName('')
                  }}
                >
                  <Radio value="online" className="contract-method-card">
                    <span className="contract-method-icon"><SafetyCertificateOutlined /></span>
                    <span><strong>在线电子签章</strong><small>上传公章、合同专用章或个人签名图片，在线确认完成签署</small></span>
                  </Radio>
                  <Radio value="offline" className="contract-method-card">
                    <span className="contract-method-icon"><FileProtectOutlined /></span>
                    <span><strong>线下签署</strong><small>上传双方签字盖章后的合同扫描件或 PDF，确认归档</small></span>
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="signerName"
                label={signMode === 'online' ? '签章主体 / 经办人' : '线下签署经办人'}
                rules={[{ required: true, message: '请填写签署人' }]}
              >
                <Input placeholder="请输入实际签署人或经办人姓名" />
              </Form.Item>

              <Form.Item label={signMode === 'online' ? '电子签章图片' : '线下签署合同文件'} required>
                <div className="contract-upload-zone">
                  <span className="contract-upload-icon"><UploadOutlined /></span>
                  <div>
                    <strong>{signMode === 'online' ? '上传清晰的电子签章' : '上传已签署合同扫描件'}</strong>
                    <small>{signMode === 'online' ? '支持 PNG、JPG、JPEG、WEBP，文件不超过 5MB' : '支持 PDF、PNG、JPG、JPEG、WEBP，文件不超过 5MB'}</small>
                  </div>
                  <Upload
                    accept={signMode === 'online' ? '.png,.jpg,.jpeg,.webp' : '.pdf,.png,.jpg,.jpeg,.webp'}
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleEvidenceUpload(file as File)
                      return false
                    }}
                  >
                    <button type="button" className="mc-btn ghost">{uploading ? '上传中…' : '选择文件'}</button>
                  </Upload>
                </div>
                {evidenceUrl && (
                  <div className="contract-upload-preview">
                    {signMode === 'online' && <Image src={evidenceUrl} width={92} height={62} alt="电子签章预览" />}
                    <div><strong>{evidenceName}</strong><a href={evidenceUrl} target="_blank" rel="noreferrer">查看已上传文件</a></div>
                    <span className="mc-tag green">已上传</span>
                  </div>
                )}
              </Form.Item>

              <Form.Item
                name="confirmed"
                valuePropName="checked"
                rules={[{
                  validator: (_, checked) => checked
                    ? Promise.resolve()
                    : Promise.reject(new Error('请确认已核对合同内容')),
                }]}
              >
                <Checkbox>我已核对合同主体、金额和条款，确认以当前经营主体完成本次签署</Checkbox>
              </Form.Item>

              <div className="contract-sign-actions">
                <button type="submit" className="mc-btn" disabled={signing || uploading}>
                  <SafetyCertificateOutlined /> {signing ? '正在签署…' : '确认签署'}
                </button>
                <button type="button" className="mc-btn ghost" onClick={() => setPageMode('detail')}>取消</button>
              </div>
            </Form>
          </Panel>

          <aside className="contract-sign-summary">
            <Panel title="合同概要">
              <div className="contract-summary-contract">
                <span>{activeContract.contractNo}</span>
                <strong>{activeContract.contractName || '采购合同'}</strong>
                <em>{money(activeContract.contractAmount)}</em>
              </div>
              <div className="contract-summary-parties">
                <div><PartyMark side="buyer" /><span>采购方</span><strong>{activeContract.buyerName}</strong></div>
                <div><PartyMark side="seller" /><span>供货方</span><strong>{activeContract.sellerName}</strong></div>
              </div>
            </Panel>
            <Panel title="签署提示">
              <div className="contract-tips">
                <p><CheckCircleOutlined /> 签署方由系统按当前经营主体自动判定，不能替代对方签署。</p>
                <p><FileProtectOutlined /> 签署文件会与合同内容一起留痕，双方签署完成后生成存证哈希。</p>
                <p><ShopOutlined /> 线下签署请确保上传文件包含双方签字或盖章页。</p>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="contract-page">
      <section className="contract-overview">
        <div className="contract-overview-title">
          <span className="contract-overview-icon"><FileProtectOutlined /></span>
          <div><span>TRADE CONTRACTS</span><h2>合同管理</h2><p>统一管理采购合同、双方签署证据与平台存证记录。</p></div>
        </div>
        <div className="contract-overview-stats">
          <div><span>合同总数</span><strong>{total}</strong></div>
          <div><span>本页待签</span><strong>{pageStats.waiting}</strong></div>
          <div><span>本页已签</span><strong>{pageStats.signed}</strong></div>
          <div><span>本页已归档</span><strong>{pageStats.archived}</strong></div>
        </div>
      </section>

      <Panel
        title="合同档案"
        extra={<span className="contract-count">共 {total} 份</span>}
      >
        <div className="contract-toolbar">
          <Input
            placeholder="输入合同编号搜索"
            prefix={<SearchOutlined />}
            value={draft.contractNo}
            allowClear
            onChange={(event) => setDraft((previous) => ({
              ...previous,
              contractNo: event.target.value || undefined,
            }))}
          />
          <Select
            placeholder="全部合同状态"
            allowClear
            value={draft.contractStatus}
            onChange={(value) => setDraft((previous) => ({ ...previous, contractStatus: value }))}
            options={Object.entries(CONTRACT_STATUS).map(([value, item]) => ({
              value,
              label: item.text,
            }))}
          />
          <button type="button" className="mc-btn" onClick={() => setQuery((previous) => ({
            ...previous,
            pageNum: 1,
            ...draft,
          }))}>
            搜索
          </button>
          <button type="button" className="mc-btn ghost" onClick={() => {
            setDraft({})
            setQuery({ pageNum: 1, pageSize: 10 })
          }}>
            重置
          </button>
        </div>

        {isLoading ? (
          <div className="contract-loading"><Spin /><span>正在读取合同档案…</span></div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="还没有合同"
            desc="报价成交后系统会自动生成待签合同；线下合同可由交易双方上传签署。"
          />
        ) : (
          <>
            <div className="mc-table-wrap">
              <table className="mc-table contract-table">
                <thead>
                  <tr>
                    <th>合同名称 / 编号</th>
                    <th>交易双方</th>
                    <th>合同金额</th>
                    <th>双方签署</th>
                    <th>合同状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button type="button" className="contract-name-link" onClick={() => showDetail(row)}>
                          <strong>{row.contractName || '采购合同'}</strong>
                          <span className="mc-mono">{row.contractNo}</span>
                        </button>
                      </td>
                      <td>
                        <div className="contract-parties-cell">
                          <div><PartyMark side="buyer" /><span>{row.buyerName || '—'}</span></div>
                          <div><PartyMark side="seller" /><span>{row.sellerName || '—'}</span></div>
                        </div>
                      </td>
                      <td><span className="mc-price">{money(row.contractAmount)}</span></td>
                      <td>
                        <div className="contract-progress">
                          <div><span>买方</span><StatusPill map={SIGN_STATUS} value={row.buyerSignStatus} /></div>
                          <div><span>卖方</span><StatusPill map={SIGN_STATUS} value={row.sellerSignStatus} /></div>
                        </div>
                      </td>
                      <td><StatusPill map={CONTRACT_STATUS} value={row.contractStatus} /></td>
                      <td className="mc-mono mc-xs">{shortDate(row.createTime)}</td>
                      <td>
                        <div className="mc-actions">
                          <button type="button" className="mc-link contract-action-link" onClick={() => showDetail(row)}>
                            <EyeOutlined /> 查看
                          </button>
                          {canSign(row) && (
                            <button type="button" className="mc-link contract-action-link" onClick={() => showSign(row)}>
                              <EditOutlined /> 签署
                            </button>
                          )}
                          {row.archiveStatus !== 'archived' && (isBuyer(row) || isSeller(row)) && (
                            <button type="button" className="mc-link contract-action-link" onClick={() => void handleArchive(row)}>
                              <InboxOutlined /> 归档
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mc-pager contract-pager">
              <button type="button" disabled={currentPage <= 1}
                onClick={() => setQuery((previous) => ({ ...previous, pageNum: currentPage - 1 }))}>上一页</button>
              <span>第 {currentPage} / {pageCount} 页 · 共 {total} 份合同</span>
              <button type="button" disabled={currentPage >= pageCount}
                onClick={() => setQuery((previous) => ({ ...previous, pageNum: currentPage + 1 }))}>下一页</button>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
