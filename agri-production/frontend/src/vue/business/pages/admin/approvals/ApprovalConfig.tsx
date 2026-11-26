import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/components/ProductionListDense.css';
import { Alert, Button, Collapse, Space, Tag } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate } from '@/vue/router';
import { PageContainer } from '@/vue/pro';
import Card from '@/vue/business/components/SectionCard';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import { listApprovalFlows } from '@/api/admin/approvals';
import '@/pages/admin/approvals/../quality/QualityCompact.css';
const ApprovalConfig = defineComponent({
  name: "ApprovalConfig",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const query = useQuery(() => ({
      queryKey: ['legacy-approval-flows'],
      queryFn: () => listApprovalFlows({
        pageNum: 1,
        pageSize: 200
      }),
      retry: false
    }));
    return () => {
      return <PageContainer class="quality-workbench production-list-dense production-member-list" title="历史流程配置" subTitle="旧配置未驱动真实审批执行，仅供审计查阅" extra={<Button onClick={() => navigate('/admin/production/approvals')}>业务办理入口</Button>}>
 <Space direction="vertical" size={10} style={{
          width: '100%'
        }}><Alert type="warning" showIcon message="流程设计器已停用" description="节点、条件和升级配置未接入执行引擎，不代表业务规则生效。公共认证沿用用户中心现有审核规则，计划沿用主体内部审批权限。" />
 {query.isError && <Alert type="error" message="旧配置加载失败" description={String(query.error)} />}
 <Card><BusinessRecordList memberListToolbar rowSelection={{}} toolbarTitle="旧配置档案" rowKey="flowId" loading={query.isFetching} dataSource={query.data?.list ?? []} onReload={() => void query.refetch()} pagination={{
              defaultPageSize: 20,
              showSizeChanger: true
            }} scroll={{
              x: 650
            }} columns={[{
              title: '配置编号',
              dataIndex: 'flowId',
              width: 180
            }, {
              title: '原流程名称',
              dataIndex: 'flowName',
              width: 220
            }, {
              title: '原业务类型',
              dataIndex: 'approvalType',
              width: 160
            }, {
              title: '执行状态',
              key: 'execStatus',
              width: 160,
              render: () => <Tag>已停用（只读档案）</Tag>
            }]} expandable={{
              expandedRowRender: (row: import('@/types').ApprovalFlowConfig) => <Collapse items={[{
                key: 'config',
                label: '查看原配置内容',
                children: <pre style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere'
                }}>{JSON.stringify(row, null, 2)}</pre>
              }]} />
            }} /></Card>
 </Space></PageContainer>;
    };
  }
});
export default ApprovalConfig;
