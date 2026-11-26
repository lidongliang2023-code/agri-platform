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
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import '@/pages/user/quality/quality-trace.css';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import Card from '@/vue/business/components/SectionCard';
import ProTable from '@/vue/ProductionRequestTable';
/**
 * 页面名称：质量检测管理
 * 路由路径：/production/quality
 * 所属模块：质量检测与溯源
 * PRD 序号：PRD 6.1 #34
 * 原型来源：用户端原型 P25 trace-inspections
 *
 * 还原要点：
 * - 标题 🔬 质量检测记录 + `+ 录入检测报告` 按钮
 * - 统计：合格 / 不合格 / 待检 / 检测中（当前农场服务端分页总数）
 * - 筛选：全部结果（合格 / 不合格 / 待检）+ 全部机构 + 搜索检测编号
 * - 表格列：检测编号 | 产品名称 | 批次号 | 检测项目 | 检测机构 | 检测日期 | 结果 | 上链 | 操作
 * - 行操作：报告（→trace-reports）/ 结果录入（PASS、FAIL）/ 明细 / 删除
 * - 结论提交后端联动领域事件：PASS → prod.quality.test.passed，FAIL → prod.quality.test.failed
 */

import { useNavigate, useSearchParams } from '@/vue/router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer } from '@/vue/pro';
import type { ProColumns } from '@/vue/pro';
import { AutoComplete, Button, Col, DatePicker, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Tag, Tooltip, Typography, message } from '@/vue/ui';
import type { Dayjs } from 'dayjs';
import { DeleteOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { deleteInspection, fetchInspectionItems, fetchInspectionPage, fetchLabPage, registerInspection, submitInspectionResult } from '@/api/quality';
import { listHarvests } from '@/api/harvests';
import { listBlockchainByBiz } from '@/api/blockchain';
import type { BlockchainBizRecord, HarvestBatch, InspectionItem, RawInspection, TestingLab } from '@/types';

/** 检测类型选项 */
const INSPECT_TYPE_OPTIONS: {
  value: string;
  label: string;
}[] = [{
  value: 'SELF',
  label: '自检'
}, {
  value: 'SEND',
  label: '送检'
}, {
  value: 'SAMPLING',
  label: '抽检'
}];

/** 检测类型展示文案 */
const INSPECT_TYPE_TEXT: Record<string, string> = {
  SELF: '自检',
  SEND: '送检',
  SAMPLING: '抽检'
};

/** 检测单状态选项 */
const INSPECT_STATUS_OPTIONS: {
  value: string;
  label: string;
}[] = [{
  value: 'PENDING',
  label: '待检'
}, {
  value: 'TESTING',
  label: '检测中'
}, {
  value: 'DONE',
  label: '已完成'
}];

/** 结果筛选选项 */
const RESULT_OPTIONS: {
  value: string;
  label: string;
}[] = [{
  value: 'all',
  label: '全部结果'
}, {
  value: 'PASS',
  label: '合格'
}, {
  value: 'FAIL',
  label: '不合格'
}, {
  value: 'PENDING',
  label: '待检'
}];

/** 送检登记表单值 */
interface InspectionFormValues {
  /** 检测单号 */
  inspectionNo: string;
  /** 关联批次 */
  batchId?: string;
  /** 地块 */
  plotId?: string;
  /** 作物 */
  cropId?: string;
  /** 检测类型 */
  inspectionType: string;
  /** 检测机构名称 */
  labName?: string;
  /** 检测人 */
  inspectorName?: string;
  /** 抽样数量 */
  sampleQty?: number;
  /** 抽样时间 */
  sampleAt?: Dayjs;
  /** 报告附件地址 */
  reportUrl?: string;
  /** 检测单状态 */
  status: string;
}

/** 结果录入表单值 */
interface ResultFormValues {
  /** 检测结论 */
  result: string;
  /** 报告附件地址 */
  reportUrl?: string;
}

/**
 * 列表筛选条件（全部在服务端生效）
 *
 * <p>注释里标的"（前端）"是旧口径的遗留：结果与机构以前在浏览器里筛那 200 条，
 * 表格再本地翻页。200 条一填满，"待检"就筛不出东西、换机构毫无反应 —— 看着像数据没了。
 * 现在三个条件都进请求。</p>
 */
interface InspectionFilters {
  /** 检测单号 / 批次号 / 作物名 关键字（服务端） */
  keyword?: string;
  /** 结果（服务端）：PASS / FAIL / PENDING；'all' 表示不筛这一项 */
  result?: string;
  /** 检测机构全名（服务端精确匹配） */
  labName?: string;
}

/** 仅保留日期 */
function formatDate(value?: string): string {
  if (!value) return '-';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : value;
}

/**
 * 质量检测记录页
 *
 * 业务职责：检测任务台账，支持送检登记、结论录入（合格 / 不合格）、明细查看与报告跳转。
 *
 * @returns 页面内容
 */
const QualityInspection = defineComponent({
  name: "QualityInspection",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const farmId = computed(() => currentFarm.value?.farmId);
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const selectedKeys = shallowRef<string[]>([]);
    /**
     * 支持从存证列表带 `?keyword=<质检单号>` 跳进来（存证的 target_code 就是检测单号）。
     * 没有这个入口时，从一条存证回不到它对应的那张检测单。
     */
    const setSelectedKeys = (next: typeof selectedKeys.value | ((previous: typeof selectedKeys.value) => typeof selectedKeys.value)) => {
      selectedKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedKeys.value) => typeof selectedKeys.value)(selectedKeys.value) : next;
    };
    const [searchParams] = useSearchParams();
    const initialKeyword = computed(() => searchParams.value.get('keyword') ?? '');
    const filters = shallowRef<InspectionFilters>((() => initialKeyword.value ? {
      keyword: initialKeyword.value
    } : {})());
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const [filterForm] = Form.useForm<InspectionFilters>();
    onMounted(() => {
      watch(() => [initialKeyword.value, filterForm], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (initialKeyword.value) {
            filterForm.setFieldsValue({
              keyword: initialKeyword.value
            });
          }
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const createOpen = shallowRef<boolean>(false);
    const setCreateOpen = (next: typeof createOpen.value | ((previous: typeof createOpen.value) => typeof createOpen.value)) => {
      createOpen.value = typeof next === 'function' ? (next as (previous: typeof createOpen.value) => typeof createOpen.value)(createOpen.value) : next;
    };
    const [createForm] = Form.useForm<InspectionFormValues>();
    const resultTarget = shallowRef<RawInspection | null>(null);
    const setResultTarget = (next: typeof resultTarget.value | ((previous: typeof resultTarget.value) => typeof resultTarget.value)) => {
      resultTarget.value = typeof next === 'function' ? (next as (previous: typeof resultTarget.value) => typeof resultTarget.value)(resultTarget.value) : next;
    };
    const [resultForm] = Form.useForm<ResultFormValues>();
    const detailId = shallowRef<string>('');

    /**
     * 检测单列表：筛选与分页都在服务端。
     *
     * <p>{@code 'all'} 是"全部结果"那个选项的值，**不能发给后端**——发过去就成了
     * {@code result='all'} 的等值筛选，一条都不剩。这里就地折成"不筛这一项"。</p>
     */
    const setDetailId = (next: typeof detailId.value | ((previous: typeof detailId.value) => typeof detailId.value)) => {
      detailId.value = typeof next === 'function' ? (next as (previous: typeof detailId.value) => typeof detailId.value)(detailId.value) : next;
    };
    const listQuery = useQuery(() => ({
      queryKey: ['quality-inspections', farmId.value, filters.value, pageNum.value, pageSize.value],
      enabled: Boolean(farmId.value),
      queryFn: () => fetchInspectionPage({
        farmId: farmId.value,
        keyword: filters.value.keyword?.trim() || undefined,
        result: filters.value.result && filters.value.result !== 'all' ? filters.value.result : undefined,
        labName: filters.value.labName?.trim() || undefined,
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })
    }));

    /** 当前农场全量检测状态统计，不受下方列表筛选影响。 */
    const inspectionStats = useQueries(() => ({
      queries: [{
        label: '合格',
        status: 'DONE',
        result: 'PASS',
        color: '#52c41a'
      }, {
        label: '不合格',
        status: 'DONE',
        result: 'FAIL',
        color: '#ff4d4f'
      }, {
        label: '待检',
        status: 'PENDING',
        result: undefined,
        color: undefined
      }, {
        label: '检测中',
        status: 'TESTING',
        result: undefined,
        color: undefined
      }].map(item => ({
        queryKey: ['quality-inspections-stats', farmId.value, item.status, item.result],
        enabled: Boolean(farmId.value),
        queryFn: () => fetchInspectionPage({
          farmId: farmId.value,
          status: item.status,
          result: item.result,
          pageNum: 1,
          pageSize: 1
        }),
        select: (page: Awaited<ReturnType<typeof fetchInspectionPage>>) => ({
          ...item,
          count: page.total
        })
      }))
    }));
    onMounted(() => {
      watch(() => [farmId.value, createForm, resultForm], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setPageNum(1);
          setSelectedKeys([]);
          setDetailId('');
          setCreateOpen(false);
          setResultTarget(null);
          createForm.resetFields();
          resultForm.resetFields();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 检测机构下拉 */
    const labQuery = useQuery(() => ({
      queryKey: ['quality-lab-options'],
      enabled: Boolean(farmId.value),
      queryFn: () => fetchLabPage({
        pageNum: 1,
        pageSize: 100
      })
    }));

    /** 采收批次下拉 */
    const batchQuery = useQuery(() => ({
      queryKey: ['harvest-batch-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listHarvests({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 100
      })
    }));

    /** 检测项明细 */
    const detailQuery = useQuery(() => ({
      queryKey: ['quality-inspection-items', detailId.value],
      enabled: Boolean(detailId.value),
      queryFn: () => fetchInspectionItems(detailId.value)
    }));

    /** 当前列表的检测单号（存证域 INSPECTION 类按单号关联，非 inspectionId） */
    const inspectionNos = computed<string[]>(() => (listQuery.data?.list ?? []).map(item => String(item.inspectionNo ?? item.inspectionId ?? '')).filter(item => item !== ''));

    /** 存证域：逐条按检测单号查上链存证（GET /blockchain/by-biz，裸数组，无记录返回 []） */
    const anchorQueries = useQueries(() => ({
      queries: inspectionNos.value.map(bizNo => ({
        queryKey: ['blockchain-by-biz', 'INSPECTION', bizNo],
        enabled: Boolean(bizNo),
        retry: false,
        queryFn: () => listBlockchainByBiz({
          bizType: 'INSPECTION' as const,
          bizNo
        })
      }))
    }));

    /** 检测单号 → 存证记录（同单号多条时取第一条） */
    const anchorMap = computed(() => {
      const map = new Map<string, BlockchainBizRecord>();
      anchorQueries.value.forEach(query => {
        ;
        (query.data ?? []).forEach(record => {
          const key = String(record.bizNo ?? '');
          if (key !== '' && !map.has(key)) {
            map.set(key, record);
          }
        });
      });
      return map;
    });

    /** 存证查询是否仍在进行（进行中不渲染结论，避免把「还没查到」显示成「无存证」） */
    const anchorLoading = computed(() => anchorQueries.value.some(query => query.isFetching));

    /** 机构下拉选项 */
    const labOptions = computed(() => (labQuery.data?.list ?? []).map((lab: TestingLab) => ({
      value: lab.labName,
      label: lab.labName
    })));

    /** 批次下拉选项 */
    const batchOptions = computed(() => (batchQuery.data?.list ?? []).map((batch: HarvestBatch) => ({
      value: String(batch.batchId),
      label: `${batch.batchNo ?? batch.batchId} · ${batch.cropName ?? batch.cropId ?? '未知名产品'}`
    })));

    /** 当前页数据（服务端已按结果/机构/关键字筛好并切好页，这里不再本地二次过滤或本地翻页） */
    const pageRows = computed<RawInspection[]>(() => listQuery.data?.list ?? []);

    /** 统一失效刷新 */
    const invalidateAll = async (): Promise<void> => {
      await Promise.all(['harvests', 'harvest-batch-options', 'inventories', 'inventory', 'trace-codes'].map(key => queryClient.invalidateQueries({
        queryKey: [key]
      })));
      await queryClient.invalidateQueries({
        queryKey: ['quality-inspections']
      });
      await queryClient.invalidateQueries({
        queryKey: ['quality-inspections-stats']
      });
    };

    /** 送检登记 */
    const createMutation = useMutation(() => ({
      mutationFn: (payload: Partial<RawInspection>) => registerInspection(payload),
      onSuccess: () => {
        message.success('检测报告已登记');
        setCreateOpen(false);
        createForm.resetFields();
        void invalidateAll();
      },
      onError: (error: Error) => {
        message.error(error.message || '登记失败');
      }
    }));

    /** 结论录入 */
    const resultMutation = useMutation(() => ({
      mutationFn: (params: {
        inspectionId: string;
        result: string;
        reportUrl?: string;
      }) => submitInspectionResult(params.inspectionId, params.result, params.reportUrl),
      onSuccess: (_data, variables) => {
        message.success(variables.result === 'PASS' ? '合格结论已保存' : '不合格结论已保存，关联批次及库存已冻结');
        setResultTarget(null);
        resultForm.resetFields();
        void invalidateAll();
      }
    }));

    /** 删除检测单 */
    const deleteMutation = useMutation(() => ({
      mutationFn: (inspectionId: string) => deleteInspection(inspectionId),
      onSuccess: () => {
        message.success('检测单已删除');
        void invalidateAll();
      }
    }));

    /** 打开送检登记弹窗 */
    const openCreate = (): void => {
      setCreateOpen(true);
    };

    /** 提交送检登记 */
    const submitCreate = (): void => {
      void createForm.validateFields().then(values => {
        const lab = (labQuery.data?.list ?? []).find((item: TestingLab) => item.labName === values.labName);
        createMutation.mutate({
          inspectionNo: values.inspectionNo,
          batchId: values.batchId ? String(values.batchId).trim() : undefined,
          plotId: values.plotId,
          cropId: values.cropId,
          inspectionType: values.inspectionType,
          inspectorName: values.inspectorName,
          sampleQty: values.sampleQty,
          sampleAt: values.sampleAt ? values.sampleAt.format('YYYY-MM-DDTHH:mm:ss') : undefined,
          reportUrl: values.reportUrl,
          status: values.status,
          labId: lab?.labId,
          labName: values.labName
        });
      });
    };

    /** 提交结论 */
    const submitResult = (): void => {
      const _resultTargetAtStart = resultTarget.value;
      if (!_resultTargetAtStart) return;
      void resultForm.validateFields().then(values => {
        resultMutation.mutate({
          inspectionId: _resultTargetAtStart.inspectionId,
          result: values.result,
          reportUrl: values.reportUrl
        });
      });
    };

    /** 查询 */
    const handleSearch = (): void => {
      setFilters(filterForm.getFieldsValue());
      setPageNum(1);
      setSelectedKeys([]);
    };

    /** 重置 */
    const handleReset = (): void => {
      filterForm.resetFields();
      setFilters({});
      setPageNum(1);
      setSelectedKeys([]);
    };

    /** 表格列定义 */
    const columns = computed<ProColumns<RawInspection>[]>(() => [{
      title: '检测编号',
      dataIndex: 'inspectionNo',
      width: 180,
      render: (_, record) => record.inspectionNo ?? record.inspectionId
    }, {
      title: '产品名称',
      key: 'cropName',
      width: 130,
      render: (_, record) => record.cropName ?? record.cropId ?? '-'
    }, {
      title: '批次号',
      key: 'batchNo',
      width: 140,
      render: (_, record) => record.batchNo ?? record.batchId ?? '-'
    }, {
      title: '检测项目',
      key: 'inspectionType',
      width: 140,
      render: (_, record) => <Tag color="geekblue">
          {INSPECT_TYPE_TEXT[String(record.inspectionType)] ?? record.inspectionType ?? '—'}
        </Tag>
    }, {
      title: '检测机构',
      dataIndex: 'labName',
      width: 140,
      render: (_, record) => record.labName ?? '—'
    }, {
      title: '检测日期',
      dataIndex: 'sampleAt',
      width: 120,
      render: (_, record) => formatDate(record.sampleAt ?? record.createdAt)
    }, {
      title: '结果',
      key: 'result',
      width: 130,
      render: (_, record) => {
        if (record.status === 'TESTING') return <Tag color="processing">检测中</Tag>;
        if (record.status === 'PENDING') return <Tag>待检</Tag>;
        if (record.result === 'PASS') return <Tag color="green">合格</Tag>;
        if (record.result === 'FAIL') return <Tag color="red">不合格</Tag>;
        return <Tag>待检</Tag>;
      }
    }, {
      // 上链状态取自存证域 GET /blockchain/by-biz（bizType=INSPECTION、bizNo=检测单号），
      // 连服实测 DEMO-INSPC-001 能查到 SUCCESS 记录。
      // 旧实现读后端不存在的 record.onChain，把 undefined 当 false 渲染成「⏳ 待上链」，
      // 是没有依据的业务结论；现改为查存证域取真值，无记录时显示「无存证」。
      title: <Tooltip title="上链状态取自存证域 /blockchain/by-biz（按检测单号关联）：已上链=存证 SUCCESS、待上链=存证 PENDING、无存证=查过存证域但无匹配记录">
          上链 🔗
        </Tooltip>,
      key: 'onChain',
      width: 110,
      render: (_, record) => {
        if (anchorLoading.value) {
          return <Typography.Text type="secondary">查询中…</Typography.Text>;
        }
        const anchor = anchorMap.value.get(String(record.inspectionNo ?? record.inspectionId ?? ''));
        if (!anchor) {
          return <Typography.Text type="secondary">无存证</Typography.Text>;
        }
        if (anchor.status === 'SUCCESS') {
          // 交易哈希挂在 span 的原生 title 上：列宽只有 110px 放不下完整哈希，
          // 但哈希必须让用户取得到（hover 可见），同时也是「这条是真存证」的凭据。
          const blockText = anchor.blockHeight == null ? '' : ` · 区块高度 ${String(anchor.blockHeight)}`;
          return <Tooltip title={anchor.txHash ? `交易哈希 ${anchor.txHash}${blockText}` : '存证已确认'}>
              <span title={anchor.txHash ? `交易哈希 ${anchor.txHash}${blockText}` : undefined}>
                <Tag color="green">🔗 已上链</Tag>
              </span>
            </Tooltip>;
        }
        return <Tag>⏳ 待上链</Tag>;
      }
    }, {
      title: '操作',
      fixed: 'right',
      key: 'option',
      width: 150,
      valueType: 'option',
      render: (_, record) => <ListRowActions>
          <Typography.Link key="detail" onClick={() => setDetailId(record.inspectionId)}>
            明细
          </Typography.Link>
          <Typography.Link key="result" onClick={() => setResultTarget(record)}>
            结果录入
          </Typography.Link>
          <Typography.Link key="report" onClick={() => navigate(`/production/trace/reports?batchId=${encodeURIComponent(String(record.batchId ?? ''))}`)}>
            报告→
          </Typography.Link>
          <Popconfirm key="delete" title="确认删除该检测单？" okText="确认删除" cancelText="取消" onConfirm={() => deleteMutation.mutate(record.inspectionId)}>
            <Typography.Link type="danger">删除</Typography.Link>
          </Popconfirm>
        </ListRowActions>
    }]);

    /** 明细中的检测项列表（后端返回 Map 结构，兼容未来返回数组） */
    const detailItems = computed<InspectionItem[]>(() => {
      const data = detailQuery.data;
      if (!data) return [];
      if (Array.isArray(data.items) && data.items.length > 0) return data.items;
      return [{
        itemId: 'summary',
        inspectionId: String(data.inspectionId ?? ''),
        itemName: data.item ?? data.inspectionType ?? '综合检测',
        standardLimit: '按国家食品安全标准',
        measuredValue: data.result === 'PASS' ? '未超标' : data.result === 'FAIL' ? '超标' : '待检',
        unit: '',
        qualified: data.result === 'PASS'
      }];
    });
    return () => {
      return <PageContainer class="quality-trace-page production-list-dense production-member-list" title="质量检测记录" subTitle={currentFarm.value ? currentFarm.value.farmName : undefined}>
      <div class="production-dense-summary">
        <div class="production-dense-summary-items">
          {inspectionStats.value.map((query, index) => {
              const label = ['合格', '不合格', '待检', '检测中'][index];
        const statData = query.data as { count?: number; total?: number } | undefined;
        const val = query.isError || !statData ? '—' : (statData.count ?? statData.total ?? '—');
              const cls = index === 0 ? 'is-success' : index === 1 ? 'is-danger' : index === 2 ? 'is-warning' : '';
              return <span class="production-dense-metric" key={label}>
                <span class="production-dense-metric-label">{label}</span>
                <span class={`production-dense-metric-value ${cls}`}>{val} 单</span>
              </span>;
            })}
          {inspectionStats.value.some(query => query.isError) && <Button size="small" type="link" onClick={() => void invalidateAll()}>
              统计加载失败，重试
            </Button>}
        </div>
        <Tooltip title="统计范围：当前农场全部检测单；合格、不合格仅统计已完成检测，待检与检测中分别按实际状态统计，不受下方列表筛选影响。">
          <span class="production-dense-summary-note">
            统计口径：当前农场全部检测单（不受下方筛选影响）
          </span>
        </Tooltip>
      </div>

      <Card class="production-dense-filter-card">
        <ProductionListFilters form={filterForm} onFinish={handleSearch} onReset={handleReset} loading={listQuery.isFetching}>
          <Form.Item name="result" label="结果">
            <Select allowClear placeholder="全部结果" options={RESULT_OPTIONS} />
          </Form.Item>
          <Form.Item name="labName" label="机构">
            <Select allowClear showSearch optionFilterProp="label" placeholder="全部机构" options={labOptions.value} />
          </Form.Item>
          <Form.Item name="keyword" label="检测编号">
            <Input allowClear placeholder="搜索检测编号..." />
          </Form.Item>
        </ProductionListFilters>
      </Card>

      <ProTable memberListToolbar headerTitle={false} tableAlertRender={false} rowKey="inspectionId" size="small" columns={columns.value} dataSource={pageRows.value} loading={listQuery.isFetching} search={false} rowSelection={{
          selectedRowKeys: selectedKeys.value,
          onChange: keys => setSelectedKeys(keys.map(String))
        }} options={{
          reload: () => {
            void invalidateAll();
          },
          density: true,
          setting: true
        }} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          // 总数只认服务端给的（以前是 filteredList.length —— 本地筛完的那一批的长度，
          // 与"共 N 条"这句话的含义不一致，翻页器也就成了摆设）
          total: listQuery.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`,
          onChange: (nextPage, nextSize) => {
            setPageNum(nextPage);
            setPageSize(nextSize);
          }
        }} toolbar={{
          title: <Space size={8} wrap>
              <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                录入检测报告
              </Button>
            </Space>
        }} toolBarRender={false} />

      <Modal class="production-form-dialog quality-trace-dialog" title="录入检测报告" open={createOpen.value} okText="确认登记" cancelText="取消" width={720} confirmLoading={createMutation.isPending} destroyOnClose onOk={submitCreate} onCancel={() => setCreateOpen(false)}>
        <Form form={createForm} layout="vertical" style={{
            marginTop: 16
          }} initialValues={{
            inspectionNo: `INS${dayjs().format('YYYYMMDDHHmmss')}`,
            inspectionType: 'SEND',
            status: 'PENDING'
          }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspectionNo" label="检测编号" rules={[{
                  required: true,
                  message: '请输入检测编号'
                }]}>
                <Input placeholder="如 INS20260601001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="batchId" label="关联批次">
                <AutoComplete options={batchOptions.value} placeholder="选择或输入采收批次 ID" filterOption={(input: string, option: {label?: unknown; value?: unknown}) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspectionType" label="检测类型" rules={[{
                  required: true
                }]}>
                <Select options={INSPECT_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labName" label="检测机构" extra="后端 prod_inspection 暂无机构字段，暂不回显">
                <AutoComplete options={labOptions.value} placeholder="选择或输入检测机构" filterOption={(input: string, option: {label?: unknown; value?: unknown}) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspectorName" label="检测人">
                <Input placeholder="如 张三" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sampleQty" label="抽样数量">
                <InputNumber min={0} style={{
                    width: '100%'
                  }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sampleAt" label="抽样时间">
                <DatePicker showTime style={{
                    width: '100%'
                  }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="检测状态">
                <Select options={INSPECT_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="plotId" label="地块 ID">
                <Input placeholder="可空" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cropId" label="作物 ID">
                <Input placeholder="可空" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="reportUrl" label="报告附件地址">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal class="production-form-dialog quality-trace-dialog" title={`结果录入：${resultTarget.value?.inspectionNo ?? resultTarget.value?.inspectionId ?? ''}`} open={Boolean(resultTarget.value)} okText="确认提交" cancelText="取消" confirmLoading={resultMutation.isPending} destroyOnClose onOk={submitResult} onCancel={() => setResultTarget(null)}>
        <Form form={resultForm} layout="vertical" style={{
            marginTop: 16
          }} initialValues={{
            result: resultTarget.value?.result === 'FAIL' ? 'FAIL' : 'PASS',
            reportUrl: resultTarget.value?.reportUrl
          }}>
          <Form.Item name="result" label="检测结论" rules={[{
              required: true,
              message: '请选择检测结论'
            }]}>
            <Select options={[{
                value: 'PASS',
                label: '合格'
              }, {
                value: 'FAIL',
                label: '不合格'
              }]} />
          </Form.Item>
          <Form.Item name="reportUrl" label="报告附件地址">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer rootClassName="quality-trace-dialog production-detail-compact production-detail-dialog" title="检测项明细" width={720} open={Boolean(detailId.value)} onClose={() => setDetailId('')}>
        {detailQuery.isError ? <Typography.Text type="danger">明细加载失败，请稍后重试</Typography.Text> : <Space direction="vertical" size={16} style={{
            width: '100%'
          }}>
            <DetailInfoGrid columns={2} items={[{
              label: '检测编号',
              value: <>{detailQuery.data?.inspectionNo ?? detailId.value}</>
            }, {
              label: '检测类型',
              value: <>{INSPECT_TYPE_TEXT[String(detailQuery.data?.inspectionType)] ?? detailQuery.data?.inspectionType ?? '—'}</>
            }, {
              label: '检测项目',
              value: <>{detailQuery.data?.item ?? '—'}</>
            }, {
              label: '检测结论',
              value: <>{detailQuery.data?.result === 'PASS' ? <Tag color="green">合格</Tag> : detailQuery.data?.result === 'FAIL' ? <Tag color="red">不合格</Tag> : <Tag>待检</Tag>}</>
            }, {
              label: '检测单状态',
              value: <>{detailQuery.data?.status ?? '—'}</>,
              fullWidth: true
            }]} />
            <BusinessRecordList rowKey="itemId" size="small" loading={detailQuery.isFetching} dataSource={detailItems.value} pagination={false} locale={{
              emptyText: '暂无检测项明细'
            }} columns={[{
              title: '检测项',
              dataIndex: 'itemName'
            }, {
              title: '标准限值',
              dataIndex: 'standardLimit'
            }, {
              title: '实测值',
              dataIndex: 'measuredValue'
            }, {
              title: '单位',
              dataIndex: 'unit',
              render: value => value || '—'
            }, {
              title: '是否达标',
              dataIndex: 'qualified',
              render: (value: boolean) => value ? <Tag color="green">达标</Tag> : <Tag color="red">不达标</Tag>
            }]} />
            <Button icon={<FileTextOutlined />} onClick={() => navigate(`/production/trace/reports?batchId=${encodeURIComponent(String((listQuery.data?.list ?? []).find(item => item.inspectionId === detailId.value)?.batchId ?? ''))}`)}>
              查看溯源报告
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => {
              deleteMutation.mutate(detailId.value);
              setDetailId('');
            }}>
              删除该检测单
            </Button>
          </Space>}
      </Drawer>
    </PageContainer>;
    };
  }
});
export default QualityInspection;
