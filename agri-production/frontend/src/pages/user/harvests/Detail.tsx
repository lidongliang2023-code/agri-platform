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
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, InboxOutlined, PrinterOutlined } from '@ant-design/icons'
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
    onError: () => {
      message.error('入库失败，请稍后重试')
    },
  })

  /** 打印采收单 */
  const handlePrint = (): void => {
    window.print()
  }

  /** 提交入库 */
  const handleInbound = (): void => {
    inboundForm.validateFields().then((values) => {
      inboundMutation.mutate(values.warehouseName ?? '主仓库')
    })
  }

  const batch: HarvestBatch | undefined = detailQuery.data?.data

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

  const inbound = INBOUND_STATUS_META[(batch.inboundStatus ?? 0) as InboundStatus]
  const finishRate =
    batch.expectedQuantity && batch.expectedQuantity > 0
      ? Math.round(((batch.quantity ?? 0) / batch.expectedQuantity) * 100)
      : 0

  return (
    <PageContainer
      title={
        <Space size={8}>
          <Typography.Link onClick={() => navigate('/production/harvests')}>
            <ArrowLeftOutlined /> 返回
          </Typography.Link>
          <span>采收记录 {batch.batchNo}</span>
        </Space>
      }
      subTitle={batch.farmName ?? currentFarm?.farmName}
      extra={[
        <Button
          key="inbound"
          type="primary"
          icon={<InboxOutlined />}
          disabled={(batch.inboundStatus ?? 0) !== 0}
          loading={inboundMutation.isPending}
          onClick={() => setInboundOpen(true)}
        >
          确认入库
        </Button>,
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
          打印采收单
        </Button>,
      ]}
    >
      {detailQuery.data?.demo ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="后端采收接口暂未返回数据，当前展示内置演示数据（取自原型 P15）"
        />
      ) : null}

      <Card title="📋 采收信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={3} size="middle">
          <Descriptions.Item label="采收编号">{batch.batchNo}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Space size={4}>
              <Tag color={inbound.color}>
                <span style={{ color: inbound.color }}>●</span> {inbound.label}
              </Tag>
              <Tag color={BATCH_STATUS_META[batch.status]?.color ?? 'default'}>
                {BATCH_STATUS_META[batch.status]?.label ?? batch.status}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="农场">{batch.farmName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="地块">{batch.plotName ?? batch.plotId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="作物品种">
            {batch.cropName ?? '-'}
            {batch.cropVariety ? `(${batch.cropVariety})` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="采收日期">{batch.harvestDate}</Descriptions.Item>
          <Descriptions.Item label="采收数量">
            {batch.quantity.toLocaleString()} {batch.unit}
          </Descriptions.Item>
          <Descriptions.Item label="采收面积">
            {batch.harvestArea ? `${batch.harvestArea} 亩` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="采收人">{batch.operatorName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="质量等级">
            <Tag color={GRADE_COLOR_MAP[batch.grade] ?? 'default'}>
              {GRADE_LABEL_MAP[batch.grade] ?? batch.grade}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="外观评价">{batch.appearance ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="亩产量">
            {batch.perMuYield ? `${batch.perMuYield} ${batch.unit}/亩` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="存放仓库">{batch.warehouseName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="登记时间">{batch.createdAt ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
            {batch.remark ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="📊 产量统计" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="实际采收"
              value={batch.quantity}
              precision={2}
              suffix={batch.unit}
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="预计产量" value={batch.expectedQuantity ?? 0} suffix="kg" />
          </Col>
          <Col span={6}>
            <Statistic
              title="完成率"
              value={finishRate}
              suffix="%"
              valueStyle={{ color: finishRate >= 100 ? '#52c41a' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="亩产量"
              value={batch.perMuYield ?? 0}
              precision={2}
              suffix={`${batch.unit}/亩`}
            />
          </Col>
        </Row>
        <Progress
          style={{ marginTop: 16 }}
          percent={Math.min(finishRate, 100)}
          status={finishRate >= 100 ? 'success' : 'active'}
        />
      </Card>

      <Card title="🔗 关联信息">
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="关联农事任务">
            {batch.relatedTaskId ? (
              <Typography.Link
                onClick={() => navigate(`/production/tasks/${batch.relatedTaskId}`)}
              >
                {batch.relatedTaskName ?? batch.relatedTaskId}
              </Typography.Link>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="关联溯源码">
            {batch.traceCode ? (
              <Typography.Link
                onClick={() =>
                  navigate(`/production/trace/full-chain?code=${encodeURIComponent(batch.traceCode as string)}`)
                }
              >
                {batch.traceCode}
              </Typography.Link>
            ) : (
              <Space>
                <Typography.Text type="secondary">未生成溯源码</Typography.Text>
                {(batch.inboundStatus ?? 0) === 0 ? (
                  <Typography.Text type="secondary">（入库后自动生成）</Typography.Text>
                ) : null}
              </Space>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="关联检测单">
            {batch.inspectionNo ?? batch.inspectionId ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="关联库存">
            {batch.inventoryId ? (
              <Typography.Link
                onClick={() => navigate(`/production/harvests/inventory/${batch.inventoryId}`)}
              >
                {batch.inventoryId}
              </Typography.Link>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>
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
          initialValues={{ warehouseName: '主仓库' }}
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
