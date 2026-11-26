import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Button, InputNumber, Tag, Modal, Descriptions, message, Progress, Tabs } from "@/vue/ui";
import { SyncOutlined } from "@ant-design/icons-vue";
import { ListRowActions } from "@/vue/shared";
import { matchDemandToProducts, getMatchList, MatchResult, MatchRecordVO } from '@/api/match';
import { TradeFilters, TradeList } from '@/components/TradeList';
const statusMap: Record<string, {
  color: string;
  text: string;
}> = {
  pending: {
    color: 'warning',
    text: '待处理'
  },
  matched: {
    color: 'processing',
    text: '已匹配'
  },
  accepted: {
    color: 'success',
    text: '已接受'
  },
  rejected: {
    color: 'error',
    text: '已拒绝'
  }
};
const MatchList = defineComponent({
  name: "MatchList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const demandId = shallowRef<number | undefined>(undefined);
    const setDemandId = (next: typeof demandId.value | ((previous: typeof demandId.value) => typeof demandId.value)) => {
      demandId.value = typeof next === 'function' ? (next as (previous: typeof demandId.value) => typeof demandId.value)(demandId.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const matchResults = shallowRef<MatchResult[]>([]);
    const setMatchResults = (next: typeof matchResults.value | ((previous: typeof matchResults.value) => typeof matchResults.value)) => {
      matchResults.value = typeof next === 'function' ? (next as (previous: typeof matchResults.value) => typeof matchResults.value)(matchResults.value) : next;
    };
    const detailVisible = shallowRef(false);
    const setDetailVisible = (next: typeof detailVisible.value | ((previous: typeof detailVisible.value) => typeof detailVisible.value)) => {
      detailVisible.value = typeof next === 'function' ? (next as (previous: typeof detailVisible.value) => typeof detailVisible.value)(detailVisible.value) : next;
    };
    const currentRecord = shallowRef<MatchResult | null>(null);
    const setCurrentRecord = (next: typeof currentRecord.value | ((previous: typeof currentRecord.value) => typeof currentRecord.value)) => {
      currentRecord.value = typeof next === 'function' ? (next as (previous: typeof currentRecord.value) => typeof currentRecord.value)(currentRecord.value) : next;
    };
    const historyRows = shallowRef<MatchRecordVO[]>([]);
    const setHistoryRows = (next: typeof historyRows.value | ((previous: typeof historyRows.value) => typeof historyRows.value)) => {
      historyRows.value = typeof next === 'function' ? (next as (previous: typeof historyRows.value) => typeof historyRows.value)(historyRows.value) : next;
    };
    const historyLoading = shallowRef(false);
    const setHistoryLoading = (next: typeof historyLoading.value | ((previous: typeof historyLoading.value) => typeof historyLoading.value)) => {
      historyLoading.value = typeof next === 'function' ? (next as (previous: typeof historyLoading.value) => typeof historyLoading.value)(historyLoading.value) : next;
    };
    const historyShown = shallowRef(false);
    const setHistoryShown = (next: typeof historyShown.value | ((previous: typeof historyShown.value) => typeof historyShown.value)) => {
      historyShown.value = typeof next === 'function' ? (next as (previous: typeof historyShown.value) => typeof historyShown.value)(historyShown.value) : next;
    };
    const handleMatch = async () => {
      if (!demandId.value) {
        message.warning('请输入需求ID');
        return;
      }
      setLoading(true);
      try {
        const res = await matchDemandToProducts(demandId.value, 10);
        if (res.code === 200) {
          setMatchResults(res.data || []);
          message.success('匹配成功');
        } else {
          message.error(res.message || '匹配失败');
        }
      } catch {
        message.error('匹配失败');
      } finally {
        setLoading(false);
      }
    };
    const handleViewRecords = async () => {
      setHistoryLoading(true);
      try {
        const res = await getMatchList({
          pageNum: 1,
          pageSize: 20,
          demandId: demandId.value
        });
        if (res.code === 200) {
          setHistoryRows(res.data?.records || []);
          setHistoryShown(true);
          if (!res.data?.total) {
            message.info('没有查到与你相关的撮合记录');
          }
        } else {
          message.error(res.message || '获取记录失败');
        }
      } catch {
        message.error('获取记录失败');
      } finally {
        setHistoryLoading(false);
      }
    };
    const showDetail = (record: MatchResult) => {
      setCurrentRecord(record);
      setDetailVisible(true);
    };
    const columns = computed(() => [{
      title: '匹配编号',
      dataIndex: 'matchNo',
      key: 'matchNo',
      width: 150,
      ellipsis: true
    }, {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      width: 180,
      ellipsis: true
    }, {
      title: '供应商',
      dataIndex: 'sellerName',
      key: 'sellerName',
      width: 160,
      ellipsis: true
    }, {
      title: '匹配分数',
      dataIndex: 'matchScore',
      key: 'matchScore',
      width: 150,
      render: (score: number) => <Progress percent={score} size="small" status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'} format={percent => `${percent?.toFixed(1)}分`} />
    }, {
      title: '状态',
      dataIndex: 'matchStatus',
      key: 'matchStatus',
      width: 104,
      render: (status: string) => {
        const {
          color,
          text
        } = statusMap[status] || {
          color: 'default',
          text: status
        };
        return <Tag color={color}>{text}</Tag>;
      }
    }, {
      title: '匹配原因',
      dataIndex: 'matchReason',
      key: 'matchReason',
      width: 220,
      ellipsis: true
    }, {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 170
    }, {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: MatchResult) => <ListRowActions>
          <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
        </ListRowActions>
    }]);
    const scoreColumns = computed(() => [{
      title: '品类评分',
      dataIndex: 'categoryScore',
      key: 'categoryScore',
      width: 110,
      render: (v: number) => `${v}分`
    }, {
      title: '价格评分',
      dataIndex: 'priceScore',
      key: 'priceScore',
      width: 110,
      render: (v: number) => `${v}分`
    }, {
      title: '距离评分',
      dataIndex: 'distanceScore',
      key: 'distanceScore',
      width: 110,
      render: (v: number) => `${v}分`
    }, {
      title: '质量评分',
      dataIndex: 'qualityScore',
      key: 'qualityScore',
      width: 110,
      render: (v: number) => `${v}分`
    }]);
    const filterBar = computed(() => <TradeFilters loading={loading.value} queryText="开始匹配" onQuery={() => void handleMatch()} onReset={() => {
      setDemandId(undefined);
      setMatchResults([]);
    }} fields={[{
      label: '需求 ID',
      control: <InputNumber placeholder="请输入需求 ID" value={demandId.value} onChange={v => setDemandId(v || undefined)} style={{
        width: '100%'
      }} />
    }]} />);
    return () => {
      const view_currentRecord = currentRecord.value;
      return <div style={{
        display: 'grid',
        gap: 16
      }}>
      <div class="agri-list-filter-card">{filterBar.value}</div>

      <Tabs items={[{
          key: 'list',
          label: '列表视图',
          children: <TradeList listId="member-match-results" columns={columns.value} dataSource={matchResults.value} rowKey="id" loading={loading.value} onRefresh={() => void handleMatch()} toolbarLeft={<Button icon={<SyncOutlined />} loading={historyLoading.value} onClick={() => void handleViewRecords()}>
                    查看历史记录
                  </Button>} />
        }, {
          key: 'score',
          label: '评分详情',
          children: <TradeList listId="member-match-scores" columns={[{
            title: '产品名称',
            dataIndex: 'productName',
            key: 'productName',
            width: 200,
            ellipsis: true
          }, ...scoreColumns.value, {
            title: '综合评分',
            dataIndex: 'matchScore',
            key: 'matchScore',
            width: 110,
            render: (v: number) => <strong>{v}分</strong>
          }]} dataSource={matchResults.value} rowKey="id" loading={loading.value} onRefresh={() => void handleMatch()} toolbarLeft={<Button icon={<SyncOutlined />} loading={historyLoading.value} onClick={() => void handleViewRecords()}>
                    查看历史记录
                  </Button>} />
        }]} />

      {historyShown.value && <TradeList listId="member-match-history" rowKey="id" loading={historyLoading.value} dataSource={historyRows.value} onRefresh={() => void handleViewRecords()} toolbarLeft={<>
              <span style={{
            fontWeight: 600
          }}>撮合历史记录（{historyRows.value.length} 条）</span>
              <span style={{
            color: '#6b7c72',
            fontSize: 12
          }}>范围：与我发布的需求 / 货源相关的撮合</span>
            </>} columns={[{
          title: '匹配编号',
          dataIndex: 'matchNo',
          key: 'matchNo',
          width: 170,
          ellipsis: true
        }, {
          title: '采购需求',
          dataIndex: 'demandName',
          key: 'demandName',
          width: 160,
          ellipsis: true,
          render: (v: string, row: MatchRecordVO) => v ?? row.demandNo ?? row.demandId ?? '—'
        }, {
          title: '货源',
          dataIndex: 'productName',
          key: 'productName',
          width: 180,
          ellipsis: true,
          render: (v: string) => v ?? '—'
        }, {
          title: '供应商',
          dataIndex: 'sellerName',
          key: 'sellerName',
          width: 160,
          ellipsis: true,
          render: (v: string) => v ?? '—'
        }, {
          title: '撮合分数',
          dataIndex: 'matchScore',
          key: 'matchScore',
          width: 110,
          render: (v: number) => v == null ? '—' : `${v}分`
        }, {
          title: '询价状态',
          dataIndex: 'inquiryStatus',
          key: 'inquiryStatus',
          width: 110,
          render: (v: string) => <Tag>{v ?? '未询价'}</Tag>
        }, {
          title: '订单状态',
          dataIndex: 'orderStatus',
          key: 'orderStatus',
          width: 110,
          render: (v: string) => <Tag>{v ?? '未成单'}</Tag>
        }, {
          title: '匹配原因',
          dataIndex: 'matchReason',
          key: 'matchReason',
          width: 220,
          ellipsis: true
        }, {
          title: '生成时间',
          dataIndex: 'createTime',
          key: 'createTime',
          width: 170
        }]} />}

      <Modal title="匹配详情" open={detailVisible.value} onCancel={() => setDetailVisible(false)} footer={null} width={700}>
        {view_currentRecord && <Descriptions bordered column={2}>
            <Descriptions.Item label="匹配编号">{view_currentRecord.matchNo}</Descriptions.Item>
            <Descriptions.Item label="产品名称">{view_currentRecord.productName}</Descriptions.Item>
            <Descriptions.Item label="供应商">{view_currentRecord.sellerName}</Descriptions.Item>
            <Descriptions.Item label="综合评分">{view_currentRecord.matchScore}分</Descriptions.Item>
            <Descriptions.Item label="品类评分">{view_currentRecord.categoryScore}分</Descriptions.Item>
            <Descriptions.Item label="价格评分">{view_currentRecord.priceScore}分</Descriptions.Item>
            <Descriptions.Item label="距离评分">{view_currentRecord.distanceScore}分</Descriptions.Item>
            <Descriptions.Item label="质量评分">{view_currentRecord.qualityScore}分</Descriptions.Item>
            <Descriptions.Item label="匹配原因" span={2}>{view_currentRecord.matchReason}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{view_currentRecord.createTime}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[view_currentRecord.matchStatus]?.color}>
                {statusMap[view_currentRecord.matchStatus]?.text}
              </Tag>
            </Descriptions.Item>
          </Descriptions>}
      </Modal>
    </div>;
    };
  }
});
export default MatchList;
