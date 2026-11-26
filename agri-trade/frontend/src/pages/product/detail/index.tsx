import '../../hall/hall.css';
import './product-detail.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useParams } from "@/vue/router";
import { Empty, InputNumber, Spin, message } from "@/vue/ui";
import { CheckCircleOutlined, EnvironmentOutlined, FileTextOutlined, HeartFilled, HeartOutlined, SafetyCertificateOutlined, SearchOutlined, ShopOutlined, ShoppingCartOutlined, ThunderboltOutlined, CarOutlined, UserOutlined } from "@ant-design/icons-vue";
import { getPublicProductById, getPublicProductImages, type PublicProductDetail } from '@/api/product';
import { isLoggedIn } from '@/utils/session';
import { redirectToSso } from '@/utils/sso';
import { favoriteProduct, getProductFavoriteState, unfavoriteProduct } from '@/api/shop-interaction';
import { BrandMark } from '@/components/BrandMark';
import { PortalNav } from '@/components/PortalNav';
interface DetailImage {
  id: number;
  imageUrl: string;
  imageType: string;
  sortOrder: number;
}
interface SimilarProduct {
  id: number;
  productName: string;
  sellerName?: string | null;
  categoryName?: string | null;
  variety?: string | null;
  origin?: string;
  specification?: string | null;
  unit: string;
  price?: number | null;
  priceMin?: number | null;
}
type DetailTab = 'intro' | 'spec' | 'supplier' | 'records';
const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`;
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`;
const TABS: {
  key: DetailTab;
  label: string;
}[] = [{
  key: 'intro',
  label: '商品详情'
}, {
  key: 'spec',
  label: '规格参数'
}, {
  key: 'supplier',
  label: '供应商信息'
}, {
  key: 'records',
  label: '交易记录'
}];
const money = (value: number | null | undefined): string => value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', {
  maximumFractionDigits: 2
})}`;
const valueOr = (value: string | number | null | undefined, fallback = '待补充'): string => value == null || value === '' ? fallback : String(value);
const dateText = (value: string | null | undefined): string => value ? String(value).slice(0, 10) : '—';
function parseCertifications(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(item => typeof item === 'string' ? item : item && typeof item === 'object' ? String((item as Record<string, unknown>).name ?? (item as Record<string, unknown>).type ?? '') : '').filter(Boolean);
    }
    return parsed ? [String(parsed)] : [];
  } catch {
    return raw.split(/[,，;；]/).map(item => item.trim()).filter(Boolean);
  }
}
const ProductVisual = defineComponent({
  name: "ProductVisual",
  props: {
    src: null as unknown as PropType<{
      src?: string;
      alt: string;
      compact?: boolean;
    }["src"]>,
    alt: null as unknown as PropType<{
      src?: string;
      alt: string;
      compact?: boolean;
    }["alt"]>,
    compact: null as unknown as PropType<{
      src?: string;
      alt: string;
      compact?: boolean;
    }["compact"]>
  },
  setup(__props: {
    src?: string;
    alt: string;
    compact?: boolean;
  }, {
    slots: __slots
  }) {
    const failed = shallowRef(false);
    const setFailed = (next: typeof failed.value | ((previous: typeof failed.value) => typeof failed.value)) => {
      failed.value = typeof next === 'function' ? (next as (previous: typeof failed.value) => typeof failed.value)(failed.value) : next;
    };
    onMounted(() => {
      watch(() => [__props.src], (_next, _previous, onCleanup) => {
        const dispose = (() => setFailed(false))();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      if (!__props.src || failed.value) {
        return <div class={`pd-placeholder${__props.compact ?? false ? ' compact' : ''}`}>
        <span><ShopOutlined /></span>
        {!(__props.compact ?? false) && <><strong>商品图片待上传</strong><small>页面已按真实商品资料展示</small></>}
      </div>;
      }
      return <img src={__props.src} alt={__props.alt} onError={() => setFailed(true)} />;
    };
  }
});
const InfoLine = defineComponent({
  name: "InfoLine",
  props: {
    label: null as unknown as PropType<{
      label: string;
      value: string;
    }["label"]>,
    value: null as unknown as PropType<{
      label: string;
      value: string;
    }["value"]>
  },
  setup(__props: {
    label: string;
    value: string;
  }, {
    slots: __slots
  }) {
    return () => {
      return <div class="pd-info-line">
      <span>{__props.label}</span>
      <strong>{__props.value}</strong>
    </div>;
    };
  }
});
const ProductDetail = defineComponent({
  name: "ProductDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _routeParams = useParams();
    const product = shallowRef<PublicProductDetail | null>(null);
    const setProduct = (next: typeof product.value | ((previous: typeof product.value) => typeof product.value)) => {
      product.value = typeof next === 'function' ? (next as (previous: typeof product.value) => typeof product.value)(product.value) : next;
    };
    const images = shallowRef<DetailImage[]>([]);
    const setImages = (next: typeof images.value | ((previous: typeof images.value) => typeof images.value)) => {
      images.value = typeof next === 'function' ? (next as (previous: typeof images.value) => typeof images.value)(images.value) : next;
    };
    const similar = shallowRef<SimilarProduct[]>([]);
    const setSimilar = (next: typeof similar.value | ((previous: typeof similar.value) => typeof similar.value)) => {
      similar.value = typeof next === 'function' ? (next as (previous: typeof similar.value) => typeof similar.value)(similar.value) : next;
    };
    const activeImage = shallowRef(0);
    const setActiveImage = (next: typeof activeImage.value | ((previous: typeof activeImage.value) => typeof activeImage.value)) => {
      activeImage.value = typeof next === 'function' ? (next as (previous: typeof activeImage.value) => typeof activeImage.value)(activeImage.value) : next;
    };
    const quantity = shallowRef(1);
    const setQuantity = (next: typeof quantity.value | ((previous: typeof quantity.value) => typeof quantity.value)) => {
      quantity.value = typeof next === 'function' ? (next as (previous: typeof quantity.value) => typeof quantity.value)(quantity.value) : next;
    };
    const selectedSkuId = shallowRef<number | null>(null);
    const setSelectedSkuId = (next: typeof selectedSkuId.value | ((previous: typeof selectedSkuId.value) => typeof selectedSkuId.value)) => {
      selectedSkuId.value = typeof next === 'function' ? (next as (previous: typeof selectedSkuId.value) => typeof selectedSkuId.value)(selectedSkuId.value) : next;
    };
    const tab = shallowRef<DetailTab>('intro');
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const loading = shallowRef(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const search = shallowRef('');
    const setSearch = (next: typeof search.value | ((previous: typeof search.value) => typeof search.value)) => {
      search.value = typeof next === 'function' ? (next as (previous: typeof search.value) => typeof search.value)(search.value) : next;
    };
    const favorited = shallowRef(false);
    const setFavorited = (next: typeof favorited.value | ((previous: typeof favorited.value) => typeof favorited.value)) => {
      favorited.value = typeof next === 'function' ? (next as (previous: typeof favorited.value) => typeof favorited.value)(favorited.value) : next;
    };
    const favoriteBusy = shallowRef(false);
    const setFavoriteBusy = (next: typeof favoriteBusy.value | ((previous: typeof favoriteBusy.value) => typeof favoriteBusy.value)) => {
      favoriteBusy.value = typeof next === 'function' ? (next as (previous: typeof favoriteBusy.value) => typeof favoriteBusy.value)(favoriteBusy.value) : next;
    };
    onMounted(() => {
      watch(() => [_routeParams.id], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!_routeParams.id) return;
          let cancelled = false;
          setLoading(true);
          Promise.all([getPublicProductById(_routeParams.id), getPublicProductImages(_routeParams.id)]).then(([productRes, imageRes]) => {
            if (cancelled) return;
            if (productRes?.code !== 200 || !productRes.data) {
              message.error(productRes?.message ?? '商品不存在或已下架');
              return;
            }
            const detail = productRes.data as PublicProductDetail;
            setProduct(detail);
            setImages(imageRes?.code === 200 ? imageRes.data ?? [] : []);
            const defaultSku = (detail.skus ?? []).find(sku => sku.status === 1) ?? detail.skus?.[0];
            setSelectedSkuId(defaultSku?.id ?? null);
            setQuantity(Number(defaultSku?.minOrderQuantity ?? detail.minOrderQuantity ?? 1));
          }).catch(() => message.error('加载商品详情失败，请确认交易服务已启动')).finally(() => {
            if (!cancelled) setLoading(false);
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
    onMounted(() => {
      watch(() => [product.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!product.value) return;
          let cancelled = false;
          const load = async (): Promise<void> => {
            try {
              const categoryId = product.value?.categoryId;
              let rows: SimilarProduct[] = [];
              if (categoryId) {
                const response = await fetch(`/api/trade/public/hall/products?pageNum=1&pageSize=5&categoryIds=${categoryId}`);
                const body = (await response.json()) as {
                  code?: number;
                  data?: SimilarProduct[] | {
                    records?: SimilarProduct[];
                  };
                };
                if (body.code === 200) {
                  rows = Array.isArray(body.data) ? body.data : body.data?.records ?? [];
                }
              }
              let candidates = rows.filter(item => item.id !== product.value?.id);
              if (candidates.length === 0) {
                const response = await fetch('/api/trade/public/products?limit=8');
                const body = (await response.json()) as {
                  code?: number;
                  data?: SimilarProduct[];
                };
                if (body.code === 200 && Array.isArray(body.data)) {
                  candidates = body.data.filter(item => item.id !== product.value?.id);
                }
              }
              if (!cancelled) setSimilar(candidates.slice(0, 4));
            } catch {
              if (!cancelled) setSimilar([]);
            }
          };
          void load();
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
    onMounted(() => {
      watch(() => [_routeParams.id], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!_routeParams.id || !isLoggedIn()) {
            setFavorited(false);
            return;
          }
          let cancelled = false;
          void getProductFavoriteState(_routeParams.id).then(result => {
            if (!cancelled && result.code === 200) setFavorited(Boolean(result.data?.favorited));
          }).catch(() => {/* 未登录或状态读取失败不阻断商品浏览 */});
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
    const certifications = computed(() => parseCertifications(product.value?.certificationJson ?? null));
    const origin = computed(() => product.value ? [product.value.originProvince, product.value.originCity, product.value.originDistrict].filter(Boolean).join(' ') : '');
    const originFull = computed(() => product.value ? [origin.value, product.value.originAddress].filter(Boolean).join(' ') : '');
    const skus = computed(() => product.value?.skus ?? []);
    const selectedSku = computed(() => skus.value.find(sku => sku.id === selectedSkuId.value) ?? skus.value[0]);
    const currentUnit = computed(() => selectedSku.value?.unit ?? product.value?.unit ?? '');
    const minOrder = computed(() => Number(selectedSku.value?.minOrderQuantity ?? product.value?.minOrderQuantity ?? 1));
    const stock = computed(() => Number(selectedSku.value?.stockQuantity ?? product.value?.stockQuantity ?? 0));
    const price = computed(() => selectedSku.value?.price ?? product.value?.price ?? product.value?.priceMin ?? null);
    const quantityValid = computed(() => quantity.value >= minOrder.value && (stock.value <= 0 || quantity.value <= stock.value));
    const estimate = computed(() => price.value == null ? null : price.value * quantity.value);
    const currentImage = computed(() => images.value[activeImage.value]?.imageUrl);
    const selectSku = (skuId: number | null): void => {
      const sku = skus.value.find(item => item.id === skuId) ?? skus.value[0];
      setSelectedSkuId(sku?.id ?? null);
      setQuantity(Number(sku?.minOrderQuantity ?? product.value?.minOrderQuantity ?? 1));
    };
    const submitSearch = (event: PortalEvent): void => {
      event.preventDefault();
      const value = search.value.trim();
      window.location.href = `${PORTAL}#/hall${value ? `?q=${encodeURIComponent(value)}` : ''}`;
    };
    const goProtected = (path: string): void => {
      if (!isLoggedIn()) {
        void redirectToSso(path);
        return;
      }
      window.location.href = path;
    };
    const toggleFavorite = async (): Promise<void> => {
      if (!product.value) return;
      if (!isLoggedIn()) {
        await redirectToSso(`${window.location.pathname}${window.location.search}`);
        return;
      }
      setFavoriteBusy(true);
      try {
        const result = favorited.value ? await unfavoriteProduct(product.value?.id) : await favoriteProduct(product.value?.id);
        if (result.code !== 200) {
          message.error(result.message || '商品收藏操作失败');
          return;
        }
        setFavorited(Boolean(result.data?.favorited));
        setProduct(current => current ? {
          ...current,
          favoriteCount: Math.max(0, Number(current.favoriteCount ?? 0) + (result.data.favorited ? 1 : -1))
        } : current);
        message.success(result.data.favorited ? '商品已收藏' : '已取消收藏');
      } catch {
        message.error('商品收藏操作失败，请稍后重试');
      } finally {
        setFavoriteBusy(false);
      }
    };
    return () => {
      const view_product = product.value;
      if (loading.value) {
        return <div class="pd-loading">
        <Spin size="large" />
        <span>正在读取商品详情…</span>
      </div>;
      }
      if (!view_product) {
        return <div class="pd-error-page">
        <Empty description="商品不存在或已下架" />
        <a class="pd-primary" href="/hall">返回交易大厅</a>
      </div>;
      }
      return <div class="hall-root">
      <div class="topbar">
        <div class="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span class="topbar-actions">
            <a href="/member/buyer">我是买家</a><span class="sep">·</span>
            <a href="/member/seller">我是卖家</a><span class="sep">·</span>
            <a href="/member/buyer">会员中心</a><span class="sep">·</span>
            <a href="#platform-login" onClick={event => {
                event.preventDefault();
                void redirectToSso(`${window.location.pathname}${window.location.search}`);
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

      <main class="hall-container pd-main">
        <nav class="pd-crumb" aria-label="面包屑">
          <a href={PORTAL}>首页</a><span>/</span>
          <a href="/hall">交易大厅</a><span>/</span>
          <strong>{view_product.productName}</strong>
        </nav>

        <section class="pd-hero">
          <div class="pd-gallery">
            <div class="pd-main-image">
              <ProductVisual src={currentImage.value} alt={view_product.productName} />
              <span class="pd-live-badge">平台在售</span>
            </div>
            {images.value.length > 0 && <div class="pd-thumbs">
                {images.value.map((item, index) => <button type="button" key={item.id} class={`pd-thumb${index === activeImage.value ? ' on' : ''}`} onClick={() => setActiveImage(index)} aria-label={`查看商品图片 ${index + 1}`}>
                    <ProductVisual src={item.imageUrl} alt={`${view_product.productName} ${index + 1}`} compact />
                  </button>)}
              </div>}
          </div>

          <div class="pd-summary">
            <div class="pd-title-row">
              <div>
                <span class="pd-category">{view_product.categoryName || '农产品'}</span>
                <h1>{view_product.productName}</h1>
                <p>{[view_product.variety, view_product.specSize, origin.value].filter(Boolean).join(' · ') || '商品详情以供应商发布资料为准'}</p>
              </div>
              <span class="hall-tag tech">{view_product.publishStatus === 'published' ? '已发布' : view_product.publishStatus}</span>
            </div>

            {skus.value.length > 0 && <div class="pd-sku-picker">
                <div class="pd-sku-picker-label">
                  <span>选择规格</span>
                  <small>共 {skus.value.length} 个可售 SKU</small>
                </div>
                <div class="pd-sku-options">
                  {skus.value.map((sku, index) => {
                    const active = selectedSku.value === sku;
                    const unavailable = sku.status !== 1 || Number(sku.stockQuantity ?? 0) <= 0;
                    return <button type="button" key={sku.id ?? `${sku.skuCode}-${index}`} class={`${active ? 'on' : ''}${unavailable ? ' disabled' : ''}`} disabled={unavailable} onClick={() => selectSku(sku.id ?? null)} title={unavailable ? '该规格已停用或库存不足' : `${sku.skuName} · ${money(sku.price)}/${sku.unit}`}>
                        <strong>{sku.skuName}</strong>
                        <span>{money(sku.price)} / {sku.unit}</span>
                      </button>;
                  })}
                </div>
              </div>}

            <div class="pd-price-panel">
              <div class="pd-current-price">
                <span>当前报价</span>
                <strong>{money(price.value)}<small>{price.value == null ? '' : ` / ${currentUnit.value}`}</small></strong>
                <em>起订 {minOrder.value} {currentUnit.value}</em>
              </div>
              <div class="pd-reference-grid">
                <div><span>参考最低价</span><strong>{money(view_product.priceMin)}</strong></div>
                <div><span>当前报价</span><strong>{money(price.value)}</strong></div>
                <div><span>参考最高价</span><strong>{money(view_product.priceMax)}</strong></div>
              </div>
              <p>价格与库存来自交易域实时商品记录；成交价以询价、报价或订单确认结果为准。</p>
            </div>

            <div class="pd-info-grid">
              <InfoLine label="当前规格" value={valueOr(selectedSku.value?.skuName || view_product.specSize || view_product.specLevel)} />
              <InfoLine label="产地" value={valueOr(origin.value)} />
              <InfoLine label="品种" value={valueOr(view_product.variety)} />
              <InfoLine label="质量等级" value={valueOr(view_product.qualityLevel || view_product.specLevel)} />
              <InfoLine label="库存" value={`${stock.value || '—'} ${currentUnit.value}`} />
              <InfoLine label="采收批次" value={valueOr(view_product.harvestBatchNo)} />
            </div>

            <div class="pd-supplier-strip">
              <span class="pd-supplier-icon"><ShopOutlined /></span>
              <div>
                <strong>{view_product.sellerName || '平台供应商'}</strong>
                <span><EnvironmentOutlined /> {valueOr(originFull.value)}</span>
              </div>
              <div class="pd-supplier-tags">
                <span>{view_product.categoryName || '农产品'}</span>
                <span>{stock.value > 0 ? '现货供应' : '库存待确认'}</span>
              </div>
            </div>

            <div class="pd-buybox">
              <div class="pd-quantity">
                <span>采购数量</span>
                <InputNumber min={minOrder.value} max={stock.value > 0 ? stock.value : undefined} value={quantity.value} onChange={value => setQuantity(Number(value ?? minOrder.value))} controls />
                <em>{currentUnit.value}</em>
              </div>
              <div class="pd-estimate">
                <span>预计货款</span>
                <strong>{estimate.value == null ? '以询价为准' : money(estimate.value)}</strong>
              </div>
            </div>
            <p class={`pd-quantity-hint${quantityValid.value ? '' : ' error'}`}>
              {quantityValid.value ? `数量需满足起订量 ${minOrder.value} ${currentUnit.value}${stock.value > 0 ? `，当前库存 ${stock.value} ${currentUnit.value}` : ''}` : `采购数量应在 ${minOrder.value} 至 ${stock.value || '库存上限'} ${currentUnit.value} 之间`}
            </p>

            <div class="pd-actions">
              <button type="button" class={`pd-ghost${favorited.value ? ' favorite' : ''}`} disabled={favoriteBusy.value} onClick={() => void toggleFavorite()}>
                {favorited.value ? <HeartFilled /> : <HeartOutlined />}
                {favoriteBusy.value ? '处理中…' : favorited.value ? '已收藏' : '收藏商品'}
              </button>
              <button type="button" class="pd-primary" disabled={!quantityValid.value} onClick={() => goProtected(`/order/create?productId=${view_product.id}&quantity=${quantity.value}${selectedSku.value?.id ? `&skuId=${selectedSku.value.id}` : ''}`)}>
                <ThunderboltOutlined />立即下单
              </button>
              <button type="button" class="pd-outline" disabled={!quantityValid.value} onClick={() => goProtected(`/member/buyer?tab=publish&productId=${view_product.id}&quantity=${quantity.value}`)}>
                <ShoppingCartOutlined />发布采购需求
              </button>
              <button type="button" class="pd-ghost" onClick={() => {
                  window.location.href = `/shop/${view_product.sellerId}`;
                }}>
                <ShopOutlined />进入店铺询价
              </button>
              <button type="button" class="pd-text-action" onClick={() => document.getElementById('negotiation')?.scrollIntoView({
                  behavior: 'smooth'
                })}>
                了解在线议价流程
              </button>
            </div>
            <div class="pd-trust-line">
              <span><SafetyCertificateOutlined /> 商品资料由供应商发布</span>
              <span><CarOutlined /> 交付方式在订单确认时约定</span>
            </div>
          </div>
        </section>

        <section class="pd-card pd-negotiation" id="negotiation">
          <div class="pd-card-head">
            <div><ThunderboltOutlined /><strong>在线议价</strong><span>按真实采购需求与供应商报价推进</span></div>
            <span class="hall-tag">平台留痕</span>
          </div>
          <div class="pd-negotiation-body">
            {[['01', '提交采购需求', '带入当前商品、品种、数量与期望价格。'], ['02', '供应商在线报价', '供应商在卖家中心处理询价并返回正式报价。'], ['03', '接受报价并下单', '买卖双方按报价与订单信息确认数量、价格和交付安排。']].map(([step, title, desc]) => <div class="pd-step" key={step}>
                <span>{step}</span>
                <div><strong>{title}</strong><p>{desc}</p></div>
              </div>)}
            <button type="button" class="pd-outline" onClick={() => goProtected(`/member/buyer?tab=publish&productId=${view_product.id}&quantity=${quantity.value}`)}>
              发起真实议价
            </button>
          </div>
          <p class="pd-negotiation-note">页面不展示演示聊天或无来源报价；议价记录以询价单、供应商报价和订单为准。</p>
        </section>

        <section class="pd-card pd-detail-card">
          <div class="pd-tabs" role="tablist" aria-label="商品详情页签">
            {TABS.map(item => <button type="button" key={item.key} role="tab" aria-selected={tab.value === item.key} class={tab.value === item.key ? 'on' : ''} onClick={() => setTab(item.key)}>{item.label}</button>)}
          </div>

          {tab.value === 'intro' && <div class="pd-tab-panel">
              <div class="pd-description">
                <h2>商品说明</h2>
                <p>{view_product.description || '供应商暂未填写商品说明。'}</p>
              </div>
              <div class="pd-feature-grid">
                <div><EnvironmentOutlined /><strong>产地信息</strong><span>{originFull.value || '待供应商补充'}</span></div>
                <div><SafetyCertificateOutlined /><strong>质量资料</strong><span>{view_product.qualityLevel || (certifications.value.length ? certifications.value.join('、') : '以供应商上传资料为准')}</span></div>
                <div><CarOutlined /><strong>供应能力</strong><span>{stock.value > 0 ? `当前库存 ${stock.value} ${currentUnit.value}` : '库存待确认'}</span></div>
              </div>
              {(view_product.qualityReportUrl || view_product.videoUrl || certifications.value.length > 0) && <div class="pd-proof-row">
                  {view_product.qualityReportUrl && <a href={view_product.qualityReportUrl} target="_blank" rel="noreferrer"><FileTextOutlined />查看质量报告</a>}
                  {view_product.videoUrl && <a href={view_product.videoUrl} target="_blank" rel="noreferrer"><FileTextOutlined />查看商品视频</a>}
                  {certifications.value.map(item => <span key={item}><CheckCircleOutlined />{item}</span>)}
                </div>}
            </div>}

          {tab.value === 'spec' && <div class="pd-tab-panel">
              <table class="pd-spec-table">
                <tbody>
                  <tr><th>产品名称</th><td>{view_product.productName}</td><th>商品编码</th><td>{view_product.productCode}</td></tr>
                  <tr><th>条码</th><td>{valueOr(view_product.barcode)}</td><th>品类</th><td>{valueOr(view_product.categoryName)}</td></tr>
                  <tr><th>品种</th><td>{valueOr(view_product.variety)}</td><th>规格</th><td>{valueOr(view_product.specSize)}</td></tr>
                  <tr><th>等级</th><td>{valueOr(view_product.specLevel)}</td><th>质量等级</th><td>{valueOr(view_product.qualityLevel)}</td></tr>
                  <tr><th>产地</th><td>{valueOr(originFull.value)}</td><th>发货批次</th><td>{valueOr(view_product.harvestBatchNo)}</td></tr>
                  <tr><th>起订量</th><td>{minOrder.value} {currentUnit.value}</td><th>库存</th><td>{stock.value || '—'} {currentUnit.value}</td></tr>
                  <tr><th>报价类型</th><td>{view_product.priceType || '平台报价'}</td><th>发布时间</th><td>{dateText(view_product.createTime)}</td></tr>
                  <tr><th>SKU数量</th><td>{skus.value.length || 1} 个</td><th>当前规格</th><td>{selectedSku.value?.skuName || '默认规格'}</td></tr>
                </tbody>
              </table>
            </div>}

          {tab.value === 'supplier' && <div class="pd-tab-panel">
              <div class="pd-supplier-profile">
                <span class="pd-supplier-avatar"><ShopOutlined /></span>
                <div>
                  <h3>{view_product.sellerName || '平台供应商'}</h3>
                  <p><EnvironmentOutlined /> {originFull.value || '所在地待补充'} · 当前商品共 {stock.value || '—'} {currentUnit.value} 可供</p>
                </div>
                <button type="button" class="pd-outline" onClick={() => {
                  window.location.href = `/shop/${view_product.sellerId}`;
                }}>查看店铺</button>
              </div>
              <div class="pd-supplier-data">
                <InfoLine label="主营品类" value={valueOr(view_product.categoryName)} />
                <InfoLine label="当前商品浏览" value={`${view_product.viewCount ?? 0} 次`} />
                <InfoLine label="当前商品询价" value={`${view_product.inquiryCount ?? 0} 次`} />
                <InfoLine label="商品收藏" value={`${view_product.favoriteCount ?? 0} 次`} />
              </div>
            </div>}

          {tab.value === 'records' && <div class="pd-tab-panel">
              <Empty description="暂无公开的逐笔成交记录" />
              <p class="pd-records-note">为保护买卖双方商业信息，逐笔订单仅在登录且具备对应主体权限时查看。</p>
              <button type="button" class="pd-outline" onClick={() => goProtected('/member/buyer?tab=purchase')}>登录后查看我的交易</button>
            </div>}
        </section>

        <section class="pd-similar">
          <div class="pd-section-head">
            <div><h2>相似商品推荐</h2><p>同品类已发布货源，可直接进入详情比较</p></div>
            <a href="/hall">返回交易大厅 →</a>
          </div>
          {similar.value.length > 0 ? <div class="pd-similar-grid">
              {similar.value.map(item => <a class="pd-similar-card" href={`/product/detail/${item.id}`} key={item.id}>
                  <div class="pd-similar-visual"><ProductVisual compact alt={item.productName} /></div>
                  <strong>{item.productName}</strong>
                  <span>{[item.origin, item.specification || item.variety].filter(Boolean).join(' · ') || item.categoryName}</span>
                  <div><b>{money(item.price ?? item.priceMin)}<small>{item.price == null ? '' : `/${item.unit}`}</small></b><em>{item.sellerName || '供应商'}</em></div>
                </a>)}
            </div> : <div class="pd-empty-similar">暂无同品类推荐货源</div>}
        </section>
      </main>

      <footer class="hall-footer">
        <div class="hall-container">
          <span>© 2026 农业产业互联网平台 · 丰链云商品详情</span>
          <span>商品、库存与价格来自交易域实时记录；下单与议价需登录。</span>
        </div>
      </footer>
    </div>;
    };
  }
});
export default ProductDetail;
