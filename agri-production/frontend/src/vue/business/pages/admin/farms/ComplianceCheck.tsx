import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/pages/admin/farms/FarmSupervisionCompact.css';
import { useNavigate, useSearchParams } from '@/vue/router';
import { useQuery } from '@/vue/query';
import { Button, Space, Typography } from '@/vue/ui';
import { PageContainer } from '@/vue/pro';
import FarmRectificationPanel from '@/vue/business/components/FarmRectificationPanel';
import { supervisionDetail } from '@/api/admin/farm-supervision';
const ComplianceCheck = defineComponent({
  name: "ComplianceCheck",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const farmId = computed(() => params.value.get('farmId') || undefined);
    const query = useQuery(() => ({
      queryKey: ['supervision-detail', farmId.value],
      queryFn: () => supervisionDetail(farmId.value!),
      enabled: !!farmId.value,
      retry: false
    }));
    return () => {
      return <PageContainer class="farm-supervision-compact" title="合规检查与整改" subTitle={query.data?.farm.farmName || '检查、整改与复核共用生产业务台账'} onBack={farmId.value ? () => navigate(`/admin/production/farms/${farmId.value}`) : undefined} extra={farmId.value ? <Button onClick={() => navigate(`/admin/production/farms/${farmId.value}`)}>返回监管详情</Button> : undefined}>
    {farmId.value && <Space wrap style={{
          marginBottom: 12
        }}><Typography.Text type="secondary">当前农场：{query.data?.farm.farmName || farmId.value}</Typography.Text><Button type="link" onClick={() => navigate('/admin/production/farms/compliance')}>查看全部检查</Button></Space>}
    <FarmRectificationPanel farmId={farmId.value} />
  </PageContainer>;
    };
  }
});
export default ComplianceCheck;
