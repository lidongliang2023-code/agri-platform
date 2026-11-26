import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Alert, Card, Col, Input, Row, Select, Statistic, Tag, message } from "@/vue/ui";
import { useQuery } from "@/vue/query";
import { getMyCompensations, type CompensationVO } from '@/api/compensation';
import { getMyMerchants } from '@/api/identity';
import { TradeFilters, TradeList } from '@/components/TradeList';
const STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  pending: {
    text: '待审核',
    color: 'warning'
  },
  approved: {
    text: '已核准待打款',
    color: 'processing'
  },
  rejected: {
    text: '已驳回',
    color: 'error'
  },
  paid: {
    text: '已到账',
    color: 'success'
  }
};
const TYPE: Record<string, string> = {
  delay: '交付延误',
  quality: '质量不符',
  quantity: '数量短缺',
  price: '价格争议',
  dispute: '纠纷裁定',
  other: '其他'
};

/**
 * 我的获赔（商家侧）。
 */
const MyCompensation = defineComponent({
  name: "MyCompensation",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<CompensationVO[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const status = shallowRef<string | undefined | undefined>(undefined);
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draftStatus = shallowRef<string | undefined | undefined>(undefined);
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const load = async () => {
      setLoading(true);
      try {
        const res = await getMyCompensations();
        if (res?.code === 200) {
          setRows(res.data ?? []);
        } else {
          message.error(res?.message ?? '加载获赔记录失败');
        }
      } catch {
        message.error('加载获赔记录失败（请检查后端是否在运行）');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [load], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const _query = useQuery(() => ({
      queryKey: ['my-merchants'],
      queryFn: getMyMerchants
    }));
    const merchants = computed(() => _query.data.value?.code === 200 ? _query.data.value.data ?? [] : null);
    const filteredRows = computed(() => {
      const kw = keyword.value.trim().toLowerCase();
      return rows.value.filter(r => (!status.value || r.compensationStatus === status.value) && (!kw || [r.compensationNo, r.orderNo, r.compensationReason, r.transactionId].some(v => String(v ?? '').toLowerCase().includes(kw))));
    });
    const totalPaid = computed(() => rows.value.filter(r => r.compensationStatus === 'paid').reduce((sum, r) => sum + Number(r.compensationAmount ?? 0), 0));
    const openCount = computed(() => rows.value.filter(r => r.compensationStatus === 'pending' || r.compensationStatus === 'approved').length);
    return () => {
      return <div style={{
        display: 'grid',
        gap: 16
      }}>
      {merchants.value?.length === 0 && <Alert type="warning" showIcon message="当前账号还没有绑定经营主体" description="因此看不到任何获赔记录。请运营在「用户-主体绑定」里为你绑定经营主体后重试。" />}

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="已到账赔付" value={totalPaid.value} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="在办赔付（待审 + 待打款）" value={openCount.value} suffix="笔" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="赔付单总数" value={rows.value.length} suffix="笔" />
          </Card>
        </Col>
      </Row>

      <TradeList listId="member-compensation" rowKey="id" loading={loading.value} dataSource={filteredRows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>我的获赔（共 {filteredRows.value.length} 笔）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={() => {
          setStatus(draftStatus.value);
          setKeyword(draftKeyword.value);
        }} onReset={() => {
          setDraftStatus(undefined);
          setDraftKeyword('');
          setStatus(undefined);
          setKeyword('');
        }} fields={[{
          label: '赔付状态',
          control: <Select allowClear value={draftStatus.value} placeholder="全部状态" onChange={setDraftStatus} options={Object.entries(STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="赔付单号 / 订单号 / 流水号" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={() => {
            setStatus(draftStatus.value);
            setKeyword(draftKeyword.value);
          }} />
        }]} />} columns={[{
          title: '赔付单号',
          dataIndex: 'compensationNo',
          width: 180,
          ellipsis: true
        }, {
          title: '关联订单',
          dataIndex: 'orderNo',
          width: 170,
          ellipsis: true,
          render: (v: string) => v ?? '—'
        }, {
          title: '赔付类型',
          dataIndex: 'compensationType',
          width: 120,
          render: (v: string) => v ? TYPE[v] ?? v : '—'
        }, {
          title: '赔付金额',
          dataIndex: 'compensationAmount',
          width: 140,
          render: (v: number) => v == null ? '—' : `¥${v}`
        }, {
          title: '状态',
          dataIndex: 'compensationStatus',
          width: 130,
          render: (v: string) => {
            const hit = STATUS[v] ?? {
              text: v,
              color: 'default'
            };
            return <Tag color={hit.color}>{hit.text}</Tag>;
          }
        }, {
          title: '赔付事由',
          dataIndex: 'compensationReason',
          width: 220,
          ellipsis: true,
          render: (v: string) => v ?? '—'
        }, {
          title: '到账时间',
          dataIndex: 'payTime',
          width: 170,
          render: (v: string) => v ?? '—'
        }, {
          title: '打款流水号',
          dataIndex: 'transactionId',
          width: 220,
          ellipsis: true,
          render: (v: string) => v ?? '—'
        }, {
          title: '发起时间',
          dataIndex: 'createTime',
          width: 170
        }]} />
    </div>;
    };
  }
});
export default MyCompensation;
