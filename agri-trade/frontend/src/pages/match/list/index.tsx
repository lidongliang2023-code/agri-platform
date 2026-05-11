import { useState } from 'react'
import { Card, Table, Button, InputNumber, Space, Tag, Modal, Descriptions, message, Progress, Tabs } from 'antd'
import { SearchOutlined, SyncOutlined } from '@ant-design/icons'
import { matchDemandToProducts, getMatchRecordsByDemand, MatchResult } from '@/api/match'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'warning', text: '待处理' },
  matched: { color: 'processing', text: '已匹配' },
  accepted: { color: 'success', text: '已接受' },
  rejected: { color: 'error', text: '已拒绝' },
}

export default function MatchList() {
  const [demandId, setDemandId] = useState<number>()
  const [loading, setLoading] = useState(false)
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<MatchResult | null>(null)

  const handleMatch = async () => {
    if (!demandId) {
      message.warning('请输入需求ID')
      return
    }
    setLoading(true)
    try {
      const res = await matchDemandToProducts(demandId, 10)
      if (res.code === 200) {
        setMatchResults(res.data || [])
        message.success('匹配成功')
      } else {
        message.error(res.message || '匹配失败')
      }
    } catch (error) {
      message.error('匹配失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewRecords = async () => {
    if (!demandId) {
      message.warning('请输入需求ID')
      return
    }
    setLoading(true)
    try {
      const res = await getMatchRecordsByDemand(demandId)
      if (res.code === 200) {
        setMatchResults(res.data || [])
      } else {
        message.error(res.message || '获取记录失败')
      }
    } catch (error) {
      message.error('获取记录失败')
    } finally {
      setLoading(false)
    }
  }

  const showDetail = (record: MatchResult) => {
    setCurrentRecord(record)
    setDetailVisible(true)
  }

  const columns = [
    { title: '匹配编号', dataIndex: 'matchNo', key: 'matchNo', width: 150 },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    { title: '供应商', dataIndex: 'sellerName', key: 'sellerName' },
    {
      title: '匹配分数',
      dataIndex: 'matchScore',
      key: 'matchScore',
      width: 150,
      render: (score: number) => (
        <Progress
          percent={score}
          size="small"
          status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'}
          format={(percent) => `${percent?.toFixed(1)}分`}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'matchStatus',
      key: 'matchStatus',
      width: 100,
      render: (status: string) => {
        const { color, text } = statusMap[status] || { color: 'default', text: status }
        return <Tag color={color}>{text}</Tag>
      },
    },
    { title: '匹配原因', dataIndex: 'matchReason', key: 'matchReason', ellipsis: true },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: MatchResult) => (
        <Button type="link" onClick={() => showDetail(record)}>
          详情
        </Button>
      ),
    },
  ]

  const scoreColumns = [
    { title: '品类评分', dataIndex: 'categoryScore', key: 'categoryScore', render: (v: number) => `${v}分` },
    { title: '价格评分', dataIndex: 'priceScore', key: 'priceScore', render: (v: number) => `${v}分` },
    { title: '距离评分', dataIndex: 'distanceScore', key: 'distanceScore', render: (v: number) => `${v}分` },
    { title: '质量评分', dataIndex: 'qualityScore', key: 'qualityScore', render: (v: number) => `${v}分` },
  ]

  return (
    <div>
      <Card title="智能匹配" style={{ marginBottom: 16 }}>
        <Space>
          <span>需求ID：</span>
          <InputNumber
            placeholder="请输入需求ID"
            value={demandId}
            onChange={(v) => setDemandId(v || undefined)}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleMatch}>
            开始匹配
          </Button>
          <Button icon={<SyncOutlined />} loading={loading} onClick={handleViewRecords}>
            查看历史记录
          </Button>
        </Space>
      </Card>

      <Card title="匹配结果">
        <Tabs
          items={[
            {
              key: 'list',
              label: '列表视图',
              children: (
                <Table
                  columns={columns}
                  dataSource={matchResults}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'score',
              label: '评分详情',
              children: (
                <Table
                  columns={[
                    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
                    ...scoreColumns,
                    { title: '综合评分', dataIndex: 'matchScore', key: 'matchScore', render: (v: number) => <strong>{v}分</strong> },
                  ]}
                  dataSource={matchResults}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="匹配详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentRecord && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="匹配编号">{currentRecord.matchNo}</Descriptions.Item>
            <Descriptions.Item label="产品名称">{currentRecord.productName}</Descriptions.Item>
            <Descriptions.Item label="供应商">{currentRecord.sellerName}</Descriptions.Item>
            <Descriptions.Item label="综合评分">{currentRecord.matchScore}分</Descriptions.Item>
            <Descriptions.Item label="品类评分">{currentRecord.categoryScore}分</Descriptions.Item>
            <Descriptions.Item label="价格评分">{currentRecord.priceScore}分</Descriptions.Item>
            <Descriptions.Item label="距离评分">{currentRecord.distanceScore}分</Descriptions.Item>
            <Descriptions.Item label="质量评分">{currentRecord.qualityScore}分</Descriptions.Item>
            <Descriptions.Item label="匹配原因" span={2}>{currentRecord.matchReason}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{currentRecord.createTime}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[currentRecord.matchStatus]?.color}>
                {statusMap[currentRecord.matchStatus]?.text}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}