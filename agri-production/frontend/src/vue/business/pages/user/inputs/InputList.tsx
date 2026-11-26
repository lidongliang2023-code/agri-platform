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
import { Popover as ListSummary } from '@/vue/ui';
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import ProTable from '@/vue/ProductionRequestTable';
import Card from '@/vue/business/components/SectionCard';
import '@/pages/user/inputs/inputs.css'
/**
 * 页面名称：农资管理（投入品档案 / 使用台账）
 * 路由路径：/production/inputs（旧 /production/inputs/usages 跳 ?tab=ledger；旧 /production/inputs/stock 回落到本页）
 * 所属模块：农资管理
 * 原型来源：用户端原型 P10 inputs — 投入品列表（台账），并合并原出入库管理页、使用记录页
 *
 * 还原要点：
 * - 标题「🌾 农资管理」+ 扫码录入 / 手动添加 / 导入 / 导出 按钮（仅投入品档案 Tab 展示）
 * - 筛选器：统计周期（本月 / 本季度 / 本年）、全部类型、全部地块、全部合规
 * - 「📊 投入概况」4 项：肥料 / 农药 / 种苗 / 其他 的用量与次数
 * - 合规汇总：合规状态 / 拦截次数 / 预警次数 / 休药期地块数
 * - Tab 1 投入品档案：查询条件 + 投入概况 + 合规汇总 + 库存总览（原出入库管理）+ 投入品档案表
 * - Tab 2 使用台账：使用记录 + 合规/上链 + 出入库流水（原出入库管理）
 */

import { useNavigate, useSearchParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import type { ProColumns } from '@/vue/pro';
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Segmented, Select, Space, Tabs, Tag, Tooltip, Typography, Upload, message } from '@/vue/ui';
import { DownloadOutlined, ImportOutlined, PlusOutlined, ScanOutlined, WarningOutlined } from '@ant-design/icons-vue';
import useFarmStore from '@/vue/farmStore';
import { listPlots } from '@/api/plots';
import { createInputInfo, pageInputs, pageUsages, removeInput, updateInputInfo } from '@/api/inputs';
import type { InputInfo } from '@/api/inputs';
import type { InputUsageRecord, Plot } from '@/types';
import { INPUT_CATEGORY_OPTIONS, RANGE_OPTIONS, STOCK_STATE_META, STOCK_STATE_OPTIONS, checkAdmission, checkCompliance, categoryMeta, downloadCsv, fmtNumber, resolveRange, resolveStockState, summarizeCompliance } from '@/pages/user/inputs/shared';
import type { ComplianceItem, ComplianceLevel, StockState } from '@/pages/user/inputs/shared';
import InputStock from './InputStock';
import type { StockActionShortcut } from './InputStock';
import InputUsages from './InputUsages';

/** 主 Tab：投入品档案 / 使用台账（原「出入库管理」已拆入这两个 Tab） */
type MainTab = 'archive' | 'ledger';

/**
 * 归一化 `?tab=` 参数。
 *
 * <p>旧的「使用记录」页（`/production/inputs/usages`）映射到 ledger；
 * 旧的「出入库管理」页（`/production/inputs/stock`）已拆入两个 Tab，统一回落到
 * 投入品档案（库存总览所在位置）。</p>
 *
 * @param value 查询参数原始值
 * @returns 合法 Tab 值，缺省为投入品档案
 */
function normalizeTab(value: string | null): MainTab {
  return value === 'ledger' ? 'ledger' : 'archive';
}

/** 列表筛选条件 */
interface FilterState {
  /** 关键字：投入品名称 / 登记证号 */
  keyword?: string;
  /** 分类（后端 inputType 枚举） */
  category?: string;
  /** 合规等级 */
  compliance?: ComplianceLevel;
  /** 库存状态筛选：全部 / 正常 / 预警 / 临期 / 不足 */
  stockState?: StockState | 'all';
  /** 统计周期 */
  range?: string;
  /** 地块 ID */
  plotId?: string;
}

/** 概览统计项 */
interface OverviewItem {
  /** 分类编码 */
  value: string;
  /** 分类名称 */
  label: string;
  /** 用量合计 */
  qty: number;
  /** 用量单位 */
  unit: string;
  /** 使用次数 */
  count: number;
}

/** 使用台账行（含四项合规校验结果） */
interface LedgerRow {
  /** 使用记录 */
  usage: InputUsageRecord;
  /** 关联投入品 */
  input?: InputInfo;
  /** 四项合规校验结果 */
  items: ComplianceItem[];
  /** 整体合规等级 */
  level: ComplianceLevel;
  /** 地块名称 */
  plotName: string;
}

/**
 * 库存四态判定（优先级：不足 > 临期 > 预警 > 正常）
 *
 * 效期直接取后端回填的 `nearestExpireDate`（一次批量查询，不再逐项拉流水）。
 *
 * @param item 投入品
 * @returns 库存状态
 */
function stockStateOf(item: InputInfo): StockState {
  return resolveStockState(item.stockQty, item.warnQty, item.nearestExpireDate);
}

/**
 * 日期归一：截取 yyyy-MM-dd 前缀，保证字典序可直接比较。
 *
 * @param value 日期 / 时间字符串
 * @returns yyyy-MM-dd 串
 */
function dateKey(value: string): string {
  return value.slice(0, 10);
}

/**
 * 投入品列表页
 *
 * 业务职责：投入品档案增删改查 + 投入概况 + 合规汇总 + 使用台账。
 *
 * @returns 页面内容
 */
const InputList = defineComponent({
  name: "InputList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const farmId = computed(() => currentFarm.value?.farmId);
    const [searchParams, setSearchParams] = useSearchParams();
    // Tab 直接由 URL 派生：深链 ?tab=ledger（原「使用记录」页）/ ?tab=stock（原「出入库管理」页）
    // 与页内跳转（如出入库 Tab 的「使用登记」）都能即时落位
    const tab = computed(() => normalizeTab(searchParams.value.get('tab')));
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const filters = shallowRef<FilterState>({
      range: 'month'
    });
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const [filterForm] = Form.useForm<FilterState>();
    const [editForm] = Form.useForm<Partial<InputInfo>>();
    const editTarget = shallowRef<InputInfo | null>(null);
    const setEditTarget = (next: typeof editTarget.value | ((previous: typeof editTarget.value) => typeof editTarget.value)) => {
      editTarget.value = typeof next === 'function' ? (next as (previous: typeof editTarget.value) => typeof editTarget.value)(editTarget.value) : next;
    };
    const scanOpen = shallowRef<boolean>(false);
    const setScanOpen = (next: typeof scanOpen.value | ((previous: typeof scanOpen.value) => typeof scanOpen.value)) => {
      scanOpen.value = typeof next === 'function' ? (next as (previous: typeof scanOpen.value) => typeof scanOpen.value)(scanOpen.value) : next;
    };
    const scanCode = shallowRef<string>('');
    const setScanCode = (next: typeof scanCode.value | ((previous: typeof scanCode.value) => typeof scanCode.value)) => {
      scanCode.value = typeof next === 'function' ? (next as (previous: typeof scanCode.value) => typeof scanCode.value)(scanCode.value) : next;
    };
    const importOpen = shallowRef<boolean>(false);
    const setImportOpen = (next: typeof importOpen.value | ((previous: typeof importOpen.value) => typeof importOpen.value)) => {
      importOpen.value = typeof next === 'function' ? (next as (previous: typeof importOpen.value) => typeof importOpen.value)(importOpen.value) : next;
    };
    const importing = shallowRef<boolean>(false);
    const setImporting = (next: typeof importing.value | ((previous: typeof importing.value) => typeof importing.value)) => {
      importing.value = typeof next === 'function' ? (next as (previous: typeof importing.value) => typeof importing.value)(importing.value) : next;
    };
    const stockShortcut = shallowRef<StockActionShortcut>();

    /** 投入品档案（一次性取全量，前端完成分类 / 合规 / 库存预警过滤与分页） */
    const setStockShortcut = (next: typeof stockShortcut.value | ((previous: typeof stockShortcut.value) => typeof stockShortcut.value)) => {
      stockShortcut.value = typeof next === 'function' ? (next as (previous: typeof stockShortcut.value) => typeof stockShortcut.value)(stockShortcut.value) : next;
    };
    const inputsQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'archive'],
      queryFn: () => pageInputs({
        pageNum: 1,
        pageSize: 500
      })
    }));

    /** 使用记录（概况统计与台账数据源） */
    const usagesQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'usages'],
      queryFn: () => pageUsages({
        pageNum: 1,
        pageSize: 500
      })
    }));

    /** 地块下拉（地块筛选与地块名展示） */
    const plotsQuery = useQuery(() => ({
      queryKey: ['plot-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listPlots({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 200
      })
    }));

    /** 统一失效刷新 */
    const invalidateAll = (): Promise<void> => queryClient.invalidateQueries({
      queryKey: ['production-inputs']
    });

    /** 删除投入品档案 */
    const deleteMutation = useMutation(() => ({
      mutationFn: (inputId: string) => removeInput(inputId),
      onSuccess: () => {
        message.success('投入品已删除');
        void invalidateAll();
      }
    }));

    /** 编辑弹窗保存 */
    const saveMutation = useMutation(() => ({
      mutationFn: (payload: Partial<InputInfo>) => {
        if (!editTarget.value?.inputId) {
          return Promise.reject(new Error('缺少投入品 ID'));
        }
        return updateInputInfo(editTarget.value.inputId, payload);
      },
      onSuccess: () => {
        message.success('投入品已更新');
        setEditTarget(null);
        editForm.resetFields();
        void invalidateAll();
      }
    }));
    const allInputs = computed<InputInfo[]>(() => inputsQuery.data?.list ?? []);
    const inputMap = computed<Map<string, InputInfo>>(() => {
      const map = new Map<string, InputInfo>();
      allInputs.value.forEach(item => map.set(item.inputId, item));
      return map;
    });
    const plotMap = computed<Map<string, string>>(() => {
      const map = new Map<string, string>();
      (plotsQuery.data?.list ?? []).forEach((plot: Plot) => map.set(plot.plotId, plot.plotName));
      return map;
    });
    const plotOptions = computed(() => (plotsQuery.data?.list ?? []).map((plot: Plot) => ({
      value: plot.plotId,
      label: plot.plotName
    })));

    /** 统计周期区间 */
    const selectedRange = computed(() => resolveRange(filters.value.range ?? 'month'));
    const rangeStart = computed(() => selectedRange.value[0]);
    const rangeEnd = computed(() => selectedRange.value[1]);

    /** 周期内使用记录 */
    const rangedUsages = computed<InputUsageRecord[]>(() => (usagesQuery.data?.list ?? []).filter(usage => {
      if (!usage.usedAt) return false;
      const used = dateKey(usage.usedAt);
      if (used < rangeStart.value || used > rangeEnd.value) return false;
      if (filters.value.plotId && usage.plotId !== filters.value.plotId) return false;
      return true;
    }));

    /** 按投入品聚合周期内累计用量 */
    const cumulativeMap = computed<Map<string, number>>(() => {
      const map = new Map<string, number>();
      rangedUsages.value.forEach(usage => {
        if (!usage.inputId) return;
        map.set(usage.inputId, (map.get(usage.inputId) ?? 0) + (usage.dosage ?? 0));
      });
      return map;
    });

    /** 台账行：逐条执行四项合规校验 */
    const ledgerRows = computed<LedgerRow[]>(() => rangedUsages.value.map(usage => {
      const input = usage.inputId ? inputMap.value.get(usage.inputId) : undefined;
      const items = checkCompliance({
        inputName: usage.inputName ?? input?.inputName,
        inputType: input?.inputType,
        safetyInterval: usage.safetyIntervalDays ?? input?.safetyInterval,
        dosage: usage.dosage,
        unit: usage.unit,
        lastUsedAt: usage.usedAt,
        cumulativeDosage: usage.inputId ? cumulativeMap.value.get(usage.inputId) : undefined,
        plotName: usage.plotId ? plotMap.value.get(usage.plotId) : undefined
      });
      return {
        usage,
        input,
        items,
        level: summarizeCompliance(items),
        plotName: (usage.plotId ? plotMap.value.get(usage.plotId) : undefined) || usage.plotId || '-'
      };
    }));

    /** 投入概况：肥料 / 农药 / 种苗 / 其他 */
    const overview = computed<OverviewItem[]>(() => {
      const targets = ['FERTILIZER', 'PESTICIDE', 'SEED', 'OTHER'];
      return targets.map(value => {
        const rows = ledgerRows.value.filter(row => (row.input?.inputType ?? 'OTHER') === value);
        let qty = 0;
        const unitCount = new Map<string, number>();
        rows.forEach(row => {
          qty += row.usage.dosage ?? 0;
          const unit = row.usage.unit ?? '';
          if (unit) unitCount.set(unit, (unitCount.get(unit) ?? 0) + 1);
        });
        let unit = '';
        let max = 0;
        unitCount.forEach((count, key) => {
          if (count > max) {
            max = count;
            unit = key;
          }
        });
        return {
          value,
          label: categoryMeta(value).label,
          qty,
          unit,
          count: rows.length
        };
      });
    });

    /** 合规汇总 */
    const complianceSummary = computed(() => {
      let blocked = 0;
      let warning = 0;
      const withdrawalPlots = new Set<string>();
      ledgerRows.value.forEach(row => {
        if (row.level === 'blocked') blocked += 1;
        if (row.level === 'warning') warning += 1;
        const withdrawal = row.items.find(item => item.key === 'withdrawal');
        if (withdrawal && withdrawal.level !== 'pass' && row.usage.plotId) {
          withdrawalPlots.add(row.usage.plotId);
        }
      });
      return {
        blocked,
        warning,
        withdrawalPlots: withdrawalPlots.size,
        total: ledgerRows.value.length
      };
    });

    /** 档案过滤结果（合并库存总览后仍按低库存优先） */
    const filteredInputs = computed<InputInfo[]>(() => {
      const keyword = (filters.value.keyword ?? '').trim();
      const stateOrder: Record<StockState, number> = {
        shortage: 0,
        expiring: 1,
        warning: 2,
        normal: 3
      };
      return allInputs.value.filter(item => {
        if (keyword) {
          const haystack = `${item.inputName ?? ''}${item.registrationNo ?? ''}${item.manufacturer ?? ''}`;
          if (!haystack.includes(keyword)) return false;
        }
        if (filters.value.category && (item.inputType ?? 'OTHER') !== filters.value.category) return false;
        if (filters.value.compliance) {
          if (checkAdmission(item.inputName, item.inputType).level !== filters.value.compliance) {
            return false;
          }
        }
        if (filters.value.stockState && filters.value.stockState !== 'all') {
          if (stockStateOf(item) !== filters.value.stockState) return false;
        }
        return true;
      }).sort((left, right) => {
        const byState = stateOrder[stockStateOf(left)] - stateOrder[stockStateOf(right)];
        if (byState !== 0) return byState;
        return String(left.nearestExpireDate ?? '9999-12-31').localeCompare(String(right.nearestExpireDate ?? '9999-12-31'));
      });
    });

    /** 当前页档案数据 */
    const pagedInputs = computed<InputInfo[]>(() => filteredInputs.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value));

    /** 查询 */
    const handleSearch = (): void => {
      const values = filterForm.getFieldsValue();
      setPageNum(1);
      setFilters(prev => ({
        ...prev,
        ...values
      }));
    };

    /** 重置 */
    const handleReset = (): void => {
      filterForm.resetFields();
      setPageNum(1);
      setFilters({
        range: 'month'
      });
    };

    /**
     * 切换主 Tab（只改 URL，Tab 由 `?tab=` 派生）。
     *
     * <p>`create` / `usageId` 是一次性深链参数，切换 Tab 时一并清掉，避免下次进入
     * 使用台账时又弹出登记窗或残留筛选。</p>
     */
    const switchTab = (next: MainTab): void => {
      setPageNum(1);
      const params = new URLSearchParams(searchParams.value);
      params.delete('create');
      params.delete('usageId');
      if (next === 'archive') params.delete('tab');else params.set('tab', next);
      setSearchParams(params, {
        replace: true
      });
    };

    /** 打开编辑弹窗 */
    const openEdit = (record: InputInfo): void => {
      setEditTarget(record);
      editForm.setFieldsValue({
        inputName: record.inputName,
        inputType: record.inputType,
        registrationNo: record.registrationNo,
        manufacturer: record.manufacturer,
        spec: record.spec,
        unit: record.unit,
        safetyInterval: record.safetyInterval,
        stockQty: record.stockQty,
        warnQty: record.warnQty,
        status: record.status ?? 1
      });
    };

    /** 提交编辑 */
    const submitEdit = (): void => {
      const values = editForm.getFieldsValue();
      if (!values.inputName) {
        message.warning('请填写投入品名称');
        return;
      }
      saveMutation.mutate(values);
    };

    /** 扫码录入：按条码 / 登记证号 / 名称匹配 */
    const handleScan = (): void => {
      const code = scanCode.value.trim();
      if (!code) {
        message.warning('请输入或扫描投入品条码');
        return;
      }
      const hit = allInputs.value.find(item => item.inputCode === code || item.registrationNo === code || item.inputName === code);
      setScanOpen(false);
      setScanCode('');
      if (hit) {
        message.success(`已匹配：${hit.inputName ?? code}`);
        navigate(`/production/inputs/${hit.inputId}`);
        return;
      }
      message.info(`未匹配到「${code}」，请手动建档`);
      navigate('/production/inputs/create');
    };

    /** 解析导入 CSV 文本 */
    const parseImportText = (text: string): Partial<InputInfo>[] => {
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return [];
      const startIndex = lines[0].startsWith('投入品名称') ? 1 : 0;
      return lines.slice(startIndex).map(line => {
        const cells = line.split(',').map(cell => cell.trim());
        const matchedType = INPUT_CATEGORY_OPTIONS.find(option => option.label === (cells[1] ?? ''));
        return {
          inputName: cells[0] ?? '',
          inputType: matchedType?.value ?? 'OTHER',
          registrationNo: cells[2] ?? '',
          manufacturer: cells[3] ?? '',
          spec: cells[4] ?? '',
          unit: cells[5] || 'kg',
          safetyInterval: Number(cells[6]) || undefined,
          stockQty: Number(cells[7]) || 0,
          warnQty: Number(cells[8]) || undefined,
          status: 1
        };
      });
    };

    /** 执行批量导入 */
    const runImport = (payloads: Partial<InputInfo>[]): void => {
      if (payloads.length === 0) {
        message.warning('未解析到有效数据行');
        return;
      }
      setImporting(true);
      Promise.allSettled(payloads.map(payload => createInputInfo(payload))).then(results => {
        const success = results.filter(item => item.status === 'fulfilled').length;
        const failed = results.length - success;
        if (failed === 0) {
          message.success(`导入成功 ${success} 条`);
        } else {
          message.warning(`导入完成：成功 ${success} 条，失败 ${failed} 条`);
        }
        setImportOpen(false);
        void invalidateAll();
      }).finally(() => setImporting(false));
    };

    /** 导入文件读取（阻止自动上传，前端解析后批量提交） */
    const handleImportFile = (file: File): boolean => {
      const reader = new FileReader();
      reader.onload = () => {
        runImport(parseImportText(String(reader.result ?? '')));
      };
      reader.readAsText(file, 'utf-8');
      return false;
    };

    /** 下载导入模板 */
    const downloadTemplate = (): void => {
      downloadCsv('投入品导入模板', ['投入品名称', '投入品类型', '登记证号', '生产厂家', '规格', '单位', '安全间隔期(天)', '库存', '预警阈值'], [['复合肥', '肥料', '农肥(2018)准字1234号', '某某肥业', '50kg/袋', 'kg', 15, 500, 100]]);
    };

    /** 导出投入品档案（使用台账 / 出入库 Tab 各自有导出按钮） */
    const handleExport = (): void => {
      if (filteredInputs.value.length === 0) {
        message.warning('暂无可导出的数据');
        return;
      }
      downloadCsv('投入品档案', ['投入品名称', '投入品类型', '登记证号', '生产厂家', '规格', '库存', '单位', '安全间隔期(天)', '准入校验', '状态'], filteredInputs.value.map(item => [item.inputName ?? '', categoryMeta(item.inputType).label, item.registrationNo ?? '', item.manufacturer ?? '', item.spec ?? '', fmtNumber(item.stockQty), item.unit ?? '', item.safetyInterval ?? '', checkAdmission(item.inputName, item.inputType).label, item.status === 1 ? '启用' : '停用']));
    };

    /** 档案列定义 */
    const archiveColumns = computed<ProColumns<InputInfo>[]>(() => [{
      title: '投入品',
      dataIndex: 'inputName',
      width: 220,
      ellipsis: true,
      render: (_, record) => <span class="production-dense-name-wrap" title={`${record.inputName ?? '-'} (${record.inputCode ?? record.inputId})`}>
          <Typography.Text strong>{record.inputName ?? '-'}</Typography.Text>
          <Typography.Text type="secondary" style={{
          fontSize: 12
        }}>
            {record.inputCode ?? record.inputId}
          </Typography.Text>
        </span>
    }, {
      title: '投入品类型',
      dataIndex: 'inputType',
      width: 110,
      render: (_, record) => {
        const meta = categoryMeta(record.inputType);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '登记证号',
      dataIndex: 'registrationNo',
      width: 170,
      ellipsis: true,
      render: (_, record) => record.registrationNo ?? '-'
    }, {
      title: '生产厂家',
      dataIndex: 'manufacturer',
      width: 160,
      ellipsis: true,
      render: (_, record) => record.manufacturer ?? '-'
    }, {
      title: '规格',
      dataIndex: 'spec',
      width: 110,
      render: (_, record) => record.spec ?? '-'
    }, {
      title: '库存',
      dataIndex: 'stockQty',
      width: 170,
      render: (_, record) => {
        const state = stockStateOf(record);
        const meta = STOCK_STATE_META[state];
        return <Space size={4}>
            <span>
              {fmtNumber(record.stockQty)} {record.unit ?? ''}
            </span>
            {state === 'normal' ? <Tag color={meta.tagColor}>{meta.label}</Tag> : <Tag icon={<WarningOutlined />} color={meta.tagColor}>
                {meta.label}
              </Tag>}
          </Space>;
      }
    }, {
      title: '预警阈值',
      dataIndex: 'warnQty',
      width: 120,
      render: (_, record) => record.warnQty === undefined || record.warnQty === null ? '-' : `${fmtNumber(record.warnQty)} ${record.unit ?? ''}`
    }, {
      title: '最近批次效期',
      dataIndex: 'nearestExpireDate',
      width: 130,
      render: (_, record) => record.nearestExpireDate?.slice(0, 10) ?? '-'
    }, {
      title: '安全间隔期',
      dataIndex: 'safetyInterval',
      width: 110,
      render: (_, record) => record.safetyInterval === undefined || record.safetyInterval === null ? '-' : `${record.safetyInterval} 天`
    }, {
      title: '准入校验',
      key: 'admission',
      width: 120,
      render: (_, record) => {
        const result = checkAdmission(record.inputName, record.inputType);
        return <Tag color={result.tagColor}>
            {result.icon} {result.label}
          </Tag>;
      }
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => <Tag color={record.status === 1 ? 'green' : 'default'}>
          {record.status === 1 ? '启用' : '停用'}
        </Tag>
    }, {
      title: '操作',
      fixed: 'right',
      key: 'option',
      width: 128,
      valueType: 'option',
      render: (_, record) => <ListRowActions>{[<Typography.Link key="stock-in" onClick={() => setStockShortcut(previous => ({
          requestId: (previous?.requestId ?? 0) + 1,
          action: 'in',
          inputId: record.inputId
        }))}>
          入库
        </Typography.Link>, <Typography.Link key="usage" onClick={() => navigate('/production/inputs?tab=ledger&create=1')}>
          使用登记
        </Typography.Link>, <Typography.Link key="detail" onClick={() => navigate(`/production/inputs/${record.inputId}`)}>
          详情
        </Typography.Link>, <Typography.Link key="edit" onClick={() => openEdit(record)}>
          编辑
        </Typography.Link>, <Popconfirm key="delete" title="确认删除该投入品？" description="删除后不可恢复，请谨慎操作。" okText="确认删除" cancelText="取消" onConfirm={() => deleteMutation.mutate(record.inputId)}>
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>]}</ListRowActions>
    }]);
    const loading = computed(() => inputsQuery.isFetching || usagesQuery.isFetching);
    const isError = computed(() => inputsQuery.isError || usagesQuery.isError);
    const rangeLabel = computed(() => RANGE_OPTIONS.find(item => item.value === (filters.value.range ?? 'month'))?.label ?? '本月');
    return () => {
      return <PageContainer class="inputs-page production-list-dense production-member-list" title="农资台账" subTitle={currentFarm.value ? currentFarm.value.farmName : undefined}>
      <Card class="input-tabs-card">
        <Tabs activeKey={tab.value} onChange={key => switchTab(key as MainTab)} items={[{
            key: 'archive',
            label: `投入品档案(${filteredInputs.value.length})`,
            children: <>
                  {/* 库存摘要与出入库快捷弹窗保留，紧凑单行展示 */}
                  {/* 库存统计与作业统一位于工具栏。 */}

                  <Card class="production-dense-filter-card">
                    <ProductionListFilters form={filterForm} onFinish={handleSearch} onReset={handleReset} loading={loading.value}>
                      <Form.Item name="range" label="统计周期">
                        <Select placeholder="请选择周期" options={RANGE_OPTIONS} defaultValue="month" />
                      </Form.Item>
                      <Form.Item name="category" label="投入品类型">
                        <Select allowClear placeholder="全部投入品类型" options={INPUT_CATEGORY_OPTIONS} />
                      </Form.Item>
                      <Form.Item name="plotId" label="地块">
                        <Select allowClear showSearch optionFilterProp="label" placeholder="全部地块" options={plotOptions.value} />
                      </Form.Item>
                      <Form.Item name="compliance" label="合规">
                        <Select allowClear placeholder="全部合规" options={[{
                        value: 'pass',
                        label: '✅ 通过'
                      }, {
                        value: 'warning',
                        label: '⚠️ 预警'
                      }, {
                        value: 'blocked',
                        label: '❌ 拦截'
                      }]} />
                      </Form.Item>
                      <Form.Item name="keyword" label="关键字">
                        <Input allowClear placeholder="投入品名称 / 登记证号" />
                      </Form.Item>
                      <Form.Item label="库存状态" class="production-filter-span-2">
                        <Segmented size="small" value={filters.value.stockState ?? 'all'} onChange={value => {
                        const next = value as StockState | 'all';
                        filterForm.setFieldValue('stockState', next);
                        setFilters(prev => ({
                          ...prev,
                          stockState: next
                        }));
                      }} options={STOCK_STATE_OPTIONS} />
                      </Form.Item>
                    </ProductionListFilters>
                  </Card>

                  {isError.value ? <Empty description={<Space direction="vertical">
                          <Typography.Text type="danger">投入品数据加载失败，请稍后重试</Typography.Text>
                          <Button onClick={() => void invalidateAll()}>重新加载</Button>
                        </Space>} /> : <ProTable memberListToolbar cardProps={false} class="input-record-table" rowKey="inputId" columns={archiveColumns.value} dataSource={pagedInputs.value} loading={loading.value} search={false} headerTitle={false} toolbar={{
                title: <Space size={8} wrap>
                            <ListSummary trigger="click" content={<div class="production-dense-summary" aria-busy={loading.value}>
                    <div class="production-dense-summary-items">
                      {overview.value.map(item => <span class="production-dense-metric" key={item.value}>
                          <span class="production-dense-metric-label">{item.label}({rangeLabel.value})</span>
                          <span class="production-dense-metric-value">
                            {item.qty.toFixed(2)} {item.unit || '-'}
                          </span>
                        </span>)}
                      <Tooltip title={`统计口径 ${rangeStart.value} ~ ${rangeEnd.value}，共 ${complianceSummary.value.total} 条使用记录；拦截 ${complianceSummary.value.blocked} 次、预警 ${complianceSummary.value.warning} 次、休药期地块 ${complianceSummary.value.withdrawalPlots} 个`}>
                        <span class={`production-dense-metric-chip ${complianceSummary.value.blocked > 0 ? 'is-danger' : 'is-success'}`}>
                          合规：{complianceSummary.value.blocked > 0 ? `拦截 ${complianceSummary.value.blocked}` : '全部通过'}
                          {complianceSummary.value.warning > 0 ? ` · 预警 ${complianceSummary.value.warning}` : ''}
                          {complianceSummary.value.withdrawalPlots > 0 ? ` · 休药期 ${complianceSummary.value.withdrawalPlots} 块` : ''}
                        </span>
                      </Tooltip>
                    </div>
                  </div>}><Button>使用统计</Button></ListSummary>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/inputs/create')}>
                              手动添加
                            </Button>
                            <Button icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>
                              扫码录入
                            </Button>
                            <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
                              导入
                            </Button>
                            <Button icon={<DownloadOutlined />} onClick={handleExport}>
                              导出
                            </Button>
                          <InputStock part="overview" showTable={false} shortcut={stockShortcut.value} /></Space>
              }} rowSelection={{}} tableAlertRender={false}
              // 库存、效期和作业并入同一张表，窄屏只在这一张表内横向滚动
              scroll={{
                x: 1750
              }} options={{
                reload: () => void invalidateAll(),
                density: true,
                setting: true
              }} pagination={{
                current: pageNum.value,
                pageSize: pageSize.value,
                total: filteredInputs.value.length,
                showSizeChanger: true,
                showTotal: total => `共 ${total} 条`,
                onChange: (nextPage, nextSize) => {
                  setPageNum(nextPage);
                  setPageSize(nextSize);
                }
              }} />}
                </>
          }, {
            key: 'ledger',
            label: '使用台账',
            children: <InputUsages />
          }]} />
      </Card>

      <Modal class="production-form-dialog" title="编辑投入品" open={Boolean(editTarget.value)} okText="保存" cancelText="取消" confirmLoading={saveMutation.isPending} onOk={submitEdit} onCancel={() => {
          setEditTarget(null);
          editForm.resetFields();
        }} destroyOnClose>
        <Form form={editForm} layout="vertical" style={{
            marginTop: 16
          }}>
          <Form.Item label="投入品名称" name="inputName" rules={[{
              required: true
            }]}>
            <Input placeholder="请输入投入品名称" />
          </Form.Item>
          <Form.Item label="投入品类型" name="inputType">
            <Select options={INPUT_CATEGORY_OPTIONS} placeholder="请选择投入品类型" />
          </Form.Item>
          <Form.Item label="登记证号" name="registrationNo">
            <Input placeholder="如 PD20180001 / 农肥(2018)准字1234号" />
          </Form.Item>
          <Form.Item label="生产厂家" name="manufacturer">
            <Input placeholder="请输入生产厂家" />
          </Form.Item>
          <Form.Item label="规格" name="spec">
            <Input placeholder="如 50kg/袋" />
          </Form.Item>
          <Form.Item label="计量单位" name="unit">
            <Select options={[{
                value: 'kg',
                label: 'kg'
              }, {
                value: 'g',
                label: 'g'
              }, {
                value: 'L',
                label: 'L'
              }, {
                value: 'mL',
                label: 'mL'
              }, {
                value: '株',
                label: '株'
              }, {
                value: '袋',
                label: '袋'
              }]} placeholder="请选择单位" />
          </Form.Item>
          <Form.Item label="安全间隔期（天）" name="safetyInterval">
            <InputNumber min={0} style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item label="当前库存" name="stockQty">
            <InputNumber min={0} style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item label="库存预警阈值" name="warnQty">
            <InputNumber min={0} style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group options={[{
                value: 1,
                label: '启用'
              }, {
                value: 0,
                label: '停用'
              }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal class="production-form-dialog" title="📷 扫码录入" open={scanOpen.value} okText="匹配并继续" cancelText="取消" onOk={handleScan} onCancel={() => {
          setScanOpen(false);
          setScanCode('');
        }} destroyOnClose>
        <Space direction="vertical" size={12} style={{
            width: '100%',
            marginTop: 12
          }}>
          <Typography.Text type="secondary">
            扫描或手动输入投入品条码 / 登记证号，系统自动匹配档案；未匹配时引导手动建档。
          </Typography.Text>
          <Input value={scanCode.value} onChange={event => setScanCode(event.target.value ?? '')} placeholder="扫码或手动输入条码" onPressEnter={handleScan} />
        </Space>
      </Modal>

      <Modal class="production-form-dialog" title="批量导入投入品" open={importOpen.value} okText="关闭" cancelText="取消" confirmLoading={importing.value} onOk={() => setImportOpen(false)} onCancel={() => setImportOpen(false)} destroyOnClose>
        <Space direction="vertical" size={12} style={{
            width: '100%',
            marginTop: 12
          }}>
          <Typography.Text type="secondary">
            支持 CSV 文件，列顺序：投入品名称,投入品类型,登记证号,生产厂家,规格,单位,安全间隔期,库存,预警阈值。
          </Typography.Text>
          <Space>
            <Button onClick={downloadTemplate}>下载模板</Button>
            <Upload accept=".csv,.txt" showUploadList={false} beforeUpload={file => handleImportFile(file as unknown as File)}>
              <Button type="primary" loading={importing.value}>
                选择文件导入
              </Button>
            </Upload>
          </Space>
        </Space>
      </Modal>
    </PageContainer>;
    };
  }
});
export default InputList;
