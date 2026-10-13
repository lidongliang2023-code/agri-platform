import { useState } from 'react'
import { Card, Table, Button, InputNumber, Space, Tag, Modal, Descriptions, message, Progress, Tabs } from 'antd'
import { SearchOutlined, SyncOutlined } from '@ant-design/icons'
import { matchDemandToProducts, getMatchList, MatchResult, MatchRecordVO } from '@/api/match'

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
  // 历史记录单独一份状态：它来自 /match/list（撮合记录表），字段与匹配结果并不相同
  const [historyRows, setHistoryRows] = useState<MatchRecordVO[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyShown, setHistoryShown] = useState(false)

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

  /**
   * 查看历史记录。
   *
   * <p>原先这里在没填需求ID时直接提示"请输入需求ID"就返回了，等于这个按钮默认按不动；
   * 而且它调的是 /match/demand/{id}/records。现在改成走 /match/list ——
   * 范围由**服务端**按当前账号绑定的经营主体推导（我发布的需求 / 我发布的货源参与的撮合），
   * 不填需求ID也能看"与我相关的撮合记录"，填了就再加一层筛选。</p>
   */
  const handleViewRecords = async () => {
    setHistoryLoading(true)
    try {
      const res = await getMatchList({ pageNum: 1, pageSize: 10, demandId })
      if (res.code === 200) {
        setHistoryRows(res.data?.records || [])
        setHistoryShown(true)
        if (!res.data?.total) {
          message.info('没有查到与你相关的撮合记录')
        }
      } else {
        message.error(res.message || '获取记录失败')
      }
    } catch (error) {
      message.error('获取记录失败')
    } finally {
      setHistoryLoading(false)
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
          <Button icon={<SyncOutlined />} loading={historyLoading} onClick={handleViewRecords}>
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

      {/* 历史记录：选中需求ID时是"这张需求的撮合记录"，不填则是"与我相关的全部撮合记录" */}
      {historyShown && (
        <Card
          title={`撮合历史记录 ${historyRows.length} 条`}
          style={{ marginBottom: 16 }}
          extra={<span style={{ color: '#999', fontSize: 12 }}>范围：与我发布的需求 / 货源相关的撮合</span>}
        >
          <Table
            rowKey="id"
            loading={historyLoading}
            dataSource={historyRows}
            scroll={{ x: 1100 }}
            pagination={false}
            columns={[
              { title: '匹配编号', dataIndex: 'matchNo', key: 'matchNo', width: 170 },
              { title: '采购需求', dataIndex: 'demandName', key: 'demandName', width: 160,
                render: (v: string, row: MatchRecordVO) => v ?? row.demandNo ?? row.demandId ?? '—' },
              { title: '货源', dataIndex: 'productName', key: 'productName', width: 180,
                render: (v: string) => v ?? '—' },
              { title: '供应商', dataIndex: 'sellerName', key: 'sellerName', width: 160,
                render: (v: string) => v ?? '—' },
              { title: '撮合分数', dataIndex: 'matchScore', key: 'matchScore', width: 110,
                render: (v: number) => (v == null ? '—' : `${v}分`) },
              // 记录上回写的是"走到哪一步"，所以看的是询价/订单两个状态，
              // 而不是原来那个记录表里根本不存在的 matchStatus
              { title: '询价状态', dataIndex: 'inquiryStatus', key: 'inquiryStatus', width: 110,
                render: (v: string) => v ?? '未询价' },
              { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 110,
                render: (v: string) => v ?? '未成单' },
              { title: '匹配原因', dataIndex: 'matchReason', key: 'matchReason', ellipsis: true },
              { title: '生成时间', dataIndex: 'createTime', key: 'createTime', width: 170 }
            ]}
          />
        </Card>
      )}

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
