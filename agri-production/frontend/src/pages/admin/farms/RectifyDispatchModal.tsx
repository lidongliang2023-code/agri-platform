/**
 * 下发整改弹窗（农场监管模块内部复用组件）
 *
 * 被「农场监管列表」「农场监管详情」两个页面共用：选择高/中风险农场后录入检查类型、
 * 整改要求与整改期限并提交。
 *
 * ⚠️ 写失败口径与 ComplianceCheck 页保持一致（不能骗人）：
 * - 成功 → success；
 * - 后端明确拒绝（业务码非 0，典型是 404 农场档案不存在）→ 错误提示，且不写本地；
 * - 后端不可达 → 离线兜底，但弹 warning 而非 success，并说明仅本浏览器可见。
 *
 * 旧实现把两种情况一律吞成 null 再弹"接口暂未开放，已本地登记"的成功提示，
 * 在写接口已上线且会校验 farmId 之后，这句话在农场不存在时是假的。
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
  upsertRemoteComplianceCheck,
} from './supervisionShared'
import type { ComplianceTaskItem } from './supervisionShared'

/**
 * 下发结果（三分支口径同 ComplianceCheck 页）。
 *
 * `source` 为 'local' 表示确实存下来了但只在本浏览器；'failed' 表示什么都没存。
 */
interface DispatchOutcome {
  /** 数据最终去向 */
  source: 'remote' | 'local' | 'failed'
  /** 需要告知用户的原因（local / failed 时必有值） */
  reason?: string
  /** 任务主体，failed 时为空 */
  task: ComplianceTaskItem | null
}

/** 下发目标摘要 */
export interface RectifyTargetSummary {
  /** 农场 ID */
  farmId: BizId
  /** 农场编号 */
  farmCode: string
  /** 农场名称 */
  farmName: string
  /** 所属主体（可缺省） */
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
  const { message, modal } = App.useApp()
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
    }): Promise<DispatchOutcome> => {
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
      const result = await createSupervisedComplianceTask({
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
      if (result.ok && result.remote) {
        // 已落库：以服务端返回为准，本地不留副本（否则本机那份会冒充服务端数据）
        upsertRemoteComplianceCheck(result.remote)
        return { source: 'remote', task }
      }
      if (result.kind === 'unreachable') {
        const localTask: ComplianceTaskItem = { ...task, source: 'local' }
        addComplianceTask(localTask)
        return {
          source: 'local',
          task: localTask,
          reason:
            `${result.message}。已临时登记到本地：仅本浏览器可见，其他账号看不到，` +
            '接口恢复后不会自动同步到服务端。',
        }
      }
      // 后端明确拒绝（典型：404 该农场档案不存在）：不写本地
      return {
        source: 'failed',
        task: null,
        reason:
          result.code === 404
            ? '该农场编号在档案库中不存在（后端返回 404，请求已被拒绝）。' +
              '整改任务必须绑定到真实存在的农场档案：请先完成建档再下发。本次未写入任何数据。'
            : `后端拒绝了本次下发（业务码 ${result.code ?? '未知'}）` +
              `${result.message ? `：${result.message}` : ''}。本次未写入任何数据。`,
      }
    },
    onSuccess: (outcome) => {
      if (outcome.source === 'remote' && outcome.task) {
        message.success(
          `已向「${outcome.task.farmName}」下发整改，整改期限 ${outcome.task.rectifyDeadline}`,
        )
        form.resetFields()
        setInitialized(false)
        onClose()
        onSuccess?.(outcome.task)
        return
      }
      if (outcome.source === 'local' && outcome.task) {
        message.warning(
          `已登记整改任务到本地，但未写入服务端：${outcome.reason ?? ''}（整改期限 ${outcome.task.rectifyDeadline}）`,
          6,
        )
        form.resetFields()
        setInitialized(false)
        onClose()
        onSuccess?.(outcome.task)
        return
      }
      // 被拒绝：不关闭弹窗，保留已填内容便于改选目标重试
      modal.error({
        title: '下发整改失败',
        content: outcome.reason ?? '后端拒绝了本次提交，未写入任何数据。',
      })
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
            <Col span={12}>所属主体：{target.tenantName || '—'}</Col>
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
