import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 页面名称：差异与异常处置（交易视角）
 * 路由路径：/admin/trade/p2t/diffs
 * 所属模块：产销对接
 */

import { Button, Input, Modal, Select, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { getP2tDiffs, handleP2tDiff } from '@/api/p2t';
import type { P2tDiffRow } from '@/api/p2t';
import { TradeFilters, TradeList } from '@/components/TradeList';
const TYPE: Record<string, {
  text: string;
  color: string;
}> = {
  SHORT_SHIP: {
    text: '短装',
    color: 'red'
  },
  GRADE_DOWN: {
    text: '等级降级',
    color: 'orange'
  },
  WINDOW_EXPIRED: {
    text: '窗口过期',
    color: 'default'
  },
  OVERSELL: {
    text: '超卖',
    color: 'red'
  }
};
const P2tDiffs = defineComponent({
  name: "P2tDiffs",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<P2tDiffRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const total = shallowRef(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const pageNum = shallowRef(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const status = shallowRef<string | undefined | undefined>(undefined);
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const draftStatus = shallowRef<string | undefined | undefined>(undefined);
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const handling = shallowRef<P2tDiffRow | null>(null);
    const setHandling = (next: typeof handling.value | ((previous: typeof handling.value) => typeof handling.value)) => {
      handling.value = typeof next === 'function' ? (next as (previous: typeof handling.value) => typeof handling.value)(handling.value) : next;
    };
    const way = shallowRef('促销');
    const setWay = (next: typeof way.value | ((previous: typeof way.value) => typeof way.value)) => {
      way.value = typeof next === 'function' ? (next as (previous: typeof way.value) => typeof way.value)(way.value) : next;
    };
    const remark = shallowRef('');
    const setRemark = (next: typeof remark.value | ((previous: typeof remark.value) => typeof remark.value)) => {
      remark.value = typeof next === 'function' ? (next as (previous: typeof remark.value) => typeof remark.value)(remark.value) : next;
    };
    const load = (): void => {
      setLoading(true);
      getP2tDiffs({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        status: status.value
      }).then((res: {
        code: number;
        data?: {
          records?: P2tDiffRow[];
          total?: number;
        };
      }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? []);
          setTotal(Number(res.data?.total ?? res.data?.records?.length ?? 0));
        }
      }).catch(() => message.error('加载差异失败')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, status.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const submit = async (): Promise<void> => {
      if (!handling.value) return;
      if (!remark.value.trim()) {
        message.warning('处置说明必填');
        return;
      }
      const res = await handleP2tDiff(handling.value.id, {
        status: 'CLOSED',
        handleWay: way.value,
        remark: remark.value.trim()
      });
      if (res?.code === 200) {
        message.success('处置已提交');
        setHandling(null);
        setRemark('');
        load();
      } else {
        message.error(res?.message ?? '处置失败');
      }
    };
    return () => {
      const view_handling = handling.value;
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-p2t-diffs" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>差异工单（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={() => {
          setPageNum(1);
          setStatus(draftStatus.value);
        }} onReset={() => {
          setDraftStatus(undefined);
          setStatus(undefined);
          setPageNum(1);
        }} fields={[{
          label: '处置状态',
          control: <Select allowClear value={draftStatus.value} placeholder="全部状态" onChange={v => {
            setDraftStatus(v);
            setPageNum(1);
            setStatus(v);
          }} options={[{
            value: 'OPEN',
            label: '待处置'
          }, {
            value: 'PROCESSING',
            label: '处理中'
          }, {
            value: 'CLOSED',
            label: '已关闭'
          }]} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (p, s) => {
            setPageNum(p);
            setPageSize(s);
          }
        }} columns={[{
          title: '工单号',
          dataIndex: 'ticketNo',
          width: 170,
          ellipsis: true
        }, {
          title: '类型',
          dataIndex: 'diffType',
          width: 110,
          render: (v: string) => <Tag color={TYPE[v]?.color}>{TYPE[v]?.text ?? v}</Tag>
        }, {
          title: '供给单 / 订单',
          key: 'offerOrder',
          width: 190,
          render: (_, r) => <div>{r.offerNo ?? '—'}<div style={{
              fontSize: 12,
              color: '#888'
            }}>{r.orderNo ?? ''}</div></div>
        }, {
          title: '差异量',
          dataIndex: 'diffQty',
          width: 100
        }, {
          title: '责任方',
          dataIndex: 'ownerSide',
          width: 100,
          render: (v: string) => v === 'PRODUCTION' ? '生产' : '交易'
        }, {
          title: '状态',
          dataIndex: 'status',
          width: 104,
          render: (v: string) => <Tag color={v === 'CLOSED' ? 'green' : 'orange'}>{v}</Tag>
        }, {
          title: '处置说明',
          dataIndex: 'handleRemark',
          width: 220,
          ellipsis: true,
          render: (v: string) => v || '—'
        }, {
          title: '操作',
          key: 'action',
          width: 104,
          render: (_, r) => r.status === 'CLOSED' ? <span style={{
            color: '#a0aec0'
          }}>已关闭</span> : <ListRowActions>
                  <Button type="link" size="small" onClick={() => setHandling(r)}>处置</Button>
                </ListRowActions>
        }]} locale={{
          emptyText: '暂无差异工单'
        }} />

      <Modal open={!!view_handling} title={`处置差异 ${view_handling?.ticketNo ?? ''}`} onCancel={() => setHandling(null)} onOk={() => void submit()} okText="提交处置">
        <div style={{
            marginBottom: 12
          }}>处置方式
          <Select value={way.value} style={{
              width: '100%',
              marginTop: 6
            }} onChange={setWay} options={[{
              value: '促销',
              label: '交易侧发起促销建议'
            }, {
              value: '接受降价',
              label: '接受降价清货'
            }, {
              value: '转加工',
              label: '转加工 / 自销'
            }, {
              value: '冻结SPU',
              label: '超卖：冻结 SPU 并人工核查'
            }]} />
        </div>
        <Input.TextArea rows={3} value={remark.value} onChange={e => setRemark(e.target.value ?? '')} placeholder="处置说明（必填）" />
      </Modal>
    </div>;
    };
  }
});
export default P2tDiffs;
