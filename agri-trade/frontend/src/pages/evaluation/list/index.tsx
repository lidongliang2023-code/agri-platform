import { useState } from 'react'
import { Alert, Table, Button, Card, Input, Select, Space, Rate, Modal, Form, message } from 'antd'
import { SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getEvaluationList, appealEvaluation, type EvaluationVO } from '@/api/evaluation'

function EvaluationList() {
  const { data, isLoading } = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => getEvaluationList({ pageNum: 1, pageSize: 10 }),
  })

  const [appealRow, setAppealRow] = useState<EvaluationVO | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  /**
   * 发起申诉。
   *
   * <p>只有被评价方可以申诉 —— 申诉一旦审核通过，这条评价会被置为 hidden，
   * 那是"把别人的公开评价抹掉"的权力，所以判定放在服务端，前端只把理由传上去。</p>
   */
  const submitAppeal = async () => {
    if (!appealRow) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await appealEvaluation(appealRow.id, values)
      if (res?.code === 200) {
        message.success('申诉已提交，等待运营审核')
        setAppealRow(null)
        form.resetFields()
      } else {
        message.error(res?.message ?? '申诉失败')
      }
    } catch {
      message.error('申诉失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: '评价编号', dataIndex: 'evaluationNo', key: 'evaluationNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    { title: '评价人', dataIndex: 'evaluatorName', key: 'evaluatorName' },
    { title: '被评价人', dataIndex: 'evaluateeName', key: 'evaluateeName' },
    { title: '综合评分', dataIndex: 'ratingOverall', key: 'ratingOverall', 
      render: (rating: number) => <Rate disabled defaultValue={rating} />
    },
    { title: '评价内容', dataIndex: 'evaluationContent', key: 'evaluationContent', ellipsis: true },
    { title: '状态', dataIndex: 'evaluationStatus', key: 'evaluationStatus',
      render: (status: string) => status === 'hidden' ? 
        <span style={{ color: '#999' }}>已隐藏</span> : 
        <span style={{ color: '#52c41a' }}>展示中</span>
    },
  // 评价本身没有申诉字段：申诉是独立的 agri_trade_evaluation_appeal 表（有单独的接口）。
  // 这里原先读 appealStatus，而接口里根本没有这个键 —— 一列永远空白。
  { title: '是否匿名', dataIndex: 'isAnonymous', key: 'isAnonymous',
      // isAnonymous 是 0/1，不是原来的申诉状态串 —— 渲染逻辑跟着字段一起改，
      // 否则三种分支都对不上、整列只会显示"已处理"
      render: (val: number) => (val === 1
        ? <span style={{ color: '#999' }}>匿名</span>
        : <span style={{ color: '#52c41a' }}>实名</span>)
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '操作', key: 'action', width: 150, render: (_: unknown, row: EvaluationVO) => (
      <Space size={0}>
        {/*
          只留"申诉"这一个真实动作：回复/详情/删除三个按钮此前都没有 onClick，
          点了什么都不发生 —— 与其留着骗人，不如先撤掉，等在做的页面补齐再挂回来。
        */}
        <Button type="link" icon={<WarningOutlined />} onClick={() => setAppealRow(row)}>申诉</Button>
      </Space>
    )},
  ]

  return (
    <Card title="信用评价">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="评价编号/订单号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="评分" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: '5', label: '5星' },
          { value: '4', label: '4星' },
          { value: '3', label: '3星' },
          { value: '1-2', label: '1-2星' },
        ]} />
        <Button type="primary">搜索</Button>
      </div>
      <Table 
        columns={columns} 
        dataSource={data?.data?.records || []} 
        loading={isLoading}
        rowKey="id" 
        pagination={{
          current: data?.data?.current,
          total: data?.data?.total,
          pageSize: 10,
        }}
      />

      <Modal
        title={`评价申诉${appealRow ? ' · ' + appealRow.evaluationNo : ''}`}
        open={!!appealRow}
        onCancel={() => setAppealRow(null)}
        onOk={submitAppeal}
        confirmLoading={saving}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="申诉由被评价方发起"
          description="运营审核通过后，这条评价会被隐藏。只有被评价的经营主体能对这条评价提申诉。"
        />
        <Form form={form} layout="vertical">
          <Form.Item name="appealType" label="申诉类型" rules={[{ required: true, message: '请选择申诉类型' }]}>
            <Select
              placeholder="请选择"
              options={[
                { value: 'false_content', label: '内容不实' },
                { value: 'not_my_order', label: '评价的不是本单' },
                { value: 'malicious', label: '恶意差评' },
                { value: 'other', label: '其它' }
              ]}
            />
          </Form.Item>
          <Form.Item name="appealReason" label="申诉理由" rules={[{ required: true, message: '请填写申诉理由' }]}>
            <Input.TextArea rows={3} placeholder="请说明情况，便于运营判断" />
          </Form.Item>
          <Form.Item name="appealEvidence" label="证据说明">
            <Input.TextArea rows={2} placeholder="例如：聊天记录、质检报告编号（可留空）" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default EvaluationList

