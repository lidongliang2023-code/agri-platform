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
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, App, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography } from '@/vue/ui';
import { getYieldMarketBatches, getYieldMarketQuotes, syncYieldMarketQuotes } from '@/api/yield-forecast';
import type { MarketQuote } from '@/api/yield-forecast';
const YieldMarketPrices = defineComponent({
  name: "YieldMarketPrices",
  props: {
    crop: null as unknown as PropType<{
      crop: string;
      onSelect: (quote: MarketQuote) => void;
    }["crop"]>,
    onSelect: null as unknown as PropType<{
      crop: string;
      onSelect: (quote: MarketQuote) => void;
    }["onSelect"]>
  },
  setup(__props: {
    crop: string;
    onSelect: (quote: MarketQuote) => void;
  }, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const client = useQueryClient();
    const queryCrop = shallowRef('');
    const setQueryCrop = (next: typeof queryCrop.value | ((previous: typeof queryCrop.value) => typeof queryCrop.value)) => {
      queryCrop.value = typeof next === 'function' ? (next as (previous: typeof queryCrop.value) => typeof queryCrop.value)(queryCrop.value) : next;
    };
    const source = shallowRef('NX');
    const setSource = (next: typeof source.value | ((previous: typeof source.value) => typeof source.value)) => {
      source.value = typeof next === 'function' ? (next as (previous: typeof source.value) => typeof source.value)(source.value) : next;
    };
    const effectiveCrop = computed(() => __props.crop.trim() || queryCrop.value.trim());
    const prices = useQuery(() => ({
      queryKey: ['yield-market', effectiveCrop.value],
      queryFn: () => getYieldMarketQuotes(effectiveCrop.value),
      enabled: Boolean(effectiveCrop.value),
      retry: false
    }));
    const batches = useQuery(() => ({
      queryKey: ['yield-market-batches'],
      queryFn: getYieldMarketBatches,
      retry: false
    }));
    const sync = useMutation(() => ({
      mutationFn: () => syncYieldMarketQuotes(source.value),
      onSuccess: result => {
        void client.invalidateQueries({
          queryKey: ['yield-market']
        });
        void client.invalidateQueries({
          queryKey: ['yield-market-batches']
        });
        if (result.status === 'FAILED') message.error(result.error || '官方行情同步失败，旧报价保持不变');else message.success(result.duplicate ? '该报告已同步，未重复导入' : `${source.value === 'FUJIAN' ? '福建' : '宁夏'}官方行情已同步：${result.parsedCount ?? result.parsed_count ?? 0} 条`);
      },
      onError: (e: Error) => message.error(e.message)
    }));
    return () => {
      return <Card title="真实批发行情" extra={<Space><Select value={source.value} onChange={setSource} options={[{
          value: 'NX',
          label: '宁夏·石嘴山'
        }, {
          value: 'FUJIAN',
          label: '福建·省农业农村厅'
        }]} /><Button loading={sync.isPending} onClick={() => sync.mutate()}>同步官方报告</Button></Space>}>
    <Space direction="vertical" size={12} style={{
          width: '100%'
        }}>
      <Alert showIcon type="info" message="福建与宁夏官方批发行情" description="福建来源为福建省农业农村厅蔬菜批发市场周报，宁夏来源为石嘴山市百花批发市场报告。两者均为有日期的地方批发历史报价，不是全国价、地头收购价或未来预测价格；价格统一为元/kg，保留原单位；超过 7 天不可引用。同步限主体所有者操作，不创建订单。" />
      {!__props.crop.trim() && <Input.Search placeholder="查询作物，例如番茄、黄瓜、大白菜" onSearch={setQueryCrop} enterButton="查行情" />}
      {prices.isError && <Alert showIcon type="error" message={(prices.error as Error).message} />}
      <Table rowKey="id" size="small" loading={prices.isFetching} dataSource={prices.data?.quotes ?? []} pagination={{
            pageSize: 5,
            showTotal: total => `共 ${total} 条`,
            showQuickJumper: true,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100]
          }} scroll={{
            x: 950
          }} locale={{
            emptyText: <Empty description={effectiveCrop.value ? '暂无该作物真实行情，可同步官方报告；不会使用其他作物代替' : '填写作物后查询行情'} />
          }} columns={[{
            title: '作物 / 规格',
            render: (_, r) => `${r.sourceName} · ${r.specification}`
          }, {
            title: '报价日期',
            dataIndex: 'quoteDate'
          }, {
            title: '批发价（元/kg）',
            dataIndex: 'priceKg'
          }, {
            title: '原始报价',
            render: (_, r) => `${r.originalPrice} ${r.originalUnit}`
          }, {
            title: '市场 / 地区',
            render: (_, r) => `${r.market} · ${r.region}`
          }, {
            title: '来源',
            render: (_, r) => <Tag color={r.provider?.startsWith('FJ_') ? 'blue' : 'green'}>{r.provider?.startsWith('FJ_') ? '福建省农业农村厅' : '宁夏发改委'}</Tag>
          }, {
            title: '出处',
            render: (_, r) => <Typography.Link href={r.sourceUrl} target="_blank" rel="noopener noreferrer">官方报告</Typography.Link>
          }, {
            title: '操作',
            render: (_, r) => <Button size="small" disabled={r.stale || !__props.crop.trim()} onClick={() => __props.onSelect(r)}>{r.stale ? '已过期' : '引用此报价'}</Button>
          }]} />
      {batches.isError && <Typography.Text type="danger">同步记录暂不可读取：{(batches.error as Error).message}</Typography.Text>}
      {batches.data?.slice(0, 5).map(row => <Space key={String(row.id)} wrap><Tag color={row.status === 'SUCCESS' ? 'green' : 'red'}>{row.status === 'SUCCESS' ? '同步成功' : '同步失败'}</Tag><Tag>{String(row.provider ?? '—')}</Tag><Typography.Text type="secondary">{String(row.created_at)} · 报价日 {String(row.report_date ?? '—')} · {String(row.parsed_count)} 条{row.error_message ? ` · ${String(row.error_message)}` : ''}</Typography.Text></Space>)}
    </Space>
  </Card>;
    };
  }
});
export default YieldMarketPrices;
