<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>CREDIT CENTER</small>
        <h1>信用中心</h1>
        <p>基于平台交易、履约、生产经营和融资记录形成融资信用画像。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">更新评估</el-button>
        <el-button class="finance-action-button" @click="$router.push('/borrower/products')">使用授信额度</el-button>
      </div>
    </header>

    <div v-if="error" class="credit-error">{{ error }}</div>

    <section class="credit-hero">
      <div class="credit-score-ring" :style="{ '--score-angle': `${scorePercent * 3.6}deg` }">
        <div>
          <strong>{{ credit?.compositeScore ?? '—' }}</strong>
          <span>{{ credit?.creditLevel || '—' }} 级</span>
        </div>
      </div>
      <div class="credit-hero-copy">
        <small>当前信用评级</small>
        <h2>{{ levelTitle }}</h2>
        <p>{{ credit?.riskAlerts || '当前信用表现稳定，暂无风险提示。' }}</p>
        <div class="credit-hero-meta">
          <span>可用授信 <b>{{ money(credit?.availableAmount) }}</b></span>
          <span>参考利率 <b>{{ credit?.referenceRate ?? '—' }}%</b></span>
          <span>较上期 <b>{{ credit?.scoreChange > 0 ? '+' : '' }}{{ credit?.scoreChange ?? 0 }}</b></span>
        </div>
      </div>
    </section>

    <div class="finance-kpis">
      <article class="finance-kpi">
        <span>平台经营月数</span>
        <strong>{{ credit?.platformMonths ?? 0 }}<em> 月</em></strong>
        <small>持续经营记录</small>
      </article>
      <article class="finance-kpi">
        <span>累计交易规模</span>
        <strong>{{ compactMoney(credit?.totalTransactionAmount) }}</strong>
        <small>平台有效交易口径</small>
      </article>
      <article class="finance-kpi">
        <span>履约率</span>
        <strong>{{ credit?.fulfillmentRate ?? 0 }}<em>%</em></strong>
        <small>订单交付完成情况</small>
      </article>
      <article class="finance-kpi">
        <span>历史逾期</span>
        <strong>{{ credit?.overdueCount ?? 0 }}<em> 次</em></strong>
        <small>{{ credit?.overdueCount ? '需关注还款表现' : '当前无逾期记录' }}</small>
      </article>
    </div>

    <div class="credit-layout">
      <section class="finance-card">
        <div class="finance-card-head"><strong>信用维度评分</strong><small>满分 100 分</small></div>
        <div class="credit-dimensions">
          <div v-for="item in dimensions" :key="item.label">
            <div><span>{{ item.label }}</span><b>{{ item.value }}<small>/100</small></b></div>
            <el-progress :percentage="item.value" :stroke-width="7" :show-text="false" />
            <p>{{ item.desc }}</p>
          </div>
        </div>
      </section>

      <aside class="finance-card credit-advice">
        <div class="finance-card-head"><strong>信用提升建议</strong><small>智能诊断</small></div>
        <div class="credit-advice-body">
          <div><b>01</b><p>保持采购订单和销售订单按期履约，稳定平台交易数据。</p></div>
          <div><b>02</b><p>按期归还融资本息，避免形成逾期和风险预警。</p></div>
          <div><b>03</b><p>补充仓单、订单确权或设备资产证明，有助于提升授信额度。</p></div>
          <div><b>04</b><p>持续接入生产与物联网数据，丰富经营真实性画像。</p></div>
        </div>
        <div class="credit-suggestion">{{ credit?.improvementSuggestions || '暂无新增建议，请继续保持当前经营和履约表现。' }}</div>
      </aside>
    </div>

    <section class="finance-card">
      <div class="finance-card-head"><strong>信用档案</strong><small>最近更新时间 {{ shortDate(credit?.evaluationTime) }}</small></div>
      <div class="credit-file-grid">
        <div><span>信用主体</span><strong>{{ financeUser.name }}</strong><small>平台认证经营主体</small></div>
        <div><span>信用等级</span><strong>{{ credit?.creditLevel || '—' }}</strong><small>综合评分 {{ credit?.compositeScore ?? '—' }}</small></div>
        <div><span>历史复购率</span><strong>{{ credit?.repurchaseRate ?? 0 }}%</strong><small>交易关系稳定度</small></div>
        <div><span>当前风险提示</span><strong>{{ credit?.overdueCount ? '需关注' : '正常' }}</strong><small>{{ credit?.riskAlerts || '暂无异常' }}</small></div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { financeApi, financeUser, money, shortDate } from '@/api/finance'

const loading = ref(true)
const error = ref('')
const credit = ref(null)

const scorePercent = computed(() => Math.max(0, Math.min(100, ((Number(credit.value?.compositeScore || 0) - 350) / 500) * 100)))
const levelTitle = computed(() => {
  const level = credit.value?.creditLevel
  if (level === 'AAA') return '经营与信用表现优秀'
  if (level === 'AA') return '经营与信用表现良好'
  if (level === 'A') return '信用表现稳定'
  return '信用画像持续完善中'
})

const dimensions = computed(() => [
  { label: '经营能力', value: Number(credit.value?.businessAbilityScore || 0), desc: '订单规模、收入稳定性和经营活跃度' },
  { label: '偿债能力', value: Number(credit.value?.debtAbilityScore || 0), desc: '资产负债结构与现金流覆盖情况' },
  { label: '信用记录', value: Number(credit.value?.creditRecordScore || 0), desc: '历史融资、还款和逾期表现' },
  { label: '稳定性', value: Number(credit.value?.stabilityScore || 0), desc: '平台经营时长、交易连续性和履约表现' },
])

function compactMoney(value) {
  const amount = Number(value || 0)
  return amount >= 10000 ? `¥${(amount / 10000).toFixed(1)}万` : money(amount)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    credit.value = await financeApi.credit()
  } catch (err) {
    error.value = err.message || '信用报告加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.credit-error {
  padding: 10px 13px;
  border: 1px solid #f1c8c4;
  border-radius: 10px;
  background: #fff2f0;
  color: #a8473f;
  font-size: 10px;
}

.credit-hero {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  align-items: center;
  gap: 26px;
  padding: 27px 30px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 88% 8%, rgba(126, 228, 169, .17), transparent 13rem),
    linear-gradient(135deg, #083c27, #0f7048);
  color: #fff;
}

.credit-score-ring {
  display: grid;
  width: 154px;
  height: 154px;
  place-items: center;
  border-radius: 50%;
  background:
    radial-gradient(circle closest-side, #0b5637 82%, transparent 84% 99%),
    conic-gradient(#a5ecc0 var(--score-angle), rgba(255, 255, 255, .12) 0);
  box-shadow: 0 0 0 12px rgba(255, 255, 255, .04);
}

.credit-score-ring > div {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.credit-score-ring strong {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 37px;
}

.credit-score-ring span {
  color: rgba(255, 255, 255, .57);
  font-size: 9px;
}

.credit-hero-copy > small {
  color: #a9dfbe;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .1em;
}

.credit-hero-copy h2 {
  margin: 7px 0 5px;
  font-size: 24px;
}

.credit-hero-copy > p {
  margin: 0;
  color: rgba(255, 255, 255, .62);
  font-size: 9px;
}

.credit-hero-meta {
  display: flex;
  gap: 24px;
  margin-top: 18px;
}

.credit-hero-meta span {
  color: rgba(255, 255, 255, .56);
  font-size: 8px;
}

.credit-hero-meta b {
  display: block;
  margin-top: 3px;
  color: #fff;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 14px;
}

.finance-kpi em {
  color: #60776a;
  font-size: 10px;
  font-style: normal;
}

.credit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
  align-items: start;
  gap: 14px;
}

.credit-dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px 22px;
  padding: 17px;
}

.credit-dimensions > div > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}

.credit-dimensions span {
  color: #506a59;
  font-size: 9px;
  font-weight: 650;
}

.credit-dimensions b {
  color: var(--fin-green-800);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}

.credit-dimensions b small {
  color: #97a49c;
  font-size: 7px;
  font-weight: 500;
}

.credit-dimensions p {
  margin: 6px 0 0;
  color: #89978f;
  font-size: 7.5px;
}

.credit-advice-body {
  display: grid;
  padding: 13px 15px;
}

.credit-advice-body > div {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid #edf2ee;
}

.credit-advice-body > div:first-child { border-top: 0; }

.credit-advice-body b {
  color: var(--fin-green-700);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 8px;
}

.credit-advice-body p {
  margin: 0;
  color: #74877b;
  font-size: 8.5px;
  line-height: 1.6;
}

.credit-suggestion {
  margin: 0 15px 15px;
  padding: 10px;
  border-radius: 9px;
  background: #eff9f3;
  color: #557260;
  font-size: 8.5px;
  line-height: 1.6;
}

.credit-file-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.credit-file-grid > div {
  padding: 14px 16px;
  border-left: 1px solid #edf2ee;
}

.credit-file-grid > div:first-child { border-left: 0; }

.credit-file-grid span,
.credit-file-grid strong,
.credit-file-grid small {
  display: block;
}

.credit-file-grid span {
  color: #87988e;
  font-size: 8px;
}

.credit-file-grid strong {
  margin-top: 4px;
  color: #365442;
  font-size: 11px;
}

.credit-file-grid small {
  margin-top: 3px;
  color: #9ca7a0;
  font-size: 7.5px;
}

@media (max-width: 980px) {
  .credit-layout { grid-template-columns: 1fr; }
  .credit-file-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .credit-file-grid > div:nth-child(3) { border-left: 0; border-top: 1px solid #edf2ee; }
  .credit-file-grid > div:nth-child(4) { border-top: 1px solid #edf2ee; }
}

@media (max-width: 620px) {
  .credit-hero { grid-template-columns: 1fr; text-align: center; }
  .credit-score-ring { margin: 0 auto; }
  .credit-hero-meta { justify-content: center; flex-wrap: wrap; gap: 14px; }
  .credit-dimensions { grid-template-columns: 1fr; }
  .credit-file-grid { grid-template-columns: 1fr; }
  .credit-file-grid > div { border-top: 1px solid #edf2ee; border-left: 0; }
  .credit-file-grid > div:first-child { border-top: 0; }
}
</style>
