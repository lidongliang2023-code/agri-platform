import './bindings-dense.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Alert, Button, Form, Input, Modal, Select, Tag, Tooltip, message } from "@/vue/ui";
import { InfoCircleOutlined, PlusOutlined } from "@ant-design/icons-vue";
import { ListRowActions } from "@/vue/shared";
import { changeBindingStatus, createBinding, getBindings, type BindingQuery, type UserMerchantBinding } from '@/api/admin-bindings';
import { TradeFilters, TradeList } from '@/components/TradeList';
const ROLES: Record<string, string> = {
  owner: '负责人',
  buyer: '采购',
  seller: '销售',
  finance: '财务'
};
const MERCHANT_TYPES: Record<string, string> = {
  BUYER: '采购方',
  SELLER: '供应方',
  BOTH: '购销一体'
};

/**
 * 用户-经营主体绑定（运营端）。
 */
const AdminBindings = defineComponent({
  name: "AdminBindings",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<UserMerchantBinding[]>([]);
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
    const query = shallowRef<BindingQuery>({
      pageNum: 1,
      pageSize: 20
    });
    const setQuery = (next: typeof query.value | ((previous: typeof query.value) => typeof query.value)) => {
      query.value = typeof next === 'function' ? (next as (previous: typeof query.value) => typeof query.value)(query.value) : next;
    };
    const filters = shallowRef<{
      userId?: string;
      merchantId?: string;
    }>({});
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const addOpen = shallowRef(false);
    const setAddOpen = (next: typeof addOpen.value | ((previous: typeof addOpen.value) => typeof addOpen.value)) => {
      addOpen.value = typeof next === 'function' ? (next as (previous: typeof addOpen.value) => typeof addOpen.value)(addOpen.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const form = Form.useForm<{userId:string;merchantId:string;roleInMerchant:string}>();
    const load = (next: BindingQuery) => {
      setLoading(true);
      getBindings(next).then((res: {
        code: number;
        message?: string;
        data?: {
          records?: UserMerchantBinding[];
          total?: number;
        };
      }) => {
        if (res?.code === 0) {
          setRows(res.data?.records ?? []);
          setTotal(Number(res.data?.total ?? 0));
        } else {
          message.error(res?.message ?? '加载绑定关系失败');
        }
      }).catch(() => message.error('加载绑定关系失败（请检查 core-platform 是否在运行）')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [query.value, load], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load(query.value);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const handleQuery = () => {
      setQuery(prev => ({
        ...prev,
        pageNum: 1,
        userId: filters.value.userId?.trim() || undefined,
        merchantId: filters.value.merchantId?.trim() || undefined
      }));
    };
    const handleReset = () => {
      setFilters({});
      setQuery(prev => ({
        pageNum: 1,
        pageSize: prev.pageSize
      }));
    };
    const submit = async () => {
      const values = await form.validateFields();
      setSaving(true);
      try {
        const res = await createBinding(values);
        if (res?.code === 0) {
          message.success('绑定已创建');
          setAddOpen(false);
          form.resetFields();
          load(query.value);
        } else {
          message.error(res?.message ?? '绑定失败');
        }
      } catch {
        message.error('绑定失败（请检查 core-platform 是否在运行）');
      } finally {
        setSaving(false);
      }
    };
    const toggleStatus = async (row: UserMerchantBinding) => {
      const next = row.status === 1 ? 0 : 1;
      try {
        const res = await changeBindingStatus(row.id, next);
        if (res?.code === 0) {
          message.success(next === 1 ? '已启用' : '已停用');
          load(query.value);
        } else {
          message.error(res?.message ?? '操作失败');
        }
      } catch {
        message.error('操作失败（请检查 core-platform 是否在运行）');
      }
    };
    return () => {
      return <div class="trade-bindings-dense" style={{
        padding: 20
      }}>
      <TradeList listId="admin-bindings" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={() => load(query.value)} toolbarLeft={<>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.setFieldsValue({
              roleInMerchant: 'buyer'
            });
            setAddOpen(true);
          }}>
              新增绑定
            </Button>
            <Tooltip title="用户端订单/纠纷的可见范围 = 当前登录用户绑定的经营主体。停用某条绑定后，该用户立刻不再以这家主体的身份查看数据（记录保留，便于追溯任职历史）。">
              <span class="trade-bindings-head-note">
                <InfoCircleOutlined />
                <span>决定登录用户的经营主体数据范围，停用后立即生效且保留历史记录</span>
              </span>
            </Tooltip>
          </>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '用户 ID',
          control: <Input allowClear value={filters.value.userId} placeholder="按用户 ID 筛选" onChange={e => setFilters(prev => ({
            ...prev,
            userId: (e.target.value ?? '') || undefined
          }))} onPressEnter={handleQuery} />
        }, {
          label: '经营主体 ID',
          control: <Input allowClear value={filters.value.merchantId} placeholder="按经营主体 ID 筛选" onChange={e => setFilters(prev => ({
            ...prev,
            merchantId: (e.target.value ?? '') || undefined
          }))} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: query.value.pageNum,
          pageSize: query.value.pageSize,
          total: total.value,
          onChange: (page, size) => setQuery(prev => ({
            ...prev,
            pageNum: page,
            pageSize: size
          }))
        }} columns={[{
          title: '用户 ID',
          dataIndex: 'userId',
          width: 196,
          ellipsis: true
        }, {
          title: '经营主体 ID',
          dataIndex: 'merchantId',
          width: 140,
          ellipsis: true
        }, {
          title: '经营主体',
          dataIndex: 'merchantName',
          width: 190,
          ellipsis: true,
          render: (v: string | null) => {
            const text = v ?? '—';
            return <span class="trade-bindings-ellipsis" title={text}>{text}</span>;
          }
        }, {
          title: '主体类型',
          dataIndex: 'merchantType',
          width: 110,
          ellipsis: true,
          render: (v: string | null) => v ? MERCHANT_TYPES[v] ?? v : '—'
        }, {
          title: '主体内角色',
          dataIndex: 'roleInMerchant',
          width: 112,
          render: (v: string) => <Tag color="blue">{ROLES[v] ?? v}</Tag>
        }, {
          title: '状态',
          dataIndex: 'status',
          width: 104,
          render: (v: number) => v === 1 ? <Tag color="success">启用中</Tag> : <Tag color="default">已停用</Tag>
        }, {
          title: '创建时间',
          dataIndex: 'createdAt',
          width: 168,
          ellipsis: true
        }, {
          title: '操作',
          key: 'action',
          width: 104,
          render: (_: unknown, row: UserMerchantBinding) => <ListRowActions>
                <Button type="link" size="small" onClick={() => toggleStatus(row)}>
                  {row.status === 1 ? '停用' : '启用'}
                </Button>
              </ListRowActions>
        }]} />

      <Modal title="新增用户-经营主体绑定" open={addOpen.value} onCancel={() => setAddOpen(false)} onOk={submit} confirmLoading={saving.value} destroyOnClose>
        <Alert type="warning" showIcon style={{
            marginBottom: 12
          }} message="两个 ID 都要填对" description="用户 ID 是平台账号号（platform_user.id），经营主体 ID 是注册主体号（platform_merchant.id，例如 2001）。填错不会报错，只会让这个人看不到或看到不该看的数据，所以提交前请核对。" />
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label="用户 ID" rules={[{
              required: true,
              message: '请填写用户 ID'
            }]}>
            <Input placeholder="例如 2108130996492058625" />
          </Form.Item>
          <Form.Item name="merchantId" label="经营主体 ID" rules={[{
              required: true,
              message: '请填写经营主体 ID'
            }]}>
            <Input placeholder="例如 2001" />
          </Form.Item>
          <Form.Item name="roleInMerchant" label="主体内角色" rules={[{
              required: true,
              message: '请选择角色'
            }]}>
            <Select options={Object.entries(ROLES).map(([value, label]) => ({
                value,
                label
              }))} placeholder="选择该用户在这家主体里的角色" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
export default AdminBindings;
