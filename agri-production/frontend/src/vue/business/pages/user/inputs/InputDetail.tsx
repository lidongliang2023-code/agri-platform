import { defineComponent, shallowRef, computed, watch, type VNodeChild } from 'vue';
import '@/components/ProductionDetailCompact.css';
import ProTable from '@/vue/ProductionRequestTable';
import '@/pages/user/inputs/inputs.css';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import type { ProColumns } from '@/vue/pro';
import { Alert, Button, Empty, List, Modal, Progress, Skeleton, Space, Tag, Typography, message } from '@/vue/ui';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue';
import { listPlots } from '@/api/plots';
import { getInputInfo, pageStockFlows, pageUsages } from '@/api/inputs';
import type { InputStockFlow } from '@/api/inputs';
import { listChainRecords, submitChain } from '@/api/blockchain';
import type { BlockchainBizRecord, InputUsageRecord } from '@/types';
import useFarmStore from '@/vue/farmStore';
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
import { categoryMeta, checkCompliance, fmtDate, fmtNumber, flowTypeMeta, summarizeCompliance } from '@/pages/user/inputs/shared';
import type { ComplianceItem } from '@/pages/user/inputs/shared';

type ChainState = 'none' | 'chaining' | 'chained' | 'failed';

const CHAIN_STATE_META: Record<ChainState, { label: string; tone: string }> = {
  none: { label: '无存证记录', tone: 'gray' },
  chaining: { label: '已提交待出块', tone: 'blue' },
  chained: { label: '已上链（模拟链）', tone: 'green' },
  failed: { label: '存证失败', tone: 'red' },
};

const LEVEL_ICON: Record<string, VNodeChild> = {
  pass: <CheckCircleOutlined style={{ color: '#2d8f4e', fontSize: 18 }} />,
  warning: <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
  blocked: <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />,
};

const InputDetail = defineComponent({
  name: 'InputDetail',
  props: {},
  setup() {
    const _params = useParams<{ inputId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const farmId = computed(() => currentFarm.value?.farmId);
    const activeTab = shallowRef<string>('overview');
    const verifyOpen = shallowRef<boolean>(false);

    watch(() => _params.inputId, () => {
      activeTab.value = 'overview';
    });

    const detailQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'detail', _params.inputId ?? ''],
      enabled: Boolean(_params.inputId ?? ''),
      queryFn: () => getInputInfo(_params.inputId ?? ''),
    }));

    const usagesQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'usages', _params.inputId ?? ''],
      enabled: Boolean(_params.inputId ?? ''),
      queryFn: () => pageUsages({ inputId: _params.inputId ?? '', pageNum: 1, pageSize: 200 }),
    }));

    const flowsQuery = useQuery(() => ({
      queryKey: ['production-inputs', 'stock-flows', _params.inputId ?? ''],
      enabled: Boolean(_params.inputId ?? ''),
      queryFn: () => pageStockFlows(_params.inputId ?? '', { pageNum: 1, pageSize: 200 }),
    }));

    const chainQuery = useQuery(() => ({
      queryKey: ['blockchain', 'records', 'input-usage'],
      queryFn: () => listChainRecords({ bizType: 'INPUT', pageNum: 1, pageSize: 200 }),
    }));

    const plotsQuery = useQuery(() => ({
      queryKey: ['plot-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listPlots({ farmId: farmId.value, pageNum: 1, pageSize: 200 }),
    }));

    const chainMutation = useMutation(() => ({
      mutationFn: (bizId: string) =>
        submitChain({ bizId, bizType: 'INPUT', bizSummary: '投入品使用记录存证' }),
      onSuccess: record => {
        message.success(
          record?.status === 'SUCCESS'
            ? `已存证（模拟链 SUCCESS${record.txHash ? `，交易哈希 ${record.txHash}` : ''}）`
            : `已提交存证，当前状态 ${record?.status ?? '未知'}`,
        );
        void queryClient.invalidateQueries({ queryKey: ['blockchain'] });
      },
      onError: (err: Error) => {
        message.error(`存证失败，未写入任何记录：${err.message}`);
      },
    }));

    const item = computed(() => detailQuery.data);
    const inputName = computed(() => item.value?.inputName ?? '');
    const usages = computed<InputUsageRecord[]>(() =>
      [...(usagesQuery.data?.list ?? [])].sort((a, b) => String(b.usedAt ?? '').localeCompare(String(a.usedAt ?? ''))),
    );
    const flows = computed<InputStockFlow[]>(() =>
      [...(flowsQuery.data?.list ?? [])].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
    );
    const plotMap = computed<Map<string, string>>(() => {
      const map = new Map<string, string>();
      (plotsQuery.data?.list ?? []).forEach(plot => map.set(plot.plotId, plot.plotName));
      return map;
    });
    const latestUsage = computed(() => usages.value[0]);
    const cumulativeDosage = computed(() => usages.value.reduce((sum, usage) => sum + (usage.dosage ?? 0), 0));

    const complianceItems = computed<ComplianceItem[]>(() =>
      checkCompliance({
        inputName: item.value?.inputName,
        inputType: item.value?.inputType,
        safetyInterval: latestUsage.value?.safetyIntervalDays ?? item.value?.safetyInterval,
        dosage: latestUsage.value?.dosage,
        unit: latestUsage.value?.unit,
        lastUsedAt: latestUsage.value?.usedAt,
        cumulativeDosage: cumulativeDosage.value,
      }),
    );
    const complianceLevel = computed(() => summarizeCompliance(complianceItems.value));

    const chainRecord = computed<BlockchainBizRecord | undefined>(() =>
      (chainQuery.data?.list ?? []).find(
        record => latestUsage.value && String(record.bizNo ?? record.bizId ?? '') === String(latestUsage.value.usageId),
      ),
    );

    const chainState = computed<ChainState>(() =>
      !latestUsage.value
        ? 'none'
        : chainRecord.value?.status === 'SUCCESS'
          ? 'chained'
          : chainRecord.value?.status === 'PENDING'
            ? 'chaining'
            : chainRecord.value?.status === 'FAILED'
              ? 'failed'
              : 'none',
    );

    const certNo = computed(() => chainRecord.value?.recordNo ?? '—（尚无存证记录）');
    const chainedAt = computed(() => chainRecord.value?.anchorAt ?? chainRecord.value?.chainedAt ?? chainRecord.value?.createdAt ?? '');

    const stockPercent = computed(() => {
      const stock = item.value?.stockQty ?? 0;
      const full = (item.value?.warnQty ?? 0) * 3;
      if (full <= 0) return stock > 0 ? 100 : 0;
      return Math.min(100, Math.round((stock / full) * 100));
    });

    const stockWarning = computed(
      () => item.value?.warnQty !== undefined && item.value?.warnQty !== null && (item.value?.stockQty ?? 0) <= item.value.warnQty,
    );

    const usageColumns = computed<ProColumns<InputUsageRecord>[]>(() => [
      { title: '使用日期', key: 'usedAt', width: 170, render: (_, record) => <span class="detail-info-mono">{fmtDate(record.usedAt, 'YYYY-MM-DD HH:mm')}</span> },
      { title: '地块', key: 'plotName', width: 120, render: (_, record) => (record.plotId ? plotMap.value.get(record.plotId) : undefined) || record.plotId || '—' },
      { title: '关联任务', key: 'taskId', width: 150, render: (_, record) => <span class="detail-info-mono">{record.taskId ?? '—'}</span> },
      { title: '用量', key: 'dosage', width: 120, render: (_, record) => <span class="detail-info-mono">{`${fmtNumber(record.dosage)} ${record.unit ?? ''}`}</span> },
      { title: '施用方式', key: 'method', width: 100, render: (_, record) => record.method ?? '—' },
      { title: '操作人', key: 'operatorId', width: 110, render: (_, record) => record.operatorId ?? '—' },
      {
        title: '安全间隔期',
        key: 'safetyIntervalDays',
        width: 110,
        render: (_, record) => (record.safetyIntervalDays === undefined || record.safetyIntervalDays === null ? '—' : `${record.safetyIntervalDays} 天`),
      },
    ]);

    const flowColumns = computed<ProColumns<InputStockFlow>[]>(() => [
      { title: '时间', key: 'createdAt', width: 170, render: (_, record) => <span class="detail-info-mono">{fmtDate(record.createdAt, 'YYYY-MM-DD HH:mm')}</span> },
      {
        title: '流水类型',
        key: 'flowType',
        width: 100,
        render: (_, record) => {
          const meta = flowTypeMeta(record.flowType);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '数量',
        key: 'qty',
        width: 130,
        render: (_, record) => {
          const meta = flowTypeMeta(record.flowType);
          const qty = record.qty ?? 0;
          return (
            <Typography.Text class="detail-info-mono" type={meta.direction === 1 ? 'success' : 'danger'}>
              {meta.direction === 1 ? '+' : '-'}
              {fmtNumber(Math.abs(qty))} {item.value?.unit ?? ''}
            </Typography.Text>
          );
        },
      },
      { title: '批次号', key: 'batchNo', width: 140, render: (_, record) => <span class="detail-info-mono">{record.batchNo ?? '—'}</span> },
      { title: '有效期至', key: 'expireDate', width: 120, render: (_, record) => <span class="detail-info-mono">{fmtDate(record.expireDate)}</span> },
      { title: '操作人', key: 'operatorId', width: 110, render: (_, record) => record.operatorId ?? '—' },
      { title: '关联任务', key: 'relatedTaskId', width: 150, render: (_, record) => <span class="detail-info-mono">{record.relatedTaskId ?? '—'}</span> },
      { title: '备注', key: 'remark', render: (_, record) => record.remark ?? '—' },
    ]);

    const verifyChecks = computed(() => [
      {
        key: 'record',
        label: '有无存证记录',
        passed: Boolean(chainRecord.value),
        detail: chainRecord.value
          ? `存证编号 ${chainRecord.value.recordNo ?? '—'}，业务键 ${chainRecord.value.bizNo ?? chainRecord.value.bizId ?? '—'}`
          : '存证表里没有这条使用记录的存证',
      },
      {
        key: 'status',
        label: '存证状态',
        passed: chainRecord.value?.status === 'SUCCESS',
        detail: chainRecord.value
          ? `${chainRecord.value.status ?? '未知'}${chainRecord.value.failReason ? `（原因：${chainRecord.value.failReason}）` : ''}`
          : '无记录，无状态',
      },
      {
        key: 'anchor',
        label: '是否已出块',
        passed: Boolean(chainRecord.value?.txHash),
        detail: chainRecord.value?.txHash
          ? `交易哈希 ${chainRecord.value.txHash}，区块高度 ${chainRecord.value.blockHeight ?? '—'}`
          : '尚未出块，没有交易哈希与区块高度',
      },
      {
        key: 'payload',
        label: '内容指纹是否留档',
        passed: Boolean(chainRecord.value?.payloadHash ?? chainRecord.value?.dataHash),
        detail: chainRecord.value
          ? '存证记录已留存 data_hash（内容指纹）。当前为模拟链，未做公链比对'
          : '无存证记录，没有可比对的内容指纹',
      },
      {
        key: 'chainType',
        label: '链类型',
        passed: false,
        detail: '本部署为 SIMULATED（模拟链），不含公链签名与确认数校验',
      },
    ]);

    return () => {
      if (!(_params.inputId ?? '')) {
        return (
          <ProductionDetailLayout class="inputs-page production-detail-compact" title="投入品详情" hasAside={false} onBack={() => navigate('/production/inputs')}>
            <DetailSection>
              <Empty description="缺少投入品 ID" />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (detailQuery.isLoading) {
        return (
          <ProductionDetailLayout class="inputs-page production-detail-compact" title="投入品详情" hasAside={false} onBack={() => navigate('/production/inputs')}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 8 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (detailQuery.isError || !item.value) {
        return (
          <ProductionDetailLayout class="inputs-page production-detail-compact" title="投入品详情" hasAside={false} onBack={() => navigate('/production/inputs')}>
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">投入品详情加载失败，请稍后重试</Typography.Text>
                    <Button
                      onClick={() =>
                        void queryClient.invalidateQueries({ queryKey: ['production-inputs', 'detail', _params.inputId ?? ''] })
                      }
                    >
                      重新加载
                    </Button>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const currentItem = item.value;
      const complianceMeta =
        complianceLevel.value === 'pass'
          ? { label: '合规通过', tone: 'green' }
          : complianceLevel.value === 'warning'
            ? { label: '合规预警', tone: 'orange' }
            : { label: '存在违规', tone: 'red' };

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '投入品详情' },
        { key: 'compliance', label: '合规校验', count: complianceItems.value.length },
        { key: 'usages', label: '使用记录', count: usages.value.length },
        { key: 'flows', label: '出入库流水', count: flows.value.length },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'registered',
          title: '农资建档入库',
          time: fmtDate(currentItem.createdAt, 'YYYY-MM-DD HH:mm'),
          description: `当前库存 ${fmtNumber(currentItem.stockQty)} ${currentItem.unit ?? ''}`,
          state: 'done',
        },
        {
          key: 'used',
          title: latestUsage.value ? '已登记田间施用' : '待登记施用',
          time: latestUsage.value ? fmtDate(latestUsage.value.usedAt, 'YYYY-MM-DD HH:mm') : undefined,
          description: latestUsage.value
            ? `累计 ${usages.value.length} 笔，总用量 ${fmtNumber(cumulativeDosage.value)} ${latestUsage.value.unit ?? ''}`
            : '登记使用后自动触发合规核查',
          state: latestUsage.value ? 'done' : 'current',
        },
        {
          key: 'compliance',
          title: `四项合规核查 · ${complianceMeta.label}`,
          description: complianceLevel.value === 'pass' ? '禁用农药、用量、休药期均通过' : '请查看合规校验明细',
          state: complianceLevel.value === 'pass' ? 'done' : complianceLevel.value === 'warning' ? 'current' : 'error',
        },
        {
          key: 'chain',
          title: `链上存证 · ${CHAIN_STATE_META[chainState.value].label}`,
          time: chainedAt.value ? fmtDate(chainedAt.value, 'YYYY-MM-DD HH:mm') : undefined,
          description: chainRecord.value?.recordNo ? `存证号 ${chainRecord.value.recordNo}` : '登记使用后可点击右上角上链',
          state:
            chainState.value === 'chained'
              ? 'done'
              : chainState.value === 'chaining'
                ? 'current'
                : chainState.value === 'failed'
                  ? 'error'
                  : 'pending',
        },
      ];

      const latestBatchNo = flows.value.find(flow => flow.batchNo)?.batchNo;
      const latestExpire = flows.value.find(flow => flow.expireDate)?.expireDate;

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'cert',
          label: '存证编号',
          code: chainRecord.value?.recordNo || undefined,
          emptyText: '尚无存证记录',
          onClick: chainRecord.value?.recordId ? () => navigate(`/production/blockchain/records/${chainRecord.value?.recordId}`) : () => { verifyOpen.value = true; },
        },
        {
          key: 'usage',
          label: '最新使用单号',
          code: latestUsage.value?.usageId || undefined,
          emptyText: '暂无使用记录',
          onClick: latestUsage.value ? () => { activeTab.value = 'usages'; } : undefined,
        },
        {
          key: 'batch',
          label: '最近入库批次',
          code: latestBatchNo || undefined,
          emptyText: '暂无批次',
          onClick: latestBatchNo ? () => { activeTab.value = 'flows'; } : undefined,
        },
        {
          key: 'expire',
          label: '最近批次效期',
          text: latestExpire ? fmtDate(latestExpire) : undefined,
          emptyText: '未登记',
          mono: true,
        },
        {
          key: 'trace',
          label: '全链路溯源',
          text: '查看溯源链路',
          mono: false,
          onClick: () => navigate('/production/trace/full-chain'),
        },
      ];

      return (
        <ProductionDetailLayout
          class="inputs-page production-detail-compact"
          code={currentItem.inputCode ?? currentItem.inputId}
          title={inputName.value || '投入品'}
          status={currentItem.status === 1 ? { label: '启用', tone: 'green' } : { label: '停用', tone: 'gray' }}
          extraStatuses={[complianceMeta]}
          meta={[
            { label: '投入品类型', value: categoryMeta(currentItem.inputType).label },
            { label: '生产厂家', value: currentItem.manufacturer ?? '—' },
            { label: '更新时间', value: fmtDate(currentItem.updatedAt, 'YYYY-MM-DD HH:mm') },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回农资管理"
          onBack={() => navigate('/production/inputs')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          banner={
            stockWarning.value ? (
              <Alert
                type="warning"
                showIcon
                message={`当前库存 ${fmtNumber(currentItem.stockQty)} ${currentItem.unit ?? ''} 已达预警阈值（${fmtNumber(currentItem.warnQty)} ${currentItem.unit ?? ''}），请及时补货`}
              />
            ) : undefined
          }
          actions={
            /* 次要 → 主要 */
            <>
              <Button onClick={() => { verifyOpen.value = true; }}>存证核验</Button>
              <Button icon={<LinkOutlined />} onClick={() => navigate('/production/trace/full-chain')}>
                查看溯源链路
              </Button>
              <Button
                type="primary"
                icon={<SafetyCertificateOutlined />}
                disabled={!latestUsage.value}
                loading={chainMutation.isPending}
                onClick={() => latestUsage.value && chainMutation.mutate(latestUsage.value.usageId)}
              >
                立即上链
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="存证与合规进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="库存水位">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text type="secondary">当前可用库存</Typography.Text>
                    <Typography.Text strong class="detail-info-mono">
                      {fmtNumber(currentItem.stockQty)} {currentItem.unit ?? ''}
                    </Typography.Text>
                  </Space>
                  <Progress
                    percent={stockPercent.value}
                    size="small"
                    strokeColor={stockWarning.value ? '#ff4d4f' : '#2d8f4e'}
                    status={stockWarning.value ? 'exception' : 'normal'}
                    showInfo={false}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    预警阈值：{currentItem.warnQty == null ? '未设置' : `${fmtNumber(currentItem.warnQty)} ${currentItem.unit ?? ''}`}
                  </Typography.Text>
                </Space>
              </DetailSection>
              <DetailSection title="关联单据与存证">
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
                    { key: 'code', label: '投入品编号', value: currentItem.inputCode ?? currentItem.inputId ?? '—', mono: true },
                    { key: 'name', label: '投入品名称', value: currentItem.inputName ?? '—' },
                    { key: 'type', label: '投入品类型', value: categoryMeta(currentItem.inputType).label },
                    { key: 'regNo', label: '登记证号', value: currentItem.registrationNo ?? '—', mono: true },
                    { key: 'manufacturer', label: '生产厂家', value: currentItem.manufacturer ?? '—' },
                    { key: 'spec', label: '包装规格', value: currentItem.spec ?? '—' },
                    { key: 'unit', label: '计量单位', value: currentItem.unit ?? '—' },
                    {
                      key: 'safety',
                      label: '安全间隔期',
                      value: currentItem.safetyInterval == null ? '—' : `${currentItem.safetyInterval} 天`,
                      mono: true,
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection title="库存与档案时间">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'stock', label: '当前库存', value: `${fmtNumber(currentItem.stockQty)} ${currentItem.unit ?? ''}`, mono: true },
                    {
                      key: 'warn',
                      label: '库存预警阈值',
                      value: currentItem.warnQty == null ? '—' : `${fmtNumber(currentItem.warnQty)} ${currentItem.unit ?? ''}`,
                      mono: true,
                    },
                    { key: 'cumulative', label: '本季累计用量', value: `${fmtNumber(cumulativeDosage.value)} ${latestUsage.value?.unit ?? currentItem.unit ?? ''}`, mono: true },
                    {
                      key: 'latest',
                      label: '最近使用',
                      value: latestUsage.value ? `${fmtDate(latestUsage.value.usedAt)} · ${fmtNumber(latestUsage.value.dosage)} ${latestUsage.value.unit ?? ''}` : '暂无使用记录',
                    },
                    { key: 'createdAt', label: '创建时间', value: fmtDate(currentItem.createdAt, 'YYYY-MM-DD HH:mm'), mono: true },
                    { key: 'updatedAt', label: '更新时间', value: fmtDate(currentItem.updatedAt, 'YYYY-MM-DD HH:mm'), mono: true },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title={`使用记录预览`}
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该投入品暂无使用记录" />
                ) : (
                  <ProTable
                    cardProps={false}
                    class="input-record-table"
                    rowKey="usageId"
                    columns={usageColumns.value}
                    dataSource={usages.value.slice(0, 5)}
                    loading={usagesQuery.isFetching}
                    search={false}
                    scroll={{ x: 860 }}
                    options={false}
                    pagination={false}
                  />
                )}
              </DetailSection>
            </>
          )}

          {activeTab.value === 'compliance' && (
            <DetailSection
              title={`合规校验结果（${complianceItems.value.length} 项）`}
              extra={<Tag color={complianceMeta.tone}>{complianceMeta.label}</Tag>}
            >
              <List
                class="input-check-list"
                dataSource={complianceItems.value}
                rowKey="key"
                renderItem={check => (
                  <List.Item
                    extra={
                      <Tag color={check.level === 'pass' ? 'green' : check.level === 'warning' ? 'orange' : 'red'}>
                        {check.result}
                      </Tag>
                    }
                  >
                    <List.Item.Meta avatar={LEVEL_ICON[check.level]} title={check.label} description={check.detail} />
                  </List.Item>
                )}
              />
            </DetailSection>
          )}

          {activeTab.value === 'usages' && (
            <DetailSection title={`使用记录（${usages.value.length}）`} flush={usages.value.length > 0}>
              <ProTable
                cardProps={false}
                class="input-record-table"
                rowKey="usageId"
                columns={usageColumns.value}
                dataSource={usages.value}
                loading={usagesQuery.isFetching}
                search={false}
                scroll={{ x: 900 }}
                options={false}
                pagination={{ pageSize: 20, showTotal: total => `共 ${total} 条` }}
              />
            </DetailSection>
          )}

          {activeTab.value === 'flows' && (
            <DetailSection title={`出入库流水（${flows.value.length}）`} flush={flows.value.length > 0}>
              <ProTable
                cardProps={false}
                class="input-record-table"
                rowKey="flowId"
                columns={flowColumns.value}
                dataSource={flows.value}
                loading={flowsQuery.isFetching}
                search={false}
                scroll={{ x: 1120 }}
                options={false}
                pagination={{ pageSize: 20, showTotal: total => `共 ${total} 条` }}
              />
            </DetailSection>
          )}

          <Modal
            class="production-form-dialog"
            title="存证核验明细"
            open={verifyOpen.value}
            width={640}
            okText="关闭"
            cancelText="取消"
            onOk={() => { verifyOpen.value = false; }}
            onCancel={() => { verifyOpen.value = false; }}
            destroyOnClose
          >
            <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
              <Alert
                type={chainRecord.value ? 'success' : 'warning'}
                showIcon
                message={chainRecord.value ? `存证编号 ${certNo.value} 已留档` : '该使用记录尚未上链，请先执行「立即上链」'}
                description={chainRecord.value ? '以下展示本地模拟链存证字段核对结果' : '未查询到链上记录，暂无可核对字段'}
              />
              <List
                class="input-check-list"
                dataSource={verifyChecks.value}
                rowKey="key"
                renderItem={check => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        check.passed ? (
                          <CheckCircleOutlined style={{ color: '#2d8f4e' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
                        )
                      }
                      title={check.label}
                      description={check.detail}
                    />
                  </List.Item>
                )}
              />
            </Space>
          </Modal>
        </ProductionDetailLayout>
      );
    };
  },
});

export default InputDetail;
