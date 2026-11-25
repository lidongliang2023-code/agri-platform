import DetailInfoGrid from '@/components/DetailInfoGrid'
import ProductionTable from '@/components/ProductionTable'
import ListRowActions from '@/components/ListRowActions'
import { QualityPage, tradeOpsUrl } from '../quality/QualityShared'
import { useNavigate } from 'react-router-dom'
/**
 * 页面名称：流通异常检测
 * 路由路径：/admin/production/food-safety/circulation
 * 所属模块：食品安全
 * 原型 pageId：food-safety-circulation（PRD 外，原型补充页面 P16）
 *
 * 原型结构：筛选器（异常类型 / 严重程度 / 日期）→ 流通异常检测列表 → 处理 / 详情操作。
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
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeOutlined, HomeOutlined, ReloadOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  CIRCULATION_TYPE_ICON,
  CIRCULATION_TYPE_TEXT,
  HANDLE_STATUS_COLOR,
  HANDLE_STATUS_TEXT,
  SEVERITY_COLOR,
  SEVERITY_TEXT,
  handleCirculation,
  listCirculation,
  notifyWriteResult,
} from '@/api/admin/foodSafety'
import type { CirculationRecord, CirculationType, Severity } from '@/api/admin/foodSafety'

const { Text, Title } = Typography

/**
 * 日期筛选默认值。
 *
 * 原型 P16 筛选器日期框展示 2025-07-14，但原型表格同时呈现「今天」与「昨天」的异常行，
 * 故此处默认不限制日期（空串 = 全部日期），既保证默认视图与原型表格一致，
 * 也避免运营漏看跨天待处置异常。
 */
const DEFAULT_DATE = ''

/** 原型示意日期（重置时填入筛选框的参考值） */
const PROTOTYPE_DATE = '2025-07-14'

/** 异常类型下拉选项 */
const TYPE_OPTIONS: Array<{ value: CirculationType | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'temperature', label: '温度异常' },
  { value: 'overtime', label: '超时滞留' },
  { value: 'label', label: '标签异常' },
]

/** 严重程度下拉选项 */
const SEVERITY_OPTIONS: Array<{ value: Severity | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'severe', label: '严重' },
  { value: 'medium', label: '中等' },
  { value: 'minor', label: '轻微' },
]

/** 处理方式下拉选项 */
const ACTION_OPTIONS: string[] = ['通知责任方核查', '申请批次风险管控', '转人工复核', '补充核查证据']

/**
 * 流通异常检测
 *
 * 业务职责：基于流通节点与物联网测点数据，识别温度异常、超时滞留与标签异常，
 * 按严重程度分级并跟踪处置状态。数据优先取后端 /admin/food-safety/circulation，
 * 接口未就绪时降级到原型示例数据。
 *
 * @returns 页面内容
 */
function Circulation(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 异常类型筛选 */
  const [type, setType] = useState<CirculationType | 'all'>('all')
  /** 严重程度筛选 */
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  /** 日期筛选 */
  const [date, setDate] = useState<string>(DEFAULT_DATE)
  /** 页码 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 每页条数 */
  const [pageSize, setPageSize] = useState<number>(20)
  /** 处置弹窗当前处理的记录 */
  const [activeRecord, setActiveRecord] = useState<CirculationRecord | null>(null)
  /** 详情弹窗当前查看的记录 */
  const [detailRecord, setDetailRecord] = useState<CirculationRecord | null>(null)
  /** 处置表单 */
  const [handleForm] = Form.useForm<{ action: string; remark: string }>()

  /** 流通异常列表 */
  const listQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'circulation', type, severity, date, pageNum, pageSize],
    queryFn: () => listCirculation({ pageNum, pageSize, type, severity, date }),
    retry: false,
  })

  /** 登记流通异常处理进展（只有 result.ok 才提示成功并关闭弹窗） */
  const handleMutation = useMutation({
    mutationFn: (payload: { id: string; action: string; remark: string }) =>
      handleCirculation(payload.id, { action: payload.action, remark: payload.remark }),
    onSuccess: (result) => {
      notifyWriteResult(message, result, '处置已提交并写入服务端')
      if (!result.ok) {
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'circulation'] })
      setActiveRecord(null)
      handleForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '处置失败，请稍后重试')
    },
  })

  /** 列表数据 */
  const records = listQuery.data?.list ?? []

  /** 表格列（原型 P16 列顺序） */
  const columns: ColumnsType<CirculationRecord> = [
    { title: '异常编号', dataIndex: 'id', width: 170 },
    { title: '发现时间', dataIndex: 'foundAt', width: 110 },
    { title: '批次号', dataIndex: 'batchNo', width: 120 },
    { title: '产品', dataIndex: 'product', width: 130 },
    {
      title: '异常类型',
      dataIndex: 'type',
      width: 130,
      render: (value: CirculationType) => (
        <Space size={4}>
          <span>{CIRCULATION_TYPE_ICON[value]}</span>
          <Text>{CIRCULATION_TYPE_TEXT[value]}</Text>
        </Space>
      ),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      width: 100,
      render: (value: Severity) => <Tag color={SEVERITY_COLOR[value]}>{SEVERITY_TEXT[value]}</Tag>,
    },
    { title: '影响范围', dataIndex: 'impact', width: 110 },
    {
      title: '处理状态',
      dataIndex: 'status',
      width: 110,
      render: (value: CirculationRecord['status']) => (
        <Tag color={HANDLE_STATUS_COLOR[value]}>{HANDLE_STATUS_TEXT[value]}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, record: CirculationRecord) => (
        <ListRowActions
          items={
            record.status === 'done'
              ? [
                  <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(record)}>
                    查看
                  </Button>,
                ]
              : [
                  <Button
                    key="handle"
                    type="link"
                    size="small"
                    icon={<ToolOutlined />}
                    onClick={() => {
                      setActiveRecord(record)
                      handleForm.setFieldsValue({ action: ACTION_OPTIONS[0], remark: '' })
                    }}
                  >
                    处理
                  </Button>,
                  <Button key="detail" type="link" size="small" onClick={() => setDetailRecord(record)}>
                    详情
                  </Button>,
                ]
          }
        />
      ),
    },
  ]

  return (
    <div>
      {/* 面包屑 + 标题（原型 P16 顶部栏） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '食品安全' },
              { title: '流通异常检测' },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            流通异常检测
          </Title>
          <Text type="secondary">流通过程中的温度 / 滞留 / 标签异常监测与处置</Text>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'circulation'] })
            }}
          >
            刷新
          </Button>
        </Col>
      </Row>

      {/* 示例数据明示（食品安全为合规强相关数据，禁止静默降级） */}


      {/* 写操作未接入后端明示（禁止「未写入服务端却提示成功」） */}


      {listQuery.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="流通异常列表加载失败，请刷新重试"
        />
      )}

      {/* 筛选器（原型 P16 Filter Bar） */}
      <Card size="small" className="production-dense-filter-card">
        <div className="production-filter-grid">
          <div className="production-filter-field">
            <label>异常类型</label>
            <Select
              value={type}
              options={TYPE_OPTIONS}
              onChange={(value: CirculationType | 'all') => {
                setType(value)
                setPageNum(1)
              }}
            />
          </div>
          <div className="production-filter-field">
            <label>严重程度</label>
            <Select
              value={severity}
              options={SEVERITY_OPTIONS}
              onChange={(value: Severity | 'all') => {
                setSeverity(value)
                setPageNum(1)
              }}
            />
          </div>
          <div className="production-filter-field">
            <label>日期</label>
            <DatePicker
              value={date ? dayjs(date) : null}
              allowClear
              placeholder={PROTOTYPE_DATE}
              onChange={(value) => {
                setDate(value ? value.format('YYYY-MM-DD') : DEFAULT_DATE)
                setPageNum(1)
              }}
            />
          </div>
          <div className="production-filter-actions">
            <Button
              onClick={() => {
                setType('all')
                setSeverity('all')
                setDate(DEFAULT_DATE)
                setPageNum(1)
              }}
            >
              重置
            </Button>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setPageNum(1)
                void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'circulation'] })
              }}
            >
              查询
            </Button>
          </div>
        </div>
      </Card>

      {/* 流通异常检测列表 */}
      <Card>
        <ProductionTable<CirculationRecord>
          rowKey="id"
          memberListToolbar
          rowSelection={{}}
          cardProps={false}
          headerTitle="异常流向检测列表"
          size="small" search={false}
          loading={listQuery.isLoading}
          columns={columns as import('@ant-design/pro-components').ProColumns<any>[]}
          dataSource={records}
          options={{ reload: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'circulation'] }) }}
          locale={{ emptyText: <Empty description="当前筛选条件下暂无流通异常记录" /> }}
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

      {/* 异常详情弹窗 */}
      <Modal
        rootClassName="quality-dialog quality-detail"
        width={800}
        open={detailRecord !== null}
        title="流通异常详情"
        onCancel={() => setDetailRecord(null)}
        footer={[
          <Button key="close" onClick={() => setDetailRecord(null)}>
            关闭
          </Button>,
        ]}
      >
        {detailRecord && (
          <DetailInfoGrid items={[
            { key: 'id', fullWidth: true, label: '异常编号', value: detailRecord.id },
            { key: 'foundAt', label: '发现时间', value: detailRecord.foundAt?.startsWith(detailRecord.foundDate) ? detailRecord.foundAt : [detailRecord.foundDate, detailRecord.foundAt].filter(Boolean).join(' ') },
            { key: 'batchNo', label: '批次号', value: detailRecord.batchNo },
            { key: 'product', label: '产品', value: detailRecord.product },
            {
              key: 'type',
              label: '异常类型',
              value: `${CIRCULATION_TYPE_ICON[detailRecord.type]} ${CIRCULATION_TYPE_TEXT[detailRecord.type]}`,
            },
            {
              key: 'severity',
              label: '严重度',
              value: <Tag color={SEVERITY_COLOR[detailRecord.severity]}>{SEVERITY_TEXT[detailRecord.severity]}</Tag>,
            },
            { key: 'impact', fullWidth: true, label: '影响范围', value: detailRecord.impact },
            {
              key: 'status',
              label: '处理状态',
              value: <Tag color={HANDLE_STATUS_COLOR[detailRecord.status]}>{HANDLE_STATUS_TEXT[detailRecord.status]}</Tag>,
            },
            { key: 'measure', fullWidth: true, label: '处置措施', value: detailRecord.measure ?? '—' },
          ]} />
        )}
      </Modal>

      {/* 处置弹窗 */}
      <Modal
        open={activeRecord !== null}
        title="登记流通异常处理进展"
        okText="登记处理进展"
        cancelText="取消"
        confirmLoading={handleMutation.isPending}
        onCancel={() => setActiveRecord(null)}
        onOk={() => {
          void handleForm.validateFields().then((values) => {
            if (!activeRecord) {
              return
            }
            handleMutation.mutate({ id: activeRecord.id, action: values.action, remark: values.remark })
          })
        }}
      >
        {activeRecord && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${activeRecord.id} · ${activeRecord.product}（批次 ${activeRecord.batchNo}）`}
              description={`异常类型：${CIRCULATION_TYPE_TEXT[activeRecord.type]}　影响范围：${activeRecord.impact}`}
            />
            <Form form={handleForm} layout="vertical">
              <Form.Item name="action" label="处置方式" rules={[{ required: true, message: '请选择处置方式' }]}>
                <Select
                  placeholder="请选择处置方式"
                  options={ACTION_OPTIONS.map((item) => ({ value: item, label: item }))}
                />
              </Form.Item>
              <Form.Item name="remark" label="处置说明" rules={[{ required: true, message: '请填写处置说明' }]}>
                <Input.TextArea rows={3} placeholder="请填写处置说明" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function SafetyEvidencePage(){const nav=useNavigate();return <QualityPage extra={<Space><Button onClick={()=>nav('/admin/production/quality/recalls')}>批次风险管控</Button><Button href={tradeOpsUrl('order')}>交易订单监管</Button></Space>} title="流通异常台账" subTitle="记录流通异常核查进展，批次管控复用不合格品处置"><div className="legacy-quality"><Circulation/></div></QualityPage>}
