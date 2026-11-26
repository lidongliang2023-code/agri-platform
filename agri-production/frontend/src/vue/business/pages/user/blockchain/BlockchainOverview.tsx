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
import '@/components/ProductionListDense.css';
import Table from '@/vue/business/components/BusinessRecordList';
import { PageContainer as PageContainer } from '@/vue/pro';
/**
 * 页面名称：区块链存证总览
 * 路由路径：/production/blockchain
 * 所属模块：区块链增强
 * 原型 pageId：blockchain（P27）
 *
 * ⚠️ 真数据约束（本页此前必现造假，已修复，请勿回退）
 *
 * 后端 `GET /blockchain/overview` 只返回 `{total, success, failed}`（且三个值是**字符串**），
 * 不返回 monthRecords / monthGrowth / pendingRecords / verifyPassRate / typeStats / health /
 * recentRecords / pendingQueue。旧版用 `MOCK_OVERVIEW` 兜底，且 `isValidOverview()` 只认
 * `totalRecords` —— 后端根本没有这个字段，导致**接口完全正常时也 100% 展示示例数据**。
 *
 * 现在：
 * 1. 指标卡只消费后端真实返回的 total / success / failed（先 toNumber 再渲染与运算）；
 * 2. 「存证类型分布」「最近存证记录」改用**真实的** GET /blockchain/records 数据本地统计，
 *    并明示统计口径；
 * 3. 后端完全没有提供的指标（链上健康度、待上链队列）改为明示「后端暂未提供」，不填任何值；
 * 4. 接口失败只渲染错误态，不渲染任何示例数据。
 */

import { useNavigate } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Card, Col, Empty, Form, Input, Modal, Row, Select, Tag, Tooltip, Typography, message } from '@/vue/ui';
import { ArrowRightOutlined, CheckCircleFilled, ClockCircleOutlined, CloudUploadOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import ReactECharts from '@/vue/VueECharts';
import type { EChartsOption } from 'echarts';
import type { ColumnsType } from '@/vue/ui';
import { anchorRecord, getChainOverview, listCertRecords } from '@/api/blockchain';
import type { BlockchainBizRecord } from '@/types';
import { asApiRequestError, httpStatusOf, toNumber } from '@/utils/request';
import useFarmStore from '@/vue/farmStore';

/**
 * 业务类型编码 → 名称（取值是存证表 target_type，实测 TRACE / QUALITY / HARVEST）。
 * `INSPECTION` 是平台侧旧词表，服务端查询时会归一成 QUALITY —— 两个都留着，
 * 否则饼图/最近存证里会出现一段没有中文名的英文标签（截图里就是"QUALITY 1条"）。
 */
const BIZ_TYPE_NAME: Record<string, string> = {
  FARMING: '生产记录',
  INSPECTION: '检测报告',
  QUALITY: '质量检测',
  INPUT: '投入品使用',
  HARVEST: '采收入库',
  CIRCULATION: '流通记录',
  IOT: 'IoT数据',
  TRACE: '溯源记录'
};

/**
 * 业务类型选项（手动上链表单）。
 *
 * 只列**服务端能校验业务键**的四类：采收批次 / 质检单 / 投入品使用 / 溯源码。
 * 旧版还有 FARMING、CIRCULATION、IOT —— 这三类本部署没有可校验的业务主数据入口，
 * 单号是自由填写的，出证等于给一个可能不存在（或属于别家主体）的键伪造"已存证（模拟）"，
 * 所以后端直接拒绝（ChainRecordServiceImpl#normalizeType），表单也不再提供这个选项。
 */
const BIZ_TYPE_OPTIONS = [{
  value: 'HARVEST',
  label: '采收入库'
}, {
  value: 'QUALITY',
  label: '质量检测'
}, {
  value: 'INPUT',
  label: '投入品使用'
}, {
  value: 'TRACE',
  label: '溯源记录'
}];

/** 类型分布取数上限：后端 records 是分页接口，这里一次性取一批做本地分组统计 */
const STAT_SCAN_SIZE = 500;

/**
 * 把查询失败原因转成明示文案：区分「后端业务拒绝」「HTTP 非 200」「后端不可达」，
 * 避免把所有故障笼统说成「接口暂不可用」。
 *
 * @param error catch 到的未知错误
 * @returns 失败文案
 */
function describeError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const apiError = asApiRequestError(error);
  if (apiError && typeof apiError.bizCode === 'number') {
    return `后端业务码 ${apiError.bizCode}（HTTP ${apiError.httpStatus ?? 200}）：${rawMessage}`;
  }
  const status = httpStatusOf(error);
  if (status > 0) {
    return `HTTP ${status}：${rawMessage}`;
  }
  return `网络异常或超时：${rawMessage}`;
}

/** 最近存证记录行（由真实存证记录映射而来） */
interface RecentRow {
  /** 上链时间；未上链时展示创建时间占位 */
  time: string;
  /** 业务类型名称 */
  type: string;
  /** 业务单号 */
  summary: string;
  /** 存证状态 */
  status: string;
}

/**
 * 区块链存证总览（原型 P27）
 *
 * 业务职责：展示后端真实提供的存证总量 / 存证成功 / 上链失败三项指标，
 * 用真实存证记录统计类型分布与最近存证，并对后端未提供的能力做明示说明。
 *
 * @returns 页面内容
 */
const BlockchainOverview = defineComponent({
  name: "BlockchainOverview",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const farmId = useFarmStore(state => state.currentFarm?.farmId);
    const anchorOpen = shallowRef<boolean>(false);
    const setAnchorOpen = (next: typeof anchorOpen.value | ((previous: typeof anchorOpen.value) => typeof anchorOpen.value)) => {
      anchorOpen.value = typeof next === 'function' ? (next as (previous: typeof anchorOpen.value) => typeof anchorOpen.value)(anchorOpen.value) : next;
    };
    const [anchorForm] = Form.useForm<{
      bizType: string;
      bizNo: string;
      bizSummary?: string;
    }>();

    /** 总览统计：后端真实形状 {total, success, failed}（值可能是字符串） */
    const overviewQuery = useQuery(() => ({
      queryKey: ['blockchain-overview', farmId.value],
      queryFn: () => getChainOverview()
    }));

    /** 真实存证记录：用于类型分布与最近存证（后端 overview 不提供这两项） */
    const recordsQuery = useQuery(() => ({
      queryKey: ['blockchain-overview-records', farmId.value],
      queryFn: () => listCertRecords({
        pageNum: 1,
        pageSize: STAT_SCAN_SIZE
      })
    }));
    const rawStat = computed(() => overviewQuery.data);
    const total = computed(() => toNumber(rawStat.value?.total, 0));
    const success = computed(() => toNumber(rawStat.value?.success, 0));
    const failed = computed(() => toNumber(rawStat.value?.failed, 0));
    /** 未成功条数：由三个真实计数推导（total − success − failed），不是估算 */
    const notSuccess = computed(() => total.value - success.value - failed.value);
    const allRecords = computed<BlockchainBizRecord[]>(() => recordsQuery.data?.list ?? []);
    /** 本次实际参与统计的样本条数（后端分页上限内取到的真实记录数） */
    const scannedCount = computed<number>(() => allRecords.value.length);
    /** 后端存证总条数（用于判断样本是否为全量） */
    const backendTotal = computed<number>(() => toNumber(recordsQuery.data?.total, scannedCount.value));

    /** 类型分布：按 bizType 对真实记录分组计数 */
    const typeStats = computed<{
      name: string;
      value: number;
    }[]>(() => {
      const counter = new Map<string, number>();
      allRecords.value.forEach(item => {
        const key = item.bizType ?? 'UNKNOWN';
        counter.set(key, (counter.get(key) ?? 0) + 1);
      });
      return Array.from(counter.entries()).map(([code, value]) => ({
        name: BIZ_TYPE_NAME[code] ?? code,
        value
      })).sort((a, b) => b.value - a.value);
    });

    /** 最近存证记录：按上链时间倒序取前 5 条真实记录 */
    const recentRows = computed<RecentRow[]>(() => allRecords.value.slice().sort((a, b) => String(b.anchorAt ?? b.createdAt ?? '').localeCompare(String(a.anchorAt ?? a.createdAt ?? ''))).slice(0, 5).map(item => ({
      time: String(item.anchorAt ?? item.createdAt ?? '-').slice(5, 16),
      type: BIZ_TYPE_NAME[item.bizType ?? ''] ?? item.bizType ?? '-',
      summary: item.bizNo ?? '-',
      status: item.status ?? '-'
    })));

    /** 手动上链 */
    const anchorMutation = useMutation(() => ({
      mutationFn: (payload: {
        bizType: string;
        bizNo: string;
        bizSummary?: string;
      }) => anchorRecord(payload),
      onSuccess: () => {
        message.success('已提交存证，请在存证记录核对处理状态；当前未接入真实区块链');
        setAnchorOpen(false);
        anchorForm.resetFields();
        void queryClient.invalidateQueries({
          queryKey: ['blockchain-overview']
        });
        void queryClient.invalidateQueries({
          queryKey: ['blockchain-overview-records']
        });
        void queryClient.invalidateQueries({
          queryKey: ['blockchain-records']
        });
      },
      onError: (err: Error) => {
        // 写操作失败就是失败，不允许「已按本地模式记录」这类假成功话术
        message.error(`提交上链失败，未写入任何存证：${err.message}`);
      }
    }));

    /** 存证类型分布饼图配置 */
    const pieOption = computed<EChartsOption>(() => ({
      tooltip: {
        trigger: 'item',
        formatter: '{b}：{c} 条（{d}%）'
      },
      legend: {
        bottom: 0,
        left: 'center',
        itemWidth: 12,
        itemHeight: 8
      },
      color: ['#13a05a', '#2f7ed8', '#f6a623', '#8b5cf6', '#ef5350', '#26c6da'],
      series: [{
        name: '存证类型分布',
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#ffffff',
          borderWidth: 2
        },
        label: {
          formatter: '{b}\n{c} 条',
          fontSize: 12
        },
        data: typeStats.value.map(item => ({
          name: item.name,
          value: item.value
        }))
      }]
    }));

    /** 最近存证记录列定义 */
    const recentColumns = computed<ColumnsType<RecentRow>>(() => [{
      title: '时间',
      dataIndex: 'time',
      width: 110
    }, {
      title: '类型',
      dataIndex: 'type',
      width: 110
    }, {
      title: '业务单号',
      dataIndex: 'summary'
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => status === 'SUCCESS' ? <Tag color="success" icon={<CheckCircleFilled />}>
            已存证（模拟）
          </Tag> : status === 'PENDING' ? <Tag color="processing" icon={<ClockCircleOutlined />}>
            上链中
          </Tag> : <Tag color="error">失败</Tag>
    }]);
    const overviewError = computed(() => overviewQuery.isError);
    const recordsError = computed(() => recordsQuery.isError);
    return () => {
      return <PageContainer class="production-list-dense" title="存证中心" subTitle="模拟存证台账与核验（未接入真实第三方链，仅用于核对库内记录）">
      <div class="production-dense-summary" aria-busy={overviewQuery.isLoading && !overviewQuery.data}>
        <div class="production-dense-summary-items">
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">存证总数</span>
            <span class="production-dense-metric-value is-success">{overviewError.value ? '—' : total.value} 条</span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">存证成功</span>
            <span class="production-dense-metric-value is-success">{overviewError.value ? '—' : success.value} 条</span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">上链失败</span>
            <span class={`production-dense-metric-value ${failed.value > 0 ? 'is-danger' : ''}`}>
              {overviewError.value ? '—' : failed.value} 条
            </span>
          </span>
          <Tooltip title="按 total − success − failed 推导">
            <span class="production-dense-metric">
              <span class="production-dense-metric-label">未成功（含上链中）</span>
              <span class="production-dense-metric-value">{overviewError.value ? '—' : notSuccess.value} 条</span>
            </span>
          </Tooltip>
        </div>
        <Tooltip title="当前使用模拟存证，未接入真实区块链；本地存证与核验只用于核对库内记录，不能证明第三方链上真实性，也不代替质量检测结论。自动上链及定时批量上链尚未提供。">
          <span class="production-dense-metric-chip">
            模拟存证 · 仅核对库内记录
          </span>
        </Tooltip>
      </div>

      {overviewError.value && <Alert type="error" showIcon style={{
          marginBottom: 10
        }} message="存证总览接口调用失败，未取得任何统计数据" description={overviewQuery.error ? describeError(overviewQuery.error) : '请检查后端服务 /api/v1/production/blockchain/overview'} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void overviewQuery.refetch()}>
              重试
            </Button>} />}

      {recordsError.value && <Alert type="error" showIcon style={{
          marginBottom: 10
        }} message="存证记录接口调用失败，类型分布与最近存证无法统计" description={recordsQuery.error ? describeError(recordsQuery.error) : '请检查后端服务 /api/v1/production/blockchain/records'} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void recordsQuery.refetch()}>
              重试
            </Button>} />}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={15}>
          <Card title={<span class="production-dense-card-title">
                <span class="production-dense-card-title-text">最近存证记录</span>
                <span class="production-dense-summary-note">
                  按上链时间倒序取前 5 条 · 样本 {scannedCount.value} / {backendTotal.value} 条
                </span>
              </span>} loading={recordsQuery.isLoading && !recordsQuery.data} extra={<Button type="link" size="small" onClick={() => navigate('/production/blockchain/records')}>
                查看全部 <ArrowRightOutlined />
              </Button>}>
            <div class="production-dense-toolbar">
              <div class="production-dense-toolbar-left">
                <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setAnchorOpen(true)}>
                  手动上链
                </Button>
                <Button icon={<LinkOutlined />} onClick={() => navigate('/production/blockchain/verify')}>
                  进入存证验证
                </Button>
                <Button onClick={() => navigate('/production/blockchain/records')}>
                  存证记录列表
                </Button>
              </div>
              <div class="production-dense-toolbar-right">
                <Button icon={<ReloadOutlined />} onClick={() => {
                    void overviewQuery.refetch();
                    void recordsQuery.refetch();
                  }}>
                  刷新
                </Button>
              </div>
            </div>
            <Table rowKey={row => `${row.time}-${row.summary}`} size="small" pagination={false} columns={recentColumns.value} dataSource={recentRows.value} locale={{
                emptyText: '后端暂无存证记录'
              }} />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="存证类型分布" loading={recordsQuery.isLoading && !recordsQuery.data} extra={<Tooltip title={`按 target_type 分组统计（单次最多取 ${STAT_SCAN_SIZE} 条，后端共 ${backendTotal.value} 条）`}>
                <Typography.Text type="secondary" style={{
                fontSize: 12
              }}>
                  样本 N={scannedCount.value}
                </Typography.Text>
              </Tooltip>}>
            {typeStats.value.length > 0 ? <ReactECharts option={pieOption.value} style={{
                height: 280
              }} notMerge /> : <Empty description={recordsError.value ? '接口调用失败，无法统计类型分布' : '后端暂无存证记录，无法统计类型分布'} />}
          </Card>
        </Col>
      </Row>

      <Modal class="production-form-dialog" title="手动上链" open={anchorOpen.value} onCancel={() => setAnchorOpen(false)} onOk={() => anchorForm.submit()} confirmLoading={anchorMutation.isPending} okText="提交上链" cancelText="取消" destroyOnClose>
        <Form form={anchorForm} layout="vertical" preserve={false} onFinish={values => anchorMutation.mutate(values)}>
          <Form.Item name="bizType" label="业务类型" rules={[{
              required: true,
              message: '请选择业务类型'
            }]}>
            <Select options={BIZ_TYPE_OPTIONS} placeholder="请选择业务类型" />
          </Form.Item>
          <Form.Item name="bizNo" label="业务单号" extra="服务端会按当前经营主体核对这条业务是否真实存在（批次号 / 质检单号 / 溯源码 / 投入品使用记录 ID），不存在或不属于本主体会被拒绝" rules={[{
              required: true,
              message: '请输入业务单号'
            }]}>
            <Input placeholder="如 H20260601 / QC-DEMO-003 / AG010101202606010001 / 102" />
          </Form.Item>
          <Form.Item name="bizSummary" label="数据摘要">
            <Input.TextArea rows={3} placeholder="如 番茄农残检测INS0531" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default BlockchainOverview;
