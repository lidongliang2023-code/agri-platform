/**
 * 页面名称：新建投入品
 * 路由路径：/production/inputs/create
 * 所属模块：农资投入品管理
 * 原型来源：用户端原型 P11 input-create — 新建投入品
 *
 * 还原要点：
 * - 头部「< 返回」+ 新增投入品记录
 * - 「☐ 投入品信息」：名称 / 类型 / 条码 / 登记证号 / 生产厂家 / 规格 / 单位 / 安全间隔期
 * - 「☐ 库存与预警」：初始库存 / 库存预警阈值 / 状态
 * - 「☐ 初始入库批次」：批次号 / 有效期至（初始库存 > 0 时必填，生成一条入库流水）
 * - 「☐ 本次使用登记（可选）」：使用地块 / 用量 / 单位 / 使用日期 / 关联任务 / 施用方式 / 操作人
 * - 实时合规校验：禁用拦截（禁止提交）、限用预警（需确认报备）、用量 / 休药期 / 累计用量提示
 * - 登记证号格式校验（PD / LS / 农肥 / 农种经许 / 兽药 / 饲证）
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProCard } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { listPlots } from '@/api/plots'
import { listMembers } from '@/api/members'
import { fetchTaskPage } from '@/api/tasks'
import { createInputInfo, createUsage, stockIn } from '@/api/inputs'
import type { InputInfo } from '@/api/inputs'
import type { Member, Plot, Task } from '@/types'
import {
  DOSAGE_UNIT_OPTIONS,
  INPUT_CATEGORY_OPTIONS,
  STOCK_UNIT_OPTIONS,
  USAGE_METHOD_OPTIONS,
  categoryMeta,
  checkAdmission,
  checkCompliance,
  checkRegNo,
  summarizeCompliance,
} from './shared'

/** 默认安全间隔期（天）：使用登记时未填写安全间隔期的兜底值 */
const DEFAULT_SAFETY_INTERVAL = 15

/** 新建投入品表单值 */
interface CreateFormValues {
  /** 投入品名称 */
  inputName?: string
  /** 分类编码 */
  inputType?: string
  /** 投入品条码 / 编码 */
  inputCode?: string
  /** 登记证号 */
  registrationNo?: string
  /** 生产厂家 */
  manufacturer?: string
  /** 规格 */
  spec?: string
  /** 计量单位 */
  unit?: string
  /** 安全间隔期（天） */
  safetyInterval?: number
  /** 初始库存 */
  stockQty?: number
  /** 库存预警阈值 */
  warnQty?: number
  /** 状态 1启用 0停用 */
  status?: number
  /** 初始入库批次号 */
  batchNo?: string
  /** 初始入库有效期至 */
  expireDate?: Dayjs
  /** 是否同时登记使用记录 */
  withUsage?: boolean
  /** 使用地块 */
  plotId?: string
  /** 亩用量 */
  dosage?: number
  /** 用量单位 */
  dosageUnit?: string
  /** 使用时间 */
  usedAt?: Dayjs
  /** 关联任务 */
  taskId?: string
  /** 施用方式 */
  method?: string
  /** 操作人 */
  operatorId?: string
}

/**
 * 新建投入品页
 *
 * 业务职责：登记投入品档案（含准入校验与登记证号格式校验），按需生成初始入库流水
 * 与使用记录，提交后跳转投入品详情。
 *
 * @returns 页面内容
 */
export default function Create(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [form] = Form.useForm<CreateFormValues>()
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [confirmed, setConfirmed] = useState<boolean>(false)

  const inputName = Form.useWatch('inputName', form)
  const inputType = Form.useWatch('inputType', form)
  const registrationNo = Form.useWatch('registrationNo', form)
  const safetyInterval = Form.useWatch('safetyInterval', form)
  const stockQty = Form.useWatch('stockQty', form)
  const withUsage = Form.useWatch('withUsage', form)
  const dosage = Form.useWatch('dosage', form)
  const dosageUnit = Form.useWatch('dosageUnit', form)

  /** 地块下拉 */
  const plotsQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 成员下拉（操作人） */
  const membersQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 农事任务下拉（关联任务） */
  const tasksQuery = useQuery({
    queryKey: ['task-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => fetchTaskPage({ farmId, pageNum: 1, pageSize: 200 }),
  })

  const plotOptions = useMemo(
    () =>
      (plotsQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotsQuery.data],
  )

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.list ?? []).map((member: Member) => ({
        value: member.memberId,
        label: member.realName,
      })),
    [membersQuery.data],
  )

  const taskOptions = useMemo(
    () =>
      (tasksQuery.data?.list ?? []).map((task: Task) => ({
        value: task.taskId,
        label: task.taskName ?? task.taskNo ?? task.taskId,
      })),
    [tasksQuery.data],
  )

  /** 准入校验（禁用 / 限用清单） */
  const admission = useMemo(() => checkAdmission(inputName, inputType), [inputName, inputType])

  /** 登记证号格式校验 */
  const regNoResult = useMemo(() => checkRegNo(registrationNo), [registrationNo])

  /** 合规校验四项（实时） */
  const complianceItems = useMemo(
    () =>
      checkCompliance({
        inputName,
        inputType,
        safetyInterval,
        dosage: withUsage ? dosage : undefined,
        unit: withUsage ? dosageUnit : undefined,
        cumulativeDosage: withUsage ? dosage : undefined,
      }),
    [inputName, inputType, safetyInterval, dosage, dosageUnit, withUsage],
  )

  const complianceLevel = summarizeCompliance(complianceItems)

  /** 提交：建档 → 初始入库 → 使用登记 */
  const handleSubmit = async (): Promise<void> => {
    let values: CreateFormValues
    try {
      values = await form.validateFields()
    } catch {
      message.warning('请先完善必填项与格式错误项')
      return
    }

    const regNo = checkRegNo(values.registrationNo)
    if (!regNo.ok) {
      message.error(regNo.message ?? '登记证号格式不正确')
      return
    }
    if (admission.level === 'blocked') {
      message.error('该投入品属国家禁用农资，禁止建档（R-INPUT-02）')
      return
    }
    if (admission.level === 'warning' && !confirmed) {
      message.warning('该投入品属限用农资，请勾选「已确认并报备」后再提交')
      return
    }

    const initialQty = values.stockQty ?? 0
    if (initialQty > 0 && !values.batchNo) {
      message.warning('初始库存大于 0 时，请填写初始入库批次号')
      return
    }

    setSubmitting(true)
    try {
      const payload: Partial<InputInfo> = {
        inputName: values.inputName,
        inputType: values.inputType ?? 'OTHER',
        inputCode: values.inputCode,
        registrationNo: values.registrationNo,
        manufacturer: values.manufacturer,
        spec: values.spec,
        unit: values.unit ?? 'kg',
        safetyInterval: values.safetyInterval,
        stockQty: 0,
        warnQty: values.warnQty,
        status: values.status ?? 1,
      }
      const inputId = await createInputInfo(payload)

      if (initialQty > 0) {
        await stockIn(inputId, {
          qty: initialQty,
          batchNo: values.batchNo,
          expireDate: values.expireDate ? values.expireDate.format('YYYY-MM-DD') : undefined,
          operatorId: values.operatorId,
        })
      }

      if (values.withUsage && values.plotId && values.dosage !== undefined) {
        await createUsage({
          inputId,
          inputName: values.inputName,
          plotId: values.plotId,
          taskId: values.taskId,
          dosage: values.dosage,
          unit: values.dosageUnit ?? 'kg/亩',
          method: values.method,
          operatorId: values.operatorId,
          usedAt: values.usedAt ? values.usedAt.format('YYYY-MM-DDTHH:mm:ss') : undefined,
          safetyIntervalDays: values.safetyInterval ?? DEFAULT_SAFETY_INTERVAL,
          status: 1,
        })
      }

      message.success('投入品已创建')
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
      navigate(`/production/inputs/${inputId}`)
    } finally {
      setSubmitting(false)
    }
  }

  /** 重置 */
  const handleReset = (): void => {
    form.resetFields()
    setConfirmed(false)
  }

  const blocked = admission.level === 'blocked'

  return (
    <PageContainer
      title={
        <Space size={8}>
          <Typography.Link onClick={() => navigate('/production/inputs')}>
            <ArrowLeftOutlined /> 返回
          </Typography.Link>
          <span>新增投入品记录</span>
        </Space>
      }
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button key="cancel" onClick={() => navigate('/production/inputs')}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={submitting}
          disabled={blocked}
          onClick={() => void handleSubmit()}
        >
          保存
        </Button>,
      ]}
    >
      <Form<CreateFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          inputType: 'FERTILIZER',
          unit: 'kg',
          status: 1,
          stockQty: 0,
          withUsage: false,
          dosageUnit: 'kg/亩',
          usedAt: dayjs(),
        }}
      >
        <Row gutter={16}>
          <Col span={16}>
            <ProCard title="☐ 投入品信息" headerBordered style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="投入品名称"
                    name="inputName"
                    rules={[{ required: true, message: '请输入或扫码自动填充投入品名称' }]}
                  >
                    <Input placeholder="请输入或扫码自动填充" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="投入品类型"
                    name="inputType"
                    rules={[{ required: true, message: '请选择投入品类型' }]}
                  >
                    <Select options={INPUT_CATEGORY_OPTIONS} placeholder="请选择类型" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="投入品条码" name="inputCode">
                    <Input placeholder="扫码或手动输入" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="登记证号"
                    name="registrationNo"
                    extra={
                      regNoResult.ok ? `格式匹配：${regNoResult.matched ?? '通用格式'}` : undefined
                    }
                    rules={[
                      { required: true, message: '请输入登记证号（R-INPUT-01）' },
                      {
                        validator: (_rule, value) =>
                          checkRegNo(String(value ?? '')).ok
                            ? Promise.resolve()
                            : Promise.reject(new Error('登记证号格式不正确')),
                      },
                    ]}
                  >
                    <Input placeholder="如 PD20180001 或 农肥(2018)准字1234号" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="生产厂家"
                    name="manufacturer"
                    rules={[{ required: true, message: '请输入生产厂家' }]}
                  >
                    <Input placeholder="请输入生产厂家" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="规格" name="spec">
                    <Input placeholder="如 50kg/袋、200mL/瓶（可含有效成分）" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="计量单位"
                    name="unit"
                    rules={[{ required: true, message: '请选择计量单位' }]}
                  >
                    <Select options={STOCK_UNIT_OPTIONS} placeholder="请选择单位" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="安全间隔期（天）"
                    name="safetyInterval"
                    tooltip="农药类必填；用于采收前的休药期校验（R-INPUT-03）"
                    rules={[
                      {
                        validator: (_rule, value) => {
                          const type = form.getFieldValue('inputType')
                          if (type === 'PESTICIDE' && (value === undefined || value === null)) {
                            return Promise.reject(new Error('农药类投入品必须填写安全间隔期'))
                          }
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <InputNumber min={0} max={365} style={{ width: '100%' }} placeholder="如 15" />
                  </Form.Item>
                </Col>
              </Row>
            </ProCard>

            <ProCard title="☐ 库存与初始入库批次" headerBordered style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="初始库存"
                    name="stockQty"
                    rules={[{ required: true, message: '请输入初始库存' }]}
                  >
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="库存预警阈值"
                    name="warnQty"
                    tooltip="库存不高于阈值时自动生成补货提醒（R-INPUT-05）"
                  >
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="状态" name="status">
                    <Select
                      options={[
                        { value: 1, label: '启用' },
                        { value: 0, label: '停用' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="批次号"
                    name="batchNo"
                    tooltip="初始库存大于 0 时必填，用于批次追溯（PRD 11.2.4 入库必填）"
                  >
                    <Input placeholder="如 BN20260501" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="有效期至"
                    name="expireDate"
                    tooltip="效期前 90/30/7 天三级提醒，过期锁定不可领用（R-INPUT-06）"
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </ProCard>

            <ProCard
              title="☐ 本次使用登记（可选）"
              headerBordered
              extra={
                <Space>
                  <Typography.Text type="secondary">登记</Typography.Text>
                  <Form.Item name="withUsage" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </Space>
              }
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="使用地块" name="plotId">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="请选择使用地块"
                      options={plotOptions}
                      disabled={!withUsage}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="关联农事任务" name="taskId">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="请选择关联任务（可选）"
                      options={taskOptions}
                      disabled={!withUsage}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="用量" name="dosage">
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="亩用量"
                      disabled={!withUsage}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="单位" name="dosageUnit">
                    <Select options={DOSAGE_UNIT_OPTIONS} disabled={!withUsage} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="施用方式" name="method">
                    <Select
                      allowClear
                      options={USAGE_METHOD_OPTIONS}
                      placeholder="请选择"
                      disabled={!withUsage}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="操作人" name="operatorId">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="请选择操作人"
                      options={memberOptions}
                      disabled={!withUsage}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="使用日期" name="usedAt">
                    <DatePicker showTime style={{ width: '100%' }} disabled={!withUsage} />
                  </Form.Item>
                </Col>
              </Row>
            </ProCard>

            <Space style={{ marginTop: 16 }}>
              <Button onClick={handleReset}>取消</Button>
              <Button
                type="primary"
                loading={submitting}
                disabled={blocked}
                onClick={() => void handleSubmit()}
              >
                保存
              </Button>
            </Space>
          </Col>

          <Col span={8}>
            <ProCard title="✅ 合规校验" headerBordered style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type={
                    admission.level === 'blocked'
                      ? 'error'
                      : admission.level === 'warning'
                        ? 'warning'
                        : 'success'
                  }
                  showIcon
                  message={
                    <Space>
                      <span>
                        {admission.icon} 准入校验：{admission.label}
                      </span>
                      <Tag color={categoryMeta(inputType).color}>
                        {categoryMeta(inputType).label}
                      </Tag>
                    </Space>
                  }
                  description={admission.detail}
                />
                {admission.level === 'warning' && (
                  <Checkbox
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  >
                    我已确认该限用农资的使用必要性，并同意报平台备案
                  </Checkbox>
                )}
                {complianceItems.map((item) => (
                  <Alert
                    key={item.key}
                    type={
                      item.level === 'blocked'
                        ? 'error'
                        : item.level === 'warning'
                          ? 'warning'
                          : 'success'
                    }
                    showIcon
                    message={`${item.label}：${item.result}`}
                    description={item.detail}
                  />
                ))}
                <Typography.Text type="secondary">
                  整体结论：
                  <Tag
                    color={
                      complianceLevel === 'pass'
                        ? 'green'
                        : complianceLevel === 'warning'
                          ? 'orange'
                          : 'red'
                    }
                  >
                    {complianceLevel === 'pass'
                      ? '✅ 通过'
                      : complianceLevel === 'warning'
                        ? '⚠️ 预警'
                        : '❌ 拦截'}
                  </Tag>
                </Typography.Text>
                <Typography.Text type="secondary">
                  初始库存：{stockQty ?? 0}；初始库存大于 0 时将同步生成一条入库流水。
                </Typography.Text>
              </Space>
            </ProCard>

            <ProCard title="ℹ️ 填写说明" headerBordered>
              <Space direction="vertical" size={8}>
                <Typography.Text type="secondary">
                  · 登记证号须与实物包装一致，系统按农药 PD/LS、肥料「农肥」、种子「农种经许」、
                  兽药 / 饲料等格式校验（R-INPUT-01）。
                </Typography.Text>
                <Typography.Text type="secondary">
                  · 国家禁用清单内的投入品建档即拦截；限用清单需确认并报备（R-INPUT-02）。
                </Typography.Text>
                <Typography.Text type="secondary">
                  · 农药类必须填写安全间隔期，用于采收登记的休药期校验（R-INPUT-03）。
                </Typography.Text>
                <Typography.Text type="secondary">
                  · 勾选「本次使用登记」可在建档同时生成一条使用记录，并关联地块与农事任务。
                </Typography.Text>
              </Space>
            </ProCard>
          </Col>
        </Row>
      </Form>
    </PageContainer>
  )
}
