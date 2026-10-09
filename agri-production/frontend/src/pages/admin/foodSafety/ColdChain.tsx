/**
 * 页面名称：冷链资源撮合
 * 路由路径：/admin/production/food-safety/cold-chain
 * 所属模块：食品安全
 * 原型 pageId：food-safety-cold-chain（PRD 外，原型补充页面 P19）
 *
 * 原型结构：统计卡（冷链资源总量 156 / 可用 98 / 繁忙 42 / 离线·故障 16 / 撮合成功率 85.3%）
 * → 冷链资源卡（名称 / 类型 / 温区 / 位置 / 状态 / 评分 / 立即撮合·加入队列 / 详情）
 * → 撮合记录（撮合编号 | 需求方 | 资源方 | 资源类型 | 时间 | 状态）。
 */
import { useState } from 'react'
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Rate,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  HomeOutlined,
  SearchOutlined,
  ShopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  COLD_CHAIN_STATUS_COLOR,
  COLD_CHAIN_STATUS_TEXT,
  createMatch,
  enqueueResource,
  getColdChainStats,
  isMockSource,
  listColdChainResources,
  listMatchRecords,
} from '@/api/admin/foodSafety'
import type {
  ColdChainResource,
  ColdChainResourceType,
  ColdChainStatus,
  MatchRecord,
} from '@/api/admin/foodSafety'

const { Text, Title } = Typography

/** 资源类型下拉选项 */
const TYPE_OPTIONS: Array<{ value: ColdChainResourceType | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'vehicle', label: '冷链车' },
  { value: 'warehouse', label: '冷库' },
]

/** 资源状态下拉选项 */
const STATUS_OPTIONS: Array<{ value: ColdChainStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'idle', label: '空闲' },
  { value: 'busy', label: '繁忙' },
  { value: 'offline', label: '离线·故障' },
]

/** 城市下拉选项（资源池覆盖范围） */
const CITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部' },
  { value: '郑州', label: '郑州' },
  { value: '洛阳', label: '洛阳' },
  { value: '开封', label: '开封' },
  { value: '新乡', label: '新乡' },
  { value: '许昌', label: '许昌' },
  { value: '焦作', label: '焦作' },
  { value: '商丘', label: '商丘' },
  { value: '周口', label: '周口' },
  { value: '信阳', label: '信阳' },
  { value: '南阳', label: '南阳' },
  { value: '安阳', label: '安阳' },
]

/** 需求方下拉选项 */
const DEMANDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '绿源农业', label: '绿源农业' },
  { value: '丰达农场', label: '丰达农场' },
  { value: '大地种业', label: '大地种业' },
  { value: '惠民种植', label: '惠民种植' },
  { value: '金穗合作社', label: '金穗合作社' },
  { value: '中原牧业', label: '中原牧业' },
  { value: '沃土农场', label: '沃土农场' },
  { value: '新农合作社', label: '新农合作社' },
]

/** 撮合状态文案 */
const MATCH_STATUS_TEXT: Record<MatchRecord['status'], string> = {
  processing: '进行中',
  done: '已完成',
  queued: '排队中',
}

/** 撮合状态 Tag 颜色 */
const MATCH_STATUS_COLOR: Record<MatchRecord['status'], string> = {
  processing: 'gold',
  done: 'green',
  queued: 'blue',
}

/** 撮合表单字段 */
interface MatchFormValues {
  /** 需求方 */
  demander: string
  /** 货物 / 用途 */
  cargo: string
  /** 预约开始时间 */
  startTime: dayjs.Dayjs
  /** 温区要求 */
  tempRequire: string
  /** 备注 */
  remark?: string
}

/** 排队表单字段 */
interface QueueFormValues {
  /** 需求方 */
  demander: string
  /** 期望使用时间 */
  expectTime: dayjs.Dayjs
  /** 备注 */
  remark?: string
}

/**
 * 冷链资源撮合
 *
 * 业务职责：汇聚冷链车辆与冷库资源，按类型、所在地与状态检索资源池，支持空闲资源
 * 「立即撮合」、繁忙资源「加入队列」，并跟踪撮合记录。
 * 数据优先取后端 /admin/food-safety/cold-chain/*，接口未就绪时降级到原型示例口径
 * （原型 P19 / 4.2：资源总量 156，可用 98，繁忙 42，离线故障 16，撮合成功率 85.3%）。
 *
 * @returns 页面内容
 */
export default function ColdChain(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 资源类型筛选 */
  const [type, setType] = useState<ColdChainResourceType | 'all'>('all')
  /** 资源状态筛选 */
  const [status, setStatus] = useState<ColdChainStatus | 'all'>('all')
  /** 城市筛选 */
  const [city, setCity] = useState<string>('')
  /** 资源页码 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 资源每页条数（资源卡） */
  const [pageSize, setPageSize] = useState<number>(8)
  /** 撮合记录页码 */
  const [matchPageNum, setMatchPageNum] = useState<number>(1)
  /** 撮合记录每页条数 */
  const [matchPageSize, setMatchPageSize] = useState<number>(10)
  /** 撮合弹窗当前资源 */
  const [matchTarget, setMatchTarget] = useState<ColdChainResource | null>(null)
  /** 排队弹窗当前资源 */
  const [queueTarget, setQueueTarget] = useState<ColdChainResource | null>(null)
  /** 详情抽屉当前资源 */
  const [detailTarget, setDetailTarget] = useState<ColdChainResource | null>(null)
  /** 撮合表单 */
  const [matchForm] = Form.useForm<MatchFormValues>()
  /** 排队表单 */
  const [queueForm] = Form.useForm<QueueFormValues>()

  /** 冷链资源统计 */
  const statsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'cold-chain', 'stats'],
    queryFn: () => getColdChainStats(),
    retry: false,
  })

  /** 冷链资源列表 */
  const listQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'cold-chain', 'resources', type, status, city, pageNum, pageSize],
    queryFn: () => listColdChainResources({ pageNum, pageSize, type, status, city: city || undefined }),
    retry: false,
  })

  /** 撮合记录列表 */
  const matchQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'cold-chain', 'matches', matchPageNum, matchPageSize],
    queryFn: () => listMatchRecords({ pageNum: matchPageNum, pageSize: matchPageSize, status: 'all' }),
    retry: false,
  })

  /** 立即撮合 */
  const matchMutation = useMutation({
    mutationFn: (payload: { resourceId: string; values: MatchFormValues }) =>
      createMatch({
        resourceId: payload.resourceId,
        demander: payload.values.demander,
        cargo: payload.values.cargo,
        startTime: payload.values.startTime.format('YYYY-MM-DD'),
        tempRequire: payload.values.tempRequire,
        remark: payload.values.remark,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'cold-chain'] })
      message.success('撮合已发起，撮合记录已生成')
      setMatchTarget(null)
      matchForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '撮合发起失败，请稍后重试')
    },
  })

  /** 加入队列 */
  const queueMutation = useMutation({
    mutationFn: (payload: { resourceId: string; values: QueueFormValues }) =>
      enqueueResource({
        resourceId: payload.resourceId,
        demander: payload.values.demander,
        expectTime: payload.values.expectTime.format('YYYY-MM-DD'),
        remark: payload.values.remark,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'cold-chain'] })
      message.success('已加入撮合队列')
      setQueueTarget(null)
      queueForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '加入队列失败，请稍后重试')
    },
  })

  /** 资源列表 */
  const resources = listQuery.data?.list ?? []
  /** 统计数据 */
  const stats = statsQuery.data
  /** 撮合记录 */
  const matchRecords = matchQuery.data?.list ?? []

  /** 撮合记录表格列（原型 P19 撮合记录列顺序） */
  const matchColumns: ColumnsType<MatchRecord> = [
    { title: '撮合编号', dataIndex: 'id', width: 120 },
    { title: '需求方', dataIndex: 'demander', width: 140 },
    { title: '资源方', dataIndex: 'supplier', width: 160 },
    { title: '资源类型', dataIndex: 'resourceType', width: 110 },
    { title: '货物 / 用途', dataIndex: 'cargo', width: 160 },
    { title: '时间', dataIndex: 'time', width: 110 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: MatchRecord['status']) => (
        <Tag color={MATCH_STATUS_COLOR[value]}>{MATCH_STATUS_TEXT[value]}</Tag>
      ),
    },
  ]

  return (
    <div>
      {/* 面包屑 + 标题（原型 P19 顶部栏） */}
      <div style={{ marginBottom: 12 }}>
        <Breadcrumb
          style={{ marginBottom: 4 }}
          items={[
            { href: '/admin/production/dashboard', title: <HomeOutlined /> },
            { title: '食品安全' },
            { title: '冷链资源撮合' },
          ]}
        />
        <Title level={4} style={{ margin: 0 }}>
          冷链资源撮合
        </Title>
        <Text type="secondary">冷链车与冷库资源池展示、撮合匹配与预约</Text>
      </div>

      {/* 示例数据明示（食品安全为合规强相关数据，禁止静默降级） */}
      {isMockSource('cold-chain-stats', 'cold-chain-resources', 'match-records') && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message="当前展示示例数据，后端接口建设中"
          description="冷链资源状态与撮合记录直接影响温控合规举证：资源池、评分与撮合记录均为演示用示例（口径 156/98/42/16 取自原型 4.2），不可作为冷链履约凭证。后端 /admin/food-safety/cold-chain/* 接口上线后本页将自动切换真实数据。"
        />
      )}

      {(statsQuery.isError || listQuery.isError || matchQuery.isError) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="部分数据获取失败，已切换为示例数据展示"
        />
      )}

      {/* 统计卡（原型 P19 Stat Cards） */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic title="冷链资源总量" value={stats?.total ?? 0} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic title="可用" value={stats?.available ?? 0} suffix="个" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic title="繁忙" value={stats?.busy ?? 0} suffix="个" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card loading={statsQuery.isLoading}>
            <Statistic title="离线·故障" value={stats?.offline ?? 0} suffix="个" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic
              title="撮合成功率"
              value={stats?.matchRate ?? 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选器 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Text>资源类型：</Text>
            <Select
              style={{ width: 120 }}
              value={type}
              options={TYPE_OPTIONS}
              onChange={(value: ColdChainResourceType | 'all') => {
                setType(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Space size={4}>
            <Text>状态：</Text>
            <Select
              style={{ width: 120 }}
              value={status}
              options={STATUS_OPTIONS}
              onChange={(value: ColdChainStatus | 'all') => {
                setStatus(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Space size={4}>
            <Text>所在地：</Text>
            <Select
              style={{ width: 120 }}
              value={city}
              options={CITY_OPTIONS}
              onChange={(value: string) => {
                setCity(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPageNum(1)
              void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'cold-chain'] })
            }}
          >
            查询
          </Button>
          <Button
            onClick={() => {
              setType('all')
              setStatus('all')
              setCity('')
              setPageNum(1)
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 冷链资源卡片（原型 P19 Resource Cards） */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {listQuery.isLoading ? (
          Array.from({ length: 4 }, (_unused, index) => (
            <Col xs={24} sm={12} xl={6} key={`skeleton-${index}`}>
              <Card loading />
            </Col>
          ))
        ) : resources.length === 0 ? (
          <Col span={24}>
            <Card>
              <Empty description="当前筛选条件下暂无冷链资源" />
            </Card>
          </Col>
        ) : (
          resources.map((item) => (
            <Col xs={24} sm={12} xl={6} key={item.id}>
              <Card
                size="small"
                title={
                  <Space size={6}>
                    <Text>{item.type === 'vehicle' ? '🚛' : '🏪'}</Text>
                    <Text strong>{item.name}</Text>
                  </Space>
                }
                extra={<Tag color={COLD_CHAIN_STATUS_COLOR[item.status]}>{COLD_CHAIN_STATUS_TEXT[item.status]}</Tag>}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text type="secondary">
                    类型：{item.typeLabel} · {item.spec}
                  </Text>
                  <Text type="secondary">温区：{item.tempRange}</Text>
                  <Text type="secondary">
                    位置：{item.city} · {item.district}
                  </Text>
                  <Space size={4}>
                    <Text type="secondary">评分：</Text>
                    <Rate disabled allowHalf value={item.rating} style={{ fontSize: 14 }} />
                    <Text strong>{item.rating.toFixed(1)}</Text>
                  </Space>
                </Space>
                <div style={{ marginTop: 12 }}>
                  <Space size={8}>
                    {item.status === 'offline' ? (
                      <Button size="small" disabled>
                        暂不可用
                      </Button>
                    ) : item.status === 'busy' ? (
                      <Button
                        size="small"
                        icon={<ShopOutlined />}
                        onClick={() => {
                          setQueueTarget(item)
                          queueForm.setFieldsValue({ demander: DEMANDER_OPTIONS[0].value, remark: '' })
                        }}
                      >
                        加入队列
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                          setMatchTarget(item)
                          matchForm.setFieldsValue({
                            demander: DEMANDER_OPTIONS[0].value,
                            tempRequire: item.tempRange,
                            remark: '',
                          })
                        }}
                      >
                        立即撮合
                      </Button>
                    )}
                    <Button size="small" onClick={() => setDetailTarget(item)}>
                      详情
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          ))
        )}
      </Row>

      {/* 资源分页 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text type="secondary">共 {listQuery.data?.total ?? 0} 个冷链资源</Text>
          </Col>
          <Col>
            <Space>
              <Button
                size="small"
                disabled={pageNum <= 1}
                onClick={() => setPageNum((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </Button>
              <Text>
                {pageNum} / {listQuery.data?.pages ?? 1}
              </Text>
              <Button
                size="small"
                disabled={pageNum >= (listQuery.data?.pages ?? 1)}
                onClick={() => setPageNum((prev) => prev + 1)}
              >
                下一页
              </Button>
              <Select
                size="small"
                style={{ width: 110 }}
                value={pageSize}
                options={[
                  { value: 8, label: '8 个/页' },
                  { value: 12, label: '12 个/页' },
                  { value: 16, label: '16 个/页' },
                ]}
                onChange={(value: number) => {
                  setPageSize(value)
                  setPageNum(1)
                }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 撮合记录（原型 P19 Match Records） */}
      <Card title="撮合记录">
        <Table<MatchRecord>
          rowKey="id"
          size="middle"
          loading={matchQuery.isLoading}
          columns={matchColumns}
          dataSource={matchRecords}
          locale={{ emptyText: <Empty description="暂无撮合记录" /> }}
          pagination={{
            current: matchPageNum,
            pageSize: matchPageSize,
            total: matchQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条`,
            onChange: (page: number, size: number) => {
              setMatchPageNum(page)
              setMatchPageSize(size)
            },
          }}
        />
      </Card>

      {/* 资源详情抽屉 */}
      <Drawer
        open={detailTarget !== null}
        title="冷链资源详情"
        width={480}
        onClose={() => setDetailTarget(null)}
      >
        {detailTarget && (
          <Descriptions column={1} size="small" bordered items={[
            { key: 'id', label: '资源编号', children: detailTarget.id },
            { key: 'name', label: '资源名称', children: detailTarget.name },
            {
              key: 'type',
              label: '资源类型',
              children: `${detailTarget.typeLabel} · ${detailTarget.spec}`,
            },
            { key: 'temp', label: '适用温区', children: detailTarget.tempRange },
            { key: 'location', label: '所在地', children: `${detailTarget.city} · ${detailTarget.district}` },
            {
              key: 'status',
              label: '资源状态',
              children: (
                <Tag color={COLD_CHAIN_STATUS_COLOR[detailTarget.status]}>
                  {COLD_CHAIN_STATUS_TEXT[detailTarget.status]}
                </Tag>
              ),
            },
            {
              key: 'rating',
              label: '服务评分',
              children: (
                <Space size={4}>
                  <Rate disabled allowHalf value={detailTarget.rating} style={{ fontSize: 14 }} />
                  <Text>{detailTarget.rating.toFixed(1)}</Text>
                </Space>
              ),
            },
            { key: 'contact', label: '联系人', children: detailTarget.contact },
            { key: 'phone', label: '联系电话', children: detailTarget.phone },
            { key: 'maintain', label: '最近保养日期', children: detailTarget.lastMaintainDate },
          ]} />
        )}
      </Drawer>

      {/* 立即撮合弹窗 */}
      <Modal
        open={matchTarget !== null}
        title="发起冷链资源撮合"
        okText="提交撮合"
        cancelText="取消"
        confirmLoading={matchMutation.isPending}
        onCancel={() => setMatchTarget(null)}
        onOk={() => {
          void matchForm.validateFields().then((values) => {
            if (!matchTarget) {
              return
            }
            matchMutation.mutate({ resourceId: matchTarget.id, values })
          })
        }}
      >
        {matchTarget && (
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${matchTarget.name}（${matchTarget.typeLabel} · ${matchTarget.spec}）`}
              description={`适用温区：${matchTarget.tempRange}　所在地：${matchTarget.city} · ${matchTarget.district}`}
            />
            <Form form={matchForm} layout="vertical">
              <Form.Item name="demander" label="需求方" rules={[{ required: true, message: '请选择需求方' }]}>
                <Select placeholder="请选择需求方" options={DEMANDER_OPTIONS} />
              </Form.Item>
              <Form.Item name="cargo" label="货物 / 用途" rules={[{ required: true, message: '请输入货物或用途' }]}>
                <Input placeholder="例如：有机蔬菜 50kg" maxLength={50} />
              </Form.Item>
              <Form.Item
                name="startTime"
                label="预约时间"
                rules={[
                  { required: true, message: '请选择预约时间' },
                  {
                    validator: (_rule: unknown, value: dayjs.Dayjs) =>
                      value && !value.isBefore(dayjs(), 'day')
                        ? Promise.resolve()
                        : Promise.reject(new Error('预约时间不能早于今天')),
                  },
                ]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择预约时间" />
              </Form.Item>
              <Form.Item name="tempRequire" label="温区要求" rules={[{ required: true, message: '请输入温区要求' }]}>
                <Input placeholder="例如：0°C ~ 4°C" maxLength={30} />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="选填，如配送路线、装卸要求" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 加入队列弹窗 */}
      <Modal
        open={queueTarget !== null}
        title="加入撮合队列"
        okText="加入队列"
        cancelText="取消"
        confirmLoading={queueMutation.isPending}
        onCancel={() => setQueueTarget(null)}
        onOk={() => {
          void queueForm.validateFields().then((values) => {
            if (!queueTarget) {
              return
            }
            queueMutation.mutate({ resourceId: queueTarget.id, values })
          })
        }}
      >
        {queueTarget && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${queueTarget.name} 当前处于「繁忙」状态`}
              description="加入队列后将在资源释放时按队列顺序自动撮合。"
            />
            <Form form={queueForm} layout="vertical">
              <Form.Item name="demander" label="需求方" rules={[{ required: true, message: '请选择需求方' }]}>
                <Select placeholder="请选择需求方" options={DEMANDER_OPTIONS} />
              </Form.Item>
              <Form.Item
                name="expectTime"
                label="期望使用时间"
                rules={[
                  { required: true, message: '请选择期望使用时间' },
                  {
                    validator: (_rule: unknown, value: dayjs.Dayjs) =>
                      value && !value.isBefore(dayjs(), 'day')
                        ? Promise.resolve()
                        : Promise.reject(new Error('期望使用时间不能早于今天')),
                  },
                ]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择期望使用时间" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="选填" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
