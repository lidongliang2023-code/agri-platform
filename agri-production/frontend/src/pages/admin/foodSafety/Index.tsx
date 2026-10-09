/**
 * 页面名称：食品安全监控中心
 * 路由路径：/admin/production/food-safety
 * 所属模块：食品安全
 * 原型 pageId：food-safety（PRD 外，原型补充页面 P15）
 *
 * 原型结构：指标卡 → 风险热力图（16 格农场食品安全评分）→ 食品安全事件告警清单。
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  HomeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import {
  FOOD_SAFETY_WRITE_ALERT,
  getFoodSafetyMetrics,
  handleFoodSafetyAlert,
  isMockSource,
  isWriteBackendConfirmed,
  listFarmRisk,
  listFoodSafetyAlerts,
  notifyWriteResult,
} from '@/api/admin/foodSafety'
import type { FoodSafetyAlert, SafetyAlertLevel } from '@/api/admin/foodSafety'

const { Text, Title } = Typography

/** 告警级别文案 */
const LEVEL_TEXT: Record<SafetyAlertLevel, string> = {
  urgent: '紧急',
  important: '重要',
  normal: '一般',
}

/** 告警级别 Tag 颜色 */
const LEVEL_COLOR: Record<SafetyAlertLevel, string> = {
  urgent: 'red',
  important: 'orange',
  normal: 'blue',
}

/** 告警级别圆点图标（原型：🔴 紧急 / 🟡 重要 / 🟠 一般） */
const LEVEL_DOT: Record<SafetyAlertLevel, string> = {
  urgent: '🔴',
  important: '🟡',
  normal: '🟠',
}

/** 告警状态 Tag 颜色 */
const ALERT_STATUS_COLOR: Record<string, string> = {
  待处理: 'red',
  处理中: 'gold',
  已处理: 'green',
}

/** 处置措施下拉选项 */
const MEASURE_OPTIONS: string[] = [
  '封存批次并启动复检',
  '通知农场负责人整改',
  '下架并召回流通批次',
  '转属地监管部门处理',
  '要求补传检测报告',
]

/** 风险热力图列分组（4×4） */
const HEATMAP_COLUMNS: string[] = ['一组', '二组', '三组', '四组']
/** 风险热力图行分组（4×4） */
const HEATMAP_ROWS: string[] = ['第一排', '第二排', '第三排', '第四排']

/**
 * 食品安全监控中心
 *
 * 业务职责：汇总平台食品安全态势，包括食品安全综合指数、检测合格率、告警数量与
 * 合规校验通过率，通过农场风险热力图定位高风险主体，并对食品安全事件告警进行处置。
 * 数据优先取后端 /admin/food-safety/*，接口未就绪时降级到原型示例口径（原型 4.2）。
 *
 * @returns 页面内容
 */
export default function Index(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 告警处置弹窗当前处理的告警 */
  const [activeAlert, setActiveAlert] = useState<FoodSafetyAlert | null>(null)
  /** 告警详情弹窗当前查看的告警 */
  const [detailAlert, setDetailAlert] = useState<FoodSafetyAlert | null>(null)
  /** 处置表单 */
  const [handleForm] = Form.useForm<{ measure: string; remark?: string }>()

  /** 核心指标 */
  const metricsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'metrics'],
    queryFn: () => getFoodSafetyMetrics(),
    retry: false,
  })

  /** 农场风险评分（热力图） */
  const riskQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'risk'],
    queryFn: () => listFarmRisk(),
    retry: false,
  })

  /** 食品安全事件告警 */
  const alertsQuery = useQuery({
    queryKey: ['admin', 'food-safety', 'alerts'],
    queryFn: () => listFoodSafetyAlerts(20),
    retry: false,
  })

  /** 处置告警（只有 result.ok 才提示成功并关闭弹窗） */
  const handleMutation = useMutation({
    mutationFn: (payload: { id: string; measure: string; remark?: string }) =>
      handleFoodSafetyAlert(payload.id, { measure: payload.measure, remark: payload.remark }),
    onSuccess: (result) => {
      notifyWriteResult(message, result, '告警处置已提交并写入服务端')
      if (!result.ok) {
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety', 'alerts'] })
      setActiveAlert(null)
      handleForm.resetFields()
    },
    onError: (error: Error) => {
      message.error(error.message || '处置失败，请稍后重试')
    },
  })

  /** 核心指标（带兜底） */
  const metrics = metricsQuery.data
  /** 风险列表 */
  const riskList = riskQuery.data ?? []
  /** 告警列表 */
  const alertList = alertsQuery.data ?? []

  /** 风险热力图配置 */
  const heatmapOption = useMemo<EChartsOption>(() => {
    const data = riskList.slice(0, 16).map((item, index) => ({
      value: [index % 4, Math.floor(index / 4), item.score],
      name: item.farmName,
    }))
    return {
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number[] }
          const score = p.value?.[2] ?? 0
          return `${p.name ?? ''}<br/>食品安全评分：${score}`
        },
      },
      grid: { left: 70, right: 24, top: 16, bottom: 70 },
      xAxis: {
        type: 'category',
        data: HEATMAP_COLUMNS,
        splitArea: { show: true },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: HEATMAP_ROWS,
        inverse: true,
        splitArea: { show: true },
        axisLine: { show: false },
      },
      visualMap: {
        min: 0,
        max: 100,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        itemWidth: 14,
        itemHeight: 90,
        pieces: [
          { min: 80, max: 100, label: '🟢 ≥80 低风险', color: '#52c41a' },
          { min: 60, max: 80, label: '🟡 60-80 中风险', color: '#faad14' },
          { min: 0, max: 60, label: '🔴 <60 高风险', color: '#ff4d4f' },
        ],
      },
      series: [
        {
          name: '食品安全评分',
          type: 'heatmap',
          data,
          label: { show: true, color: '#fff', fontWeight: 'bold' },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' } },
        },
      ],
    }
  }, [riskList])

  /** 风险等级分布饼图配置 */
  const riskPieOption = useMemo<EChartsOption>(() => {
    const high = riskList.filter((item) => item.score < 60).length
    const middle = riskList.filter((item) => item.score >= 60 && item.score < 80).length
    const low = riskList.filter((item) => item.score >= 80).length
    return {
      tooltip: { trigger: 'item', formatter: '{b}：{c} 个农场（{d}%）' },
      legend: { bottom: 0, itemWidth: 12, itemHeight: 12 },
      series: [
        {
          name: '风险等级分布',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{c} 个' },
          data: [
            { name: '低风险(≥80)', value: low, itemStyle: { color: '#52c41a' } },
            { name: '中风险(60-80)', value: middle, itemStyle: { color: '#faad14' } },
            { name: '高风险(<60)', value: high, itemStyle: { color: '#ff4d4f' } },
          ],
        },
      ],
    }
  }, [riskList])

  /** 告警表格列 */
  const alertColumns: ColumnsType<FoodSafetyAlert> = [
    {
      title: '级别',
      dataIndex: 'level',
      width: 110,
      render: (level: SafetyAlertLevel) => (
        <Tag color={LEVEL_COLOR[level]}>
          {LEVEL_DOT[level]} {LEVEL_TEXT[level]}
        </Tag>
      ),
    },
    {
      title: '告警类型',
      dataIndex: 'type',
      width: 140,
      render: (type: string) => <Text strong>{type}</Text>,
    },
    { title: '告警对象', dataIndex: 'target', width: 160 },
    { title: '关联编号', dataIndex: 'code', width: 110 },
    { title: '发生时间', dataIndex: 'time', width: 130 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => <Tag color={ALERT_STATUS_COLOR[status] ?? 'default'}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, record: FoodSafetyAlert) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailAlert(record)}>
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ToolOutlined />}
            disabled={record.status === '已处理'}
            onClick={() => {
              setActiveAlert(record)
              handleForm.setFieldsValue({ measure: MEASURE_OPTIONS[0], remark: '' })
            }}
          >
            处理
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 面包屑 + 标题 + 实时监控标识（原型 P15 顶部栏） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '食品安全' },
              { title: '监控中心' },
            ]}
          />
          <Space align="center" size={8}>
            <Title level={4} style={{ margin: 0 }}>
              食品安全监控中心
            </Title>
            <Tag icon={<SyncOutlined spin />} color="success">
              实时监控中
            </Tag>
          </Space>
          <Text type="secondary">食品安全综合指数、风险热力图与事件告警</Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety'] })
              }}
            >
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 示例数据明示（食品安全为合规强相关数据，禁止静默降级） */}
      {isMockSource('metrics', 'risk', 'alerts') && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 12 }}
          message="当前展示示例数据，后端接口建设中"
          description="食品安全属于合规强相关数据：本页指标、风险评分与告警均取自原型示例口径（原型 4.2），不代表真实生产数据，请勿用于对外报送或监管举证。后端 /admin/food-safety/* 接口上线后本页将自动切换真实数据。"
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
          description={`${FOOD_SAFETY_WRITE_ALERT.description}本页涉及：告警处置。`}
        />
      )}

      {/* 专项治理快捷入口（监控中心下钻到各专项页面） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Text type="secondary">专项治理：</Text>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/circulation')}>
            流通异常检测
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/compliance')}>
            合规校验管理
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/trust-label')}>
            可信农产品管理
          </Button>
          <Button type="link" size="small" onClick={() => navigate('/admin/production/food-safety/cold-chain')}>
            冷链资源撮合
          </Button>
        </Space>
      </Card>

      {/* 数据异常提示 */}
      {(metricsQuery.isError || riskQuery.isError || alertsQuery.isError) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="部分指标获取失败，已切换为示例数据展示"
          action={
            <Button
              size="small"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ['admin', 'food-safety'] })
              }}
            >
              重试
            </Button>
          }
        />
      )}

      {/* 指标卡（原型 P15 Metrics Cards） */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic
                title={
                  <Space size={4}>
                    <SafetyCertificateOutlined />
                    食品安全综合指数
                  </Space>
                }
                value={metrics?.safetyIndex ?? 0}
                precision={1}
                suffix="/ 100"
                valueStyle={{ color: '#1677ff' }}
              />
            )}
            <Text type="success">↑ {metrics?.safetyIndexDelta ?? 0} 较上月</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic
                title={
                  <Space size={4}>
                    <CheckCircleOutlined />
                    检测合格率
                  </Space>
                }
                value={metrics?.passRate ?? 0}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            )}
            <Text type="success">↑ {metrics?.passRateDelta ?? 0}%</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic
                title={
                  <Space size={4}>
                    <WarningOutlined />
                    食品安全告警
                  </Space>
                }
                value={metrics?.alertCount ?? 0}
                valueStyle={{ color: '#faad14' }}
              />
            )}
            <Space size={6}>
              <Badge status="error" />
              <Text type="danger">{metrics?.urgentAlertCount ?? 0} 紧急</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            {metricsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            ) : (
              <Statistic
                title="合规校验通过率"
                value={metrics?.compliancePassRate ?? 0}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#1677ff' }}
              />
            )}
            <Text type="secondary">冷链达标率 {metrics?.coldChainPassRate ?? 0}%</Text>
          </Card>
        </Col>
      </Row>

      {/* 风险热力图 + 风险等级分布 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} xl={16}>
          <Card
            title="风险热力图 - 各农场食品安全风险"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                数值 = 食品安全评分（满分 100）
              </Text>
            }
          >
            {riskQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} title={false} />
            ) : riskList.length === 0 ? (
              <Empty description="暂无农场风险评分数据" />
            ) : (
              <ReactECharts option={heatmapOption} style={{ height: 360 }} notMerge />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="风险等级分布">
            {riskQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} title={false} />
            ) : riskList.length === 0 ? (
              <Empty description="暂无风险分布数据" />
            ) : (
              <ReactECharts option={riskPieOption} style={{ height: 360 }} notMerge />
            )}
          </Card>
        </Col>
      </Row>

      {/* 食品安全事件告警（原型 P15 Alert List） */}
      <Card
        title="食品安全事件告警"
        extra={
          <Button
            type="link"
            onClick={() => navigate('/admin/production/alerts')}
            style={{ paddingInline: 0 }}
          >
            查看全部告警 <ArrowRightOutlined />
          </Button>
        }
      >
        <Table<FoodSafetyAlert>
          rowKey="id"
          size="middle"
          loading={alertsQuery.isLoading}
          columns={alertColumns}
          dataSource={alertList}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无食品安全告警" /> }}
        />
      </Card>

      {/* 告警详情弹窗 */}
      <Modal
        open={detailAlert !== null}
        title="告警详情"
        onCancel={() => setDetailAlert(null)}
        footer={[
          <Button key="close" onClick={() => setDetailAlert(null)}>
            关闭
          </Button>,
        ]}
      >
        {detailAlert && (
          <Descriptions column={1} size="small" bordered items={[
            { key: 'id', label: '告警编号', children: detailAlert.id },
            { key: 'type', label: '告警类型', children: detailAlert.type },
            {
              key: 'level',
              label: '告警级别',
              children: (
                <Tag color={LEVEL_COLOR[detailAlert.level]}>
                  {LEVEL_DOT[detailAlert.level]} {LEVEL_TEXT[detailAlert.level]}
                </Tag>
              ),
            },
            { key: 'target', label: '告警对象', children: detailAlert.target },
            { key: 'code', label: '关联编号', children: detailAlert.code },
            { key: 'time', label: '发生时间', children: detailAlert.time },
            {
              key: 'status',
              label: '处理状态',
              children: (
                <Tag color={ALERT_STATUS_COLOR[detailAlert.status] ?? 'default'}>{detailAlert.status}</Tag>
              ),
            },
            { key: 'measure', label: '处置措施', children: detailAlert.measure ?? '—' },
          ]} />
        )}
      </Modal>

      {/* 告警处置弹窗 */}
      <Modal
        open={activeAlert !== null}
        title="处置食品安全告警"
        okText="提交处置"
        cancelText="取消"
        confirmLoading={handleMutation.isPending}
        onCancel={() => setActiveAlert(null)}
        onOk={() => {
          void handleForm.validateFields().then((values) => {
            if (!activeAlert) {
              return
            }
            handleMutation.mutate({ id: activeAlert.id, measure: values.measure, remark: values.remark })
          })
        }}
      >
        {activeAlert && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${activeAlert.type} · ${activeAlert.target} ${activeAlert.code}`}
              description={`发生时间：${activeAlert.time}`}
            />
            <Form form={handleForm} layout="vertical">
              <Form.Item
                name="measure"
                label="处置措施"
                rules={[{ required: true, message: '请选择处置措施' }]}
              >
                <Select
                  placeholder="请选择处置措施"
                  options={MEASURE_OPTIONS.map((item) => ({ value: item, label: item }))}
                />
              </Form.Item>
              <Form.Item
                name="remark"
                label="处置说明"
                rules={[{ required: true, message: '请填写处置说明' }]}
              >
                <Input.TextArea rows={3} placeholder="请填写处置说明，例如联系人、整改期限等" maxLength={200} showCount />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
