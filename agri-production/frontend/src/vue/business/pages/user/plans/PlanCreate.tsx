import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import '@/components/ProductionDetailCompact.css';
import { useNavigate, useParams, useSearchParams } from '@/vue/router';
import { useQuery, useQueryClient } from '@/vue/query';
import { App, Button, Result, Space } from '@/vue/ui';
import { ProForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@/vue/pro';
import dayjs from 'dayjs';
import { PageContainer as PageContainer } from '@/vue/pro';
import SectionCard from '@/vue/business/components/SectionCard';
import useFarmStore from '@/vue/farmStore';
import { listCropOptions } from '@/api/crops';
import { listPlots } from '@/api/plots';
import { getPlan } from '@/api/plans';
import { createPlanInfo, updatePlanInfo, fetchMembers } from '@/api/production-view';
import { PLAN_STATUS_OPTIONS } from '@/utils/production-adapter';
const PlanCreate = defineComponent({
  name: "PlanCreate",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const {
      message
    } = App.useApp();
    const queryClient = useQueryClient();
    const [params] = useSearchParams();
    const _params = useParams<{
      planId: string;
    }>();
    const isEditing = computed(() => Boolean(_params.planId));
    const returnTo = computed(() => isEditing.value && params.value.get('from') === 'detail' ? `/production/plans/${_params.planId}` : '/production/plans');
    const currentFarm = useFarmStore(state => state.currentFarm);
    const copyId = computed(() => params.value.get('copyFrom'));
    const [form] = ProForm.useForm();
    const crops = useQuery(() => ({
      queryKey: ['crop-options'],
      queryFn: () => listCropOptions()
    }));
    const cropOptions = computed(() => (crops.data ?? []).map(c => ({
      label: c.cropName,
      value: c.cropId
    })));
    const sourceId = computed(() => _params.planId || copyId.value);
    const source = useQuery(() => ({
      queryKey: ['plan-form-source', sourceId.value],
      enabled: Boolean(sourceId.value),
      queryFn: () => getPlan(sourceId.value!),
      retry: false
    }));
    const farmId = computed(() => source.data?.farmId || (isEditing.value ? undefined : params.value.get('farmId') || currentFarm.value?.farmId));
    onMounted(() => {
      watch(() => [source.data, crops.data, form, isEditing.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const p = source.data;
          if (!p) return;
          form.setFieldsValue({
            planCode: isEditing.value ? p.planNo : undefined,
            planName: isEditing.value ? p.planName : `${p.planName}（副本）`,
            plotId: p.plotId,
            cropId: p.cropId || crops.data?.find(c => c.cropName === p.cropName)?.cropId,
            cropVariety: p.cropVariety,
            planStartDate: p.startDate,
            planEndDate: p.endDate,
            expectedYield: p.expectedYield,
            planArea: p.planArea,
            ownerId: p.managerId,
            remark: p.remark,
            status: isEditing.value ? p.status : 1
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const loadPlotOptions = async () => {
      if (!farmId.value) return [];
      const page = await listPlots({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 200,
        status: 1
      });
      return page.list.map(p => ({
        label: p.plotName,
        value: p.plotId
      }));
    };
    const loadMemberOptions = async () => {
      if (!farmId.value) return [];
      const page = await fetchMembers({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 200
      });
      return page.list.filter(m => m.id).map(m => ({
        label: m.realName,
        value: m.id!
      }));
    };
    return () => {
      if (source.isError) return <PageContainer title={isEditing.value ? '编辑农事计划' : '复用历史农事计划'}><Result status="error" title="计划读取失败" subTitle={(source.error as Error).message} extra={<Space><Button onClick={() => void source.refetch()}>重试</Button><Button onClick={() => navigate(returnTo.value)}>返回</Button></Space>} /></PageContainer>;
      return <PageContainer mobileForm title={isEditing.value ? '编辑农事计划' : copyId.value ? '复用历史农事计划' : '新建农事计划'} class="production-detail-compact" extra={<Button onClick={() => navigate(returnTo.value)}>{returnTo.value.endsWith(_params.planId || '__new__') ? '返回计划详情' : '返回计划列表'}</Button>}>
    <SectionCard title="计划信息" loading={Boolean(sourceId.value && source.isLoading)}>
      <ProForm scrollToFirstError form={form} grid colProps={{
            xs: 24,
            md: 12
          }} rowProps={{
            gutter: 24
          }} layout="horizontal" labelCol={{
            flex: '112px'
          }} wrapperCol={{
            flex: 1
          }} initialValues={{
            plotId: params.value.get('plotId') || undefined,
            cropId: params.value.get('cropId') || undefined,
            cropVariety: params.value.get('cropVariety') || undefined,
            status: 1
          }} submitter={{
            render: (_, buttons) => <Space class="production-form-actions">{buttons}<Button onClick={() => navigate(returnTo.value)}>取消</Button></Space>,
            searchConfig: {
              submitText: isEditing.value ? '保存修改' : '创建计划',
              resetText: '重置'
            }
          }} onFinish={async (value: Parameters<typeof createPlanInfo>[0]) => {
            if (sourceId.value && !source.data) return false;
            if (!farmId.value) {
              message.warning('请先选择农场');
              return false;
            }
            if (dayjs(value.planEndDate).isBefore(dayjs(value.planStartDate))) {
              message.warning('结束日期不能早于开始日期');
              return false;
            }
            try {
              if (_params.planId) await updatePlanInfo(_params.planId, {
                ...value,
                farmId: farmId.value
              });else await createPlanInfo({
                ...value,
                farmId: farmId.value,
                status: value.status ?? 1
              });
              await queryClient.invalidateQueries({
                queryKey: ['plan-list']
              });
              await queryClient.invalidateQueries({
                queryKey: ['plan-detail', _params.planId]
              });
              await queryClient.invalidateQueries({
                queryKey: ['plan-form-source']
              });
              message.success(isEditing.value ? '农事计划已更新' : '农事计划已创建');
              navigate(returnTo.value);
              return true;
            } catch (e) {
              message.error((e as Error).message || (isEditing.value ? '更新失败' : '创建失败'));
              return false;
            }
          }}>
        <ProFormText name="planName" label="计划名称" placeholder="如：2026 春季番茄种植计划" rules={[{
              required: true,
              message: '请输入计划名称'
            }, {
              max: 50,
              message: '计划名称不超过 50 个字符'
            }]} />
        <ProFormText name="planCode" label="计划编码" readonly={isEditing.value} placeholder="留空由系统自动生成（同主体内唯一）" />
        <ProFormSelect name="cropId" label="作物" placeholder="从作物主数据里选择" showSearch allowClear rules={[{
              required: true,
              message: '请选择或输入作物'
            }]} fieldProps={{
              optionFilterProp: 'label'
            }} options={cropOptions.value} extra="取自作物主数据（由平台运营维护）；缺作物请联系平台运营添加" />
        <ProFormText name="cropVariety" label="作物品种" placeholder="如：中杂9号" />
        <ProFormSelect name="plotId" label="关联地块" placeholder="选择地块（可不选）" showSearch allowClear fieldProps={{
              optionFilterProp: 'label'
            }} params={{
              farmId: farmId.value
            }} request={loadPlotOptions} extra="取自本农场启用中的地块；同一地块同一时期只允许一个在种计划" />
        <ProFormDatePicker name="planStartDate" label="计划开始日期" rules={[{
              required: true,
              message: '请选择计划开始日期'
            }]} />
        <ProFormDatePicker name="planEndDate" label="计划结束日期" rules={[{
              required: true,
              message: '请选择计划结束日期'
            }]} />
        <ProFormDigit name="expectedYield" label="预计产量(kg)" min={0} fieldProps={{
              precision: 0
            }} />
        <ProFormDigit name="planArea" label="计划种养面积(亩)" min={0} fieldProps={{
              precision: 2
            }} extra="本计划打算种养的面积；不填则留空（不拿地块面积顶替）" />
        <ProFormSelect name="ownerId" label="负责人" placeholder="选择本农场团队成员（可不选）" showSearch allowClear fieldProps={{
              optionFilterProp: 'label'
            }} params={{
              farmId: farmId.value
            }} request={loadMemberOptions} />
        <ProFormSelect name="status" label="计划状态" options={PLAN_STATUS_OPTIONS} initialValue={1} />
        <ProFormTextArea colProps={{
              span: 24
            }} name="remark" label="备注" placeholder="补充说明，200 字以内" />

      </ProForm>
    </SectionCard>
  </PageContainer>;
    };
  }
});
export default PlanCreate;
