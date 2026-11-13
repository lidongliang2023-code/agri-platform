import '@/components/ProductionDetailCompact.css'
import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Result, Space } from 'antd'
import { ProForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import dayjs from 'dayjs'
import PageContainer from '@/components/ProductionPageContainer'
import SectionCard from '@/components/SectionCard'
import useFarmStore from '@/store/farm'
import { listCropOptions } from '@/api/crops'
import { listPlots } from '@/api/plots'
import { getPlan } from '@/api/plans'
import { createPlanInfo, updatePlanInfo, fetchMembers } from '@/api/production-view'
import { PLAN_STATUS_OPTIONS } from '@/utils/production-adapter'

export default function PlanCreate(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { planId } = useParams<{ planId: string }>()
  const isEditing = Boolean(planId)
  const returnTo = isEditing && params.get('from') === 'detail' ? `/production/plans/${planId}` : '/production/plans'
  const currentFarm = useFarmStore(state => state.currentFarm)
  const copyId = params.get('copyFrom')
  const [form] = ProForm.useForm()
  const crops = useQuery({ queryKey: ['crop-options'], queryFn: () => listCropOptions() })
  const cropOptions = (crops.data ?? []).map(c => ({ label: c.cropName, value: c.cropId }))
  const sourceId = planId || copyId
  const source = useQuery({ queryKey: ['plan-form-source', sourceId], enabled: Boolean(sourceId), queryFn: () => getPlan(sourceId!), retry: false })
  const farmId = source.data?.farmId || (isEditing ? undefined : params.get('farmId') || currentFarm?.farmId)
  useEffect(() => {
    const p = source.data
    if (!p) return
    form.setFieldsValue({ planCode: isEditing ? p.planNo : undefined, planName: isEditing ? p.planName : `${p.planName}（副本）`, plotId: p.plotId,
      cropId: p.cropId || crops.data?.find(c => c.cropName === p.cropName)?.cropId,
      cropVariety: p.cropVariety, planStartDate: p.startDate, planEndDate: p.endDate,
      expectedYield: p.expectedYield, planArea: p.planArea, ownerId: p.managerId, remark: p.remark, status: isEditing ? p.status : 1 })
  }, [source.data, crops.data, form, isEditing])
  const loadPlotOptions = async () => {
    if (!farmId) return []
    const page = await listPlots({ farmId, pageNum: 1, pageSize: 200, status: 1 })
    return page.list.map(p => ({ label: p.plotName, value: p.plotId }))
  }
  const loadMemberOptions = async () => {
    if (!farmId) return []
    const page = await fetchMembers({ farmId, pageNum: 1, pageSize: 200 })
    return page.list.filter(m => m.id).map(m => ({ label: m.realName, value: m.id! }))
  }
  if (source.isError) return <PageContainer title={isEditing ? '编辑农事计划' : '复用历史农事计划'}><Result status="error" title="计划读取失败" subTitle={(source.error as Error).message} extra={<Space><Button onClick={() => void source.refetch()}>重试</Button><Button onClick={() => navigate(returnTo)}>返回</Button></Space>} /></PageContainer>
  return <PageContainer mobileForm title={isEditing ? '编辑农事计划' : copyId ? '复用历史农事计划' : '新建农事计划'} className="production-detail-compact"
    extra={<Button onClick={() => navigate(returnTo)}>{returnTo.endsWith(planId || '__new__') ? '返回计划详情' : '返回计划列表'}</Button>}>
    <SectionCard title="计划信息" loading={Boolean(sourceId && source.isLoading)}>
      <ProForm scrollToFirstError form={form} grid colProps={{ xs: 24, md: 12 }} rowProps={{ gutter: 24 }} layout="horizontal"
        labelCol={{ flex: '112px' }} wrapperCol={{ flex: 1 }}
        initialValues={{ plotId: params.get('plotId') || undefined, cropId: params.get('cropId') || undefined,
          cropVariety: params.get('cropVariety') || undefined, status: 1 }}
        submitter={{ render: (_, buttons) => <Space className="production-form-actions">{buttons}<Button onClick={() => navigate(returnTo)}>取消</Button></Space>, searchConfig: { submitText: isEditing ? '保存修改' : '创建计划', resetText: '重置' } }}
        onFinish={async value => {
          if (sourceId && !source.data) return false
          if (!farmId) { message.warning('请先选择农场'); return false }
          if (dayjs(value.planEndDate).isBefore(dayjs(value.planStartDate))) { message.warning('结束日期不能早于开始日期'); return false }
          try {
            if (planId) await updatePlanInfo(planId, { ...value, farmId })
            else await createPlanInfo({ ...value, farmId, status: value.status ?? 1 })
            await queryClient.invalidateQueries({ queryKey: ['plan-list'] })
            await queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] })
            await queryClient.invalidateQueries({ queryKey: ['plan-form-source'] })
            message.success(isEditing ? '农事计划已更新' : '农事计划已创建'); navigate(returnTo); return true
          } catch (e) { message.error((e as Error).message || (isEditing ? '更新失败' : '创建失败')); return false }
        }}>
        <ProFormText
          name="planName"
          label="计划名称"
          placeholder="如：2026 春季番茄种植计划"
          rules={[
            { required: true, message: '请输入计划名称' },
            { max: 50, message: '计划名称不超过 50 个字符' },
          ]}
        />
        <ProFormText name="planCode" label="计划编码" readonly={isEditing} placeholder="留空由系统自动生成（同主体内唯一）" />
        <ProFormSelect
          name="cropId"
          label="作物"
          placeholder="从作物主数据里选择"
          showSearch
          allowClear
          rules={[{ required: true, message: '请选择或输入作物' }]}
          fieldProps={{ optionFilterProp: 'label' }}
          options={cropOptions}
          extra="取自作物主数据（由平台运营维护）；缺作物请联系平台运营添加"
        />
        <ProFormText name="cropVariety" label="作物品种" placeholder="如：中杂9号" />
        <ProFormSelect
          name="plotId"
          label="关联地块"
          placeholder="选择地块（可不选）"
          showSearch
          allowClear
          fieldProps={{ optionFilterProp: 'label' }}
          params={{ farmId }} request={loadPlotOptions}
          extra="取自本农场启用中的地块；同一地块同一时期只允许一个在种计划"
        />
        <ProFormDatePicker
          name="planStartDate"
          label="计划开始日期"
          rules={[{ required: true, message: '请选择计划开始日期' }]}
        />
        <ProFormDatePicker
          name="planEndDate"
          label="计划结束日期"
          rules={[{ required: true, message: '请选择计划结束日期' }]}
        />
        <ProFormDigit
          name="expectedYield"
          label="预计产量(kg)"
          min={0}
          fieldProps={{ precision: 0 }}
        />
        <ProFormDigit
          name="planArea"
          label="计划种养面积(亩)"
          min={0}
          fieldProps={{ precision: 2 }}
          extra="本计划打算种养的面积；不填则留空（不拿地块面积顶替）"
        />
        <ProFormSelect
          name="ownerId"
          label="负责人"
          placeholder="选择本农场团队成员（可不选）"
          showSearch
          allowClear
          fieldProps={{ optionFilterProp: 'label' }}
          params={{ farmId }} request={loadMemberOptions}
        />
        <ProFormSelect name="status" label="计划状态" options={PLAN_STATUS_OPTIONS} initialValue={1} />
        <ProFormTextArea colProps={{ span: 24 }} name="remark" label="备注" placeholder="补充说明，200 字以内" />

      </ProForm>
    </SectionCard>
  </PageContainer>
}
