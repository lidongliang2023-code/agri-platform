import { useEffect, useState } from 'react'
import { Button, Descriptions, Input, Select, Table } from 'antd'
import { useApp } from '../app-context'
import { ucApi } from '../api'
import {
  ErrorBlock,
  ORG_TYPE_LABEL,
  PageTitle,
  SectionHeading,
  StatusTag,
  formatTime,
} from '../components/ui'
import type { OrgDetailData, OrgRecord } from '../types'

/* ==================== 组织列表 ==================== */

export function OrgListPage(): JSX.Element {
  const { navigate } = useApp()
  const [rows, setRows] = useState<OrgRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [type, setType] = useState('')
  const [verifyStatus, setVerifyStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.orgs({
      pageNum,
      pageSize: 20,
      keyword: keyword || undefined,
      type: type || undefined,
      verifyStatus: verifyStatus || undefined,
    })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [pageNum, keyword, type, verifyStatus])

  const certified = rows.filter((row) => row.verifyStatus === 'approved').length

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="组织管理"
        title="组织列表"
        description={`平台组织 ${total} 家 · 当前页已认证 ${certified} 家 · 组织与账号是多对多关系`}
      />

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Input
            value={draft}
            placeholder="搜组织名称 / 编码 / 信用代码"
            style={{ width: 260 }}
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={() => { setKeyword(draft.trim()); setPageNum(1) }}
          />
          <Button type="primary" onClick={() => { setKeyword(draft.trim()); setPageNum(1) }}>搜索</Button>
          <Select
            value={type}
            style={{ width: 160 }}
            options={[
              { label: '全部类型', value: '' },
              ...Object.entries(ORG_TYPE_LABEL).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(value) => { setType(value); setPageNum(1) }}
          />
          <Select
            value={verifyStatus}
            style={{ width: 150 }}
            options={[
              { label: '全部认证状态', value: '' },
              { label: '已认证', value: 'approved' },
              { label: '待认证', value: 'pending' },
              { label: '已驳回', value: 'rejected' },
            ]}
            onChange={(value) => { setVerifyStatus(value); setPageNum(1) }}
          />
        </div>

        {error && <ErrorBlock message={error} />}
        {!error && (
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            dataSource={rows}
            scroll={{ x: 1180 }}
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
              {
                title: '类型',
                dataIndex: 'type',
                width: 120,
                render: (value: string) => ORG_TYPE_LABEL[value] ?? value ?? '—',
              },
              { title: '行业', dataIndex: 'industry', width: 120, render: (value: string) => value || '—' },
              {
                title: '所在地',
                dataIndex: 'address',
                width: 190,
                render: (value: string) => value || '未填写',
              },
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
              {
                title: '成员',
                dataIndex: 'memberCount',
                width: 80,
                render: (value: number) => (value ? `${value} 人` : '—'),
              },
              {
                title: '认证',
                dataIndex: 'verifyStatus',
                width: 100,
                render: (value: string) => <StatusTag status={value} />,
              },
              {
                title: '操作',
                width: 100,
                render: (_, row) => (
                  <Button size="small" type="link" onClick={() => navigate('org-detail', String(row.id))}>
                    详情
                  </Button>
                ),
              },
            ]}
            pagination={{
              current: pageNum,
              pageSize: 20,
              total,
              showTotal: (count) => `共 ${count} 家组织`,
              onChange: (next) => setPageNum(next),
            }}
          />
        )}
      </section>
    </div>
  )
}

/* ==================== 组织详情 ==================== */

export function OrgDetailPage({ id }: { id: string }): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<OrgDetailData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('缺少组织 ID')
      return
    }
    setError('')
    ucApi.orgDetail(id)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [id])

  if (error) {
    return (
      <div className="page-stack">
        <PageTitle title="组织详情" />
        <ErrorBlock message={error} onRetry={() => navigate('org-list')} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-stack">
        <PageTitle title="组织详情" description="正在加载…" />
      </div>
    )
  }

  const { org, members, certifications, applications } = data

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="组织管理"
        title="组织详情"
        actions={<Button onClick={() => navigate('org-list')}>返回列表</Button>}
      />

      <section className="surface-card">
        <div className="uc-detail-head">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="uc-detail-avatar">{org.name.slice(0, 1)}</div>
            <div>
              <h2 className="uc-detail-title">{org.name}</h2>
              <div className="uc-detail-sub">
                {org.code} · {ORG_TYPE_LABEL[org.type ?? ''] ?? org.type ?? '未分类'} · {org.industry || '未填行业'}
              </div>
              <div className="tag-row" style={{ marginTop: 10 }}>
                <StatusTag status={org.verifyStatus} />
                {org.verifyTime && <span className="small muted">认证于 {formatTime(org.verifyTime)}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="surface-card">
          <SectionHeading kicker="主体档案" title="工商与联系信息" />
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="统一社会信用代码">{org.creditCode || '—'}</Descriptions.Item>
            <Descriptions.Item label="所在地">{org.address || '—'}</Descriptions.Item>
            <Descriptions.Item label="联系人">
              {org.contactName || '—'}　{org.contactPhone || ''}
            </Descriptions.Item>
            <Descriptions.Item label="会员类型">{org.memberType || '—'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(org.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="认证意见">{org.verifyRemark || '—'}</Descriptions.Item>
          </Descriptions>
        </section>

        <section className="surface-card">
          <SectionHeading kicker="成员" title={`成员关系（${members.length}）`} />
          {members.length === 0 && <span className="small muted">暂无成员绑定</span>}
          <Table
            rowKey="userId"
            size="small"
            pagination={false}
            dataSource={members}
            columns={[
              {
                title: '账号',
                dataIndex: 'username',
                render: (value: string, row) => (
                  <div>
                    <b>{row.nickname || value}</b>
                    <div className="small muted">{value}</div>
                  </div>
                ),
              },
              {
                title: '组织内角色',
                dataIndex: 'roleInMerchant',
                width: 120,
                render: (value: string) => value || '—',
              },
              {
                title: '加入时间',
                dataIndex: 'joinedAt',
                width: 140,
                render: (value: string) => formatTime(value),
              },
              {
                title: '操作',
                width: 90,
                render: (_, row) => (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => navigate('user-detail', row.userId)}
                  >
                    查看
                  </Button>
                ),
              },
            ]}
          />
        </section>
      </div>

      <section className="surface-card">
        <SectionHeading kicker="资质材料" title={`认证记录（${certifications.length}）`} />
        {certifications.length === 0
          ? <span className="small muted">该组织尚未提交资质认证</span>
          : (
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={certifications}
              scroll={{ x: 860 }}
              columns={[
                { title: '证书编号', dataIndex: 'certNo', width: 160, render: (value: string) => value || '—' },
                { title: '企业名称', dataIndex: 'companyName', render: (value: string) => value || '—' },
                { title: '法人', dataIndex: 'legalPerson', width: 100, render: (value: string) => value || '—' },
                {
                  title: '状态',
                  dataIndex: 'certStatus',
                  width: 110,
                  render: (value: string) => <StatusTag status={value} />,
                },
                { title: '提交时间', dataIndex: 'submitTime', width: 150, render: (value: string) => formatTime(value) },
                { title: '审核意见', dataIndex: 'reviewRemark', render: (value: string) => value || '—' },
              ]}
            />
          )}
      </section>

      {applications.length > 0 && (
        <section className="surface-card">
          <SectionHeading kicker="身份申请" title={`该主体关联的申请（${applications.length}）`} />
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={applications}
            columns={[
              { title: '申请身份', dataIndex: 'identityType', width: 130 },
              { title: '主体名称', dataIndex: 'subjectName', render: (value: string) => value || '—' },
              {
                title: '状态',
                dataIndex: 'status',
                width: 110,
                render: (value: string) => <StatusTag status={value} />,
              },
              { title: '提交时间', dataIndex: 'createdAt', width: 150, render: (value: string) => formatTime(value) },
            ]}
          />
        </section>
      )}
    </div>
  )
}
