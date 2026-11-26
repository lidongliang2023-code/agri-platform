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
/**
 * 页面名称：任务详情
 * 路由路径：/production/tasks/:taskId
 * 所属模块：农事生产
 * PRD 序号：PRD 6.1 #15
 * 原型来源：用户端原型 P9 task-detail
 *
 * 还原要点：
 * - 头部「< 返回 任务名」+ 开始执行 / 编辑 / 转派 按钮
 * - 卡片「📋 任务信息」：任务编号 / 状态 / 优先级 / 类型 / 农场 / 地块 / 执行人 /
 *   计划时间 / 任务描述
 * - 卡片「📋 执行记录」：时间轴（打卡时间 / 类型 / 照片 / GPS），空态提示
 * - 关联地块与投入品卡片
 * - 底部操作：开始执行 / 提交成果 / 验收通过 / 驳回 / 转派 / 编辑 / 删除
 */

import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { ModalForm, ProFormDateTimePicker, ProFormDigit, ProFormRadio, ProFormSelect, ProFormText, ProFormTextArea } from '@/vue/pro';
import { PageContainer as PageContainer } from '@/vue/pro';
import { Pagination, Alert, Button, Col, Divider, Empty, Image, Popconfirm, Row, Skeleton, Space, Tag, Timeline, Typography, message } from '@/vue/ui';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons-vue';
import Card from '@/vue/business/components/SectionCard';
import dayjs from 'dayjs';
import { createTaskRecord, deleteTask, dispatchTask, executeTask, fetchTaskRecords, getTask, reviewTask, submitTaskResult, updateTask } from '@/api/tasks';
import { fetchUsagesByTask } from '@/api/inputs';
import { getPlot } from '@/api/plots';
import { listMembers } from '@/api/members';
import type { InputUsageRecord, Member, Task, TaskRecord } from '@/types';
import { ACCEPT_STATUS_META, TASK_ACCEPT_PENDING, TASK_PRIORITY_LABEL_MAP, TASK_PRIORITY_OPTIONS, TASK_RECORD_TYPE_OPTIONS, TASK_STATUS_COLOR_MAP, TASK_STATUS_LABEL_MAP, TASK_TYPE_LABEL_MAP, TASK_TYPE_OPTIONS } from '@/types';
import { isTaskDone, isTaskExecuting } from '@/types/task';
import { DetailInfoGrid } from '@/vue/business/components/index';
import type { DetailInfoItem } from '@/vue/business/components/index';

/** 执行记录类型文本 */
const RECORD_TYPE_TEXT: Record<number, string> = {
  1: '开始执行',
  2: '过程记录',
  3: '完成打卡'
};

/** 执行记录时间轴颜色 */
const RECORD_TYPE_COLOR: Record<number, string> = {
  1: 'blue',
  2: 'gray',
  3: 'green'
};

/** 解析照片字段（后端为 JSON 数组字符串或逗号分隔） */
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

/** 打卡表单值 */
interface CheckInFormValues {
  /** 记录类型 */
  executeType: 1 | 2 | 3;
  /** 照片地址 */
  photoList?: string[];
  /** 纬度 */
  gpsLat?: number;
  /** 经度 */
  gpsLng?: number;
  /** 距地块中心距离（米） */
  gpsDistance?: number;
  /** 异常说明 */
  abnormalDesc?: string;
}

/** 验收表单值 */
interface ReviewFormValues {
  /** true 通过 / false 驳回 */
  pass: boolean;
  /** 验收意见 / 驳回原因 */
  remark?: string;
}

/** 提交成果表单值 */
interface SubmitFormValues {
  /** 成果说明 */
  resultDesc?: string;
  /** 成果照片地址 */
  resultPhotoUrls?: string[];
}

/**
 * 解析照片地址字段（JSON 数组字符串或逗号分隔）。
 *
 * @param raw 原始字段
 * @returns 地址列表
 */
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

/**
 * 任务详情页
 *
 * 业务职责：展示任务档案与执行流水，支持开始执行、打卡、提交、验收、转派、编辑与删除。
 *
 * @returns 页面内容
 */
const TaskDetail = defineComponent({
  name: "TaskDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _params = useParams<{
      taskId: string;
    }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const assignOpen = shallowRef<boolean>(false);
    const setAssignOpen = (next: typeof assignOpen.value | ((previous: typeof assignOpen.value) => typeof assignOpen.value)) => {
      assignOpen.value = typeof next === 'function' ? (next as (previous: typeof assignOpen.value) => typeof assignOpen.value)(assignOpen.value) : next;
    };
    const checkInOpen = shallowRef<boolean>(false);
    const setCheckInOpen = (next: typeof checkInOpen.value | ((previous: typeof checkInOpen.value) => typeof checkInOpen.value)) => {
      checkInOpen.value = typeof next === 'function' ? (next as (previous: typeof checkInOpen.value) => typeof checkInOpen.value)(checkInOpen.value) : next;
    };
    const editOpen = shallowRef<boolean>(false);
    const setEditOpen = (next: typeof editOpen.value | ((previous: typeof editOpen.value) => typeof editOpen.value)) => {
      editOpen.value = typeof next === 'function' ? (next as (previous: typeof editOpen.value) => typeof editOpen.value)(editOpen.value) : next;
    };
    const submitOpen = shallowRef<boolean>(false);
    const setSubmitOpen = (next: typeof submitOpen.value | ((previous: typeof submitOpen.value) => typeof submitOpen.value)) => {
      submitOpen.value = typeof next === 'function' ? (next as (previous: typeof submitOpen.value) => typeof submitOpen.value)(submitOpen.value) : next;
    };
    const reviewOpen = shallowRef<boolean>(false);
    const setReviewOpen = (next: typeof reviewOpen.value | ((previous: typeof reviewOpen.value) => typeof reviewOpen.value)) => {
      reviewOpen.value = typeof next === 'function' ? (next as (previous: typeof reviewOpen.value) => typeof reviewOpen.value)(reviewOpen.value) : next;
    };
    const reviewPass = shallowRef<boolean>(true);

    /** 任务详情 */
    const setReviewPass = (next: typeof reviewPass.value | ((previous: typeof reviewPass.value) => typeof reviewPass.value)) => {
      reviewPass.value = typeof next === 'function' ? (next as (previous: typeof reviewPass.value) => typeof reviewPass.value)(reviewPass.value) : next;
    };
    const taskQuery = useQuery(() => ({
      queryKey: ['production-task', _params.taskId ?? ''],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => getTask(_params.taskId ?? '')
    }));
    const recordPage = shallowRef(1);
    const setRecordPage = (next: typeof recordPage.value | ((previous: typeof recordPage.value) => typeof recordPage.value)) => {
      recordPage.value = typeof next === 'function' ? (next as (previous: typeof recordPage.value) => typeof recordPage.value)(recordPage.value) : next;
    };
    const task = computed(() => taskQuery.data);
    /** 可开始执行 / 可编辑 / 可转派：待处理、已派发、验收驳回后 */
    const canStartTask = computed(() => Boolean(task.value && ['pending', 'assigned', 'rejected'].includes(task.value.status)));
    /** 可提交成果：执行中 */
    const canSubmitTask = computed(() => Boolean(task.value && isTaskExecuting(task.value.status)));
    /** 可验收：已提交成果（completed/done）且验收状态为待验收 */
    const canAcceptTask = computed(() => Boolean(task.value && isTaskDone(task.value.status) && task.value.acceptStatus === TASK_ACCEPT_PENDING));

    /** 执行记录 */
    const recordQuery = useQuery(() => ({
      queryKey: ['production-task-records', _params.taskId ?? '', recordPage.value],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => fetchTaskRecords(_params.taskId ?? '', recordPage.value, 50)
    }));

    /** 本任务关联的投入品使用记录（真实台账，不再依赖不存在的 relatedUsageIds 字段） */
    const usagesQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'usages', 'task', _params.taskId ?? ''],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => fetchUsagesByTask(_params.taskId ?? '')
    }));

    /** 关联地块 */
    const plotQuery = useQuery(() => ({
      queryKey: ['production-task-plot', task.value?.plotId],
      enabled: Boolean(task.value?.plotId),
      queryFn: () => getPlot(task.value?.plotId ?? '')
    }));

    /** 执行人下拉（转派 / 编辑使用，与列表页共用缓存键） */
    const memberQuery = useQuery(() => ({
      queryKey: ['member-options', task.value?.farmId],
      queryFn: () => listMembers({
        farmId: task.value?.farmId,
        pageNum: 1,
        pageSize: 100
      })
    }));
    const memberOptions = computed(() => (memberQuery.data?.list ?? []).map((member: Member) => ({
      value: member.memberId,
      label: member.realName
    })));

    /** 刷新任务与记录 */
    const refreshTask = (): Promise<void> => queryClient.invalidateQueries({
      queryKey: ['production-task', _params.taskId ?? '']
    }).then(() => queryClient.invalidateQueries({
      queryKey: ['production-task-records', _params.taskId ?? '']
    })).then(() => queryClient.invalidateQueries({
      queryKey: ['production-inputs', 'usages', 'task', _params.taskId ?? '']
    })).then(() => queryClient.invalidateQueries({
      queryKey: ['production-tasks']
    })).then(() => undefined);

    /** 开始执行 */
    const startMutation = useMutation(() => ({
      mutationFn: () => executeTask(_params.taskId ?? ''),
      onSuccess: () => {
        message.success('任务已开始执行');
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '开始执行失败')
    }));

    /** 提交成果 */
    const submitMutation = useMutation(() => ({
      mutationFn: (values: SubmitFormValues) => submitTaskResult(_params.taskId ?? '', {
        resultDesc: values.resultDesc,
        resultPhotoUrls: values.resultPhotoUrls && values.resultPhotoUrls.length > 0 ? JSON.stringify(values.resultPhotoUrls) : undefined
      }),
      onSuccess: () => {
        message.success('成果已提交，等待验收');
        setSubmitOpen(false);
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '提交成果失败')
    }));

    /** 验收（通过 / 驳回） */
    const reviewMutation = useMutation(() => ({
      mutationFn: (values: ReviewFormValues) => reviewTask(_params.taskId ?? '', values.pass, values.remark),
      onSuccess: (_data, variables) => {
        message.success(variables.pass ? '验收已通过' : '已驳回，等待重新执行');
        setReviewOpen(false);
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '验收提交失败')
    }));

    /** 转派 */
    const dispatchMutation = useMutation(() => ({
      mutationFn: (assigneeId: string) => dispatchTask(_params.taskId ?? '', assigneeId),
      onSuccess: () => {
        message.success('任务已转派');
        setAssignOpen(false);
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '转派失败')
    }));

    /** 编辑任务 */
    const updateMutation = useMutation(() => ({
      mutationFn: (payload: Partial<Task>) => updateTask(_params.taskId ?? '', payload),
      onSuccess: () => {
        message.success('任务已更新');
        setEditOpen(false);
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '任务更新失败')
    }));

    /** 删除任务 */
    const deleteMutation = useMutation(() => ({
      mutationFn: () => deleteTask(_params.taskId ?? ''),
      onSuccess: () => {
        message.success('任务已删除');
        void queryClient.invalidateQueries({
          queryKey: ['production-tasks']
        });
        navigate('/production/tasks');
      },
      onError: (error: Error) => message.error(error.message || '删除失败')
    }));

    /** 新增执行记录（打卡） */
    const checkInMutation = useMutation(() => ({
      mutationFn: (values: CheckInFormValues) => createTaskRecord(_params.taskId ?? '', {
        taskId: _params.taskId ?? '',
        executeType: values.executeType,
        executeTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        photos: JSON.stringify(values.photoList ?? []),
        gpsLat: values.gpsLat,
        gpsLng: values.gpsLng,
        gpsDistance: values.gpsDistance,
        abnormalDesc: values.abnormalDesc
      }),
      onSuccess: () => {
        message.success('执行记录已上报');
        setCheckInOpen(false);
        void refreshTask();
      },
      onError: (error: Error) => message.error(error.message || '执行记录上报失败')
    }));

    /** 任务信息描述项 */
    const baseItems = computed<DetailInfoItem[]>(() => {
      if (!task.value) return [];
      return [{
        key: 'taskNo',
        label: '任务编号',
        value: task.value.taskNo ?? '-'
      }, {
        key: 'priority',
        label: '优先级',
        value: TASK_PRIORITY_LABEL_MAP[task.value.priority] ?? '普通'
      }, {
        key: 'taskType',
        label: '任务类型',
        value: TASK_TYPE_LABEL_MAP[task.value.taskType] ?? task.value.taskType
      }, {
        key: 'farm',
        label: '所属农场',
        value: task.value.farmName ?? '-'
      }, {
        key: 'plot',
        label: '地块',
        value: task.value.plotName ?? task.value.plotId ?? '-'
      }, {
        key: 'assignee',
        label: '执行人',
        value: task.value.assigneeName ?? '未派发'
      }, {
        key: 'assigner',
        label: '派发人',
        value: task.value.assignerName ?? '-'
      }, {
        key: 'plan',
        label: '计划时间',
        value: `${task.value.planStartDate ?? '-'} ~ ${task.value.planEndDate ?? '-'}`
      }, {
        key: 'actual',
        label: '实际执行',
        value: `${task.value.actualStartDate ?? '-'} ~ ${task.value.actualEndDate ?? task.value.completedAt ?? '-'}`
      }, {
        key: 'accept',
        label: '验收状态',
        value: <Space size={4} wrap>
            <Tag color={ACCEPT_STATUS_META[task.value.acceptStatus]?.color ?? 'gold'}>
              {ACCEPT_STATUS_META[task.value.acceptStatus]?.label ?? '待验收'}
            </Tag>
            {task.value.rejectCount > 0 && <Tag color="volcano">驳回 {task.value.rejectCount} 次</Tag>}
          </Space>
      }, {
        key: 'rejectCount',
        label: '驳回次数',
        value: `${task.value.rejectCount ?? 0} 次`
      }, {
        key: 'templateId',
        label: '关联模板',
        value: task.value.templateId ?? '未关联'
      }, {
        key: 'cropName',
        label: '适用作物',
        value: task.value.cropName || '-'
      }, {
        key: 'inputs',
        label: '所需投入品',
        value: task.value.inputMaterials || '-',
        fullWidth: true
      }, {
        key: 'quality',
        label: '质量要求',
        value: task.value.qualityRequirement || '-',
        fullWidth: true
      }, {
        key: 'remark',
        label: '备注',
        value: task.value.remark || '-',
        fullWidth: true
      }, {
        key: 'description',
        label: '任务描述',
        fullWidth: true,
        value: task.value.description ?? '暂无描述'
      }];
    });

    /** 执行记录时间轴 */
    const timelineItems = computed(() => {
      const records = recordQuery.data?.list ?? [];
      const items: {
        color: string;
        children: VNodeChild;
      }[] = [];
      if (task.value?.createdAt) {
        items.push({
          color: 'gray',
          children: <div>
            <Typography.Text strong>
              {dayjs(task.value.createdAt).format('YYYY-MM-DD HH:mm')}
            </Typography.Text>
            <div>
              <Typography.Text>任务已创建，待执行</Typography.Text>
            </div>
            <Typography.Text type="secondary">系统</Typography.Text>
          </div>
        });
      }
      records.forEach((record: TaskRecord) => {
        const photos = parsePhotoList(record);
        items.push({
          color: RECORD_TYPE_COLOR[record.executeType] ?? 'blue',
          children: <div>
            <Space size={8} wrap>
              <Typography.Text strong>{record.executeTime ?? '-'}</Typography.Text>
              <Tag color={RECORD_TYPE_COLOR[record.executeType] === 'green' ? 'green' : 'blue'}>
                {RECORD_TYPE_TEXT[record.executeType] ?? '执行记录'}
              </Tag>
              {record.offlineFlag === 1 && <Tag color="orange">离线补传</Tag>}
            </Space>
            <div>
              <Typography.Text type="secondary">
                执行人：{record.executorName ?? record.executorId ?? '-'}
                {record.gpsLat && record.gpsLng ? ` ｜ GPS：${record.gpsLat}, ${record.gpsLng}` : ''}
                {record.gpsDistance ? ` ｜ 距地块中心 ${record.gpsDistance} 米` : ''}
              </Typography.Text>
            </div>
            {record.abnormalDesc && <div>
                <Typography.Text type="warning">异常：{record.abnormalDesc}</Typography.Text>
              </div>}
            {photos.length > 0 && <Image.PreviewGroup>
                <Space size={8} wrap style={{
                marginTop: 8
              }}>
                  {photos.map(url => <Image key={url} src={url} width={72} height={72} style={{
                  objectFit: 'cover'
                }} />)}
                </Space>
              </Image.PreviewGroup>}
          </div>
        });
      });
      return items;
    });

    /** 关联投入品使用记录 */
    const usages = computed(() => usagesQuery.data ?? []);

    /** 提交成果照片 */
    const resultPhotos = computed(() => parseUrlList(task.value?.resultPhotoUrls));
    return () => {
      if (taskQuery.isLoading) {
        return <PageContainer class="production-detail-compact" title="任务详情">
        <Card>
          <Skeleton active paragraph={{
              rows: 6
            }} />
        </Card>
      </PageContainer>;
      }
      if (taskQuery.isError || !task.value) {
        return <PageContainer class="production-detail-compact" title="任务详情">
        <Card>
          <Empty description={<Space direction="vertical">
                <Typography.Text type="danger">任务不存在或加载失败</Typography.Text>
                <Button onClick={() => navigate('/production/tasks')}>返回任务列表</Button>
              </Space>} />
        </Card>
      </PageContainer>;
      }
      return <PageContainer class="production-detail-compact" title={`📋 ${task.value.taskName}`} subTitle={task.value.taskNo} onBack={() => navigate('/production/tasks')} backIcon={<ArrowLeftOutlined />} extra={[<Tag key="status" color={TASK_STATUS_COLOR_MAP[task.value.status] ?? 'default'}>
          {TASK_STATUS_LABEL_MAP[task.value.status] ?? task.value.status}
        </Tag>, <Button key="edit" disabled={!canStartTask.value} onClick={() => setEditOpen(true)}>
          编辑
        </Button>, <Button key="assign" disabled={!canStartTask.value} onClick={() => setAssignOpen(true)}>
          转派
        </Button>]}>
      <Card title="📋 基本信息" style={{
          marginBottom: 16
        }} extra={<Tag color={TASK_STATUS_COLOR_MAP[task.value.status] ?? 'default'}>
            {TASK_STATUS_LABEL_MAP[task.value.status] ?? task.value.status}
          </Tag>}>
        <DetailInfoGrid columns={2} items={baseItems.value} />
        {task.value.acceptStatus === 2 && task.value.acceptRemark && <Alert style={{
            marginTop: 16
          }} type="error" showIcon message="验收驳回意见" description={task.value.acceptRemark} />}
      </Card>

        {(recordQuery.isError || usagesQuery.isError) && <Alert type="error" showIcon message="执行记录或投入品加载失败，不能据此认定没有记录" action={<Button onClick={() => {
          void recordQuery.refetch();
          void usagesQuery.refetch();
        }}>重试</Button>} />}
      {plotQuery.isError && <Alert type="error" message="关联地块加载失败" action={<Button onClick={() => void plotQuery.refetch()}>重试</Button>} />}
      <Pagination current={recordPage.value} pageSize={50} total={recordQuery.data?.total ?? 0} onChange={setRecordPage} showSizeChanger={false} showTotal={total => `共 ${total} 条`} style={{
          marginBottom: 16
        }} />
      {(task.value.resultDesc || resultPhotos.value.length > 0) && <Card title="📤 提交成果" style={{
          marginBottom: 16
        }}>
          <Typography.Paragraph style={{
            marginBottom: resultPhotos.value.length > 0 ? 12 : 0
          }}>
            {task.value.resultDesc || '未填写成果说明'}
          </Typography.Paragraph>
          {resultPhotos.value.length > 0 && <Image.PreviewGroup>
              <Space size={[8, 8]} wrap>
                {resultPhotos.value.map(url => <Image key={url} src={url} width={96} height={96} style={{
                objectFit: 'cover',
                borderRadius: 4
              }} />)}
              </Space>
            </Image.PreviewGroup>}
        </Card>}

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title={`📋 执行记录（${timelineItems.value.length} 条）`} extra={<Button type="link" onClick={() => setCheckInOpen(true)}>
                + 添加执行记录
              </Button>}>
            {timelineItems.value.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">
                    📝 暂无执行记录，点击"开始执行"后记录
                  </Typography.Text>} /> : <Timeline items={timelineItems.value} />}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="🌾 关联地块" style={{
              marginBottom: 16
            }}>
            {plotQuery.data ? <DetailInfoGrid columns={1} items={[{
                key: 'plotName',
                label: '地块名称',
                value: plotQuery.data.plotName
              }, {
                key: 'plotCode',
                label: '地块编码',
                value: plotQuery.data.plotCode
              }, {
                key: 'area',
                label: '面积（亩）',
                value: plotQuery.data.area
              }, {
                key: 'crop',
                label: '当前作物',
                value: plotQuery.data.cropVariety ?? '-'
              }, {
                key: 'irrigation',
                label: '灌溉方式',
                value: plotQuery.data.irrigationType ?? '-'
              }]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">未关联地块</Typography.Text>} />}
          </Card>

          <Card title={`💊 关联投入品（${usages.value.length} 条）`} loading={usagesQuery.isFetching}>
            {usages.value.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">暂无关联投入品记录</Typography.Text>} /> : <Space direction="vertical" size={8} style={{
                width: '100%'
              }}>
                {usages.value.map((usage: InputUsageRecord) => <Card key={usage.usageId} size="small" bodyStyle={{
                  padding: 10
                }}>
                    <Space direction="vertical" size={2} style={{
                    width: '100%'
                  }}>
                      <Space size={8} wrap>
                        <Typography.Link onClick={() => navigate(`/production/inputs?tab=ledger&usageId=${encodeURIComponent(usage.usageId)}`)}>
                          {usage.inputName ?? '投入品使用记录'}
                        </Typography.Link>
                        <Tag color="green">
                          {usage.dosage === undefined || usage.dosage === null ? '用量未登记' : `${usage.dosage} ${usage.unit ?? ''}`}
                        </Tag>
                      </Space>
                      <Typography.Text type="secondary" style={{
                      fontSize: 12
                    }}>
                        {usage.usedAt ? dayjs(usage.usedAt).format('YYYY-MM-DD HH:mm') : '-'}
                        {usage.plotId ? ` ｜ 地块 ${usage.plotId}` : ''}
                      </Typography.Text>
                    </Space>
                  </Card>)}
              </Space>}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="⚙️ 任务操作">
        <Space wrap>
          <Button type="primary" icon={<PlayCircleOutlined />} disabled={!canStartTask.value} loading={startMutation.isPending} onClick={() => startMutation.mutate()}>
            开始执行
          </Button>
          <Button disabled={!canSubmitTask.value} onClick={() => setSubmitOpen(true)}>
            提交成果
          </Button>
          {canAcceptTask.value && <Button onClick={() => navigate(`/production/tasks/${_params.taskId ?? ''}/acceptance`)}>
              前往验收
            </Button>}
          <Button type="primary" icon={<CheckCircleOutlined />} disabled={!canAcceptTask.value} loading={reviewMutation.isPending} onClick={() => {
              setReviewPass(true);
              setReviewOpen(true);
            }}>
            验收通过
          </Button>
          <Button danger icon={<CloseCircleOutlined />} disabled={!canAcceptTask.value} onClick={() => {
              setReviewPass(false);
              setReviewOpen(true);
            }}>
            驳回
          </Button>
          <Popconfirm title="确认删除该任务？" description="删除后不可恢复，请谨慎操作。" okText="确认删除" cancelText="取消" onConfirm={() => deleteMutation.mutate()}>
            <Button danger disabled={isTaskExecuting(task.value.status)} loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
        {isTaskExecuting(task.value.status) && <Typography.Text type="secondary" style={{
            display: 'block',
            marginTop: 8
          }}>
            执行中的任务不能删除；提交成果并通过验收后自动归档。
          </Typography.Text>}
      </Card>

      {/* 转派弹窗 */}
      <ModalForm title="转派任务" open={assignOpen.value} onOpenChange={setAssignOpen} width={480} modalProps={{
          className: "production-form-dialog",
          destroyOnClose: true
        }} onFinish={async values => {
          try {
            await dispatchMutation.mutateAsync(values.assigneeId);
            return true;
          } catch {
            return false;
          }
        }}>
        <ProFormSelect name="assigneeId" label="执行人" placeholder="请选择执行人" options={memberOptions.value} rules={[{
            required: true,
            message: '请选择执行人'
          }]} />
      </ModalForm>

      {/* 执行记录打卡弹窗 */}
      <ModalForm title="添加执行记录" open={checkInOpen.value} onOpenChange={setCheckInOpen} width={520} modalProps={{
          className: "production-form-dialog",
          destroyOnClose: true
        }} initialValues={{
          executeType: 2
        }} onFinish={async values => {
          try {
            await checkInMutation.mutateAsync(values);
            return true;
          } catch {
            return false;
          }
        }}>
        <ProFormRadio.Group name="executeType" label="记录类型" options={TASK_RECORD_TYPE_OPTIONS} rules={[{
            required: true,
            message: '请选择记录类型'
          }]} />
        <ProFormSelect name="photoList" label="现场照片地址" mode="tags" placeholder="输入图片地址后回车，可添加多张" tooltip="移动端为拍照上传（单任务上限 20 张）" />
        <ProFormDigit name="gpsLat" label="打卡纬度" fieldProps={{
            precision: 6
          }} />
        <ProFormDigit name="gpsLng" label="打卡经度" fieldProps={{
            precision: 6
          }} />
        <ProFormDigit name="gpsDistance" label="距地块中心（米）" fieldProps={{
            precision: 2
          }} />
        <ProFormTextArea name="abnormalDesc" label="异常说明" placeholder="选填" />
      </ModalForm>

      {/* 提交成果弹窗 */}
      <ModalForm title="提交任务成果" open={submitOpen.value} onOpenChange={setSubmitOpen} width={520} modalProps={{
          className: "production-form-dialog",
          destroyOnClose: true
        }} onFinish={async values => {
          try {
            await submitMutation.mutateAsync(values);
            return true;
          } catch {
            return false;
          }
        }}>
        <ProFormTextArea name="resultDesc" label="成果说明" placeholder="填写作业完成情况、用量与异常说明" fieldProps={{
            rows: 4,
            maxLength: 500,
            showCount: true
          }} />
        <ProFormSelect name="resultPhotoUrls" label="成果照片地址" mode="tags" placeholder="输入图片地址后回车，可添加多张" />
      </ModalForm>

      {/* 编辑任务弹窗 */}
      <ModalForm title="编辑任务" open={editOpen.value} onOpenChange={setEditOpen} width={560} modalProps={{
          className: "production-form-dialog",
          destroyOnClose: true
        }} initialValues={{
          taskName: task.value.taskName,
          taskType: task.value.taskType,
          priority: task.value.priority ?? 3,
          assigneeId: task.value.assigneeId,
          planStartDate: task.value.planStartDate ? dayjs(task.value.planStartDate) : undefined,
          planEndDate: task.value.planEndDate ? dayjs(task.value.planEndDate) : undefined,
          description: task.value.description
        }} onFinish={async values => {
          // 日期控件给的是 Dayjs，接口要的是 yyyy-MM-dd HH:mm:ss；直接传对象会变成 [object Object]
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
              description: values.description
            });
            return true;
          } catch {
            return false;
          }
        }}>
        <ProFormText name="taskName" label="任务名称" rules={[{
            required: true,
            message: '请输入任务名称'
          }]} />
        <ProFormSelect name="taskType" label="任务类型" options={TASK_TYPE_OPTIONS} rules={[{
            required: true,
            message: '请选择任务类型'
          }]} />
        <ProFormSelect name="priority" label="优先级" options={TASK_PRIORITY_OPTIONS} rules={[{
            required: true,
            message: '请选择优先级'
          }]} />
        <ProFormSelect name="assigneeId" label="执行人" options={memberOptions.value} />
        <ProFormDateTimePicker name="planStartDate" label="计划开始" rules={[{
            required: true,
            message: '请选择计划开始时间'
          }]} fieldProps={{
            style: {
              width: '100%'
            },
            showTime: {
              format: 'HH:mm'
            }
          }} />
        <ProFormDateTimePicker name="planEndDate" label="计划结束" rules={[{
            required: true,
            message: '请选择计划结束时间'
          }]} fieldProps={{
            style: {
              width: '100%'
            },
            showTime: {
              format: 'HH:mm'
            }
          }} />
        <ProFormTextArea name="description" label="任务描述" fieldProps={{
            rows: 3
          }} />
      </ModalForm>

      {/* 验收弹窗 */}
      <ModalForm title={reviewPass.value ? '验收通过' : '驳回任务'} open={reviewOpen.value} onOpenChange={setReviewOpen} width={520} modalProps={{
          className: "production-form-dialog",
          destroyOnClose: true
        }} initialValues={{
          pass: reviewPass.value
        }} onFinish={async values => {
          if (!values.pass && !values.remark) {
            message.warning('驳回时必须填写原因');
            return false;
          }
          try {
            await reviewMutation.mutateAsync(values);
            return true;
          } catch {
            return false;
          }
        }}>
        <ProFormRadio.Group name="pass" label="验收结论" rules={[{
            required: true,
            message: '请选择验收结论'
          }]} options={[{
            value: true,
            label: '验收通过'
          }, {
            value: false,
            label: '驳回重做'
          }]} />
        <ProFormTextArea name="remark" label="验收意见 / 驳回原因" placeholder={reviewPass.value ? '选填，可填写验收评价' : '必填，请说明驳回原因与整改要求'} fieldProps={{
            rows: 3,
            maxLength: 300,
            showCount: true
          }} />
      </ModalForm>
    </PageContainer>;
    };
  }
});
export default TaskDetail;
