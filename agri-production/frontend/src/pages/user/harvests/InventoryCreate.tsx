import Card from '@/components/SectionCard'
import './harvests.css'
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
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageContainer from '@/components/ProductionPageContainer'
import { Alert, Button, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import useAuthStore from '@/store/auth'
import { loadInventoryPages } from './inventoryHelpers'
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
 * 新增库存页面
 *
 * 业务职责：登记一条成品库存（入库），可关联已有采收批次。
 *
 * @returns 页面内容
 */
export default function InventoryCreate(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const [form] = Form.useForm<InventoryFormValues>()

  useEffect(() => { form.resetFields() }, [farmId, subjectId, form])

  /** 采收批次下拉（关联采收记录） */
  const harvestQuery = useQuery({
    queryKey: ['production-harvests', 'inventory-options', subjectId, farmId],
    enabled: Boolean(farmId),
    queryFn: () => loadInventoryPages((pageNum) => queryHarvests({ farmId, pageNum, pageSize: 200 })),
  })

  /** 关联采收记录下拉选项 */
  const harvestOptions = useMemo(
    () =>
      (harvestQuery.data ?? []).map((batch: HarvestBatch) => ({
        value: batch.batchId,
        label: `${batch.batchNo} - ${batch.cropName ?? ''} ${batch.quantity}${batch.unit}`,
      })),
    [harvestQuery.data],
  )

  /** 提交新增库存 */
  const submitMutation = useMutation({
    mutationFn: (payload: Parameters<typeof submitInventory>[0]) => submitInventory(payload),
    onSuccess: (record) => {
      message.success(`库存 ${record.inventoryId} 已登记`)
      void queryClient.invalidateQueries({ queryKey: ['production-inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['production-harvests'] })
      navigate('/production/harvests/inventory')
    },
    onError: (error) => {
      message.error(error.message || '保存失败，请稍后重试', 6)
    },
  })

  /** 选择关联采收记录时自动带出品名与数量 */
  const handleHarvestChange = (value: string): void => {
    const batch = (harvestQuery.data ?? []).find(
      (item: HarvestBatch) => String(item.batchId) === String(value),
    )
    if (batch) {
      form.setFieldsValue({
        batchNo: batch.batchNo,
        productName: `${batch.cropName ?? ''}(${batch.grade ?? '未分级'}级)`,
        category: batch.cropName,
        currentQty: undefined,
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
        const batch = (harvestQuery.data ?? []).find(
          (item: HarvestBatch) => String(item.batchId) === String(values.relatedBatchId),
        )
        if (!batch || farmId !== useFarmStore.getState().currentFarm?.farmId || subjectId !== useAuthStore.getState().userInfo?.tenantId) { message.warning('农场或经营主体已变化，请重新选择批次'); return }
        submitMutation.mutate({
          batchId: values.relatedBatchId ?? '',
          batchNo: batch?.batchNo,
          warehouseName: values.warehouseName,
          currentQty: values.currentQty ?? 0,
          unit: values.unit ?? 'kg',
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
      className="harvest-business-page"
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
          disabled={!farmId || harvestQuery.isError || harvestQuery.isFetching}
          onClick={handleSave}
        >
          保存
        </Button>,
      ]}
    >
      {!farmId && <Alert showIcon type="warning" message="请先选择农场" style={{ marginBottom: 16 }} />}
      {harvestQuery.isError && <Alert showIcon type="error" message="采收批次加载失败" action={<Button onClick={() => void harvestQuery.refetch()}>重试</Button>} style={{ marginBottom: 16 }} />}
      <Card title="采收入库登记">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ warehouseName: '主仓库' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {/*
                「关联采收记录」实际是必填：库存行必须挂在某个采收批次上
                （agri_prod_inventory.batch_id NOT NULL，后端也会回「请选择关联批次」）。
                之前这里没写 rules、placeholder 还写着「可选」，用户填完其它项点保存
                才会被后端挡回来 —— 一次没必要的往返。改成前端就拦住。
              */}
              <Form.Item
                name="relatedBatchId"
                label="关联采收记录"
                rules={[{ required: true, message: '请选择关联采收记录' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="请选择采收批次"
                  options={harvestOptions}
                  onChange={handleHarvestChange}
                  loading={harvestQuery.isFetching}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="grade" label="质量等级">
                <Select disabled placeholder="采收批次质量等级" options={GRADE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="productName"
                label="品名"
                rules={[{ required: true, message: '请输入品名' }]}
              >
                <Input readOnly placeholder="选择采收批次后自动带出" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="品类">
                <Input readOnly placeholder="选择采收批次后自动带出" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="warehouseName"
                label="仓库"
                rules={[{ required: true, message: '请选择仓库' }]}
              >
                <Select options={WAREHOUSE_OPTIONS} placeholder="请选择仓库" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="locationCode" label="库位编号">
                <Input placeholder="如 A-01-02（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item
                name="currentQty"
                label="入库数量"
                rules={[
                  { required: true, message: '请输入入库数量' },
                  { type: 'number', min: 0.01, message: '入库数量必须大于 0' },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="unit" label="单位">
                <Select disabled options={HARVEST_UNIT_OPTIONS} placeholder="选择采收后自动带出" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="safeQty" label="安全库存">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="batchNo"
                label="批次号"
                rules={[{ required: true, message: '请先选择关联采收记录' }]}
              >
                <Input readOnly placeholder="选择关联采收后自动带出" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="expireDate"
                label="保质期至"
                rules={[{ required: true, message: '请选择保质期' }]}
              >
                <DatePicker style={{ width: '100%' }} disabledDate={(date) => date.startOf('day').valueOf() < new Date().setHours(0, 0, 0, 0)} />
              </Form.Item>
            </Col>
          </Row>



          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写入库来源、存储要求等" />
          </Form.Item>
        </Form>
      </Card>


    </PageContainer>
  )
}
