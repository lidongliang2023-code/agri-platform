/**
 * 页面名称：合规校验管理
 * 路由路径：/admin/production/food-safety/compliance
 * 所属模块：食品安全
 * 原型 pageId：food-safety-compliance（PRD 外，原型补充页面 P17）
 *
 * 原型结构：Tab（投入品合规 / 标签合规 / 标准校验）。
 * - Tab1「投入品合规」按原型还原：记录编号 | 农场 | 投入品 | 类型 | 用量 | 校验结果 | 违规项 | 操作
 * - Tab2「标签合规」与 Tab3「标准校验」原型仅有一行占位文案
 *   （"标签合规模块 - 产品标签信息校验"、"标准合规模块 - 行业标准自动校验"），
 *   **原型未展开，此处为补充设计**，字段与交互见各 Tab 内部注释。
 */
import { useState } from 'react'
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  HomeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import {
  STANDARD_LIBRARY,
  getStandardCheckSummary,
  listInputCompliance,
  listLabelCompliance,
  listStandardCheckItems,
  listStandardLibrary,
  isMockSource,
  notifyLabelRectify,
  punishInputCompliance,
  runStandardCheck,
} from '@/api/admin/foodSafety'
import type {
  ComplianceResult,
  InputComplianceRecord,
  LabelCheckResult,
  LabelComplianceRecord,
  MarkingResult,
  RectifyStatus,
  StandardCheckItem,
  StandardCheckSummary,
  StandardLibraryItem,
} from '@/api/admin/foodSafety'

const { Text, Title } = Typography

/** 校验结果文案 */
const RESULT_TEXT: Record<ComplianceResult, string> = {
  pass: '合规',
  over: '超标',
}

/** 标识合规性文案 */
const MARKING_TEXT: Record<MarkingResult, string> = {
  compliant: '合规',
  violation: '违规',
}

/** 标识合规性 Tag 颜色 */
const MARKING_COLOR: Record<MarkingResult, string> = {
  compliant: 'green',
  violation: 'red',
}

/** 校验结果 Tag 颜色 */
const CHECK_COLOR: Record<LabelCheckResult, string> = {
  pass: 'green',
  fail: 'red',
}

/** 整改状态文案 */
const RECTIFY_TEXT: Record<RectifyStatus, string> = {
  none: '无需整改',
  notified: '已下发整改',
  done: '已整改',
}

/** 整改状态 Tag 颜色 */
const RECTIFY_COLOR: Record<RectifyStatus, string> = {
  none: 'default',
  notified: 'gold',
  done: 'green',
}

/** 处罚方式下拉选项 */
const PUNISH_OPTIONS: string[] = ['警告并限期整改', '罚款并暂停供货', '列入重点监管名单', '移交执法部门']

/** 校验批次范围下拉选项（补充设计） */
const BATCH_SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'last7d', label: '近 7 天批次' },
  { value: 'last30d', label: '近 30 天批次' },
  { value: 'quarter', label: '本季度全部批次' },
]

/* ==================== Tab1 投入品合规 ==================== */

/**
 * 投入品合规 Tab
 *
 * 业务职责：维护投入品（肥料 / 农药 / 除草剂等）使用台账的合规校验结果，
 * 对超标记录发起处罚。数据优先取后端 /admin/food-safety/compliance/inputs，
 * 接口未就绪时降级到原型示例数据。
 *
 * @returns Tab 内容
 */
function InputComplianceTab(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 校验结果筛选 */
  const [result, setResult] = useState<ComplianceResult | 'all'>('all')
  /** 农场关键字 */
  const [farmName, setFarmName] = useState<string>('')
  /** 页码 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 每页条数 */
  const [pageSize, setPageSize] = useState<number>(10)
  /** 详情弹窗记录 */
  const [detail, setDetail] = useState<InputComplianceRecord | null>(null)
  /** 处罚弹窗记录 */
  const [punishTarget, setPunishTarget] = useState<InputComplianceRecord | null>(null)
  /** 处罚表单 */
  const [punishForm] = Form.useForm<{ action: string; amount: number; remark: string }>()

  /** 投入品合规台账 */
  const listQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'inputs', result, farmName, pageNum, pageSize],
    queryFn: () => listInputCompliance({ pageNum, pageSize, result, farmName }),
    retry: false,
  })

  /** 台账统计（一次性取全量后本地汇总） */
  const statsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'inputs', 'stats'],
    queryFn: () => listInputCompliance({ pageNum: 1, pageSize: 1000, result: 'all' }),
    retry: false,
  })

  /** 处罚提交 */
  const punishMutation = useMutation({
    mutationFn: (payload: { id: string; action: string; amount: number; remark: string }) =>
      punishInputCompliance(payload.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'compliance', 'inputs'] })
      message.success('处罚已登记')
      setPunishTarget(null)
      punishForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '处罚登记失败，请稍后重试')
    },
  })

  /** 全量数据 */
  const allRecords = statsQuery.data?.list ?? []
  /** 合规条数 */
  const passCount = allRecords.filter((item) => item.result === 'pass').length
  /** 超标条数 */
  const overCount = allRecords.filter((item) => item.result === 'over').length
  /** 合规率 */
  const passRate = allRecords.length > 0 ? Math.round((passCount / allRecords.length) * 1000) / 10 : 0

  /** 表格列（原型 P17 Tab1 列顺序） */
  const columns: ColumnsType<InputComplianceRecord> = [
    { title: '记录编号', dataIndex: 'id', width: 120 },
    { title: '农场', dataIndex: 'farmName', width: 130 },
    { title: '投入品', dataIndex: 'inputName', width: 130 },
    { title: '类型', dataIndex: 'inputType', width: 110 },
    { title: '用量', dataIndex: 'dosage', width: 120 },
    {
      title: '校验结果',
      dataIndex: 'result',
      width: 110,
      render: (value: ComplianceResult) =>
        value === 'pass' ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            ✅ {RESULT_TEXT[value]}
          </Tag>
        ) : (
          <Tag color="red" icon={<CloseCircleOutlined />}>
            ❌ {RESULT_TEXT[value]}
          </Tag>
        ),
    },
    {
      title: '违规项',
      dataIndex: 'violation',
      render: (value: string) => (value === '—' ? <Text type="secondary">—</Text> : <Text type="danger">{value}</Text>),
    },
    { title: '校验日期', dataIndex: 'checkDate', width: 120 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, record: InputComplianceRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(record)}>
            查看
          </Button>
          {record.result === 'over' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<WarningOutlined />}
              onClick={() => {
                setPunishTarget(record)
                punishForm.setFieldsValue({ action: PUNISH_OPTIONS[0], amount: 2000, remark: '' })
              }}
            >
              处罚
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 示例数据明示（食品安全为合规强相关数据，禁止静默降级） */}
      {isMockSource('inputs') && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message="当前展示示例数据，后端接口建设中"
          description="投入品用量、超标判定与处罚金额属于合规强相关数据：本台账取自原型示例口径（原型 P17 Tab1），不具有监管效力。后端 /admin/food-safety/compliance/inputs 接口上线后本 Tab 将自动切换真实数据。"
        />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="校验记录总数" value={allRecords.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="合规记录" value={passCount} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="超标记录" value={overCount} valueStyle={{ color: '#ff4d4f' }} />
            <Text type="secondary">合规率 {passRate}%</Text>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Text>校验结果：</Text>
            <Select
              style={{ width: 120 }}
              value={result}
              options={[
                { value: 'all', label: '全部' },
                { value: 'pass', label: '合规' },
                { value: 'over', label: '超标' },
              ]}
              onChange={(value: ComplianceResult | 'all') => {
                setResult(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Space size={4}>
            <Text>农场：</Text>
            <Input
              style={{ width: 160 }}
              allowClear
              placeholder="请输入农场名称"
              value={farmName}
              onChange={(event) => setFarmName(event.target.value)}
            />
          </Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPageNum(1)
              void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'compliance', 'inputs'] })
            }}
          >
            查询
          </Button>
          <Button
            onClick={() => {
              setResult('all')
              setFarmName('')
              setPageNum(1)
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      <Card title="投入品合规台账">
        <Table<InputComplianceRecord>
          rowKey="id"
          size="middle"
          loading={listQuery.isLoading}
          columns={columns}
          dataSource={listQuery.data?.list ?? []}
          locale={{ emptyText: <Empty description="暂无投入品合规校验记录" /> }}
          pagination={{
            current: pageNum,
            pageSize,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条`,
            onChange: (page: number, size: number) => {
              setPageNum(page)
              setPageSize(size)
            },
          }}
        />
      </Card>

      <Modal
        open={detail !== null}
        title="投入品合规记录详情"
        onCancel={() => setDetail(null)}
        footer={[
          <Button key="close" onClick={() => setDetail(null)}>
            关闭
          </Button>,
        ]}
      >
        {detail && (
          <Descriptions column={1} size="small" bordered items={[
            { key: 'id', label: '记录编号', children: detail.id },
            { key: 'farmName', label: '农场', children: detail.farmName },
            { key: 'inputName', label: '投入品', children: detail.inputName },
            { key: 'inputType', label: '投入品类型', children: detail.inputType },
            { key: 'dosage', label: '用量', children: detail.dosage },
            {
              key: 'result',
              label: '校验结果',
              children: <Tag color={detail.result === 'pass' ? 'green' : 'red'}>{RESULT_TEXT[detail.result]}</Tag>,
            },
            { key: 'violation', label: '违规项', children: detail.violation },
            { key: 'checkDate', label: '校验日期', children: detail.checkDate },
          ]} />
        )}
      </Modal>

      <Modal
        open={punishTarget !== null}
        title="违规处罚登记"
        okText="提交处罚"
        cancelText="取消"
        confirmLoading={punishMutation.isPending}
        onCancel={() => setPunishTarget(null)}
        onOk={() => {
          void punishForm.validateFields().then((values) => {
            if (!punishTarget) {
              return
            }
            punishMutation.mutate({ id: punishTarget.id, action: values.action, amount: values.amount, remark: values.remark })
          })
        }}
      >
        {punishTarget && (
          <div>
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${punishTarget.farmName} · ${punishTarget.inputName}（${punishTarget.dosage}）`}
              description={`违规项：${punishTarget.violation}`}
            />
            <Form form={punishForm} layout="vertical">
              <Form.Item name="action" label="处罚方式" rules={[{ required: true, message: '请选择处罚方式' }]}>
                <Select
                  placeholder="请选择处罚方式"
                  options={PUNISH_OPTIONS.map((item) => ({ value: item, label: item }))}
                />
              </Form.Item>
              <Form.Item
                name="amount"
                label="处罚金额（元）"
                rules={[
                  { required: true, message: '请输入处罚金额' },
                  {
                    validator: (_rule: unknown, value: number) =>
                      Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('处罚金额须大于 0')),
                  },
                ]}
              >
                <Input type="number" min={1} placeholder="请输入处罚金额" />
              </Form.Item>
              <Form.Item name="remark" label="整改要求" rules={[{ required: true, message: '请填写整改要求' }]}>
                <Input.TextArea rows={3} placeholder="请填写整改要求与整改期限" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ==================== Tab2 标签合规（补充设计） ==================== */

/**
 * 标签合规 Tab
 *
 * 【原型未展开，此处为补充设计】原型 P17 该 Tab 仅有一行占位文案
 * "标签合规模块 - 产品标签信息校验"，按业务合理性补全为三个区块：
 * 1. 概览卡：已校验标签数 / 字段完整率 / 标识合规率 / 待整改数
 * 2. 筛选器：产品名称关键字 + 校验结果
 * 3. 校验结果列表：标签编号 | 产品名称 | 生产者 | 标签版本 | 必填字段完整度 |
 *    标识合规性 | 缺失字段 | 校验结果 | 校验时间 | 整改状态 | 操作（查看 / 整改通知）
 *
 * 必填字段口径按 GB 7718 预包装食品标签通则取 10 项：产品名称、配料表、净含量、
 * 生产者名称、生产者地址、生产日期、保质期、贮存条件、执行标准号、追溯码；
 * SC 许可证编号与产地按品类附加校验。
 *
 * @returns Tab 内容
 */
function LabelComplianceTab(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 校验结果筛选 */
  const [result, setResult] = useState<LabelCheckResult | 'all'>('all')
  /** 产品关键字 */
  const [productName, setProductName] = useState<string>('')
  /** 页码 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 每页条数 */
  const [pageSize, setPageSize] = useState<number>(10)
  /** 详情弹窗记录 */
  const [detail, setDetail] = useState<LabelComplianceRecord | null>(null)
  /** 整改通知弹窗记录 */
  const [rectifyTarget, setRectifyTarget] = useState<LabelComplianceRecord | null>(null)
  /** 整改表单 */
  const [rectifyForm] = Form.useForm<{ deadline: string; remark: string }>()

  /** 标签合规列表 */
  const listQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'labels', result, productName, pageNum, pageSize],
    queryFn: () => listLabelCompliance({ pageNum, pageSize, result, productName }),
    retry: false,
  })

  /** 全量统计 */
  const statsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'labels', 'stats'],
    queryFn: () => listLabelCompliance({ pageNum: 1, pageSize: 1000, result: 'all' }),
    retry: false,
  })

  /** 下发整改通知 */
  const rectifyMutation = useMutation({
    mutationFn: (payload: { id: string; deadline: string; remark: string }) =>
      notifyLabelRectify(payload.id, { deadline: payload.deadline, remark: payload.remark }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'compliance', 'labels'] })
      message.success('整改通知已下发')
      setRectifyTarget(null)
      rectifyForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '整改通知下发失败，请稍后重试')
    },
  })

  /** 全量数据 */
  const allRecords = statsQuery.data?.list ?? []
  /** 通过条数 */
  const passCount = allRecords.filter((item) => item.result === 'pass').length
  /** 待整改条数（不通过且未整改完成） */
  const pendingRectify = allRecords.filter((item) => item.result === 'fail' && item.rectifyStatus !== 'done').length
  /** 字段完整率 */
  const fieldRate =
    allRecords.length > 0
      ? Math.round(
          (allRecords.reduce((sum, item) => sum + item.filledFields / item.requiredFields, 0) /
            allRecords.length) *
            1000,
        ) / 10
      : 0
  /** 标识合规率 */
  const markingRate =
    allRecords.length > 0
      ? Math.round(
          (allRecords.filter((item) => item.marking === 'compliant').length / allRecords.length) * 1000,
        ) / 10
      : 0

  /** 表格列（补充设计字段） */
  const columns: ColumnsType<LabelComplianceRecord> = [
    { title: '标签编号', dataIndex: 'id', width: 130 },
    { title: '产品名称', dataIndex: 'productName', width: 150 },
    { title: '生产者', dataIndex: 'producer', width: 130 },
    { title: '标签版本', dataIndex: 'labelVersion', width: 100 },
    {
      title: '必填字段完整度',
      key: 'fields',
      width: 170,
      render: (_value: unknown, record: LabelComplianceRecord) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Text>
            {record.filledFields}/{record.requiredFields}
          </Text>
          <Progress
            percent={Math.round((record.filledFields / record.requiredFields) * 100)}
            size="small"
            strokeColor={record.filledFields === record.requiredFields ? '#52c41a' : '#faad14'}
          />
        </Space>
      ),
    },
    {
      title: '标识合规性',
      dataIndex: 'marking',
      width: 120,
      render: (value: MarkingResult) => <Tag color={MARKING_COLOR[value]}>{MARKING_TEXT[value]}</Tag>,
    },
    {
      title: '缺失字段',
      dataIndex: 'missingFields',
      width: 180,
      render: (value: string) =>
        value === '—' ? <Text type="secondary">—</Text> : <Text type="warning">{value}</Text>,
    },
    {
      title: '校验结果',
      dataIndex: 'result',
      width: 110,
      render: (value: LabelCheckResult) => (
        <Tag color={CHECK_COLOR[value]}>{value === 'pass' ? '✅ 通过' : '❌ 不通过'}</Tag>
      ),
    },
    { title: '校验时间', dataIndex: 'checkedAt', width: 150 },
    {
      title: '整改状态',
      dataIndex: 'rectifyStatus',
      width: 110,
      render: (value: RectifyStatus) => <Tag color={RECTIFY_COLOR[value]}>{RECTIFY_TEXT[value]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_value: unknown, record: LabelComplianceRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(record)}>
            查看
          </Button>
          {record.result === 'fail' && record.rectifyStatus !== 'done' && (
            <Button
              type="link"
              size="small"
              icon={<WarningOutlined />}
              onClick={() => {
                setRectifyTarget(record)
                rectifyForm.setFieldsValue({ deadline: '', remark: '' })
              }}
            >
              整改通知
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="标签合规模块 - 产品标签信息校验"
        description="原型未展开该 Tab，此处为补充设计：按 GB 7718 预包装食品标签通则校验 10 项必填字段完整性与认证标识合规性。"
      />
      {isMockSource('labels') && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message="当前展示示例数据，后端接口建设中"
          description="标签缺失字段、标识违规判定与整改状态属于合规强相关数据：本列表为补充设计的示例数据，不可作为标签合规结论使用。后端 /admin/food-safety/compliance/labels 接口上线后本 Tab 将自动切换真实数据。"
        />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="已校验标签数" value={allRecords.length} suffix="件" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="必填字段完整率" value={fieldRate} precision={1} suffix="%" valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="标识合规率" value={markingRate} precision={1} suffix="%" valueStyle={{ color: '#52c41a' }} />
            <Text type="secondary">通过 {passCount} 件</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="待整改" value={pendingRectify} suffix="件" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Text>产品名称：</Text>
            <Input
              style={{ width: 160 }}
              allowClear
              placeholder="请输入产品名称"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
            />
          </Space>
          <Space size={4}>
            <Text>校验结果：</Text>
            <Select
              style={{ width: 120 }}
              value={result}
              options={[
                { value: 'all', label: '全部' },
                { value: 'pass', label: '通过' },
                { value: 'fail', label: '不通过' },
              ]}
              onChange={(value: LabelCheckResult | 'all') => {
                setResult(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPageNum(1)
              void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'compliance', 'labels'] })
            }}
          >
            查询
          </Button>
          <Button
            onClick={() => {
              setResult('all')
              setProductName('')
              setPageNum(1)
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      <Card title="产品标签校验结果">
        <Table<LabelComplianceRecord>
          rowKey="id"
          size="middle"
          loading={listQuery.isLoading}
          columns={columns}
          dataSource={listQuery.data?.list ?? []}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="暂无标签校验记录" /> }}
          pagination={{
            current: pageNum,
            pageSize,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条`,
            onChange: (page: number, size: number) => {
              setPageNum(page)
              setPageSize(size)
            },
          }}
        />
      </Card>

      <Modal
        open={detail !== null}
        title="标签校验详情"
        width={620}
        onCancel={() => setDetail(null)}
        footer={[
          <Button key="close" onClick={() => setDetail(null)}>
            关闭
          </Button>,
        ]}
      >
        {detail && (
          <Descriptions column={1} size="small" bordered items={[
            { key: 'id', label: '标签编号', children: detail.id },
            { key: 'productName', label: '产品名称', children: detail.productName },
            { key: 'producer', label: '生产者', children: detail.producer },
            { key: 'labelVersion', label: '标签版本', children: detail.labelVersion },
            {
              key: 'fields',
              label: '必填字段完整度',
              children: `${detail.filledFields}/${detail.requiredFields}`,
            },
            { key: 'missing', label: '缺失字段', children: detail.missingFields },
            {
              key: 'marking',
              label: '标识合规性',
              children: <Tag color={MARKING_COLOR[detail.marking]}>{MARKING_TEXT[detail.marking]}</Tag>,
            },
            { key: 'markingNote', label: '标识校验说明', children: detail.markingNote },
            {
              key: 'result',
              label: '校验结果',
              children: <Tag color={CHECK_COLOR[detail.result]}>{detail.result === 'pass' ? '通过' : '不通过'}</Tag>,
            },
            { key: 'checkedAt', label: '校验时间', children: detail.checkedAt },
            {
              key: 'rectify',
              label: '整改状态',
              children: <Tag color={RECTIFY_COLOR[detail.rectifyStatus]}>{RECTIFY_TEXT[detail.rectifyStatus]}</Tag>,
            },
          ]} />
        )}
      </Modal>

      <Modal
        open={rectifyTarget !== null}
        title="下发标签整改通知"
        okText="下发通知"
        cancelText="取消"
        confirmLoading={rectifyMutation.isPending}
        onCancel={() => setRectifyTarget(null)}
        onOk={() => {
          void rectifyForm.validateFields().then((values) => {
            if (!rectifyTarget) {
              return
            }
            rectifyMutation.mutate({ id: rectifyTarget.id, deadline: values.deadline, remark: values.remark })
          })
        }}
      >
        {rectifyTarget && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${rectifyTarget.productName}（${rectifyTarget.producer}）`}
              description={`缺失字段：${rectifyTarget.missingFields}；标识校验：${rectifyTarget.markingNote}`}
            />
            <Form form={rectifyForm} layout="vertical">
              <Form.Item name="deadline" label="整改期限" rules={[{ required: true, message: '请输入整改期限' }]}>
                <Input placeholder="例如：2025-07-20 前完成标签改版并提交复审" />
              </Form.Item>
              <Form.Item name="remark" label="整改要求" rules={[{ required: true, message: '请填写整改要求' }]}>
                <Input.TextArea rows={3} placeholder="请填写整改要求" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ==================== Tab3 标准校验（补充设计） ==================== */

/**
 * 标准校验 Tab
 *
 * 【原型未展开，此处为补充设计】原型 P17 该 Tab 仅有一行占位文案
 * "标准合规模块 - 行业标准自动校验"，按业务合理性补全为三个区块：
 * 1. 校验配置：标准库下拉（GB 2762 / GB 2763 / GB 7718 / NY/T 391 / GB/T 19630）
 *    + 校验批次范围 +「执行校验」按钮
 * 2. 汇总卡 + 通过率仪表盘：校验批次总数 / 通过 / 不通过 / 通过率
 * 3. 校验项明细表：校验项 | 标准限值 | 实测值 | 判定 | 抽检批次
 *
 * @returns Tab 内容
 */
function StandardCheckTab(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 当前标准编号 */
  const [standardNo, setStandardNo] = useState<string>(STANDARD_LIBRARY[0].value)
  /** 校验批次范围 */
  const [batchScope, setBatchScope] = useState<string>(BATCH_SCOPE_OPTIONS[0].value)

  /** 标准库 */
  const libraryQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'standards'],
    queryFn: () => listStandardLibrary(),
    retry: false,
  })

  /** 校验汇总 */
  const summaryQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'standards', standardNo, 'summary'],
    queryFn: () => getStandardCheckSummary(standardNo),
    retry: false,
  })

  /** 校验项明细 */
  const itemsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'compliance', 'standards', standardNo, 'items'],
    queryFn: () => listStandardCheckItems(standardNo),
    retry: false,
  })

  /** 执行标准自动校验 */
  const runMutation = useMutation({
    mutationFn: (payload: { standardNo: string; batchScope: string }) => runStandardCheck(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'compliance', 'standards'] })
      message.success('标准校验已执行，结果已刷新')
    },
    onError: (error: Error) => {
      message.error(error.message || '标准校验执行失败，请稍后重试')
    },
  })

  /** 标准库下拉数据 */
  const library: StandardLibraryItem[] = libraryQuery.data ?? STANDARD_LIBRARY
  /** 当前标准 */
  const currentStandard = library.find((item) => item.value === standardNo)
  /** 汇总数据 */
  const summary: StandardCheckSummary = summaryQuery.data ?? {
    batchCount: 0,
    passCount: 0,
    failCount: 0,
    passRate: 0,
  }
  /** 校验项 */
  const items: StandardCheckItem[] = itemsQuery.data ?? []

  /** 通过率仪表盘配置 */
  const gaugeOption: EChartsOption = {
    tooltip: { formatter: '{a}：{c}%' },
    series: [
      {
        name: '通过率',
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 210,
        endAngle: -30,
        radius: '92%',
        center: ['50%', '58%'],
        progress: { show: true, width: 12 },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.6, '#ff4d4f'],
              [0.85, '#faad14'],
              [1, '#52c41a'],
            ],
          },
        },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { width: 1, color: '#bfbfbf' } },
        axisLabel: { distance: 14, fontSize: 10 },
        pointer: { width: 4, length: '60%' },
        detail: { valueAnimation: true, formatter: '{value}%', fontSize: 22, offsetCenter: [0, '68%'] },
        data: [{ value: summary.passRate, name: '通过率' }],
      },
    ],
  }

  /** 校验项表格列 */
  const itemColumns: ColumnsType<StandardCheckItem> = [
    { title: '校验项', dataIndex: 'itemName', width: 200 },
    { title: '标准限值', dataIndex: 'limitValue', width: 160 },
    { title: '实测值', dataIndex: 'measuredValue', width: 160 },
    {
      title: '判定',
      dataIndex: 'result',
      width: 120,
      render: (value: LabelCheckResult) => (
        <Tag color={CHECK_COLOR[value]}>{value === 'pass' ? '✅ 通过' : '❌ 不通过'}</Tag>
      ),
    },
    { title: '抽检批次', dataIndex: 'batchNo', width: 140 },
  ]

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="标准合规模块 - 行业标准自动校验"
        description="原型未展开该 Tab，此处为补充设计：选择标准库与批次范围后一键执行自动校验，输出通过率与逐项判定明细。"
      />
      {isMockSource('standards', 'standard-items', 'standard-summary') && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message="当前展示示例数据，后端接口建设中"
          description="标准限值比对与通过率判定属于合规强相关数据：标准库、校验项与实测值均为演示用示例，「执行校验」不会触发真实检验数据流。后端 /admin/food-safety/compliance/standards/* 接口上线后本 Tab 将自动切换真实数据。"
        />
      )}

      {/* 校验配置 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Text>标准库：</Text>
            <Select
              style={{ width: 320 }}
              value={standardNo}
              options={library.map((item) => ({ value: item.value, label: item.label }))}
              onChange={(value: string) => setStandardNo(value)}
            />
          </Space>
          <Space size={4}>
            <Text>校验批次范围：</Text>
            <Select
              style={{ width: 160 }}
              value={batchScope}
              options={BATCH_SCOPE_OPTIONS}
              onChange={(value: string) => setBatchScope(value)}
            />
          </Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={runMutation.isPending}
            onClick={() => runMutation.mutate({ standardNo, batchScope })}
          >
            执行校验
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'compliance', 'standards'] })
            }}
          >
            刷新结果
          </Button>
        </Space>
        {currentStandard && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前标准：{currentStandard.label}（发布机构：{currentStandard.issuer}）
            </Text>
          </div>
        )}
      </Card>

      {/* 汇总卡 + 通过率仪表盘 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="校验批次总数" value={summary.batchCount} suffix="批" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="通过批次" value={summary.passCount} suffix="批" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="不通过批次" value={summary.failCount} suffix="批" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {summaryQuery.isLoading ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">加载中…</Text>
              </div>
            ) : (
              <ReactECharts option={gaugeOption} style={{ height: 180 }} notMerge />
            )}
          </Card>
        </Col>
      </Row>

      {/* 校验项明细 */}
      <Card
        title="校验项明细"
        extra={<Text type="secondary">最后校验时间：{dayjs().format('YYYY-MM-DD HH:mm')}</Text>}
      >
        <Table<StandardCheckItem>
          rowKey="id"
          size="middle"
          loading={itemsQuery.isLoading}
          columns={itemColumns}
          dataSource={items}
          pagination={false}
          locale={{ emptyText: <Empty description="该标准下暂无校验项" /> }}
        />
      </Card>
    </div>
  )
}

/**
 * 合规校验管理
 *
 * 业务职责：承载投入品合规台账（原型还原）、产品标签信息校验与行业标准自动校验
 * （后两者为原型占位处的补充设计）。数据优先取后端 /admin/food-safety/compliance/*，
 * 接口未就绪时降级到示例数据。
 *
 * @returns 页面内容
 */
export default function Compliance(): JSX.Element {
  /** 当前激活 Tab */
  const [activeTab, setActiveTab] = useState<string>('input')

  return (
    <div>
      {/* 面包屑 + 标题（原型 P17 顶部栏） */}
      <div style={{ marginBottom: 12 }}>
        <Breadcrumb
          style={{ marginBottom: 4 }}
          items={[
            { href: '/admin/production/dashboard', title: <HomeOutlined /> },
            { title: '食品安全' },
            { title: '合规校验管理' },
          ]}
        />
        <Title level={4} style={{ margin: 0 }}>
          合规校验管理
        </Title>
        <Text type="secondary">投入品合规台账、产品标签校验与行业标准自动校验</Text>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key: string) => setActiveTab(key)}
          items={[
            { key: 'input', label: '投入品合规', children: <InputComplianceTab /> },
            { key: 'label', label: '标签合规', children: <LabelComplianceTab /> },
            { key: 'standard', label: '标准校验', children: <StandardCheckTab /> },
          ]}
        />
      </Card>
    </div>
  )
}
