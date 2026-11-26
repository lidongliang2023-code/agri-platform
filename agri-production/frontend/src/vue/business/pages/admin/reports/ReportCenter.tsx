import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/components/ProductionListDense.css';
import { Alert, App, Button, Card, Collapse, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography } from '@/vue/ui';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { createReportTask, downloadAdminReportFile, generateAdminReportFile, getAdminReportTask, listAdminReports, type ReportTask } from '@/api/admin/reports';
import { PageContainer } from '@/vue/pro';
import ProductionTable from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { CollapsibleFilterForm } from '@/vue/business/components/CollapsibleFilterGrid';
import { PlusOutlined } from '@ant-design/icons-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { supervisionFarms } from '@/api/admin/farm-supervision';
import type { Farm } from '@/types';
const STATUS: Record<string, string> = {
  PENDING: '待生成',
  RUNNING: '生成中',
  DONE: '已生成',
  FAILED: '失败'
};
const ReportCenter = defineComponent({
  name: "ReportCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const client = useQueryClient();
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const size = shallowRef(20);
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const status = shallowRef<string>();
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const reportType = shallowRef<string>();
    const setReportType = (next: typeof reportType.value | ((previous: typeof reportType.value) => typeof reportType.value)) => {
      reportType.value = typeof next === 'function' ? (next as (previous: typeof reportType.value) => typeof reportType.value)(reportType.value) : next;
    };
    const farmId = shallowRef<string>();
    const setFarmId = (next: typeof farmId.value | ((previous: typeof farmId.value) => typeof farmId.value)) => {
      farmId.value = typeof next === 'function' ? (next as (previous: typeof farmId.value) => typeof farmId.value)(farmId.value) : next;
    };
    const range = shallowRef<[Dayjs, Dayjs] | null>(null);
    const setRange = (next: typeof range.value | ((previous: typeof range.value) => typeof range.value)) => {
      range.value = typeof next === 'function' ? (next as (previous: typeof range.value) => typeof range.value)(range.value) : next;
    };
    const searchText = shallowRef('');
    const setSearchText = (next: typeof searchText.value | ((previous: typeof searchText.value) => typeof searchText.value)) => {
      searchText.value = typeof next === 'function' ? (next as (previous: typeof searchText.value) => typeof searchText.value)(searchText.value) : next;
    };
    const draftStatus = shallowRef<string>();
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const draftType = shallowRef<string>();
    const setDraftType = (next: typeof draftType.value | ((previous: typeof draftType.value) => typeof draftType.value)) => {
      draftType.value = typeof next === 'function' ? (next as (previous: typeof draftType.value) => typeof draftType.value)(draftType.value) : next;
    };
    const draftFarm = shallowRef<string>();
    const setDraftFarm = (next: typeof draftFarm.value | ((previous: typeof draftFarm.value) => typeof draftFarm.value)) => {
      draftFarm.value = typeof next === 'function' ? (next as (previous: typeof draftFarm.value) => typeof draftFarm.value)(draftFarm.value) : next;
    };
    const draftRange = shallowRef<[Dayjs, Dayjs] | null>(null);
    const setDraftRange = (next: typeof draftRange.value | ((previous: typeof draftRange.value) => typeof draftRange.value)) => {
      draftRange.value = typeof next === 'function' ? (next as (previous: typeof draftRange.value) => typeof draftRange.value)(draftRange.value) : next;
    };
    const queryRevision = ref(0);
    const applyFilters = () => {
      queryRevision.value += 1;
      setKeyword(searchText.value.trim());
      setStatus(draftStatus.value);
      setReportType(draftType.value);
      setFarmId(draftFarm.value);
      setRange(draftRange.value);
      setPage(1);
    };
    const resetFilters = () => {
      queryRevision.value += 1;
      setSearchText('');
      setKeyword('');
      setDraftStatus(undefined);
      setStatus(undefined);
      setDraftType(undefined);
      setReportType(undefined);
      setDraftFarm(undefined);
      setFarmId(undefined);
      setDraftRange(null);
      setRange(null);
      setPage(1);
    };
    const filterCount = computed(() => [keyword.value, status.value, reportType.value, farmId.value, range.value].filter(Boolean).length);
    const farms = useQuery(() => ({
      queryKey: ['report-farm-options'],
      queryFn: async () => {
        const result: Farm[] = [];
        for (let pageNum = 1;; pageNum++) {
          const data = await supervisionFarms({
            pageNum,
            pageSize: 100
          });
          if (!Array.isArray(data.list)) throw new Error('农场列表结构异常');
          result.push(...data.list);
          if (result.length >= data.total) return result;
          if (!data.list.length) throw new Error('农场列表不完整，请重试');
        }
      },
      retry: false
    }));
    const farmOptions = computed(() => farms.data?.map(f => ({
      value: String(f.farmId),
      label: `${f.farmName}（${f.farmId}）`
    })) ?? []);
    const farmLabel = (id?: string) => id == null ? '全平台' : farmOptions.value.find(f => f.value === String(id))?.label ?? `农场 ID：${id}`;
    const datePresets = computed(() => [{
      label: '本月',
      value: [dayjs().startOf('month'), dayjs()] as [Dayjs, Dayjs]
    }, {
      label: '近30天',
      value: [dayjs().subtract(29, 'day'), dayjs()] as [Dayjs, Dayjs]
    }, {
      label: '本年',
      value: [dayjs().startOf('year'), dayjs()] as [Dayjs, Dayjs]
    }]);
    const open = shallowRef(false);
    const setOpen = (next: typeof open.value | ((previous: typeof open.value) => typeof open.value)) => {
      open.value = typeof next === 'function' ? (next as (previous: typeof open.value) => typeof open.value)(open.value) : next;
    };
    const actionCode = shallowRef<string | null>(null);
    const setActionCode = (next: typeof actionCode.value | ((previous: typeof actionCode.value) => typeof actionCode.value)) => {
      actionCode.value = typeof next === 'function' ? (next as (previous: typeof actionCode.value) => typeof actionCode.value)(actionCode.value) : next;
    };
    const form = Form.useForm<{
      reportName: string;
      reportType: string;
      farmId?: string;
      range: [Dayjs, Dayjs];
    }>();
    const query = useQuery(() => ({
      queryKey: ['admin-report-tasks', queryRevision.value, page.value, size.value, keyword.value, status.value, reportType.value, farmId.value, range.value?.[0]?.format('YYYY-MM-DD'), range.value?.[1]?.format('YYYY-MM-DD')],
      queryFn: () => listAdminReports({
        pageNum: page.value,
        pageSize: size.value,
        keyword: keyword.value,
        status: status.value,
        reportType: reportType.value,
        farmId: farmId.value,
        startDate: range.value?.[0]?.format('YYYY-MM-DD'),
        endDate: range.value?.[1]?.format('YYYY-MM-DD')
      }),
      retry: false
    }));
    const save = useMutation(() => ({
      mutationFn: async () => {
        const v = await form.validateFields();
        const code = await createReportTask({
          reportName: v.reportName.trim(),
          reportType: v.reportType,
          farmId: v.farmId,
          bizDateFrom: v.range[0].format('YYYY-MM-DD'),
          bizDateTo: v.range[1].format('YYYY-MM-DD')
        });
        const check = await getAdminReportTask(code);
        if (check.reportId !== code || check.reportType !== v.reportType || String(check.farmId ?? '') !== String(v.farmId ?? '') || check.reportName !== v.reportName.trim() || check.bizDateFrom !== v.range[0].format('YYYY-MM-DD') || check.bizDateTo !== v.range[1].format('YYYY-MM-DD')) {
          throw new Error('任务已提交，但回读未确认，请刷新核对，勿重复提交');
        }
        return code;
      },
      onSuccess: () => {
        message.success('报表任务已登记并回读确认');
        setOpen(false);
        form.resetFields();
        void client.invalidateQueries({
          queryKey: ['admin-report-tasks']
        });
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const handleGenerate = async (code: string) => {
      setActionCode(code);
      try {
        const res = await generateAdminReportFile(code);
        if (res.status === 'DONE') {
          message.success('报表快照已生成');
        } else {
          message.warning(`报表生成状态为：${STATUS[res.status ?? ''] ?? res.status ?? '未知'}`);
        }
        void client.invalidateQueries({
          queryKey: ['admin-report-tasks']
        });
      } catch (e) {
        message.error((e as Error)?.message ?? '触发生成失败');
      } finally {
        setActionCode(null);
      }
    };
    const handleDownload = async (row: ReportTask) => {
      setActionCode(row.reportId);
      try {
        await downloadAdminReportFile(row.reportId, `${row.reportName || row.reportId}.csv`);
        message.success('报表下载已开始');
      } catch (e) {
        message.error((e as Error)?.message ?? '下载失败');
      } finally {
        setActionCode(null);
      }
    };
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="生产与质量报表" subTitle="统一管理生产与质量报表任务及快照">
      <Space direction="vertical" size={10} style={{
          width: '100%'
        }}>
        <Alert type="info" showIcon message="支持即时登记并触发生成真实 CSV 报表快照，基于生产、质量及告警事实生成并落盘，未生成前不可下载，已生成快照保持不变。" />

        <Card size="small" class="production-dense-filter-card">
          <CollapsibleFilterForm fieldCount={5} class="production-filter-grid" onFinish={applyFilters}>
            {({
                toggleButton
              }: {
                toggleButton: VNodeChild;
              }) => <>
                <Form.Item label="名称 / 编号">
                  <Input placeholder="搜索报表名称或编号" allowClear value={searchText.value} onChange={e => setSearchText(e.target.value)} />
                </Form.Item>
                <Form.Item label="状态">
                  <Select allowClear value={draftStatus.value} placeholder="全部状态" options={Object.entries(STATUS).map(([value, label]) => ({
                    value,
                    label
                  }))} onChange={setDraftStatus} />
                </Form.Item>
                <Form.Item label="类型">
                  <Select allowClear value={draftType.value} placeholder="全部类型" options={[{
                    value: 'GOV',
                    label: '生产监管'
                  }, {
                    value: 'QUALITY',
                    label: '质量'
                  }, {
                    value: 'BIZ',
                    label: '生产经营'
                  }]} onChange={setDraftType} />
                </Form.Item>
                <Form.Item label="农场">
                  <Select allowClear showSearch optionFilterProp="label" value={draftFarm.value} placeholder="全部农场范围" loading={farms.isFetching} options={farmOptions.value} onChange={setDraftFarm} />
                </Form.Item>
                <Form.Item label="统计期间">
                  <DatePicker.RangePicker value={draftRange.value ?? undefined} presets={datePresets.value} placeholder={['开始日期', '结束日期']} onChange={v => setDraftRange(v?.[0] && v?.[1] ? [dayjs(v[0]), dayjs(v[1])] : null)} />
                </Form.Item>
                <Form.Item class="production-filter-actions">
                  <Space size={8}>
                    <Button onClick={resetFilters}>重置</Button>
                    <Button type="primary" htmlType="submit" loading={query.isFetching}>查询</Button>
                    {toggleButton}
                  </Space>
                </Form.Item>
              </>}
          </CollapsibleFilterForm>
        </Card>

        {farms.isError && <Alert type="error" message="农场选项读取失败" action={<Button onClick={() => void farms.refetch()}>重试</Button>} />}
        <Collapse items={[{
            key: 'metrics',
            label: '指标口径与快照说明',
            children: <Typography.Paragraph style={{
              margin: 0
            }}>任务按计划开始日，采收按采收日，检测按采样日，告警按创建日统计；地块与面积为生成时点在册值。任务验收完成率=验收通过任务/期间任务；检测合格率仅以已完成且结论明确的检测为分母；告警处置完成率以明确已处理或关闭为完成。无分母显示—，合计按数量加权。经营报表不含未接入的交易金额。</Typography.Paragraph>
          }]} />
        {query.data?.unavailableReason || query.isError ? <Alert type="error" showIcon message={query.data?.unavailableReason || '报表读取失败'} action={<Button onClick={() => void query.refetch()}>重试</Button>} /> : null}

        <Card>
          <ProductionTable memberListToolbar rowSelection={{}} headerTitle={<Space wrap size={8}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
                  登记报表任务
                </Button>
                {filterCount.value > 0 && <Tag color="blue">已应用 {filterCount.value} 项筛选</Tag>}
              </Space>} search={false} cardProps={false} columnWidthStorageKey="admin-report-list" columnsState={{
              persistenceKey: 'production-admin-report-columns-v1',
              persistenceType: 'localStorage'
            }} options={{
              reload: () => {
                void query.refetch();
              }
            }} locale={{
              emptyText: filterCount.value ? '没有匹配的报表，请调整筛选条件或重置' : '暂无报表任务，点击上方登记报表任务'
            }} rowKey="reportId" loading={query.isFetching} dataSource={query.data?.list ?? []} scroll={{
              x: 1350
            }} pagination={{
              current: page.value,
              pageSize: size.value,
              total: query.data?.total ?? 0,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 份`,
              onChange: (p, s) => {
                setPage(s === size.value ? p : 1);
                setSize(s);
              }
            }} columns={[{
              title: '报表编号',
              dataIndex: 'reportId',
              width: 230
            }, {
              title: '名称',
              dataIndex: 'reportName',
              width: 200
            }, {
              title: '类型',
              dataIndex: 'reportType',
              width: 110,
              render: v => ({
                GOV: '生产监管',
                BIZ: '经营',
                QUALITY: '质量'
              })[v as string] ?? v
            }, {
              title: '统计期间',
              key: 'period',
              width: 220,
              render: (_, r) => `${r.bizDateFrom ?? '—'} 至 ${r.bizDateTo ?? '—'}`
            }, {
              title: '农场范围',
              key: 'farm',
              width: 220,
              render: (_, row) => farmLabel(row.farmId)
            }, {
              title: '创建人 ID',
              dataIndex: 'generatorId',
              width: 150
            }, {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: v => <Tag color={v === 'DONE' ? 'green' : v === 'FAILED' ? 'red' : 'default'}>
                {STATUS[v as string] ?? v ?? '—'}
              </Tag>
            }, {
              title: '生成时间',
              dataIndex: 'generatedAt',
              width: 180,
              render: v => v || '—'
            }, {
              title: '操作',
              key: 'actions',
              hideInSetting: true,
              width: 180,
              fixed: 'right',
              render: (_, row) => {
                const busy = actionCode.value === row.reportId;
                const isDone = row.status === 'DONE';
                return <ListRowActions items={[!isDone && <Popconfirm key="gen" title="确认生成当前统计期间的报表快照？" onConfirm={() => void handleGenerate(row.reportId)} okText="确定" cancelText="取消">
                        <Button type="link" size="small" loading={busy} disabled={actionCode.value !== null}>
                          {row.status === 'FAILED' ? '重试生成' : '生成快照'}
                        </Button>
                      </Popconfirm>, isDone ? <Button key="dl" type="link" size="small" loading={busy} onClick={() => void handleDownload(row)}>
                        下载
                      </Button> : <Button key="wait" type="link" size="small" disabled>
                        待生成
                      </Button>]} />;
              }
            }]} />
        </Card>

      <Modal title="登记报表任务" open={open.value} confirmLoading={save.isPending} onCancel={() => {
            if (!save.isPending) setOpen(false);
          }} onOk={() => save.mutate()} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{
              reportType: 'GOV'
            }}>
          <Form.Item name="reportName" label="报表名称" rules={[{
                required: true,
                whitespace: true
              }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="reportType" label="类型" rules={[{
                required: true
              }]}>
            <Select options={[{
                  value: 'GOV',
                  label: '生产监管'
                }, {
                  value: 'QUALITY',
                  label: '质量'
                }, {
                  value: 'BIZ',
                  label: '经营'
                }]} />
          </Form.Item>
          <Form.Item name="farmId" label="农场范围" extra="不选时统计全平台农场；所选范围将固化到任务与快照。">
            <Select allowClear showSearch optionFilterProp="label" loading={farms.isFetching} options={farmOptions.value} placeholder="全平台" />
          </Form.Item>
          <Form.Item name="range" label="统计期间" rules={[{
                required: true
              }]}>
            <DatePicker.RangePicker presets={datePresets.value} />
          </Form.Item>
        </Form>
      </Modal>
      </Space>
    </PageContainer>;
    };
  }
});
export default ReportCenter;
