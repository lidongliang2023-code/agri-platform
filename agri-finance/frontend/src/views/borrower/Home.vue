<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>FINANCING WORKBENCH</small>
        <h1>融资工作台</h1>
        <p>查看授信、融资申请、借款与还款进度，基于真实经营数据管理资金。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新数据</el-button>
        <el-button class="finance-action-button" @click="$router.push('/borrower/loan-apply')">发起融资</el-button>
      </div>
    </header>

    <div v-if="error" class="finance-error">{{ error }}</div>

    <section class="finance-hero">
      <div class="finance-hero-copy">
        <span>农业经营主体专属融资服务</span>
        <h1>{{ financeUser.name }}</h1>
        <p>
          当前信用等级 {{ credit?.creditLevel || '—' }}，获得预授信额度
          {{ money(credit?.availableAmount) }}。平台结合交易、履约和生产数据持续更新融资画像。
        </p>
        <div class="finance-hero-actions">
          <el-button class="hero-primary" @click="$router.push('/borrower/products')">选择融资产品</el-button>
          <el-button class="hero-ghost" @click="$router.push('/borrower/credit')">查看信用报告</el-button>
        </div>
      </div>
      <div class="finance-credit-disc">
        <div>
          <strong>{{ credit?.compositeScore ?? '—' }}</strong>
          <small>综合信用分</small>
        </div>
      </div>
    </section>

    <div class="finance-kpis">
      <article class="finance-kpi">
        <span>可用授信额度</span>
        <strong>{{ money(credit?.availableAmount) }}</strong>
        <small>信用等级 {{ credit?.creditLevel || '—' }}</small>
      </article>
      <article class="finance-kpi">
        <span>当前借款余额</span>
        <strong>{{ money(outstandingAmount) }}</strong>
        <small>{{ activeLoans.length }} 笔借款履约中</small>
      </article>
      <article class="finance-kpi">
        <span>待还计划</span>
        <strong>{{ unpaidPlans.length }}<em> 期</em></strong>
        <small>最近应还 {{ nextPlan ? shortDate(nextPlan.dueDate) : '暂无' }}</small>
      </article>
      <article class="finance-kpi">
        <span>审批中申请</span>
        <strong>{{ pendingApplications.length }}<em> 笔</em></strong>
        <small>{{ unreadMessages.length }} 条未读业务消息</small>
      </article>
    </div>

    <section>
      <div class="home-section-head">
        <div><strong>场景化融资产品</strong><span>根据农业经营场景选择资金方案</span></div>
        <el-button link class="finance-link-button" @click="$router.push('/borrower/products')">全部产品 →</el-button>
      </div>
      <div class="finance-product-grid">
        <article
          v-for="product in financeProducts"
          :key="product.key"
          :class="['finance-product-card', product.tone]"
          @click="openProduct(product)"
        >
          <small>{{ product.eyebrow }}</small>
          <h3>{{ product.name }}</h3>
          <p>{{ product.description }}</p>
          <div class="finance-product-meta">
            <span>{{ product.amount }}</span>
            <span>{{ product.term }}</span>
          </div>
          <div class="finance-product-foot">
            <div class="finance-product-rate"><strong>{{ product.rate }}</strong><small>参考年化</small></div>
            <span>立即申请 →</span>
          </div>
        </article>
      </div>
    </section>

    <div class="finance-grid-two">
      <section class="finance-card">
        <div class="finance-card-head">
          <strong>当前借款</strong>
          <el-button link class="finance-link-button" @click="$router.push('/borrower/loan-management')">查看全部 →</el-button>
        </div>
        <el-table v-if="loans.length" :data="loans.slice(0, 4)" style="width: 100%">
          <el-table-column prop="loanNo" label="借款编号" min-width="145" />
          <el-table-column label="产品" min-width="95">
            <template #default="{ row }">{{ productName(row.productType) }}</template>
          </el-table-column>
          <el-table-column label="借款金额" min-width="110" align="right">
            <template #default="{ row }">{{ money(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="剩余本金" min-width="110" align="right">
            <template #default="{ row }">{{ money(row.remainingAmount) }}</template>
          </el-table-column>
          <el-table-column label="状态" min-width="90">
            <template #default="{ row }"><FinanceStatus :value="row.status" /></template>
          </el-table-column>
          <el-table-column label="操作" width="82" align="right">
            <template #default="{ row }">
              <el-button link class="finance-link-button" @click="$router.push({ path: '/borrower/repayment', query: { loanId: row.id } })">还款</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="finance-empty">
          <strong>暂无借款记录</strong>
          <p>融资申请审批通过并放款后，借款与还款计划会显示在这里。</p>
        </div>
      </section>

      <aside class="home-side-stack">
        <section class="finance-card">
          <div class="finance-card-head"><strong>待办事项</strong><small>需要你处理</small></div>
          <div class="home-todo-list">
            <button type="button" @click="$router.push('/borrower/repayment')">
              <span class="green">还款</span>
              <div><strong>{{ nextPlan ? `第 ${nextPlan.period} 期账单即将到期` : '暂无待还账单' }}</strong><p>{{ nextPlan ? `${shortDate(nextPlan.dueDate)} 应还 ${money(nextPlan.totalAmount)}` : '当前还款计划已处理完毕' }}</p></div>
              <b>→</b>
            </button>
            <button type="button" @click="$router.push('/borrower/credit')">
              <span class="blue">信用</span>
              <div><strong>信用画像已更新</strong><p>综合评分 {{ credit?.compositeScore ?? '—' }}，履约率 {{ credit?.fulfillmentRate ?? '—' }}%</p></div>
              <b>→</b>
            </button>
            <button type="button" @click="$router.push('/borrower/pledge')">
              <span class="amber">质押</span>
              <div><strong>{{ pendingPledges.length }} 笔质押待审核</strong><p>仓单审核通过后可形成新增授信依据</p></div>
              <b>→</b>
            </button>
          </div>
        </section>

        <section class="finance-card home-credit-card">
          <div class="finance-card-head"><strong>信用诊断</strong><FinanceStatus value="正常" /></div>
          <div class="home-credit-body">
            <div><span>经营能力</span><b>{{ credit?.businessAbilityScore ?? 0 }}</b></div>
            <div><span>偿债能力</span><b>{{ credit?.debtAbilityScore ?? 0 }}</b></div>
            <div><span>信用记录</span><b>{{ credit?.creditRecordScore ?? 0 }}</b></div>
            <div><span>经营稳定性</span><b>{{ credit?.stabilityScore ?? 0 }}</b></div>
            <p>{{ credit?.improvementSuggestions || '持续保持订单履约和按期还款，有助于提升授信额度。' }}</p>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, financeUser, money, productName, shortDate } from '@/api/finance'
import { financeProducts } from '@/data/products'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const credit = ref(null)
const loans = ref([])
const applications = ref([])
const plans = ref([])
const pledges = ref([])
const messages = ref([])

const activeLoans = computed(() => loans.value.filter((item) => item.status === '还款中'))
const outstandingAmount = computed(() => activeLoans.value.reduce((total, item) => total + Number(item.remainingAmount || 0), 0))
const unpaidPlans = computed(() => plans.value.filter((item) => item.status !== '已还款'))
const nextPlan = computed(() => [...unpaidPlans.value].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] || null)
const pendingApplications = computed(() => applications.value.filter((item) => item.status === '待审批'))
const pendingPledges = computed(() => pledges.value.filter((item) => item.status === '待审核'))
const unreadMessages = computed(() => messages.value.filter((item) => !item.isRead))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [creditData, loanData, applicationData, planData, pledgeData, messageData] = await Promise.all([
      financeApi.credit(),
      financeApi.loans(),
      financeApi.applications(),
      financeApi.repaymentPlans(),
      financeApi.pledges(),
      financeApi.messages(),
    ])
    credit.value = creditData
    loans.value = loanData || []
    applications.value = applicationData || []
    plans.value = planData || []
    pledges.value = pledgeData || []
    messages.value = messageData || []
  } catch (err) {
    error.value = err.message || '融资工作台加载失败'
  } finally {
    loading.value = false
  }
}

function openProduct(product) {
  router.push({ path: '/borrower/loan-apply', query: { product: product.key } })
}

onMounted(load)
</script>

<style scoped>
.finance-error {
  padding: 10px 13px;
  border: 1px solid #f1c8c4;
  border-radius: 10px;
  background: #fff2f0;
  color: #a8473f;
  font-size: 10px;
}

.finance-hero :deep(.el-button) {
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 9.5px;
}

.finance-hero :deep(.hero-primary) {
  border-color: #fff;
  background: #fff;
  color: var(--fin-green-800);
  font-weight: 750;
}

.finance-hero :deep(.hero-primary:hover) {
  background: #effaf4;
}

.finance-hero :deep(.hero-ghost) {
  border-color: rgba(255, 255, 255, .25);
  background: rgba(255, 255, 255, .08);
  color: #fff;
}

.finance-kpi em {
  color: #61786a;
  font-size: 10px;
  font-style: normal;
}

.home-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: 2px 0 10px;
}

.home-section-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.home-section-head strong {
  color: #244735;
  font-size: 15px;
}

.home-section-head span {
  color: #86968c;
  font-size: 8.5px;
}

.home-side-stack {
  display: grid;
  gap: 14px;
}

.home-todo-list {
  display: grid;
}

.home-todo-list button {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border: 0;
  border-top: 1px solid #edf2ee;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.home-todo-list button:first-child { border-top: 0; }
.home-todo-list button:hover { background: #f8fbf9; }

.home-todo-list button > span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  font-size: 8px;
  font-weight: 750;
}

.home-todo-list button > span.green { background: #e7f6ed; color: #16764a; }
.home-todo-list button > span.blue { background: #eaf3fa; color: #2c6e96; }
.home-todo-list button > span.amber { background: #fff3df; color: #a6650f; }

.home-todo-list button > div {
  min-width: 0;
}

.home-todo-list strong {
  display: block;
  overflow: hidden;
  color: #3a5545;
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-todo-list p {
  overflow: hidden;
  margin: 3px 0 0;
  color: #87968d;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-todo-list b {
  color: #9aa69f;
  font-size: 10px;
}

.home-credit-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: #edf2ee;
}

.home-credit-body > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 13px;
  background: #fff;
}

.home-credit-body span {
  color: #7c8e82;
  font-size: 8.5px;
}

.home-credit-body b {
  color: #2d6042;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}

.home-credit-body p {
  grid-column: 1 / -1;
  margin: 0;
  padding: 10px 13px;
  background: #f7fbf8;
  color: #71847a;
  font-size: 8.5px;
  line-height: 1.6;
}
</style>
