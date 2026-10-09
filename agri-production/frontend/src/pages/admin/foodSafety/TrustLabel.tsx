/**
 * 页面名称：可信农产品管理
 * 路由路径：/admin/production/food-safety/trust-label
 * 所属模块：食品安全
 * 原型 pageId：food-safety-trust-label（PRD 外，原型补充页面 P18）
 *
 * 原型结构：统计卡（总产品数 / 钻石 / 金牌 / 银牌 / 待审核）→ 可信农产品名单表格
 * （产品编号 | 产品名称 | 品类 | 生产者 | 可信等级 | 信任分数 | 认证标志 | 操作）。
 * 在原型列基础上补充「认证有效期」「审核状态」两列，用于承载认证信息与审核闭环。
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
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
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
  AuditOutlined,
  EditOutlined,
  EyeOutlined,
  HomeOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  CERT_MARK_TEXT,
  FOOD_SAFETY_WRITE_ALERT,
  TRUST_AUDIT_COLOR,
  TRUST_AUDIT_TEXT,
  TRUST_LEVEL_COLOR,
  TRUST_LEVEL_ICON,
  TRUST_LEVEL_TEXT,
  auditTrustProduct,
  getTrustStats,
  isMockSource,
  isWriteBackendConfirmed,
  listTrustProducts,
  notifyWriteResult,
  updateTrustProduct,
} from '@/api/admin/foodSafety'
import type {
  CertMark,
  TrustAuditStatus,
  TrustLevel,
  TrustProduct,
  TrustProductUpdatePayload,
} from '@/api/admin/foodSafety'

const { Text, Title } = Typography

/** 可信等级下拉选项 */
const LEVEL_OPTIONS: Array<{ value: TrustLevel; label: string }> = [
  { value: 'diamond', label: '钻石' },
  { value: 'gold', label: '金牌' },
  { value: 'silver', label: '银牌' },
  { value: 'normal', label: '普通' },
]

/** 认证标志下拉选项 */
const CERT_OPTIONS: Array<{ value: CertMark; label: string }> = [
  { value: 'organic', label: '有机认证' },
  { value: 'green', label: '绿色认证' },
  { value: 'pollution-free', label: '无公害' },
  { value: 'none', label: '无' },
]

/** 审核状态下拉选项 */
const AUDIT_OPTIONS: Array<{ value: TrustAuditStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'approved', label: '已通过' },
  { value: 'pending', label: '待审核' },
  { value: 'rejected', label: '已驳回' },
]

/**
 * 可信农产品管理
 *
 * 业务职责：维护可信农产品名单与分级（钻石 / 金牌 / 银牌 / 普通），管理信任分数、
 * 认证标志、认证有效期与审核状态。数据优先取后端 /admin/food-safety/trust-label/*，
 * 接口未就绪时降级到原型示例口径（原型 P18 / 4.2）。
 *
 * @returns 页面内容
 */
export default function TrustLabel(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 可信等级筛选 */
  const [level, setLevel] = useState<TrustLevel | 'all'>('all')
  /** 审核状态筛选 */
  const [auditStatus, setAuditStatus] = useState<TrustAuditStatus | 'all'>('all')
  /** 产品名称关键字 */
  const [name, setName] = useState<string>('')
  /** 页码 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 每页条数 */
  const [pageSize, setPageSize] = useState<number>(10)
  /** 详情弹窗产品 */
  const [detail, setDetail] = useState<TrustProduct | null>(null)
  /** 编辑弹窗产品 */
  const [editTarget, setEditTarget] = useState<TrustProduct | null>(null)
  /** 审核弹窗产品 */
  const [auditTarget, setAuditTarget] = useState<TrustProduct | null>(null)
  /** 编辑表单 */
  const [editForm] = Form.useForm<Omit<TrustProductUpdatePayload, 'validUntil'> & { validUntil: dayjs.Dayjs }>()
  /** 审核表单 */
  const [auditForm] = Form.useForm<{ remark: string }>()

  /** 统计卡数据 */
  const statsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'trust-label', 'stats'],
    queryFn: () => getTrustStats(),
    retry: false,
  })

  /** 可信农产品名单 */
  const listQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'trust-label', 'products', level, auditStatus, name, pageNum, pageSize],
    queryFn: () => listTrustProducts({ pageNum, pageSize, level, auditStatus, name }),
    retry: false,
  })

  /** 编辑提交（只有 result.ok 才提示成功并关闭弹窗） */
  const editMutation = useMutation({
    mutationFn: (payload: { id: string; values: Omit<TrustProductUpdatePayload, 'validUntil'> & { validUntil: dayjs.Dayjs } }) =>
      updateTrustProduct(payload.id, {
        level: payload.values.level,
        score: payload.values.score,
        cert: payload.values.cert,
        certOrg: payload.values.certOrg,
        validUntil: payload.values.validUntil.format('YYYY-MM-DD'),
      }),
    onSuccess: (result) => {
      notifyWriteResult(message, result, '可信农产品信息已更新并写入服务端')
      if (!result.ok) {
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'trust-label'] })
      setEditTarget(null)
    },
    onError: (error: Error) => {
      message.error(error.message || '保存失败，请稍后重试')
    },
  })

  /** 审核提交（只有 result.ok 才提示成功并关闭弹窗） */
  const auditMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'approve' | 'reject'; remark: string }) =>
      auditTrustProduct(payload.id, { action: payload.action, remark: payload.remark }),
    onSuccess: (result, variables) => {
      notifyWriteResult(
        message,
        result,
        variables.action === 'approve' ? '审核已通过并写入服务端' : '审核已驳回并写入服务端',
      )
      if (!result.ok) {
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'trust-label'] })
      setAuditTarget(null)
      auditForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '审核失败，请稍后重试')
    },
  })

  /** 统计数据 */
  const stats = statsQuery.data
  /** 列表数据 */
  const products = listQuery.data?.list ?? []

  /** 打开编辑弹窗 */
  const openEdit = (record: TrustProduct): void => {
    setEditTarget(record)
    editForm.setFieldsValue({
      level: record.level,
      score: record.score,
      cert: record.cert,
      certOrg: record.certOrg,
      validUntil: dayjs(record.validUntil),
    })
  }

  /** 表格列（原型 P18 列顺序 + 认证有效期 / 审核状态） */
  const columns: ColumnsType<TrustProduct> = [
    { title: '产品编号', dataIndex: 'id', width: 100 },
    { title: '产品名称', dataIndex: 'name', width: 160 },
    { title: '品类', dataIndex: 'category', width: 100 },
    { title: '生产者', dataIndex: 'producer', width: 130 },
    {
      title: '可信等级',
      dataIndex: 'level',
      width: 120,
      render: (value: TrustLevel) => (
        <Tag color={TRUST_LEVEL_COLOR[value]}>
          {TRUST_LEVEL_ICON[value]} {TRUST_LEVEL_TEXT[value]}
        </Tag>
      ),
    },
    {
      title: '信任分数',
      dataIndex: 'score',
      width: 110,
      sorter: (a: TrustProduct, b: TrustProduct) => a.score - b.score,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: '认证标志',
      dataIndex: 'cert',
      width: 130,
      render: (value: CertMark) => <Text>{CERT_MARK_TEXT[value]}</Text>,
    },
    {
      title: '认证有效期',
      dataIndex: 'validUntil',
      width: 120,
      render: (value: string) => {
        const expired = dayjs(value).isBefore(dayjs(), 'day')
        return expired ? <Text type="danger">{value}（已过期）</Text> : <Text>{value}</Text>
      },
    },
    {
      title: '审核状态',
      dataIndex: 'auditStatus',
      width: 110,
      render: (value: TrustAuditStatus) => <Tag color={TRUST_AUDIT_COLOR[value]}>{TRUST_AUDIT_TEXT[value]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_value: unknown, record: TrustProduct) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          {record.auditStatus === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<AuditOutlined />}
              onClick={() => {
                setAuditTarget(record)
                auditForm.setFieldsValue({ remark: '' })
              }}
            >
              审核
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 面包屑 + 标题（原型 P18 顶部栏） */}
      <div style={{ marginBottom: 12 }}>
        <Breadcrumb
          style={{ marginBottom: 4 }}
          items={[
            { href: '/admin/production/dashboard', title: <HomeOutlined /> },
            { title: '食品安全' },
            { title: '可信农产品管理' },
          ]}
        />
        <Title level={4} style={{ margin: 0 }}>
          可信农产品管理
        </Title>
        <Text type="secondary">可信农产品分级、信任分数与认证信息管理</Text>
      </div>

      {/* 示例数据明示（食品安全为合规强相关数据，禁止静默降级） */}
      {isMockSource('trust-stats', 'trust-products') && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message="当前展示示例数据，后端接口建设中"
          description="可信等级、信任分数、认证标志与认证有效期属于对外公示与监管强相关数据：本页取自原型示例口径（原型 P18 / 4.2），不构成真实认证结论，请勿据此对外公示。后端 /admin/food-safety/trust-label/* 接口上线后本页将自动切换真实数据。"
        />
      )}

      {/* 写操作未接入后端明示（禁止「未写入服务端却提示成功」） */}
      {!isWriteBackendConfirmed() && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message={FOOD_SAFETY_WRITE_ALERT.message}
          description={`${FOOD_SAFETY_WRITE_ALERT.description}本页涉及：可信农产品编辑、主体审核通过 / 驳回。`}
        />
      )}

      {(statsQuery.isError || listQuery.isError) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="部分数据获取失败，已切换为示例数据展示"
        />
      )}

      {/* 统计卡（原型 P18 Stat Cards） */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={4}>
          <Card loading={statsQuery.isLoading}>
            <Statistic title="总产品数" value={stats?.total ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic
              title="钻石可信"
              value={stats?.diamond ?? 0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<span>💎</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic
              title="金牌可信"
              value={stats?.gold ?? 0}
              valueStyle={{ color: '#d48806' }}
              prefix={<span>🥇</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic
              title="银牌可信"
              value={stats?.silver ?? 0}
              valueStyle={{ color: '#1677ff' }}
              prefix={<span>🥈</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={5}>
          <Card loading={statsQuery.isLoading}>
            <Statistic title="待审核" value={stats?.pending ?? 0} valueStyle={{ color: '#faad14' }} suffix="件" />
          </Card>
        </Col>
      </Row>

      {/* 筛选器 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Text>产品名称：</Text>
            <Input
              style={{ width: 160 }}
              allowClear
              placeholder="请输入产品名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Space>
          <Space size={4}>
            <Text>可信等级：</Text>
            <Select
              style={{ width: 120 }}
              value={level}
              options={[{ value: 'all', label: '全部' }, ...LEVEL_OPTIONS]}
              onChange={(value: TrustLevel | 'all') => {
                setLevel(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Space size={4}>
            <Text>审核状态：</Text>
            <Select
              style={{ width: 120 }}
              value={auditStatus}
              options={AUDIT_OPTIONS}
              onChange={(value: TrustAuditStatus | 'all') => {
                setAuditStatus(value)
                setPageNum(1)
              }}
            />
          </Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPageNum(1)
              void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'trust-label'] })
            }}
          >
            查询
          </Button>
          <Button
            onClick={() => {
              setName('')
              setLevel('all')
              setAuditStatus('all')
              setPageNum(1)
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 可信农产品名单 */}
      <Card title="可信农产品名单">
        <Table<TrustProduct>
          rowKey="id"
          size="middle"
          loading={listQuery.isLoading}
          columns={columns}
          dataSource={products}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="当前筛选条件下暂无可信农产品" /> }}
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

      {/* 详情弹窗 */}
      <Modal
        open={detail !== null}
        title="可信农产品详情"
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
            { key: 'id', label: '产品编号', children: detail.id },
            { key: 'name', label: '产品名称', children: detail.name },
            { key: 'category', label: '品类', children: detail.category },
            { key: 'producer', label: '生产者', children: detail.producer },
            {
              key: 'level',
              label: '可信等级',
              children: (
                <Tag color={TRUST_LEVEL_COLOR[detail.level]}>
                  {TRUST_LEVEL_ICON[detail.level]} {TRUST_LEVEL_TEXT[detail.level]}
                </Tag>
              ),
            },
            { key: 'score', label: '信任分数', children: `${detail.score} 分` },
            { key: 'cert', label: '认证标志', children: CERT_MARK_TEXT[detail.cert] },
            { key: 'certOrg', label: '认证机构', children: detail.certOrg },
            { key: 'validUntil', label: '认证有效期', children: detail.validUntil },
            {
              key: 'auditStatus',
              label: '审核状态',
              children: <Tag color={TRUST_AUDIT_COLOR[detail.auditStatus]}>{TRUST_AUDIT_TEXT[detail.auditStatus]}</Tag>,
            },
          ]} />
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        open={editTarget !== null}
        title="编辑可信农产品"
        okText="保存"
        cancelText="取消"
        confirmLoading={editMutation.isPending}
        onCancel={() => setEditTarget(null)}
        onOk={() => {
          void editForm.validateFields().then((values) => {
            if (!editTarget) {
              return
            }
            editMutation.mutate({ id: editTarget.id, values })
          })
        }}
      >
        {editTarget && (
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${editTarget.id} · ${editTarget.name}（${editTarget.producer}）`}
              description="信任分数区间建议：钻石 ≥ 90、金牌 80~89、银牌 65~79、普通 < 65"
            />
            <Form form={editForm} layout="vertical">
              <Form.Item name="level" label="可信等级" rules={[{ required: true, message: '请选择可信等级' }]}>
                <Select placeholder="请选择可信等级" options={LEVEL_OPTIONS} />
              </Form.Item>
              <Form.Item
                name="score"
                label="信任分数"
                rules={[
                  { required: true, message: '请输入信任分数' },
                  {
                    validator: (_rule: unknown, value: number) => {
                      if (typeof value !== 'number' || Number.isNaN(value)) {
                        return Promise.reject(new Error('请输入 0~100 的信任分数'))
                      }
                      if (value < 0 || value > 100) {
                        return Promise.reject(new Error('信任分数须在 0~100 之间'))
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} placeholder="请输入 0~100 的分数" />
              </Form.Item>
              <Form.Item name="cert" label="认证标志" rules={[{ required: true, message: '请选择认证标志' }]}>
                <Select placeholder="请选择认证标志" options={CERT_OPTIONS} />
              </Form.Item>
              <Form.Item name="certOrg" label="认证机构" rules={[{ required: true, message: '请输入认证机构' }]}>
                <Input placeholder="请输入认证机构名称" maxLength={50} />
              </Form.Item>
              <Form.Item
                name="validUntil"
                label="认证有效期"
                rules={[
                  { required: true, message: '请选择认证有效期' },
                  {
                    validator: (_rule: unknown, value: dayjs.Dayjs) =>
                      value && value.isAfter(dayjs(), 'day')
                        ? Promise.resolve()
                        : Promise.reject(new Error('认证有效期须晚于今天')),
                  },
                ]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择认证有效期" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 审核弹窗 */}
      <Modal
        open={auditTarget !== null}
        title="可信农产品审核"
        okText="通过"
        cancelText="取消"
        confirmLoading={auditMutation.isPending}
        onCancel={() => setAuditTarget(null)}
        onOk={() => {
          void auditForm.validateFields().then((values) => {
            if (!auditTarget) {
              return
            }
            auditMutation.mutate({ id: auditTarget.id, action: 'approve', remark: values.remark })
          })
        }}
        footer={[
          <Button key="cancel" onClick={() => setAuditTarget(null)}>
            取消
          </Button>,
          <Button
            key="reject"
            danger
            onClick={() => {
              void auditForm.validateFields().then((values) => {
                if (!auditTarget) {
                  return
                }
                auditMutation.mutate({ id: auditTarget.id, action: 'reject', remark: values.remark })
              })
            }}
          >
            驳回
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={auditMutation.isPending}
            onClick={() => {
              void auditForm.validateFields().then((values) => {
                if (!auditTarget) {
                  return
                }
                auditMutation.mutate({ id: auditTarget.id, action: 'approve', remark: values.remark })
              })
            }}
          >
            通过
          </Button>,
        ]}
      >
        {auditTarget && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${auditTarget.id} · ${auditTarget.name}`}
              description={`申请等级：${TRUST_LEVEL_TEXT[auditTarget.level]}　信任分数：${auditTarget.score}　认证标志：${CERT_MARK_TEXT[auditTarget.cert]}`}
            />
            <Form form={auditForm} layout="vertical">
              <Form.Item name="remark" label="审核意见" rules={[{ required: true, message: '请填写审核意见' }]}>
                <Input.TextArea rows={3} placeholder="请填写审核意见" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
