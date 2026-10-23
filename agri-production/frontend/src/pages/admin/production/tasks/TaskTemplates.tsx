/**
 * 页面名称：任务模板库
 * 路由路径：/admin/production/tasks/templates
 * 所属模块：基础数据
 * PRD 序号：PRD 6.1 #17（TASK-03 任务模板库）
 *
 * 2026-10-16 从**用户端**搬到运营端（产品口径）：模板是"标准作业配置"，
 * 由平台运营维护、主体使用 —— 用户端只在「新建任务」的模板下拉里用，没有维护入口。
 * 接口不变（仍在生产域 /api/v1/production/tasks/templates），页面只是换了个端的壳。
 *
 * 原型无此页，按 PRD 设计：
 * - ProTable 维护 SOP 模板：模板名称 / 适用作物 / 任务类型 / 标准工时 / 作业内容 /
 *   投入品清单 / 来源 / 状态
 * - 支持新增、编辑、启用 / 停用、删除与关键字检索
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer, ModalForm, ProFormDigit, ProFormRadio, ProFormSelect, ProFormText, ProFormTextArea, ProTable } from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { Button, Popconfirm, Space, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import {
  createTaskTemplate,
  deleteTaskTemplate,
  fetchTaskTemplatesPage,
  updateTaskTemplate,
} from '@/api/tasks'
import type { TaskTemplate } from '@/types'
import { TASK_TYPE_LABEL_MAP, TASK_TYPE_OPTIONS } from '@/types'

/** 模板表单值 */
interface TemplateFormValues {
  /** 模板名称 */
  templateName?: string
  /** 模板编码 */
  templateCode?: string
  /** 适用作物 */
  cropName?: string
  /** 任务类型 */
  taskType?: string
  /** 标准工时（小时） */
  standardHours?: number
  /** 标准作业内容 */
  content?: string
  /** 关联投入品清单 */
  inputItems?: string[]
  /** 启用状态：1 启用 0 停用 */
  status?: 0 | 1
}

/**
 * 任务模板库页
 *
 * 业务职责：维护标准农事任务模板（作业内容、标准工时、投入品清单），并支持启停用。
 *
 * @returns 页面内容
 */
export default function TaskTemplates(): JSX.Element {
  const navigate = useNavigate()
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)

  /** 打开新增弹窗 */
  const openCreate = (): void => {
    setEditing(null)
    setModalOpen(true)
  }

  /** 打开编辑弹窗 */
  const openEdit = (record: TaskTemplate): void => {
    setEditing(record)
    setModalOpen(true)
  }

  /** 新增 / 更新模板 */
  const handleFinish = async (values: TemplateFormValues): Promise<boolean> => {
    const payload: Partial<TaskTemplate> = {
      ...values,
      // 同步后端字段命名（work_hours / work_content / input_ids）
      workHours: values.standardHours,
      workContent: values.content,
      inputIds: values.inputItems?.join(','),
    }
    if (editing) {
      await updateTaskTemplate(editing.templateId, payload)
      message.success('模板已更新')
    } else {
      await createTaskTemplate(payload)
      message.success('模板已创建')
    }
    setModalOpen(false)
    setEditing(null)
    actionRef.current?.reload()
    return true
  }

  /** 启用 / 停用 */
  const handleToggleStatus = async (record: TaskTemplate): Promise<void> => {
    const nextStatus: 0 | 1 = record.status === 1 ? 0 : 1
    await updateTaskTemplate(record.templateId, { status: nextStatus })
    message.success(nextStatus === 1 ? '模板已启用' : '模板已停用')
    actionRef.current?.reload()
  }

  /** 删除模板 */
  const handleDelete = async (record: TaskTemplate): Promise<void> => {
    await deleteTaskTemplate(record.templateId)
    message.success('模板已删除')
    actionRef.current?.reload()
  }

  /** 表格列定义 */
  const columns: ProColumns<TaskTemplate>[] = [
    {
      title: '模板名称',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '模板名称 / 编码' },
    },
    { title: '模板编码', dataIndex: 'templateCode', width: 140, render: (_, record) => record.templateCode ?? '-' },
    { title: '模板名称', dataIndex: 'templateName', ellipsis: true },
    {
      title: '适用作物',
      dataIndex: 'cropName',
      width: 120,
      render: (_, record) => record.cropName ?? '-',
    },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      width: 120,
      render: (_, record) => (
        <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[record.taskType] ?? record.taskType}</Tag>
      ),
    },
    {
      title: '标准工时',
      dataIndex: 'standardHours',
      width: 100,
      render: (_, record) => `${record.standardHours ?? record.workHours ?? '-'} 小时`,
    },
    {
      title: '标准作业内容',
      dataIndex: 'content',
      ellipsis: true,
      render: (_, record) => record.content ?? record.workContent ?? '-',
    },
    {
      title: '投入品清单',
      dataIndex: 'inputItems',
      width: 180,
      render: (_, record) => {
        const items = record.inputItems ?? record.inputIds?.split(',').filter(Boolean) ?? []
        if (items.length === 0) return '-'
        return (
          <Space size={[4, 4]} wrap>
            {items.map((item) => (
              <Tag key={item} color="green">
                {item}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: '来源',
      dataIndex: 'isSystem',
      width: 100,
      render: (_, record) =>
        record.isSystem ? <Tag color="purple">系统内置</Tag> : <Tag>主体自建</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) =>
        record.status === 1 ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
    },
    {
      title: '操作',
      key: 'option',
      width: 180,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link key="edit" onClick={() => openEdit(record)}>
          编辑
        </Typography.Link>,
        <Typography.Link key="toggle" onClick={() => void handleToggleStatus(record)}>
          {record.status === 1 ? '停用' : '启用'}
        </Typography.Link>,
        <Popconfirm
          key="delete"
          title="确认删除该模板？"
          okText="确认删除"
          cancelText="取消"
          onConfirm={() => void handleDelete(record)}
        >
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <PageContainer
      title="任务模板库"
      subTitle="SOP 标准作业模板"
      extra={[
        <Button key="back" onClick={() => navigate('/production/tasks')}>
          返回任务列表
        </Button>,
      ]}
    >
      <ProTable<TaskTemplate>
        actionRef={actionRef}
        rowKey="templateId"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        request={async (params) => {
          const result = await fetchTaskTemplatesPage({
            keyword: params.keyword as string | undefined,
            status: statusFilter,
            pageNum: params.current ?? 1,
            pageSize: params.pageSize ?? 10,
          })
          return { data: result.list, success: true, total: result.total }
        }}
        toolbar={{
          actions: [
            <Button key="all" type={statusFilter === undefined ? 'primary' : 'default'} onClick={() => { setStatusFilter(undefined); actionRef.current?.reload() }}>
              全部
            </Button>,
            <Button key="on" type={statusFilter === 1 ? 'primary' : 'default'} onClick={() => { setStatusFilter(1); actionRef.current?.reload() }}>
              已启用
            </Button>,
            <Button key="off" type={statusFilter === 0 ? 'primary' : 'default'} onClick={() => { setStatusFilter(0); actionRef.current?.reload() }}>
              已停用
            </Button>,
          ],
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增模板
          </Button>,
        ]}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <ModalForm<TemplateFormValues>
        title={editing ? '编辑任务模板' : '新增任务模板'}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setEditing(null)
        }}
        width={640}
        layout="vertical"
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? {
                templateName: editing.templateName,
                templateCode: editing.templateCode,
                cropName: editing.cropName,
                taskType: editing.taskType,
                standardHours: editing.standardHours ?? editing.workHours,
                content: editing.content ?? editing.workContent,
                inputItems: editing.inputItems ?? editing.inputIds?.split(',').filter(Boolean),
                status: editing.status,
              }
            : { status: 1, taskType: 'fertilizing', standardHours: 2 }
        }
        onFinish={handleFinish}
      >
        <ProFormText
          name="templateName"
          label="模板名称"
          placeholder="请输入模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        />
        <ProFormText name="templateCode" label="模板编码" placeholder="留空由系统自动生成" />
        <ProFormText name="cropName" label="适用作物" placeholder="如：番茄" />
        <ProFormSelect
          name="taskType"
          label="任务类型"
          options={TASK_TYPE_OPTIONS}
          rules={[{ required: true, message: '请选择任务类型' }]}
        />
        <ProFormDigit
          name="standardHours"
          label="标准工时（小时）"
          min={0}
          fieldProps={{ precision: 1 }}
        />
        <ProFormTextArea
          name="content"
          label="标准作业内容"
          placeholder="描述作业步骤、用量标准与注意事项"
          fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
        />
        <ProFormSelect
          name="inputItems"
          label="关联投入品清单"
          mode="tags"
          placeholder="输入投入品名称后回车，可添加多项"
        />
        <ProFormRadio.Group
          name="status"
          label="启用状态"
          rules={[{ required: true, message: '请选择启用状态' }]}
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '停用' },
          ]}
        />
      </ModalForm>
    </PageContainer>
  )
}
