import { useEffect, useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ucApi } from '../api'
import {
  ErrorBlock,
  IDENTITY_TYPE_LABEL,
  PageTitle,
  StatusTag,
  formatTime,
} from '../components/ui'
import type { CertificationRecord, IdentityApplication, IdentityRecord } from '../types'

/** 审核动作的公共弹窗：通过/驳回 + 意见。三个审核页共用，避免各写一套。 */
function useReview() {
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null)
  const [approved, setApproved] = useState(true)
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const open = (id: string, title: string, pass = true): void => {
    setTarget({ id, title })
    setApproved(pass)
    setRemark('')
  }

  const close = (): void => setTarget(null)

  return { target, approved, setApproved, remark, setRemark, submitting, setSubmitting, open, close }
}

function ReviewModal({
  state,
  onSubmit,
  okText = '提交审核',
}: {
  state: ReturnType<typeof useReview>
  onSubmit: (approved: boolean, remark: string) => Promise<void>
  okText?: string
}): JSX.Element {
  const submit = (): void => {
    state.setSubmitting(true)
    onSubmit(state.approved, state.remark)
      .then(() => state.close())
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => state.setSubmitting(false))
  }

  return (
    <Modal
      open={Boolean(state.target)}
      title={`审核：${state.target?.title ?? ''}`}
      onCancel={state.close}
      onOk={submit}
      confirmLoading={state.submitting}
      okText={okText}
      okButtonProps={{ danger: !state.approved }}
    >
      <div className="stack" style={{ marginTop: 12 }}>
        <Select
          value={state.approved ? 'pass' : 'reject'}
          style={{ width: '100%' }}
          options={[
            { label: '通过', value: 'pass' },
            { label: '驳回', value: 'reject' },
          ]}
          onChange={(value) => state.setApproved(value === 'pass')}
        />
        <Input.TextArea
          rows={4}
          value={state.remark}
          placeholder={state.approved ? '审核意见（可选）' : '驳回理由（建议填写，会回传给申请人）'}
          onChange={(event) => state.setRemark(event.target.value)}
        />
        <div className="small muted">
          审核结果会写进单据（审核人、时间、意见），驳回理由会同步到用户端的申请记录里。
          注意：这三个审核接口沿用核心平台原有实现，只更新单据，<b>不会</b>额外写操作审计 ——
          真正进「操作审计」的是本运营端的冻结、配置、推送、应用审核等动作。
        </div>
      </div>
    </Modal>
  )
}

/* ==================== 身份申请审核 ==================== */

export function IdentityAuditPage(): JSX.Element {
  const [rows, setRows] = useState<IdentityApplication[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const review = useReview()

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.identityApplications({ pageNum, pageSize: 20, status: status || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status])

  const columns: ColumnsType<IdentityApplication> = [
    {
      title: '申请人',
      dataIndex: 'applicantName',
      width: 170,
      render: (value: string, row) => (
        <div>
          <b>{value || `用户 ${row.userId}`}</b>
          <div className="small muted">单号 {row.id}</div>
        </div>
      ),
    },
    {
      title: '申请身份',
      dataIndex: 'identityType',
      width: 110,
      render: (value: string) => (
        <Tag className="soft-tag">{IDENTITY_TYPE_LABEL[value] ?? value}</Tag>
      ),
    },
    {
      title: '主体名称 / 信用代码',
      dataIndex: 'subjectName',
      render: (value: string, row) => (
        <div>
          <b>{value || '—'}</b>
          <div className="small muted">{row.creditCode || '未填信用代码'}</div>
        </div>
      ),
    },
    { title: '经营地', dataIndex: 'businessPlace', width: 180, render: (value: string) => value || '—' },
    {
      title: '联系人',
      dataIndex: 'contactName',
      width: 150,
      render: (value: string, row) => (
        <div>
          {value || '—'}
          <div className="small muted">{row.contactPhone || '—'}</div>
        </div>
      ),
    },
    { title: '提交时间', dataIndex: 'applyTime', width: 150, render: (value: string) => formatTime(value) },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: '操作',
      width: 120,
      render: (_, row) => (
        row.status === 'pending'
          ? (
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => review.open(String(row.id), row.subjectName || `申请 ${row.id}`)}
            >
              审核
            </Button>
          )
          : <span className="small muted">{row.reviewerName || '已处理'}</span>
      ),
    },
  ]

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="认证审核"
        title="身份申请审核"
        description={`待处理 ${status === 'pending' ? total : '—'} 件 · 通过后单据状态变 approved，不自动开通 RBAC 权限`}
        actions={
          <Select
            value={status}
            style={{ width: 150 }}
            options={[
              { label: '待审核', value: 'pending' },
              { label: '已通过', value: 'approved' },
              { label: '已驳回', value: 'rejected' },
              { label: '全部', value: '' },
            ]}
            onChange={(value) => { setStatus(value); setPageNum(1) }}
          />
        }
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      <section className="surface-card">
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1180 }}
          expandable={{
            expandedRowRender: (row) => (
              <div className="small" style={{ lineHeight: 1.9 }}>
                <div>经营范围：{row.businessCategory || '—'}　年交易量：{row.annualVolume || '—'}</div>
                <div>申请说明：{row.applyNote || '—'}</div>
                {row.reviewRemark && <div>审核意见：{row.reviewRemark}（{row.reviewerName}）</div>}
              </div>
            ),
          }}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 件`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>
      <ReviewModal
        state={review}
        onSubmit={async (approved, remark) => {
          if (!review.target) return
          await ucApi.reviewIdentityApplication(review.target.id, approved, remark)
          message.success(approved ? '已通过该身份申请' : '已驳回该身份申请')
          load()
        }}
      />
    </div>
  )
}

/* ==================== 实名认证审核 ==================== */

export function RealnameAuditPage(): JSX.Element {
  const [rows, setRows] = useState<IdentityRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const review = useReview()

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.realnameList({ pageNum, pageSize: 20, status: status || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="认证审核"
        title="实名认证审核"
        description="证件号在入库时已转成掩码 + 哈希，运营端看不到明文，也不需要看到"
        actions={
          <Select
            value={status}
            style={{ width: 150 }}
            options={[
              { label: '待审核', value: 'pending' },
              { label: '已通过', value: 'verified' },
              { label: '已驳回', value: 'rejected' },
              { label: '全部', value: '' },
            ]}
            onChange={(value) => { setStatus(value); setPageNum(1) }}
          />
        }
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      <section className="surface-card">
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1100 }}
          columns={[
            {
              title: '真实姓名',
              dataIndex: 'realName',
              width: 130,
              render: (value: string) => <b>{value || '—'}</b>,
            },
            {
              title: '证件号（掩码）',
              dataIndex: 'idNoMasked',
              width: 180,
              render: (value: string) => <span className="small">{value || '—'}</span>,
            },
            {
              title: '公安库 / 活体',
              width: 160,
              render: (_, row) => (
                <div className="tag-row">
                  <Tag className={`soft-tag tone-${row.policeVerified ? 'green' : 'default'}`}>
                    公安{row.policeVerified ? '通过' : '未过'}
                  </Tag>
                  <Tag className={`soft-tag tone-${row.livenessVerified ? 'green' : 'default'}`}>
                    活体{row.livenessVerified ? '通过' : '未过'}
                  </Tag>
                </div>
              ),
            },
            {
              title: '联系方式',
              dataIndex: 'contactPhone',
              width: 140,
              render: (value: string) => value || '—',
            },
            { title: '提交时间', dataIndex: 'submitTime', width: 150, render: (value: string) => formatTime(value) },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: '操作',
              width: 110,
              render: (_, row) => (
                row.status === 'pending'
                  ? (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={() => review.open(String(row.id), row.realName || `实名 ${row.id}`)}
                    >
                      审核
                    </Button>
                  )
                  : <span className="small muted">{row.reviewerName || '已处理'}</span>
              ),
            },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>
      <ReviewModal
        state={review}
        onSubmit={async (approved, remark) => {
          if (!review.target) return
          await ucApi.reviewRealname(review.target.id, approved, remark)
          message.success(approved ? '实名认证已通过' : '已驳回实名认证')
          load()
        }}
      />
    </div>
  )
}

/* ==================== 资质审核 ==================== */

export function QualificationAuditPage(): JSX.Element {
  const [rows, setRows] = useState<CertificationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<CertificationRecord | null>(null)
  const [pass, setPass] = useState(true)
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.certifications({ pageNum, pageSize: 20, certStatus: status || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status])

  const submit = (): void => {
    if (!target) return
    setSubmitting(true)
    ucApi.auditCertification(String(target.id), pass ? 'approved' : 'rejected', remark)
      .then(() => {
        message.success(pass ? '资质审核已通过' : '已驳回资质申请')
        setTarget(null)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="认证审核"
        title="资质审核"
        description="经营主体的营业执照、法人证件、对公账户材料；审核通过后主体 verify_status 变 approved"
        actions={
          <Select
            value={status}
            style={{ width: 160 }}
            options={[
              { label: '待审核', value: 'pending' },
              { label: '已通过', value: 'approved' },
              { label: '已驳回', value: 'rejected' },
              { label: '全部', value: '' },
            ]}
            onChange={(value) => { setStatus(value); setPageNum(1) }}
          />
        }
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      <section className="surface-card">
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1180 }}
          columns={[
            {
              title: '主体名称',
              dataIndex: 'merchantName',
              render: (value: string, row) => (
                <div>
                  <b>{value || row.companyName || '—'}</b>
                  <div className="small muted">{row.creditCode || '未填信用代码'}</div>
                </div>
              ),
            },
            { title: '证书编号', dataIndex: 'certNo', width: 160, render: (value: string) => value || '—' },
            { title: '法人', dataIndex: 'legalPerson', width: 100, render: (value: string) => value || '—' },
            {
              title: '联系人',
              dataIndex: 'contactName',
              width: 150,
              render: (value: string, row) => (
                <div>
                  {value || '—'}
                  <div className="small muted">{row.contactPhone || '—'}</div>
                </div>
              ),
            },
            { title: '提交时间', dataIndex: 'submitTime', width: 150, render: (value: string) => formatTime(value) },
            {
              title: '状态',
              dataIndex: 'certStatus',
              width: 110,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: '操作',
              width: 110,
              render: (_, row) => (
                ['pending', 'submitted', 'reviewing'].includes(row.certStatus)
                  ? (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={() => { setTarget(row); setPass(true); setRemark('') }}
                    >
                      审核
                    </Button>
                  )
                  : <span className="small muted">{row.reviewer || '已处理'}</span>
              ),
            },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 件`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>

      <Modal
        open={Boolean(target)}
        title={`资质审核：${target?.merchantName ?? ''}`}
        onCancel={() => setTarget(null)}
        onOk={submit}
        confirmLoading={submitting}
        okText="提交审核"
        okButtonProps={{ danger: !pass }}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <Select
            value={pass ? 'pass' : 'reject'}
            style={{ width: '100%' }}
            options={[{ label: '通过', value: 'pass' }, { label: '驳回', value: 'reject' }]}
            onChange={(value) => setPass(value === 'pass')}
          />
          <Input.TextArea
            rows={4}
            value={remark}
            placeholder={pass ? '审核意见（可选）' : '驳回理由（会回传给主体）'}
            onChange={(event) => setRemark(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

/* ==================== 组织认证审核 ==================== */

export function OrgAuditPage(): JSX.Element {
  const [rows, setRows] = useState<Array<{
    id: string | number
    name: string
    code: string | null
    creditCode: string | null
    contactName: string | null
    verifyStatus: string | null
    createdAt: string | null
  }>>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [verifyStatus, setVerifyStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.orgs({ pageNum, pageSize: 20, verifyStatus: verifyStatus || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, verifyStatus])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="组织管理"
        title="组织认证审核"
        description="这里是「主体认证状态」的总览视图；具体的营业执照/法人材料审核在「资质审核」页完成"
        actions={
          <Select
            value={verifyStatus}
            style={{ width: 160 }}
            options={[
              { label: '待认证', value: 'pending' },
              { label: '已认证', value: 'approved' },
              { label: '已驳回', value: 'rejected' },
              { label: '全部', value: '' },
            ]}
            onChange={(value) => { setVerifyStatus(value); setPageNum(1) }}
          />
        }
      />
      {error && <ErrorBlock message={error} onRetry={load} />}
      <section className="surface-card">
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 900 }}
          columns={[
            {
              title: '组织',
              dataIndex: 'name',
              render: (value: string, row) => (
                <div>
                  <b>{value}</b>
                  <div className="small muted">{row.code} · {row.creditCode || '未填信用代码'}</div>
                </div>
              ),
            },
            { title: '联系人', dataIndex: 'contactName', width: 140, render: (value: string) => value || '—' },
            { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            {
              title: '认证状态',
              dataIndex: 'verifyStatus',
              width: 120,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: '操作',
              width: 150,
              render: (_, row) => (
                <Button
                  size="small"
                  type="link"
                  onClick={() => { window.location.hash = `/org-detail/${row.id}` }}
                >
                  查看详情
                </Button>
              ),
            },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 家`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>
    </div>
  )
}
