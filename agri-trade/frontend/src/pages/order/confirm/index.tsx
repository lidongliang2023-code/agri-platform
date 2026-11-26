import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useNavigate, useSearchParams } from "@/vue/router";
import { Alert, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Input, Row, Space, Spin, Table, Typography, message } from "@/vue/ui";
import dayjs, { Dayjs } from 'dayjs';
import { getOrderById, getOrderItems, updateOrder } from '@/api/order';
import ProvinceCityFields from '@/components/ProvinceCityFields';
interface Order {
  id: number;
  orderNo: string;
  buyerName: string;
  sellerName: string;
  categoryName: string;
  goodsAmount: number;
  freightAmount: number;
  discountAmount: number;
  totalAmount: number;
  orderStatus: string;
  deliveryProvince: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  deliveryDeadline: string;
}
interface OrderItemRow {
  id: number;
  productName: string;
  specLevel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** 实体字段是 totalPrice（表里的 amount 列没有映射到实体） */
  totalPrice: number;
}

/**
 * 确认订单（原型"订单管理 → 确认订单"）。
 *
 * <p>入口只有一个：报价转订单之后跳过来（?orderId=）。这一步做的是"把草稿确认成可付款的订单"——
 * 补齐收货信息、核对明细与金额，确认后进入订单详情去支付。</p>
 *
 * <p>金额是从服务端读出来的，页面上只展示、不可改：总额在生成订单时已由服务端按
 * 报价口径算定，改金额属于改合同，要走报价而不是改页面数字。</p>
 */
const OrderConfirm = defineComponent({
  name: "OrderConfirm",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const orderId = computed(() => params.value.get('orderId'));
    const form = Form.useForm();
    const order = shallowRef<Order | null>(null);
    const setOrder = (next: typeof order.value | ((previous: typeof order.value) => typeof order.value)) => {
      order.value = typeof next === 'function' ? (next as (previous: typeof order.value) => typeof order.value)(order.value) : next;
    };
    const items = shallowRef<OrderItemRow[]>([]);
    const setItems = (next: typeof items.value | ((previous: typeof items.value) => typeof items.value)) => {
      items.value = typeof next === 'function' ? (next as (previous: typeof items.value) => typeof items.value)(items.value) : next;
    };
    const loading = shallowRef(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    onMounted(() => {
      watch(() => [orderId.value, form], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!orderId.value) {
            setLoading(false);
            return;
          }
          setLoading(true);
          getOrderById(Number(orderId.value)).then((res: {
            code: number;
            data?: Order;
            message?: string;
          }) => {
            if (res?.code === 200 && res.data) {
              setOrder(res.data);
              form.setFieldsValue({
                deliveryProvince: res.data.deliveryProvince,
                deliveryCity: res.data.deliveryCity,
                deliveryAddress: res.data.deliveryAddress,
                deliveryContact: res.data.deliveryContact,
                deliveryPhone: res.data.deliveryPhone,
                deliveryDeadline: res.data.deliveryDeadline ? dayjs(res.data.deliveryDeadline) : undefined
              });
            } else {
              message.error(res?.message ?? '订单不存在');
            }
          }).catch(() => message.error('加载订单失败')).finally(() => setLoading(false));
          getOrderItems(orderId.value).then((res: {
            code: number;
            data?: OrderItemRow[];
          }) => {
            if (res?.code === 200) setItems(res.data ?? []);
          }).catch(() => undefined);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const onFinish = async (values: Record<string, unknown>) => {
      if (!order.value) return;
      setSaving(true);
      try {
        const res = await updateOrder(order.value.id, {
          ...values,
          deliveryDeadline: values.deliveryDeadline ? (values.deliveryDeadline as Dayjs).format('YYYY-MM-DD HH:mm:ss') : undefined
        });
        if (res?.code === 200) {
          message.success('订单已确认，去支付');
          navigate(`/order/detail/${order.value.id}`);
        } else {
          message.error(res?.message ?? '确认失败');
        }
      } finally {
        setSaving(false);
      }
    };
    return () => {
      const view_order = order.value;
      if (!orderId.value) {
        return <Empty style={{
          padding: 80
        }} description="确认订单需要从报价生成订单后进入（报价列表 → 生成订单）" />;
      }
      if (loading.value) {
        return <div style={{
          padding: 80,
          textAlign: 'center'
        }}>
        <Spin size="large" />
      </div>;
      }
      if (!view_order) {
        return <Empty description="没有找到这笔订单" style={{
          padding: 80
        }} />;
      }
      return <div style={{
        padding: 20
      }}>
      <Card title={`确认订单 ${view_order.orderNo}`} style={{
          marginBottom: 16
        }}>
        <Alert type="info" showIcon style={{
            marginBottom: 16
          }} message="请核对收货信息与明细，确认后即可进入支付" description="订单金额在生成时已按报价口径算定，这里只能核对、不能修改；如需改价请回到报价环节。" />
        <Descriptions column={{
            xs: 1,
            sm: 2,
            md: 3
          }} size="small" bordered>
          <Descriptions.Item label="采购方">{view_order.buyerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="供货方">{view_order.sellerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="品类">{view_order.categoryName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="货款">¥{view_order.goodsAmount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="运费">¥{view_order.freightAmount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="优惠">¥{view_order.discountAmount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="订单总额">
            <span style={{
                color: '#1565C0',
                fontWeight: 600
              }}>¥{view_order.totalAmount}</span>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`订单明细（${items.value.length}）`} style={{
          marginBottom: 16
        }}>
        <Table rowKey="id" dataSource={items.value} pagination={false} locale={{
            emptyText: '这笔订单没有明细行'
          }} columns={[{
            title: '商品',
            dataIndex: 'productName'
          }, {
            title: '等级',
            dataIndex: 'specLevel',
            render: (val: string) => val || '—'
          }, {
            title: '数量',
            dataIndex: 'quantity',
            render: (val: number, row: OrderItemRow) => `${val} ${row.unit ?? ''}`
          }, {
            title: '单价',
            dataIndex: 'unitPrice',
            render: (val: number) => `¥${val}`
          }, {
            title: '金额',
            dataIndex: 'totalPrice',
            render: (val: number) => `¥${val}`
          }]} />
      </Card>

      <Card title="收货信息">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <ProvinceCityFields form={form} required provinceLabel="收货省份" cityLabel="收货城市" provinceColProps={{
                xs: 24,
                md: 6
              }} cityColProps={{
                xs: 24,
                md: 6
              }} />
            <Col span={6}>
              <Form.Item label="收货人" name="deliveryContact" rules={[{
                  required: true,
                  message: '请填写收货人'
                }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="收货电话" name="deliveryPhone" rules={[{
                  required: true,
                  message: '请填写收货电话'
                }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="详细地址" name="deliveryAddress" rules={[{
                  required: true,
                  message: '请填写详细地址'
                }]}>
                <Input placeholder="例如：新发地农产品批发市场粮油区 3 号库" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="期望交货时间" name="deliveryDeadline">
                <DatePicker showTime style={{
                    width: '100%'
                  }} />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving.value}>
              确认订单并去支付
            </Button>
            <Button onClick={() => navigate(`/order/detail/${view_order.id}`)}>先看看订单详情</Button>
          </Space>
        </Form>
      </Card>

      <Typography.Paragraph type="secondary" style={{
          marginTop: 12
        }}>
        提示：确认动作会把收货信息写回订单，订单状态仍是「待确认」，付款后进入后续流转。
      </Typography.Paragraph>
    </div>;
    };
  }
});
export default OrderConfirm;
