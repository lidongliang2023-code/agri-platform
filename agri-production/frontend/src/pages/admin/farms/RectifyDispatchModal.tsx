/**
 * 下发整改弹窗（农场监管模块内部复用组件）
 *
 * 被「农场监管列表」「农场监管详情」两个页面共用：选择高/中风险农场后录入检查类型、
 * 整改要求与整改期限并提交。提交采用「后端优先，失败降级本地登记」策略，
 * 保证后端 `/admin/farms/compliance` 写接口尚未开放时业务闭环不被打断。
 */
import { useEffect, useState } from 'react'
import { App, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Tag } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { createSupervisedComplianceTask } from '@/api/admin/farms'
import type { BizId } from '@/types'
import {
  CHECK_TYPE_OPTIONS,
  RISK_BAND_META,
  addComplianceTask,
  generateCheckId,
  resolveRiskLevel,
  todayText,
} from './supervisionShared'
import type { ComplianceTaskItem } from './supervisionShared'

/** 下发目标摘要 */
export interface RectifyTargetSummary {
  /** 农场 ID */
  farmId: BizId
  /** 农场编号 */
  farmCode: string
  /** 农场名称 */
  farmName: string
  /** 所属租户（可缺省） */
  tenantName?: string
  /** 风险评分 */
  riskScore: number
}

/** 组件属性 */
export interface RectifyDispatchModalProps {
  /** 是否展示 */
  open: boolean
  /** 下发目标，为空时不渲染内容 */
  target: RectifyTargetSummary | null
  /** 关闭回调 */
  onClose: () => void
  /** 下发成功回调 */
  onSuccess?: (task: ComplianceTaskItem) => void
}

/** 表单值 */
interface RectifyFormValues {
  /** 检查类型 */
  checkType: string
  /** 整改要求 */
  rectifyRequirement: string
  /** 整改期限 */
  rectifyDeadline: Dayjs
  /** 检查人 */
  checkerName: string
}

/**
 * 下发整改弹窗
 *
 * @param props 组件属性
 * @returns 弹窗组件
 */
export default function RectifyDispatchModal(props: RectifyDispatchModalProps): JSX.Element {
  const { open, target, onClose, onSuccess } = props
  const { message } = App.useApp()
  const [form] = Form.useForm<RectifyFormValues>()
  /** 是否已初始化默认值，避免每次打开覆盖用户输入 */
  const [initialized, setInitialized] = useState<boolean>(false)

  useEffect(() => {
    if (open && !initialized) {
      form.setFieldsValue({ checkType: '常规检查', checkerName: '监管员' })
      setInitialized(true)
    }
    if (!open) {
      setInitialized(false)
    }
  }, [open, initialized, form])

  /** 提交下发 */
  const dispatchMutation = useMutation({
    mutationFn: async (payload: {
      target: RectifyTargetSummary
      values: RectifyFormValues
    }): Promise<ComplianceTaskItem> => {
      const level = resolveRiskLevel(payload.target.riskScore)
      const task: ComplianceTaskItem = {
        checkId: generateCheckId(),
        farmId: payload.target.farmId,
        farmName: payload.target.farmName,
        checkType: payload.values.checkType,
        checkItem: `运营下发整改-${payload.target.farmName}`,
        result: 2,
        problem: `风险评分 ${payload.target.riskScore}（${RISK_BAND_META[level].label}）`,
        rectifyRequirement: payload.values.rectifyRequirement,
        rectifyDeadline: payload.values.rectifyDeadline.format('YYYY-MM-DD'),
        checkerName: payload.values.checkerName,
        checkedAt: `${todayText()} ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
        rectifyStatus: 'pending',
        source: 'remote',
      }
      // 后端端点可用时写入服务端，否则降级为本地登记
      const remote = await createSupervisedComplianceTask({
        checkId: task.checkId,
        farmId: task.farmId,
        farmName: task.farmName,
        checkType: task.checkType,
        checkItem: task.checkItem,
        result: task.result,
        rectifyStatus: task.rectifyStatus,
        problem: task.problem,
        rectifyRequirement: task.rectifyRequirement,
        rectifyDeadline: task.rectifyDeadline,
        checkerName: task.checkerName,
        checkedAt: task.checkedAt,
      })
      if (!remote) {
        const localTask: ComplianceTaskItem = { ...task, source: 'local' }
        addComplianceTask(localTask)
        return localTask
      }
      addComplianceTask(task)
      return task
    },
    onSuccess: (task) => {
      message.success(
        task.source === 'remote'
          ? `已向「${task.farmName}」下发整改，整改期限 ${task.rectifyDeadline}`
          : `已登记整改任务（后端检查任务接口暂未开放，已本地登记），整改期限 ${task.rectifyDeadline}`,
      )
      form.resetFields()
      setInitialized(false)
      onClose()
      onSuccess?.(task)
    },
    onError: () => {
      message.error('下发整改失败，请稍后重试')
    },
  })

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ExclamationCircleOutlined />
          下发整改
        </Space>
      }
      okText="确认下发"
      cancelText="取消"
      confirmLoading={dispatchMutation.isPending}
      destroyOnClose
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      onOk={() => {
        void form.validateFields().then((values) => {
          if (!target) {
            return
          }
          dispatchMutation.mutate({ target, values })
        })
      }}
    >
      {target && (
        <div>
          <Row gutter={[0, 6]} style={{ marginBottom: 12 }}>
            <Col span={12}>农场编号：{target.farmCode}</Col>
            <Col span={12}>农场名称：{target.farmName}</Col>
            <Col span={12}>所属租户：{target.tenantName || '—'}</Col>
            <Col span={12}>
              风险评分：
              <Tag color={RISK_BAND_META[resolveRiskLevel(target.riskScore)].tagColor}>
                {target.riskScore} /100
              </Tag>
            </Col>
          </Row>
          <Form<RectifyFormValues>
            form={form}
            layout="vertical"
            preserve={false}
            initialValues={{ checkType: '常规检查', checkerName: '监管员' }}
          >
            <Form.Item
              label="检查类型"
              name="checkType"
              rules={[{ required: true, message: '请选择检查类型' }]}
            >
              <Select options={CHECK_TYPE_OPTIONS.map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item
              label="整改要求"
              name="rectifyRequirement"
              rules={[
                { required: true, message: '请填写整改要求' },
                { min: 5, message: '整改要求不少于 5 个字' },
              ]}
            >
              <Input.TextArea rows={3} maxLength={200} showCount placeholder="请描述需要整改的事项" />
            </Form.Item>
            <Form.Item
              label="整改期限"
              name="rectifyDeadline"
              rules={[{ required: true, message: '请选择整改期限' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>
            <Form.Item
              label="检查人"
              name="checkerName"
              rules={[{ required: true, message: '请填写检查人' }]}
            >
              <Input placeholder="请输入检查人姓名" maxLength={20} />
            </Form.Item>
          </Form>
        </div>
      )}
    </Modal>
  )
}
