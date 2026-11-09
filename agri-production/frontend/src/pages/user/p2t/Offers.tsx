import ProTable from '@/components/ProductionTable'
import PageContainer from '@/components/ProductionPageContainer'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import SectionCard from '@/components/SectionCard'
import OfferSubscriptionFlows from './OfferSubscriptionFlows'
/**
 * 页面名称：供给意向发布
 * 路由路径：/production/p2t/offers
 * 所属模块：产销对接
 *
 * 供给意向只说「有什么、有多少、什么时候能出、什么等级」，不说价格。
 * 价格参考区间仅内部可见，不对外、不参与撮合。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App as AntdApp, Button, Drawer, Spin, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import {
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormTextArea,
  } from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  getP2tOffer,
  closeP2tOffer,
  createP2tOffer,
  listP2tBatches,
  listP2tOffers,
  listVarietyMapsOfCrop,
  removeP2tOffer,
  submitP2tOffer,
  updateP2tOffer,
} from '@/api/p2t'
import type { P2tBatchRow, P2tOffer, P2tOfferPayload } from '@/api/p2t'
import useAuthStore from '@/store/auth'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'

const AUDIT_TAG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待承接', color: 'orange' },
  APPROVED: { text: '已承接', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
}

const TRADE_TAG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待建品', color: 'default' },
  LISTED: { text: '已上架', color: 'green' },
  SOLD: { text: '已售罄', color: 'blue' },
  CLOSED: { text: '已关闭', color: 'default' },
}

interface OfferFormValue extends P2tOfferPayload {
  batchId?: number
  windowStartText?: string
  windowEndText?: string
}

export default function P2tOffers(): JSX.Element {
  const { message } = AntdApp.useApp()
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const previousSubjectId = useRef(subjectId)
  const actionRef = useRef<ActionType>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const linkedBatchId = searchParams.get('batchId') || undefined
  const linkedSubjectId = searchParams.get('subjectId')
  const invalidBatch = !!linkedBatchId && !/^[1-9]\d{0,18}$/.test(linkedBatchId)
  const subjectMismatch = !!linkedSubjectId && String(subjectId) !== linkedSubjectId
  const linkBlocked = invalidBatch || subjectMismatch
  const clearBatchFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('batchId'); next.delete('subjectId'); next.delete('create')
    setSearchParams(next)
  }
  const [detailTarget, setDetailTarget] = useState<{ offerNo: string; subjectId: typeof subjectId } | null>(null)
  const detailVisible = !!detailTarget && detailTarget.subjectId === subjectId && !linkBlocked
  const detailQuery = useQuery({
    queryKey: ['p2t-offer-detail', subjectId, detailTarget?.offerNo],
    enabled: detailVisible && !!subjectId,
    queryFn: () => getP2tOffer(detailTarget!.offerNo),
    staleTime: 0,
  })
  const detail = detailVisible && !detailQuery.isError ? detailQuery.data : undefined
  const openDetail = (row: P2tOffer) => setDetailTarget({ offerNo: row.offerNo, subjectId })
  useEffect(() => {
    const offerNo = searchParams.get('offerNo')
    if (offerNo && subjectId && !linkBlocked) setDetailTarget({ offerNo, subjectId })
  }, [searchParams, subjectId, linkBlocked])
  const quantity = (value: number | undefined, unit?: string) => value == null ? '—' : `${value} ${unit || ''}`.trim()
  const ratio = (value?: number) => value == null ? '—' : `${value}%`

  const [formOpen, setFormOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<P2tOffer | null>(null)
  const [batchId, setBatchId] = useState<number | undefined>(undefined)
  const [auditStatus, setAuditStatus] = useState<string | undefined>(undefined)

  const batchQuery = useQuery({
    queryKey: ['p2t-offer-batches', subjectId],
    queryFn: async () => {
      const rows: P2tBatchRow[] = []
      for (let pageNum = 1; ; pageNum++) {
        const page = await listP2tBatches({ pageNum, pageSize: 200 })
        rows.push(...page.list)
        if (!page.list.length || rows.length >= page.total) return { ...page, list: rows }
      }
    },
  })
  const batches = batchQuery.data?.list ?? []
  const selectedBatch = batches.find((b) => b.batchId === batchId) as P2tBatchRow | undefined

  const mapQuery = useQuery({
    queryKey: ['p2t-crop-maps', subjectId, selectedBatch?.cropId, selectedBatch?.cropName],
    queryFn: () => listVarietyMapsOfCrop({
      cropId: selectedBatch?.cropId,
      cropName: selectedBatch?.cropName,
    }),
    enabled: !!selectedBatch,
  })
  const categoryOptions = useMemo(
    () => (mapQuery.data ?? []).map((m) => ({
      value: m.categoryCode,
      label: `${m.categoryName ?? m.categoryCode}（${m.categoryCode}）`,
    })),
    [mapQuery.data],
  )

  // 从批次页跳转过来：?batchId=..&create=1 直接打开发布弹窗
  useEffect(() => {
    const raw = searchParams.get('batchId')
    if (raw && !linkBlocked && searchParams.get('create') === '1') {
      setBatchId(Number(raw))
      setEditing(null)
      setFormOpen(true)
    }
  }, [searchParams, linkBlocked])

  useEffect(() => { if (previousSubjectId.current === subjectId) return; previousSubjectId.current = subjectId; setFormOpen(false); setEditing(null); setDetailTarget(null); setBatchId(undefined); void actionRef.current?.reload() }, [subjectId])

  const reload = () => { void batchQuery.refetch(); return actionRef.current?.reload() }

  const createMutation = useMutation({
    mutationFn: (values: OfferFormValue) => createP2tOffer(values),
    onSuccess: () => {
      message.success('供给意向已发布，等待供应商在交易撮合平台承接')
      setFormOpen(false)
      setEditing(null)
      reload()
    },
    onError: (e: Error) => { message.error(e.message || '发布失败'); void batchQuery.refetch() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: OfferFormValue }) => updateP2tOffer(id, values),
    onSuccess: () => {
      message.success('供给单已变更并再次发布')
      setFormOpen(false)
      setEditing(null)
      reload()
    },
    onError: (e: Error) => { message.error(e.message || '变更失败'); void batchQuery.refetch() },
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => submitP2tOffer(id),
    onSuccess: () => { message.success('已再次发布'); reload() },
    onError: (e: Error) => message.error(e.message || '提交失败'),
  })

  const closeMutation = useMutation({
    mutationFn: (id: number) => closeP2tOffer(id),
    onSuccess: () => { message.success('供给单已关闭'); reload() },
    onError: (e: Error) => message.error(e.message || '关闭失败'),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeP2tOffer(id),
    onSuccess: () => { message.success('供给单已删除'); reload() },
    onError: (e: Error) => message.error(e.message || '删除失败'),
  })

  const columns: ProColumns<P2tOffer>[] = [
    { title: '供给单号', dataIndex: 'offerNo', width: 170, fixed: 'left', render: (_, row) => <Button type="link" size="small" onClick={() => openDetail(row)}>{row.offerNo}</Button> },
    {
      title: '品种 / 批次',
      render: (_, row) => (
        <div>
          <b>{row.cropName}{row.varietyName ? `·${row.varietyName}` : ''}</b>
          <div><Button type="link" size="small" onClick={() => navigate(`/production/harvests/${row.batchId}`)}>{row.batchNo || '查看采收批次'}</Button> · {row.categoryName}</div>
        </div>
      ),
    },
    { title: '可供量', dataIndex: 'availableQty', align: 'right', width: 110, render: (v, r) => `${v} ${r.unit}` },
    { title: '已认购', dataIndex: 'reservedQty', align: 'right', width: 110, render: (v, r) => `${v} ${r.unit}` },
    {
      title: '等级结构',
      width: 150,
      render: (_, r) => `${r.gradeARatio ?? 0}% / ${r.gradeBRatio ?? 0}% / ${r.gradeCRatio ?? 0}%`,
    },
    { title: '上市窗口', width: 180, render: (_, r) => (r.windowStart ? `${r.windowStart} ~ ${r.windowEnd}` : '—') },
    {
      title: '审核',
      dataIndex: 'auditStatus',
      width: 100,
      render: (_, row) => <Tag color={AUDIT_TAG[row.auditStatus]?.color}>{AUDIT_TAG[row.auditStatus]?.text ?? row.auditStatus}</Tag>,
    },
    {
      title: '交易状态',
      dataIndex: 'tradeStatus',
      width: 100,
      render: (_, row) => <Tag color={TRADE_TAG[row.tradeStatus]?.color}>{TRADE_TAG[row.tradeStatus]?.text ?? row.tradeStatus}</Tag>,
    },
    {
      title: '商品',
      width: 150,
      render: (_, row) => row.productCode
        ? <div><div>{row.productName}</div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.productCode}</Typography.Text></div>
        : '—',
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, row) => (
        <Space size={0} wrap>
          <Button size="small" type="link" onClick={() => openDetail(row)}>详情</Button>
          {row.tradeStatus === 'PENDING' && row.auditStatus === 'REJECTED' && (
            <Button size="small" type="link" icon={<SendOutlined />} onClick={() => submitMutation.mutate(row.id)}>重新提交</Button>
          )}
          {row.tradeStatus === 'PENDING' && (
            <>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => {
                setEditing(row)
                setBatchId(row.batchId)
                setFormOpen(true)
              }}>变更</Button>
              <Popconfirm title="关闭供给单？" onConfirm={() => closeMutation.mutate(row.id)}>
                <Button size="small" type="link" danger icon={<CloseCircleOutlined />}>关闭</Button>
              </Popconfirm>
            </>
          )}
          {row.reservedQty > 0 || !['PENDING', 'CLOSED'].includes(row.tradeStatus) ? null : (
            <Popconfirm title="删除供给单？" onConfirm={() => removeMutation.mutate(row.id)}>
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer title="供给意向">
    <>
      {linkedBatchId && <Alert
        style={{ marginBottom: 16 }}
        type={linkBlocked ? 'warning' : 'info'}
        showIcon
        message={invalidBatch ? '采收批次参数无效，请清除筛选后重试' : subjectMismatch
          ? '当前经营主体已变化，请切回原主体查看关联供给，或清除批次筛选'
          : `当前仅显示采收批次 ${batches.find((b) => String(b.batchId) === linkedBatchId)?.batchNo ?? linkedBatchId} 的关联供给（含已关闭、已驳回）`}
        action={<Space>
          {!linkBlocked && <Button size="small" onClick={() => navigate(`/production/harvests/${linkedBatchId}`)}>返回采收详情</Button>}
          <Button size="small" onClick={clearBatchFilter}>清除批次筛选</Button>
        </Space>}
      />}
      {!linkBlocked && <ProTable<P2tOffer>
        actionRef={actionRef}
        className="p2t-scroll-table"
        headerTitle={false}
        key={`${subjectId}-${linkedBatchId ?? "all"}`}
        columnWidthStorageKey="p2t-offers"
        params={{ auditStatus, subjectId, batchId: linkedBatchId }}
        rowKey="offerNo"
        columns={columns}
        scroll={SCROLL_BY_CONTENT}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10 }}
        request={async (params) => {
          const res = await listP2tOffers({
            batchId: params.batchId as string | undefined,
            pageNum: params.current ?? 1,
            pageSize: params.pageSize ?? 10,
            keyword: (params.offerNo as string) || (params.keyword as string) || undefined,
            auditStatus: params.auditStatus as string | undefined,
          })
          return { data: res.list, total: res.total, success: true }
        }}
        toolBarRender={() => [
          <Select
            key="audit"
            allowClear
            value={auditStatus}
            placeholder="承接状态"
            style={{ width: 130 }}
            options={[
              { value: 'PENDING', label: '待承接' },
              { value: 'APPROVED', label: '已承接' },
              { value: 'REJECTED', label: '已驳回' },
            ]}
            onChange={(value) => setAuditStatus(value)}
          />,
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null)
            setBatchId(linkedBatchId ? Number(linkedBatchId) : undefined)
            setFormOpen(true)
          }}>新建供给意向</Button>,
        ]}
      />}

      <Drawer title="供给详情" width="min(920px, 100vw)" open={detailVisible} onClose={() => setDetailTarget(null)} destroyOnClose
        extra={<Button loading={detailQuery.isFetching} onClick={() => void detailQuery.refetch()}>刷新</Button>}>
        {detailQuery.isError ? <Alert type="error" showIcon message="供给详情加载失败"
          description={detailQuery.error instanceof Error ? detailQuery.error.message : '请稍后重试'}
          action={<Button onClick={() => void detailQuery.refetch()}>重试</Button>} /> :
          <Spin spinning={detailQuery.isFetching}>
            {detail && <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <SectionCard title="供给与来源" extra={<Button onClick={() => { setDetailTarget(null); navigate(`/production/harvests/${detail.batchId}`) }}>查看采收详情</Button>}>
                <DetailInfoGrid items={[
                  { label: '供给单号', value: <Typography.Text copyable>{detail.offerNo}</Typography.Text> },
                  { label: '采收批次', value: detail.batchNo },
                  { label: '作物 / 品种', value: [detail.cropName, detail.varietyName].filter(Boolean).join(' / ') },
                  { label: '交易品类', value: detail.categoryName },
                  { label: '农场', value: detail.farmName }, { label: '产地', value: detail.origin },
                  { label: '供给总量', value: quantity(detail.availableQty, detail.unit) },
                  { label: '已认购量', value: quantity(detail.reservedQty, detail.unit) },
                  { label: '未认购意向量', value: quantity(detail.remainingQty, detail.unit) },
                  { label: '起订量', value: quantity(detail.minOrderQty, detail.unit) },
                ]} />
              </SectionCard>
              <SectionCard title="交付与质量">
                <DetailInfoGrid items={[
                  { label: '交割方式', value: ({ ORIGIN: '产地自提', WAREHOUSE: '送到指定仓', PLATFORM: '平台统仓' } as Record<string, string>)[detail.deliveryType || ''] || detail.deliveryType },
                  { label: '上市窗口', value: detail.windowStart || detail.windowEnd ? `${detail.windowStart || '—'} 至 ${detail.windowEnd || '—'}` : undefined },
                  { label: '一级占比', value: ratio(detail.gradeARatio) },
                  { label: '二级占比', value: ratio(detail.gradeBRatio) },
                  { label: '等外占比', value: ratio(detail.gradeCRatio) },
                  { label: '质检编号', value: detail.qualityNo },
                  { label: '质检有效期', value: detail.qualityValidUntil },
                  { label: '溯源码段', value: detail.traceCodeSeg },
                  { label: '内部参考价格区间', value: detail.priceRefMin == null && detail.priceRefMax == null ? undefined : `${detail.priceRefMin ?? '—'} ～ ${detail.priceRefMax ?? '—'}` },
                  { label: '备注', value: detail.remark, fullWidth: true },
                ]} />
              </SectionCard>
              <SectionCard title="审核与商品">
                <DetailInfoGrid items={[
                  { label: '承接状态', value: <Tag color={AUDIT_TAG[detail.auditStatus]?.color}>{AUDIT_TAG[detail.auditStatus]?.text || detail.auditStatus}</Tag> },
                  { label: '交易状态', value: <Tag color={TRADE_TAG[detail.tradeStatus]?.color}>{TRADE_TAG[detail.tradeStatus]?.text || detail.tradeStatus}</Tag> },
                  { label: '审核人', value: detail.auditor }, { label: '审核时间', value: detail.auditTime },
                  { label: '承接反馈', value: detail.auditRemark, fullWidth: true },
                  { label: '商品名称', value: detail.productName }, { label: '商品编码', value: detail.productCode },
                  { label: '上架数量', value: quantity(detail.listedQty, detail.unit) }, { label: '上架时间', value: detail.listedTime },
                  { label: '发布时间', value: detail.publishTime }, { label: '创建时间', value: detail.createTime },
                ]} />
              </SectionCard>
              <OfferSubscriptionFlows key={`${subjectId}:${detail.offerNo}`} offerNo={detail.offerNo} unit={detail.unit} subjectId={String(subjectId)} />
            </Space>}
          </Spin>}
      </Drawer>
      <ModalForm<OfferFormValue>
        title={editing ? `变更供给意向 ${editing.offerNo}` : '新建供给意向'}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) { setEditing(null); setBatchId(undefined) }
        }}
        initialValues={editing ? {
          batchId: editing.batchId,
          categoryCode: editing.categoryCode,
          availableQty: editing.availableQty,
          minOrderQty: editing.minOrderQty,
          deliveryType: editing.deliveryType,
          windowStartText: editing.windowStart,
          windowEndText: editing.windowEnd,
          gradeARatio: editing.gradeARatio,
          gradeBRatio: editing.gradeBRatio,
          gradeCRatio: editing.gradeCRatio,
          priceRefMin: editing.priceRefMin,
          priceRefMax: editing.priceRefMax,
          remark: editing.remark,
        } : {
          batchId,

          deliveryType: 'WAREHOUSE',
        }}
        modalProps={{ destroyOnClose: true, width: 760 }}
        onFinish={async (values) => {
          if (useAuthStore.getState().userInfo?.tenantId !== subjectId) { message.error('经营主体已切换，请重新填写'); return false }
          if (!values.availableQty || values.availableQty <= 0) { message.error('可供量必须大于 0'); return false }
          if (!selectedBatch || selectedBatch.stockUnitMismatch) { message.error('请重新选择批次并核对库存单位'); return false }
          const ownOccupied = editing ? (editing.auditStatus === 'REJECTED' ? editing.reservedQty : Math.max(editing.availableQty, editing.reservedQty)) : 0
          const maxSupply = Math.max(0, selectedBatch.availableStockQty - selectedBatch.publishedQty + ownOccupied)
          if (values.availableQty > maxSupply) { message.error(`现货可供量不能超过 ${maxSupply} ${selectedBatch.unit}`); return false }
          if ((values.minOrderQty ?? 0) > values.availableQty) { message.error('起订量不能超过可供量'); return false }
          const ratioTotal = (values.gradeARatio ?? 0) + (values.gradeBRatio ?? 0) + (values.gradeCRatio ?? 0)
          if (ratioTotal !== 0 && Math.abs(ratioTotal - 100) > 0.000001) { message.error('等级占比合计必须为 100%'); return false }
          if (values.priceRefMin != null && values.priceRefMax != null && values.priceRefMin > values.priceRefMax) { message.error('参考价下限不能高于上限'); return false }
          if (values.windowStartText && values.windowEndText && dayjs(values.windowEndText).isBefore(dayjs(values.windowStartText), 'day')) { message.error('上市窗口结束日不能早于开始日'); return false }
          const payload: OfferFormValue = {
            ...values,
            windowStart: values.windowStartText
              ? dayjs(values.windowStartText as unknown as dayjs.Dayjs).format('YYYY-MM-DD')
              : undefined,
            windowEnd: values.windowEndText
              ? dayjs(values.windowEndText as unknown as dayjs.Dayjs).format('YYYY-MM-DD')
              : undefined,
          }
          try {
            if (editing) await updateMutation.mutateAsync({ id: editing.id, values: payload })
            else await createMutation.mutateAsync(payload)
            return true
          } catch {
            // 错误由 mutation 提示；保留弹窗和用户输入，便于修正后重试。
            return false
          }
        }}
      >
        <ProFormSelect
          name="batchId"
          label="采收批次"
          options={batches.filter((b) => b.publishable || b.batchId === editing?.batchId).map((b) => ({
            value: b.batchId,
            label: `${b.batchNo} · ${b.cropName} · 现货可发布 ${b.publishableQty} ${b.unit}`,
          }))}
          rules={[{ required: true, message: '请选择批次' }]}
          showSearch
          disabled={!!editing}
          fieldProps={{
            onChange: (value: number) => setBatchId(value),
          }}
        />
        {selectedBatch && (
          <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
            当前库存 {selectedBatch.stockQty} {selectedBatch.unit} · 冻结 {selectedBatch.frozenQty} · 过期未冻结 {selectedBatch.unusableQty} · 库存可用 {selectedBatch.availableStockQty} · 供给占用 {selectedBatch.publishedQty} · 现货可发布 {selectedBatch.publishableQty}
            {!selectedBatch.qualityJudged && ' · 质检未判定（承接方通常会要求先出质检结论）'}
          </Typography.Paragraph>
        )}
        <ProFormSelect
          name="categoryCode"
          label="交易品类"
          options={categoryOptions}
          rules={[{ required: !editing, message: '请选择交易品类' }]}
          placeholder="先选择批次，再选择品类"
          showSearch
          disabled={!!editing}
        />
        <ProFormDigit name="availableQty" label="可供量" min={0} rules={[{ required: true, message: '请填写可供量' }]} fieldProps={{ precision: 1 }} />
        <ProFormDigit name="minOrderQty" label="起订量" min={0} fieldProps={{ precision: 1 }} />
        <ProFormSelect name="deliveryType" label="交割方式" options={[
          { value: 'ORIGIN', label: '产地自提' },
          { value: 'WAREHOUSE', label: '送到指定仓' },
          { value: 'PLATFORM', label: '平台统仓' },
        ]} />
        <ProFormDatePicker name="windowStartText" label="上市窗口起" fieldProps={{ style: { width: '100%' } }} />
        <ProFormDatePicker name="windowEndText" label="上市窗口止" fieldProps={{ style: { width: '100%' } }} />
        <Space>
          <ProFormDigit name="gradeARatio" label="一级占比 %" min={0} max={100} width="xs" />
          <ProFormDigit name="gradeBRatio" label="二级占比 %" min={0} max={100} width="xs" />
          <ProFormDigit name="gradeCRatio" label="等外占比 %" min={0} max={100} width="xs" />
        </Space>
        <Space>
          <ProFormDigit name="priceRefMin" label="参考价下限" min={0} width="sm" />
          <ProFormDigit name="priceRefMax" label="参考价上限" min={0} width="sm" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            仅内部参考，不对外、不参与撮合（定价权归交易端）
          </Typography.Text>
        </Space>
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>
    </>
    </PageContainer>
  )
}
