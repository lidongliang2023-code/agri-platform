<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>FINANCING PRODUCTS</small>
        <h1>融资产品中心</h1>
        <p>围绕农业采购、生产、销售和设备投入，选择与经营周期匹配的资金方案。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" @click="$router.push('/borrower/credit')">查看信用额度</el-button>
      </div>
    </header>

    <section class="product-credit-banner">
      <div>
        <span>当前预授信额度</span>
        <strong>{{ loading ? '读取中…' : money(credit?.availableAmount) }}</strong>
        <p>
          信用等级 {{ credit?.creditLevel || '—' }} · 参考年化利率
          {{ credit?.referenceRate != null ? `${credit.referenceRate}%` : '—' }}
        </p>
      </div>
      <div class="product-credit-steps">
        <span><b>01</b>选择产品</span>
        <i />
        <span><b>02</b>提交申请</span>
        <i />
        <span><b>03</b>审批放款</span>
        <i />
        <span><b>04</b>按期还款</span>
      </div>
    </section>

    <div class="product-catalog-grid">
      <article
        v-for="(product, index) in financeProducts"
        :key="product.key"
        :class="['product-catalog-card', product.tone]"
      >
        <div class="product-catalog-head">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <small>{{ product.eyebrow }}</small>
        </div>
        <h2>{{ product.name }}</h2>
        <p>{{ product.description }}</p>
        <div class="product-catalog-tags">
          <span v-for="tag in product.tags" :key="tag">{{ tag }}</span>
        </div>
        <dl>
          <div><dt>额度</dt><dd>{{ product.amount }}</dd></div>
          <div><dt>利率</dt><dd class="rate">{{ product.rate }}</dd></div>
          <div><dt>期限</dt><dd>{{ product.term }}</dd></div>
        </dl>
        <el-button class="finance-action-button" @click="apply(product)">申请此产品</el-button>
      </article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head">
        <strong>申请前提示</strong>
        <small>实际额度、利率和期限以平台审批结果为准</small>
      </div>
      <div class="product-notices">
        <div><b>01</b><span>申请主体需完成企业或个人实名认证，并绑定当前经营主体。</span></div>
        <div><b>02</b><span>收购贷、销售贷需提供真实订单或仓单等贸易背景材料。</span></div>
        <div><b>03</b><span>按时履约和还款有助于提升信用等级与后续授信额度。</span></div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { financeApi, money } from '@/api/finance'
import { financeProducts } from '@/data/products'

const router = useRouter()
const credit = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    credit.value = await financeApi.credit()
  } finally {
    loading.value = false
  }
})

function apply(product) {
  router.push({ path: '/borrower/loan-apply', query: { product: product.key } })
}
</script>

<style scoped>
.product-credit-banner {
  display: grid;
  grid-template-columns: minmax(230px, .72fr) minmax(0, 1.28fr);
  align-items: center;
  gap: 24px;
  padding: 22px 24px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 90% 8%, rgba(125, 228, 168, .18), transparent 13rem),
    linear-gradient(135deg, #083c27, #0f7048);
  color: #fff;
}

.product-credit-banner span,
.product-credit-banner strong,
.product-credit-banner p {
  display: block;
}

.product-credit-banner > div:first-child > span {
  color: rgba(255, 255, 255, .62);
  font-size: 9px;
}

.product-credit-banner strong {
  margin-top: 4px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 28px;
}

.product-credit-banner p {
  margin: 4px 0 0;
  color: rgba(255, 255, 255, .55);
  font-size: 8.5px;
}

.product-credit-steps {
  display: flex;
  align-items: center;
}

.product-credit-steps span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, .7);
  font-size: 8.5px;
  white-space: nowrap;
}

.product-credit-steps b {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 8px;
  background: rgba(255, 255, 255, .08);
  color: #d9f5e4;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 7px;
}

.product-credit-steps i {
  width: 22px;
  height: 1px;
  margin: 0 5px;
  background: rgba(255, 255, 255, .26);
}

.product-catalog-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 11px;
}

.product-catalog-card {
  padding: 16px;
  border: 1px solid var(--fin-line);
  border-radius: 15px;
  background: #fff;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.product-catalog-card:hover {
  border-color: #9dcdb1;
  box-shadow: 0 12px 26px rgba(18, 70, 42, .07);
  transform: translateY(-2px);
}

.product-catalog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-catalog-head > span {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border-radius: 9px;
  background: #e9f7ef;
  color: #12764a;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 8px;
  font-weight: 800;
}

.product-catalog-card.amber .product-catalog-head > span { background: #fff4e2; color: #a96a12; }
.product-catalog-card.blue .product-catalog-head > span { background: #eaf4fb; color: #276d96; }
.product-catalog-card.violet .product-catalog-head > span { background: #f1eefb; color: #6856a1; }
.product-catalog-card.teal .product-catalog-head > span { background: #e9f7f5; color: #247970; }

.product-catalog-head small {
  color: #93a098;
  font-size: 6.5px;
  font-weight: 700;
  letter-spacing: .08em;
}

.product-catalog-card h2 {
  margin: 15px 0 7px;
  color: #274735;
  font-size: 17px;
}

.product-catalog-card > p {
  min-height: 52px;
  margin: 0;
  color: #7d8e83;
  font-size: 9px;
  line-height: 1.65;
}

.product-catalog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 11px 0;
}

.product-catalog-tags span {
  padding: 3px 7px;
  border-radius: 6px;
  background: #f3f8f5;
  color: #5e7967;
  font-size: 8px;
}

.product-catalog-card dl {
  display: grid;
  gap: 6px;
  margin: 0 0 14px;
}

.product-catalog-card dl > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-catalog-card dt {
  color: #8a9990;
  font-size: 8px;
}

.product-catalog-card dd {
  margin: 0;
  color: #425c4c;
  font-size: 9px;
  font-weight: 650;
}

.product-catalog-card dd.rate {
  color: #d1533f;
}

.product-catalog-card :deep(.el-button) {
  width: 100%;
}

.product-notices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: #edf2ee;
}

.product-notices > div {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 14px 16px;
  background: #fff;
}

.product-notices b {
  color: #1e7e51;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 9px;
}

.product-notices span {
  color: #71857a;
  font-size: 9px;
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .product-catalog-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .product-credit-banner { grid-template-columns: 1fr; }
  .product-credit-steps { flex-wrap: wrap; gap: 8px; }
  .product-credit-steps i { display: none; }
  .product-catalog-grid,
  .product-notices { grid-template-columns: 1fr; }
}
</style>
