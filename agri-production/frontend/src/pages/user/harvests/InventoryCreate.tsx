/**
 * 页面名称：新增库存
 * 路由路径：/production/harvests/inventory/create
 * 所属模块：采收与库存管理
 * 原型 pageId：P17 inventory-create
 *
 * 还原要点：
 * - 「☐ 库存信息」：品名、仓库、入库数量、单位、批次号（自动生成或手动输入）、
 *   保质期至、关联采收记录（可选）、备注
 * - 底部：取消 / 保存（→inventory）
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { queryHarvests, submitInventory } from '@/api/harvests'
import type { HarvestBatch } from '@/types'
import { GRADE_OPTIONS, HARVEST_UNIT_OPTIONS, WAREHOUSE_OPTIONS } from '@/types'

/** 新增库存表单值 */
interface InventoryFormValues {
  /** 品名 */
  productName?: string
  /** 品类 */
  category?: string
  /** 仓库 */
  warehouseName?: string
  /** 入库数量 */
  currentQty?: number
  /** 计量单位 */
  unit?: string
  /** 批次号 */
  batchNo?: string
  /** 安全库存 */
  safeQty?: number
  /** 库位编号 */
  locationCode?: string
  /** 保质期至 */
  expireDate?: Dayjs
  /** 关联采收批次 ID */
  relatedBatchId?: string
  /** 质量等级 */
  grade?: string
  /** 备注 */
  remark?: string
}

/**
 * 生成默认批次号：BC + 日期 + 4 位随机序列（对齐 R-HARV-01 的 BC 前缀规则）。
 *
 * @returns 默认批次号
 */
function generateBatchNo(): string {
  const date = dayjs().format('YYYYMMDD')
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BC${date}${seq}`
}

/**
 * 新增库存页面
 *
 * 业务职责：登记一条成品库存（入库），可关联已有采收批次。
 *
 * @returns 页面内容
 */
export default function InventoryCreate(): JSX.Element {
  const navigate = useNavigate()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const [form] = Form.useForm<InventoryFormValues>()

  /** 采收批次下拉（关联采收记录） */
  const harvestQuery = useQuery({
    queryKey: ['production-harvests', 'options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => queryHarvests({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 关联采收记录下拉选项 */
  const harvestOptions = useMemo(
    () =>
      (harvestQuery.data?.list ?? []).map((batch: HarvestBatch) => ({
        value: batch.batchId,
        label: `${batch.batchNo} - ${batch.cropName ?? ''} ${batch.quantity}${batch.unit}`,
      })),
    [harvestQuery.data],
  )

  /** 提交新增库存 */
  const submitMutation = useMutation({
    mutationFn: (payload: Parameters<typeof submitInventory>[0]) => submitInventory(payload),
    onSuccess: (record) => {
      message.success(`库存 ${record.inventoryId} 已创建`)
      navigate('/production/harvests/inventory')
    },
    onError: (error) => {
      message.error(error.message || '保存失败，请稍后重试', 6)
    },
  })

  /** 自动生成批次号 */
  const handleGenerateBatchNo = (): void => {
    form.setFieldsValue({ batchNo: generateBatchNo() })
  }

  /** 选择关联采收记录时自动带出品名与数量 */
  const handleHarvestChange = (value: string): void => {
    const batch = (harvestQuery.data?.list ?? []).find(
      (item: HarvestBatch) => item.batchId === value,
    )
    if (batch) {
      form.setFieldsValue({
        productName: `${batch.cropName ?? ''}(${batch.grade ?? ''}级)`,
        category: batch.cropName,
        currentQty: batch.quantity,
        unit: batch.unit,
        grade: batch.grade,
      })
    }
  }

  /** 保存 */
  const handleSave = (): void => {
    form
      .validateFields()
      .then((values) => {
        const batch = (harvestQuery.data?.list ?? []).find(
          (item: HarvestBatch) => item.batchId === values.relatedBatchId,
        )
        submitMutation.mutate({
          batchId: values.relatedBatchId ?? '',
          batchNo: values.batchNo ?? generateBatchNo(),
          warehouseName: values.warehouseName,
          currentQty: values.currentQty ?? 0,
          unit: values.unit ?? 'kg',
          productName: values.productName,
          category: values.category,
          grade: values.grade as HarvestBatch['grade'],
          safeQty: values.safeQty ?? 0,
          locationCode: values.locationCode,
          expireDate: values.expireDate?.format('YYYY-MM-DD'),
          relatedBatchNo: batch?.batchNo,
          remark: values.remark,
        })
      })
      .catch(() => {
        message.warning('请完整填写必填项后再提交')
      })
  }

  return (
    <PageContainer
      title={
        <Space size={8}>
          <Typography.Link onClick={() => navigate('/production/harvests/inventory')}>
            <ArrowLeftOutlined /> 返回
          </Typography.Link>
          <span>新增库存</span>
        </Space>
      }
      subTitle={currentFarm?.farmName}
      extra={[
        <Button key="cancel" onClick={() => navigate('/production/harvests/inventory')}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={submitMutation.isPending}
          onClick={handleSave}
        >
          保存
        </Button>,
      ]}
    >
      <Card title="☐ 库存信息" style={{ maxWidth: 880 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ warehouseName: '主仓库', unit: 'kg', batchNo: generateBatchNo() }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="productName"
                label="品名"
                rules={[{ required: true, message: '请输入品名' }]}
              >
                <Input placeholder="请输入品名，如 番茄(A级)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="品类">
                <Input placeholder="如 番茄（用于库存筛选）" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="warehouseName"
                label="仓库"
                rules={[{ required: true, message: '请选择仓库' }]}
              >
                <Select options={WAREHOUSE_OPTIONS} placeholder="请选择仓库" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="locationCode" label="库位编号">
                <Input placeholder="如 A-01-02（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="currentQty"
                label="入库数量"
                rules={[
                  { required: true, message: '请输入入库数量' },
                  { type: 'number', min: 0.01, message: '入库数量必须大于 0' },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="单位">
                <Select options={HARVEST_UNIT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="safeQty" label="安全库存">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="batchNo"
                label="批次号"
                rules={[{ required: true, message: '请输入或生成批次号' }]}
              >
                <Input
                  placeholder="自动生成或手动输入"
                  addonAfter={
                    <Typography.Link onClick={handleGenerateBatchNo}>
                      <Space size={4}>
                        <SyncOutlined /> 生成
                      </Space>
                    </Typography.Link>
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="expireDate"
                label="保质期至"
                rules={[{ required: true, message: '请选择保质期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="relatedBatchId" label="关联采收记录">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="请选择（可选）"
                  options={harvestOptions}
                  onChange={handleHarvestChange}
                  loading={harvestQuery.isFetching}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="grade" label="质量等级">
                <Select allowClear placeholder="请选择质量等级" options={GRADE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写入库来源、存储要求等" />
          </Form.Item>
        </Form>
      </Card>

      <Alert
        style={{ marginTop: 16, maxWidth: 880 }}
        type="info"
        showIcon
        message="批次号规则：BC + 日期 + 序列（R-HARV-01，全局唯一）；未送检批次默认等级「待检」，不可上架交易（R-HARV-03）"
      />
    </PageContainer>
  )
}
