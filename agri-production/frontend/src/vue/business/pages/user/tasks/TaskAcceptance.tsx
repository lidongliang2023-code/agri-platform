import { defineComponent, shallowRef, computed, watch } from 'vue';
import '@/components/ProductionDetailCompact.css';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { ProForm, ProFormRadio, ProFormTextArea } from '@/vue/pro';
import { Alert, Button, Col, Divider, Empty, Image, Pagination, Row, Skeleton, Space, Statistic, Table, Tag, Timeline, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { fetchTaskRecords, getTask, reviewTask } from '@/api/tasks';
import { fetchUsagesByTask } from '@/api/inputs';
import type { InputUsageRecord, TaskRecord } from '@/types';
import { ACCEPT_STATUS_META, TASK_PRIORITY_COLOR_MAP, TASK_PRIORITY_LABEL_MAP, TASK_STATUS_COLOR_MAP, TASK_STATUS_LABEL_MAP, TASK_TYPE_LABEL_MAP } from '@/types';
import { isTaskDone, TASK_ACCEPT_PENDING } from '@/types/task';
import {
  DetailInfoGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
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

interface AcceptanceFormValues {
  pass: boolean;
  remark?: string;
  reason?: string;
}

const TaskAcceptance = defineComponent({
  name: 'TaskAcceptance',
  props: {},
  setup() {
    const _params = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const activeTab = shallowRef<string>('overview');
    const pass = shallowRef<boolean>(true);
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

    const task = computed(() => taskQuery.data);
    const records = computed(() => recordQuery.data?.list ?? []);
    const usages = computed(() => usagesQuery.data ?? []);
    const allPhotos = computed(() => [
      ...records.value.flatMap((record: TaskRecord) => parsePhotoList(record)),
      ...parseUrlList(task.value?.resultPhotoUrls),
    ]);
    const latestRecord = computed<TaskRecord | undefined>(
      () => [...records.value].sort((a, b) => String(b.executeTime).localeCompare(String(a.executeTime)))[0],
    );

    const reviewMutation = useMutation(() => ({
      mutationFn: (values: AcceptanceFormValues) =>
        reviewTask(_params.taskId ?? '', values.pass, values.pass ? values.remark : values.reason),
      onSuccess: (_data, variables) => {
        message.success(variables.pass ? '验收通过，任务已归档' : '已驳回，任务退回执行');
        void queryClient.invalidateQueries({ queryKey: ['production-task', _params.taskId ?? ''] });
        void queryClient.invalidateQueries({ queryKey: ['production-task-records', _params.taskId ?? ''] });
        void queryClient.invalidateQueries({ queryKey: ['production-tasks'] });
        navigate(`/production/tasks/${_params.taskId ?? ''}`);
      },
      onError: (error: Error) => message.error(error.message || '验收提交失败'),
    }));

    const timelineItems = computed(() =>
      records.value.map((record: TaskRecord) => ({
        color: RECORD_TYPE_COLOR[record.executeType] ?? 'blue',
        children: (
          <div>
            <Space size={8} wrap>
              <Typography.Text strong class="detail-info-mono">{record.executeTime ?? '—'}</Typography.Text>
              <Tag>{RECORD_TYPE_TEXT[record.executeType] ?? '执行记录'}</Tag>
              {record.offlineFlag === 1 && <Tag color="orange">离线补传</Tag>}
            </Space>
            <div>
              <Typography.Text type="secondary">
                {record.executorName ?? record.executorId ?? '—'}
                {record.gpsLat && record.gpsLng ? ` ｜ GPS：${record.gpsLat}, ${record.gpsLng}` : ''}
                {record.gpsDistance ? ` ｜ 距地块中心 ${record.gpsDistance} 米` : ''}
              </Typography.Text>
            </div>
            {record.abnormalDesc && (
              <div>
                <Typography.Text type="warning">异常：{record.abnormalDesc}</Typography.Text>
              </div>
            )}
          </div>
        ),
      })),
    );

    const usageColumns = computed<ColumnsType<InputUsageRecord>>(() => [
      { title: '投入品', dataIndex: 'inputName', render: (val: string) => val ?? '投入品' },
      {
        title: '施用用量',
        key: 'dosage',
        width: 140,
        align: 'right',
        render: (_: unknown, row: InputUsageRecord) => (
          <span class="detail-info-mono">{row.dosage == null ? '未登记' : `${row.dosage} ${row.unit ?? ''}`}</span>
        ),
      },
      { title: '使用时间', dataIndex: 'usedAt', width: 170, render: (val: string) => <span class="detail-info-mono">{val || '—'}</span> },
    ]);

    return () => {
      if (taskQuery.isLoading) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="任务验收" hasAside={false} onBack={() => navigate(`/production/tasks/${_params.taskId ?? ''}`)}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 6 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (taskQuery.isError || !task.value) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="任务验收" hasAside={false} onBack={() => navigate('/production/tasks')}>
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
      const canReview = isTaskDone(currentTask.status) && currentTask.acceptStatus === TASK_ACCEPT_PENDING;
      const acceptMeta = ACCEPT_STATUS_META[currentTask.acceptStatus] ?? { label: '待验收', color: 'gold' };

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '验收核查' },
        { key: 'photos', label: '现场照片', count: allPhotos.value.length },
        { key: 'records', label: '执行时间轴', count: records.value.length },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'done',
          title: '作业成果提交',
          time: currentTask.completedAt ?? currentTask.actualEndDate ?? undefined,
          description: currentTask.resultDesc || '已提交现场记录',
          state: isTaskDone(currentTask.status) ? 'done' : 'current',
        },
        {
          key: 'check',
          title: '现场照片与 GPS 核查',
          description: `照片 ${allPhotos.value.length} 张 · 打卡 ${records.value.length} 条`,
          state: allPhotos.value.length > 0 || records.value.length > 0 ? 'done' : 'pending',
        },
        {
          key: 'review',
          title: currentTask.acceptStatus === 1 ? '验收已通过' : currentTask.acceptStatus === 2 ? '已驳回重做' : '等待验收结论',
          description: canReview ? '当前节点 · 请在下方提交结论' : currentTask.acceptRemark || undefined,
          state: currentTask.acceptStatus === 1 ? 'done' : currentTask.acceptStatus === 2 ? 'error' : canReview ? 'current' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'task',
          label: '关联任务',
          code: currentTask.taskNo || _params.taskId,
          onClick: () => navigate(`/production/tasks/${_params.taskId ?? ''}`),
        },
        {
          key: 'plot',
          label: '作业地块',
          text: currentTask.plotName ?? currentTask.plotId ?? undefined,
          emptyText: '未关联',
          mono: !currentTask.plotName,
          onClick: currentTask.plotId ? () => navigate(`/production/plots/${currentTask.plotId}`) : undefined,
        },
        {
          key: 'inputs',
          label: '施用投入品',
          text: usages.value.length > 0 ? `${usages.value.length} 项记录` : undefined,
          emptyText: '未登记投入品',
          mono: false,
        },
      ];

      return (
        <ProductionDetailLayout
          class="production-detail-compact"
          code={currentTask.taskNo || undefined}
          title={`任务验收 · ${currentTask.taskName}`}
          status={{ label: acceptMeta.label, tone: acceptMeta.color }}
          extraStatuses={[
            {
              label: TASK_STATUS_LABEL_MAP[currentTask.status] ?? currentTask.status,
              tone: TASK_STATUS_COLOR_MAP[currentTask.status] ?? 'default',
            },
          ]}
          meta={[
            { label: '执行人', value: currentTask.assigneeName ?? '未派发' },
            { label: '地块', value: currentTask.plotName ?? currentTask.plotId ?? '—' },
            { label: '完成时间', value: currentTask.completedAt ?? currentTask.actualEndDate ?? '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回任务详情"
          onBack={() => navigate(`/production/tasks/${_params.taskId ?? ''}`)}
          onTabChange={key => {
            activeTab.value = key;
          }}
          banner={
            <>
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
              {currentTask.acceptStatus !== 0 && (
                <Alert
                  type={currentTask.acceptStatus === 1 ? 'success' : 'error'}
                  showIcon
                  message={`当前验收结论：${acceptMeta.label}`}
                  description={currentTask.acceptRemark ?? '无验收意见'}
                />
              )}
              {!canReview && currentTask.acceptStatus !== 1 && (
                <Alert
                  type="warning"
                  showIcon
                  message={
                    currentTask.acceptStatus === 2
                      ? '任务已驳回，执行人重新开始执行并提交成果后可再次验收'
                      : `任务当前状态为「${TASK_STATUS_LABEL_MAP[currentTask.status] ?? currentTask.status}」，执行人提交成果后可进行验收`
                  }
                />
              )}
            </>
          }
          actions={
            <Button onClick={() => navigate(`/production/tasks/${_params.taskId ?? ''}`)}>返回任务详情</Button>
          }
          aside={
            <>
              <DetailSection title="验收进度">
                <DetailTimeline items={progressSteps} />
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
                    { key: 'taskNo', label: '任务编号', value: currentTask.taskNo ?? '—', mono: true },
                    { key: 'taskName', label: '任务名称', value: currentTask.taskName },
                    { key: 'taskType', label: '任务类型', value: <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[currentTask.taskType] ?? currentTask.taskType}</Tag> },
                    {
                      key: 'priority',
                      label: '优先级',
                      value: (
                        <Tag color={TASK_PRIORITY_COLOR_MAP[currentTask.priority] ?? 'default'}>
                          {TASK_PRIORITY_LABEL_MAP[currentTask.priority] ?? '普通'}
                        </Tag>
                      ),
                    },
                    { key: 'plot', label: '作业地块', value: currentTask.plotName ?? currentTask.plotId ?? '—' },
                    { key: 'assignee', label: '执行人', value: currentTask.assigneeName ?? '未派发' },
                    { key: 'plan', label: '计划时间', value: `${currentTask.planStartDate ?? '—'} ~ ${currentTask.planEndDate ?? '—'}`, mono: true },
                    { key: 'rejectCount', label: '历史驳回', value: `${currentTask.rejectCount ?? 0} 次`, mono: true },
                    ...(currentTask.resultDesc ? [{ key: 'resultDesc', label: '成果说明', fullWidth: true, value: currentTask.resultDesc }] : []),
                  ]}
                />
              </DetailSection>

              <DetailSection title="GPS 打卡与投入品用量">
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}><Statistic title="打卡记录" value={records.value.length} suffix="条" /></Col>
                  <Col span={8}><Statistic title="距地块中心" value={latestRecord.value?.gpsDistance ?? 0} precision={2} suffix="米" /></Col>
                  <Col span={8}><Statistic title="关联投入品" value={usages.value.length} suffix="项" /></Col>
                </Row>
                <Divider />
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'latestTime', label: '最近打卡', value: latestRecord.value?.executeTime ?? '—', mono: true },
                    {
                      key: 'gps',
                      label: '打卡坐标',
                      value: latestRecord.value?.gpsLat && latestRecord.value?.gpsLng ? `${latestRecord.value.gpsLat}, ${latestRecord.value.gpsLng}` : '—',
                      mono: true,
                    },
                    { key: 'offline', label: '离线补传', value: latestRecord.value?.offlineFlag === 1 ? <Tag color="orange">是</Tag> : '否' },
                    { key: 'abnormal', label: '异常说明', value: latestRecord.value?.abnormalDesc ?? '无' },
                  ]}
                />
                {usages.value.length > 0 && (
                  <>
                    <Divider />
                    <Table rowKey="usageId" size="small" columns={usageColumns.value} dataSource={usages.value} pagination={false} />
                  </>
                )}
              </DetailSection>

              <DetailSection title="验收结论">
                <ProForm
                  layout="vertical"
                  submitter={{
                    searchConfig: { submitText: '提交验收结论', resetText: '重置' },
                    submitButtonProps: { disabled: !canReview, loading: reviewMutation.isPending },
                    render: (_props, dom) => (
                      <Space>
                        {dom}
                        <Button onClick={() => navigate(`/production/tasks/${_params.taskId ?? ''}`)}>取消</Button>
                      </Space>
                    ),
                  }}
                  initialValues={{ pass: true }}
                  onFinish={async values => {
                    if (!values.pass && !values.reason) {
                      message.warning('驳回时必须填写驳回原因');
                      return false;
                    }
                    try {
                      await reviewMutation.mutateAsync(values);
                      return true;
                    } catch {
                      return false;
                    }
                  }}
                >
                  <ProFormRadio.Group
                    name="pass"
                    label="验收结论"
                    rules={[{ required: true, message: '请选择验收结论' }]}
                    options={[
                      { value: true, label: '验收通过' },
                      { value: false, label: '驳回重做（退回执行人）' },
                    ]}
                    fieldProps={{
                      onChange: (event: { target?: { value?: unknown } }) => {
                        pass.value = Boolean(event?.target?.value ?? '');
                      },
                    }}
                  />
                  {pass.value ? (
                    <ProFormTextArea
                      name="remark"
                      label="验收意见"
                      placeholder="选填，可填写完成质量评价"
                      fieldProps={{ rows: 3, maxLength: 300, showCount: true }}
                    />
                  ) : (
                    <ProFormTextArea
                      name="reason"
                      label="驳回原因"
                      placeholder="必填，请说明驳回原因与整改要求"
                      rules={[{ required: true, message: '驳回时必须填写原因' }]}
                      fieldProps={{ rows: 3, maxLength: 300, showCount: true }}
                    />
                  )}
                </ProForm>
              </DetailSection>
            </>
          )}

          {activeTab.value === 'photos' && (
            <DetailSection title={`现场与成果照片（${allPhotos.value.length} 张）`}>
              {allPhotos.value.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无现场照片" />
              ) : (
                <Image.PreviewGroup>
                  <Space size={[8, 8]} wrap>
                    {allPhotos.value.map(url => (
                      <Image key={url} src={url} width={104} height={104} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              )}
            </DetailSection>
          )}

          {activeTab.value === 'records' && (
            <DetailSection
              title={`执行时间轴（${records.value.length} 条）`}
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行记录" />
              ) : (
                <Timeline items={timelineItems.value} />
              )}
            </DetailSection>
          )}
        </ProductionDetailLayout>
      );
    };
  },
});

export default TaskAcceptance;
