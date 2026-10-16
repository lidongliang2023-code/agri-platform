/**
 * 页面名称：作物管理
 * 路由路径：/production/crops
 * 所属模块：农场数字化管理
 * 原型补充（PRD 未列）：把「作物」从自由文本升级成租户级主数据后的维护入口。
 *
 * 页面用途：作物主数据的查询 / 新增 / 编辑 / 启停 / 删除。种养计划与地块的作物列都从这里取。
 * 表格使用 ProTable + request 分页；新增 / 编辑使用 ModalForm；停用与删除需二次确认。
 */
import { useMemo, useRef, useState } from 'react'
import { App as AntdApp, Button, Popconfirm, Space, Tag, Typography } from 'antd'
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import {
  createCrop,
  deleteCrop,
  listCropCategories,
  listCrops,
  updateCrop,
  updateCropStatus,
} from '@/api/crops'
import type { Crop } from '@/api/crops'

/** 新增 / 编辑作物表单值 */
interface CropFormValue {
  cropCode?: string
  cropName: string
  cropCategory?: string
  growthCycleDays?: number
  measurementUnit?: string
  status: number
  sortNo?: number
  remark?: string
}

/**
 * 作物管理
 * @returns 页面内容
 */
export default function CropList(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const actionRef = useRef<ActionType>(null)
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<Crop | null>(null)

  /**
   * 作物类别选项：取自后端字典（`GET /crops/categories`）。

   * <p>不再在页面里抄一份清单 —— 后端会校验取值，抄两份迟早不一致（那边的列表带「其他」兜底项）。</p>
   */
  const categoryQuery = useQuery({
    queryKey: ['crop-categories'],
    queryFn: () => listCropCategories(),
    staleTime: 5 * 60 * 1000,
  })
  const categoryOptions = useMemo(
    () => (categoryQuery.data ?? []).map((item) => ({ value: item, label: item })),
    [categoryQuery.data],
  )

  /** 重载列表（同时让计划页的作物下拉失效，避免两边口径不一致） */
  async function reload(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['crop-options'] })
    actionRef.current?.reload()
  }

  const createMutation = useMutation({
    mutationFn: (payload: CropFormValue) => createCrop(payload),
    onSuccess: () => {
      message.success('作物已新增')
      setCreateOpen(false)
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '新增失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { cropId: string; value: CropFormValue }) =>
      updateCrop(payload.cropId, payload.value),
    onSuccess: () => {
      message.success('作物已保存')
      setEditing(null)
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '保存失败'),
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { cropId: string; status: number }) =>
      updateCropStatus(payload.cropId, payload.status),
    onSuccess: (_data, variables) => {
      message.success(variables.status === 1 ? '作物已启用' : '作物已停用')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '操作失败'),
  })

  const removeMutation = useMutation({
    mutationFn: (cropId: string) => deleteCrop(cropId),
    onSuccess: () => {
      message.success('作物已删除')
      void reload()
    },
    // 已被种养计划引用的作物，后端会明确回"不能删除"，把原因原样透给用户
    onError: (error: Error) => message.error(error.message || '删除失败'),
  })

  /** 表格列定义 */
  const columns = useMemo<ProColumns<Crop>[]>(
    () => [
      { title: '作物编码', dataIndex: 'cropCode', width: 130, copyable: true, render: (_d, r) => r.cropCode || '-' },
      {
        title: '作物名称',
        dataIndex: 'cropName',
        width: 160,
        render: (_d, r) => (
          <Space size={6}>
            <Typography.Text strong>{r.cropName}</Typography.Text>
          </Space>
        ),
      },
      { title: '类别', dataIndex: 'cropCategory', width: 120, render: (_d, r) => r.cropCategory || '-' },
      {
        title: '生长周期(天)',
        dataIndex: 'growthCycleDays',
        width: 120,
        hideInSearch: true,
        align: 'right',
        render: (_d, r) => (r.growthCycleDays ? r.growthCycleDays : '-'),
      },
      { title: '计量单位', dataIndex: 'measurementUnit', width: 100, hideInSearch: true, render: (_d, r) => r.measurementUnit || '-' },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        valueEnum: { 1: { text: '启用', status: 'Success' }, 0: { text: '停用', status: 'Default' } },
        render: (_d, r) =>
          r.status === 1 ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>,
      },
      { title: '排序', dataIndex: 'sortNo', width: 80, hideInSearch: true, render: (_d, r) => r.sortNo ?? 0 },
      { title: '备注', dataIndex: 'remark', ellipsis: true, hideInSearch: true, render: (_d, r) => r.remark || '-' },
      {
        title: '操作',
        key: 'option',
        width: 220,
        fixed: 'right',
        valueType: 'option',
        render: (_d, entity) => [
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => setEditing(entity)}>
            编辑
          </Button>,
          entity.status === 1 ? (
            <Popconfirm
              key="disable"
              title="停用作物"
              description="停用后新计划的下拉里不再出现；已有引用不受影响。确认停用？"
              onConfirm={() => statusMutation.mutate({ cropId: entity.cropId, status: 0 })}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Button
              key="enable"
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => statusMutation.mutate({ cropId: entity.cropId, status: 1 })}
            >
              启用
            </Button>
          ),
          <Popconfirm
            key="remove"
            title="删除作物"
            description="已被种养计划引用的作物不能删除（会提示原因）。确认删除？"
            okButtonProps={{ danger: true }}
            onConfirm={() => removeMutation.mutate(entity.cropId)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [removeMutation, statusMutation],
  )

  return (
    <>
      <ProTable<Crop>
        actionRef={actionRef}
        rowKey="cropId"
        headerTitle="作物主数据"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新增作物
          </Button>,
        ]}
        request={async (params) => {
          try {
            const result = await listCrops({
              pageNum: params.current ?? 1,
              pageSize: params.pageSize ?? 10,
              keyword: params.cropName as string | undefined,
              status: params.status as number | undefined,
            })
            return { data: result.list, success: true, total: result.total }
          } catch (error) {
            message.error((error as Error).message || '作物列表加载失败')
            return { data: [], success: true, total: 0 }
          }
        }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        dateFormatter="string"
        scroll={{ x: 1200 }}
      />

      <ModalForm<CropFormValue>
        key="create-crop"
        title="新增作物"
        open={createOpen}
        width={560}
        modalProps={{ destroyOnHidden: true, confirmLoading: createMutation.isPending }}
        initialValues={{ status: 1, sortNo: 0 }}
        onOpenChange={setCreateOpen}
        onFinish={async (value) => {
          await createMutation.mutateAsync(value)
          return true
        }}
      >
        <ProFormText
          name="cropName"
          label="作物名称"
          placeholder="如：水稻 / 番茄"
          rules={[
            { required: true, message: '请输入作物名称' },
            { max: 50, message: '作物名称不超过 50 个字符' },
          ]}
          extra="同租户内不允许重名"
        />
        <ProFormText name="cropCode" label="作物编码" placeholder="留空由系统自动生成（如 CROP-0001）" />
        <ProFormSelect
          name="cropCategory"
          label="作物类别"
          placeholder="选填"
          options={categoryOptions}
          fieldProps={{ allowClear: true, showSearch: true }}
        />
        <ProFormDigit name="growthCycleDays" label="生长周期(天)" min={0} fieldProps={{ precision: 0 }} />
        <ProFormText name="measurementUnit" label="计量单位" placeholder="如：kg / 株（选填）" />
        <ProFormDigit name="sortNo" label="排序号" min={0} fieldProps={{ precision: 0 }} extra="数字小的排前面" />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '停用' },
          ]}
          initialValue={1}
        />
        <ProFormTextArea name="remark" label="备注" placeholder="补充说明，200 字以内" />
      </ModalForm>

      <ModalForm<CropFormValue>
        key={`edit-crop-${editing?.cropId ?? 'none'}`}
        title="编辑作物"
        open={editing !== null}
        width={560}
        modalProps={{ destroyOnHidden: true, confirmLoading: updateMutation.isPending }}
        initialValues={
          editing
            ? {
                cropCode: editing.cropCode,
                cropName: editing.cropName,
                cropCategory: editing.cropCategory,
                growthCycleDays: editing.growthCycleDays,
                measurementUnit: editing.measurementUnit,
                status: editing.status,
                sortNo: editing.sortNo,
                remark: editing.remark,
              }
            : undefined
        }
        onOpenChange={(visible) => {
          if (!visible) setEditing(null)
        }}
        onFinish={async (value) => {
          if (!editing) return false
          await updateMutation.mutateAsync({ cropId: editing.cropId, value })
          return true
        }}
      >
        <ProFormText
          name="cropName"
          label="作物名称"
          rules={[{ required: true, message: '请输入作物名称' }]}
          extra="改名不影响已有计划（计划里存的是当时的作物名快照，重新保存才会更新）"
        />
        <ProFormText name="cropCode" label="作物编码" placeholder="留空保持原编码" />
        <ProFormSelect
          name="cropCategory"
          label="作物类别"
          placeholder="选填"
          options={categoryOptions}
          fieldProps={{ allowClear: true, showSearch: true }}
        />
        <ProFormDigit name="growthCycleDays" label="生长周期(天)" min={0} fieldProps={{ precision: 0 }} />
        <ProFormText name="measurementUnit" label="计量单位" placeholder="如：kg / 株（选填）" />
        <ProFormDigit name="sortNo" label="排序号" min={0} fieldProps={{ precision: 0 }} extra="数字小的排前面" />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '停用' },
          ]}
        />
        <ProFormTextArea name="remark" label="备注" placeholder="补充说明，200 字以内" />
      </ModalForm>
    </>
  )
}
