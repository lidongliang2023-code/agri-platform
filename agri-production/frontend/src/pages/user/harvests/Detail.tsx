/**
 * 页面名称：采收详情
 * 路由路径：/production/harvests/:harvestId
 * 所属模块：采收与库存管理
 * 原型 pageId：P15 harvest-detail
 *
 * 还原要点：
 * - 头部：`< 返回 采收记录 H20260601`；按钮「确认入库」「打印采收单」
 * - 「📋 采收信息」：采收编号、状态、农场、地块、作物品种、采收日期、采收数量、
 *   采收面积、采收人、质量等级、外观评价、亩产量
 * - 「🔗 关联信息」：关联农事任务（→task-detail）、关联溯源码（→trace-fullchain）
 * - 产量统计：预计产量 vs 实际产量 vs 完成率 + 亩产量
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, InboxOutlined, PrinterOutlined } from '@ant-design/icons'
import { DetailInfoGrid, DetailMetricGrid } from '@/components'
import useFarmStore from '@/store/farm'
import { inboundHarvest, queryHarvest } from '@/api/harvests'
import type { HarvestBatch, InboundStatus } from '@/types'
import {
  BATCH_STATUS_META,
  GRADE_COLOR_MAP,
  GRADE_LABEL_MAP,
  INBOUND_STATUS_META,
  WAREHOUSE_OPTIONS,
} from '@/types'

/** 入库弹窗表单值 */
interface InboundFormValues {
  /** 目标仓库 */
  warehouseName?: string
  /** 备注 */
  remark?: string
}

/**
 * 采收详情页面
 *
 * 业务职责：展示单个采收批次的基础信息、关联任务与溯源码、产量统计，并支持确认入库。
 *
 * @returns 页面内容
 */
export default function Detail(): JSX.Element {
  const { harvestId } = useParams<{ harvestId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)

  const [inboundOpen, setInboundOpen] = useState<boolean>(false)
  const [inboundForm] = Form.useForm<InboundFormValues>()

  /** 采收批次详情 */
  const detailQuery = useQuery({
    queryKey: ['production-harvests', 'detail', harvestId],
    enabled: Boolean(harvestId),
    queryFn: () => queryHarvest(harvestId as string),
  })

  /** 确认入库 */
  const inboundMutation = useMutation({
    mutationFn: (warehouseName: string) =>
      inboundHarvest(harvestId as string, { warehouseName }),
    onSuccess: () => {
      message.success('批次已入库，库存流水已生成')
      setInboundOpen(false)
      inboundForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['production-harvests'] })
    },
    onError: (error) => {
      message.error(error.message || '入库失败，请稍后重试', 6)
    },
  })

  /** 打印采收单 */
  const handlePrint = (): void => {
    window.print()
  }

  /**
   * 提交入库。
   *
   * 仓库名**不再有默认值**：该项必填，`validateFields` 已保证有值；
   * 这里再兜一次是为了类型收口——真拿不到就直接失败，不用"主仓库"冒充。
   */
  const handleInbound = (): void => {
    inboundForm.validateFields().then((values) => {
      const warehouseName = values.warehouseName as string | undefined
      if (!warehouseName) {
        message.error('请先选择入库仓库，未提交到服务端')
        return
      }
      inboundMutation.mutate(warehouseName)
    })
  }

  const batch: HarvestBatch | undefined = detailQuery.data

  /** 加载态 */
  if (detailQuery.isLoading) {
    return (
      <PageContainer title="采收详情">
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </PageContainer>
    )
  }

  /** 错误态 / 空态 */
  if (detailQuery.isError || !batch) {
    return (
      <PageContainer title="采收详情">
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">未查询到该采收批次，请返回列表重试</Typography.Text>
              <Button onClick={() => navigate('/production/harvests')}>返回采收管理</Button>
            </Space>
          }
        />
      </PageContainer>
    )
  }

  /** 入库状态由后端库存动作维护，页面不再猜测。 */
  const inboundStatus = (batch.inboundStatus ?? 0) as InboundStatus
  const inbound = INBOUND_STATUS_META[inboundStatus]
  const finishRate =
    batch.expectedQuantity && batch.expectedQuantity > 0
      ? Math.round(((batch.quantity ?? 0) / batch.expectedQuantity) * 100)
      : 0

  return (
    <PageContainer
      title={`📦 采收记录 ${batch.batchNo}`}
      subTitle={batch.farmName ?? currentFarm?.farmName}
      onBack={() => navigate('/production/harvests')}
      backIcon={<ArrowLeftOutlined />}
      extra={[
        <Button
          key="inbound"
          type="primary"
          icon={<InboxOutlined />}
          disabled={inboundStatus !== 0}
          loading={inboundMutation.isPending}
          onClick={() => setInboundOpen(true)}
        >
          {inboundStatus === 0 ? '确认入库' : '已入库'}
        </Button>,
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
          打印采收单
        </Button>,
      ]}
    >

      <Card
        title="📋 基本信息"
        style={{ marginBottom: 16 }}
        extra={
          <Space size={4} wrap>
            <Tag color={inbound.color}>
              <span style={{ color: inbound.color }}>●</span> {inbound.label}
            </Tag>
            <Tag color={BATCH_STATUS_META[batch.status]?.color ?? 'default'}>
              {BATCH_STATUS_META[batch.status]?.label ?? batch.status}
            </Tag>
          </Space>
        }
      >
        <DetailInfoGrid
          columns={2}
          items={[
            { key: 'batchNo', label: '采收编号', value: batch.batchNo },
            { key: 'farm', label: '农场', value: batch.farmName ?? '-' },
            {
              key: 'plot',
              label: '地块',
              value: batch.plotName ?? batch.plotId ?? '-',
            },
            {
              key: 'crop',
              label: '作物品种',
              value: `${batch.cropName ?? '-'}${
                batch.cropVariety ? `(${batch.cropVariety})` : ''
              }`,
            },
            { key: 'harvestDate', label: '采收日期', value: batch.harvestDate },
            {
              key: 'quantity',
              label: '采收数量',
              value: `${batch.quantity.toLocaleString()} ${batch.unit}`,
            },
            {
              key: 'harvestArea',
              label: '采收面积',
              value: batch.harvestArea ? `${batch.harvestArea} 亩` : '-',
            },
            { key: 'operator', label: '采收人', value: batch.operatorName ?? '-' },
            {
              key: 'grade',
              label: '质量等级',
              value: (
                <Tag color={GRADE_COLOR_MAP[batch.grade] ?? 'default'}>
                  {GRADE_LABEL_MAP[batch.grade] ?? batch.grade}
                </Tag>
              ),
            },
            { key: 'appearance', label: '外观评价', value: batch.appearance ?? '-' },
            {
              key: 'perMuYield',
              label: '亩产量',
              value: batch.perMuYield ? `${batch.perMuYield} ${batch.unit}/亩` : '-',
            },
            { key: 'warehouse', label: '存放仓库', value: batch.warehouseName ?? '-' },
            { key: 'createdAt', label: '登记时间', value: batch.createdAt ?? '-' },
            {
              key: 'remark',
              label: '备注',
              fullWidth: true,
              value: batch.remark ?? '-',
            },
          ]}
        />
      </Card>

      <Card title="📊 产量统计" style={{ marginBottom: 16 }}>
        <DetailMetricGrid
          items={[
            {
              key: 'quantity',
              title: '实际采收',
              value: batch.quantity,
              precision: 2,
              suffix: batch.unit,
              valueStyle: { color: '#1677ff' },
            },
            {
              key: 'expected',
              title: '预计产量',
              value: batch.expectedQuantity ?? 0,
              suffix: 'kg',
            },
            {
              key: 'rate',
              title: '完成率',
              value: finishRate,
              suffix: '%',
              valueStyle: { color: finishRate >= 100 ? '#52c41a' : '#faad14' },
            },
            {
              key: 'perMuYield',
              title: '亩产量',
              value: batch.perMuYield ?? 0,
              precision: 2,
              suffix: `${batch.unit}/亩`,
            },
          ]}
        />
        <Progress
          style={{ marginTop: 16 }}
          percent={Math.min(finishRate, 100)}
          status={finishRate >= 100 ? 'success' : 'active'}
        />
      </Card>

      <Card title="🔗 关联信息">
        <DetailInfoGrid
          columns={2}
          items={[
            {
              key: 'task',
              label: '关联农事任务',
              value: batch.relatedTaskId ? (
                <Typography.Link
                  onClick={() => navigate(`/production/tasks/${batch.relatedTaskId}`)}
                >
                  {batch.relatedTaskName ?? batch.relatedTaskId}
                </Typography.Link>
              ) : (
                '-'
              ),
            },
            {
              key: 'trace',
              label: '关联溯源码',
              value: batch.traceCode ? (
                <Typography.Link
                  onClick={() =>
                    navigate(
                      `/production/trace/full-chain?code=${encodeURIComponent(
                        batch.traceCode as string,
                      )}`,
                    )
                  }
                >
                  {batch.traceCode}
                </Typography.Link>
              ) : (
                <Space size={4}>
                  <Typography.Text type="secondary">未生成溯源码</Typography.Text>
                  {inboundStatus === 0 ? (
                    <Typography.Text type="secondary">（入库后自动生成）</Typography.Text>
                  ) : null}
                </Space>
              ),
            },
            {
              key: 'inspection',
              label: '关联检测单',
              value: batch.inspectionNo ?? batch.inspectionId ?? '-',
            },
            {
              key: 'inventory',
              label: '关联库存',
              value: batch.inventoryId ? (
                <Typography.Link
                  onClick={() =>
                    navigate(`/production/harvests/inventory/${batch.inventoryId}`)
                  }
                >
                  {batch.inventoryId}
                </Typography.Link>
              ) : (
                '-'
              ),
            },
          ]}
        />
        <Space style={{ marginTop: 12 }}>
          <Button onClick={() => navigate(`/production/trace/full-chain`)}>
            查看全链路溯源
          </Button>
          <Button onClick={() => navigate('/production/harvests/inventory')}>查看成品库存</Button>
        </Space>
      </Card>

      <Modal
        title={`确认入库：${batch.batchNo}`}
        open={inboundOpen}
        okText="确认入库"
        cancelText="取消"
        confirmLoading={inboundMutation.isPending}
        onOk={handleInbound}
        onCancel={() => {
          setInboundOpen(false)
          inboundForm.resetFields()
        }}
        destroyOnClose
      >
        <Form
          form={inboundForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          /* 不再默认"主仓库"：默认值会被当成真实仓库名直接入库（与 ?? 0 兜底同型） */
          initialValues={{}}
        >
          <Form.Item
            name="warehouseName"
            label="入库仓库"
            rules={[{ required: true, message: '请选择入库仓库' }]}
          >
            <Select options={WAREHOUSE_OPTIONS} placeholder="请选择入库仓库" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写库位、转运车辆等说明" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message={`本次入库数量 ${batch.quantity} ${batch.unit}，入库后批次状态更新为「在库」`}
          />
        </Form>
      </Modal>
    </PageContainer>
  )
}
