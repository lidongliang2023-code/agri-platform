import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Button, Form, Input, Modal, Radio, Select, Space, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { arbitrateDispute, getAdminDisputePage, mediateDispute } from '@/api/admin';
import { TradeFilters, TradeList } from '@/components/TradeList';
import { getCurrentUser } from '@/utils/session';
interface DisputeRow {
  id: number;
  disputeNo: string;
  orderId: number;
  complainantName: string;
  respondentName: string;
  disputeType: string;
  claimAmount: number;
  disputeReason: string;
  disputeStatus: string;
  processStage: string;
  mediator: string;
  mediationResult: string;
  arbitrator: string;
  arbitrationResult: string;
  createTime: string;
}
const STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  pending: {
    text: '待受理',
    color: 'warning'
  },
  processing: {
    text: '处理中',
    color: 'processing'
  },
  resolved: {
    text: '已解决',
    color: 'success'
  },
  closed: {
    text: '已关闭',
    color: 'default'
  }
};
const STAGE: Record<string, string> = {
  complain: '申请中',
  mediation: '调解中',
  arbitration: '仲裁中',
  resolved: '已了结',
  closed: '已关闭'
};
const DISPUTE_TYPE: Record<string, string> = {
  quality: '质量不符',
  delay: '交付延误',
  delivery: '交付延误',
  quantity: '数量短缺',
  price: '价格争议',
  payment: '货款结算',
  other: '其他'
};

/**
 * 纠纷仲裁（运营端）。
 */
const AdminDispute = defineComponent({
  name: "AdminDispute",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<DisputeRow[]>([]);
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
    const status = shallowRef('open');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draftStatus = shallowRef('open');
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const current = shallowRef<DisputeRow | null>(null);
    const setCurrent = (next: typeof current.value | ((previous: typeof current.value) => typeof current.value)) => {
      current.value = typeof next === 'function' ? (next as (previous: typeof current.value) => typeof current.value)(current.value) : next;
    };
    const form = Form.useForm();
    const load = () => {
      setLoading(true);
      getAdminDisputePage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        disputeStatus: status.value || undefined,
        keyword: keyword.value || undefined
      }).then((res: {
        code: number;
        data?: {
          records?: DisputeRow[];
          total?: number;
        };
        message?: string;
      }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? []);
          setTotal(res.data?.total ?? 0);
        } else {
          message.error(res?.message ?? '加载纠纷失败');
        }
      }).catch(() => message.error('加载纠纷失败（检查后端是否在运行）')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, status.value, keyword.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const handleQuery = () => {
      setPageNum(1);
      setStatus(draftStatus.value);
      setKeyword(draftKeyword.value.trim());
    };
    const handleReset = () => {
      setDraftStatus('open');
      setDraftKeyword('');
      setPageNum(1);
      setStatus('open');
      setKeyword('');
    };
    const submit = async (values: {
      mode: string;
      result: string;
    }) => {
      if (!current.value) return;
      const handler = getCurrentUser()?.nickname ?? getCurrentUser()?.username ?? '运营';
      const res = values.mode === 'mediation' ? await mediateDispute(current.value.id, handler, values.result) : await arbitrateDispute(current.value.id, handler, values.result);
      if (res?.code === 200) {
        message.success(values.mode === 'mediation' ? '调解意见已记录' : '仲裁结果已生效');
        setCurrent(null);
        form.resetFields();
        load();
      } else {
        message.error(res?.message ?? '处理失败');
      }
    };
    return () => {
      const view_current = current.value;
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-dispute" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>纠纷仲裁（共 {total.value} 件）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '纠纷状态',
          control: <Select value={draftStatus.value} onChange={value => {
            setDraftStatus(value);
            setPageNum(1);
            setStatus(value);
          }} options={[{
            value: 'open',
            label: '未结（待受理+处理中）'
          }, {
            value: 'processing',
            label: '处理中'
          }, {
            value: 'pending',
            label: '待受理'
          }, {
            value: 'resolved',
            label: '已解决'
          }, {
            value: '',
            label: '全部状态'
          }]} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="纠纷单号 / 申请人 / 被申请人" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
          }
        }} columns={[{
          title: '纠纷单号',
          dataIndex: 'disputeNo',
          width: 160,
          ellipsis: true
        }, {
          title: '申请人',
          dataIndex: 'complainantName',
          width: 150,
          ellipsis: true
        }, {
          title: '被申请人',
          dataIndex: 'respondentName',
          width: 150,
          ellipsis: true
        }, {
          title: '类型',
          dataIndex: 'disputeType',
          width: 100,
          render: (val: string) => val ? DISPUTE_TYPE[val] ?? val : '—'
        }, {
          title: '索赔金额',
          dataIndex: 'claimAmount',
          width: 120,
          render: (val: number) => `¥${val}`
        }, {
          title: '纠纷事由',
          dataIndex: 'disputeReason',
          width: 240,
          ellipsis: true,
          render: (val: string) => val || '—'
        }, {
          title: '状态',
          dataIndex: 'disputeStatus',
          width: 104,
          render: (val: string) => {
            const tag = STATUS[val] ?? {
              text: val,
              color: 'default'
            };
            return <Tag color={tag.color}>{tag.text}</Tag>;
          }
        }, {
          title: '当前阶段',
          dataIndex: 'processStage',
          width: 110,
          render: (val: string) => STAGE[val] ?? val ?? '—'
        }, {
          title: '处理记录',
          key: 'handleRecord',
          width: 240,
          ellipsis: true,
          render: (_: unknown, row: DisputeRow) => [row.mediator && `调解:${row.mediator}/${row.mediationResult ?? ''}`, row.arbitrator && `仲裁:${row.arbitrator}/${row.arbitrationResult ?? ''}`].filter(Boolean).join('　') || '—'
        }, {
          title: '发起时间',
          dataIndex: 'createTime',
          width: 170
        }, {
          title: '操作',
          key: 'action',
          width: 110,
          render: (_: unknown, row: DisputeRow) => row.disputeStatus === 'resolved' || row.disputeStatus === 'closed' ? <span style={{
            color: '#a0aec0'
          }}>已结案</span> : <ListRowActions>
                  <Button type="link" size="small" onClick={() => {
              setCurrent(row);
              form.setFieldsValue({
                mode: row.processStage === 'arbitration' ? 'arbitration' : 'mediation',
                result: undefined
              });
            }}>
                    处理
                  </Button>
                </ListRowActions>
        }]} />

      <Modal open={Boolean(view_current)} title={`处理纠纷：${view_current?.disputeNo ?? ''}`} onCancel={() => setCurrent(null)} onOk={() => form.submit()} okText="提交处理结果">
        {view_current && <Space direction="vertical" style={{
            width: '100%'
          }}>
            <div style={{
              color: '#4a5568'
            }}>{view_current.disputeReason}</div>
            <Form form={form} layout="vertical" onFinish={submit}>
              <Form.Item label="处理方式" name="mode" rules={[{
                required: true,
                message: '请选择处理方式'
              }]}>
                <Radio.Group options={[{
                  value: 'mediation',
                  label: '调解'
                }, {
                  value: 'arbitration',
                  label: '仲裁'
                }]} />
              </Form.Item>
              <Form.Item label="处理结果" name="result" rules={[{
                required: true,
                message: '请选择处理结果'
              }]}>
                <Select placeholder="调解选「达成一致」会结案；其余结果转入仲裁" options={[{
                  value: 'agreed',
                  label: '调解：双方达成一致（结案）'
                }, {
                  value: 'failed',
                  label: '调解：未达成一致（转仲裁）'
                }, {
                  value: 'uphold',
                  label: '仲裁：支持申请人'
                }, {
                  value: 'reject',
                  label: '仲裁：驳回申请'
                }, {
                  value: 'partial',
                  label: '仲裁：部分支持'
                }]} />
              </Form.Item>
            </Form>
          </Space>}
      </Modal>
    </div>;
    };
  }
});
export default AdminDispute;
