import useAuthStore from '@/store/auth'
import ProTable from '@/components/ProductionTable'
/**
 * 页面名称：品种对接表
 * 路由路径：/production/p2t/variety
 * 所属模块：产销对接
 *
 * 把生产端作物/品种映射到交易端品类。没有映射的品种不允许发布供给 —— 这是第一道硬闸。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { App as AntdApp, Button, Popconfirm, Space, Tag, Typography } from 'antd'
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  } from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { useMutation, useQuery } from '@tanstack/react-query'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import PageContainer from '@/components/ProductionPageContainer'
import { listCrops } from '@/api/crops'
import { listTradeCategories, listVarietyMaps, removeVarietyMap, saveVarietyMap } from '@/api/p2t'
import type { P2tVarietyMap } from '@/api/p2t'
import { SCROLL_BY_CONTENT, wideTextCell } from '@/components/tableScroll'

interface MapFormValue {
  cropId?: string
  cropName?: string
  varietyName?: string
  categoryCode: string
  categoryName?: string
  specStandard?: string
  gradeRule?: string
  mainOrigin?: string
  windowStart?: string
  windowEnd?: string
  conversionRate?: number
  status: number
  remark?: string
}

export default function P2tVarietyMapPage(): JSX.Element {
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const { message } = AntdApp.useApp()
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<P2tVarietyMap | null>(null)
  const [formOpen, setFormOpen] = useState<boolean>(false)

  const scope = String(subjectId ?? '')
  const isCurrent = () => !!scope && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope
  useEffect(() => { setFormOpen(false); setEditing(null) }, [subjectId])
  const cropQuery = useQuery({
    queryKey: ['p2t-crops', subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const rows: Awaited<ReturnType<typeof listCrops>>['list'] = []
      for (let pageNum = 1; ; pageNum++) {
        if (!isCurrent()) throw new Error('经营主体已切换')
        const page = await listCrops({ pageNum, pageSize: 200, status: 1 })
        rows.push(...page.list)
        if (rows.length >= page.total) break
        if (!page.list.length) throw new Error('作物分页异常，请重试')
      }
      return { list: rows }
    },
  })
  const categoryQuery = useQuery({
    queryKey: ['p2t-trade-categories', subjectId],
    enabled: !!subjectId,
    queryFn: listTradeCategories,
    staleTime: 60_000,
  })
  const categoryByCode = useMemo(() => {
    const map = new Map<string, { code: string; name: string; parent?: string }>()
    const rows = categoryQuery.data ?? []
    const names = new Map(rows.map((c) => [c.id, c.categoryName]))
    rows.forEach((c) => {
      if (c.categoryCode) map.set(c.categoryCode, { code: c.categoryCode, name: c.categoryName, parent: c.parentId ? names.get(c.parentId) : undefined })
    })
    return map
  }, [categoryQuery.data])
  const missingCodeCount = (categoryQuery.data ?? []).filter((c) => !c.categoryCode).length
  const categoryOptions = useMemo(() => {
    const options = Array.from(categoryByCode.values()).map((c) => ({
      value: c.code, label: `${c.parent ? `${c.parent} / ` : ''}${c.name}（${c.code}）`,
    }))
    // 编辑历史映射时，字典里没有的旧编码仍要能显示，但标明字典外，保存时必须改选
    if (editing?.categoryCode && !categoryByCode.has(editing.categoryCode)) {
      options.unshift({ value: editing.categoryCode, label: `${editing.categoryName || editing.categoryCode}（${editing.categoryCode}，字典外）` })
    }
    return options
  }, [categoryByCode, editing])
  const cropOptions = useMemo(
    () => (cropQuery.data?.list ?? []).map((c) => ({ value: String(c.cropId), label: `${c.cropName}（${c.cropCode}）` })),
    [cropQuery.data],
  )

  const saveMutation = useMutation({
    mutationFn: (values: MapFormValue) => {
      if (!isCurrent()) throw new Error('经营主体已切换')
      const category = categoryByCode.get(values.categoryCode)
      if (!category) throw new Error('请从交易品类字典中选择品类')
      values = { ...values, categoryCode: category.code, categoryName: category.name }
      const crop = cropQuery.data?.list?.find((c) => String(c.cropId) === String(values.cropId))
      return saveVarietyMap({
        ...values,
        id: editing?.id,
        cropId: values.cropId ? Number(values.cropId) : undefined,
        cropCode: crop?.cropCode,
        cropName: crop?.cropName ?? values.cropName,
      })
    },
    onSuccess: () => {
      message.success(editing ? '映射已保存' : '映射已新增')
      setFormOpen(false)
      setEditing(null)
      actionRef.current?.reload()
    },
    onError: (e: Error) => message.error(e.message || '保存失败'),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => { if (!isCurrent()) throw new Error('经营主体已切换'); return removeVarietyMap(id) },
    onSuccess: () => {
      message.success('映射已删除')
      actionRef.current?.reload()
    },
    onError: (e: Error) => message.error(e.message || '删除失败'),
  })

  const columns: ProColumns<P2tVarietyMap>[] = [
    { title: '作物／品种／品类', dataIndex: 'keyword', hideInTable: true },
    {
      title: '生产品种',
      render: (_, row) => (
        <div>
          <b>{row.cropName}{row.varietyName ? `·${row.varietyName}` : ''}</b>
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.cropCode ?? '—'}</Typography.Text></div>
        </div>
      ),
    },
    { title: '交易品类', width: 160, render: (_, row) => <>{row.categoryName || row.categoryCode}{categoryQuery.isSuccess && row.categoryCode && !categoryByCode.has(row.categoryCode) && <Tag color="orange" style={{ marginLeft: 6 }}>字典外</Tag>}</> },
    { title: '品类码', dataIndex: 'categoryCode', width: 130 },
    { title: '标准规格', dataIndex: 'specStandard', ...wideTextCell('specStandard', 180) },
    { title: '等级规则', dataIndex: 'gradeRule', ...wideTextCell('gradeRule', 240) },
    { title: '主产区', dataIndex: 'mainOrigin', width: 120 },
    { title: '上市窗口', render: (_, row) => (row.windowStart ? `${row.windowStart} ~ ${row.windowEnd}` : '—'), width: 130 },
    { title: '折算系数', dataIndex: 'conversionRate', width: 100, align: 'right' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      valueType: 'select', valueEnum: { 1: '已生效', 0: '已停用' },
      render: (v) => (v === 1 ? <Tag color="green">已生效</Tag> : <Tag>已停用</Tag>),
    },
    {
      title: '操作', fixed: 'right', valueType: 'option',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => {
            setEditing(row)
            setFormOpen(true)
          }}>编辑</Button>
          <Popconfirm title="删除该映射？" onConfirm={() => removeMutation.mutate(row.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer
      header={{ title: '品种对接表' }}
      extra={[
        <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}>新增映射</Button>,
      ]}
    >

      <ProTable<P2tVarietyMap>
        key={scope} params={{ subjectId }} columnWidthStorageKey="p2t-variety-map"
        options={{ reload: true, density: true, setting: true }}
        actionRef={actionRef}
        rowKey="id"
        columns={columns.map(column => column.dataIndex === 'keyword' || column.dataIndex === 'status' ? column : { ...column, search: false })}
        className="p2t-scroll-table" scroll={SCROLL_BY_CONTENT}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true }}
        request={async (params) => {
          if (!isCurrent()) return { data: [], total: 0, success: false }
          const res = await listVarietyMaps({
            status: params.status === undefined || params.status === '' ? undefined : Number(params.status),
            pageNum: params.current ?? 1,
            pageSize: params.pageSize ?? 10,
            keyword: (params.keyword as string) || undefined,
          })
          return isCurrent() ? { data: res.list, total: res.total, success: true } : { data: [], total: 0, success: false }
        }}

      />

      <ModalForm<MapFormValue>
        title={editing ? '编辑品种映射' : '新增品种映射'}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        initialValues={editing ? {
          cropId: editing.cropId ? String(editing.cropId) : undefined,
          cropName: editing.cropName,
          varietyName: editing.varietyName,
          categoryCode: editing.categoryCode,
          categoryName: editing.categoryName,
          specStandard: editing.specStandard,
          gradeRule: editing.gradeRule,
          mainOrigin: editing.mainOrigin,
          windowStart: editing.windowStart,
          windowEnd: editing.windowEnd,
          conversionRate: editing.conversionRate,
          status: editing.status,
          remark: editing.remark,
        } : { status: 1, conversionRate: 1 }}
        modalProps={{ destroyOnClose: true, width: 720 }}
        onFinish={async (values) => { try { await saveMutation.mutateAsync(values); return true } catch { return false } }}
      >
        <ProFormSelect
          name="cropId"
          label="生产品种"
          options={cropOptions}
          fieldProps={{ loading: cropQuery.isFetching }}
          extra={cropQuery.isError ? <Button onClick={() => void cropQuery.refetch()}>作物加载失败，点击重试</Button> : undefined}
          rules={[{ required: true, message: '请选择作物' }]}
          showSearch
        />
        <ProFormText name="varietyName" label="具体品种" placeholder="如：早熟紫皮 / 红富士" />
        <ProFormSelect
          name="categoryCode"
          label="交易品类"
          options={categoryOptions}
          showSearch
          fieldProps={{ loading: categoryQuery.isFetching, optionFilterProp: 'label' }}
          placeholder="从交易端品类字典中选择"
          extra={categoryQuery.isError
            ? <Button onClick={() => void categoryQuery.refetch()}>交易品类字典加载失败，点击重试</Button>
            : categoryQuery.isSuccess && !categoryByCode.size
              ? '交易端暂无带编码的启用品类，请先在交易端品类管理中维护编码'
              : missingCodeCount ? `另有 ${missingCodeCount} 个品类未设置编码，暂不可选` : undefined}
          rules={[{ required: true, message: '请选择交易品类' }]}
        />
        <ProFormText name="specStandard" label="标准规格" placeholder="如 5kg 网袋 · 10 袋/件" />
        <ProFormTextArea name="gradeRule" label="等级规则" placeholder="如 一级 / 二级 / 等外（横径 ≥5.5cm 为一级）" />
        <ProFormText name="mainOrigin" label="主产区" placeholder="如 河南中牟" />
        <Space>
          <ProFormText name="windowStart" label="上市窗口起 (MM-DD)" width="sm" placeholder="05-01" />
          <ProFormText name="windowEnd" label="上市窗口止 (MM-DD)" width="sm" placeholder="11-30" />
          <ProFormDigit name="conversionRate" label="折算系数" min={0} width="xs" />
        </Space>
        <ProFormSelect name="status" label="状态" options={[{ value: 1, label: '生效' }, { value: 0, label: '停用' }]} />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>
    </PageContainer>
  )
}
