import { useEffect, useState } from 'react'
import { Alert, Table, Button, Card, Input, Select, Space, Rate, Modal, Form, message } from 'antd'
import { SearchOutlined, WarningOutlined, MessageOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getEvaluationList, appealEvaluation, replyEvaluation, type EvaluationQuery, type EvaluationVO } from '@/api/evaluation'
import { getMyMerchants } from '@/api/identity'

function EvaluationList() {
  const [query, setQuery] = useState<EvaluationQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ evaluationNo?: string; ratingOverall?: number }>({})
  // 我的经营主体：回复是**被评价方的官方回应**，服务端会判定"你是不是被评价方"，
  // 前端据此决定按钮显不显示（避免按钮点得动、点了被拒）。
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])
  const [replyRow, setReplyRow] = useState<EvaluationVO | null>(null)
  const [replying, setReplying] = useState(false)
  const [replyForm] = Form.useForm()

  useEffect(() => {
    getMyMerchants()
      .then((res) => {
        if (res?.code === 200) setMyMerchantIds((res.data ?? []).map((m) => String(m.merchantId)))
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  /** 我是被评价方、且还没回过 —— 才给回复入口。 */
  const canReply = (row: EvaluationVO) =>
    row.evaluateeId != null &&
    myMerchantIds.includes(String(row.evaluateeId)) &&
    !row.replyContent

  const submitReply = async () => {
    if (!replyRow) return
    const values = await replyForm.validateFields()
    setReplying(true)
    try {
      const res = await replyEvaluation(replyRow.id, values.content)
      if (res?.code === 200) {
        message.success('已回复')
        setReplyRow(null)
        replyForm.resetFields()
        refetch()
      } else {
        message.error(res?.message ?? '回复失败')
      }
    } catch {
      message.error('回复失败')
    } finally {
      setReplying(false)
    }
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['evaluations', query],
    queryFn: () => getEvaluationList(query),
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
    { title: '商家回复', dataIndex: 'replyContent', key: 'replyContent', width: 180, ellipsis: true,
      render: (v: string) => v ?? '—' },
    { title: '操作', key: 'action', width: 170, render: (_: unknown, row: EvaluationVO) => (
      <Space size={0}>
        {/*
          回复按钮接回来了：后端 PUT /evaluation/{id}/reply 一直都在，
          此前按钮没有 onClick 被我撤掉了。现在只在"我是被评价方、且还没回过"时出现
          （服务端也会判定，前端只是不让按钮点了被拒）。只允许回一次 ——
          官方回应被反复改写，买家那边看到的就不是当时的说法了。
          删除按钮仍然没有：后端没有这个接口，评价也不该由当事人删掉。
        */}
        {canReply(row) && (
          <Button type="link" icon={<MessageOutlined />}
            onClick={() => { setReplyRow(row); replyForm.resetFields() }}>回复</Button>
        )}
        <Button type="link" icon={<WarningOutlined />} onClick={() => setAppealRow(row)}>申诉</Button>
      </Space>
    )},
  ]

  return (
    <Card title="信用评价">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        {/* 搜索框与评分下拉此前都没有接：输了字点搜索没有任何变化。
            评分选项也改成库里真实存在的整星值 —— 原来那个 "1-2星" 是区间，
            后端按等值匹配，选它永远返回空。 */}
        <Input
          placeholder="评价编号"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setDraft((prev) => ({ ...prev, evaluationNo: e.target.value || undefined }))}
        />
        <Select
          placeholder="综合评分"
          style={{ width: 150 }}
          allowClear
          onChange={(v) => setDraft((prev) => ({ ...prev, ratingOverall: v }))}
          options={[5, 4, 3, 2, 1].map((v) => ({ value: v, label: `${v}星` }))}
        />
        <Button type="primary" onClick={() => setQuery((prev) => ({ ...prev, pageNum: 1, ...draft }))}>搜索</Button>
        <Button onClick={() => { setDraft({}); setQuery({ pageNum: 1, pageSize: 10 }) }}>重置</Button>
      </div>
      <Table
        columns={columns}
        dataSource={data?.data?.records || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: data?.data?.current,
          total: data?.data?.total,
          pageSize: query.pageSize,
          onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
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

      <Modal
        title={`回复评价${replyRow ? ' · ' + replyRow.evaluationNo : ''}`}
        open={!!replyRow}
        onCancel={() => setReplyRow(null)}
        onOk={submitReply}
        confirmLoading={replying}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="回复会以被评价方的名义公开展示"
          description="只能回复一次（官方回应被反复改写，买家看到的就不是当时的说法了）。需要修改请走申诉或联系运营。"
        />
        <Form form={replyForm} layout="vertical">
          <Form.Item name="content" label="回复内容" rules={[{ required: true, message: '请填写回复内容' }]}>
            <Input.TextArea rows={4} placeholder="例如：感谢反馈，我们已调整发货安排" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default EvaluationList

