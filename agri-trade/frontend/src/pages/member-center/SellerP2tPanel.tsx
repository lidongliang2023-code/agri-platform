import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 卖家中心 · 产销对接（承接侧）
 */

import { Alert, Button, Input, InputNumber, Modal, Select, Space, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { claimOffer, getClaimablePool, getMyClaimedProducts, updateClaimedPrice } from '@/api/seller-p2t';
import type { ClaimableOffer, MyClaimedProduct, SellerBinding } from '@/api/seller-p2t';
import { TradeFilters, TradeList } from '@/components/TradeList';
interface Props {
  merchants: SellerBinding[];
  preferredMerchantId?: string | null;
}
const remainingOf = (row: ClaimableOffer): number => {
  const available = Number(row.availableQty ?? 0);
  const reserved = Number(row.reservedQty ?? 0);
  return Math.max(available - reserved, 0);
};
const SellerP2tPanel = defineComponent({
  name: "SellerP2tPanel",
  props: {
    merchants: null as unknown as PropType<{
      merchants: SellerBinding[];
      preferredMerchantId?: string | null;
    }["merchants"]>,
    preferredMerchantId: null as unknown as PropType<{
      merchants: SellerBinding[];
      preferredMerchantId?: string | null;
    }["preferredMerchantId"]>
  },
  setup(__props: {
    merchants: SellerBinding[];
    preferredMerchantId?: string | null;
  }, {
    slots: __slots
  }) {
    const rows = shallowRef<ClaimableOffer[]>([]);
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
    const notice = shallowRef('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const pageNum = shallowRef(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const mine = shallowRef<MyClaimedProduct[]>([]);
    const setMine = (next: typeof mine.value | ((previous: typeof mine.value) => typeof mine.value)) => {
      mine.value = typeof next === 'function' ? (next as (previous: typeof mine.value) => typeof mine.value)(mine.value) : next;
    };
    const mineTotal = shallowRef(0);
    const setMineTotal = (next: typeof mineTotal.value | ((previous: typeof mineTotal.value) => typeof mineTotal.value)) => {
      mineTotal.value = typeof next === 'function' ? (next as (previous: typeof mineTotal.value) => typeof mineTotal.value)(mineTotal.value) : next;
    };
    const mineLoading = shallowRef(false);
    const setMineLoading = (next: typeof mineLoading.value | ((previous: typeof mineLoading.value) => typeof mineLoading.value)) => {
      mineLoading.value = typeof next === 'function' ? (next as (previous: typeof mineLoading.value) => typeof mineLoading.value)(mineLoading.value) : next;
    };
    const claiming = shallowRef<ClaimableOffer | null>(null);
    const setClaiming = (next: typeof claiming.value | ((previous: typeof claiming.value) => typeof claiming.value)) => {
      claiming.value = typeof next === 'function' ? (next as (previous: typeof claiming.value) => typeof claiming.value)(claiming.value) : next;
    };
    const sellerId = shallowRef<string | undefined | undefined>(undefined);
    const setSellerId = (next: typeof sellerId.value | ((previous: typeof sellerId.value) => typeof sellerId.value)) => {
      sellerId.value = typeof next === 'function' ? (next as (previous: typeof sellerId.value) => typeof sellerId.value)(sellerId.value) : next;
    };
    const listedQty = shallowRef<number>(0);
    const setListedQty = (next: typeof listedQty.value | ((previous: typeof listedQty.value) => typeof listedQty.value)) => {
      listedQty.value = typeof next === 'function' ? (next as (previous: typeof listedQty.value) => typeof listedQty.value)(listedQty.value) : next;
    };
    const price = shallowRef<number>(0);
    const setPrice = (next: typeof price.value | ((previous: typeof price.value) => typeof price.value)) => {
      price.value = typeof next === 'function' ? (next as (previous: typeof price.value) => typeof price.value)(price.value) : next;
    };
    const submitting = shallowRef(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const editingPrice = shallowRef<Record<number, number>>({});
    const setEditingPrice = (next: typeof editingPrice.value | ((previous: typeof editingPrice.value) => typeof editingPrice.value)) => {
      editingPrice.value = typeof next === 'function' ? (next as (previous: typeof editingPrice.value) => typeof editingPrice.value)(editingPrice.value) : next;
    };
    const load = () => {
      setLoading(true);
      getClaimablePool({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined
      }).then(res => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? []);
          setTotal(res.data?.total ?? 0);
          setNotice('');
        } else {
          setRows([]);
          setTotal(0);
          setNotice(res?.message ?? '供给意向取不到，请稍后重试');
        }
      }).catch(() => {
        setRows([]);
        setNotice('产销对接通道不可达（生产域或交易域未响应），不是"没有可承接的货"');
      }).finally(() => setLoading(false));
    };
    const loadMine = () => {
      setMineLoading(true);
      getMyClaimedProducts({
        pageNum: 1,
        pageSize: 50
      }).then(res => {
        if (res?.code === 200) {
          setMine(res.data?.records ?? []);
          setMineTotal(res.data?.total ?? 0);
          if (res.data?.reason) setNotice(res.data.reason);
        }
      }).catch(() => setMine([])).finally(() => setMineLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, keyword.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [loadMine], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          loadMine();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const merchantOptions = computed(() => __props.merchants.map(item => ({
      value: String(item.merchantId),
      label: `${item.merchantName ?? '未命名主体'}${item.roleInMerchant ? `（${item.roleInMerchant}）` : ''}`
    })));
    const openClaim = (row: ClaimableOffer): void => {
      setClaiming(row);
      setSellerId(__props.preferredMerchantId ? String(__props.preferredMerchantId) : merchantOptions.value[0]?.value ?? undefined);
      setListedQty(remainingOf(row));
      setPrice(0);
    };
    const submitClaim = async (): Promise<void> => {
      if (!claiming.value) return;
      if (!sellerId.value) {
        message.warning('请选择以哪个主体承接');
        return;
      }
      if (!price.value || price.value <= 0) {
        message.warning('请填写挂牌价（大于 0）');
        return;
      }
      setSubmitting(true);
      try {
        const res = await claimOffer(claiming.value.offerNo, {
          sellerId: sellerId.value,
          listedQty: listedQty.value || undefined,
          price: price.value
        });
        if (res?.code === 200) {
          message.success(`已承接并由本主体建品：${res.data?.productCode ?? ''}`);
          setClaiming(null);
          load();
          loadMine();
        } else {
          message.error(res?.message ?? '承接失败');
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : '承接失败');
      } finally {
        setSubmitting(false);
      }
    };
    const savePrice = async (product: MyClaimedProduct): Promise<void> => {
      const next = editingPrice.value[product.id];
      if (next == null || next <= 0) {
        message.warning('请填写新的挂牌价');
        return;
      }
      const res = await updateClaimedPrice(product.id, next);
      if (res?.code === 200) {
        message.success('挂牌价已更新');
        setEditingPrice(prev => {
          const copy = {
            ...prev
          };
          delete copy[product.id];
          return copy;
        });
        loadMine();
      } else {
        message.error(res?.message ?? '改价失败');
      }
    };
    return () => {
      const view_claiming = claiming.value;
      return <div style={{
        display: 'grid',
        gap: 16
      }}>
      {notice.value && <Alert type="warning" showIcon message={notice.value} />}

      <TradeList listId="seller-p2t-pool" rowKey="offerNo" loading={loading.value} dataSource={rows.value} onRefresh={() => {
          load();
          loadMine();
        }} toolbarLeft={<span style={{
          fontWeight: 600
        }}>可承接的供给意向（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={() => {
          setPageNum(1);
          setKeyword(draftKeyword.value.trim());
        }} onReset={() => {
          setDraftKeyword('');
          setKeyword('');
          setPageNum(1);
        }} fields={[{
          label: '关键字',
          wide: true,
          control: <Input allowClear value={draftKeyword.value} placeholder="供给单号 / 批次 / 作物" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={() => {
            setPageNum(1);
            setKeyword(draftKeyword.value.trim());
          }} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size ?? 20);
          }
        }} columns={[{
          title: '供给单号',
          dataIndex: 'offerNo',
          width: 165,
          ellipsis: true
        }, {
          title: '作物 / 品种',
          key: 'cropVariety',
          width: 160,
          ellipsis: true,
          render: (_, row) => `${row.cropName ?? '未填作物'}${row.varietyName ? ` · ${row.varietyName}` : ''}`
        }, {
          title: '采收批次',
          dataIndex: 'batchNo',
          width: 130,
          ellipsis: true
        }, {
          title: '货源主体 / 产区',
          key: 'origin',
          width: 190,
          ellipsis: true,
          render: (_, row) => `${row.farmName ?? '农场名未填'}${row.origin ? ` · ${row.origin}` : ''}`
        }, {
          title: '可供 / 已认购 / 剩余',
          key: 'qtyTriple',
          align: 'right',
          width: 175,
          render: (_, row) => `${row.availableQty ?? 0} / ${row.reservedQty ?? 0} / ${remainingOf(row)} ${row.unit ?? ''}`
        }, {
          title: '上市窗口',
          key: 'window',
          width: 175,
          render: (_, row) => row.windowStart ? `${row.windowStart} ~ ${row.windowEnd ?? ''}` : '未限定'
        }, {
          title: '承接状态',
          key: 'claimStatus',
          width: 150,
          render: (_, row) => row.claimedByMe ? <Tag color="green">已由我承接 {row.claimedProductCode ?? ''}</Tag> : row.claimed ? <Tag>他方已承接</Tag> : <Tag color="blue">可承接</Tag>
        }, {
          title: '操作',
          key: 'action',
          width: 104,
          render: (_, row) => <ListRowActions>
                <Button type="link" size="small" disabled={Boolean(row.claimedByMe || row.claimed)} onClick={() => openClaim(row)}>
                  {row.claimedByMe ? '已承接' : '承接'}
                </Button>
              </ListRowActions>
        }]} />

      <TradeList listId="seller-p2t-claimed" rowKey="id" size="small" loading={mineLoading.value} dataSource={mine.value} onRefresh={loadMine} toolbarLeft={<>
            <span style={{
            fontWeight: 600
          }}>我承接出来的商品（{mineTotal.value}）</span>
            <span style={{
            color: '#6b7c72',
            fontSize: 12
          }}>商品由承接方主体持有，改价只影响之后的新订单</span>
          </>} columns={[{
          title: '商品编号',
          dataIndex: 'productCode',
          width: 150,
          ellipsis: true
        }, {
          title: '商品名',
          dataIndex: 'productName',
          width: 180,
          ellipsis: true
        }, {
          title: '来源供给',
          dataIndex: 'sourceOfferNo',
          width: 150,
          ellipsis: true
        }, {
          title: '持有主体',
          dataIndex: 'sellerName',
          width: 160,
          ellipsis: true
        }, {
          title: '库存',
          dataIndex: 'stockQuantity',
          width: 96
        }, {
          title: '挂牌价',
          dataIndex: 'price',
          width: 104,
          render: v => `¥${v ?? 0}`
        }, {
          title: '改价',
          key: 'editPrice',
          width: 210,
          render: (_, row) => <Space.Compact>
                <InputNumber min={0.01} step={0.1} placeholder="新挂牌价" style={{
              width: 120
            }} value={editingPrice.value[row.id]} onChange={v => setEditingPrice(prev => ({
              ...prev,
              [row.id]: Number(v ?? 0)
            }))} />
                <Button onClick={() => savePrice(row)}>保存</Button>
              </Space.Compact>
        }]} />

      <Modal open={Boolean(view_claiming)} title={view_claiming ? `承接供给单 ${view_claiming.offerNo}` : ''} confirmLoading={submitting.value} onOk={submitClaim} onCancel={() => setClaiming(null)} okText="确认承接并建品">
        {view_claiming && <Space direction="vertical" style={{
            width: '100%'
          }} size={12}>
            <div>
              货源：{view_claiming.farmName ?? '农场名未填'} · {view_claiming.cropName ?? '未填作物'}
              {view_claiming.varietyName ? ` · ${view_claiming.varietyName}` : ''} · 批次 {view_claiming.batchNo ?? '未填'}
            </div>
            <div>剩余可上架 {remainingOf(view_claiming)} {view_claiming.unit ?? ''}，起订量 {view_claiming.minOrderQty ?? 0} {view_claiming.unit ?? ''}</div>
            <div>
              <span style={{
                marginRight: 8
              }}>承接主体</span>
              <Select style={{
                width: 280
              }} placeholder="选择以哪个主体承接" value={sellerId.value} options={merchantOptions.value} onChange={setSellerId} />
            </div>
            <div>
              <span style={{
                marginRight: 8
              }}>上架量</span>
              <InputNumber min={0} step={1} value={listedQty.value} onChange={v => setListedQty(Number(v ?? 0))} />
            </div>
            <div>
              <span style={{
                marginRight: 8
              }}>挂牌价</span>
              <InputNumber min={0.01} step={0.1} value={price.value} onChange={v => setPrice(Number(v ?? 0))} placeholder="必须填写" />
            </div>
            <Alert type="info" showIcon message="承接后商品归你选的这家主体所有（不再挂在农场名下），供给侧会看到「已被承接」与承接方名称。" />
          </Space>}
      </Modal>
    </div>;
    };
  }
});
export default SellerP2tPanel;
