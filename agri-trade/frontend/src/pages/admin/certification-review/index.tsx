import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Descriptions, Drawer, Empty, Input, Modal, Space, Table, Tag, Typography, message
} from 'antd'
import { AuditOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { auditCertification, getCertifications, type CertificationRow } from '@/api/certification'
import { getUserIdentityPage, reviewUserIdentity, type RealNameRecord } from '@/api/identity'
import './certification-review.css'

type ReviewType = 'enterprise' | 'personal'
type ReviewStatus = 'pending' | 'approved' | 'rejected'

interface ReviewItem {
  key: string
  id: number | string
  type: ReviewType
  no: string
  name: string
  idNumber: string
  contact: string
  phone: string
  status: ReviewStatus
  submitTime: string
  reviewer: string | null
  reviewTime: string | null
  reviewRemark: string | null
  raw: CertificationRow | RealNameRecord
}

const STATUS_TEXT: Record<ReviewStatus, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' }
}

function enterpriseItem(row: CertificationRow): ReviewItem {
  return {
    key: `enterprise-${row.id}`,
    id: row.id,
    type: 'enterprise',
    no: row.certNo,
    name: row.companyName || row.merchantName || '—',
    idNumber: row.creditCode || '—',
    contact: row.contactName || '—',
    phone: row.contactPhone || '—',
    status: row.certStatus === 'approved' ? 'approved' : row.certStatus === 'rejected' ? 'rejected' : 'pending',
    submitTime: row.submitTime,
    reviewer: row.reviewer,
    reviewTime: row.reviewTime,
    reviewRemark: row.reviewRemark,
    raw: row
  }
}

function personalItem(row: RealNameRecord): ReviewItem {
  return {
    key: `personal-${row.id}`,
    id: row.id,
    type: 'personal',
    no: row.identityNo,
    name: row.realName || '—',
    idNumber: row.idNoMasked || '—',
    contact: row.realName || '—',
    phone: '—',
    status: row.status === 'verified' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending',
    submitTime: row.submitTime,
    reviewer: row.reviewerName,
    reviewTime: row.reviewTime,
    reviewRemark: row.reviewRemark,
    raw: row
  }
}

const isToday = (value: string | null | undefined): boolean => {
  if (!value) return false
  const text = value.slice(0, 10)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return text === today
}

export default function CertificationReview(): JSX.Element {
  const [rows, setRows] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | ReviewType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all')
  const [keyword, setKeyword] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [detail, setDetail] = useState<ReviewItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [rejectTargets, setRejectTargets] = useState<ReviewItem[] | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [enterprise, personal] = await Promise.all([
        getCertifications({ pageNum: 1, pageSize: 200 }),
        getUserIdentityPage({ pageNum: 1, pageSize: 200 }),
      ])
      const list: ReviewItem[] = []
      if (enterprise?.code === 0) {
        list.push(...(enterprise.data?.records ?? []).map(enterpriseItem))
      }
      if (personal?.code === 0) {
        const records = (personal.data?.records ?? []) as RealNameRecord[]
        list.push(...records.map(personalItem))
      }
      list.sort((a, b) => String(b.submitTime ?? '').localeCompare(String(a.submitTime ?? '')))
      setRows(list)
      if (enterprise?.code !== 0 || personal?.code !== 0) {
        message.warning('部分认证数据加载失败，请检查 core-platform')
      }
    } catch {
      message.error('加载认证审核数据失败（请检查 core-platform 是否在运行）')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return rows.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!text) return true
      return [item.no, item.name, item.idNumber, item.contact, item.phone]
        .some((value) => String(value ?? '').toLowerCase().includes(text))
    })
  }, [rows, typeFilter, statusFilter, keyword])

  const pendingRows = filtered.filter((item) => item.status === 'pending')
  const counts = {
    pending: rows.filter((item) => item.status === 'pending').length,
    enterprisePending: rows.filter((item) => item.status === 'pending' && item.type === 'enterprise').length,
    personalPending: rows.filter((item) => item.status === 'pending' && item.type === 'personal').length,
    passedToday: rows.filter((item) => item.status === 'approved' && isToday(item.reviewTime)).length,
    rejectedToday: rows.filter((item) => item.status === 'rejected' && isToday(item.reviewTime)).length,
  }

  const approve = async (item: ReviewItem): Promise<boolean> => {
    try {
      const res = item.type === 'enterprise'
        ? await auditCertification(item.id, 'approved', '材料齐全，审核通过')
        : await reviewUserIdentity(item.id, true, '材料齐全，审核通过')
      if (res?.code === 0) return true
      message.error(res?.message ?? '审核失败')
      return false
    } catch {
      message.error('审核失败（请检查后端是否在运行）')
      return false
    }
  }

  const reject = async (item: ReviewItem, reason: string): Promise<boolean> => {
    try {
      const res = item.type === 'enterprise'
        ? await auditCertification(item.id, 'rejected', reason)
        : await reviewUserIdentity(item.id, false, reason)
      if (res?.code === 0) return true
      message.error(res?.message ?? '审核失败')
      return false
    } catch {
      message.error('审核失败（请检查后端是否在运行）')
      return false
    }
  }

  const approveOne = async (item: ReviewItem): Promise<void> => {
    setSaving(true)
    const ok = await approve(item)
    setSaving(false)
    if (ok) {
      message.success('已通过')
      setDetail(null)
      await load()
    }
  }

  const batchApprove = (): void => {
    const targets = filtered.filter((item) => selectedKeys.includes(item.key) && item.status === 'pending')
    if (!targets.length) {
      message.warning('请选择待审核的申请')
      return
    }
    Modal.confirm({
      title: `批量通过 ${targets.length} 笔申请？`,
      content: '企业认证会同步更新经营主体的认证状态；个人实名会标记为已认证。',
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        setSaving(true)
        let success = 0
        for (const item of targets) {
          if (await approve(item)) success += 1
        }
        setSaving(false)
        setSelectedKeys([])
        message.success(`已通过 ${success} 笔，失败 ${targets.length - success} 笔`)
        await load()
      }
    })
  }

  const submitReject = async (): Promise<void> => {
    if (!rejectTargets?.length) return
    if (!rejectReason.trim()) {
      message.warning('驳回必须填写原因')
      return
    }
    setSaving(true)
    let success = 0
    for (const item of rejectTargets) {
      if (await reject(item, rejectReason.trim())) success += 1
    }
    setSaving(false)
    message.success(`已驳回 ${success} 笔，失败 ${rejectTargets.length - success} 笔`)
    setRejectTargets(null)
    setRejectReason('')
    setSelectedKeys([])
    setDetail(null)
    await load()
  }

  const batchReject = (): void => {
    const targets = filtered.filter((item) => selectedKeys.includes(item.key) && item.status === 'pending')
    if (!targets.length) {
      message.warning('请选择待审核的申请')
      return
    }
    setRejectReason('')
    setRejectTargets(targets)
  }

  const detailContent = detail && (
    <>
      <div className="cr-detail-head">
        <div>
          <div className="cr-detail-no">{detail.no}</div>
          <Space style={{ marginTop: 8 }}>
            <Tag color={detail.type === 'enterprise' ? 'green' : 'cyan'}>
              {detail.type === 'enterprise' ? '企业认证' : '个人实名认证'}
            </Tag>
            <Tag color={STATUS_TEXT[detail.status].color}>{STATUS_TEXT[detail.status].text}</Tag>
          </Space>
        </div>
      </div>
      {detail.type === 'enterprise' ? (
        <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label="企业名称">{(detail.raw as CertificationRow).companyName}</Descriptions.Item>
          <Descriptions.Item label="经营主体">{(detail.raw as CertificationRow).merchantName}</Descriptions.Item>
          <Descriptions.Item label="统一信用代码">{(detail.raw as CertificationRow).creditCode}</Descriptions.Item>
          <Descriptions.Item label="法定代表人">{(detail.raw as CertificationRow).legalPerson ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="营业执照编号">{(detail.raw as CertificationRow).licenseNo ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="联系人">{(detail.raw as CertificationRow).contactName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{(detail.raw as CertificationRow).contactPhone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="材料说明">{(detail.raw as CertificationRow).attachNote ?? '—'}</Descriptions.Item>
        </Descriptions>
      ) : (
        <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label="真实姓名">{(detail.raw as RealNameRecord).realName}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{(detail.raw as RealNameRecord).idNoMasked}</Descriptions.Item>
          <Descriptions.Item label="号码是否变更">
            {(detail.raw as RealNameRecord).idNoChanged ? '与上次提交不一致' : '与上次一致'}
          </Descriptions.Item>
          <Descriptions.Item label="说明">
            平台不保存身份证明文，运营只能看到掩码；三要素核验需接合规实名服务。
          </Descriptions.Item>
        </Descriptions>
      )}
      <Descriptions bordered column={1} size="small" style={{ marginTop: 12 }}>
        <Descriptions.Item label="提交时间">{detail.submitTime ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="审核人">{detail.reviewer ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="审核时间">{detail.reviewTime ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="审核意见">{detail.reviewRemark ?? '—'}</Descriptions.Item>
      </Descriptions>
      {detail.status === 'pending' && (
        <div className="cr-drawer-actions">
          <Button type="primary" icon={<CheckOutlined />} loading={saving} onClick={() => void approveOne(detail)}>
            审核通过
          </Button>
          <Button danger icon={<CloseOutlined />} onClick={() => {
            setRejectReason('')
            setRejectTargets([detail])
          }}>
            驳回申请
          </Button>
        </div>
      )}
    </>
  )

  return (
    <div className="cr-page">
      <div className="cr-title-row">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>认证审核工作台</Typography.Title>
          <Typography.Text type="secondary">企业与个人实名认证统一审核 · 数据来自 core-platform</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
      </div>

      <div className="cr-kpis">
        <div className="cr-kpi"><span>待审核</span><strong>{counts.pending}</strong><small>全部待处理申请</small></div>
        <div className="cr-kpi tech"><span>企业待审</span><strong>{counts.enterprisePending}</strong><small>经营主体资质</small></div>
        <div className="cr-kpi"><span>个人待审</span><strong>{counts.personalPending}</strong><small>个人实名认证</small></div>
        <div className="cr-kpi green"><span>今日通过</span><strong>{counts.passedToday}</strong><small>按审核时间统计</small></div>
        <div className="cr-kpi red"><span>今日驳回</span><strong>{counts.rejectedToday}</strong><small>按审核时间统计</small></div>
      </div>

      <Card className="cr-filter-card" bordered={false}>
        <div className="cr-filter-row">
          <span className="cr-filter-label">申请类型</span>
          <div className="cr-chips">
            <button type="button" className={typeFilter === 'all' ? 'on' : ''} onClick={() => setTypeFilter('all')}>全部类型</button>
            <button type="button" className={typeFilter === 'enterprise' ? 'on' : ''} onClick={() => setTypeFilter('enterprise')}>企业认证</button>
            <button type="button" className={typeFilter === 'personal' ? 'on' : ''} onClick={() => setTypeFilter('personal')}>个人实名认证</button>
          </div>
        </div>
        <div className="cr-filter-row">
          <span className="cr-filter-label">审核状态</span>
          <div className="cr-chips">
            {[
              { key: 'all', label: '全部状态' },
              { key: 'pending', label: '待审核' },
              { key: 'approved', label: '已通过' },
              { key: 'rejected', label: '已驳回' },
            ].map((item) => (
              <button type="button" key={item.key} className={statusFilter === item.key ? 'on' : ''}
                onClick={() => setStatusFilter(item.key as 'all' | ReviewStatus)}>{item.label}</button>
            ))}
          </div>
        </div>
        <div className="cr-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索主体名称 / 申请编号 / 证件号 / 联系人"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 360 }}
          />
          <span className="cr-spacer" />
          <span className="cr-selected">已选 {selectedKeys.length} 项</span>
          <Button icon={<CheckOutlined />} disabled={!selectedKeys.length} onClick={batchApprove} loading={saving}>
            批量通过
          </Button>
          <Button danger icon={<CloseOutlined />} disabled={!selectedKeys.length} onClick={batchReject}>
            批量驳回
          </Button>
        </div>
      </Card>

      <Card bordered={false}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="审核结论会真实更新认证状态"
          description="企业通过后经营主体变为已认证；个人通过后实名状态变为已认证；驳回必须填写原因。个人身份证只展示掩码，平台不保存明文。"
        />
        <Table
          rowKey="key"
          loading={loading}
          dataSource={filtered}
          scroll={{ x: 1280 }}
          locale={{ emptyText: <Empty description="暂无认证申请" /> }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: setSelectedKeys,
            getCheckboxProps: (row) => ({ disabled: row.status !== 'pending' })
          }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
          columns={[
            { title: '申请编号', dataIndex: 'no', width: 170, render: (value: string) => <span className="cr-mono">{value}</span> },
            {
              title: '类型', dataIndex: 'type', width: 130,
              render: (value: ReviewType) => <Tag color={value === 'enterprise' ? 'green' : 'cyan'}>{value === 'enterprise' ? '企业认证' : '个人实名'}</Tag>
            },
            { title: '主体 / 姓名', dataIndex: 'name', width: 180 },
            { title: '证件 / 信用代码', dataIndex: 'idNumber', width: 190, render: (value: string) => <span className="cr-mono">{value}</span> },
            { title: '联系人', dataIndex: 'contact', width: 110 },
            { title: '手机号', dataIndex: 'phone', width: 125, render: (value: string) => <span className="cr-mono">{value}</span> },
            {
              title: '状态', dataIndex: 'status', width: 100,
              render: (value: ReviewStatus) => <Tag color={STATUS_TEXT[value].color}>{STATUS_TEXT[value].text}</Tag>
            },
            { title: '提交时间', dataIndex: 'submitTime', width: 170, render: (value: string) => <span className="cr-mono">{value ?? '—'}</span> },
            {
              title: '操作', width: 150, fixed: 'right' as const,
              render: (_: unknown, row: ReviewItem) => (
                <Space size={0}>
                  <Button type="link" onClick={() => setDetail(row)}>查看</Button>
                  {row.status === 'pending' && (
                    <Button type="link" icon={<AuditOutlined />} onClick={() => setDetail(row)}>审核</Button>
                  )}
                </Space>
              )
            }
          ]}
        />
        <div className="cr-foot-note">
          当前加载 {rows.length} 条申请；待审核 {pendingRows.length} 条（筛选后）。
        </div>
      </Card>

      <Drawer
        title="认证申请详情"
        width={560}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        destroyOnClose
      >
        {detailContent}
      </Drawer>

      <Modal
        title={rejectTargets && rejectTargets.length > 1 ? `批量驳回 ${rejectTargets.length} 笔申请` : '驳回认证申请'}
        open={Boolean(rejectTargets?.length)}
        onCancel={() => { setRejectTargets(null); setRejectReason('') }}
        onOk={() => void submitReject()}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        confirmLoading={saving}
      >
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="驳回必须说明具体原因" description="申请人会按这条意见补正材料，同一原因会应用到本批全部申请。" />
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="例如：营业执照与统一社会信用代码不一致，请重新提交"
        />
      </Modal>
    </div>
  )
}
