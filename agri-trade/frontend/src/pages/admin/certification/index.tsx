import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tabs, Tag, message
} from 'antd'
import { EyeOutlined, AuditOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  auditCertification, getCertifications, getMerchants,
  type CertificationRow, type MerchantRow
} from '@/api/certification'

const CERT_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' }
}

const VERIFY_STATUS: Record<string, { text: string; color: string }> = {
  unverified: { text: '未认证', color: 'default' },
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已认证', color: 'success' },
  rejected: { text: '已驳回', color: 'error' }
}

/**
 * 用户与企业认证（运营端，本轮做"企业"这一半）。
 *
 * 平台有主体登记信息，但从来没有"验没验过"这一层 —— 这一页补的就是它：
 * 主体提交材料、运营审核，审核结论同时落到主体上（verify_status），
 * 这样"这家主体能不能交易"才有依据。
 *
 * 数据在 core-platform（与"用户-主体绑定"同源），本页只是运营端入口。
 */
export default function AdminCertification() {
  const [rows, setRows] = useState<CertificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [certStatus, setCertStatus] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  const [merchants, setMerchants] = useState<MerchantRow[]>([])
  const [merchantTotal, setMerchantTotal] = useState(0)
  const [merchantPage, setMerchantPage] = useState(1)

  const [detail, setDetail] = useState<CertificationRow | null>(null)
  const [auditRow, setAuditRow] = useState<CertificationRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([
        getCertifications({ pageNum: page, pageSize: 10, certStatus }),
        getMerchants({ page: merchantPage, size: 10 })
      ])
      if (c?.code === 0) {
        setRows(c.data?.records ?? [])
        setTotal(Number(c.data?.total ?? 0))
      }
      if (m?.code === 0) {
        setMerchants(m.data?.records ?? [])
        setMerchantTotal(Number(m.data?.total ?? 0))
      }
    } catch {
      message.error('加载认证数据失败（请检查 core-platform 是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [page, certStatus, merchantPage])

  useEffect(() => {
    load()
  }, [load])

  const submitAudit = async () => {
    if (!auditRow) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await auditCertification(auditRow.id, values.status, values.remark)
      if (res?.code === 0) {
        message.success(values.status === 'approved' ? '已通过认证' : '已驳回')
        setAuditRow(null)
        form.resetFields()
        load()
      } else {
        message.error(res?.message ?? '审核失败')
      }
    } catch {
      message.error('审核失败')
    } finally {
      setSaving(false)
    }
  }

  const certTab = (
    <Card
      title={'认证申请 ' + total + ' 条'}
      extra={
        <Space>
          <Select
            placeholder="认证状态"
            style={{ width: 130 }}
            allowClear
            onChange={(v) => { setPage(1); setCertStatus(v) }}
            options={Object.entries(CERT_STATUS).map(([value, item]) => ({ value, label: item.text }))}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="审核结论会同时落到主体上"
        description="通过后该主体的认证状态变为「已认证」；驳回必须填写审核意见（商家要照着改，运营端也要能回答「为什么没过」）。"
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 1200 }}
        locale={{ emptyText: '暂无认证申请' }}
        pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
        columns={[
          { title: '申请单号', dataIndex: 'certNo', width: 160 },
          { title: '经营主体', dataIndex: 'merchantName', width: 160 },
          { title: '企业名称', dataIndex: 'companyName', width: 180 },
          { title: '统一社会信用代码', dataIndex: 'creditCode', width: 190 },
          { title: '法定代表人', dataIndex: 'legalPerson', width: 110, render: (v: string) => v ?? '—' },
          { title: '联系人', dataIndex: 'contactName', width: 100, render: (v: string) => v ?? '—' },
          { title: '状态', dataIndex: 'certStatus', width: 100,
            render: (v: string) => <Tag color={CERT_STATUS[v]?.color ?? 'default'}>{CERT_STATUS[v]?.text ?? v}</Tag> },
          { title: '提交时间', dataIndex: 'submitTime', width: 170 },
          {
            title: '操作',
            width: 150,
            fixed: 'right' as const,
            render: (_: unknown, row: CertificationRow) => (
              <Space size={0}>
                <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(row)}>详情</Button>
                {row.certStatus === 'pending' && (
                  <Button type="link" icon={<AuditOutlined />}
                    onClick={() => { setAuditRow(row); form.setFieldsValue({ status: 'approved' }) }}>审核</Button>
                )}
              </Space>
            )
          }
        ]}
      />
    </Card>
  )

  const merchantTab = (
    <Card title={'经营主体 ' + merchantTotal + ' 家'}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="这是全平台的主体台账"
        description="认证状态取自主体本身（审核通过/驳回会同步更新）。未认证的主体说明还没提交材料或正在审核。"
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={merchants}
        scroll={{ x: 1100 }}
        pagination={{ current: merchantPage, pageSize: 10, total: merchantTotal, onChange: setMerchantPage }}
        columns={[
          { title: '主体ID', dataIndex: 'id', width: 90 },
          { title: '主体名称', dataIndex: 'name', width: 180 },
          { title: '编码', dataIndex: 'code', width: 130, render: (v: string) => v ?? '—' },
          { title: '类型', dataIndex: 'type', width: 100, render: (v: string) => v ?? '—' },
          { title: '统一社会信用代码', dataIndex: 'creditCode', width: 190, render: (v: string) => v ?? '—' },
          { title: '联系人', dataIndex: 'contactName', width: 100, render: (v: string) => v ?? '—' },
          { title: '联系电话', dataIndex: 'contactPhone', width: 130, render: (v: string) => v ?? '—' },
          { title: '认证状态', dataIndex: 'verifyStatus', width: 110,
            render: (v: string) => {
              const hit = VERIFY_STATUS[v ?? 'unverified']
              return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? v}</Tag>
            } },
          { title: '认证时间', dataIndex: 'verifyTime', width: 170, render: (v: string) => v ?? '—' },
          { title: '审核意见', dataIndex: 'verifyRemark', ellipsis: true, render: (v: string) => v ?? '—' }
        ]}
      />
    </Card>
  )

  return (
    <div style={{ padding: 20 }}>
      <Tabs items={[
        { key: 'cert', label: '认证申请', children: certTab },
        { key: 'merchant', label: '经营主体', children: merchantTab }
      ]} />

      <Modal title="审核认证申请" open={!!auditRow} onCancel={() => setAuditRow(null)}
        onOk={submitAudit} confirmLoading={saving} destroyOnClose>
        {auditRow && (
          <Descriptions bordered column={1} size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="经营主体">{auditRow.merchantName}</Descriptions.Item>
            <Descriptions.Item label="企业名称">{auditRow.companyName}</Descriptions.Item>
            <Descriptions.Item label="信用代码">{auditRow.creditCode}</Descriptions.Item>
            <Descriptions.Item label="材料说明">{auditRow.attachNote ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="审核结论" rules={[{ required: true, message: '请选择结论' }]}>
            <Select options={[
              { value: 'approved', label: '通过（主体标记为已认证）' },
              { value: 'rejected', label: '驳回（需填写意见）' }
            ]} />
          </Form.Item>
          <Form.Item name="remark" label="审核意见" extra="驳回时必填">
            <Input.TextArea rows={3} placeholder="例如：营业执照与信用代码不一致，请重新提交" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="认证申请详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={700}>
        {detail && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="申请单号">{detail.certNo}</Descriptions.Item>
            <Descriptions.Item label="经营主体">{detail.merchantName}</Descriptions.Item>
            <Descriptions.Item label="企业名称">{detail.companyName}</Descriptions.Item>
            <Descriptions.Item label="信用代码">{detail.creditCode}</Descriptions.Item>
            <Descriptions.Item label="法定代表人">{detail.legalPerson ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="营业执照编号">{detail.licenseNo ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="联系人">{detail.contactName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{detail.contactPhone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="材料说明" span={2}>{detail.attachNote ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={CERT_STATUS[detail.certStatus]?.color ?? 'default'}>
                {CERT_STATUS[detail.certStatus]?.text ?? detail.certStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="提交时间">{detail.submitTime}</Descriptions.Item>
            <Descriptions.Item label="审核人">{detail.reviewer ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核时间">{detail.reviewTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审核意见" span={2}>{detail.reviewRemark ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
