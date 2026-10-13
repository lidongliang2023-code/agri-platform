import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Form, Input, Space, Tag, Typography, message } from 'antd'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import { getMyRealName, submitRealName, type RealNameRecord } from '@/api/identity'

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  verified: { text: '已认证', color: 'success' },
  rejected: { text: '已驳回', color: 'error' }
}

/**
 * 实名认证（个人）。
 *
 * <p>与「我的保证金」「我的获赔」并列的账号级页面。此前平台只有经营主体（企业）认证，
 * 个人的实名没有任何入口。</p>
 *
 * <p><b>口径</b>：服务端**不存身份证号明文** —— 只存掩码与加盐哈希，
 * 所以这里显示、以及运营端能看到的，永远都是 `110***********002X` 这种掩码。
 * 页面也据此说明，避免用户以为"平台存了我的身份证照片/号码"。</p>
 */
export default function MyIdentity() {
  const [record, setRecord] = useState<RealNameRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyRealName()
      if (res?.code === 0) {
        setRecord(res.data ?? null)
      } else {
        message.error(res?.message ?? '加载实名信息失败')
      }
    } catch {
      message.error('加载实名信息失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (values: { realName: string; idNo: string }) => {
    setSaving(true)
    try {
      const res = await submitRealName(values)
      if (res?.code === 0) {
        message.success(res.data?.idNoChanged ? '已提交，等待运营审核' : '已提交，等待运营审核（号码与上次一致）')
        form.resetFields()
        load()
      } else {
        message.error(res?.message ?? '提交失败')
      }
    } catch (e: unknown) {
      message.error('提交失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const status = record ? STATUS[record.status] ?? { text: record.status, color: 'default' } : null
  const canSubmit = !record || record.status === 'rejected'

  return (
    <div>
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            实名认证
            {status && <Tag color={status.color}>{status.text}</Tag>}
          </Space>
        }
        loading={loading}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="平台不保存你的身份证号明文"
          description="系统只记录掩码（如前 3 位与后 4 位）与一段加盐摘要，用于核对与追溯；运营审核时同样只看到掩码。三要素核验将接入合规实名服务后完成。"
        />

        {record && (
          <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="姓名">{record.realName}</Descriptions.Item>
            <Descriptions.Item label="身份证号">{record.idNoMasked}</Descriptions.Item>
            <Descriptions.Item label="认证单号">{record.identityNo}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{record.submitTime}</Descriptions.Item>
            {record.reviewTime && (
              <Descriptions.Item label="审核时间">{record.reviewTime}</Descriptions.Item>
            )}
            {record.reviewerName && (
              <Descriptions.Item label="审核人">{record.reviewerName}</Descriptions.Item>
            )}
            {record.reviewRemark && (
              <Descriptions.Item label="审核意见" span={2}>
                {record.reviewRemark}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}

        {record?.status === 'pending' && (
          <Typography.Paragraph type="secondary">
            已提交，等待运营审核。审核通过前无需重复提交。
          </Typography.Paragraph>
        )}
        {record?.status === 'verified' && (
          <Typography.Paragraph type="secondary">
            实名认证已通过。如需变更信息，请联系平台运营。
          </Typography.Paragraph>
        )}

        {canSubmit && (
          <Form form={form} layout="vertical" onFinish={submit} style={{ maxWidth: 420 }}>
            <Form.Item name="realName" label="真实姓名" rules={[{ required: true, message: '请填写真实姓名' }]}>
              <Input placeholder="与证件一致" autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="idNo"
              label="身份证号"
              rules={[{ required: true, message: '请填写身份证号' }]}
              extra="提交后即被转换为掩码与摘要，平台不保存明文"
            >
              <Input placeholder="18 位身份证号" maxLength={18} autoComplete="off" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              {record?.status === 'rejected' ? '重新提交' : '提交实名认证'}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  )
}
