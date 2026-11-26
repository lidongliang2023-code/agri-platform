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
import Card from '@/vue/business/components/SectionCard';
import '@/pages/user/harvests/harvests.css';
/**
 * 页面名称：采收详情
 * 路由路径：/production/harvests/:harvestId
 * 所属模块：采收与库存管理
 * 原型 pageId：P15 harvest-detail
 *
 * 还原要点：
 * - 头部：`< 返回 采收记录 H20260601`；按钮「确认入库」「打印采收单」
 * - 「📋 采收信息」：采收编号、状态、农场、地块、作物品种、采收日期、采收数量、
 *   采收面积、采收人、质量等级、外观评价、亩产量
 * - 「🔗 关联信息」：关联农事任务（→task-detail）、关联溯源码（→trace-fullchain）
 * - 产量统计：预计产量 vs 实际产量 vs 完成率 + 亩产量
 */

import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer } from '@/vue/pro';
import { Alert, Button, Empty, Form, Input, Modal, Progress, Select, Skeleton, Space, Tag, Typography, message } from '@/vue/ui';
import { ArrowLeftOutlined, InboxOutlined, PrinterOutlined } from '@ant-design/icons-vue';
import { DetailInfoGrid, DetailMetricGrid } from '@/vue/business/components/index';
import useFarmStore from '@/vue/farmStore';
import useAuthStore from '@/vue/authStore';
import { inboundHarvest, queryHarvest } from '@/api/harvests';
import type { HarvestBatch, InboundStatus } from '@/types';
import { BATCH_STATUS_META, GRADE_COLOR_MAP, GRADE_LABEL_MAP, INBOUND_STATUS_META, WAREHOUSE_OPTIONS } from '@/types';

/** 入库弹窗表单值 */
interface InboundFormValues {
  /** 目标仓库 */
  warehouseName?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 采收详情页面
 *
 * 业务职责：展示单个采收批次的基础信息、关联任务与溯源码、产量统计，并支持确认入库。
 *
 * @returns 页面内容
 */
const Detail = defineComponent({
  name: "Detail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _params = useParams<{
      harvestId: string;
    }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const currentFarm = useFarmStore(state => state.currentFarm);
    const inboundOpen = shallowRef<boolean>(false);
    const setInboundOpen = (next: typeof inboundOpen.value | ((previous: typeof inboundOpen.value) => typeof inboundOpen.value)) => {
      inboundOpen.value = typeof next === 'function' ? (next as (previous: typeof inboundOpen.value) => typeof inboundOpen.value)(inboundOpen.value) : next;
    };
    const [inboundForm] = Form.useForm<InboundFormValues>();

    /** 采收批次详情 */
    const detailQuery = useQuery(() => ({
      queryKey: ['production-harvests', 'detail', _params.harvestId, subjectId.value],
      enabled: Boolean(_params.harvestId),
      queryFn: () => queryHarvest(_params.harvestId as string)
    }));

    /** 确认入库 */
    const inboundMutation = useMutation(() => ({
      mutationFn: (warehouseName: string) => inboundHarvest(_params.harvestId as string, {
        warehouseName
      }),
      onSuccess: () => {
        message.success('批次已入库，库存流水已生成');
        setInboundOpen(false);
        inboundForm.resetFields();
        void queryClient.invalidateQueries({
          queryKey: ['production-harvests']
        });
      },
      onError: error => {
        message.error(error.message || '入库失败，请稍后重试', 6);
      }
    }));

    /** 打印采收单 */
    const handlePrint = (): void => {
      window.print();
    };

    /**
     * 提交入库。
     *
     * 仓库名**不再有默认值**：该项必填，`validateFields` 已保证有值；
     * 这里再兜一次是为了类型收口——真拿不到就直接失败，不用"主仓库"冒充。
     */
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

    /** 加载态 */
    return () => {
      const _batchSnapshot = batch.value;
      if (detailQuery.isLoading) {
        return <PageContainer class="harvest-business-page production-detail-compact" title="采收详情">
        <Card>
          <Skeleton active paragraph={{
              rows: 8
            }} />
        </Card>
      </PageContainer>;
      }

      /** 错误态 / 空态 */
      if (detailQuery.isError || !_batchSnapshot) {
        return <PageContainer class="harvest-business-page production-detail-compact" title="采收详情">
        <Empty description={<Space direction="vertical">
              <Typography.Text type="danger">未查询到该采收批次，请返回列表重试</Typography.Text>
              <Button onClick={() => navigate('/production/harvests')}>返回采收管理</Button>
            </Space>} />
      </PageContainer>;
      }

      /** 入库状态由后端库存动作维护，页面不再猜测。 */
      const inboundStatus = (_batchSnapshot.inboundStatus ?? 0) as InboundStatus;
      const inbound = INBOUND_STATUS_META[inboundStatus];
      const finishRate = _batchSnapshot.expectedQuantity && _batchSnapshot.expectedQuantity > 0 ? Math.round((_batchSnapshot.quantity ?? 0) / _batchSnapshot.expectedQuantity * 100) : 0;
      return <PageContainer class="harvest-business-page production-detail-compact" title={`📦 采收记录 ${_batchSnapshot.batchNo}`} subTitle={_batchSnapshot.farmName ?? currentFarm.value?.farmName} onBack={() => navigate('/production/harvests')} backIcon={<ArrowLeftOutlined />} extra={[<Button key="inbound" type="primary" icon={<InboxOutlined />} disabled={inboundStatus !== 0} loading={inboundMutation.isPending} onClick={() => setInboundOpen(true)}>
      {_batchSnapshot.status === 4 && <Alert type="error" showIcon message="批次已冻结" description={_batchSnapshot.remark || '请核对监管处置与质量检测记录，冻结期间不得继续出库或发布现货。'} style={{
          marginBottom: 16
        }} />}
          {inboundStatus === 0 ? '确认入库' : '已入库'}
        </Button>, <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
          打印采收单
        </Button>]}>

      <Card title="基本信息" style={{
          marginBottom: 16
        }} extra={<Space size={4} wrap>
            <Tag color={inbound.color}>
              <span style={{
              color: inbound.color
            }}>●</span> {inbound.label}
            </Tag>
            <Tag color={BATCH_STATUS_META[_batchSnapshot.status]?.color ?? 'default'}>
              {BATCH_STATUS_META[_batchSnapshot.status]?.label ?? _batchSnapshot.status}
            </Tag>
          </Space>}>
        <DetailInfoGrid columns={2} items={[{
            key: 'batchNo',
            label: '采收编号',
            value: _batchSnapshot.batchNo
          }, {
            key: 'farm',
            label: '农场',
            value: _batchSnapshot.farmName ?? '-'
          }, {
            key: 'plot',
            label: '地块',
            value: _batchSnapshot.plotName ?? _batchSnapshot.plotId ?? '-'
          }, {
            key: 'crop',
            label: '作物品种',
            value: `${_batchSnapshot.cropName ?? '-'}${_batchSnapshot.cropVariety ? `(${_batchSnapshot.cropVariety})` : ''}`
          }, {
            key: 'harvestDate',
            label: '采收日期',
            value: _batchSnapshot.harvestDate
          }, {
            key: 'quantity',
            label: '采收数量',
            value: `${_batchSnapshot.quantity.toLocaleString()} ${_batchSnapshot.unit}`
          }, {
            key: 'harvestArea',
            label: '采收面积',
            value: _batchSnapshot.harvestArea ? `${_batchSnapshot.harvestArea} 亩` : '-'
          }, {
            key: 'operator',
            label: '采收人',
            value: _batchSnapshot.operatorName ?? '-'
          }, {
            key: 'grade',
            label: '质量等级',
            value: <Tag color={GRADE_COLOR_MAP[_batchSnapshot.grade] ?? 'default'}>
                  {GRADE_LABEL_MAP[_batchSnapshot.grade] ?? _batchSnapshot.grade}
                </Tag>
          }, {
            key: 'appearance',
            label: '外观评价',
            value: _batchSnapshot.appearance ?? '-'
          }, {
            key: 'perMuYield',
            label: '亩产量',
            value: _batchSnapshot.perMuYield ? `${_batchSnapshot.perMuYield} ${_batchSnapshot.unit}/亩` : '-'
          }, {
            key: 'warehouse',
            label: '存放仓库',
            value: _batchSnapshot.warehouseName ?? '-'
          }, {
            key: 'createdAt',
            label: '登记时间',
            value: _batchSnapshot.createdAt ?? '-'
          }, {
            key: 'linkedOffers',
            label: '关联供给',
            value: _batchSnapshot.linkedOfferCount == null ? '—' : <Space>
                  <span>{_batchSnapshot.linkedOfferCount} 条</span>
                  {_batchSnapshot.linkedOfferCount > 0 && subjectId.value && <Button type="link" size="small" onClick={() => {
                const params = new URLSearchParams({
                  batchId: String(_batchSnapshot.batchId),
                  subjectId: String(subjectId.value)
                });
                navigate(`/production/p2t/offers?${params}`);
              }}>查看关联供给</Button>}
                </Space>
          }, ...(_batchSnapshot.mutationBlockedReason ? [{
            key: 'mutationBlockedReason',
            label: '批次保护',
            fullWidth: true,
            value: _batchSnapshot.mutationBlockedReason
          }] : []), {
            key: 'remark',
            label: '备注',
            fullWidth: true,
            value: _batchSnapshot.remark ?? '-'
          }]} />
      </Card>

      <Card title="产量统计" style={{
          marginBottom: 16
        }}>
        <DetailMetricGrid items={[{
            key: 'quantity',
            title: '实际采收',
            value: _batchSnapshot.quantity,
            precision: 2,
            suffix: _batchSnapshot.unit,
            valueStyle: {
              color: '#1677ff'
            }
          }, {
            key: 'expected',
            title: '预计产量',
            value: _batchSnapshot.expectedQuantity ?? 0,
            suffix: 'kg'
          }, {
            key: 'rate',
            title: '完成率',
            value: finishRate,
            suffix: '%',
            valueStyle: {
              color: finishRate >= 100 ? '#52c41a' : '#faad14'
            }
          }, {
            key: 'perMuYield',
            title: '亩产量',
            value: _batchSnapshot.perMuYield ?? 0,
            precision: 2,
            suffix: `${_batchSnapshot.unit}/亩`
          }]} />
        <Progress style={{
            marginTop: 16
          }} percent={Math.min(finishRate, 100)} status={finishRate >= 100 ? 'success' : 'active'} />
      </Card>

      <Card title="关联信息">
        <DetailInfoGrid columns={2} items={[{
            key: 'task',
            label: '关联农事任务',
            value: _batchSnapshot.relatedTaskId ? <Typography.Link onClick={() => navigate(`/production/tasks/${_batchSnapshot.relatedTaskId}`)}>
                  {_batchSnapshot.relatedTaskName ?? _batchSnapshot.relatedTaskId}
                </Typography.Link> : '-'
          }, {
            key: 'trace',
            label: '关联溯源码',
            value: _batchSnapshot.traceCode ? <Typography.Link onClick={() => navigate(`/production/trace/full-chain?code=${encodeURIComponent(_batchSnapshot.traceCode as string)}`)}>
                  {_batchSnapshot.traceCode}
                </Typography.Link> : <Space size={4}>
                  <Typography.Text type="secondary">未生成溯源码</Typography.Text>
                  {inboundStatus === 0 ? <Typography.Text type="secondary">（入库后自动生成）</Typography.Text> : null}
                </Space>
          }, {
            key: 'inspection',
            label: '关联检测单',
            value: _batchSnapshot.inspectionNo ?? _batchSnapshot.inspectionId ?? '-'
          }, {
            key: 'inventory',
            label: '关联库存',
            value: _batchSnapshot.inventoryId ? <Typography.Link onClick={() => navigate(`/production/harvests/inventory/${_batchSnapshot.inventoryId}`)}>
                  {_batchSnapshot.inventoryId}
                </Typography.Link> : '-'
          }]} />
        <Space style={{
            marginTop: 12
          }}>
          <Button onClick={() => navigate(`/production/trace/full-chain`)}>
            查看全链路溯源
          </Button>
          <Button onClick={() => navigate('/production/harvests/inventory')}>查看成品库存</Button>
        </Space>
      </Card>

      <Modal class="production-form-dialog" title={`确认入库：${_batchSnapshot.batchNo}`} open={inboundOpen.value} okText="确认入库" cancelText="取消" confirmLoading={inboundMutation.isPending} onOk={handleInbound} onCancel={() => {
          setInboundOpen(false);
          inboundForm.resetFields();
        }} destroyOnClose>
        <Form form={inboundForm} layout="vertical" style={{
            marginTop: 16
          }}
          /* 不再默认"主仓库"：默认值会被当成真实仓库名直接入库（与 ?? 0 兜底同型） */ initialValues={{}}>
          <Form.Item name="warehouseName" label="入库仓库" rules={[{
              required: true,
              message: '请选择入库仓库'
            }]}>
            <Select options={WAREHOUSE_OPTIONS} placeholder="请选择入库仓库" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写库位、转运车辆等说明" />
          </Form.Item>
          <Alert type="info" showIcon message={`本次入库数量 ${_batchSnapshot.quantity} ${_batchSnapshot.unit}，入库后批次状态更新为「在库」`} />
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default Detail;
