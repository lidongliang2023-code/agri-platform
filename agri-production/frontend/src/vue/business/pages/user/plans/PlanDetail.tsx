import { defineComponent, shallowRef, computed, watch, onMounted, type VNodeChild } from 'vue';
import '@/components/ProductionDetailCompact.css';
import Table from '@/vue/business/components/BusinessRecordList';
import '@/pages/user/plans/plans.css';
import { useNavigate, useParams, useSearchParams } from '@/vue/router';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { App as AntdApp, Button, Empty, Popconfirm, Progress, Result, Skeleton, Space, Tag, Typography } from '@/vue/ui';
import { CalendarOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SendOutlined, StopOutlined } from '@ant-design/icons-vue';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@/vue/pro';
import {
  DetailInfoGrid,
  DetailMetricGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';
import { approvePlan, createPlanStage, fetchPlanApprovalPermission, fetchPlanDetail, fetchPlanStages, fetchPlanTasks, removePlanStage, submitPlanApproval, terminatePlan, updatePlanStage } from '@/api/production-view';
import type { PlanStagePayload, PlanStageView } from '@/api/production-view';
import { TASK_TYPE_META, calcPlanProgress, formatAreaNumber, formatNumber, planStatusMeta, priorityMeta, taskStatusMeta, taskTypeLabel } from '@/utils/production-adapter';
import type { Task } from '@/types';
import { isTaskDone } from '@/types/task';
import useAuthStore from '@/vue/authStore';

const taskTypeOptions = Object.entries(TASK_TYPE_META).map(([value, label]) => ({ value, label }));

const PlanDetail = defineComponent({
  name: 'PlanDetail',
  props: {},
  setup() {
    const _params = useParams<{ planId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { message } = AntdApp.useApp();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore(state => state.userInfo);
    const activeTab = shallowRef<string>('overview');

    watch(() => _params.planId, () => {
      activeTab.value = 'overview';
    });

    const isCreateAlias = computed(() => (_params.planId ?? '') === 'create' || (_params.planId ?? '') === 'new');
    onMounted(() => {
      watch(
        () => [isCreateAlias.value, navigate, searchParams.value],
        () => {
          if (!isCreateAlias.value) return;
          const next = new URLSearchParams();
          next.set('create', '1');
          ['farmId', 'plotId', 'cropId', 'cropVariety'].forEach(key => {
            const value = searchParams.value.get(key);
            if (value) next.set(key, value);
          });
          navigate(`/production/plans?${next.toString()}`, { replace: true });
        },
        { immediate: true, flush: 'post' },
      );
    });

    const isQueryEnabled = computed(() => (_params.planId ?? '') !== '' && !isCreateAlias.value);
    const planQuery = useQuery(() => ({
      queryKey: ['plan-detail', _params.planId ?? ''],
      queryFn: () => fetchPlanDetail(_params.planId ?? ''),
      enabled: isQueryEnabled.value,
      retry: false,
    }));
    const stagesQuery = useQuery(() => ({
      queryKey: ['plan-stages', _params.planId ?? ''],
      queryFn: () => fetchPlanStages(_params.planId ?? ''),
      enabled: isQueryEnabled.value,
    }));
    const tasksQuery = useQuery(() => ({
      queryKey: ['plan-tasks', _params.planId ?? ''],
      queryFn: () => fetchPlanTasks(_params.planId ?? '', 50),
      enabled: isQueryEnabled.value,
    }));
    const approvalPermissionQuery = useQuery(() => ({
      queryKey: ['plan-approval-permission'],
      queryFn: fetchPlanApprovalPermission,
      enabled: isQueryEnabled.value,
      staleTime: 60_000,
    }));
    const canApprovePlan = computed(() => approvalPermissionQuery.data === true);

    async function refreshAll(): Promise<void> {
      await Promise.all([planQuery.refetch(), stagesQuery.refetch(), tasksQuery.refetch()]);
    }

    const submitMutation = useMutation(() => ({
      mutationFn: () => submitPlanApproval(_params.planId ?? ''),
      onSuccess: () => {
        message.success('计划已提交审批，等待本主体审批');
        void queryClient.invalidateQueries({ queryKey: ['plan-detail', _params.planId ?? ''] });
      },
      onError: (error: Error) => message.error(error.message || '提交审批失败'),
    }));

    const approveMutation = useMutation(() => ({
      mutationFn: () => approvePlan(_params.planId ?? '', currentUser.value?.realName || currentUser.value?.username || '本主体审批人', '审批通过'),
      onSuccess: () => {
        message.success('计划审批已通过，已进入进行中');
        void queryClient.invalidateQueries({ queryKey: ['plan-detail', _params.planId ?? ''] });
      },
      onError: (error: Error) => message.error(error.message || '审批失败'),
    }));

    const terminateMutation = useMutation(() => ({
      mutationFn: () => terminatePlan(_params.planId ?? ''),
      onSuccess: () => {
        message.success('计划已终止');
        void queryClient.invalidateQueries({ queryKey: ['plan-detail', _params.planId ?? ''] });
      },
      onError: (error: Error) => message.error(error.message || '终止失败'),
    }));

    const stageFormOpen = shallowRef<boolean>(false);
    const editingStage = shallowRef<PlanStageView | null>(null);

    async function reloadStages(): Promise<void> {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan-stages', _params.planId ?? ''] }),
        stagesQuery.refetch(),
      ]);
    }

    const createStageMutation = useMutation(() => ({
      mutationFn: (payload: PlanStagePayload) => createPlanStage(_params.planId ?? '', payload),
      onSuccess: () => {
        message.success('生育期阶段已添加');
        stageFormOpen.value = false;
        editingStage.value = null;
        void reloadStages();
      },
      onError: (error: Error) => message.error(error.message || '新增阶段失败'),
    }));

    const updateStageMutation = useMutation(() => ({
      mutationFn: (vars: { stageId: string; payload: Partial<PlanStagePayload> }) =>
        updatePlanStage(_params.planId ?? '', vars.stageId, vars.payload),
      onSuccess: () => {
        message.success('阶段已更新');
        stageFormOpen.value = false;
        editingStage.value = null;
        void reloadStages();
      },
      onError: (error: Error) => message.error(error.message || '更新阶段失败'),
    }));

    const removeStageMutation = useMutation(() => ({
      mutationFn: (stageId: string) => removePlanStage(_params.planId ?? '', stageId),
      onSuccess: () => {
        message.success('阶段已删除');
        void reloadStages();
      },
      onError: (error: Error) => message.error(error.message || '删除阶段失败'),
    }));

    const plan = computed(() => planQuery.data);
    const stages = computed(() => stagesQuery.data ?? []);
    const tasks = computed(() => tasksQuery.data ?? []);
    const progress = computed(() => (plan.value ? calcPlanProgress(plan.value) : 0));

    const stageStats = computed(() => {
      const today = dayjs().startOf('day');
      let done = 0;
      let delayDays = 0;
      let delayedStageName = '';
      for (const stage of stages.value) {
        const isDone = stage.status === 3 || Boolean(stage.actualEndDate);
        if (isDone) {
          done += 1;
          continue;
        }
        if (!stage.planEndDate) continue;
        const end = dayjs(stage.planEndDate);
        if (!end.isValid() || !today.isAfter(end)) continue;
        const days = today.diff(end, 'day');
        if (days > delayDays) {
          delayDays = days;
          delayedStageName = stage.stageName;
        }
      }
      return { done, total: stages.value.length, delayDays, delayedStageName };
    });

    const taskStats = computed(() => {
      const done = tasks.value.filter(task => isTaskDone(task.status)).length;
      return {
        done,
        total: tasks.value.length,
        rate: tasks.value.length ? Math.round((done / tasks.value.length) * 100) : 0,
      };
    });

    function stageStatusTag(status: number): VNodeChild {
      if (status === 3) return <Tag color="green">已完成</Tag>;
      if (status === 2) return <Tag color="blue">进行中</Tag>;
      if (status === 0) return <Tag>已取消</Tag>;
      return <Tag>未开始</Tag>;
    }

    const stageColumns = computed(() => [
      {
        title: '序号',
        dataIndex: 'stageNo',
        width: 72,
        render: (val: number) => <span class="detail-info-mono">{val || '—'}</span>,
      },
      {
        title: '阶段名称',
        dataIndex: 'stageName',
        width: 150,
      },
      {
        title: '计划周期',
        key: 'period',
        width: 200,
        render: (_: unknown, row: PlanStageView) => (
          <span class="detail-info-mono">
            {row.planStartDate || '—'} ~ {row.planEndDate || '—'}
          </span>
        ),
      },
      {
        title: '默认任务类型',
        dataIndex: 'taskType',
        width: 120,
        render: (val: string) => (val ? <Tag>{taskTypeLabel(val)}</Tag> : '—'),
      },
      {
        title: '任务数',
        dataIndex: 'taskCount',
        width: 84,
        align: 'right' as const,
        render: (val: number | undefined) => <span class="detail-info-mono">{val ?? 0}</span>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (val: number) => stageStatusTag(val),
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        align: 'right' as const,
        render: (_: unknown, row: PlanStageView) => (
          <Space size={8}>
            <Typography.Link
              onClick={() => {
                editingStage.value = row;
                stageFormOpen.value = true;
              }}
            >
              编辑
            </Typography.Link>
            <Popconfirm
              title="删除阶段"
              description={`确认删除阶段「${row.stageName}」？`}
              okButtonProps={{ danger: true }}
              onConfirm={() => removeStageMutation.mutate(row.stageId)}
            >
              <Typography.Link type="danger">删除</Typography.Link>
            </Popconfirm>
          </Space>
        ),
      },
    ]);

    const taskColumns = computed(() => [
      {
        title: '任务名称',
        dataIndex: 'taskName',
        render: (value: string, row: Task) => (
          <Typography.Link onClick={() => navigate(`/production/tasks/${row.taskId}`)}>{value}</Typography.Link>
        ),
      },
      {
        title: '类型',
        dataIndex: 'taskType',
        width: 120,
        render: (value: string) => <Tag>{taskTypeLabel(value)}</Tag>,
      },
      {
        title: '地块',
        dataIndex: 'plotName',
        width: 120,
        render: (value: string) => value || '—',
      },
      {
        title: '计划周期',
        key: 'range',
        width: 200,
        render: (_value: unknown, row: Task) => (
          <span class="detail-info-mono">
            {row.planStartDate || '—'} ~ {row.planEndDate || '—'}
          </span>
        ),
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        width: 90,
        render: (value: number) => {
          const meta = priorityMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: string) => {
          const meta = taskStatusMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '执行人',
        dataIndex: 'assigneeName',
        width: 100,
        render: (value: string) => value || '未指派',
      },
    ]);

    return () => {
      if (isCreateAlias.value || planQuery.isLoading) {
        return (
          <ProductionDetailLayout title="农事计划详情" hasAside={false} onBack={() => navigate('/production/plans')}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 8 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (planQuery.isError || !plan.value) {
        return (
          <ProductionDetailLayout title="农事计划详情" hasAside={false} onBack={() => navigate('/production/plans')}>
            <DetailSection>
              <Result
                status="404"
                title="未找到该农事计划"
                subTitle="计划可能已被删除，或当前账号无访问权限。"
                extra={
                  <Button type="primary" onClick={() => navigate('/production/plans')}>
                    返回农事计划
                  </Button>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const currentPlan = plan.value;
      const statusMeta = planStatusMeta(currentPlan.status);
      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '计划详情' },
        { key: 'stages', label: '生育期阶段', count: stages.value.length },
        { key: 'tasks', label: '关联任务', count: tasks.value.length },
      ];

      const lifecycleSteps: DetailTimelineStep[] = [
        {
          key: 'draft',
          title: '计划已编制',
          time: currentPlan.startDate ? `计划起始 ${currentPlan.startDate}` : undefined,
          description: currentPlan.status === 1 ? '当前节点 · 草稿编制中' : '已完成',
          state: currentPlan.status === 1 ? 'current' : 'done',
        },
        {
          key: 'approval',
          title: currentPlan.status === 5 ? '等待主体审批' : '主体审批',
          description: currentPlan.status === 5 ? '当前节点 · 待审批通过' : currentPlan.status === 1 ? '待提交审批' : '已审批通过',
          state: currentPlan.status === 5 ? 'current' : currentPlan.status === 1 ? 'pending' : 'done',
        },
        {
          key: 'running',
          title: '农事执行中',
          description:
            currentPlan.status === 2
              ? `当前节点 · 时间进度 ${progress.value}%`
              : currentPlan.status === 3
                ? '执行阶段已完成'
                : currentPlan.status === 4
                  ? '计划已提前终止'
                  : '待进入执行',
          state:
            currentPlan.status === 2
              ? 'current'
              : currentPlan.status === 3
                ? 'done'
                : currentPlan.status === 4
                  ? 'error'
                  : 'pending',
        },
        {
          key: 'finished',
          title: currentPlan.status === 4 ? '已终止' : '计划完结',
          time: currentPlan.endDate ? `计划截止 ${currentPlan.endDate}` : undefined,
          description:
            currentPlan.status === 3
              ? '已完成结项'
              : currentPlan.status === 4
                ? '终止关闭'
                : '待处理',
          state: currentPlan.status === 3 ? 'done' : currentPlan.status === 4 ? 'error' : 'pending',
        },
      ];

      const stageTimelineSteps: DetailTimelineStep[] = stages.value.map(stage => ({
        key: stage.stageId,
        title: `${stage.stageNo ? `第 ${stage.stageNo} 阶段 · ` : ''}${stage.stageName}`,
        time: `${stage.planStartDate || '—'} ~ ${stage.planEndDate || '—'}`,
        description: stage.actualStartDate
          ? `实际：${stage.actualStartDate} ~ ${stage.actualEndDate || '进行中'}`
          : stage.description || undefined,
        state: stage.status === 3 ? 'done' : stage.status === 2 ? 'current' : stage.status === 0 ? 'error' : 'pending',
      }));

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'farm',
          label: '所属农场',
          text: currentPlan.farmName || undefined,
          emptyText: '未关联',
          mono: false,
          onClick: currentPlan.farmId ? () => navigate(`/production/farms/${currentPlan.farmId}`) : undefined,
        },
        {
          key: 'plot',
          label: '关联地块',
          text: currentPlan.plotName || currentPlan.plotId || undefined,
          emptyText: '未关联',
          mono: !currentPlan.plotName,
          onClick: currentPlan.plotId ? () => navigate(`/production/plots/${currentPlan.plotId}`) : undefined,
        },
        {
          key: 'calendar',
          label: '农事日历',
          text: '查看日历排期',
          mono: false,
          onClick: () => navigate('/production/plans/calendar'),
        },
        {
          key: 'tasks',
          label: '关联任务',
          text: tasks.value.length > 0 ? `${taskStats.value.done}/${tasks.value.length} 已完成` : undefined,
          emptyText: '暂未生成任务',
          mono: false,
          onClick: () => {
            activeTab.value = 'tasks';
          },
        },
      ];

      const previewTasks = tasks.value.slice(0, 5);

      return (
        <ProductionDetailLayout
          class="production-plans-page production-detail-compact"
          code={currentPlan.planNo || undefined}
          title={currentPlan.planName}
          status={{ label: statusMeta.label, tone: statusMeta.color }}
          meta={[
            { label: '所属农场', value: currentPlan.farmName || '—' },
            { label: '负责人', value: currentPlan.managerName || currentPlan.managerId || '—' },
            { label: '更新时间', value: currentPlan.updatedAt || '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回农事计划"
          onBack={() => navigate('/production/plans')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          actions={
            <>
              <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
                刷新
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => navigate(`/production/plans/${_params.planId ?? ''}/edit?from=detail`)}
              >
                编辑计划
              </Button>
              {currentPlan.status === 2 && (
                <Popconfirm
                  title="终止计划"
                  description={`确认终止「${currentPlan.planName}」？终止后不可恢复执行。`}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => terminateMutation.mutate()}
                >
                  <Button danger icon={<StopOutlined />} loading={terminateMutation.isPending}>
                    终止计划
                  </Button>
                </Popconfirm>
              )}
              {currentPlan.status === 1 && (
                <Popconfirm
                  title="提交审批"
                  description={`确认提交「${currentPlan.planName}」给本主体审批人审批？`}
                  onConfirm={() => submitMutation.mutate()}
                >
                  <Button type="primary" icon={<SendOutlined />} loading={submitMutation.isPending}>
                    提交审批
                  </Button>
                </Popconfirm>
              )}
              {currentPlan.status === 5 && canApprovePlan.value && (
                <Popconfirm
                  title="审批通过"
                  description={`确认审批通过「${currentPlan.planName}」？通过后计划将进入进行中。`}
                  onConfirm={() => approveMutation.mutate()}
                >
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending}>
                    审批通过
                  </Button>
                </Popconfirm>
              )}
            </>
          }
          aside={
            <>
              <DetailSection title="计划进度">
                <DetailTimeline items={lifecycleSteps} />
              </DetailSection>
              <DetailSection title="进度指标">
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <div>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text type="secondary">时间进度</Typography.Text>
                      <Typography.Text strong class="detail-info-mono">{progress.value}%</Typography.Text>
                    </Space>
                    <Progress percent={progress.value} size="small" strokeColor="#2d8f4e" showInfo={false} />
                  </div>
                  <div>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text type="secondary">生育期完成</Typography.Text>
                      <Typography.Text strong class="detail-info-mono">
                        {stageStats.value.done}/{stages.value.length}
                      </Typography.Text>
                    </Space>
                    <Progress
                      percent={stages.value.length ? Math.round((stageStats.value.done / stages.value.length) * 100) : 0}
                      size="small"
                      strokeColor="#1677ff"
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text type="secondary">关联任务完成</Typography.Text>
                      <Typography.Text strong class="detail-info-mono">
                        {taskStats.value.done}/{taskStats.value.total}
                      </Typography.Text>
                    </Space>
                    <Progress percent={taskStats.value.rate} size="small" strokeColor="#fa8c16" showInfo={false} />
                  </div>
                </Space>
              </DetailSection>
              <DetailSection title="关联单据">
                <DetailRelatedDocs items={relatedDocs} />
              </DetailSection>
            </>
          }
        >
          {activeTab.value === 'overview' && (
            <>
              <DetailSection title="基本信息">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'planNo', label: '计划编号', value: currentPlan.planNo, mono: true },
                    { key: 'planName', label: '计划名称', value: currentPlan.planName },
                    { key: 'farm', label: '所属农场', value: currentPlan.farmName || '—' },
                    { key: 'plot', label: '关联地块', value: currentPlan.plotName || currentPlan.plotId || '—' },
                    { key: 'crop', label: '作物', value: currentPlan.cropName || '—' },
                    { key: 'variety', label: '品种', value: currentPlan.cropVariety || '—' },
                    { key: 'manager', label: '负责人', value: currentPlan.managerName || currentPlan.managerId || '—' },
                    { key: 'updatedAt', label: '更新时间', value: currentPlan.updatedAt || '—', mono: true },
                  ]}
                />
              </DetailSection>

              <DetailSection title="排期与产能目标">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    {
                      key: 'period',
                      label: '计划周期',
                      value: currentPlan.startDate ? `${currentPlan.startDate} ~ ${currentPlan.endDate}` : '—',
                      mono: true,
                    },
                    {
                      key: 'area',
                      label: '计划面积',
                      value: currentPlan.planArea > 0 ? `${formatAreaNumber(currentPlan.planArea)} 亩` : '—',
                      mono: true,
                    },
                    {
                      key: 'yield',
                      label: '预计产量',
                      value: `${formatNumber(currentPlan.expectedYield)} kg`,
                      mono: true,
                    },
                    {
                      key: 'delay',
                      label: '进度偏差',
                      value:
                        stageStats.value.delayDays > 0 ? (
                          <Typography.Text type="danger">
                            延误 {stageStats.value.delayDays} 天（{stageStats.value.delayedStageName}）
                          </Typography.Text>
                        ) : (
                          <Typography.Text style={{ color: '#2d8f4e' }}>按期推进</Typography.Text>
                        ),
                    },
                    { key: 'remark', label: '备注说明', fullWidth: true, value: currentPlan.remark || '—' },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="生育期安排"
                extra={
                  <Space size={8}>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        editingStage.value = null;
                        stageFormOpen.value = true;
                      }}
                    >
                      新增阶段
                    </Button>
                    {stages.value.length > 0 && (
                      <Typography.Link onClick={() => { activeTab.value = 'stages'; }}>
                        管理全部 {stages.value.length} 项
                      </Typography.Link>
                    )}
                  </Space>
                }
              >
                {stagesQuery.isLoading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : stages.value.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该计划暂无生育期阶段" />
                ) : (
                  <DetailTimeline items={stageTimelineSteps} />
                )}
              </DetailSection>

              <DetailSection
                title="关联农事任务"
                flush={previewTasks.length > 0}
                extra={
                  <Space size={12}>
                    {tasks.value.length > 5 && (
                      <Typography.Link onClick={() => { activeTab.value = 'tasks'; }}>
                        查看全部 {tasks.value.length} 项
                      </Typography.Link>
                    )}
                    <Typography.Link onClick={() => navigate('/production/tasks')}>前往任务列表</Typography.Link>
                  </Space>
                }
                footer={
                  tasks.value.length > 0 ? (
                    <Typography.Text strong class="detail-info-mono">
                      完成率 {taskStats.value.rate}%（{taskStats.value.done}/{tasks.value.length}）
                    </Typography.Text>
                  ) : undefined
                }
              >
                {tasksQuery.isLoading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : previewTasks.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该计划暂未生成农事任务" />
                ) : (
                  <Table
                    rowKey="taskId"
                    size="small"
                    dataSource={previewTasks}
                    columns={taskColumns.value}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                )}
              </DetailSection>
            </>
          )}

          {activeTab.value === 'stages' && (
            <DetailSection
              title={`生育期阶段明细（${stages.value.length}）`}
              flush={stages.value.length > 0}
              extra={
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    editingStage.value = null;
                    stageFormOpen.value = true;
                  }}
                >
                  新增阶段
                </Button>
              }
            >
              {stagesQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : stages.value.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段数据" />
              ) : (
                <Table
                  rowKey="stageId"
                  size="small"
                  dataSource={stages.value}
                  columns={stageColumns.value}
                  pagination={stages.value.length > 10 ? { pageSize: 10, size: 'small' } : false}
                  scroll={{ x: 'max-content' }}
                />
              )}
            </DetailSection>
          )}

          {activeTab.value === 'tasks' && (
            <DetailSection
              title={`关联农事任务（${tasks.value.length}）`}
              flush={tasks.value.length > 0}
              extra={
                <Button size="small" onClick={() => navigate('/production/tasks')}>
                  前往任务列表
                </Button>
              }
              footer={
                tasks.value.length > 0 ? (
                  <DetailMetricGrid
                    items={[
                      { key: 'total', title: '任务总数', value: tasks.value.length, suffix: '条' },
                      { key: 'done', title: '已完成', value: taskStats.value.done, suffix: '条', valueStyle: { color: '#2d8f4e' } },
                      { key: 'rate', title: '完成率', value: taskStats.value.rate, suffix: '%' },
                    ]}
                  />
                ) : undefined
              }
            >
              {tasksQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : tasks.value.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该计划暂未生成农事任务" />
              ) : (
                <Table
                  rowKey="taskId"
                  size="small"
                  dataSource={tasks.value}
                  columns={taskColumns.value}
                  pagination={tasks.value.length > 10 ? { pageSize: 10, size: 'small' } : false}
                  scroll={{ x: 'max-content' }}
                />
              )}
            </DetailSection>
          )}

          <ModalForm
            key={`plan-stage-${editingStage.value?.stageId ?? 'new'}`}
            title={
              <Space>
                <CalendarOutlined style={{ color: '#2d8f4e' }} />
                <span>{editingStage.value ? '编辑生育期阶段' : '新增生育期阶段'}</span>
              </Space>
            }
            open={stageFormOpen.value}
            width={520}
            modalProps={{
              className: 'production-form-dialog',
              destroyOnHidden: true,
              confirmLoading: createStageMutation.isPending || updateStageMutation.isPending,
            }}
            initialValues={
              editingStage.value
                ? {
                    stageName: editingStage.value.stageName,
                    stageSeq: editingStage.value.stageNo,
                    planStartDate: editingStage.value.planStartDate,
                    planEndDate: editingStage.value.planEndDate,
                    taskType: editingStage.value.taskType || undefined,
                    description: editingStage.value.description || undefined,
                    status: editingStage.value.status,
                  }
                : {
                    stageSeq: stages.value.length + 1,
                    planStartDate: currentPlan.startDate || undefined,
                    planEndDate: currentPlan.endDate || undefined,
                    status: 1,
                  }
            }
            onOpenChange={visible => {
              stageFormOpen.value = visible;
              if (!visible) editingStage.value = null;
            }}
            onFinish={async value => {
              if (editingStage.value) {
                await updateStageMutation.mutateAsync({ stageId: editingStage.value.stageId, payload: value });
              } else {
                await createStageMutation.mutateAsync(value);
              }
              return true;
            }}
          >
            <ProFormText
              name="stageName"
              label="阶段名称"
              placeholder="如：育秧期 / 分蘖期 / 抽穗期"
              rules={[
                { required: true, message: '请输入阶段名称' },
                { max: 50, message: '阶段名称不超过 50 个字符' },
              ]}
            />
            <ProFormDigit
              name="stageSeq"
              label="阶段序号"
              min={1}
              fieldProps={{ precision: 0 }}
              rules={[{ required: true, message: '请输入阶段序号' }]}
            />
            <ProFormDatePicker name="planStartDate" label="计划开始日期" rules={[{ required: true, message: '请选择计划开始日期' }]} />
            <ProFormDatePicker name="planEndDate" label="计划结束日期" rules={[{ required: true, message: '请选择计划结束日期' }]} />
            <ProFormSelect name="taskType" label="默认任务类型" options={taskTypeOptions} placeholder="可选，用于任务链自动生成时继承" />
            <ProFormSelect
              name="status"
              label="阶段状态"
              options={[
                { value: 1, label: '未开始' },
                { value: 2, label: '进行中' },
                { value: 3, label: '已完成' },
                { value: 0, label: '已取消' },
              ]}
            />
            <ProFormTextArea name="description" label="阶段说明" placeholder="补充说明，500 字以内" fieldProps={{ rows: 3, maxLength: 500 }} />
          </ModalForm>
        </ProductionDetailLayout>
      );
    };
  },
});

export default PlanDetail;
