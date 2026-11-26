import '../../hall/hall.css';
import '../../product/detail/product-detail.css';
import './order-create.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useNavigate, useSearchParams } from "@/vue/router";
import { Alert, Button, Col, Empty, Form, Input, InputNumber, Row, Select, Spin, Typography, message } from "@/vue/ui";
import { ArrowLeftOutlined, CheckCircleOutlined, EnvironmentOutlined, FileTextOutlined, PhoneOutlined, SafetyCertificateOutlined, SearchOutlined, ShopOutlined, ShoppingCartOutlined, ThunderboltOutlined, UserOutlined } from "@ant-design/icons-vue";
import { createOrderFromProduct } from '@/api/order';
import { getProductList, getPublicProductById, type PublicProductDetail } from '@/api/product';
import { BrandMark } from '@/components/BrandMark';
import { PortalNav } from '@/components/PortalNav';
import ProvinceCityFields from '@/components/ProvinceCityFields';
import { redirectToSso } from '@/utils/sso';
interface ProductOption {
  id: number;
  productName: string;
  sellerId?: number;
  sellerName: string;
  categoryName?: string;
  variety?: string;
  unit: string;
  price: number;
  priceMin: number;
  minOrderQuantity?: number;
  stockQuantity: number;
}
const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`;
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`;
const money = (value: number | null | undefined): string => value == null ? '—' : `¥${Number(value).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

/**
 * 从商品详情“立即下单”进入。
 *
 * <p>使用与商品详情相同的交易大厅导航、绿色视觉体系、圆角卡片和信息层级；
 * 金额仍只做前端预览，最终订单金额由服务端按商品价格计算。</p>
 */
const OrderCreate = defineComponent({
  name: "OrderCreate",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const form = Form.useForm();
    const products = shallowRef<ProductOption[]>([]);
    const setProducts = (next: typeof products.value | ((previous: typeof products.value) => typeof products.value)) => {
      products.value = typeof next === 'function' ? (next as (previous: typeof products.value) => typeof products.value)(products.value) : next;
    };
    const productDetail = shallowRef<PublicProductDetail | null>(null);
    const setProductDetail = (next: typeof productDetail.value | ((previous: typeof productDetail.value) => typeof productDetail.value)) => {
      productDetail.value = typeof next === 'function' ? (next as (previous: typeof productDetail.value) => typeof productDetail.value)(productDetail.value) : next;
    };
    const loadingProducts = shallowRef(true);
    const setLoadingProducts = (next: typeof loadingProducts.value | ((previous: typeof loadingProducts.value) => typeof loadingProducts.value)) => {
      loadingProducts.value = typeof next === 'function' ? (next as (previous: typeof loadingProducts.value) => typeof loadingProducts.value)(loadingProducts.value) : next;
    };
    const loadingSkus = shallowRef(false);
    const setLoadingSkus = (next: typeof loadingSkus.value | ((previous: typeof loadingSkus.value) => typeof loadingSkus.value)) => {
      loadingSkus.value = typeof next === 'function' ? (next as (previous: typeof loadingSkus.value) => typeof loadingSkus.value)(loadingSkus.value) : next;
    };
    const submitting = shallowRef(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const search = shallowRef('');
    const setSearch = (next: typeof search.value | ((previous: typeof search.value) => typeof search.value)) => {
      search.value = typeof next === 'function' ? (next as (previous: typeof search.value) => typeof search.value)(search.value) : next;
    };
    const productId = Form.useWatch('productId', form);
    const skuId = Form.useWatch('skuId', form);
    const quantity = computed(() => Number(Form.useWatch('quantity', form) ?? 0));
    const freightAmount = computed(() => Number(Form.useWatch('freightAmount', form) ?? 0));
    const selectedProduct = computed(() => products.value.find(item => item.id === Number(productId.value)));
    const skus = computed(() => (productDetail.value?.skus ?? []).filter(item => item.status === 1));
    const selectableSkus = computed(() => skus.value.filter(item => item.id != null));
    const selectedSku = computed(() => skus.value.find(item => item.id === Number(skuId.value)) ?? skus.value[0]);
    const currentUnit = computed(() => selectedSku.value?.unit ?? selectedProduct.value?.unit ?? '单位');
    const minOrderQuantity = computed(() => Number(selectedSku.value?.minOrderQuantity ?? selectedProduct.value?.minOrderQuantity ?? 0.001));
    const availableStock = computed(() => Number(selectedSku.value?.stockQuantity ?? selectedProduct.value?.stockQuantity ?? 0));
    const unitPrice = computed(() => Number(selectedSku.value?.price ?? selectedProduct.value?.price ?? selectedProduct.value?.priceMin ?? 0));
    const goodsAmount = computed(() => unitPrice.value * quantity.value);
    const totalAmount = computed(() => goodsAmount.value + freightAmount.value);
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          setLoadingProducts(true);
          getProductList({
            pageNum: 1,
            pageSize: 200,
            publishStatus: 'published'
          }).then((res: {
            code: number;
            data?: {
              records?: ProductOption[];
            };
          }) => {
            if (res?.code === 200) setProducts(res.data?.records ?? []);
          }).catch(() => message.error('加载货源失败（检查后端是否在运行）')).finally(() => setLoadingProducts(false));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [params.value, form], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const productIdParam = params.value.get('productId');
          if (!productIdParam) return;
          const quantityParam = Number(params.value.get('quantity'));
          form.setFieldsValue({
            productId: Number(productIdParam),
            quantity: Number.isFinite(quantityParam) && quantityParam > 0 ? quantityParam : undefined
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [productId.value, form, params.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!productId.value) {
            setProductDetail(null);
            return;
          }
          let cancelled = false;
          setLoadingSkus(true);
          getPublicProductById(Number(productId.value)).then((body: {
            code?: number;
            data?: PublicProductDetail;
            message?: string;
          }) => {
            if (cancelled) return;
            if (body?.code !== 200 || !body.data) {
              setProductDetail(null);
              message.error(body?.message ?? '读取商品规格失败');
              return;
            }
            setProductDetail(body.data);
            const enabled = (body.data.skus ?? []).filter(item => item.status === 1);
            const requested = Number(params.value.get('skuId'));
            const nextSku = enabled.find(item => item.id === requested) ?? enabled[0];
            form.setFieldsValue({
              skuId: nextSku?.id ?? undefined,
              quantity: Number(nextSku?.minOrderQuantity ?? body.data.minOrderQuantity ?? 1)
            });
          }).catch(() => {
            if (!cancelled) {
              setProductDetail(null);
              message.error('读取商品规格失败');
            }
          }).finally(() => {
            if (!cancelled) setLoadingSkus(false);
          });
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const onFinish = async (values: Record<string, unknown>) => {
      setSubmitting(true);
      try {
        const res = await createOrderFromProduct(values);
        if (res?.code === 200 && res.data) {
          message.success('订单已创建，请确认收货信息');
          navigate(`/order/confirm?orderId=${res.data.id}`);
        } else {
          message.error(res?.message ?? '创建订单失败');
        }
      } catch {
        message.error('创建订单失败（检查后端是否在运行）');
      } finally {
        setSubmitting(false);
      }
    };
    const submitSearch = (event: PortalEvent): void => {
      event.preventDefault();
      const value = search.value.trim();
      window.location.href = `${PORTAL}#/hall${value ? `?q=${encodeURIComponent(value)}` : ''}`;
    };
    return () => {
      return <div class="hall-root oc-page">
      <div class="topbar">
        <div class="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span class="topbar-actions">
            <a href="/member/buyer">我是买家</a><span class="sep">·</span>
            <a href="/member/seller">我是卖家</a><span class="sep">·</span>
            <a href="/member/buyer">会员中心</a><span class="sep">·</span>
            <a href="#login" onClick={event => {
                event.preventDefault();
                void redirectToSso(window.location.pathname + window.location.search);
              }}><UserOutlined />登录</a><span class="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header class="site-header">
        <div class="hall-container">
          <a class="hall-brand" href={PORTAL}>
            <span class="hall-logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <PortalNav />
          <form class="header-search" onSubmit={submitSearch}>
            <input value={search.value} onInput={event => setSearch((event.target as HTMLInputElement).value ?? '')} placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main class="hall-container oc-main">
        <nav class="pd-crumb" aria-label="面包屑">
          <a href={PORTAL}>首页</a><span>/</span>
          <a href="/hall">交易大厅</a><span>/</span>
          <a href={selectedProduct.value ? `/product/detail/${selectedProduct.value.id}` : '/hall'}>商品详情</a><span>/</span>
          <strong>确认采购信息</strong>
        </nav>

        <section class="oc-heading">
          <div>
            <span class="oc-eyebrow"><ThunderboltOutlined /> 直接采购</span>
            <h1>创建采购订单</h1>
            <p>核对商品、数量和收货信息，提交后进入订单确认与支付环节。</p>
          </div>
          <button type="button" class="oc-back" onClick={() => {
              if (selectedProduct.value) navigate(`/product/detail/${selectedProduct.value.id}`);else navigate('/hall');
            }}>
            <ArrowLeftOutlined /> 返回商品详情
          </button>
        </section>

        <div class="oc-stepper" aria-label="下单流程">
          <div class="on"><span>01</span><strong>填写订单</strong><small>商品与收货信息</small></div>
          <i />
          <div><span>02</span><strong>确认订单</strong><small>核对金额与交付</small></div>
          <i />
          <div><span>03</span><strong>支付完成</strong><small>进入订单履约</small></div>
        </div>

        <div class="oc-layout">
          <section class="oc-form-card">
            <Alert type="info" showIcon class="oc-notice" message="成交价格由平台按商品当前价格计算" description="右侧金额仅用于下单前预览。若已与供应商谈定价格，请通过询价、报价流程成交。" />
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{
                quantity: 1,
                freightAmount: 0
              }} requiredMark={false}>
              <div class="oc-form-section">
                <div class="oc-section-title">
                  <span><ShoppingCartOutlined /></span>
                  <div><strong>采购商品</strong><small>确认货源、数量和运费</small></div>
                </div>
                <Row gutter={[18, 0]}>
                  <Col xs={24} md={12} lg={selectableSkus.value.length > 0 ? 8 : 12}>
                    <Form.Item label="选择货源" name="productId" rules={[{
                        required: true,
                        message: '请选择货源'
                      }]}>
                      <Select showSearch loading={loadingProducts.value} optionFilterProp="label" placeholder="按货源名称搜索" options={products.value.map(item => ({
                          value: item.id,
                          label: `${item.productName}（${item.sellerName}）${money(item.price ?? item.priceMin)}/${item.unit}`
                        }))} onChange={() => form.setFieldsValue({
                          skuId: undefined,
                          quantity: undefined
                        })} />
                    </Form.Item>
                  </Col>
                  {selectableSkus.value.length > 0 && <Col xs={24} md={12} lg={8}>
                      <Form.Item label="商品规格" name="skuId" rules={selectableSkus.value.length > 1 ? [{
                        required: true,
                        message: '请选择商品规格'
                      }] : []}>
                        <Select loading={loadingSkus.value} placeholder="请选择 SKU" options={selectableSkus.value.map(sku => ({
                          value: sku.id,
                          label: `${sku.skuName} · ${money(sku.price)}/${sku.unit} · 库存 ${sku.stockQuantity}${sku.unit}`
                        }))} onChange={value => {
                          const sku = skus.value.find(item => item.id === value);
                          form.setFieldsValue({
                            quantity: Number(sku?.minOrderQuantity ?? 1)
                          });
                        }} />
                      </Form.Item>
                    </Col>}
                  <Col xs={12} lg={6}>
                    <Form.Item label={`采购数量（${currentUnit.value}）`} name="quantity" rules={[{
                        required: true,
                        message: '请填写数量'
                      }]}>
                      <InputNumber min={minOrderQuantity.value} max={availableStock.value > 0 ? availableStock.value : undefined} style={{
                          width: '100%'
                        }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} lg={6}>
                    <Form.Item label="运费（元）" name="freightAmount">
                      <InputNumber min={0} precision={2} style={{
                          width: '100%'
                        }} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div class="oc-form-section">
                <div class="oc-section-title">
                  <span><EnvironmentOutlined /></span>
                  <div><strong>收货信息</strong><small>用于物流履约和签收确认</small></div>
                </div>
                <Row gutter={[18, 0]}>
                  <ProvinceCityFields form={form} required provinceLabel="收货省份" cityLabel="收货城市" provinceColProps={{
                      xs: 24,
                      md: 8
                    }} cityColProps={{
                      xs: 24,
                      md: 8
                    }} />
                  <Col xs={24} md={8}>
                    <Form.Item label="收货人" name="deliveryContact" rules={[{
                        required: true,
                        message: '请填写收货人'
                      }]}>
                      <Input prefix={<UserOutlined />} placeholder="请输入收货人姓名" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="联系电话" name="deliveryPhone" rules={[{
                        required: true,
                        message: '请填写联系电话'
                      }]}>
                      <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={16}>
                    <Form.Item label="详细地址" name="deliveryAddress" rules={[{
                        required: true,
                        message: '请填写详细地址'
                      }]}>
                      <Input placeholder="例如：新发地农产品批发市场粮油区 3 号库" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div class="oc-form-actions">
                <button type="submit" class="oc-submit" disabled={submitting.value}>
                  {submitting.value ? <><Spin size="small" /> 正在创建订单</> : <><ThunderboltOutlined /> 提交订单</>}
                </button>
                <Button class="oc-cancel" onClick={() => navigate('/member/buyer?tab=purchase')}>
                  取消并返回
                </Button>
                <span><SafetyCertificateOutlined /> 订单与支付数据由平台加密留痕</span>
              </div>
            </Form>
          </section>

          <aside class="oc-summary">
            <div class="oc-summary-head">
              <span>订单预览</span>
              <em>实时计价</em>
            </div>
            {loadingProducts.value ? <div class="oc-summary-loading"><Spin /><span>正在读取货源信息…</span></div> : selectedProduct.value ? <>
                <div class="oc-product">
                  <div class="oc-product-visual"><ShopOutlined /></div>
                  <div>
                    <span>{selectedProduct.value.categoryName || selectedProduct.value.variety || '平台在售商品'}</span>
                    <strong>{selectedProduct.value.productName}</strong>
                    <small><ShopOutlined /> {selectedProduct.value.sellerName}</small>
                    {selectedSku.value && <small>规格：{selectedSku.value.skuName} · 库存 {selectedSku.value.stockQuantity} {selectedSku.value.unit}</small>}
                  </div>
                </div>
                <div class="oc-summary-lines">
                  <div><span>商品单价</span><strong>{money(unitPrice.value)} / {currentUnit.value}</strong></div>
                  <div><span>采购数量</span><strong>{quantity.value || 0} {currentUnit.value}</strong></div>
                  <div><span>商品金额</span><strong>{money(goodsAmount.value)}</strong></div>
                  <div><span>运费</span><strong>{money(freightAmount.value)}</strong></div>
                </div>
                <div class="oc-total">
                  <span>预计订单总额</span>
                  <strong>{money(totalAmount.value)}</strong>
                  <small>最终金额以服务端创建订单结果为准</small>
                </div>
                <div class="oc-summary-trust">
                  <span><CheckCircleOutlined /> 商品价格平台校验</span>
                  <span><FileTextOutlined /> 订单明细自动留存</span>
                  <span><SafetyCertificateOutlined /> 交易过程全程留痕</span>
                </div>
              </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择货源后生成订单预览" />}
            <Typography.Paragraph class="oc-summary-note">
              提交后可继续修改收货信息；支付、发货、签收与售后均可在买家中心跟踪。
            </Typography.Paragraph>
          </aside>
        </div>
      </main>
    </div>;
    };
  }
});
export default OrderCreate;
