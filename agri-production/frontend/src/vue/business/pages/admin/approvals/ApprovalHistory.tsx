import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/components/ProductionListDense.css';
import { Alert, Button, Drawer, Form, Input, Select, Space, Tag } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate } from '@/vue/router';
import { PageContainer } from '@/vue/pro';
import Card from '@/vue/business/components/SectionCard';
import Table from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { listApprovals } from '@/api/admin/approvals';
import type { Approval } from '@/types';
import '@/pages/admin/approvals/../quality/QualityCompact.css';
const types: Record<string, string> = {
  PLAN: '农事计划',
  CERT: '历史认证申请',
  RECALL: '历史召回申请',
  QUOTA: '历史配额申请'
};
const states: Record<string, string> = {
  PENDING: '原待审（已停办）',
  APPROVED: '原已通过',
  REJECTED: '原已驳回',
  WITHDRAWN: '原已撤回'
};
const time = (v?: string) => v ? v.replace('T', ' ').slice(0, 19) : '—';
const ApprovalHistory = defineComponent({
  name: "ApprovalHistory",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const form = Form.useForm();
    const filters = shallowRef<{
      keyword?: string;
      approvalType?: string;
      status?: number;
    }>({});
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const page = shallowRef({
      pageNum: 1,
      pageSize: 20
    });
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const detail = shallowRef<Approval>();
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const query = useQuery(() => ({
      queryKey: ['approval-archive', filters.value, page.value],
      queryFn: () => listApprovals({
        ...filters.value,
        ...page.value
      }),
      retry: false
    }));
    return () => {
      return <PageContainer class="quality-workbench production-list-dense production-member-list" title="历史审批档案" subTitle="保留原单据，不作为当前身份、计划、质量或配额状态依据" extra={<Button onClick={() => navigate('/admin/production/approvals')}>业务办理入口</Button>}>
 <Space direction="vertical" size={10} style={{
          width: '100%'
        }}>
 <Alert showIcon type="warning" message="历史记录仅供核查，原待审单已停止办理；需要办理时请在对应模块核实并提交真实业务申请。" />
 {query.isError && <Alert type="error" showIcon message="历史档案加载失败" description={String(query.error)} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
 <Card class="production-dense-filter-card"><Form form={form} class="production-filter-grid" onFinish={values => {
              setFilters(values);
              setPage(p => ({
                ...p,
                pageNum: 1
              }));
            }}>
 <Form.Item name="keyword" label="关键词"><Input allowClear placeholder="审批编号、标题或申请人" /></Form.Item>
 <Form.Item name="approvalType" label="业务类型"><Select allowClear placeholder="全部" options={Object.entries(types).map(([value, label]) => ({
                  value,
                  label
                }))} /></Form.Item>
 <Form.Item name="status" label="原单状态"><Select allowClear placeholder="全部" options={[{
                  value: 1,
                  label: states.PENDING
                }, {
                  value: 2,
                  label: states.APPROVED
                }, {
                  value: 3,
                  label: states.REJECTED
                }, {
                  value: 4,
                  label: states.WITHDRAWN
                }]} /></Form.Item>
 <Form.Item class="production-filter-actions"><Space size={8}><Button onClick={() => {
                    form.resetFields();
                    setFilters({});
                    setPage(p => ({
                      ...p,
                      pageNum: 1
                    }));
                  }}>重置</Button><Button type="primary" htmlType="submit" loading={query.isFetching}>查询</Button></Space></Form.Item>
 </Form></Card>
 <Card><Table rowKey="approvalId" memberListToolbar rowSelection={{}} cardProps={false} headerTitle="历史单据" search={false} loading={query.isFetching} dataSource={query.data?.list ?? []} scroll={{
              x: 1000
            }} options={{
              reload: () => {
                void query.refetch();
              }
            }} pagination={{
              current: page.value.pageNum,
              pageSize: page.value.pageSize,
              total: query.data?.total ?? 0,
              showSizeChanger: true,
              onChange: (pageNum, pageSize) => setPage({
                pageNum,
                pageSize
              })
            }} columns={[{
              title: '审批编号',
              dataIndex: 'approvalId',
              width: 180
            }, {
              title: '事项',
              dataIndex: 'title',
              width: 240
            }, {
              title: '类型',
              dataIndex: 'bizType',
              render: (_, r) => types[r.bizType ?? ''] ?? r.bizType ?? '—'
            }, {
              title: '主体标识',
              dataIndex: 'tenantId',
              width: 140
            }, {
              title: '申请人',
              dataIndex: 'applicantName'
            }, {
              title: '原单状态',
              dataIndex: 'status',
              width: 160,
              render: (_, r) => <Tag>{states[String(r.status).toUpperCase()] ?? String(r.status)}</Tag>
            }, {
              title: '提交时间',
              dataIndex: 'submitAt',
              width: 170,
              render: (_, r) => time(r.submitAt ?? r.submittedAt)
            }, {
              title: '操作',
              valueType: 'option',
              width: 100,
              render: (_, r) => <ListRowActions items={[<Button key="view" type="link" size="small" onClick={() => setDetail(r as Approval)}>查看</Button>]} />
            }]} /></Card></Space>
 <Drawer title="历史审批详情" class="quality-dialog quality-detail" open={!!detail.value} width={760} onClose={() => setDetail(undefined)}>
 {detail.value && <DetailInfoGrid items={[{
            label: '审批编号',
            value: detail.value.approvalId
          }, {
            label: '原单状态',
            value: states[String(detail.value.status).toUpperCase()] ?? String(detail.value.status)
          }, {
            label: '事项',
            value: detail.value.title,
            fullWidth: true
          }, {
            label: '业务类型',
            value: types[detail.value.bizType ?? ''] ?? detail.value.bizType
          }, {
            label: '主体标识',
            value: detail.value.tenantId
          }, {
            label: '关联业务标识',
            value: detail.value.bizId
          }, {
            label: '申请人',
            value: detail.value.applicantName
          }, {
            label: '原审批人标识',
            value: detail.value.currentApproverId
          }, {
            label: '提交时间',
            value: time(detail.value.submitAt ?? detail.value.submittedAt)
          }, {
            label: '审批时间',
            value: time(detail.value.approveAt ?? detail.value.approvedAt)
          }, {
            label: '原审批意见',
            value: detail.value.approveOpinion ?? detail.value.approveRemark,
            fullWidth: true
          }]} />}
 </Drawer></PageContainer>;
    };
  }
});
export default ApprovalHistory;
