import { defineComponent, shallowRef, computed, watch } from 'vue';
import '@/components/ProductionDetailCompact.css';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { ModalForm, ProFormDateTimePicker, ProFormDigit, ProFormRadio, ProFormSelect, ProFormText, ProFormTextArea } from '@/vue/pro';
import { Alert, Button, Empty, Image, Pagination, Popconfirm, Skeleton, Space, Table, Tag, Timeline, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import { createTaskRecord, deleteTask, dispatchTask, executeTask, fetchTaskRecords, getTask, reviewTask, submitTaskResult, updateTask } from '@/api/tasks';
import { fetchUsagesByTask } from '@/api/inputs';
import { getPlot } from '@/api/plots';
import { listMembers } from '@/api/members';
import type { InputUsageRecord, Member, Task, TaskRecord } from '@/types';
import { ACCEPT_STATUS_META, TASK_ACCEPT_PENDING, TASK_PRIORITY_LABEL_MAP, TASK_PRIORITY_OPTIONS, TASK_RECORD_TYPE_OPTIONS, TASK_STATUS_COLOR_MAP, TASK_STATUS_LABEL_MAP, TASK_TYPE_LABEL_MAP, TASK_TYPE_OPTIONS } from '@/types';
import { isTaskDone, isTaskExecuting } from '@/types/task';
import {
  DetailInfoGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailInfoItem,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';

const RECORD_TYPE_TEXT: Record<number, string> = {
  1: '开始执行',
  2: '过程记录',
  3: '完成打卡',
};

const RECORD_TYPE_COLOR: Record<number, string> = {
  1: 'blue',
  2: 'gray',
  3: 'green',
};

function parsePhotoList(record: TaskRecord): string[] {
  if (record.photoList && record.photoList.length > 0) return record.photoList;
  if (!record.photos) return [];
  try {
    const parsed: unknown = JSON.parse(record.photos);
    if (Array.isArray(parsed)) return parsed.map(item => String(item));
  } catch {
    // 非 JSON 时按逗号分隔处理
  }
  return record.photos.split(',').map(item => item.trim()).filter(Boolean);
}

function parseUrlList(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => String(item));
  } catch {
    // 非 JSON 时按逗号分隔处理
  }
  return raw.split(',').map(item => item.trim()).filter(Boolean);
}

interface CheckInFormValues {
  executeType: 1 | 2 | 3;
  photoList?: string[];
  gpsLat?: number;
  gpsLng?: number;
  gpsDistance?: number;
  abnormalDesc?: string;
}

interface ReviewFormValues {
  pass: boolean;
  remark?: string;
}

interface SubmitFormValues {
  resultDesc?: string;
  resultPhotoUrls?: string[];
}

const TaskDetail = defineComponent({
  name: 'TaskDetail',
  props: {},
  setup() {
    const _params = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const activeTab = shallowRef<string>('overview');
    const assignOpen = shallowRef<boolean>(false);
    const checkInOpen = shallowRef<boolean>(false);
    const editOpen = shallowRef<boolean>(false);
    const submitOpen = shallowRef<boolean>(false);
    const reviewOpen = shallowRef<boolean>(false);
    const reviewPass = shallowRef<boolean>(true);
    const recordPage = shallowRef(1);

    watch(() => _params.taskId, () => {
      activeTab.value = 'overview';
      recordPage.value = 1;
    });

    const taskQuery = useQuery(() => ({
      queryKey: ['production-task', _params.taskId ?? ''],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => getTask(_params.taskId ?? ''),
    }));
    const task = computed(() => taskQuery.data);
    const canStartTask = computed(() => Boolean(task.value && ['pending', 'assigned', 'rejected'].includes(task.value.status)));
    const canSubmitTask = computed(() => Boolean(task.value && isTaskExecuting(task.value.status)));
    const canAcceptTask = computed(() => Boolean(task.value && isTaskDone(task.value.status) && task.value.acceptStatus === TASK_ACCEPT_PENDING));

    const recordQuery = useQuery(() => ({
      queryKey: ['production-task-records', _params.taskId ?? '', recordPage.value],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => fetchTaskRecords(_params.taskId ?? '', recordPage.value, 50),
    }));

    const usagesQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'usages', 'task', _params.taskId ?? ''],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => fetchUsagesByTask(_params.taskId ?? ''),
    }));

    const plotQuery = useQuery(() => ({
      queryKey: ['production-task-plot', task.value?.plotId],
      enabled: Boolean(task.value?.plotId),
      queryFn: () => getPlot(task.value?.plotId ?? ''),
    }));

    const memberQuery = useQuery(() => ({
      queryKey: ['member-options', task.value?.farmId],
      queryFn: () => listMembers({ farmId: task.value?.farmId, pageNum: 1, pageSize: 100 }),
    }));
    const memberOptions = computed(() =>
      (memberQuery.data?.list ?? []).map((member: Member) => ({ value: member.memberId, label: member.realName })),
    );

    const refreshTask = (): Promise<void> =>
      queryClient
        .invalidateQueries({ queryKey: ['production-task', _params.taskId ?? ''] })
        .then(() => queryClient.invalidateQueries({ queryKey: ['production-task-records', _params.taskId ?? ''] }))
        .then(() => queryClient.invalidateQueries({ queryKey: ['production-inputs', 'usages', 'task', _params.taskId ?? ''] }))
        .then(() => queryClient.invalidateQueries({ queryKey: ['production-tasks'] }))
        .then(() => undefined);

    const startMutation = useMutation(() => ({
      mutationFn: () => executeTask(_params.taskId ?? ''),
      onSuccess: () => {
        message.success('任务已开始执行');
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '开始执行失败'),
    }));

    const submitMutation = useMutation(() => ({
      mutationFn: (values: SubmitFormValues) =>
        submitTaskResult(_params.taskId ?? '', {
          resultDesc: values.resultDesc,
          resultPhotoUrls: values.resultPhotoUrls && values.resultPhotoUrls.length > 0 ? JSON.stringify(values.resultPhotoUrls) : undefined,
        }),
      onSuccess: () => {
        message.success('成果已提交，等待验收');
        submitOpen.value = false;
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '提交成果失败'),
    }));

    const reviewMutation = useMutation(() => ({
      mutationFn: (values: ReviewFormValues) => reviewTask(_params.taskId ?? '', values.pass, values.remark),
      onSuccess: (_data, variables) => {
        message.success(variables.pass ? '验收已通过' : '已驳回，等待重新执行');
        reviewOpen.value = false;
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '验收提交失败'),
    }));

    const dispatchMutation = useMutation(() => ({
      mutationFn: (assigneeId: string) => dispatchTask(_params.taskId ?? '', assigneeId),
      onSuccess: () => {
        message.success('任务已转派');
        assignOpen.value = false;
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '转派失败'),
    }));

    const updateMutation = useMutation(() => ({
      mutationFn: (payload: Partial<Task>) => updateTask(_params.taskId ?? '', payload),
      onSuccess: () => {
        message.success('任务已更新');
        editOpen.value = false;
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '任务更新失败'),
    }));

    const deleteMutation = useMutation(() => ({
      mutationFn: () => deleteTask(_params.taskId ?? ''),
      onSuccess: () => {
        message.success('任务已删除');
        void queryClient.invalidateQueries({ queryKey: ['production-tasks'] });
        navigate('/production/tasks');
      },
      onError: (error: Error) => message.error(error.message || '删除失败'),
    }));

    const checkInMutation = useMutation(() => ({
      mutationFn: (values: CheckInFormValues) =>
        createTaskRecord(_params.taskId ?? '', {
          taskId: _params.taskId ?? '',
          executeType: values.executeType,
          executeTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          photos: JSON.stringify(values.photoList ?? []),
          gpsLat: values.gpsLat,
          gpsLng: values.gpsLng,
          gpsDistance: values.gpsDistance,
          abnormalDesc: values.abnormalDesc,
        }),
      onSuccess: () => {
        message.success('执行记录已上报');
        checkInOpen.value = false;
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '执行记录上报失败'),
    }));

    const basicItems = computed<DetailInfoItem[]>(() => {
      if (!task.value) return [];
      return [
        { key: 'taskNo', label: '任务编号', value: task.value.taskNo ?? '—', mono: true },
        { key: 'taskType', label: '任务类型', value: TASK_TYPE_LABEL_MAP[task.value.taskType] ?? task.value.taskType },
        { key: 'priority', label: '优先级', value: TASK_PRIORITY_LABEL_MAP[task.value.priority] ?? '普通' },
        { key: 'cropName', label: '适用作物', value: task.value.cropName || '—' },
        { key: 'farm', label: '所属农场', value: task.value.farmName ?? '—' },
        { key: 'plot', label: '作业地块', value: task.value.plotName ?? task.value.plotId ?? '—' },
        { key: 'assignee', label: '执行人', value: task.value.assigneeName ?? '未派发' },
        { key: 'assigner', label: '派发人', value: task.value.assignerName ?? '—' },
      ];
    });

    const requirementItems = computed<DetailInfoItem[]>(() => {
      if (!task.value) return [];
      return [
        { key: 'plan', label: '计划时间', value: `${task.value.planStartDate ?? '—'} ~ ${task.value.planEndDate ?? '—'}`, mono: true },
        { key: 'actual', label: '实际执行', value: `${task.value.actualStartDate ?? '—'} ~ ${task.value.actualEndDate ?? task.value.completedAt ?? '—'}`, mono: true },
        {
          key: 'accept',
          label: '验收状态',
          value: (
            <Space size={4} wrap>
              <Tag color={ACCEPT_STATUS_META[task.value.acceptStatus]?.color ?? 'gold'}>
                {ACCEPT_STATUS_META[task.value.acceptStatus]?.label ?? '待验收'}
              </Tag>
              {task.value.rejectCount > 0 && <Tag color="volcano">驳回 {task.value.rejectCount} 次</Tag>}
            </Space>
          ),
        },
        { key: 'templateId', label: '关联模板', value: task.value.templateId ?? '未关联', mono: Boolean(task.value.templateId) },
        { key: 'inputs', label: '所需投入品', value: task.value.inputMaterials || '—', fullWidth: true },
        { key: 'quality', label: '质量要求', value: task.value.qualityRequirement || '—', fullWidth: true },
        { key: 'description', label: '任务描述', value: task.value.description ?? '暂无描述', fullWidth: true },
        { key: 'remark', label: '备注', value: task.value.remark || '—', fullWidth: true },
      ];
    });

    const records = computed(() => recordQuery.data?.list ?? []);
    const usages = computed(() => usagesQuery.data ?? []);
    const resultPhotos = computed(() => parseUrlList(task.value?.resultPhotoUrls));

    const timelineItems = computed(() => {
      const items: { color: string; children: unknown }[] = [];
      if (task.value?.createdAt) {
        items.push({
          color: 'gray',
          children: (
            <div>
              <Typography.Text strong class="detail-info-mono">
                {dayjs(task.value.createdAt).format('YYYY-MM-DD HH:mm')}
              </Typography.Text>
              <div>
                <Typography.Text>任务已创建，待执行</Typography.Text>
              </div>
              <Typography.Text type="secondary">系统</Typography.Text>
            </div>
          ),
        });
      }
      records.value.forEach((record: TaskRecord) => {
        const photos = parsePhotoList(record);
        items.push({
          color: RECORD_TYPE_COLOR[record.executeType] ?? 'blue',
          children: (
            <div>
              <Space size={8} wrap>
                <Typography.Text strong class="detail-info-mono">{record.executeTime ?? '—'}</Typography.Text>
                <Tag color={RECORD_TYPE_COLOR[record.executeType] === 'green' ? 'green' : 'blue'}>
                  {RECORD_TYPE_TEXT[record.executeType] ?? '执行记录'}
                </Tag>
                {record.offlineFlag === 1 && <Tag color="orange">离线补传</Tag>}
              </Space>
              <div>
                <Typography.Text type="secondary">
                  执行人：{record.executorName ?? record.executorId ?? '—'}
                  {record.gpsLat && record.gpsLng ? ` ｜ GPS：${record.gpsLat}, ${record.gpsLng}` : ''}
                  {record.gpsDistance ? ` ｜ 距地块中心 ${record.gpsDistance} 米` : ''}
                </Typography.Text>
              </div>
              {record.abnormalDesc && (
                <div>
                  <Typography.Text type="warning">异常：{record.abnormalDesc}</Typography.Text>
                </div>
              )}
              {photos.length > 0 && (
                <Image.PreviewGroup>
                  <Space size={8} wrap style={{ marginTop: 8 }}>
                    {photos.map(url => (
                      <Image key={url} src={url} width={72} height={72} style={{ objectFit: 'cover' }} />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              )}
            </div>
          ),
        });
      });
      return items;
    });

    const usageColumns = computed<ColumnsType<InputUsageRecord>>(() => [
      {
        title: '投入品名称',
        dataIndex: 'inputName',
        render: (val: string, row: InputUsageRecord) => (
          <Typography.Link onClick={() => navigate(`/production/inputs?tab=ledger&usageId=${encodeURIComponent(row.usageId)}`)}>
            {val ?? '投入品使用记录'}
          </Typography.Link>
        ),
      },
      {
        title: '施用用量',
        key: 'dosage',
        width: 130,
        align: 'right',
        render: (_: unknown, row: InputUsageRecord) => (
          <span class="detail-info-mono">
            {row.dosage === undefined || row.dosage === null ? '未登记' : `${row.dosage} ${row.unit ?? ''}`}
          </span>
        ),
      },
      {
        title: '使用时间',
        dataIndex: 'usedAt',
        width: 160,
        render: (val: string) => <span class="detail-info-mono">{val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—'}</span>,
      },
      {
        title: '地块',
        dataIndex: 'plotId',
        width: 120,
        render: (val: string) => val || '—',
      },
    ]);

    return () => {
      if (taskQuery.isLoading) {
        return (
          <ProductionDetailLayout title="任务详情" hasAside={false} onBack={() => navigate('/production/tasks')}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 6 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }
      if (taskQuery.isError || !task.value) {
        return (
          <ProductionDetailLayout title="任务详情" hasAside={false} onBack={() => navigate('/production/tasks')}>
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">任务不存在或加载失败</Typography.Text>
                    <Button onClick={() => navigate('/production/tasks')}>返回任务列表</Button>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const currentTask = task.value;
      const done = isTaskDone(currentTask.status);
      const executing = isTaskExecuting(currentTask.status);
      const accepted = currentTask.acceptStatus === 1;
      const rejected = currentTask.acceptStatus === 2 || currentTask.status === 'rejected';

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'created',
          title: '任务已创建',
          time: currentTask.createdAt ? dayjs(currentTask.createdAt).format('MM-DD HH:mm') : undefined,
          state: 'done',
        },
        {
          key: 'assigned',
          title: currentTask.assigneeName ? `已派发给 ${currentTask.assigneeName}` : '等待派发执行',
          description: canStartTask.value ? '当前节点 · 待开始执行' : undefined,
          state: canStartTask.value ? 'current' : 'done',
        },
        {
          key: 'executing',
          title: '现场作业执行',
          time: currentTask.actualStartDate || undefined,
          description: executing ? `当前节点 · 已打卡 ${records.value.length} 次` : done ? '已完成作业并提交成果' : '待处理',
          state: executing ? 'current' : done ? 'done' : 'pending',
        },
        {
          key: 'acceptance',
          title: accepted ? '验收已通过' : rejected ? '验收已驳回' : '成果验收',
          time: currentTask.completedAt || currentTask.actualEndDate || undefined,
          description: canAcceptTask.value ? '当前节点 · 等待验收结论' : rejected ? `累计驳回 ${currentTask.rejectCount} 次` : accepted ? '任务已归档' : '待处理',
          state: accepted ? 'done' : rejected ? 'error' : canAcceptTask.value ? 'current' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'plot',
          label: '关联地块',
          text: plotQuery.data?.plotName || currentTask.plotName || currentTask.plotId || undefined,
          emptyText: '未关联地块',
          mono: !plotQuery.data?.plotName && !currentTask.plotName,
          onClick: currentTask.plotId ? () => navigate(`/production/plots/${currentTask.plotId}`) : undefined,
        },
        {
          key: 'farm',
          label: '所属农场',
          text: currentTask.farmName || undefined,
          emptyText: '未关联',
          mono: false,
          onClick: currentTask.farmId ? () => navigate(`/production/farms/${currentTask.farmId}`) : undefined,
        },
        {
          key: 'template',
          label: '作业模板',
          code: currentTask.templateId || undefined,
          emptyText: '未关联模板',
        },
        {
          key: 'acceptance',
          label: '任务验收页',
          text: canAcceptTask.value ? '前往验收核查' : ACCEPT_STATUS_META[currentTask.acceptStatus]?.label,
          mono: false,
          onClick: () => navigate(`/production/tasks/${_params.taskId ?? ''}/acceptance`),
        },
        {
          key: 'inputs',
          label: '投入品台账',
          text: usages.value.length > 0 ? `${usages.value.length} 条施用记录` : undefined,
          emptyText: '暂无施用记录',
          mono: false,
          onClick: () => {
            activeTab.value = 'usages';
          },
        },
      ];

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '任务详情' },
        { key: 'records', label: '执行记录', count: timelineItems.value.length },
        { key: 'usages', label: '关联投入品', count: usages.value.length },
      ];

      return (
        <ProductionDetailLayout
          class="production-detail-compact"
          code={currentTask.taskNo || undefined}
          title={currentTask.taskName}
          status={{
            label: TASK_STATUS_LABEL_MAP[currentTask.status] ?? currentTask.status,
            tone: TASK_STATUS_COLOR_MAP[currentTask.status] ?? 'default',
          }}
          extraStatuses={[
            {
              label: ACCEPT_STATUS_META[currentTask.acceptStatus]?.label ?? '待验收',
              tone: ACCEPT_STATUS_META[currentTask.acceptStatus]?.color ?? 'gold',
            },
          ]}
          meta={[
            { label: '所属农场', value: currentTask.farmName || '—' },
            { label: '执行人', value: currentTask.assigneeName || '未派发' },
            { label: '计划周期', value: `${currentTask.planStartDate ?? '—'} ~ ${currentTask.planEndDate ?? '—'}` },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回任务列表"
          onBack={() => navigate('/production/tasks')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          banner={
            <>
              {currentTask.acceptStatus === 2 && currentTask.acceptRemark && (
                <Alert type="error" showIcon message="验收驳回意见" description={currentTask.acceptRemark} />
              )}
              {(recordQuery.isError || usagesQuery.isError) && (
                <Alert
                  type="error"
                  showIcon
                  message="执行记录或投入品加载失败，不能据此认定没有记录"
                  action={
                    <Button
                      size="small"
                      onClick={() => {
                        void recordQuery.refetch();
                        void usagesQuery.refetch();
                      }}
                    >
                      重试
                    </Button>
                  }
                />
              )}
              {plotQuery.isError && (
                <Alert
                  type="error"
                  showIcon
                  message="关联地块加载失败"
                  action={
                    <Button size="small" onClick={() => void plotQuery.refetch()}>
                      重试
                    </Button>
                  }
                />
              )}
            </>
          }
          actions={
            /* 严格按规范顺序排列：次要 → 危险 → 主要 */
            <>
              {canStartTask.value && (
                <>
                  <Button onClick={() => { editOpen.value = true; }}>编辑</Button>
                  <Button onClick={() => { assignOpen.value = true; }}>转派</Button>
                </>
              )}
              {executing && <Button onClick={() => { checkInOpen.value = true; }}>添加打卡</Button>}
              {canAcceptTask.value && (
                <Button onClick={() => navigate(`/production/tasks/${_params.taskId ?? ''}/acceptance`)}>
                  详情验收
                </Button>
              )}
              {canAcceptTask.value && (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    reviewPass.value = false;
                    reviewOpen.value = true;
                  }}
                >
                  驳回
                </Button>
              )}
              {!executing && (
                <Popconfirm
                  title="确认删除该任务？"
                  description="删除后不可恢复，请谨慎操作。"
                  okText="确认删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteMutation.mutate()}
                >
                  <Button danger loading={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>
              )}
              {canStartTask.value && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={startMutation.isPending}
                  onClick={() => startMutation.mutate()}
                >
                  开始执行
                </Button>
              )}
              {canSubmitTask.value && (
                <Button type="primary" onClick={() => { submitOpen.value = true; }}>
                  提交成果
                </Button>
              )}
              {canAcceptTask.value && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={reviewMutation.isPending}
                  onClick={() => {
                    reviewPass.value = true;
                    reviewOpen.value = true;
                  }}
                >
                  验收通过
                </Button>
              )}
            </>
          }
          aside={
            <>
              <DetailSection title="任务进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="关联单据与地块">
                <DetailRelatedDocs items={relatedDocs} />
              </DetailSection>
            </>
          }
        >
          {activeTab.value === 'overview' && (
            <>
              <DetailSection title="基本信息">
                <DetailInfoGrid columns={2} items={basicItems.value} />
              </DetailSection>

              <DetailSection title="排期与作业要求">
                <DetailInfoGrid columns={2} items={requirementItems.value} />
              </DetailSection>

              {(currentTask.resultDesc || resultPhotos.value.length > 0) && (
                <DetailSection title="提交成果">
                  <Typography.Paragraph style={{ marginBottom: resultPhotos.value.length > 0 ? 12 : 0 }}>
                    {currentTask.resultDesc || '未填写成果说明'}
                  </Typography.Paragraph>
                  {resultPhotos.value.length > 0 && (
                    <Image.PreviewGroup>
                      <Space size={[8, 8]} wrap>
                        {resultPhotos.value.map(url => (
                          <Image key={url} src={url} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 6 }} />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  )}
                </DetailSection>
              )}

              <DetailSection
                title="关联投入品明细"
                flush={usages.value.length > 0}
                extra={
                  usages.value.length > 0 ? (
                    <Typography.Link onClick={() => { activeTab.value = 'usages'; }}>
                      查看全部 {usages.value.length} 项
                    </Typography.Link>
                  ) : undefined
                }
              >
                {usages.value.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联投入品记录" />
                ) : (
                  <Table
                    rowKey="usageId"
                    size="small"
                    columns={usageColumns.value}
                    dataSource={usages.value.slice(0, 5)}
                    pagination={false}
                  />
                )}
              </DetailSection>
            </>
          )}

          {activeTab.value === 'records' && (
            <DetailSection
              title={`执行打卡记录（${timelineItems.value.length} 条）`}
              extra={
                <Button size="small" type="link" onClick={() => { checkInOpen.value = true; }}>
                  + 添加执行记录
                </Button>
              }
              footer={
                (recordQuery.data?.total ?? 0) > 50 ? (
                  <Pagination
                    current={recordPage.value}
                    pageSize={50}
                    total={recordQuery.data?.total ?? 0}
                    onChange={page => { recordPage.value = page; }}
                    showSizeChanger={false}
                    showTotal={total => `共 ${total} 条`}
                  />
                ) : undefined
              }
            >
              {timelineItems.value.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行记录，点击「开始执行」后即可上报打卡" />
              ) : (
                <Timeline items={timelineItems.value as any} />
              )}
            </DetailSection>
          )}

          {activeTab.value === 'usages' && (
            <DetailSection title={`关联投入品明细（${usages.value.length} 条）`} flush={usages.value.length > 0}>
              {usages.value.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联投入品记录" />
              ) : (
                <Table
                  rowKey="usageId"
                  size="small"
                  loading={usagesQuery.isFetching}
                  columns={usageColumns.value}
                  dataSource={usages.value}
                  pagination={usages.value.length > 10 ? { pageSize: 10, size: 'small' } : false}
                />
              )}
            </DetailSection>
          )}

          <ModalForm
            title="转派任务"
            open={assignOpen.value}
            onOpenChange={v => { assignOpen.value = v; }}
            width={480}
            modalProps={{ className: 'production-form-dialog', destroyOnClose: true }}
            onFinish={async values => {
              try {
                await dispatchMutation.mutateAsync(values.assigneeId);
                return true;
              } catch {
                return false;
              }
            }}
          >
            <ProFormSelect
              name="assigneeId"
              label="执行人"
              placeholder="请选择执行人"
              options={memberOptions.value}
              rules={[{ required: true, message: '请选择执行人' }]}
            />
          </ModalForm>

          <ModalForm
            title="添加执行记录"
            open={checkInOpen.value}
            onOpenChange={v => { checkInOpen.value = v; }}
            width={520}
            modalProps={{ className: 'production-form-dialog', destroyOnClose: true }}
            initialValues={{ executeType: 2 }}
            onFinish={async values => {
              try {
                await checkInMutation.mutateAsync(values);
                return true;
              } catch {
                return false;
              }
            }}
          >
            <ProFormRadio.Group
              name="executeType"
              label="记录类型"
              options={TASK_RECORD_TYPE_OPTIONS}
              rules={[{ required: true, message: '请选择记录类型' }]}
            />
            <ProFormSelect
              name="photoList"
              label="现场照片地址"
              mode="tags"
              placeholder="输入图片地址后回车，可添加多张"
              tooltip="移动端为拍照上传（单任务上限 20 张）"
            />
            <ProFormDigit name="gpsLat" label="打卡纬度" fieldProps={{ precision: 6 }} />
            <ProFormDigit name="gpsLng" label="打卡经度" fieldProps={{ precision: 6 }} />
            <ProFormDigit name="gpsDistance" label="距地块中心（米）" fieldProps={{ precision: 2 }} />
            <ProFormTextArea name="abnormalDesc" label="异常说明" placeholder="选填" />
          </ModalForm>

          <ModalForm
            title="提交任务成果"
            open={submitOpen.value}
            onOpenChange={v => { submitOpen.value = v; }}
            width={520}
            modalProps={{ className: 'production-form-dialog', destroyOnClose: true }}
            onFinish={async values => {
              try {
                await submitMutation.mutateAsync(values);
                return true;
              } catch {
                return false;
              }
            }}
          >
            <ProFormTextArea
              name="resultDesc"
              label="成果说明"
              placeholder="填写作业完成情况、用量与异常说明"
              fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
            />
            <ProFormSelect name="resultPhotoUrls" label="成果照片地址" mode="tags" placeholder="输入图片地址后回车，可添加多张" />
          </ModalForm>

          <ModalForm
            title="编辑任务"
            open={editOpen.value}
            onOpenChange={v => { editOpen.value = v; }}
            width={560}
            modalProps={{ className: 'production-form-dialog', destroyOnClose: true }}
            initialValues={{
              taskName: currentTask.taskName,
              taskType: currentTask.taskType,
              priority: currentTask.priority ?? 3,
              assigneeId: currentTask.assigneeId,
              planStartDate: currentTask.planStartDate ? dayjs(currentTask.planStartDate) : undefined,
              planEndDate: currentTask.planEndDate ? dayjs(currentTask.planEndDate) : undefined,
              description: currentTask.description,
            }}
            onFinish={async values => {
              const start = values.planStartDate ? dayjs(values.planStartDate) : undefined;
              const end = values.planEndDate ? dayjs(values.planEndDate) : undefined;
              if (start && end && end.isBefore(start)) {
                message.warning('计划结束时间不能早于开始时间');
                return false;
              }
              try {
                await updateMutation.mutateAsync({
                  taskName: values.taskName,
                  taskType: values.taskType,
                  priority: values.priority,
                  assigneeId: values.assigneeId,
                  planStartDate: start ? start.format('YYYY-MM-DD HH:mm:ss') : undefined,
                  planEndDate: end ? end.format('YYYY-MM-DD HH:mm:ss') : undefined,
                  description: values.description,
                });
                return true;
              } catch {
                return false;
              }
            }}
          >
            <ProFormText name="taskName" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]} />
            <ProFormSelect name="taskType" label="任务类型" options={TASK_TYPE_OPTIONS} rules={[{ required: true, message: '请选择任务类型' }]} />
            <ProFormSelect name="priority" label="优先级" options={TASK_PRIORITY_OPTIONS} rules={[{ required: true, message: '请选择优先级' }]} />
            <ProFormSelect name="assigneeId" label="执行人" options={memberOptions.value} placeholder="请选择执行人" />
            <ProFormDateTimePicker name="planStartDate" label="计划开始时间" />
            <ProFormDateTimePicker name="planEndDate" label="计划结束时间" />
            <ProFormTextArea name="description" label="任务描述" fieldProps={{ rows: 3, maxLength: 500, showCount: true }} />
          </ModalForm>

          <ModalForm
            title={reviewPass.value ? '任务验收通过' : '驳回任务'}
            open={reviewOpen.value}
            onOpenChange={v => { reviewOpen.value = v; }}
            width={480}
            modalProps={{ className: 'production-form-dialog', destroyOnClose: true }}
            onFinish={async values => {
              try {
                await reviewMutation.mutateAsync({ pass: reviewPass.value, remark: values.remark });
                return true;
              } catch {
                return false;
              }
            }}
          >
            <ProFormTextArea
              name="remark"
              label={reviewPass.value ? '验收意见' : '驳回原因'}
              placeholder={reviewPass.value ? '选填，如：现场核查合格' : '请填写驳回原因'}
              rules={reviewPass.value ? undefined : [{ required: true, message: '请填写驳回原因' }]}
              fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
            />
          </ModalForm>
        </ProductionDetailLayout>
      );
    };
  },
});

export default TaskDetail;
