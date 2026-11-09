import { useMemo, useRef, useState } from 'react'
import { App as AntdApp, Button, Popconfirm, Space, Tag, Typography } from 'antd'
import {
  ModalForm,
  PageContainer,
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
 * 作物管理（基础数据）
 * 业务职责：作物主数据维护，农事生产、种养计划、批次采收等业务直接从此处选取作物。
 */
export default function CropList(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const actionRef = useRef<ActionType>(null)
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<Crop | null>(null)

  const categoryQuery = useQuery({
    queryKey: ['crop-categories'],
    queryFn: () => listCropCategories(),
    staleTime: 5 * 60 * 1000,
  })
  const categoryOptions = useMemo(
    () => (categoryQuery.data ?? []).map((item) => ({ value: item, label: item })),
    [categoryQuery.data],
  )

  /** 重载列表（同时刷新下拉缓存） */
  async function reload(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['crop-options'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-crop-options-for-templates'] })
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
    onError: (error: Error) => message.error(error.message || '删除失败'),
  })

  /** 表格列定义 */
  const columns = useMemo<ProColumns<Crop>[]>(
    () => [
      {
        title: '作物编码',
        dataIndex: 'cropCode',
        width: 140,
        copyable: true,
        render: (_d, r) => r.cropCode || '-',
      },
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
      {
        title: '类别',
        dataIndex: 'cropCategory',
        width: 120,
        render: (_d, r) => r.cropCategory ? <Tag color="blue">{r.cropCategory}</Tag> : '-',
      },
      {
        title: '生长周期(天)',
        dataIndex: 'growthCycleDays',
        width: 120,
        hideInSearch: true,
        align: 'right',
        render: (_d, r) => (r.growthCycleDays ? `${r.growthCycleDays} 天` : '-'),
      },
      {
        title: '计量单位',
        dataIndex: 'measurementUnit',
        width: 100,
        hideInSearch: true,
        render: (_d, r) => r.measurementUnit || '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        valueEnum: { 1: { text: '启用', status: 'Success' }, 0: { text: '停用', status: 'Default' } },
        render: (_d, r) =>
          r.status === 1 ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>,
      },
      {
        title: '排序权重',
        dataIndex: 'sortNo',
        width: 90,
        hideInSearch: true,
        render: (_d, r) => r.sortNo ?? 0,
      },
      {
        title: '备注说明',
        dataIndex: 'remark',
        ellipsis: true,
        hideInSearch: true,
        render: (_d, r) => r.remark || '-',
      },
      {
        title: '操作',
        key: 'option',
        width: 180,
        fixed: 'right',
        valueType: 'option',
        render: (_d, entity) => [
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(entity)}
          >
            编辑
          </Button>,
          entity.status === 1 ? (
            <Popconfirm
              key="disable"
              title="停用作物"
              description="停用后新计划的下拉里不再出现；已有历史数据不受影响。确认停用？"
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
            description="已被农事计划引用的作物不能删除。确认删除？"
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
    <PageContainer
      title="作物管理"
      subTitle="维护平台作物基础主数据，供农事生产、地块排产与批次采收全局引用"
    >
      <ProTable<Crop>
        actionRef={actionRef}
        rowKey="cropId"
        headerTitle="作物档案列表"
        columns={columns}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        options={{
          density: true,
          fullScreen: true,
          reload: true,
          setting: true,
        }}
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
              status: params.status !== undefined && params.status !== null ? Number(params.status) : undefined,
            })
            return { data: result.list, success: true, total: result.total }
          } catch (error) {
            message.error((error as Error).message || '作物列表加载失败')
            return { data: [], success: true, total: 0 }
          }
        }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        dateFormatter="string"
        scroll={{ x: 1100 }}
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
          placeholder="如：西红柿 / 黄瓜 / 水稻"
          rules={[
            { required: true, message: '请输入作物名称' },
            { max: 50, message: '作物名称不超过 50 个字符' },
          ]}
          extra="同一经营主体内不允许重名"
        />
        <ProFormText
          name="cropCode"
          label="作物编码"
          placeholder="如：CROP-TOMATO（留空自动生成）"
          rules={[{ max: 50, message: '编码不超过 50 个字符' }]}
        />
        <ProFormSelect
          name="cropCategory"
          label="作物类别"
          options={categoryOptions}
          placeholder="请选择作物类别"
          rules={[{ required: true, message: '请选择类别' }]}
        />
        <ProFormDigit
          name="growthCycleDays"
          label="标准生长周期 (天)"
          min={1}
          max={3650}
          placeholder="如：90"
        />
        <ProFormText
          name="measurementUnit"
          label="主要采收计量单位"
          placeholder="如：kg / 吨 / 箱"
        />
        <ProFormDigit
          name="sortNo"
          label="排序权重"
          min={0}
          max={9999}
          tooltip="数字越小越靠前"
        />
        <ProFormTextArea
          name="remark"
          label="备注说明"
          placeholder="输入种植要点、标准规程等说明"
        />
      </ModalForm>

      <ModalForm<CropFormValue>
        key="edit-crop"
        title={`编辑作物 · ${editing?.cropName ?? ''}`}
        open={Boolean(editing)}
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
        onOpenChange={(open) => {
          if (!open) setEditing(null)
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
          rules={[
            { required: true, message: '请输入作物名称' },
            { max: 50, message: '作物名称不超过 50 个字符' },
          ]}
        />
        <ProFormText
          name="cropCode"
          label="作物编码"
          disabled
          extra="编码创建后不可修改"
        />
        <ProFormSelect
          name="cropCategory"
          label="作物类别"
          options={categoryOptions}
          rules={[{ required: true, message: '请选择类别' }]}
        />
        <ProFormDigit
          name="growthCycleDays"
          label="标准生长周期 (天)"
          min={1}
          max={3650}
        />
        <ProFormText
          name="measurementUnit"
          label="主要采收计量单位"
        />
        <ProFormDigit
          name="sortNo"
          label="排序权重"
          min={0}
          max={9999}
        />
        <ProFormTextArea
          name="remark"
          label="备注说明"
        />
      </ModalForm>
    </PageContainer>
  )
}
