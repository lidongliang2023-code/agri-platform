import { useMemo, useRef, useState } from 'react'
import {
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { Button, Popconfirm, Space, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  createTaskTemplate,
  deleteTaskTemplate,
  fetchTaskTemplatesPage,
  updateTaskTemplate,
} from '@/api/tasks'
import { listCrops } from '@/api/crops'
import type { TaskTemplate } from '@/types'
import { TASK_TYPE_LABEL_MAP, TASK_TYPE_OPTIONS } from '@/types'

/** 拓展行类型支持服务端扩展字段 */
interface TaskTemplateRow extends TaskTemplate {
  requiredInputs?: string
  sortOrder?: number
  remark?: string
}

/** 模板表单值 */
interface TemplateFormValues {
  templateName: string
  templateCode?: string
  cropName?: string
  taskType: string
  standardHours?: number
  content?: string
  inputItems?: string[]
  status: 0 | 1
  sortOrder?: number
  remark?: string
}

/**
 * 任务模板库（基础数据）
 * 业务职责：维护平台标准化农事任务模板（作业内容、标准工时、投入品清单、适用作物），供多主体农事生产直接引用。
 */
export default function TaskTemplates(): JSX.Element {
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<TaskTemplateRow | null>(null)

  // 联动可选作物主数据
  const cropsQuery = useQuery({
    queryKey: ['admin-crop-options-for-templates'],
    queryFn: async () => {
      try {
        const page = await listCrops({ pageNum: 1, pageSize: 200 })
        return page?.list ?? []
      } catch {
        return []
      }
    },
    staleTime: 60 * 1000,
  })

  const cropOptions = useMemo(() => {
    const list = cropsQuery.data ?? []
    return list.map((c) => ({
      label: `${c.cropName} (${c.cropCategory || '通用'})`,
      value: c.cropName,
    }))
  }, [cropsQuery.data])

  /** 打开新增弹窗 */
  const openCreate = (): void => {
    setEditing(null)
    setModalOpen(true)
  }

  /** 打开编辑弹窗 */
  const openEdit = (record: TaskTemplateRow): void => {
    setEditing(record)
    setModalOpen(true)
  }

  /** 新增 / 更新模板 */
  const handleFinish = async (values: TemplateFormValues): Promise<boolean> => {
    const payload: Record<string, unknown> = {
      templateName: values.templateName?.trim(),
      templateCode: values.templateCode?.trim() || undefined,
      cropName: values.cropName?.trim() || undefined,
      taskType: values.taskType,
      standardHours: values.standardHours,
      content: values.content?.trim(),
      inputItems: values.inputItems ?? [],
      status: values.status,
      sortOrder: values.sortOrder ?? 0,
      remark: values.remark?.trim(),
    }

    try {
      if (editing) {
        await updateTaskTemplate(editing.templateId, payload as Partial<TaskTemplate>)
        message.success('模板已更新')
      } else {
        await createTaskTemplate(payload as Partial<TaskTemplate>)
        message.success('模板已创建并落库')
      }
      setModalOpen(false)
      setEditing(null)
      actionRef.current?.reload()
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败'
      message.error(msg)
      return false
    }
  }

  /** 启用 / 停用 */
  const handleToggleStatus = async (record: TaskTemplateRow): Promise<void> => {
    const nextStatus: 0 | 1 = record.status === 1 ? 0 : 1
    try {
      await updateTaskTemplate(record.templateId, { status: nextStatus })
      message.success(nextStatus === 1 ? '模板已启用' : '模板已停用')
      actionRef.current?.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '状态切换失败'
      message.error(msg)
    }
  }

  /** 删除模板 */
  const handleDelete = async (record: TaskTemplateRow): Promise<void> => {
    try {
      await deleteTaskTemplate(record.templateId)
      message.success('模板已删除')
      actionRef.current?.reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败'
      message.error(msg)
    }
  }

  /** 表格列定义 */
  const columns: ProColumns<TaskTemplateRow>[] = [
    {
      title: '关键字检索',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '输入模板名称或编码' },
    },
    {
      title: '模板编码',
      dataIndex: 'templateCode',
      width: 150,
      copyable: true,
      render: (_, record) => record.templateCode ?? '-',
    },
    {
      title: '模板名称',
      dataIndex: 'templateName',
      width: 180,
      ellipsis: true,
      render: (_, record) => <Typography.Text strong>{record.templateName}</Typography.Text>,
    },
    {
      title: '适用作物',
      dataIndex: 'cropName',
      width: 130,
      render: (_, record) =>
        record.cropName ? <Tag color="blue">{record.cropName}</Tag> : <span style={{ color: '#999' }}>全品类通用</span>,
    },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      width: 110,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        TASK_TYPE_OPTIONS.map((item) => [item.value, { text: item.label }]),
      ),
      render: (_, record) => {
        const typeKey = record.taskType ?? ''
        return <Tag>{(TASK_TYPE_LABEL_MAP[typeKey] ?? typeKey) || '-'}</Tag>
      },
    },
    {
      title: '标准工时(h)',
      dataIndex: 'standardHours',
      width: 110,
      align: 'right',
      hideInSearch: true,
      render: (_, record) => (record.standardHours != null ? `${record.standardHours}h` : '-'),
    },
    {
      title: '作业内容',
      dataIndex: 'content',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.content || '-',
    },
    {
      title: '来源',
      dataIndex: 'isSystem',
      width: 100,
      hideInSearch: true,
      render: (_, record) =>
        Boolean(record.isSystem) ? <Tag color="purple">平台标准</Tag> : <Tag>主体自定义</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      valueType: 'select',
      valueEnum: {
        1: { text: '启用', status: 'Success' },
        0: { text: '停用', status: 'Default' },
      },
      render: (_, record) =>
        record.status === 1 ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
    },
    {
      title: '操作',
      key: 'option',
      width: 160,
      fixed: 'right',
      valueType: 'option',
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(record)}
        >
          编辑
        </Button>,
        record.status === 1 ? (
          <Popconfirm
            key="toggle"
            title="确认停用该模板？"
            description="停用后各农场创建新任务时不可选择该模板；已有引用任务不受影响。"
            onConfirm={() => void handleToggleStatus(record)}
          >
            <Button type="link" size="small" danger icon={<StopOutlined />}>
              停用
            </Button>
          </Popconfirm>
        ) : (
          <Button
            key="toggle"
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => void handleToggleStatus(record)}
          >
            启用
          </Button>
        ),
        <Popconfirm
          key="delete"
          title="确认删除该模板？"
          description="删除后模板将不可恢复，请确认是否继续。"
          okText="确认删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => void handleDelete(record)}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <PageContainer
      title="任务模板库"
      subTitle="平台统一维护标准农事作业规范（SOP），供各农场生产作业时标准化引用"
    >
      <ProTable<TaskTemplateRow>
        actionRef={actionRef}
        rowKey="templateId"
        headerTitle="标准模板台账"
        columns={columns}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        options={{
          density: true,
          fullScreen: true,
          reload: true,
          setting: true,
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建任务模板
          </Button>,
        ]}
        request={async (params) => {
          const res = await fetchTaskTemplatesPage({
            pageNum: params.current ?? 1,
            pageSize: params.pageSize ?? 10,
            keyword: params.keyword,
            taskType: params.taskType,
            status: params.status !== undefined && params.status !== null ? Number(params.status) : undefined,
          })
          return {
            data: (res.list ?? []) as TaskTemplateRow[],
            total: res.total ?? 0,
            success: true,
          }
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true }}
      />

      <ModalForm<TemplateFormValues>
        title={editing ? '编辑任务模板' : '新建任务模板'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? {
                templateName: editing.templateName,
                templateCode: editing.templateCode,
                cropName: editing.cropName,
                taskType: editing.taskType ?? 'OTHER',
                standardHours: editing.standardHours,
                content: editing.content,
                inputItems: editing.inputItems ?? (editing.requiredInputs ? editing.requiredInputs.split(',') : []),
                status: (editing.status ?? 1) as 0 | 1,
                sortOrder: editing.sortOrder ?? 0,
                remark: editing.remark,
              }
            : {
                taskType: 'PLANTING',
                status: 1,
                sortOrder: 0,
              }
        }
        onFinish={handleFinish}
      >
        <ProFormText
          name="templateName"
          label="模板名称"
          placeholder="如：西红柿定植标准作业"
          rules={[{ required: true, message: '请输入模板名称' }]}
        />
        <Space style={{ display: 'flex', width: '100%' }} align="start">
          <ProFormSelect
            name="cropName"
            label="适用作物"
            placeholder="选择或输入适用作物（留空表示全品类通用）"
            options={cropOptions}
            fieldProps={{
              showSearch: true,
              allowClear: true,
            }}
            style={{ minWidth: 260 }}
          />
          <ProFormSelect
            name="taskType"
            label="任务类型"
            options={TASK_TYPE_OPTIONS}
            rules={[{ required: true, message: '请选择任务类型' }]}
            style={{ minWidth: 200 }}
          />
        </Space>
        <ProFormDigit
          name="standardHours"
          label="标准工时（小时）"
          min={0}
          max={1000}
          fieldProps={{ precision: 1 }}
        />
        <ProFormTextArea
          name="content"
          label="标准作业内容"
          placeholder="描述标准作业步骤、质量要求与作业规范..."
          fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
        />
        <ProFormSelect
          name="inputItems"
          label="关联投入品清单"
          mode="tags"
          placeholder="输入所需投入品或物料名称后回车（可添加多项）"
        />
        <ProFormRadio.Group
          name="status"
          label="启用状态"
          rules={[{ required: true, message: '请选择启用状态' }]}
          options={[
            { value: 1, label: '启用（各农场可选择）' },
            { value: 0, label: '停用（隐藏但保留引用）' },
          ]}
        />
        <ProFormDigit name="sortOrder" label="排序权重" min={0} max={9999} />
        <ProFormTextArea name="remark" label="备注说明" fieldProps={{ rows: 2, maxLength: 200 }} />
      </ModalForm>
    </PageContainer>
  )
}
