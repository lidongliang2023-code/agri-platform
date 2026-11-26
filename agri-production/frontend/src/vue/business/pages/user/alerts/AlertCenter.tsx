import { Popover as ListSummary } from '@/vue/ui';
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
import AlertReviewPanel from './AlertReviewPanel';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import { PageContainer as PageContainer } from '@/vue/pro';
import Table from '@/vue/business/components/BusinessRecordList';
/**
 * 页面名称：告警中心
 * 路由路径：/production/alerts
 * 所属模块：生长监测预警
 * PRD 序号：PRD 6.1 #26
 * 关联领域事件：prod.alert.triggered（载荷 alertId / level / scene / tenantId / farmId / content）
 *
 * 还原要点：
 * - 顶部指标卡：未处理 / 处理中 / 已处理 / 已忽略 与各级别分布
 * - 筛选：告警级别（紧急 / 严重 / 一般 / 提示）、处理状态、告警场景（来源）、触发时间、关键字
 * - 列表：告警编号、标题、级别 Tag、场景、触发值、地块、触发时间、状态、处理人
 * - 处理闭环：确认受理（1→2）→ 提交处理（2→3，填处理措施与结果），已处理即归档；忽略为独立终态
 * - 支持单条忽略与批量忽略
 *
 * 数据来源：`/alerts` + `/alerts/stats`；仅使用服务端真实记录，失败时提示重试。
 */

import { useSearchParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { App as AntdApp, Alert as Feedback, Button, Card, DatePicker, Descriptions, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Spin, Steps, Tag, Tooltip, Typography } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { CheckCircleOutlined, ToolOutlined } from '@ant-design/icons-vue';
import type { Dayjs } from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { getAlert, getAlertStats, handleAlert, ignoreAlerts, listAlerts } from '@/api/alerts';
import { alertLevelMeta, alertStatusMeta, formatNumber } from '@/utils/production-adapter';
import { errorMessageOf } from '@/utils/request';
import type { Alert, AlertStatus } from '@/types';
const {
  RangePicker
} = DatePicker;
const {
  Text
} = Typography;

/** 告警来源（对应领域事件中的 scene）文案 */
const ALERT_SOURCE_LABEL: Record<number, string> = {
  1: '环境监测',
  2: '设备状态',
  3: '病虫害',
  4: '农事任务',
  5: '投入品'
};

/** 告警场景下拉选项 */
const ALERT_SOURCE_OPTIONS: {
  value: number;
  label: string;
}[] = [{
  value: 1,
  label: '环境监测'
}, {
  value: 2,
  label: '设备状态'
}, {
  value: 3,
  label: '病虫害'
}, {
  value: 4,
  label: '农事任务'
}, {
  value: 5,
  label: '投入品'
}];

/** 告警级别下拉选项（级别数值对齐 types/alert.ts） */
const ALERT_LEVEL_OPTIONS: {
  value: number;
  label: string;
}[] = [{
  value: 4,
  label: '紧急'
}, {
  value: 3,
  label: '严重'
}, {
  value: 2,
  label: '一般'
}, {
  value: 1,
  label: '提示'
}];

/** 处理状态下拉选项 */
const ALERT_STATUS_OPTIONS: {
  value: number;
  label: string;
}[] = [{
  value: 1,
  label: '未处理'
}, {
  value: 2,
  label: '处理中'
}, {
  value: 3,
  label: '已处理'
}, {
  value: 4,
  label: '已忽略'
}];

/** 列表筛选条件 */
interface AlertFilters {
  /** 告警级别 */
  level?: number;
  /** 处理状态 */
  status?: number;
  /** 告警场景（来源） */
  source?: number;
  /** 关键字：编号 / 标题 / 内容 */
  keyword?: string;
  /** 触发时间区间 */
  range?: [Dayjs, Dayjs];
}

/** 处理表单字段 */
interface HandleFormValues {
  /** 处理措施 */
  handleMeasure?: string;
  /** 处理结果 */
  handleResult?: string;
  /** 处理人 */
  handlerName?: string;
}

/**
 * 告警状态文案
 *
 * 状态 4 在业务上区分「已关闭」（填写了处理意见）与「已忽略」（未填写）。
 *
 * @param alert 告警记录
 * @returns Tag 元信息
 */
function resolveStatus(alert: Alert): {
  label: string;
  color: string;
} {
  return alertStatusMeta(alert.status);
}

/**
 * 告警中心
 *
 * 业务职责：告警台账查询、级别 / 状态 / 场景筛选与「确认 → 处理 → 关闭」闭环处置。
 *
 * @returns 页面内容
 */
const AlertCenter = defineComponent({
  name: "AlertCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = AntdApp.useApp();
    const queryClient = useQueryClient();
    const farmId = useFarmStore(state => state.currentFarm?.farmId);
    const reviewOpen = shallowRef(false);
    const setReviewOpen = (next: typeof reviewOpen.value | ((previous: typeof reviewOpen.value) => typeof reviewOpen.value)) => {
      reviewOpen.value = typeof next === 'function' ? (next as (previous: typeof reviewOpen.value) => typeof reviewOpen.value)(reviewOpen.value) : next;
    };
    const reviewId = shallowRef<string>();
    const setReviewId = (next: typeof reviewId.value | ((previous: typeof reviewId.value) => typeof reviewId.value)) => {
      reviewId.value = typeof next === 'function' ? (next as (previous: typeof reviewId.value) => typeof reviewId.value)(reviewId.value) : next;
    };
    onMounted(() => {
      watch(() => [farmId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setReviewOpen(false);
          setReviewId(undefined);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const filters = shallowRef<AlertFilters>({});
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const draft = shallowRef<AlertFilters>({});
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const selectedKeys = shallowRef<string[]>([]);

    /** 处理弹窗 */
    const setSelectedKeys = (next: typeof selectedKeys.value | ((previous: typeof selectedKeys.value) => typeof selectedKeys.value)) => {
      selectedKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedKeys.value) => typeof selectedKeys.value)(selectedKeys.value) : next;
    };
    const handleOpen = shallowRef<boolean>(false);
    const setHandleOpen = (next: typeof handleOpen.value | ((previous: typeof handleOpen.value) => typeof handleOpen.value)) => {
      handleOpen.value = typeof next === 'function' ? (next as (previous: typeof handleOpen.value) => typeof handleOpen.value)(handleOpen.value) : next;
    };
    const handleTarget = shallowRef<Alert | null>(null);
    const setHandleTarget = (next: typeof handleTarget.value | ((previous: typeof handleTarget.value) => typeof handleTarget.value)) => {
      handleTarget.value = typeof next === 'function' ? (next as (previous: typeof handleTarget.value) => typeof handleTarget.value)(handleTarget.value) : next;
    };
    const handleSubmitting = shallowRef<boolean>(false);
    const setHandleSubmitting = (next: typeof handleSubmitting.value | ((previous: typeof handleSubmitting.value) => typeof handleSubmitting.value)) => {
      handleSubmitting.value = typeof next === 'function' ? (next as (previous: typeof handleSubmitting.value) => typeof handleSubmitting.value)(handleSubmitting.value) : next;
    };
    const [handleForm] = Form.useForm<HandleFormValues>();

    /** 详情弹窗 */
    const [searchParams] = useSearchParams();
    const detailId = shallowRef<string | null>(null);
    const setDetailId = (next: typeof detailId.value | ((previous: typeof detailId.value) => typeof detailId.value)) => {
      detailId.value = typeof next === 'function' ? (next as (previous: typeof detailId.value) => typeof detailId.value)(detailId.value) : next;
    };
    onMounted(() => {
      watch(() => [searchParams.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setDetailId(searchParams.value.get('alertId'));
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [farmId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setSelectedKeys([]);
          setHandleOpen(false);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const detailQuery = useQuery(() => ({
      queryKey: ['production-alert-detail', farmId.value, detailId.value],
      queryFn: () => getAlert(detailId.value!),
      enabled: Boolean(detailId.value),
      staleTime: 0
    }));
    const detailTarget = computed(() => detailQuery.isError ? null : detailQuery.data ?? null);

    /** 告警列表 */
    const listQuery = useQuery(() => ({
      queryKey: ['production-alerts', farmId.value, filters.value, pageNum.value, pageSize.value],
      queryFn: () => listAlerts({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        farmId: farmId.value,
        alertLevel: filters.value.level,
        status: filters.value.status,
        alertSource: filters.value.source,
        keyword: filters.value.keyword,
        startDate: filters.value.range?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.value.range?.[1]?.format('YYYY-MM-DD')
      })
    }));

    /** 告警统计 */
    const statsQuery = useQuery(() => ({
      queryKey: ['production-alerts-stats', farmId.value],
      queryFn: () => getAlertStats(farmId.value)
    }));
    const rows = computed(() => listQuery.isError ? [] : listQuery.data?.list ?? []);
    const total = computed(() => listQuery.isError ? 0 : listQuery.data?.total ?? 0);
    const levelCounts = computed(() => Object.fromEntries((statsQuery.data?.levelCounts ?? []).map(x => [x.level, x.count])));
    const stats = computed(() => statsQuery.data);
    const statCards = computed(() => [{
      key: 'unhandled',
      title: '未处理',
      value: stats.value?.unhandled,
      color: '#ff4d4f'
    }, {
      key: 'handling',
      title: '处理中',
      value: stats.value?.handling,
      color: '#fa8c16'
    }, {
      key: 'resolved',
      title: '已处理归档',
      value: stats.value?.resolved,
      color: '#52c41a'
    }, {
      key: 'ignored',
      title: '已忽略',
      value: stats.value?.ignored,
      color: '#8c8c8c'
    }]);
    const applyPatch = (alert: Alert): Alert => alert;

    /**
     * 执行处置动作
     *
     * 此前 `catch {}` 空吞后，受理 / 处理 / 关闭三个调用点一律 `message.success`——
     * 后端没写进去也报「已受理 / 已处理 / 已关闭」，刷新就打回原形。现在把
     * 「是否真的写到服务端」作为结果的一部分返回，由调用方按结果分别提示。
     *
     * 注意 `handleAlert` 的返回值含义：后端 `AlertInfoService.handle` 返回
     * `updateById(alert) > 0`，即**真的改到了行**才为 true。返回 false 同样算失败
     * （告警不存在 / 已被他人处置），不能因为「没抛异常」就当成功。
     *
     * @param alert 目标告警
     * @param nextStatus 目标状态
     * @param remark 处理意见
     * @param handlerName 处理人
     * @returns remoteOk 是否真的写进服务端；reason 失败原因（成功时为空串）
     */
    async function doHandle(alert: Alert, nextStatus: AlertStatus, remark: string): Promise<{
      remoteOk: boolean;
      reason: string;
    }> {
      let remoteOk = false;
      let reason = '';
      try {
        const updated = await handleAlert(alert.alertId, {
          status: nextStatus,
          handleRemark: remark
        });
        if (updated) {
          remoteOk = true;
          await queryClient.invalidateQueries({
            queryKey: ['production-alerts']
          });
          await queryClient.invalidateQueries({
            queryKey: ['production-alerts-stats']
          });
        } else {
          reason = '服务端未更新任何记录（该告警可能不存在或已被他人处置）';
        }
      } catch (error) {
        reason = errorMessageOf(error);
      }
      return {
        remoteOk,
        reason
      };
    }

    /** 打开处理弹窗 */
    const openHandle = (alert: Alert): void => {
      setHandleTarget(alert);
      handleForm.setFieldsValue({
        handleMeasure: alert.handleRemark ?? '',
        handleResult: '',
        handlerName: alert.handlerName ?? ''
      });
      setHandleOpen(true);
    };

    /** 确认受理：1 → 2 */
    const handleConfirm = async (): Promise<void> => {
      if (!handleTarget.value) return;
      const values = handleForm.getFieldsValue();
      setHandleSubmitting(true);
      const {
        remoteOk,
        reason
      } = await doHandle(handleTarget.value, 2, values.handleMeasure || '已确认受理，待现场处置。');
      setHandleSubmitting(false);
      if (remoteOk) {
        message.success('告警已确认受理，进入处理中');
      } else {
        message.warning(`受理未同步到服务端（${reason}），未改变告警状态，请重试`);
      }
      if (remoteOk) setHandleOpen(false);
    };

    /** 提交处理：2 → 3 */
    const handleProcess = async (): Promise<void> => {
      if (!handleTarget.value) return;
      let values: HandleFormValues;
      try {
        values = await handleForm.validateFields();
      } catch {
        message.warning('请填写处理措施后再提交');
        return;
      }
      const remark = `处理措施：${values.handleMeasure ?? ''}；处理结果：${values.handleResult ?? ''}`;
      setHandleSubmitting(true);
      const {
        remoteOk,
        reason
      } = await doHandle(handleTarget.value, 3, remark);
      setHandleSubmitting(false);
      if (remoteOk) {
        message.success('处理结果已提交，告警标记为已处理');
      } else {
        message.warning(`处理未同步到服务端（${reason}），未改变告警状态，请重试`);
      }
      if (remoteOk) setHandleOpen(false);
    };

    /**
     * 忽略告警（批量）。
     *
     * 此前 `catch {}` 空吞后无条件报「已忽略所选告警」，服务端一条都没改也报成功。
     * 后端 `AlertInfoService.ignoreBatch` 的返回值同样是「真的改到行」才为 true
     * （id 列表为空返回 false，id 不存在抛 404），因此 false 也按失败处理。
     */
    const ignoreMutation = useMutation(() => ({
      mutationFn: async (ids: string[]) => {
        if (!(await ignoreAlerts(ids))) throw new Error('服务端未更新记录，请刷新后重试');
        return ids.length;
      },
      onSuccess: count => {
        message.success(`已忽略 ${count} 条告警`);
        setSelectedKeys([]);
        void queryClient.invalidateQueries({
          queryKey: ['production-alerts']
        });
        void queryClient.invalidateQueries({
          queryKey: ['production-alerts-stats']
        });
        void queryClient.invalidateQueries({
          queryKey: ['production-alert-detail']
        });
      },
      onError: error => message.error(errorMessageOf(error))
    }));
    const openFreshHandle = async (alert: Alert): Promise<void> => {
      try {
        openHandle(await getAlert(alert.alertId));
      } catch (error) {
        message.error(errorMessageOf(error));
      }
    };

    /** 触发搜索 */
    const handleSearch = (): void => {
      setPageNum(1);
      setFilters(draft.value);
      setSelectedKeys([]);
    };

    /** 重置筛选 */
    const handleReset = (): void => {
      const empty: AlertFilters = {};
      setDraft(empty);
      setFilters(empty);
      setPageNum(1);
      setSelectedKeys([]);
    };

    /** 表格列定义 */
    const columns = computed<ColumnsType<Alert>>(() => [{
      title: '告警编号',
      dataIndex: 'alertNo',
      width: 190,
      ellipsis: true,
      render: (value: string, record) => <Tooltip title={`${value} · ${record.plotName ? `地块：${record.plotName}` : '农场级'}`}>
          <span class="production-dense-name-wrap">
            <Text copyable={{
            text: value
          }} style={{
            fontSize: 13
          }}>
              {value}
            </Text>
          </span>
        </Tooltip>
    }, {
      title: '所属地块',
      key: 'plotName',
      width: 120,
      ellipsis: true,
      render: (_value: unknown, record) => record.plotName || '农场级'
    }, {
      title: '告警标题',
      dataIndex: 'alertTitle',
      width: 260,
      ellipsis: true,
      render: (value: string, record) => <Tooltip title={record.alertContent ? `${value}：${record.alertContent}` : value}>
          <span class="production-dense-link-ellipsis">
            <Text strong>{value}</Text>
            {record.alertContent ? <Text type="secondary" style={{
            marginLeft: 6,
            fontSize: 12
          }}>
                {record.alertContent}
              </Text> : null}
          </span>
        </Tooltip>
    }, {
      title: '级别',
      dataIndex: 'alertLevel',
      width: 90,
      align: 'center',
      render: (level: number) => {
        const meta = alertLevelMeta(level);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '告警场景',
      dataIndex: 'alertSource',
      width: 110,
      render: (source: number) => <Tag>{ALERT_SOURCE_LABEL[source] ?? '其他'}</Tag>
    }, {
      title: '触发值',
      dataIndex: 'triggerValue',
      width: 130,
      render: (value?: string) => value || '-'
    }, {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      width: 160,
      render: (value: string) => value || '-'
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_value: number, record) => {
        const meta = resolveStatus(record);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '处理人',
      dataIndex: 'handlerName',
      width: 100,
      render: (value?: string) => value || '-'
    }, {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_value: unknown, record) => <ListRowActions>
          <Button key="detail" type="link" size="small" onClick={() => setDetailId(record.alertId)}>
            详情
          </Button>
          {[3, 4].includes(record.status) && <Button key="review" type="link" size="small" onClick={() => {
          setReviewId(record.alertId);
          setReviewOpen(true);
        }}>
              复盘
            </Button>}
          {record.status !== 3 && record.status !== 4 && <Button key="handle" type="link" size="small" onClick={() => void openFreshHandle(record)}>
              处理
            </Button>}
        </ListRowActions>
    }]);

    /** 当前处理目标（合并本地补丁） */
    const currentTarget = computed<Alert | null>(() => handleTarget.value ? applyPatch(handleTarget.value) : null);
    const currentStep = computed<number>(() => currentTarget.value?.status === 1 ? 0 : currentTarget.value?.status === 2 ? 1 : 2);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="告警中心" subTitle="事件 prod.alert.triggered · 场景 / 级别 / 内容由规则引擎与 IoT 监听触发">
      {/* 统计统一放入列表工具栏。 */}

      <Card class="production-dense-filter-card">
        <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={listQuery.isFetching}>
          <div class="production-filter-field production-filter-span-2">
            <label>级别</label>
            <Segmented size="small" value={draft.value.level ?? 0} onChange={value => setDraft(prev => ({
                  ...prev,
                  level: Number(value) === 0 ? undefined : Number(value)
                }))} options={[{
                  label: '全部',
                  value: 0
                }, ...ALERT_LEVEL_OPTIONS.map(item => ({
                  label: `${item.label}(${levelCounts.value[item.value] ?? 0})`,
                  value: item.value
                }))]} />
          </div>
          <div class="production-filter-field">
            <label>状态</label>
            <Select allowClear placeholder="处理状态" value={draft.value.status} options={ALERT_STATUS_OPTIONS} onChange={value => setDraft(prev => ({
                  ...prev,
                  status: value
                }))} />
          </div>
          <div class="production-filter-field">
            <label>场景</label>
            <Select allowClear placeholder="告警场景" value={draft.value.source} options={ALERT_SOURCE_OPTIONS} onChange={value => setDraft(prev => ({
                  ...prev,
                  source: value
                }))} />
          </div>
          <div class="production-filter-field">
            <label>时间</label>
            <RangePicker value={draft.value.range} onChange={value => setDraft(prev => ({
                  ...prev,
                  range: value?.[0] && value?.[1] ? [value[0], value[1]] : undefined
                }))} />
          </div>
          <div class="production-filter-field">
            <label>关键字</label>
            <Input allowClear placeholder="编号 / 标题 / 内容" value={draft.value.keyword} onChange={event => setDraft(prev => ({
                  ...prev,
                  keyword: event.target.value
                }))}  />
          </div>
        </ProductionListFilters>
      </Card>

      <Card>
        {listQuery.isError && <Empty description="告警加载失败，未展示任何示例数据。请点击刷新重试。" style={{
            margin: '12px 0'
          }} />}

        <Spin spinning={listQuery.isLoading}>
          <Table memberListToolbar rowKey="alertId" columns={columns.value} dataSource={rows.value} scroll={{
              x: 1320
            }} onReload={() => {
              void queryClient.invalidateQueries({
                queryKey: ['production-alerts']
              });
              void queryClient.invalidateQueries({
                queryKey: ['production-alerts-stats']
              });
            }} toolbarTitle={<Space size={8} wrap>
                <Button onClick={() => {
                setReviewId(undefined);
                setReviewOpen(true);
              }}>复盘与跟进</Button>
                <Popconfirm title={`确认忽略所选 ${selectedKeys.value.length} 条告警？`} disabled={selectedKeys.value.length === 0} onConfirm={() => ignoreMutation.mutate(selectedKeys.value)}>
                  <Button danger disabled={selectedKeys.value.length === 0}>
                    批量忽略
                  </Button>
                </Popconfirm>
              <ListSummary trigger="click" content={<div class="production-dense-summary">
        <div class="production-dense-summary-items">
          {statCards.value.map(card => <span class="production-dense-metric" key={card.key}>
              <span class="production-dense-metric-label">{card.title}</span>
              <span class={`production-dense-metric-value ${card.key === 'unhandled' ? 'is-danger' : card.key === 'handling' ? 'is-warning' : card.key === 'handled' ? 'is-success' : ''}`}>
                {statsQuery.isError ? '—' : card.value ?? '—'} 条
              </span>
            </span>)}
        </div>
        {statsQuery.isError && <Feedback type="error" showIcon message="告警统计加载失败" action={<Button size="small" onClick={() => void statsQuery.refetch()}>重试</Button>} />}
      </div>}><Button>统计</Button></ListSummary></Space>} rowSelection={{
              selectedRowKeys: selectedKeys.value,
              onChange: keys => setSelectedKeys(keys as string[]),
              getCheckboxProps: record => ({
                disabled: record.status !== 1
              })
            }} pagination={{
              current: pageNum.value,
              pageSize: pageSize.value,
              total: total.value,
              showSizeChanger: true,
              showTotal: value => `共 ${formatNumber(value)} 条`,
              onChange: (page, size) => {
                setPageNum(page);
                setPageSize(size);
              }
            }} />
        </Spin>
      </Card>

      <AlertReviewPanel open={reviewOpen.value} alertId={reviewId.value} onClose={() => setReviewOpen(false)} />
      {/* 处理闭环弹窗 */}
      <Modal class="production-form-dialog" title={`告警处置 · ${currentTarget.value?.alertNo ?? ''}`} open={handleOpen.value} onCancel={() => setHandleOpen(false)} width={720} footer={[<Button key="cancel" onClick={() => setHandleOpen(false)}>
            取消
          </Button>, <Button key="confirm" icon={<CheckCircleOutlined />} disabled={currentTarget.value?.status !== 1} loading={handleSubmitting.value} onClick={() => void handleConfirm()}>
            确认受理
          </Button>, <Button key="process" type="primary" icon={<ToolOutlined />} disabled={currentTarget.value?.status !== 2} loading={handleSubmitting.value} onClick={() => void handleProcess()}>
            提交处理
          </Button>]}>
        {currentTarget.value && <Space direction="vertical" size={16} style={{
            width: '100%'
          }}>
            <Steps size="small" current={currentStep.value} items={[{
              title: '确认受理'
            }, {
              title: '处理处置'
            }, {
              title: '已处理归档'
            }]} />
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="告警标题" span={2}>
                {currentTarget.value.alertTitle}
              </Descriptions.Item>
              <Descriptions.Item label="告警级别">
                <Tag color={alertLevelMeta(currentTarget.value.alertLevel).color}>
                  {alertLevelMeta(currentTarget.value.alertLevel).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="告警场景">
                {ALERT_SOURCE_LABEL[currentTarget.value.alertSource] ?? '其他'}
              </Descriptions.Item>
              <Descriptions.Item label="触发值">
                {currentTarget.value.triggerValue || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="触发时间">{currentTarget.value.triggeredAt}</Descriptions.Item>
              <Descriptions.Item label="关联地块">
                {currentTarget.value.plotName || '农场级'}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={resolveStatus(currentTarget.value).color}>
                  {resolveStatus(currentTarget.value).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="告警内容" span={2}>
                {currentTarget.value.alertContent}
              </Descriptions.Item>
            </Descriptions>
            <Form form={handleForm} layout="vertical">
              <Form.Item name="handleMeasure" label="处理措施" rules={[{
                required: true,
                message: '请填写处理措施'
              }]}>
                <Input.TextArea rows={3} placeholder="如：立即通风降湿至 65% 以下，并喷施代森锰锌 800 倍液" />
              </Form.Item>
              <Form.Item name="handleResult" label="处理结果">
                <Input.TextArea rows={2} placeholder="如：2 小时后湿度回落至 63%，病斑未继续扩展" />
              </Form.Item>
              <Form.Item name="handlerName" label="处理人">
                <Input placeholder="如：张三" />
              </Form.Item>
            </Form>
          </Space>}
      </Modal>

      {/* 详情弹窗 */}
      <Modal class="production-detail-compact production-detail-dialog" title="告警详情" open={Boolean(detailId.value)} onCancel={() => setDetailId(null)} footer={[<Button key="close" type="primary" onClick={() => setDetailId(null)}>
            关闭
          </Button>]} width={680}>
        {detailQuery.isLoading && <Spin />}
        {detailQuery.isError && <Feedback type="error" message="详情加载失败" action={<Button onClick={() => void detailQuery.refetch()}>重试</Button>} />}
        {detailTarget.value && <DetailInfoGrid items={[{
            label: '告警编号',
            value: detailTarget.value.alertNo
          }, {
            label: '告警级别',
            value: <Tag color={alertLevelMeta(detailTarget.value.alertLevel).color}>{alertLevelMeta(detailTarget.value.alertLevel).label}</Tag>
          }, {
            label: '告警场景',
            value: ALERT_SOURCE_LABEL[detailTarget.value.alertSource] ?? '其他'
          }, {
            label: '处理状态',
            value: <Tag color={resolveStatus(detailTarget.value).color}>{resolveStatus(detailTarget.value).label}</Tag>
          }, {
            label: '触发值',
            value: detailTarget.value.triggerValue
          }, {
            label: '关联地块',
            value: detailTarget.value.plotName || '农场级'
          }, {
            label: '触发时间',
            value: detailTarget.value.triggeredAt
          }, {
            label: '处理时间',
            value: detailTarget.value.handledAt
          }, {
            label: '处理人',
            value: detailTarget.value.handlerName
          }, {
            label: '关联规则',
            value: detailTarget.value.ruleId
          }, {
            label: '告警内容',
            value: <span style={{
              whiteSpace: 'pre-wrap'
            }}>{detailTarget.value.alertContent || '—'}</span>,
            fullWidth: true
          }, {
            label: '处理意见',
            value: <span style={{
              whiteSpace: 'pre-wrap'
            }}>{detailTarget.value.handleRemark || '—'}</span>,
            fullWidth: true
          }]} />}
      </Modal>
    </PageContainer>;
    };
  }
});
export default AlertCenter;
