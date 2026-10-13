import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getUserIdentityPage, reviewUserIdentity, type RealNameRecord } from '@/api/identity'
import { getCurrentUser } from '@/utils/session'

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  verified: { text: '已认证', color: 'success' },
  rejected: { text: '已驳回', color: 'error' }
}

/**
 * 实名认证审核（运营端）。
 *
 * <p>列表里**只有掩码**——不是前端藏了字段，而是服务端压根没存明文，
 * 谁也拿不出完整身份证号（包括运营与数据库管理员）。</p>
 *
 * <p>这个页面所在的 {@code /api/v1/admin/**} 由平台侧统一准入拦（要运营权限），
 * 当事人不可能自己给自己批 —— 已实测 403。</p>
 */
export default function AdminIdentity() {
  const [rows, setRows] = useState<RealNameRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize] = useState(10)
  const [status, setStatus] = useState('pending')
  const [current, setCurrent] = useState<RealNameRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getUserIdentityPage({ pageNum, pageSize, status: status || undefined })
      .then((res: { code: number; data?: { records?: RealNameRecord[]; total?: number }; message?: string }) => {
        if (res?.code === 0) {
          setRows(res.data?.records ?? [])
          setTotal(Number(res.data?.total ?? 0))
        } else {
          message.error(res?.message ?? '加载实名认证列表失败')
        }
      })
      .catch(() => message.error('加载实名认证列表失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, status])

  useEffect(() => {
    load()
  }, [load])

  const doReview = async (row: RealNameRecord, approved: boolean, remark?: string) => {
    setSaving(true)
    try {
      const res = await reviewUserIdentity(row.id, approved, remark)
      if (res?.code === 0) {
        message.success(approved ? '已通过' : '已驳回')
        setCurrent(null)
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

  const reviewer = getCurrentUser()?.nickname ?? getCurrentUser()?.username ?? '运营'

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="160px">
            <Select
              value={status}
              style={{ width: '100%' }}
              onChange={(value) => {
                setPageNum(1)
                setStatus(value)
              }}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'verified', label: '已认证' },
                { value: 'rejected', label: '已驳回' },
                { value: '', label: '全部状态' }
              ]}
            />
          </Col>
          <Col flex="auto">
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Card title={`实名认证申请 ${total} 条`}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="列表里只有掩码"
          description="平台不保存身份证号明文，只有掩码与加盐摘要 —— 运营也拿不到完整号码。核验结论由合规实名服务给出后回填。"
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1100 }}
          pagination={{ current: pageNum, pageSize, total, onChange: setPageNum }}
          columns={[
            { title: '认证单号', dataIndex: 'identityNo', width: 180 },
            { title: '姓名', dataIndex: 'realName', width: 120 },
            { title: '身份证号', dataIndex: 'idNoMasked', width: 160 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (val: string) => {
                const hit = STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={hit.color}>{hit.text}</Tag>
              }
            },
            { title: '提交时间', dataIndex: 'submitTime', width: 170 },
            { title: '审核人', dataIndex: 'reviewerName', width: 110, render: (v: string) => v ?? '—' },
            { title: '审核意见', dataIndex: 'reviewRemark', ellipsis: true, render: (v: string) => v ?? '—' },
            {
              title: '操作',
              width: 140,
              fixed: 'right' as const,
              render: (_: unknown, row: RealNameRecord) =>
                row.status === 'pending' ? (
                  <Space size={0}>
                    <Button type="link" onClick={() => doReview(row, true, '材料齐全')}>
                      通过
                    </Button>
                    <Button type="link" danger onClick={() => { setCurrent(row); form.resetFields() }}>
                      驳回
                    </Button>
                  </Space>
                ) : (
                  <span style={{ color: '#a0aec0' }}>已处理</span>
                )
            }
          ]}
        />
      </Card>

      <Modal
        open={Boolean(current)}
        title={`驳回实名认证：${current?.realName ?? ''} ${current?.idNoMasked ?? ''}`}
        onCancel={() => setCurrent(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: { remark: string }) => current && doReview(current, false, values.remark)}
        >
          <Form.Item
            label={`驳回原因（审核人：${reviewer}）`}
            name="remark"
            rules={[{ required: true, message: '驳回必须填写原因' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：证件照不清晰，请重新提交" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
