import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
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
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import { useQuery } from '@/vue/query';
import { Alert, App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Tabs, Tag } from '@/vue/ui';
import type { ProColumns } from '@/vue/pro';
import dayjs from 'dayjs';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { PageContainer as PageContainer } from '@/vue/pro';
import ProTable from '@/vue/ProductionRequestTable';
import useAuthStore from '@/vue/authStore';
import useFarmStore from '@/vue/farmStore';
import { deleteReport, exportReport, generateReport, listReports, listReportSubscriptions, unsubscribeReport } from '@/api/analytics';
import type { ReportSubscription } from '@/api/analytics';
import type { ReportItem } from '@/types';
const TYPES = ['日报', '周报', '月报', '季报', '年报'].map((label, i) => ({
  label,
  value: i + 1
}));
const ProductionReports = defineComponent({
  name: "ProductionReports",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const subject = useAuthStore(s => s.userInfo?.tenantId);
    return () => {
      return <ReportContent key={String(subject.value ?? '')} subject={String(subject.value ?? '')} />;
    };
  }
});
export default ProductionReports;
const ReportContent = defineComponent({
  name: "ReportContent",
  props: {
    subject: null as unknown as PropType<{
      subject: string;
    }["subject"]>
  },
  setup(__props: {
    subject: string;
  }, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const farm = useFarmStore(s => s.currentFarm);
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const size = shallowRef(20);
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const draftType = shallowRef<number>();
    const setDraftType = (next: typeof draftType.value | ((previous: typeof draftType.value) => typeof draftType.value)) => {
      draftType.value = typeof next === 'function' ? (next as (previous: typeof draftType.value) => typeof draftType.value)(draftType.value) : next;
    };
    const draftPeriod = shallowRef('');
    const setDraftPeriod = (next: typeof draftPeriod.value | ((previous: typeof draftPeriod.value) => typeof draftPeriod.value)) => {
      draftPeriod.value = typeof next === 'function' ? (next as (previous: typeof draftPeriod.value) => typeof draftPeriod.value)(draftPeriod.value) : next;
    };
    const reportType = shallowRef<number>();
    const setType = (next: typeof reportType.value | ((previous: typeof reportType.value) => typeof reportType.value)) => {
      reportType.value = typeof next === 'function' ? (next as (previous: typeof reportType.value) => typeof reportType.value)(reportType.value) : next;
    };
    const period = shallowRef('');
    const setPeriod = (next: typeof period.value | ((previous: typeof period.value) => typeof period.value)) => {
      period.value = typeof next === 'function' ? (next as (previous: typeof period.value) => typeof period.value)(period.value) : next;
    };
    const selectedReportKeys = shallowRef<(string | number)[]>([]);
    const setSelectedReportKeys = (next: typeof selectedReportKeys.value | ((previous: typeof selectedReportKeys.value) => typeof selectedReportKeys.value)) => {
      selectedReportKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedReportKeys.value) => typeof selectedReportKeys.value)(selectedReportKeys.value) : next;
    };
    const selectedSubKeys = shallowRef<(string | number)[]>([]);
    const setSelectedSubKeys = (next: typeof selectedSubKeys.value | ((previous: typeof selectedSubKeys.value) => typeof selectedSubKeys.value)) => {
      selectedSubKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedSubKeys.value) => typeof selectedSubKeys.value)(selectedSubKeys.value) : next;
    };
    const open = shallowRef(false);
    const setOpen = (next: typeof open.value | ((previous: typeof open.value) => typeof open.value)) => {
      open.value = typeof next === 'function' ? (next as (previous: typeof open.value) => typeof open.value)(open.value) : next;
    };
    const busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const rowBusy = shallowRef('');
    const setRowBusy = (next: typeof rowBusy.value | ((previous: typeof rowBusy.value) => typeof rowBusy.value)) => {
      rowBusy.value = typeof next === 'function' ? (next as (previous: typeof rowBusy.value) => typeof rowBusy.value)(rowBusy.value) : next;
    };
    const [form] = Form.useForm<{
      reportType: number;
      period: dayjs.Dayjs;
    }>();
    const current = () => String(useAuthStore.getState().userInfo?.tenantId ?? '') === __props.subject;
    const list = useQuery(() => ({
      queryKey: ['reports', __props.subject, page.value, size.value, reportType.value, period.value],
      queryFn: () => listReports({
        pageNum: page.value,
        pageSize: size.value,
        reportType: reportType.value,
        period: period.value || undefined
      }),
      enabled: !!__props.subject,
      retry: false
    }));
    const subscriptions = useQuery(() => ({
      queryKey: ['report-subscriptions', __props.subject],
      queryFn: listReportSubscriptions,
      enabled: !!__props.subject,
      retry: false
    }));
    const submit = async () => {
      let values: {
        reportType: number;
        period: dayjs.Dayjs;
      };
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      setBusy(true);
      let written = false;
      try {
        if (!current()) return;
        const result = await generateReport({
          reportType: values.reportType,
          period: values.period.format('YYYY-MM-DD'),
          farmId: farm.value?.farmId
        });
        written = true;
        if (!current()) return;
        const readback = await listReports({
          pageNum: 1,
          pageSize: 20,
          period: result.period
        });
        if (!readback.list.some(row => row.reportId === result.reportId)) throw new Error('生成请求已成功，但列表回读未找到该报表，请刷新核对');
        setOpen(false);
        setPage(1);
        await list.refetch();
        message.success('报表已生成并回读确认');
      } catch (e) {
        if (current()) message.error(`${written ? '生成后核验未完成：' : '生成失败：'}${(e as Error).message}`);
      } finally {
        if (current()) setBusy(false);
      }
    };
    const remove = async (id: string) => {
      setRowBusy(id);
      try {
        if (!(await deleteReport(id))) throw new Error('服务端未确认删除');
        if (current()) {
          await list.refetch();
          message.success('报表已删除');
        }
      } catch (e) {
        if (current()) message.error((e as Error).message);
      } finally {
        if (current()) setRowBusy('');
      }
    };
    const download = async (id: string) => {
      setRowBusy(id);
      try {
        const result = await exportReport(id);
        if (!current()) return;
        const url = new URL(result.fileUrl, window.location.origin);
        if (url.origin !== window.location.origin || !/\/analytics\/reports\/[^/]+\/file$/.test(url.pathname)) throw new Error('导出地址不符合本站报表下载规则');
        const anchor = document.createElement('a');
        anchor.href = url.href;
        anchor.download = '';
        anchor.click();
      } catch (e) {
        if (current()) message.error(`导出失败：${(e as Error).message}`);
      } finally {
        if (current()) setRowBusy('');
      }
    };
    const columns = computed<ProColumns<ReportItem>[]>(() => [{
      title: '报表名称',
      dataIndex: 'reportName',
      width: 260,
      ellipsis: true
    }, {
      title: '类型',
      dataIndex: 'reportType',
      width: 100,
      render: (_, r) => TYPES.find(t => t.value === r.reportType)?.label ?? '—'
    }, {
      title: '统计周期',
      dataIndex: 'period',
      width: 180
    }, {
      title: '生成时间',
      dataIndex: 'generatedAt',
      width: 185
    }, {
      title: '生成人',
      dataIndex: 'generatorName',
      width: 140,
      render: (value: any) => value || '未记录'
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, r) => <Tag color={r.status === 2 ? 'success' : 'default'}>{r.status === 2 ? '已生成' : r.status === 3 ? '失败' : '生成中'}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, r) => <ListRowActions><Button key="download" type="link" size="small" disabled={r.status !== 2 || !!rowBusy.value} onClick={() => void download(r.reportId)}>下载 CSV</Button><Popconfirm key="delete" title="删除这份报表记录？" onConfirm={() => remove(r.reportId)}><Button type="link" size="small" danger disabled={!!rowBusy.value}>删除</Button></Popconfirm></ListRowActions>
    }]);
    const subColumns = computed<ProColumns<ReportSubscription>[]>(() => [{
      title: '报表类型',
      dataIndex: 'reportType',
      width: 150,
      render: (_, r) => TYPES.find(t => t.value === r.reportType)?.label ?? '—'
    }, {
      title: '配置周期',
      dataIndex: 'period',
      width: 150
    }, {
      title: '接收人',
      dataIndex: 'receivers',
      width: 260,
      render: (_, r) => r.receivers.join('、')
    }, {
      title: '执行情况',
      key: 'execution',
      width: 240,
      render: () => '仅保存配置，自动推送未接入'
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, r) => <ListRowActions><Popconfirm key="cancel" title="取消这条历史通知配置？" onConfirm={async () => {
          try {
            if (!(await unsubscribeReport(r.subscribeId))) throw new Error('服务端未确认取消');
            await subscriptions.refetch();
            message.success('已取消');
          } catch (e) {
            message.error((e as Error).message);
          }
        }}><Button type="link" size="small" danger>取消配置</Button></Popconfirm></ListRowActions>
    }]);
    const handleSearch = () => {
      setType(draftType.value);
      setPeriod(draftPeriod.value.trim());
      setPage(1);
    };
    const handleReset = () => {
      setDraftType(undefined);
      setDraftPeriod('');
      setType(undefined);
      setPeriod('');
      setPage(1);
    };
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="生产报表" subTitle="按实际生产记录生成周期快照，按经营主体归档">
    <Space direction="vertical" size={12} style={{
          width: '100%'
        }}>
      <Alert showIcon type="info" message={`本次生成范围：${farm.value?.farmName ?? '当前主体全部农场'}；历史列表展示当前主体全部报表`} description="日报、周报、月报、季报、年报按所选日期归属周期生成；采收量统一为 kg，任务完成以验收通过为准。无实际成本和收入来源，不生成成本收益结论。历史快照不会自动重算。" />
      <Tabs items={[{
            key: 'reports',
            label: '报表归档',
            children: <Space direction="vertical" size={10} style={{
              width: '100%'
            }}>
          <Card class="production-dense-filter-card">
            <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={list.isFetching}>
              <div class="production-filter-field">
                <label>报表类型</label>
                <Select allowClear placeholder="全部类型" options={TYPES} value={draftType.value} onChange={setDraftType} />
              </div>
              <div class="production-filter-field">
                <label>名称 / 周期</label>
                <Input allowClear placeholder="搜索报表名称或周期" value={draftPeriod.value} onChange={e => setDraftPeriod(e.target.value)}  />
              </div>
            </ProductionListFilters>
          </Card>
          {list.isError && <Alert type="error" message="报表查询失败" description={(list.error as Error).message} />}
          <ProTable memberListToolbar rowKey="reportId" search={false} columns={columns.value} dataSource={list.isError ? [] : list.data?.list ?? []} loading={list.isFetching} scroll={{
                x: 1200
              }} columnWidthStorageKey="production-reports" rowSelection={{
                selectedRowKeys: selectedReportKeys.value,
                onChange: setSelectedReportKeys
              }} options={{
                reload: () => {
                  void list.refetch();
                }
              }} toolBarRender={() => [<Button key="generate" type="primary" disabled={!__props.subject} onClick={() => {
                form.setFieldsValue({
                  reportType: 3,
                  period: dayjs()
                });
                setOpen(true);
              }}>+ 生成报表</Button>]} pagination={{
                current: page.value,
                pageSize: size.value,
                total: list.data?.total ?? 0,
                showSizeChanger: true,
                onChange: (p, s) => {
                  setPage(s === size.value ? p : 1);
                  setSize(s);
                }
              }} />
        </Space>
          }, {
            key: 'subscriptions',
            label: '历史通知配置',
            children: <Space direction="vertical" size={10} style={{
              width: '100%'
            }}>
          <Alert type="warning" showIcon message="自动通知尚未接入" description="站内、邮件、微信均无自动推送执行端。本页仅查看或取消历史配置，暂不新增无执行能力的通知；请在报表归档中主动生成与下载。" />
          {subscriptions.isError && <Alert type="error" message="通知配置读取失败" description={(subscriptions.error as Error).message} />}
          <ProTable memberListToolbar rowKey="subscribeId" search={false} columns={subColumns.value} dataSource={subscriptions.isError ? [] : subscriptions.data ?? []} loading={subscriptions.isFetching} scroll={{
                x: 1000
              }} columnWidthStorageKey="report-subscriptions" rowSelection={{
                selectedRowKeys: selectedSubKeys.value,
                onChange: setSelectedSubKeys
              }} options={{
                reload: () => {
                  void subscriptions.refetch();
                }
              }} pagination={{
                defaultPageSize: 20,
                showSizeChanger: true
              }} />
        </Space>
          }]} />
    </Space>
    <Modal class="production-form-dialog" title="生成生产报表" open={open.value} confirmLoading={busy.value} closable={!busy.value} maskClosable={false} cancelButtonProps={{
          disabled: busy.value
        }} onCancel={() => setOpen(false)} onOk={() => void submit()}>
      <Alert type="info" message={`生成范围：${farm.value?.farmName ?? '当前主体全部农场'}`} style={{
            marginBottom: 16
          }} />
      <Form form={form} layout="vertical"><Form.Item name="reportType" label="报表周期" rules={[{
              required: true
            }]}><Select options={TYPES} /></Form.Item><Form.Item name="period" label="周期内任意一天" rules={[{
              required: true
            }]}><DatePicker allowClear={false} /></Form.Item></Form>
    </Modal>
  </PageContainer>;
    };
  }
});
