import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getP2tOffer, listP2tDiffs } from '@/api/p2t'
import { Alert, App, Button, Drawer, Form, Input, Modal, Select, Space, Tabs, Tag } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ActionType } from '@ant-design/pro-components'
import { applyGradeReview, decideGradeReview, pageGradeReviews, fetchInspectionPage } from '@/api/quality'
import type { GradeReview } from '@/api/quality'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import type { ProColumns } from '@ant-design/pro-components'
import PageContainer from '@/components/ProductionPageContainer'
import ProTable from '@/components/ProductionTable'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'
import { listHarvests } from '@/api/harvests'
import useFarmStore from '@/store/farm'
import useAuthStore from '@/store/auth'
import type { HarvestBatch, PageResult } from '@/types'

/** 全部分页成功后才提供选项，不将截断列表当作完整结果。 */
async function loadOptions<T>(fetchPage: (page: number) => Promise<PageResult<T>>, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page++) {
    signal.throwIfAborted()
    const result = await fetchPage(page)
    signal.throwIfAborted()
    rows.push(...result.list)
    if (rows.length >= result.total) return rows
    if (!result.list.length) throw new Error('选项分页数据不完整，请刷新重试')
  }
}

/** 批次等级是生产事实；浏览器缓存不作为复核结论或审计记录。 */
export default function QualityGrading(): JSX.Element {
  const farmId = useFarmStore(s => s.currentFarm?.farmId)
  const subjectId = useAuthStore(s => s.userInfo?.tenantId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ticketId = params.get('ticketId') || undefined
  const [tab, setTab] = useState(ticketId ? 'reviews' : 'batches')
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<GradeReview | null>(null)
  const [decision, setDecision] = useState<GradeReview | null>(null)
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm()
  const [decisionForm] = Form.useForm()
  const actionRef = useRef<ActionType>(null)
  const { message } = App.useApp()
  const scope = String(subjectId ?? '')
  const current = () => !!scope && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope
  const selectedTicketId = Form.useWatch('ticketId', form) as string | undefined
  const selectedInspectionId = Form.useWatch('inspectionId', form) as string | undefined
  const tickets = useQuery({
    queryKey: ['grade-review-ticket-options', scope, open],
    enabled: open && !!scope,
    retry: false,
    queryFn: async ({ signal }) => (await loadOptions(pageNum => listP2tDiffs({ pageNum, pageSize: 100, status: 'PROCESSING', diffType: 'GRADE_DOWN' }), signal))
      .filter(row => row.ownerSide === 'PRODUCTION' && row.status === 'PROCESSING' && row.diffType === 'GRADE_DOWN' && row.offerNo && row.orderNo),
  })
  const selectedTicket = tickets.data?.find(row => String(row.id) === selectedTicketId)
  const offer = useQuery({
    queryKey: ['grade-review-offer', scope, selectedTicket?.offerNo, open],
    enabled: open && !!scope && !!selectedTicket?.offerNo,
    retry: false,
    queryFn: () => getP2tOffer(selectedTicket!.offerNo!),
  })
  const batchId = offer.data?.batchId == null ? undefined : String(offer.data.batchId)
  const inspections = useQuery({
    queryKey: ['grade-review-inspection-options', scope, selectedTicketId, batchId, open],
    enabled: open && !!scope && !!selectedTicket && !!batchId,
    retry: false,
    queryFn: async ({ signal }) => (await loadOptions(pageNum => fetchInspectionPage({ pageNum, pageSize: 100, batchId, status: 'DONE', result: 'PASS' }), signal))
      .filter(row => String(row.batchId) === batchId && row.status === 'DONE' && row.result === 'PASS'),
  })
  const selectedInspection = inspections.data?.find(row => String(row.inspectionId) === selectedInspectionId)
  const selectionBusy = tickets.isFetching || offer.isFetching || inspections.isFetching
  const selectionError = tickets.error || offer.error || inspections.error
  const retrySelection = () => {
    if (tickets.isError) void tickets.refetch()
    else if (offer.isError) void offer.refetch()
    else void inspections.refetch()
  }

  useEffect(() => { setOpen(false); setDetail(null); setDecision(null); form.resetFields(); decisionForm.resetFields() }, [subjectId, form, decisionForm])
  useEffect(() => { if (ticketId) setTab('reviews') }, [ticketId])
  const save = async (confirm: boolean) => {
    if (busy || !current()) return
    try {
      const values = await (confirm ? decisionForm : form).validateFields()
      if (!confirm && (selectionBusy || selectionError || !selectedTicket || !selectedInspection)) {
        message.warning('请先选择有效工单及同批次已完成合格检测单')
        return
      }
      setBusy(true)
      if (confirm && decision) await decideGradeReview(decision.id, values)
      else await applyGradeReview(values)
      if (!current()) return
      message.success(confirm ? '复核决定已保存' : '复核申请已保存，请由另一位用户确认')
      setOpen(false); setDecision(null); actionRef.current?.reload()
    } catch (e) { if (current() && e instanceof Error) message.error(e.message) }
    finally { setBusy(false) }
  }
  const labels: Record<string, string> = { PENDING: '待确认', APPROVED: '已通过', REJECTED: '已驳回', CONSUMED: '已核销关闭工单' }
  const reviewColumns: ProColumns<GradeReview>[] = [
    { title: '复核单号', dataIndex: 'reviewNo', width: 320, copyable: true },
    { title: '工单号', dataIndex: 'ticketNo', width: 180 },
    { title: '原订单', dataIndex: 'orderNo', width: 190 },
    { title: '原等级', dataIndex: 'originalGrade', width: 90 },
    { title: '复核等级', dataIndex: 'reviewedGrade', width: 100 },
    { title: '检测单号', dataIndex: 'inspectionNo', width: 180 },
    { title: '状态', dataIndex: 'status', width: 160, render: (_, row) => <Tag>{labels[row.status] || row.status}</Tag> },
    { title: '申请时间', dataIndex: 'createTime', width: 180 },
    { title: '操作', valueType: 'option', fixed: 'right', width: 150, render: (_, row) => <Space><Button type="link" onClick={() => setDetail(row)}>详情</Button>{row.status === 'PENDING' && <Button type="link" onClick={() => { decisionForm.resetFields(); setDecision(row) }}>确认</Button>}</Space> },
  ]
  const columns: ProColumns<HarvestBatch>[] = [
    { title: '采收批次号', dataIndex: 'batchNo', width: 190, copyable: true },
    { title: '作物', dataIndex: 'cropName', width: 140 },
    { title: '地块', dataIndex: 'plotName', width: 150 },
    { title: '采收日期', dataIndex: 'harvestDate', width: 140 },
    { title: '批次等级', dataIndex: 'grade', width: 110 },
    { title: '检测单号（非检测结论）', dataIndex: 'inspectionNo', width: 200 },
  ]
  return <PageContainer header={{ title: '批次等级查询', subTitle: '查询正式批次等级，质量合格与否以检测台账为准' }}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="批次等级与检测结论分别管理"
        description="等级来自采收批次。正式等级复核请切换复核凭据标签，由另一位用户确认。复核只认定关联工单履约商品等级，不改写批次原值、历史订单或价格。检测合格不能由等级推断；已关联供给的批次继续受后端变更保护。"
        action={<Button onClick={() => navigate('/production/harvests')}>采收记录</Button>} />
      <Tabs activeKey={tab} onChange={setTab} items={[{ key: 'batches', label: '批次等级' }, { key: 'reviews', label: '正式复核凭据' }]} />
      {tab === 'reviews' && <>
        <Alert type="info" showIcon message="申请 → 双人确认 → 差异工单引用核销" description="仅支持生产侧处理中等级降级工单。关联同批次已完成且合格的检测单，复核等级须低于原等级。不合格检测继续走冻结及召回流程；退款、补差价由交易域另行执行。" />
        <ProTable<GradeReview> key={`reviews:${scope}:${ticketId ?? ''}`} actionRef={actionRef} rowKey="id" columns={reviewColumns} search={false}
          params={{ subjectId, ticketId }} columnWidthStorageKey="quality-grade-reviews" scroll={SCROLL_BY_CONTENT}
          options={{ reload: true, density: true, setting: true }} pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          toolBarRender={() => [<Button key="apply" type="primary" disabled={!scope} onClick={() => { form.resetFields(); form.setFieldsValue({ ticketId }); setOpen(true) }}>申请等级复核</Button>]}
          request={async p => { if (!current()) return { data: [], total: 0, success: false }; const result = await pageGradeReviews({ pageNum: p.current ?? 1, pageSize: p.pageSize ?? 20, ticketId }); return current() ? { data: result.list, total: result.total, success: true } : { data: [], total: 0, success: false } }} />
      </>}
      {tab === 'batches' && (!farmId ? <Alert type="warning" message="请先选择农场后查询批次等级" /> :
        <ProTable<HarvestBatch> key={`${subjectId}:${farmId}`} rowKey="batchId" columns={columns}
          params={{ subjectId, farmId }} columnWidthStorageKey="quality-batch-grades"
          scroll={SCROLL_BY_CONTENT} search={false} options={{ reload: true, density: true, setting: true }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          request={async p => {
            const result = await listHarvests({ farmId, pageNum: p.current ?? 1, pageSize: p.pageSize ?? 20 })
            return { data: result.list, total: result.total, success: true }
          }} />)}
    </Space>
    <Modal title="申请正式等级复核" open={open} confirmLoading={busy} okButtonProps={{ disabled: selectionBusy || !!selectionError || !selectedTicket || !selectedInspection }} onCancel={() => { if (!busy) setOpen(false) }} onOk={() => void save(false)}>
      <Form form={form} layout="vertical">
        <Form.Item name="ticketId" label="等级降级工单" rules={[{ required: true, message: '请选择待复核工单' }]}>
          <Select showSearch allowClear optionFilterProp="label" loading={tickets.isFetching} placeholder="搜索工单号、订单号或供给单号"
            onChange={() => form.setFieldsValue({ inspectionId: undefined, reviewedGrade: undefined })}
            options={(tickets.data ?? []).map(row => ({ value: String(row.id), label: `${row.ticketNo} · 订单 ${row.orderNo} · ${row.offerNo}` }))}
            notFoundContent={tickets.isFetching ? '正在加载工单…' : tickets.isError ? '加载失败，请重试' : '暂无生产侧处理中等级降级工单'} />
        </Form.Item>
        {selectedTicketId && !tickets.isFetching && !tickets.isError && !selectedTicket && <Alert type="warning" showIcon message="原工单已不满足申请条件，请重新选择工单" />}
        {selectedTicket && <Alert type="info" showIcon message={offer.isFetching ? '正在解析关联采收批次…' : `关联批次：${offer.data?.batchNo || batchId || '未取得'}`}
          description="仅列出该批次已完成且合格的检测单。切换工单将清空检测依据。" />}
        {selectionError && <Alert type="error" showIcon message="检测依据加载失败" description={selectionError instanceof Error ? selectionError.message : '未取得完整选项，请重试'} action={<Button onClick={retrySelection}>重试</Button>} />}
        <Form.Item name="inspectionId" label="检测依据" rules={[{ required: true, message: '请选择同批次已完成合格检测单' }]}>
          <Select showSearch allowClear optionFilterProp="label" loading={inspections.isFetching} disabled={!selectedTicket || !batchId || !!selectionError || offer.isFetching}
            placeholder={selectedTicket ? '搜索检测单号、机构或抽样时间' : '请先选择等级降级工单'}
            options={(inspections.data ?? []).map(row => ({ value: String(row.inspectionId), label: `${row.inspectionNo || row.inspectionId} · ${row.labName || '未登记机构'} · ${row.sampleAt || '未登记抽样时间'} · 已完成·合格` }))}
            notFoundContent={inspections.isFetching ? '正在加载检测单…' : '该批次暂无已完成且合格的检测单，请先完成质量检测'} />
        </Form.Item>
        {selectedInspection && <Alert type="success" showIcon message={`已选检测单：${selectedInspection.inspectionNo || selectedInspection.inspectionId}`}
          description={`批次：${selectedInspection.batchNo || offer.data?.batchNo || batchId}；机构：${selectedInspection.labName || '未登记'}；抽样时间：${selectedInspection.sampleAt || '未登记'}；已完成·合格。提交时服务端将重新核验。`} />}

        <Form.Item name="reviewedGrade" label="履约商品复核等级" rules={[{ required: true }]}><Select options={['B', 'C', 'D'].map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="reason" label="复核依据及适用范围" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
    <Modal title={`复核确认 ${decision?.reviewNo ?? ''}`} open={!!decision} confirmLoading={busy} onCancel={() => { if (!busy) setDecision(null) }} onOk={() => void save(true)}>
      <Alert type="info" message="申请人不能确认自己的申请；确认后不可修改。" />
      {decision && <p>{decision.ticketNo}：{decision.originalGrade} → {decision.reviewedGrade}；依据：{decision.reason}</p>}
      <Form form={decisionForm} layout="vertical">
        <Form.Item name="approved" label="决定" rules={[{ required: true }]}><Select options={[{ value: true, label: '确认通过' }, { value: false, label: '驳回' }]} /></Form.Item>
        <Form.Item name="remark" label="确认意见" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
    <Drawer title="正式等级复核凭据" open={!!detail} onClose={() => setDetail(null)} width={760}>
      {detail && <DetailInfoGrid items={Object.entries({ 复核单号: detail.reviewNo, 工单号: detail.ticketNo, 供给单号: detail.offerNo, 订单号: detail.orderNo, 批次ID: detail.batchId, 原等级: detail.originalGrade, 复核等级: detail.reviewedGrade, 检测单号: detail.inspectionNo, 检测单ID: detail.inspectionId, 状态: labels[detail.status], 申请人: detail.applicantId, 确认人: detail.reviewerId, 申请时间: detail.createTime, 确认时间: detail.reviewedAt, 核销时间: detail.consumedAt, 复核依据: detail.reason, 确认意见: detail.reviewRemark }).map(([label, value]) => ({ label, value }))} />}
    </Drawer>
  </PageContainer>
}
