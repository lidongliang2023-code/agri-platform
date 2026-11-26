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
import ProductionPagination from '@/vue/business/components/ProductionPagination';
import { Popover as ListSummary } from '@/vue/ui';
import Card from '@/vue/business/components/SectionCard';
import '@/components/ProductionListDense.css';
/**
 * 页面名称：农场列表
 * 路由路径：/production/farms
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #4
 * 原型来源：用户端原型 P1 farms
 *
 * 还原要点（对照原型 P1）：
 * - 标题「农场管理」，右上角操作 `+ 新建农场`、`导入`
 * - 筛选器：搜索农场名称/编号、全部状态（运营中 / 已停用）、全部类型（六种业务类型）
 * - 统计条：共 N 个农场（并补充总面积 / 运营中 / 地块总数）
 * - **卡片视图**：每张卡含 🌾 农场名、状态标签、★默认标签、
 *   📍 地区 | 类型 | 面积 | 在田面积、地块数 | 任务总数 | 告警，
 *   底部操作 `查看详情`、`生产监控→`，右上角 `更多 ▾` 下拉
 * - 默认列表视图、列表/卡片切换、设为默认农场、启停、删除与批量导入
 *
 * 数据口径说明：
 * - 农场主数据来自 GET /farms；地块数 / 在田面积来自 GET /farms/{farmId}/summary
 * - 任务总数来自 GET /tasks 分页 total（后端未支持月份过滤时按全量任务数展示）
 * - 告警数来自 GET /alerts 分页 total
 */

import { useNavigate } from '@/vue/router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import type { MenuProps } from '@/vue/ui';
import { AppstoreOutlined, UnorderedListOutlined, DownOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Button, Col, Dropdown, Empty, Form, Input, Modal, Row, Select, Segmented, Space, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { deleteFarm, getFarmSummary, listFarms, updateFarmStatus } from '@/api/farms';
import { DetailInfoGrid } from '@/vue/business/components/index';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import FarmImportModal from './FarmImportModal';
import { listAlerts } from '@/api/alerts';
import { listTasks } from '@/api/tasks';
import { FARM_TYPE_BUSINESS_OPTIONS } from '@/utils/farm-import';
import useFarmStore from '@/vue/farmStore';
import type { Farm } from '@/types';

/** 筛选表单值 */
interface FilterValues {
  /** 关键字：农场名称 / 编号 */
  keyword?: string;
  /** 状态：1 运营中 0 已停用 */
  status?: number;
  /** 业务类型标签（服务端分页前过滤） */
  typeLabel?: string;
}

/** 农场概况（GET /farms/{farmId}/summary） */
interface FarmSummary {
  /** 地块总数 */
  plotCount: number;
  /** 地块面积合计（亩） */
  plotAreaTotal: number;
  /** 农场总面积（亩，后端返回） */
  areaTotal: number;
}

/** 农场状态标签元数据 */
const FARM_STATUS_META: Record<number, {
  label: string;
  color: string;
}> = {
  1: {
    label: '运营中',
    color: 'green'
  },
  0: {
    label: '已停用',
    color: 'default'
  }
};

/** 农场类型（后端枚举 1 种植 2 养殖 3 混合）兜底文案 */
const FARM_TYPE_FALLBACK_MAP: Record<number, string> = {
  1: '种植类',
  2: '养殖类',
  3: '综合种养'
};

/**
 * 从 remark 中解析自定义键值。
 *
 * 后端 FarmInfoEntity 未包含「海拔」「业务类型」字段，
 * 新增农场页将其以 `海拔:35m；产业类型:蔬菜种植` 形式写入 remark，此处回读。
 *
 * @param remark 备注原文
 * @param key 键名
 * @returns 解析出的值，未命中返回 undefined
 */
function parseRemarkField(remark: string | undefined, key: string): string | undefined {
  if (!remark) return undefined;
  const match = remark.match(new RegExp(`${key}[:：]\\s*([^；;]+)`));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

/** 解析农场业务类型文案：优先 remark 中的产业类型，兜底后端 farmType 枚举 */
function resolveFarmTypeLabel(farm: Farm): string {
  return parseRemarkField(farm.remark, '产业类型') ?? FARM_TYPE_FALLBACK_MAP[farm.farmType] ?? '未分类';
}

/** 解析农场海拔（米） */
function resolveAltitude(farm: Farm): string {
  return parseRemarkField(farm.remark, '海拔') ?? '暂未录入';
}

/** 将后端 map 型统计转换为强类型结构（缺省值 0，避免 NaN 渲染） */
function toFarmSummary(raw: Record<string, number> | undefined): FarmSummary {
  const pick = (key: string): number => {
    const value = (raw as unknown as Record<string, unknown> | undefined)?.[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    plotCount: pick('plotCount'),
    plotAreaTotal: pick('plotAreaTotal'),
    areaTotal: pick('areaTotal')
  };
}

/** 格式化面积（亩） */
function formatArea(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return `${Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: 2
  })}亩`;
}

/**
 * 农场列表页
 *
 * 业务职责：以列表或卡片视图展示主体下全部农场，默认列表，支持检索筛选、
 * 切换当前农场、启停、删除，以及「下载模板 → 编辑 → 上传 CSV」的批量导入。
 *
 * @returns 页面内容
 */
const FarmList = defineComponent({
  name: "FarmList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const setCurrentFarm = useFarmStore(state => state.setCurrentFarm);
    const viewMode = shallowRef<'list' | 'card'>('list');
    const setViewMode = (next: typeof viewMode.value | ((previous: typeof viewMode.value) => typeof viewMode.value)) => {
      viewMode.value = typeof next === 'function' ? (next as (previous: typeof viewMode.value) => typeof viewMode.value)(viewMode.value) : next;
    };
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const filters = shallowRef<FilterValues>({});
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const [filterForm] = Form.useForm<FilterValues>();
    /** 导入弹窗开关 */
    const importOpen = shallowRef<boolean>(false);
    /** 农场分页数据（关键字 / 状态由服务端过滤） */
    const setImportOpen = (next: typeof importOpen.value | ((previous: typeof importOpen.value) => typeof importOpen.value)) => {
      importOpen.value = typeof next === 'function' ? (next as (previous: typeof importOpen.value) => typeof importOpen.value)(importOpen.value) : next;
    };
    const listQuery = useQuery(() => ({
      queryKey: ['farms', filters.value, pageNum.value, pageSize.value],
      queryFn: () => listFarms({
        keyword: filters.value.keyword?.trim() || undefined,
        status: filters.value.status,
        typeLabel: filters.value.typeLabel,
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })
    }));

    /** 当前页农场 ID，用于并行拉取各自概况 */
    const pageFarmIds = computed<string[]>(() => (listQuery.data?.list ?? []).map(farm => farm.farmId).filter(Boolean));

    /** 各农场概况（地块数 / 在田面积 / 总面积） */
    const summaryResults = useQueries(() => ({
      queries: pageFarmIds.value.map(farmId => ({
        queryKey: ['farm-summary', farmId],
        queryFn: () => getFarmSummary(farmId),
        retry: false,
        staleTime: 60_000
      }))
    }));

    /** 各农场任务总数（原型「本月任务」） */
    const taskResults = useQueries(() => ({
      queries: pageFarmIds.value.map(farmId => ({
        queryKey: ['farm-task-count', farmId],
        queryFn: () => listTasks({
          farmId,
          pageNum: 1,
          pageSize: 1
        }),
        retry: false,
        staleTime: 60_000
      }))
    }));

    /** 各农场告警总数（原型「告警 N 条」） */
    const alertResults = useQueries(() => ({
      queries: pageFarmIds.value.map(farmId => ({
        queryKey: ['farm-alert-count', farmId],
        queryFn: () => listAlerts({
          farmId,
          pageNum: 1,
          pageSize: 1
        }),
        retry: false,
        staleTime: 60_000
      }))
    }));

    /** farmId → 概况映射 */
    const summaryMap = computed<Record<string, FarmSummary>>(() => {
      const map: Record<string, FarmSummary> = {};
      summaryResults.value.forEach((result, index) => {
        map[pageFarmIds.value[index]] = toFarmSummary(result.data);
      });
      return map;
    });

    /** farmId → 任务数映射 */
    const taskCountMap = computed<Record<string, number>>(() => {
      const map: Record<string, number> = {};
      taskResults.value.forEach((result, index) => {
        map[pageFarmIds.value[index]] = result.data?.total ?? 0;
      });
      return map;
    });

    /** farmId → 告警数映射 */
    const alertCountMap = computed<Record<string, number>>(() => {
      const map: Record<string, number> = {};
      alertResults.value.forEach((result, index) => {
        map[pageFarmIds.value[index]] = result.data?.total ?? 0;
      });
      return map;
    });

    /** 统一刷新 */
    const invalidateFarms = (): Promise<void> => queryClient.invalidateQueries({
      queryKey: ['farms']
    });

    /** 启停农场 */
    const statusMutation = useMutation(() => ({
      mutationFn: (params: {
        farmId: string;
        status: number;
      }) => updateFarmStatus(params.farmId, params.status),
      onSuccess: () => {
        message.success('农场状态已更新');
        void invalidateFarms();
      }
    }));

    /** 删除农场 */
    const deleteMutation = useMutation(() => ({
      mutationFn: (farmId: string) => deleteFarm(farmId),
      onSuccess: () => {
        message.success('农场已删除');
        void invalidateFarms();
      }
    }));

    /** 条件由服务端在分页前统一过滤，记录数与当前页数据保持一致。 */
    const filteredList = computed<Farm[]>(() => listQuery.data?.list ?? []);

    /** 统计条数据 */
    const stats = computed(() => {
      const total = listQuery.data?.total ?? 0;
      const activeCount = filteredList.value.filter(farm => farm.status === 1).length;
      const areaTotal = filteredList.value.reduce((sum, farm) => sum + (Number(farm.areaTotal) || 0), 0);
      const plotCount = filteredList.value.reduce((sum, farm) => sum + (summaryMap.value[farm.farmId]?.plotCount ?? 0), 0);
      return {
        total,
        activeCount,
        areaTotal,
        plotCount
      };
    });

    /** 切换当前农场（作用域上下文） */
    const handleSwitchFarm = (farm: Farm): void => {
      setCurrentFarm.value({
        farmId: farm.farmId,
        farmCode: farm.farmCode,
        farmName: farm.farmName
      });
      message.success(`已切换到「${farm.farmName}」`);
    };

    /** 停启用确认 */
    const confirmToggleStatus = (farm: Farm): void => {
      const next = farm.status === 1 ? 0 : 1;
      Modal.confirm({
        title: next === 1 ? '确认启用该农场？' : '确认停用该农场？',
        content: `农场：${farm.farmName}。停用后该农场下的地块与任务将不再参与调度。`,
        okText: next === 1 ? '确认启用' : '确认停用',
        cancelText: '取消',
        onOk: () => statusMutation.mutate({
          farmId: farm.farmId,
          status: next
        })
      });
    };

    /** 删除确认 */
    const confirmDelete = (farm: Farm): void => {
      Modal.confirm({
        title: '确认删除该农场？',
        content: `农场：${farm.farmName}。删除后不可恢复，请先完成数据备份。`,
        okText: '确认删除',
        okButtonProps: {
          danger: true
        },
        cancelText: '取消',
        onOk: () => deleteMutation.mutate(farm.farmId)
      });
    };

    /** 更多下拉：统一分发 */
    const handleMoreAction = (key: string, farm: Farm): void => {
      switch (key) {
        case 'monitor':
          navigate(`/production/monitor?farmId=${farm.farmId}`);
          break;
        case 'default':
          handleSwitchFarm(farm);
          break;
        case 'plots':
          navigate(`/production/plots?farmId=${farm.farmId}`);
          break;
        case 'plot-create':
          navigate(`/production/plots/create?farmId=${farm.farmId}`);
          break;
        case 'edit':
          navigate(`/production/farms/create?farmId=${farm.farmId}`);
          break;
        case 'toggle':
          confirmToggleStatus(farm);
          break;
        case 'delete':
          confirmDelete(farm);
          break;
        default:
          break;
      }
    };

    /** 构建卡片「更多」菜单 */
    const buildMenuItems = (farm: Farm): MenuProps['items'] => [{
      key: 'monitor',
      label: '生产监控'
    }, {
      key: 'default',
      label: '设为默认农场'
    }, {
      key: 'plots',
      label: '查看地块'
    }, {
      key: 'plot-create',
      label: '新增地块'
    }, {
      key: 'edit',
      label: '编辑资料'
    }, {
      type: 'divider'
    }, {
      key: 'toggle',
      label: farm.status === 1 ? '停用农场' : '启用农场'
    }, {
      key: 'delete',
      label: '删除农场',
      danger: true
    }];

    /** 查询 */
    const handleSearch = (): void => {
      setFilters(filterForm.getFieldsValue());
      setPageNum(1);
    };

    /** 重置 */
    const handleReset = (): void => {
      filterForm.resetFields();
      setFilters({});
      setPageNum(1);
    };
    const openImportModal = (): void => setImportOpen(true);

    /** 列表与卡片共用数据源和操作，切换不重置筛选与分页。 */
    const farmColumns = computed<ColumnsType<Farm>>(() => [{
      title: '农场名称',
      key: 'name',
      width: 210,
      fixed: 'left',
      ellipsis: true,
      render: (_, farm) => <span class="production-dense-name-wrap">
          <Typography.Link title={farm.farmName} onClick={() => navigate(`/production/farms/${farm.farmId}`)}>
            {farm.farmName}
          </Typography.Link>
          {currentFarm.value?.farmId === farm.farmId && <Tag color="gold">★ 默认</Tag>}
        </span>
    }, {
      title: '农场编号',
      dataIndex: 'farmCode',
      key: 'code',
      width: 150,
      ellipsis: true,
      render: value => value || '—'
    }, {
      title: '状态',
      key: 'status',
      width: 96,
      render: (_, farm) => {
        const meta = FARM_STATUS_META[farm.status] ?? {
          label: '未知',
          color: 'default'
        };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '类型',
      key: 'type',
      width: 110,
      ellipsis: true,
      render: (_, farm) => resolveFarmTypeLabel(farm)
    }, {
      title: '所在地区',
      key: 'region',
      width: 200,
      ellipsis: true,
      render: (_, farm) => {
        const region = [farm.province, farm.city, farm.district].filter(Boolean).join(' · ') || '—';
        return <span class="production-dense-link-ellipsis" title={region}>{region}</span>;
      }
    }, {
      title: '面积（亩）',
      key: 'area',
      width: 112,
      ellipsis: true,
      render: (_, farm) => formatArea(farm.areaTotal)
    }, {
      title: '地块数',
      key: 'plots',
      width: 84,
      render: (_, farm) => summaryResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? summaryMap.value[farm.farmId]?.plotCount ?? 0 : '—'
    }, {
      title: '任务总数',
      key: 'tasks',
      width: 92,
      render: (_, farm) => taskResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? taskCountMap.value[farm.farmId] ?? 0 : '—'
    }, {
      title: '告警总数',
      key: 'alerts',
      width: 92,
      render: (_, farm) => alertResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? alertCountMap.value[farm.farmId] ?? 0 : '—'
    }, {
      title: '负责人',
      dataIndex: 'managerName',
      key: 'managerName',
      width: 100,
      ellipsis: true,
      render: value => value || '—'
    }, {
      title: '联系电话',
      dataIndex: 'managerPhone',
      key: 'managerPhone',
      width: 132,
      ellipsis: true,
      render: value => value || '—'
    }, {
      title: '操作',
      key: 'actions',
      width: 210,
      fixed: 'right',
      render: (_, farm) => <Space size={10}>
        <Typography.Link onClick={() => navigate(`/production/farms/${farm.farmId}`)}>查看详情</Typography.Link>
        <Dropdown trigger={['click']} menu={{
          items: buildMenuItems(farm),
          onClick: (info: { key: string | number }) => handleMoreAction(String(info.key), farm)
        }}>
          <Button type="link" size="small">更多 <DownOutlined /></Button>
        </Dropdown>
      </Space>
    }]);

    /** 渲染单张农场卡片（原型 P1） */
    const renderFarmCard = (farm: Farm): VNodeChild => {
      const summary = summaryMap.value[farm.farmId];
      const taskCount = taskCountMap.value[farm.farmId] ?? 0;
      const alertCount = alertCountMap.value[farm.farmId] ?? 0;
      const isDefault = currentFarm.value?.farmId === farm.farmId;
      const statusMeta = FARM_STATUS_META[farm.status] ?? {
        label: '未知',
        color: 'default'
      };
      const plantedArea = summary?.plotAreaTotal ?? 0;
      return <Card key={farm.farmId} hoverable loading={listQuery.isLoading} title={<Space size={6}>
            <span>🌾</span>
            <Typography.Text strong ellipsis style={{
          maxWidth: 160
        }}>
              {farm.farmName}
            </Typography.Text>
            {isDefault && <Tag color="gold" style={{
          marginInlineEnd: 0
        }}>
                ★ 默认
              </Tag>}
          </Space>} extra={<Dropdown trigger={['click']} menu={{
        items: buildMenuItems(farm),
        onClick: (info: { key: string | number }) => handleMoreAction(String(info.key), farm)
      }}>
            <Button size="small">
              更多 <DownOutlined />
            </Button>
          </Dropdown>} actions={[<Typography.Link key="detail" onClick={() => navigate(`/production/farms/${farm.farmId}`)}>
            查看详情
          </Typography.Link>, <Typography.Link key="monitor" onClick={() => navigate(`/production/monitor?farmId=${farm.farmId}`)}>
            生产监控→
          </Typography.Link>]}>
        <Space direction="vertical" size={14} style={{
          width: '100%'
        }}>
          <Space size={6} wrap>
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            <Tag>{resolveFarmTypeLabel(farm)}</Tag>
          </Space>
          <Typography.Text type="secondary">编号：{farm.farmCode || '—'}</Typography.Text>
          <DetailInfoGrid columns={2} items={[{
            key: 'region',
            label: '所在地区',
            value: [farm.province, farm.city, farm.district].filter(Boolean).join(' · '),
            fullWidth: true
          }, {
            key: 'area',
            label: '农场面积',
            value: formatArea(Number(farm.areaTotal))
          }, {
            key: 'planted',
            label: '地块面积合计',
            value: summaryResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? formatArea(plantedArea) : '—'
          }, {
            key: 'plots',
            label: '地块数',
            value: summaryResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? `${summary?.plotCount ?? 0} 个` : '—'
          }, {
            key: 'tasks',
            label: '任务总数',
            value: taskResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? taskCount : '—'
          }, {
            key: 'alerts',
            label: '告警总数',
            value: alertResults.value[pageFarmIds.value.indexOf(farm.farmId)]?.data ? alertCount : '—'
          }, {
            key: 'manager',
            label: '负责人',
            value: farm.managerName
          }, {
            key: 'phone',
            label: '联系电话',
            value: farm.managerPhone
          }, {
            key: 'altitude',
            label: '海拔',
            value: resolveAltitude(farm)
          }]} />
        </Space>
      </Card>;
    };

    /** 渲染内容区（加载 / 错误 / 空 / 卡片 / 列表） */
    const selected = shallowRef<(string | number)[]>([]);
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const listToolbar = computed(() => <Space wrap size={8}>
      {[<Button key="import" icon={<ImportOutlined />} onClick={openImportModal}>
          导入
        </Button>, <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/farms/create')}>
          新建农场
        </Button>]}
      <Segmented aria-label="农场展示方式" value={viewMode.value} onChange={value => setViewMode(value as 'list' | 'card')} options={[{
        label: '列表',
        value: 'list',
        icon: <UnorderedListOutlined />
      }, {
        label: '卡片',
        value: 'card',
        icon: <AppstoreOutlined />
      }]} />
      <ListSummary trigger="click" content={<div class="production-dense-card-title">
            <span class="production-dense-card-title-text">农场档案</span>
            <span class="production-dense-summary-inline">
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">符合条件</span>
                <span class="production-dense-metric-value">{listQuery.isError || !listQuery.data ? '—' : `${stats.value.total} 个`}</span>
              </span>
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">当前页运营中</span>
                <span class="production-dense-metric-value is-success">{listQuery.isError || !listQuery.data ? '—' : `${stats.value.activeCount} 个`}</span>
              </span>
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">当前页面积</span>
                <span class="production-dense-metric-value">{listQuery.isError || !listQuery.data ? '—' : `${stats.value.areaTotal.toLocaleString('zh-CN', {
                maximumFractionDigits: 2
              })} 亩`}</span>
              </span>
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">当前页地块数</span>
                <span class="production-dense-metric-value">{summaryResults.value.some(result => !result.data || result.isError) || !listQuery.data ? '—' : `${stats.value.plotCount} 个`}</span>
              </span>
            </span>
          </div>}><Button>统计</Button></ListSummary>
    </Space>);
    const renderContent = (): VNodeChild => {
      if (viewMode.value === 'list' && !listQuery.isError) {
        return <BusinessRecordList memberListToolbar toolbarTitle={listToolbar.value} onReload={() => Promise.all([listQuery.refetch(), ...summaryResults.value.map(query => query.refetch()), ...taskResults.value.map(query => query.refetch()), ...alertResults.value.map(query => query.refetch())])} rowKey="farmId" rowSelection={{
          selectedRowKeys: selected.value,
          onChange: setSelected
        }} columns={farmColumns.value} dataSource={filteredList.value} loading={listQuery.isLoading} pagination={false} scroll={{
          x: 1600
        }} locale={{
          emptyText: '暂无匹配的农场，试试调整筛选条件或新建农场'
        }} />;
      }
      if (listQuery.isLoading) {
        return <Row gutter={[16, 16]}>
          {[0, 1, 2].map(key => <Col key={key} xs={24} md={12} xxl={8}>
              <Card loading />
            </Col>)}
        </Row>;
      }
      if (listQuery.isError) {
        return <Empty description={<Space direction="vertical">
              <Typography.Text type="danger">农场数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void listQuery.refetch()}>重新加载</Button>
            </Space>} />;
      }
      if (filteredList.value.length === 0) {
        return <Empty description={<Space direction="vertical">
              <Typography.Text type="secondary">
                暂无匹配的农场，试试调整筛选条件
              </Typography.Text>
              <Button type="primary" onClick={() => navigate('/production/farms/create')}>
                立即新建农场
              </Button>
            </Space>} />;
      }
      return <div class="farm-record-grid">
        {filteredList.value.map(farm => renderFarmCard(farm))}
      </div>;
    };
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="农场管理" subTitle={`共 ${stats.value.total} 个农场`}>
      <Card class="production-dense-filter-card">
        <ProductionListFilters form={filterForm} onFinish={handleSearch} onReset={handleReset} loading={listQuery.isFetching}>
          <Form.Item name="keyword" label="关键字">
            <Input allowClear placeholder="搜索农场名称/编号..." />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select allowClear placeholder="全部状态" options={[{
                value: 1,
                label: '运营中'
              }, {
                value: 0,
                label: '已停用'
              }]} />
          </Form.Item>
          <Form.Item name="typeLabel" label="类型">
            <Select allowClear placeholder="全部类型" options={FARM_TYPE_BUSINESS_OPTIONS.map(label => ({
                value: label,
                label
              }))} />
          </Form.Item>
        </ProductionListFilters>
      </Card>
      <Card>

        {(viewMode.value !== 'list' || listQuery.isError) && listToolbar.value}
        {renderContent()}
        {!listQuery.isError && (listQuery.data?.total ?? 0) > 0 && <div style={{
            marginTop: 10
          }}>
            <ProductionPagination selectedCount={viewMode.value === 'list' ? selected.value.length : 0} current={pageNum.value} pageSize={pageSize.value} total={listQuery.data?.total ?? 0} onChange={(nextPage, nextSize) => {
              setPageNum(nextSize === pageSize.value ? nextPage : 1);
              setPageSize(nextSize);
            }} />
          </div>}
      </Card>

      {importOpen.value && <FarmImportModal onClose={() => setImportOpen(false)} onComplete={invalidateFarms} />}
    </PageContainer>;
    };
  }
});
export default FarmList;
