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
/**
 * 页面名称：任务验收
 * 路由路径：/production/tasks/:taskId/acceptance
 * 所属模块：农事生产
 * PRD 序号：PRD 6.1 #18（TASK-06 任务验收）
 *
 * 原型无此页，按 PRD 设计：
 * - 展示任务执行成果：照片墙、GPS 打卡定位、投入品用量、执行时间轴
 * - 验收结论：通过 / 驳回；驳回必须填写原因（后端累加 rejectCount）
 * - 已验收任务展示历史结论，并支持重新验收
 */
import Card from '@/vue/business/components/SectionCard';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { ProForm, ProFormRadio, ProFormTextArea } from '@/vue/pro';
import { PageContainer as PageContainer } from '@/vue/pro';
import { Pagination, Alert, Button, Col, Divider, Empty, Image, Row, Skeleton, Space, Statistic, Tag, Timeline, Typography, message } from '@/vue/ui';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { fetchTaskRecords, getTask, reviewTask } from '@/api/tasks';
import { fetchUsagesByTask } from '@/api/inputs';
import type { InputUsageRecord, TaskRecord } from '@/types';
import { ACCEPT_STATUS_META, TASK_PRIORITY_COLOR_MAP, TASK_PRIORITY_LABEL_MAP, TASK_STATUS_COLOR_MAP, TASK_STATUS_LABEL_MAP, TASK_TYPE_LABEL_MAP } from '@/types';
import { isTaskDone, TASK_ACCEPT_PENDING } from '@/types/task';

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

/** 验收表单值 */
interface AcceptanceFormValues {
  /** true 通过 / false 驳回 */
  pass: boolean;
  /** 验收意见 */
  remark?: string;
  /** 驳回原因（驳回时必填） */
  reason?: string;
}

/**
 * 任务验收页
 *
 * 业务职责：核查任务执行成果（照片 / GPS / 用量）并提交验收结论。
 *
 * @returns 页面内容
 */
const TaskAcceptance = defineComponent({
  name: "TaskAcceptance",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _params = useParams<{
      taskId: string;
    }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const pass = shallowRef<boolean>(true);

    /** 任务详情 */
    const setPass = (next: typeof pass.value | ((previous: typeof pass.value) => typeof pass.value)) => {
      pass.value = typeof next === 'function' ? (next as (previous: typeof pass.value) => typeof pass.value)(pass.value) : next;
    };
    const taskQuery = useQuery(() => ({
      queryKey: ['production-task', _params.taskId ?? ''],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => getTask(_params.taskId ?? '')
    }));

    /** 执行记录 */
    const recordPage = shallowRef(1);
    const setRecordPage = (next: typeof recordPage.value | ((previous: typeof recordPage.value) => typeof recordPage.value)) => {
      recordPage.value = typeof next === 'function' ? (next as (previous: typeof recordPage.value) => typeof recordPage.value)(recordPage.value) : next;
    };
    const recordQuery = useQuery(() => ({
      queryKey: ['production-task-records', _params.taskId ?? '', recordPage.value],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => fetchTaskRecords(_params.taskId ?? '', recordPage.value, 50)
    }));

    /** 本任务关联的投入品使用记录（真实台账） */
    const usagesQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'usages', 'task', _params.taskId ?? ''],
      enabled: Boolean(_params.taskId ?? ''),
      queryFn: () => fetchUsagesByTask(_params.taskId ?? '')
    }));
    const task = computed(() => taskQuery.data);
    const records = computed(() => recordQuery.data?.list ?? []);
    const usages = computed(() => usagesQuery.data ?? []);

    /** 汇总照片墙（记录照片 + 提交成果照片） */
    const allPhotos = computed(() => [...records.value.flatMap((record: TaskRecord) => parsePhotoList(record)), ...parseUrlList(task.value?.resultPhotoUrls)]);

    /** 最近一次打卡坐标 */
    const latestRecord = computed<TaskRecord | undefined>(() => [...records.value].sort((a, b) => String(b.executeTime).localeCompare(String(a.executeTime)))[0]);

    /** 验收提交 */
    const reviewMutation = useMutation(() => ({
      mutationFn: (values: AcceptanceFormValues) => reviewTask(_params.taskId ?? '', values.pass, values.pass ? values.remark : values.reason),
      onSuccess: (_data, variables) => {
        message.success(variables.pass ? '验收通过，任务已归档' : '已驳回，任务退回执行');
        void queryClient.invalidateQueries({
          queryKey: ['production-task', _params.taskId ?? '']
        });
        void queryClient.invalidateQueries({
          queryKey: ['production-task-records', _params.taskId ?? '']
        });
        void queryClient.invalidateQueries({
          queryKey: ['production-tasks']
        });
        navigate(`/production/tasks/${_params.taskId ?? ''}`);
      },
      onError: (error: Error) => message.error(error.message || '验收提交失败')
    }));

    /** 任务信息描述项 */
    const baseItems = computed(() => {
      if (!task.value) return [];
      return [{
        key: 'taskNo',
        label: '任务编号',
        children: task.value.taskNo ?? '-'
      }, {
        key: 'taskName',
        label: '任务名称',
        children: task.value.taskName
      }, {
        key: 'status',
        label: '任务状态',
        children: <Tag color={TASK_STATUS_COLOR_MAP[task.value.status] ?? 'default'}>
            {TASK_STATUS_LABEL_MAP[task.value.status] ?? task.value.status}
          </Tag>
      }, {
        key: 'taskType',
        label: '任务类型',
        children: <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[task.value.taskType] ?? task.value.taskType}</Tag>
      }, {
        key: 'priority',
        label: '优先级',
        children: <Tag color={TASK_PRIORITY_COLOR_MAP[task.value.priority] ?? 'default'}>
            {TASK_PRIORITY_LABEL_MAP[task.value.priority] ?? '普通'}
          </Tag>
      }, {
        key: 'plot',
        label: '地块',
        children: task.value.plotName ?? task.value.plotId ?? '-'
      }, {
        key: 'assignee',
        label: '执行人',
        children: task.value.assigneeName ?? '未派发'
      }, {
        key: 'plan',
        label: '计划时间',
        children: `${task.value.planStartDate ?? '-'} ~ ${task.value.planEndDate ?? '-'}`
      }, {
        key: 'completedAt',
        label: '完成时间',
        children: task.value.completedAt ?? task.value.actualEndDate ?? '-'
      }, {
        key: 'rejectCount',
        label: '历史驳回次数',
        children: `${task.value.rejectCount ?? 0} 次`
      }];
    });

    /** 执行时间轴 */
    const timelineItems = computed(() => records.value.map((record: TaskRecord) => ({
      color: RECORD_TYPE_COLOR[record.executeType] ?? 'blue',
      children: <div>
            <Space size={8} wrap>
              <Typography.Text strong>{record.executeTime ?? '-'}</Typography.Text>
              <Tag>{RECORD_TYPE_TEXT[record.executeType] ?? '执行记录'}</Tag>
              {record.offlineFlag === 1 && <Tag color="orange">离线补传</Tag>}
            </Space>
            <div>
              <Typography.Text type="secondary">
                {record.executorName ?? record.executorId ?? '-'}
                {record.gpsLat && record.gpsLng ? ` ｜ GPS：${record.gpsLat}, ${record.gpsLng}` : ''}
                {record.gpsDistance ? ` ｜ 距地块中心 ${record.gpsDistance} 米` : ''}
              </Typography.Text>
            </div>
            {record.abnormalDesc && <div>
                <Typography.Text type="warning">异常：{record.abnormalDesc}</Typography.Text>
              </div>}
          </div>
    })));
    return () => {
      if (taskQuery.isLoading) {
        return <PageContainer title="任务验收">
        <Card>
          <Skeleton active paragraph={{
              rows: 6
            }} />
        </Card>
      </PageContainer>;
      }
      if (taskQuery.isError || !task.value) {
        return <PageContainer title="任务验收">
        <Card>
          <Empty description={<Space direction="vertical">
                <Typography.Text type="danger">任务不存在或加载失败</Typography.Text>
                <Button onClick={() => navigate('/production/tasks')}>返回任务列表</Button>
              </Space>} />
        </Card>
      </PageContainer>;
      }

      // 只有「已提交成果 + 待验收」才能验收。执行中也显示验收按钮会让人绕过提交直接归档，
      // 后端同样会拒绝（acceptTask 校验 status=completed && acceptStatus=0）。
      const canReview = isTaskDone(task.value.status) && task.value.acceptStatus === TASK_ACCEPT_PENDING;
      return <PageContainer title={`任务验收：${task.value.taskName}`} extra={[<Button key="back" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/production/tasks/${_params.taskId ?? ''}`)}>
          返回任务详情
        </Button>]}>
      {(recordQuery.isError || usagesQuery.isError) && <Alert type="error" showIcon message="执行记录或投入品加载失败，不能据此认定没有记录" action={<Button onClick={() => {
          void recordQuery.refetch();
          void usagesQuery.refetch();
        }}>重试</Button>} />}
      <Pagination current={recordPage.value} pageSize={50} total={recordQuery.data?.total ?? 0} onChange={setRecordPage} showSizeChanger={false} showTotal={total => `共 ${total} 条`} style={{
          marginBottom: 16
        }} />
      <Card title="📋 任务信息" style={{
          marginBottom: 16
        }}>
        <DetailInfoGrid columns={3} items={baseItems.value.map(i => ({
            key: i.key,
            label: i.label,
            value: i.children
          }))} />
        {task.value.resultDesc && <Alert style={{
            marginTop: 12
          }} type="info" showIcon message="执行人提交的成果说明" description={task.value.resultDesc} />}
        {task.value.acceptStatus !== 0 && <Alert style={{
            marginTop: 12
          }} type={task.value.acceptStatus === 1 ? 'success' : 'error'} showIcon message={`当前验收结论：${ACCEPT_STATUS_META[task.value.acceptStatus]?.label ?? '待验收'}`} description={task.value.acceptRemark ?? '无验收意见'} />}
        {!canReview && task.value.acceptStatus !== 1 && <Alert style={{
            marginTop: 12
          }} type="warning" showIcon message={task.value.acceptStatus === 2 ? '任务已驳回，执行人重新开始执行并提交成果后可再次验收' : `任务当前状态为「${TASK_STATUS_LABEL_MAP[task.value.status] ?? task.value.status}」，执行人提交成果后可进行验收`} />}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="📷 执行照片" style={{
              marginBottom: 16
            }}>
            {allPhotos.value.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">暂无现场照片</Typography.Text>} /> : <Image.PreviewGroup>
                <Space size={[8, 8]} wrap>
                  {allPhotos.value.map(url => <Image key={url} src={url} width={104} height={104} style={{
                    objectFit: 'cover',
                    borderRadius: 4
                  }} />)}
                </Space>
              </Image.PreviewGroup>}
          </Card>

          <Card title="📍 GPS 打卡与作业量" style={{
              marginBottom: 16
            }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="打卡记录" value={records.value.length} suffix="条" />
              </Col>
              <Col span={8}>
                <Statistic title="距地块中心" value={latestRecord.value?.gpsDistance ?? 0} precision={2} suffix="米" />
              </Col>
              <Col span={8}>
                <Statistic title="关联投入品" value={usages.value.length} suffix="项" />
              </Col>
            </Row>
            <Divider />
            <DetailInfoGrid columns={2} items={[{
                label: "最近打卡时间",
                value: <>{latestRecord.value?.executeTime ?? '-'}</>
              }, {
                label: "打卡坐标",
                value: <>{latestRecord.value?.gpsLat && latestRecord.value?.gpsLng ? `${latestRecord.value.gpsLat}, ${latestRecord.value.gpsLng}` : '-'}</>
              }, {
                label: "是否离线补传",
                value: <>{latestRecord.value?.offlineFlag === 1 ? <Tag color="orange">是</Tag> : '否'}</>
              }, {
                label: "异常说明",
                value: <>{latestRecord.value?.abnormalDesc ?? '无'}</>
              }]} />
            <Divider />
            <Typography.Text strong>投入品用量记录</Typography.Text>
            <div style={{
                marginTop: 8
              }}>
              {usages.value.length === 0 ? <Typography.Text type="secondary">本次任务未登记投入品</Typography.Text> : <Space direction="vertical" size={6} style={{
                  width: '100%'
                }}>
                  {usages.value.map((usage: InputUsageRecord) => <Typography.Text key={usage.usageId}>
                      <Tag color="green">{usage.inputName ?? '投入品'}</Tag>
                      {usage.dosage === undefined || usage.dosage === null ? '用量未登记' : `${usage.dosage} ${usage.unit ?? ''}`}
                      {usage.usedAt ? ` ｜ ${usage.usedAt}` : ''}
                    </Typography.Text>)}
                </Space>}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="🕒 执行时间轴" style={{
              marginBottom: 16
            }}>
            {timelineItems.value.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">暂无执行记录</Typography.Text>} /> : <Timeline items={timelineItems.value} />}
          </Card>
        </Col>
      </Row>

      <Card title="✅ 验收结论">
        <ProForm layout="vertical" submitter={{
            searchConfig: {
              submitText: '提交验收结论',
              resetText: '重置'
            },
            submitButtonProps: {
              disabled: !canReview,
              loading: reviewMutation.isPending
            },
            render: (_props, dom) => <Space>
                {dom}
                <Button onClick={() => navigate(`/production/tasks/${_params.taskId ?? ''}`)}>取消</Button>
              </Space>
          }} initialValues={{
            pass: true
          }} onFinish={async values => {
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
          }}>
          <ProFormRadio.Group name="pass" label="验收结论" rules={[{
              required: true,
              message: '请选择验收结论'
            }]} options={[{
              value: true,
              label: '验收通过'
            }, {
              value: false,
              label: '驳回重做（退回执行人）'
            }]} fieldProps={{
              onChange: (event: { target?: { value?: unknown } }) => setPass(Boolean(event?.target?.value ?? ''))
            }} />
          {pass.value ? <ProFormTextArea name="remark" label="验收意见" placeholder="选填，可填写完成质量评价" fieldProps={{
              rows: 3,
              maxLength: 300,
              showCount: true
            }} /> : <ProFormTextArea name="reason" label="驳回原因" placeholder="必填，请说明驳回原因与整改要求" rules={[{
              required: true,
              message: '驳回时必须填写原因'
            }]} fieldProps={{
              rows: 3,
              maxLength: 300,
              showCount: true
            }} />}
        </ProForm>
      </Card>
    </PageContainer>;
    };
  }
});
export default TaskAcceptance;
