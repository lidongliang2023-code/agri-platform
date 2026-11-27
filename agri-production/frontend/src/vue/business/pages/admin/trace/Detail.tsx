import { defineComponent, shallowRef, computed, watch } from 'vue';
import '@/components/ProductionDetailCompact.css';
import '@/pages/admin/quality/QualityCompact.css';
import { Alert, Button, Empty, Modal, Skeleton, Tag, Timeline, Typography, message } from '@/vue/ui';
import { ReloadOutlined, StopOutlined } from '@ant-design/icons-vue';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { useNavigate, useParams } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
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
import ListRowActions from '@/vue/business/components/ListRowActions';
import { fetchAdminTraceChain, recallAdminTraceBatch, type AdminInspectionRow } from '@/api/admin/trace';
import { Table, codeName, resultName, InspectionDetail } from '../quality/QualityShared';

function traceStatusTone(status?: string): string {
  const key = (status || '').toLowerCase();
  if (key === 'active' || key === 'scanned') return 'green';
  if (key === 'revoked') return 'red';
  if (key === 'expired') return 'orange';
  return 'gray';
}

const Detail = defineComponent({
  name: 'Detail',
  props: {},
  setup() {
    const _params = useParams<{ code: string }>();
    const nav = useNavigate();
    const queryClient = useQueryClient();
    const activeTab = shallowRef<string>('overview');
    const activeInspectionId = shallowRef<string>();

    watch(() => _params.code, () => {
      activeTab.value = 'overview';
      activeInspectionId.value = undefined;
    });

    const query = useQuery(() => ({
      queryKey: ['admin', 'trace', 'chain', _params.code],
      queryFn: () => fetchAdminTraceChain(String(_params.code)),
      enabled: !!_params.code,
      retry: false,
    }));

    const recallMutation = useMutation(() => ({
      mutationFn: (batchId: string) => recallAdminTraceBatch(batchId),
      onSuccess: () => {
        message.success('已完成该批次一键召回，关联码段已作废并冻结批次');
        void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'chain', _params.code] });
        void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'codes'] });
      },
      onError: (err: Error) => {
        message.error(err.message || '召回失败，请稍后重试');
      },
    }));

    const d = computed(() => query.data);
    const c = computed(() => d.value?.traceCode);
    const b = computed(() => d.value?.batch);
    const inspections = computed(() => d.value?.inspections ?? []);
    const nodes = computed(() => d.value?.nodes ?? []);

    const cols = computed<ProColumns<AdminInspectionRow>[]>(() => [
      {
        title: '检测单号',
        dataIndex: 'inspectionNo',
        width: 210,
        render: (_, r) => (
          <Button type="link" class="detail-info-mono" onClick={() => { activeInspectionId.value = r.inspectionId; }}>
            {r.inspectionNo || r.inspectionId}
          </Button>
        ),
      },
      {
        title: '检测机构',
        dataIndex: 'labName',
        width: 200,
      },
      {
        title: '抽样时间',
        dataIndex: 'sampleAt',
        width: 180,
        render: (_, r) => <span class="detail-info-mono">{r.sampleAt || '—'}</span>,
      },
      {
        title: '结论',
        width: 110,
        render: (_, r) => (
          <Tag color={r.result === 'FAIL' ? 'red' : r.result === 'PASS' ? 'green' : 'default'}>
            {resultName(r.result)}
          </Tag>
        ),
      },
      {
        title: '操作',
        valueType: 'option',
        width: 120,
        render: (_, r) => (
          <ListRowActions
            items={[
              <Button key="detail" type="link" size="small" onClick={() => { activeInspectionId.value = r.inspectionId; }}>
                报告详情
              </Button>,
            ]}
          />
        ),
      },
    ]);

    const handleRecall = (batchId: string, batchNo?: string) => {
      Modal.confirm({
        title: '确认对该批次执行一键召回？',
        content: `召回后将冻结采收批次「${batchNo || batchId}」并作废关联溯源码段，此操作不可撤销。`,
        okText: '确认召回',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => recallMutation.mutateAsync(batchId),
      });
    };

    return () => {
      const codeStr = String(_params.code ?? '');

      if (query.isLoading) {
        return (
          <ProductionDetailLayout
            class="production-detail-compact quality-detail"
            code={codeStr || undefined}
            title="溯源监管详情"
            hasAside={false}
            backLabel="返回溯源码管理"
            onBack={() => nav('/admin/production/trace/codes')}
          >
            <DetailSection>
              <Skeleton active paragraph={{ rows: 8 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (query.isError) {
        return (
          <ProductionDetailLayout
            class="production-detail-compact quality-detail"
            code={codeStr || undefined}
            title="溯源监管详情"
            hasAside={false}
            backLabel="返回溯源码管理"
            onBack={() => nav('/admin/production/trace/codes')}
          >
            <DetailSection>
              <Alert
                type="error"
                showIcon
                message="溯源链路数据加载失败"
                description={query.error instanceof Error ? query.error.message : '请刷新重试'}
                action={<Button size="small" onClick={() => void query.refetch()}>重试</Button>}
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (!d.value || !d.value.found || !c.value) {
        return (
          <ProductionDetailLayout
            class="production-detail-compact quality-detail"
            code={codeStr || undefined}
            title="溯源监管详情"
            hasAside={false}
            backLabel="返回溯源码管理"
            onBack={() => nav('/admin/production/trace/codes')}
          >
            <DetailSection>
              <Empty description="未找到该溯源码" />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const codeProfile = c.value;
      const batchInfo = b.value;
      const isFrozen = Number(batchInfo?.status) === 4;
      const isRevoked = String(codeProfile.status || '').toLowerCase() === 'revoked';
      const failedCount = inspections.value.filter(item => item.result === 'FAIL').length;
      const passCount = inspections.value.filter(item => item.result === 'PASS').length;
      const onChainNodes = nodes.value.filter(item => item.onChain).length;
      const canRecall = Boolean(batchInfo?.batchId) && !isFrozen && !isRevoked;

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '溯源详情' },
        { key: 'inspections', label: '检测记录', count: inspections.value.length },
        { key: 'chain', label: '生产链路', count: nodes.value.length },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'generate',
          title: '溯源码已生成',
          time: codeProfile.createdAt ?? undefined,
          description: codeProfile.batchNo ? `绑定批次 ${codeProfile.batchNo}` : '暂未绑定批次',
          state: 'done',
        },
        {
          key: 'activate',
          title: isRevoked
            ? '码段已作废'
            : String(codeProfile.status || '').toLowerCase() === 'scanned'
              ? '溯源码已扫码'
              : codeProfile.activateTime || String(codeProfile.status || '').toLowerCase() === 'active'
                ? '溯源码已激活'
                : '等待激活',
          time: codeProfile.activateTime || codeProfile.firstQueryTime || undefined,
          description: isRevoked
            ? '已作废停用'
            : codeProfile.scanCount && Number(codeProfile.scanCount) > 0
              ? `累计扫码 ${codeProfile.scanCount} 次`
              : '尚未产生消费者扫码',
          state: isRevoked
            ? 'error'
            : codeProfile.activateTime || ['active', 'scanned'].includes(String(codeProfile.status || '').toLowerCase())
              ? 'done'
              : 'current',
        },
        {
          key: 'inspection',
          title: failedCount > 0 ? `存在 ${failedCount} 份不合格检测` : passCount > 0 ? `${passCount} 份检测合格` : '暂无检测结论',
          description: inspections.value.length > 0 ? `共关联 ${inspections.value.length} 份检测报告` : '未查询到关联检测单',
          state: failedCount > 0 ? 'error' : passCount > 0 ? 'done' : 'pending',
        },
        {
          key: 'chain',
          title: codeProfile.onChain ? '链上存证已确认' : '等待链上存证确认',
          description: nodes.value.length > 0 ? `生产节点 ${onChainNodes} / ${nodes.value.length} 已上链` : '暂无关联生产节点',
          state: codeProfile.onChain ? 'done' : nodes.value.length > 0 ? 'current' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'batch',
          label: '关联采收批次',
          code: batchInfo?.batchNo || codeProfile.batchNo || undefined,
          emptyText: '未关联批次',
          badge: batchInfo ? (isFrozen ? '已冻结' : '正常') : undefined,
          badgeTone: isFrozen ? 'red' : 'green',
          onClick: batchInfo?.batchNo
            ? () => nav(`/admin/production/quality/inspections?batchNo=${encodeURIComponent(batchInfo.batchNo!)}`)
            : undefined,
        },
        {
          key: 'inspections',
          label: '批次检测报告',
          text: inspections.value.length > 0 ? `${inspections.value.length} 份检测记录` : undefined,
          emptyText: '暂无检测报告',
          mono: false,
          badge: failedCount > 0 ? `${failedCount} 不合格` : passCount > 0 ? '合格' : undefined,
          badgeTone: failedCount > 0 ? 'red' : passCount > 0 ? 'green' : undefined,
          onClick: inspections.value.length > 0 ? () => { activeTab.value = 'inspections'; } : undefined,
        },
        {
          key: 'nodes',
          label: '生产溯源节点',
          text: nodes.value.length > 0 ? `${nodes.value.length} 个事实节点` : undefined,
          emptyText: '暂无关联节点',
          mono: false,
          onClick: nodes.value.length > 0 ? () => { activeTab.value = 'chain'; } : undefined,
        },
        {
          key: 'txHash',
          label: '链上存证凭证',
          code: codeProfile.txHash ? `${codeProfile.txHash.slice(0, 12)}…` : undefined,
          text: !codeProfile.txHash && codeProfile.onChain ? '已上链确认' : undefined,
          emptyText: '未确认上链',
          mono: Boolean(codeProfile.txHash),
          badge: codeProfile.onChain ? '已上链' : '待确认',
          badgeTone: codeProfile.onChain ? 'green' : 'gray',
        },
      ];

      return (
        <>
          <ProductionDetailLayout
            class="production-detail-compact quality-detail"
            code={codeProfile.code || codeStr}
            title={batchInfo?.cropName || codeProfile.productName || codeProfile.cropName || '溯源监管详情'}
            status={{ label: codeName(codeProfile.status), tone: traceStatusTone(codeProfile.status) }}
            extraStatuses={[
              { label: codeProfile.onChain ? '已上链' : '未确认上链', tone: codeProfile.onChain ? 'green' : 'gray' },
              ...(isFrozen ? [{ label: '批次已冻结', tone: 'red' }] : []),
            ]}
            meta={[
              { label: '批次号', value: codeProfile.batchNo || batchInfo?.batchNo || '—' },
              { label: '农场', value: batchInfo?.farmName || codeProfile.farmName || '—' },
              { label: '扫码次数', value: `${codeProfile.scanCount ?? 0} 次` },
              { label: '生成时间', value: codeProfile.createdAt || '—' },
            ]}
            tabs={tabs}
            activeTab={activeTab.value}
            backLabel="返回溯源码管理"
            onBack={() => nav('/admin/production/trace/codes')}
            onTabChange={key => {
              activeTab.value = key;
            }}
            actions={
              <>
                <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>
                  刷新链路
                </Button>
                {canRecall && (
                  <Button
                    danger
                    icon={<StopOutlined />}
                    loading={recallMutation.isPending}
                    onClick={() => handleRecall(batchInfo!.batchId!, batchInfo!.batchNo)}
                  >
                    一键召回
                  </Button>
                )}
                {batchInfo?.batchNo && (
                  <Button
                    type="primary"
                    onClick={() => nav(`/admin/production/quality/inspections?batchNo=${encodeURIComponent(batchInfo.batchNo!)}`)}
                  >
                    批次检测台账
                  </Button>
                )}
              </>
            }
            aside={
              <>
                <DetailSection title="溯源进度">
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
                <DetailSection title="单品码档案">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { key: 'code', label: '溯源码', value: codeProfile.code, mono: true, fullWidth: true },
                      { key: 'batch', label: '批次号', value: codeProfile.batchNo, mono: true },
                      { key: 'scan', label: '扫码次数', value: `${codeProfile.scanCount ?? 0} 次`, mono: true },
                      { key: 'expire', label: '有效期', value: codeProfile.expireDate || '未设置', mono: Boolean(codeProfile.expireDate) },
                      { key: 'activate', label: '激活时间', value: codeProfile.activateTime || '未激活', mono: Boolean(codeProfile.activateTime) },
                      { key: 'firstScan', label: '首次扫码', value: codeProfile.firstQueryTime || '暂无扫码', mono: Boolean(codeProfile.firstQueryTime) },
                      { key: 'create', label: '生成时间', value: codeProfile.createdAt, mono: true },
                    ]}
                  />
                </DetailSection>

                <DetailSection
                  title="批次来源"
                  extra={
                    batchInfo?.batchNo ? (
                      <button
                        type="button"
                        class="agri-detail-section-link"
                        onClick={() => nav(`/admin/production/quality/inspections?batchNo=${encodeURIComponent(batchInfo.batchNo!)}`)}
                      >
                        批次检测台账
                      </button>
                    ) : undefined
                  }
                >
                  {batchInfo ? (
                    <DetailInfoGrid
                      columns={2}
                      items={[
                        { key: 'no', label: '批次号', value: batchInfo.batchNo, mono: true },
                        { key: 'crop', label: '产品名称', value: batchInfo.cropName },
                        { key: 'farm', label: '所属农场', value: batchInfo.farmName },
                        { key: 'harvest', label: '采收日期', value: batchInfo.harvestDate, mono: true },
                        { key: 'qty', label: '采收数量', value: batchInfo.quantity, mono: true },
                        {
                          key: 'state',
                          label: '管控状态',
                          value: <Tag color={isFrozen ? 'red' : 'green'}>{isFrozen ? '已冻结' : '未冻结'}</Tag>,
                        },
                      ]}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未关联有效批次" />
                  )}
                </DetailSection>

                <DetailSection
                  title="检测与风险记录"
                  extra={
                    inspections.value.length > 0 ? (
                      <button
                        type="button"
                        class="agri-detail-section-link"
                        onClick={() => {
                          activeTab.value = 'inspections';
                        }}
                      >
                        查看全部 {inspections.value.length} 项
                      </button>
                    ) : undefined
                  }
                  footer={
                    inspections.value.length > 0 ? (
                      <div class="agri-detail-table-summary">
                        <span>检测报告总数</span>
                        <strong class="detail-info-mono">{inspections.value.length} 份</strong>
                        <span style={{ color: '#68776e', marginLeft: '12px' }}>合格 {passCount} · 不合格 {failedCount}</span>
                      </div>
                    ) : undefined
                  }
                >
                  <Table
                    rowKey="inspectionId"
                    memberListToolbar
                    rowSelection={{}}
                    cardProps={false}
                    columns={cols.value}
                    dataSource={inspections.value.slice(0, 5)}
                    search={false}
                    pagination={false}
                    scroll={{ x: 820 }}
                    options={{ reload: () => void query.refetch() }}
                  />
                </DetailSection>

                <Alert
                  type="info"
                  showIcon
                  message="生产节点复用用户端真实事实。交易订单、物流与售后由交易履约域维护，生产链路与存证不代表已交付或质量合格。"
                />
              </>
            )}

            {activeTab.value === 'inspections' && (
              <DetailSection title="检测与风险记录">
                <Table
                  rowKey="inspectionId"
                  memberListToolbar
                  rowSelection={{}}
                  cardProps={false}
                  columns={cols.value}
                  dataSource={inspections.value}
                  search={false}
                  pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                  scroll={{ x: 820 }}
                  options={{ reload: () => void query.refetch() }}
                />
              </DetailSection>
            )}

            {activeTab.value === 'chain' && (
              <>
                <DetailSection
                  title="真实生产链路"
                  extra={<Typography.Text type="secondary">{nodes.value.length} 个关联节点</Typography.Text>}
                >
                  {nodes.value.length ? (
                    <Timeline
                      class="quality-trace-timeline"
                      items={nodes.value.map((n, index) => ({
                        key: `${n.nodeType}-${n.refId}-${index}`,
                        color: n.onChain ? 'green' : 'blue',
                        children: (
                          <div class="quality-trace-node">
                            <div class="quality-trace-node-heading">
                              <strong>{n.nodeName || n.nodeType}</strong>
                              <span class="quality-detail-muted detail-info-mono">
                                {n.occurredAt?.replace('T', ' ') || '未登记时间'}
                              </span>
                              <Tag color={n.onChain ? 'green' : 'default'}>
                                {n.onChain ? '已上链' : n.chainStatus || '无成功存证'}
                              </Tag>
                            </div>
                            {n.description && <div class="quality-trace-description">{n.description}</div>}
                            <DetailInfoGrid
                              columns={2}
                              items={[
                                { key: 'ref', label: '关联单据', value: n.refNo || n.refId, mono: true },
                                { key: 'operator', label: '操作人', value: n.operatorName || '未登记' },
                              ]}
                            />
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联生产节点" />
                  )}
                </DetailSection>
                <Alert
                  type="info"
                  showIcon
                  message="生产节点复用用户端真实事实。交易订单、物流与售后由交易履约域维护，生产链路与存证不代表已交付或质量合格。"
                />
              </>
            )}
          </ProductionDetailLayout>
          <InspectionDetail id={activeInspectionId.value} onClose={() => { activeInspectionId.value = undefined; }} />
        </>
      );
    };
  },
});

export default Detail;
