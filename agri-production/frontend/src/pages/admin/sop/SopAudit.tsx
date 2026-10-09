/**
 * 页面名称：SOP模板审核
 * 路由路径：/admin/production/sop
 * 所属模块：SOP与知识库
 * PRD 序号：PRD 6.2 #26（PRD 独有页面，原型未绘制）
 *
 * 设计决策（依据 PRD「平台SOP模板库、发布审核、分级推荐」）：
 * - 模板列表：模板编号 / 名称 / 适用作物 / 适用环节 / 版本 / 状态 / 提交人 / 引用次数 / 提交时间；
 * - 「预览」抽屉展示完整模板内容（农事节点、投入品要求、关键参数）；
 * - 「审核」弹窗填写审核意见后可一键通过或驳回，调用 auditSopTemplate；
 * - 顶部统计卡汇总待审核 / 已通过 / 已驳回数量与引用总数。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { CheckCircleOutlined, EyeOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { auditSopTemplate, listSopTemplates } from '@/api'
import { DemoDataAlert } from '@/components'
import type { PageResult, SopAuditStatus, SopTemplate } from '@/types'

/** SOP 模板行模型（在基础类型上补充版本号与适用区域） */
interface SopRow extends SopTemplate {
  /** 审核状态 */
  auditStatus: SopAuditStatus
  /** 模板版本 */
  version: string
  /** 适用环节（规整后的展示名） */
  stageName: string
}

/** 审核状态文案与颜色 */
const AUDIT_STATUS_MAP: Record<SopAuditStatus, { label: string; color: string }> = {
  1: { label: '待审核', color: 'gold' },
  2: { label: '已通过', color: 'success' },
  3: { label: '已驳回', color: 'error' },
}

/** 环节选项 */
const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: '播种育苗', label: '播种育苗' },
  { value: '水肥管理', label: '水肥管理' },
  { value: '病虫害防治', label: '病虫害防治' },
  { value: '采收分级', label: '采收分级' },
  { value: '整地播种', label: '整地播种' },
]

/** 作物选项 */
const CROP_OPTIONS: { value: string; label: string }[] = [
  { value: '水稻', label: '水稻' },
  { value: '小麦', label: '小麦' },
  { value: '玉米', label: '玉米' },
  { value: '番茄', label: '番茄' },
  { value: '苹果', label: '苹果' },
  { value: '草莓', label: '草莓' },
]

/** 演示模板数据 */
const MOCK_TEMPLATES: SopRow[] = [
  {
    templateId: 'SOP-001',
    templateName: '水稻高产栽培标准作业规程',
    cropId: 'CROP-RICE',
    cropName: '水稻',
    stage: '整地播种',
    stageName: '整地播种',
    version: 'V3.2',
    content: [
      '【适用范围】黄淮海稻区单季稻，目标产量 650kg/亩。',
      '一、育秧（3/20-4/10）：选用经审定品种，浸种消毒 48h，催芽至破胸；秧田施足底肥，播种量 25kg/亩。',
      '二、移栽（5/05-5/20）：秧龄 35-40 天，栽插密度 1.8 万穴/亩，每穴 4-5 苗。',
      '三、水肥管理：移栽后 7 天施分蘖肥（尿素 8kg/亩），拔节期追施穗肥（尿素 6kg/亩 + 钾肥 4kg/亩）。',
      '四、病虫害防治：分蘖盛期与破口前各防治一次稻飞虱、稻瘟病，选用登记农药并严格执行安全间隔期。',
      '五、收获（9/25-10/10）：黄熟度 90% 以上时收割，烘干至含水率 14.5% 以下入库。',
    ].join('\n'),
    submitterName: '农艺师李',
    auditStatus: 1,
    usageCount: 128,
    submittedAt: '2025-07-10 10:20',
  },
  {
    templateId: 'SOP-002',
    templateName: '小麦病虫害绿色防控作业规程',
    cropId: 'CROP-WHEAT',
    cropName: '小麦',
    stage: '病虫害防治',
    stageName: '病虫害防治',
    version: 'V2.1',
    content: [
      '【适用范围】华北冬小麦主产区。',
      '一、播种期：种子包衣或拌种防治纹枯病、金针虫，禁止使用未登记种衣剂。',
      '二、返青拔节期：监测纹枯病病株率，达 15% 时选用井冈霉素等登记药剂防治。',
      '三、抽穗扬花期：赤霉病预警等级 3 级以上时抢晴喷药，间隔 7 天二次防治。',
      '四、灌浆期：蚜虫百株量达 500 头时防治，优先选用生物农药，安全间隔期 ≥ 21 天。',
      '五、记录要求：每次用药须关联任务、地块与投入品批次并上传作业照片。',
    ].join('\n'),
    submitterName: '农艺师王',
    auditStatus: 1,
    usageCount: 86,
    submittedAt: '2025-07-08 14:05',
  },
  {
    templateId: 'SOP-003',
    templateName: '设施番茄水肥一体化作业规程',
    cropId: 'CROP-TOMATO',
    cropName: '番茄',
    stage: '水肥管理',
    stageName: '水肥管理',
    version: 'V4.0',
    content: [
      '【适用范围】日光温室越冬茬番茄。',
      '一、苗期：基质 EC 控制在 1.2-1.6 mS/cm，灌溉频次每日 1 次，每次 8-10 分钟。',
      '二、开花坐果期：氮磷钾配比调整为 1:0.5:1.6，滴灌 2 次/日。',
      '三、结果盛期：随水追肥 2 次/周，控制棚内湿度 < 75%，注意灰霉病预防。',
      '四、采收期：果实转色 80% 以上分批采收，采后 2 小时内预冷至 10℃。',
      '五、设备要求：灌溉控制器需在线，异常离线 30 分钟自动生成告警。',
    ].join('\n'),
    submitterName: '农艺师赵',
    auditStatus: 2,
    auditRemark: '技术要点完整，同意纳入平台模板库并推荐至设施农业租户。',
    usageCount: 214,
    submittedAt: '2025-06-28 09:30',
    auditedAt: '2025-07-01 11:12',
  },
  {
    templateId: 'SOP-004',
    templateName: '红富士苹果套袋与采收规程',
    cropId: 'CROP-APPLE',
    cropName: '苹果',
    stage: '采收分级',
    stageName: '采收分级',
    version: 'V2.4',
    content: [
      '【适用范围】黄土高原优势产区红富士。',
      '一、疏果定果：花后 30 天完成，按 20-25cm 留单果。',
      '二、套袋：落花后 40-50 天完成套袋，避开雨后高温时段。',
      '三、摘袋：采前 20-25 天摘除外袋，间隔 3-5 天后摘内袋。',
      '四、采收：可溶性固形物 ≥ 14%，着色面积 ≥ 80% 时分期采收。',
      '五、分级入库：按果径 80/85/90mm 分级，预冷后入气调库。',
    ].join('\n'),
    submitterName: '农艺师孙',
    auditStatus: 2,
    auditRemark: '符合绿色食品标准要求，通过审核。',
    usageCount: 176,
    submittedAt: '2025-06-20 15:48',
    auditedAt: '2025-06-24 09:05',
  },
  {
    templateId: 'SOP-005',
    templateName: '玉米密植抗倒伏栽培规程',
    cropId: 'CROP-CORN',
    cropName: '玉米',
    stage: '播种育苗',
    stageName: '播种育苗',
    version: 'V1.3',
    content: [
      '【适用范围】东北春玉米区。',
      '一、品种选择：选用耐密的抗倒品种，积温比当地常规品种低 100℃。',
      '二、密度：保苗 4500-5000 株/亩，等行距 60cm 或宽窄行种植。',
      '三、化控：6-8 展叶期喷施化控剂，降低穗位高度。',
      '四、施肥：采用种肥同播，后期追施尿素 15kg/亩。',
      '五、收获：籽粒含水率降至 25% 以下时机械粒收。',
    ].join('\n'),
    submitterName: '农艺师周',
    auditStatus: 3,
    auditRemark: '缺少化控剂安全使用说明与无人机作业参数，请补充后重新提交。',
    usageCount: 32,
    submittedAt: '2025-06-12 11:20',
    auditedAt: '2025-06-16 16:40',
  },
  {
    templateId: 'SOP-006',
    templateName: '草莓基质育苗作业规程',
    cropId: 'CROP-STRAWBERRY',
    cropName: '草莓',
    stage: '播种育苗',
    stageName: '播种育苗',
    version: 'V1.0',
    content: [
      '【适用范围】设施草莓育苗基地。',
      '一、母株选择：选用无病毒脱毒苗，3 月上旬定植。',
      '二、匍匐茎管理：及时压蔓，每株保留 4-5 条健壮匍匐茎。',
      '三、基质配制：草炭:珍珠岩:蛭石 = 6:2:2，EC < 0.8 mS/cm。',
      '四、花芽分化：8 月中旬开始短日照处理并控氮。',
      '五、出圃：苗龄 90-100 天，根系发达、无病虫害方可出圃。',
    ].join('\n'),
    submitterName: '农艺师吴',
    auditStatus: 1,
    usageCount: 24,
    submittedAt: '2025-07-12 08:15',
  },
]

/** 本地演示数据源 */
let mockTemplateStore: SopRow[] = [...MOCK_TEMPLATES]

/** 示例数据覆盖范围（提示条文案，覆盖统计卡与列表） */
const DEMO_SCOPE = '顶部「待审核 / 已通过 / 已驳回 / 累计引用次数」统计卡与下方模板列表'

/** 示例数据写操作提示 */
const DEMO_WRITE_NOTE =
  '通过 / 驳回等审核操作只会修改浏览器本地内存中的示例数据，未写入服务端，刷新页面后即失效。'

/** 查询条件 */
interface FilterState {
  templateName?: string
  cropName?: string
  stage?: string
  auditStatus?: SopAuditStatus
}

/** 审核弹窗状态 */
interface AuditModalState {
  open: boolean
  current?: SopRow
}

/**
 * SOP模板审核页面
 * @returns 页面内容
 */
export default function SopAudit(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [auditForm] = Form.useForm<{ auditRemark: string }>()
  const [filters, setFilters] = useState<FilterState>({})
  const [rows, setRows] = useState<SopRow[]>([])
  const [previewRow, setPreviewRow] = useState<SopRow | undefined>(undefined)
  const [auditState, setAuditState] = useState<AuditModalState>({ open: false })
  /** 是否处于示例数据（演示）模式：由数据层返回的 demo 标志驱动 */
  const [demoMode, setDemoMode] = useState<boolean>(false)

  const listQuery = useQuery({
    queryKey: ['admin-sop-templates', filters],
    queryFn: async (): Promise<{ rows: SopRow[]; demo: boolean }> => {
      try {
        const page: PageResult<SopTemplate> = await listSopTemplates({
          pageNum: 1,
          pageSize: 200,
          templateName: filters.templateName,
          cropId: filters.cropName,
          auditStatus: filters.auditStatus,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          return {
            rows: page.list.map<SopRow>((item) => ({
              ...item,
              version: 'V1.0',
              stageName: item.stage ?? '—',
            })),
            demo: false,
          }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      const filtered = mockTemplateStore.filter((row) => {
        if (filters.templateName && !row.templateName.includes(filters.templateName)) {
          return false
        }
        if (filters.cropName && row.cropName !== filters.cropName) {
          return false
        }
        if (filters.stage && row.stage !== filters.stage) {
          return false
        }
        if (filters.auditStatus && row.auditStatus !== filters.auditStatus) {
          return false
        }
        return true
      })
      return { rows: filtered, demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
      setDemoMode(listQuery.data.demo)
    }
  }, [listQuery.data])

  /** 统计 */
  const stats = useMemo(() => {
    const source = mockTemplateStore
    return {
      pending: source.filter((row) => row.auditStatus === 1).length,
      approved: source.filter((row) => row.auditStatus === 2).length,
      rejected: source.filter((row) => row.auditStatus === 3).length,
      usage: source.reduce((sum, row) => sum + row.usageCount, 0),
    }
  }, [rows])

  /**
   * 提交审核结论
   * @param row 目标模板
   * @param result 2 通过 / 3 驳回
   * @param remark 审核意见
   */
  const submitAudit = async (row: SopRow, result: 2 | 3, remark: string): Promise<void> => {
    const successText = result === 2 ? '模板已通过审核' : '模板已驳回'
    try {
      await auditSopTemplate(row.templateId, { auditStatus: result, auditRemark: remark })
      message.success(successText)
    } catch {
      message.warning(`${successText}（演示模式，仅本地更新，未写入服务端，刷新后失效）`)
    }
    mockTemplateStore = mockTemplateStore.map((item) =>
      item.templateId === row.templateId
        ? {
            ...item,
            auditStatus: result,
            auditRemark: remark,
            auditedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          }
        : item,
    )
    void queryClient.invalidateQueries({ queryKey: ['admin-sop-templates'] })
  }

  const auditMutation = useMutation({
    mutationFn: (payload: { row: SopRow; result: 2 | 3; remark: string }) =>
      submitAudit(payload.row, payload.result, payload.remark),
  })

  /**
   * 打开审核弹窗
   * @param row 目标模板
   */
  const openAuditModal = (row: SopRow): void => {
    auditForm.resetFields()
    setAuditState({ open: true, current: row })
  }

  /** 弹窗内提交审核结论 */
  const handleAuditSubmit = async (result: 2 | 3): Promise<void> => {
    let remark = ''
    try {
      const values = await auditForm.validateFields()
      remark = values.auditRemark
    } catch {
      if (result === 3) {
        message.warning('驳回必须填写审核意见')
        return
      }
    }
    if (auditState.current) {
      await auditMutation.mutateAsync({ row: auditState.current, result, remark })
    }
    setAuditState({ open: false })
  }

  const columns = useMemo(
    () => [
      { title: '模板编号', dataIndex: 'templateId', width: 120 },
      {
        title: '模板名称',
        dataIndex: 'templateName',
        width: 240,
        render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
      },
      {
        title: '适用作物',
        dataIndex: 'cropName',
        width: 100,
        render: (text: string) => <Tag color="green">{text}</Tag>,
      },
      { title: '适用环节', dataIndex: 'stageName', width: 120 },
      { title: '版本', dataIndex: 'version', width: 90 },
      {
        title: '状态',
        dataIndex: 'auditStatus',
        width: 100,
        render: (status: SopAuditStatus) => (
          <Tag color={AUDIT_STATUS_MAP[status].color}>{AUDIT_STATUS_MAP[status].label}</Tag>
        ),
      },
      { title: '提交人', dataIndex: 'submitterName', width: 100 },
      { title: '引用次数', dataIndex: 'usageCount', width: 100 },
      { title: '提交时间', dataIndex: 'submittedAt', width: 150 },
      {
        title: '操作',
        key: 'action',
        width: 200,
        fixed: 'right' as const,
        render: (_: unknown, row: SopRow) => (
          <Space size={0}>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewRow(row)}>
              预览
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.auditStatus !== 1}
              icon={<CheckCircleOutlined />}
              onClick={() => openAuditModal(row)}
            >
              通过
            </Button>
            <Button
              type="link"
              size="small"
              danger
              disabled={row.auditStatus !== 1}
              icon={<StopOutlined />}
              onClick={() => openAuditModal(row)}
            >
              驳回
            </Button>
          </Space>
        ),
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {demoMode ? <DemoDataAlert scope={DEMO_SCOPE} writeNote={DEMO_WRITE_NOTE} /> : null}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  待审核模板
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  已通过模板
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={stats.approved}
              valueStyle={{ color: '#13a05a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  已驳回模板
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={stats.rejected}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={
                <Space size={6}>
                  累计引用次数
                  {demoMode ? <Tag color="orange">示例</Tag> : null}
                </Space>
              }
              value={stats.usage}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12, marginBottom: 16 }}
          onFinish={(values) => setFilters(values)}
        >
          <Form.Item name="templateName" label="模板名称">
            <Input allowClear placeholder="请输入模板名称" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="cropName" label="适用作物">
            <Select allowClear placeholder="全部" style={{ width: 140 }} options={CROP_OPTIONS} />
          </Form.Item>
          <Form.Item name="stage" label="适用环节">
            <Select allowClear placeholder="全部" style={{ width: 150 }} options={STAGE_OPTIONS} />
          </Form.Item>
          <Form.Item name="auditStatus" label="审核状态">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 140 }}
              options={[
                { value: 1, label: '待审核' },
                { value: 2, label: '已通过' },
                { value: 3, label: '已驳回' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  setFilters({})
                }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-sop-templates'] })}
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Table<SopRow>
          rowKey="templateId"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1500 }}
          locale={{ emptyText: <Empty description="暂无 SOP 模板" /> }}
        />
      </Card>

      {/* 模板内容预览抽屉 */}
      <Drawer
        title={previewRow ? `模板预览 - ${previewRow.templateName}` : '模板预览'}
        width={720}
        open={Boolean(previewRow)}
        onClose={() => setPreviewRow(undefined)}
        extra={
          previewRow && previewRow.auditStatus === 1 ? (
            <Space>
              <Button
                type="primary"
                onClick={() => {
                  const target = previewRow
                  setPreviewRow(undefined)
                  openAuditModal(target)
                }}
              >
                通过
              </Button>
              <Button
                danger
                onClick={() => {
                  const target = previewRow
                  setPreviewRow(undefined)
                  openAuditModal(target)
                }}
              >
                驳回
              </Button>
            </Space>
          ) : null
        }
      >
        {previewRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="模板编号">{previewRow.templateId}</Descriptions.Item>
              <Descriptions.Item label="版本">{previewRow.version}</Descriptions.Item>
              <Descriptions.Item label="适用作物">{previewRow.cropName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="适用环节">{previewRow.stageName}</Descriptions.Item>
              <Descriptions.Item label="提交人">{previewRow.submitterName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="引用次数">{previewRow.usageCount}</Descriptions.Item>
              <Descriptions.Item label="审核状态">
                <Tag color={AUDIT_STATUS_MAP[previewRow.auditStatus].color}>
                  {AUDIT_STATUS_MAP[previewRow.auditStatus].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="审核意见">{previewRow.auditRemark ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Card title="模板内容" size="small">
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {previewRow.content}
              </Typography.Paragraph>
            </Card>
          </Space>
        ) : null}
      </Drawer>

      {/* 审核弹窗 */}
      <Modal
        title="SOP 模板审核"
        open={auditState.open}
        width={620}
        onCancel={() => setAuditState({ open: false })}
        footer={[
          <Button key="cancel" onClick={() => setAuditState({ open: false })}>
            取消
          </Button>,
          <Button key="reject" danger loading={auditMutation.isPending} onClick={() => void handleAuditSubmit(3)}>
            驳回
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={auditMutation.isPending}
            onClick={() => void handleAuditSubmit(2)}
          >
            通过
          </Button>,
        ]}
      >
        <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="模板名称">{auditState.current?.templateName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="适用作物 / 环节">
            {auditState.current
              ? `${auditState.current.cropName ?? '—'} / ${auditState.current.stageName}`
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="版本">{auditState.current?.version ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="提交人">{auditState.current?.submitterName ?? '—'}</Descriptions.Item>
        </Descriptions>
        <Form form={auditForm} layout="vertical">
          <Form.Item
            name="auditRemark"
            label="审核意见"
            extra="驳回时必须填写审核意见"
            rules={[{ max: 200, message: '审核意见不超过 200 字' }]}
          >
            <Input.TextArea rows={4} placeholder="请填写审核意见" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
