import { useState } from 'react'
import { Alert, Table, Button, Card, Input, Select, Space, Tag, Modal, Form, Descriptions, message } from 'antd'
import { SearchOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDisputeList, resolveDispute, type DisputeQuery, type DisputeVO } from '@/api/dispute'
import { getMyMerchants } from '@/api/identity'

/**
 * 纠纷状态词表（库里的真实取值）。
 *
 * <p>原先页面只判断 pending / mediating / arbitrating / resolved 四种，
 * 而库里实际存在 processing —— 落到 default 分支，页面上直接显示英文原文。</p>
 */
const DISPUTE_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'warning' },
  processing: { text: '处理中', color: 'processing' },
  mediating: { text: '调解中', color: 'processing' },
  arbitrating: { text: '仲裁中', color: 'purple' },
  resolved: { text: '已解决', color: 'success' },
  closed: { text: '已关闭', color: 'default' }
}

function DisputeList() {
  const queryClient = useQueryClient()
  // 只查"与我有关"的纠纷。范围由后端按登录令牌推导，前端不再自报参与方。
  const [query, setQuery] = useState<DisputeQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ disputeNo?: string; disputeStatus?: string }>({})

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', query],
    queryFn: () => getDisputeList(query)
  })
  // 把"没有纠纷"和"没绑主体"分开显示，避免一张说不清的空表
  const { data: merchantData } = useQuery({ queryKey: ['my-merchants'], queryFn: getMyMerchants })
  const merchants = merchantData?.code === 200 ? merchantData.data ?? [] : null
  const identityError = merchantData && merchantData.code !== 200 ? merchantData.message ?? '无法解析你的经营主体' : null

  const [resolving, setResolving] = useState<DisputeVO | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [viewing, setViewing] = useState<DisputeVO | null>(null)

  /**
   * 当事人自行了结（和解 / 撤诉）。
   *
   * <p>与运营端的调解/仲裁是两条路：那两个由第三方介入给结论，这条是双方自己谈拢。
   * 后端会校验"你必须是这单纠纷的当事人"，否则任何人都能替别人把纠纷了结掉。</p>
   */
  const submitResolve = async () => {
    if (!resolving) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await resolveDispute(resolving.id, values)
      if (res?.code === 200) {
        message.success('纠纷已了结')
        setResolving(null)
        form.resetFields()
        queryClient.invalidateQueries({ queryKey: ['disputes'] })
      } else {
        message.error(res?.message ?? '处理失败')
      }
    } catch {
      message.error('处理失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: '纠纷编号', dataIndex: 'disputeNo', key: 'disputeNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    // 纠纷表的申请人是 complainant*（不是 applicant*）；金额只有 claimAmount（索赔金额）
    { title: '申请人', dataIndex: 'complainantName', key: 'complainantName' },
    { title: '被申请人', dataIndex: 'respondentName', key: 'respondentName' },
    { title: '纠纷类型', dataIndex: 'disputeType', key: 'disputeType' },
    { title: '索赔金额', dataIndex: 'claimAmount', key: 'claimAmount', render: (val: number) => (val == null ? '—' : `¥${val}`) },
    { title: '纠纷内容', dataIndex: 'disputeDescription', key: 'disputeDescription', ellipsis: true },
    {
      title: '纠纷状态',
      dataIndex: 'disputeStatus',
      key: 'disputeStatus',
      render: (status: string) => {
        const hit = DISPUTE_STATUS[status]
        return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? status}</Tag>
      }
    },
    { title: '当前阶段', dataIndex: 'processStage', key: 'processStage', render: (v: string) => v ?? '—' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_: unknown, row: DisputeVO) => (
        <Space size={0}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => setViewing(row)}>查看详情</Button>
          {/*
            只保留了"处理"：查看详情是真的，而"删除"后端没有这个接口，
            并且纠纷单属于交易存证，本来也不该由当事人删掉。此前三个按钮都没有 onClick。
            已了结的纠纷不再提供"处理"入口。
          */}
          {row.disputeStatus !== 'resolved' && row.disputeStatus !== 'closed' && (
            <Button type="link" icon={<SettingOutlined />} onClick={() => setResolving(row)}>处理</Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <Card title="纠纷管理">
      {identityError && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message="身份解析失败" description={identityError} />
      )}
      {!identityError && merchants?.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前账号还没有绑定经营主体"
          description="因此查询不到任何纠纷。请运营在「用户-主体绑定」里为你绑定经营主体后重试。"
        />
      )}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="纠纷编号"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setDraft((prev) => ({ ...prev, disputeNo: e.target.value || undefined }))}
        />
        <Select
          placeholder="纠纷状态"
          style={{ width: 150 }}
          allowClear
          onChange={(v) => setDraft((prev) => ({ ...prev, disputeStatus: v }))}
          options={Object.entries(DISPUTE_STATUS).map(([value, item]) => ({ value, label: item.text }))}
        />
        <Button type="primary" onClick={() => setQuery((prev) => ({ ...prev, pageNum: 1, ...draft }))}>搜索</Button>
        <Button onClick={() => { setDraft({}); setQuery({ pageNum: 1, pageSize: 10 }) }}>重置</Button>
      </div>
      <Table
        columns={columns}
        dataSource={data?.data?.records || []}
        loading={isLoading}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{
          current: data?.data?.current,
          total: data?.data?.total,
          pageSize: query.pageSize,
          onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
        }}
      />

      <Modal
        title={`了结纠纷${resolving ? ' · ' + resolving.disputeNo : ''}`}
        open={!!resolving}
        onCancel={() => setResolving(null)}
        onOk={submitResolve}
        confirmLoading={saving}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="这里处理的是「双方自己谈拢」"
          description="需要第三方调解或仲裁的，请走运营端的纠纷仲裁页。这里了结后纠纷状态变为「已解决」，不能重复处理。"
        />
        <Form form={form} layout="vertical">
          <Form.Item name="result" label="处理结果" rules={[{ required: true, message: '请选择处理结果' }]}>
            <Select
              placeholder="请选择"
              options={[
                { value: 'agreed', label: '双方达成和解' },
                { value: 'withdrawn', label: '申请人撤回' }
              ]}
            />
          </Form.Item>
          <Form.Item name="remark" label="说明">
            <Input.TextArea rows={3} placeholder="和解方案 / 撤回原因（可留空）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="纠纷详情"
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={null}
        width={720}
      >
        {viewing && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="纠纷编号">{viewing.disputeNo}</Descriptions.Item>
            <Descriptions.Item label="关联订单">{viewing.orderId}</Descriptions.Item>
            <Descriptions.Item label="申请人">{viewing.complainantName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="被申请人">{viewing.respondentName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="纠纷类型">{viewing.disputeType ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="索赔金额">{viewing.claimAmount != null ? `¥${viewing.claimAmount}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={DISPUTE_STATUS[viewing.disputeStatus]?.color ?? 'default'}>
                {DISPUTE_STATUS[viewing.disputeStatus]?.text ?? viewing.disputeStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前阶段">{viewing.processStage ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="纠纷事由" span={2}>{viewing.disputeReason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="纠纷描述" span={2}>{viewing.disputeDescription ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="调解结果" span={2}>{viewing.mediationResult ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="仲裁结果" span={2}>{viewing.arbitrationResult ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="了结时间">{viewing.closeTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="了结说明">{viewing.closeReason ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  )
}

export default DisputeList
