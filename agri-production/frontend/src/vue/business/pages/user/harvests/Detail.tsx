import { defineComponent, shallowRef, computed, watch } from 'vue';
import '@/components/ProductionDetailCompact.css';
import '@/pages/user/harvests/harvests.css';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Empty, Form, Input, Modal, Progress, Select, Skeleton, Space, Tag, Typography, message } from '@/vue/ui';
import { InboxOutlined, PrinterOutlined } from '@ant-design/icons-vue';
import {
  DetailInfoGrid,
  DetailMetricGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';
import useFarmStore from '@/vue/farmStore';
import useAuthStore from '@/vue/authStore';
import { inboundHarvest, queryHarvest } from '@/api/harvests';
import type { HarvestBatch, InboundStatus } from '@/types';
import { BATCH_STATUS_META, GRADE_COLOR_MAP, GRADE_LABEL_MAP, INBOUND_STATUS_META, WAREHOUSE_OPTIONS } from '@/types';

interface InboundFormValues {
  warehouseName?: string;
  remark?: string;
}

const Detail = defineComponent({
  name: 'Detail',
  props: {},
  setup() {
    const _params = useParams<{ harvestId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const currentFarm = useFarmStore(state => state.currentFarm);
    const activeTab = shallowRef<string>('overview');
    const inboundOpen = shallowRef<boolean>(false);
    const [inboundForm] = Form.useForm<InboundFormValues>();

    watch(() => _params.harvestId, () => {
      activeTab.value = 'overview';
    });

    const detailQuery = useQuery(() => ({
      queryKey: ['production-harvests', 'detail', _params.harvestId, subjectId.value],
      enabled: Boolean(_params.harvestId),
      queryFn: () => queryHarvest(_params.harvestId as string),
    }));

    const inboundMutation = useMutation(() => ({
      mutationFn: (warehouseName: string) => inboundHarvest(_params.harvestId as string, { warehouseName }),
      onSuccess: () => {
        message.success('批次已入库，库存流水已生成');
        inboundOpen.value = false;
        inboundForm.resetFields();
        void queryClient.invalidateQueries({ queryKey: ['production-harvests'] });
      },
      onError: error => {
        message.error(error.message || '入库失败，请稍后重试', 6);
      },
    }));

    const handlePrint = (): void => {
      window.print();
    };

    const handleInbound = (): void => {
      inboundForm.validateFields().then(values => {
        const warehouseName = values.warehouseName as string | undefined;
        if (!warehouseName) {
          message.error('请先选择入库仓库，未提交到服务端');
          return;
        }
        inboundMutation.mutate(warehouseName);
      });
    };

    const batch = computed<HarvestBatch | undefined>(() => detailQuery.data);

    return () => {
      const _batchSnapshot = batch.value;
      if (detailQuery.isLoading) {
        return (
          <ProductionDetailLayout class="harvest-business-page production-detail-compact" title="采收详情" hasAside={false} onBack={() => navigate('/production/harvests')}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 8 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (detailQuery.isError || !_batchSnapshot) {
        return (
          <ProductionDetailLayout class="harvest-business-page production-detail-compact" title="采收详情" hasAside={false} onBack={() => navigate('/production/harvests')}>
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">未查询到该采收批次，请返回列表重试</Typography.Text>
                    <Button onClick={() => navigate('/production/harvests')}>返回采收管理</Button>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const inboundStatus = (_batchSnapshot.inboundStatus ?? 0) as InboundStatus;
      const inbound = INBOUND_STATUS_META[inboundStatus];
      const batchStatus = BATCH_STATUS_META[_batchSnapshot.status] ?? {
        label: String(_batchSnapshot.status),
        color: 'default',
      };
      const finishRate =
        _batchSnapshot.expectedQuantity && _batchSnapshot.expectedQuantity > 0
          ? Math.round(((_batchSnapshot.quantity ?? 0) / _batchSnapshot.expectedQuantity) * 100)
          : 0;
      const isFrozen = _batchSnapshot.status === 4;

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '采收详情' },
        { key: 'yield', label: '产量统计' },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'harvested',
          title: '采收登记完成',
          time: _batchSnapshot.harvestDate || _batchSnapshot.createdAt || undefined,
          description: `采收人：${_batchSnapshot.operatorName ?? '—'}`,
          state: 'done',
        },
        {
          key: 'grade',
          title: '外观与质量分级',
          description: `等级：${GRADE_LABEL_MAP[_batchSnapshot.grade] ?? _batchSnapshot.grade}`,
          state: 'done',
        },
        {
          key: 'inbound',
          title: inboundStatus === 0 ? '等待确认入库' : '已完成入库',
          description: inboundStatus === 0 ? '当前节点 · 可点击右上角确认入库' : `存放仓库：${_batchSnapshot.warehouseName ?? '—'}`,
          state: isFrozen ? 'error' : inboundStatus === 0 ? 'current' : 'done',
        },
        {
          key: 'trace',
          title: _batchSnapshot.traceCode ? '已生成溯源码' : '生成溯源与供给',
          description: _batchSnapshot.traceCode ? `溯源码 ${_batchSnapshot.traceCode}` : '入库后可流转至溯源及供给意向',
          state: _batchSnapshot.traceCode ? 'done' : inboundStatus !== 0 ? 'current' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'task',
          label: '关联农事任务',
          text: _batchSnapshot.relatedTaskName ?? _batchSnapshot.relatedTaskId ?? undefined,
          emptyText: '未关联任务',
          mono: !_batchSnapshot.relatedTaskName,
          onClick: _batchSnapshot.relatedTaskId ? () => navigate(`/production/tasks/${_batchSnapshot.relatedTaskId}`) : undefined,
        },
        {
          key: 'inventory',
          label: '关联库存记录',
          code: _batchSnapshot.inventoryId || undefined,
          emptyText: '待入库生成',
          onClick: _batchSnapshot.inventoryId ? () => navigate(`/production/harvests/inventory/${_batchSnapshot.inventoryId}`) : undefined,
        },
        {
          key: 'trace',
          label: '关联溯源码',
          code: _batchSnapshot.traceCode || undefined,
          emptyText: inboundStatus === 0 ? '入库后生成' : '未生成',
          onClick: _batchSnapshot.traceCode
            ? () => navigate(`/production/trace/full-chain?code=${encodeURIComponent(_batchSnapshot.traceCode as string)}`)
            : undefined,
        },
        {
          key: 'inspection',
          label: '关联检测单',
          code: _batchSnapshot.inspectionNo ?? _batchSnapshot.inspectionId ?? undefined,
          emptyText: '暂无检测单',
        },
        {
          key: 'offers',
          label: '关联供给意向',
          text: _batchSnapshot.linkedOfferCount == null ? undefined : `${_batchSnapshot.linkedOfferCount} 条供给`,
          emptyText: '暂无供给',
          mono: false,
          onClick:
            _batchSnapshot.linkedOfferCount && _batchSnapshot.linkedOfferCount > 0 && subjectId.value
              ? () => {
                  const params = new URLSearchParams({
                    batchId: String(_batchSnapshot.batchId),
                    subjectId: String(subjectId.value),
                  });
                  navigate(`/production/p2t/offers?${params}`);
                }
              : undefined,
        },
      ];

      return (
        <ProductionDetailLayout
          class="harvest-business-page production-detail-compact"
          code={_batchSnapshot.batchNo}
          title={`${_batchSnapshot.cropName ?? '采收批次'}${_batchSnapshot.cropVariety ? ` · ${_batchSnapshot.cropVariety}` : ''}`}
          status={{ label: inbound.label, tone: inbound.color }}
          extraStatuses={[{ label: batchStatus.label, tone: batchStatus.color }]}
          meta={[
            { label: '农场', value: _batchSnapshot.farmName ?? currentFarm.value?.farmName ?? '—' },
            { label: '采收人', value: _batchSnapshot.operatorName ?? '—' },
            { label: '登记时间', value: _batchSnapshot.createdAt ?? _batchSnapshot.harvestDate ?? '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回采收记录"
          onBack={() => navigate('/production/harvests')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          banner={
            isFrozen ? (
              <Alert
                type="error"
                showIcon
                message="批次已冻结"
                description={_batchSnapshot.remark || '请核对监管处置与质量检测记录，冻结期间不得继续出库或发布现货。'}
              />
            ) : undefined
          }
          actions={
            /* 次要 → 主要 */
            <>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                打印采收单
              </Button>
              <Button
                type="primary"
                icon={<InboxOutlined />}
                disabled={inboundStatus !== 0}
                loading={inboundMutation.isPending}
                onClick={() => {
                  inboundOpen.value = true;
                }}
              >
                {inboundStatus === 0 ? '确认入库' : '已入库'}
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="采收入库进度">
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
                    { key: 'batchNo', label: '采收编号', value: _batchSnapshot.batchNo, mono: true },
                    { key: 'crop', label: '作物品种', value: `${_batchSnapshot.cropName ?? '—'}${_batchSnapshot.cropVariety ? `（${_batchSnapshot.cropVariety}）` : ''}` },
                    { key: 'farm', label: '所属农场', value: _batchSnapshot.farmName ?? '—' },
                    { key: 'plot', label: '采收地块', value: _batchSnapshot.plotName ?? _batchSnapshot.plotId ?? '—' },
                    { key: 'harvestDate', label: '采收日期', value: _batchSnapshot.harvestDate || '—', mono: true },
                    { key: 'operator', label: '采收人', value: _batchSnapshot.operatorName ?? '—' },
                    { key: 'createdAt', label: '登记时间', value: _batchSnapshot.createdAt ?? '—', mono: true },
                    { key: 'warehouse', label: '存放仓库', value: _batchSnapshot.warehouseName ?? '—' },
                  ]}
                />
              </DetailSection>

              <DetailSection title="采收量与品控信息">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    {
                      key: 'quantity',
                      label: '采收数量',
                      value: `${_batchSnapshot.quantity.toLocaleString()} ${_batchSnapshot.unit}`,
                      mono: true,
                    },
                    {
                      key: 'harvestArea',
                      label: '采收面积',
                      value: _batchSnapshot.harvestArea ? `${_batchSnapshot.harvestArea} 亩` : '—',
                      mono: true,
                    },
                    {
                      key: 'perMuYield',
                      label: '亩产量',
                      value: _batchSnapshot.perMuYield ? `${_batchSnapshot.perMuYield} ${_batchSnapshot.unit}/亩` : '—',
                      mono: true,
                    },
                    {
                      key: 'grade',
                      label: '质量等级',
                      value: (
                        <Tag color={GRADE_COLOR_MAP[_batchSnapshot.grade] ?? 'default'}>
                          {GRADE_LABEL_MAP[_batchSnapshot.grade] ?? _batchSnapshot.grade}
                        </Tag>
                      ),
                    },
                    { key: 'appearance', label: '外观评价', value: _batchSnapshot.appearance ?? '—' },
                    {
                      key: 'expected',
                      label: '预计产量',
                      value: _batchSnapshot.expectedQuantity ? `${_batchSnapshot.expectedQuantity} kg` : '—',
                      mono: true,
                    },
                    ...(_batchSnapshot.mutationBlockedReason
                      ? [{ key: 'mutationBlockedReason', label: '批次保护', fullWidth: true, value: _batchSnapshot.mutationBlockedReason }]
                      : []),
                    { key: 'remark', label: '备注说明', fullWidth: true, value: _batchSnapshot.remark ?? '—' },
                  ]}
                />
              </DetailSection>
            </>
          )}

          {activeTab.value === 'yield' && (
            <DetailSection title="产量达成统计">
              <DetailMetricGrid
                items={[
                  {
                    key: 'quantity',
                    title: '实际采收',
                    value: _batchSnapshot.quantity,
                    precision: 2,
                    suffix: _batchSnapshot.unit,
                    valueStyle: { color: '#2d8f4e' },
                  },
                  {
                    key: 'expected',
                    title: '预计产量',
                    value: _batchSnapshot.expectedQuantity ?? 0,
                    suffix: 'kg',
                  },
                  {
                    key: 'rate',
                    title: '计划完成率',
                    value: finishRate,
                    suffix: '%',
                    valueStyle: { color: finishRate >= 100 ? '#2d8f4e' : '#fa8c16' },
                  },
                  {
                    key: 'perMuYield',
                    title: '亩产量',
                    value: _batchSnapshot.perMuYield ?? 0,
                    precision: 2,
                    suffix: `${_batchSnapshot.unit}/亩`,
                  },
                ]}
              />
              <Progress
                style={{ marginTop: 16 }}
                percent={Math.min(finishRate, 100)}
                strokeColor={finishRate >= 100 ? '#2d8f4e' : '#fa8c16'}
                status={finishRate >= 100 ? 'success' : 'active'}
              />
            </DetailSection>
          )}

          <Modal
            class="production-form-dialog"
            title={`确认入库：${_batchSnapshot.batchNo}`}
            open={inboundOpen.value}
            okText="确认入库"
            cancelText="取消"
            confirmLoading={inboundMutation.isPending}
            onOk={handleInbound}
            onCancel={() => {
              inboundOpen.value = false;
              inboundForm.resetFields();
            }}
            destroyOnClose
          >
            <Form form={inboundForm} layout="vertical" style={{ marginTop: 16 }} initialValues={{}}>
              <Form.Item name="warehouseName" label="入库仓库" rules={[{ required: true, message: '请选择入库仓库' }]}>
                <Select options={WAREHOUSE_OPTIONS} placeholder="请选择入库仓库" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={3} placeholder="可填写库位、转运车辆等说明" />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message={`本次入库数量 ${_batchSnapshot.quantity} ${_batchSnapshot.unit}，入库后批次状态更新为「在库」`}
              />
            </Form>
          </Modal>
        </ProductionDetailLayout>
      );
    };
  },
});

export default Detail;
