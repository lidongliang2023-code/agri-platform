<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>REPAYMENT CENTER</small>
        <h1>还款中心</h1>
        <p>查看全部待还计划、应还本息和历史还款记录，完成还款后借款余额同步更新。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新计划</el-button>
        <el-button class="finance-action-button" @click="$router.push('/borrower/loan-management')">我的借款</el-button>
      </div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi">
        <span>待还本金</span>
        <strong>{{ money(outstandingPrincipal) }}</strong>
        <small>{{ unpaidPlans.length }} 期未还</small>
      </article>
      <article class="finance-kpi">
        <span>未来 30 天应还</span>
        <strong>{{ money(dueIn30Days) }}</strong>
        <small>包含本金与利息</small>
      </article>
      <article class="finance-kpi">
        <span>累计已还</span>
        <strong>{{ money(totalPaid) }}</strong>
        <small>{{ paidPlans.length }} 期已结清</small>
      </article>
      <article class="finance-kpi">
        <span>下一还款日</span>
        <strong class="date-value">{{ nextPlan ? shortDate(nextPlan.dueDate).slice(0, 10) : '—' }}</strong>
        <small>{{ nextPlan ? `应还 ${money(nextPlan.totalAmount)}` : '暂无待还账单' }}</small>
      </article>
    </div>

    <div class="repay-layout">
      <section class="finance-card">
        <div class="finance-card-head">
          <strong>待还计划</strong>
          <div class="finance-tabs">
            <button type="button" :class="{ on: planStatus === 'unpaid' }" @click="planStatus = 'unpaid'">待还款</button>
            <button type="button" :class="{ on: planStatus === 'paid' }" @click="planStatus = 'paid'">已还款</button>
          </div>
        </div>
        <div v-if="displayedPlans.length" class="repayment-list">
          <article v-for="plan in displayedPlans" :key="plan.id" :class="{ overdue: isOverdue(plan) }">
            <div class="repayment-period">
              <span>第 {{ plan.period }} 期</span>
              <FinanceStatus :value="plan.status" />
            </div>
            <div class="repayment-main">
              <strong>{{ plan.loanNo }}</strong>
              <p>{{ isOverdue(plan) ? '该期账单已逾期，请尽快处理' : `应还日期 ${shortDate(plan.dueDate)}` }}</p>
              <div class="repayment-breakdown">
                <span>本金 <b>{{ money(plan.principal) }}</b></span>
                <span>利息 <b>{{ money(plan.interest) }}</b></span>
              </div>
            </div>
            <div class="repayment-total">
              <span>本期应还</span>
              <strong>{{ money(plan.totalAmount) }}</strong>
              <el-button v-if="plan.status !== '已还款'" class="finance-action-button" :loading="payingId === plan.id" @click="repay(plan)">立即还款</el-button>
              <small v-else>{{ shortDate(plan.paidDate) }} 已还</small>
            </div>
          </article>
        </div>
        <div v-else class="finance-empty">
          <strong>{{ planStatus === 'paid' ? '暂无历史还款记录' : '当前没有待还账单' }}</strong>
          <p>还款计划由借款确认后自动生成，按期还款后记录会保存在这里。</p>
        </div>
      </section>

      <aside class="repay-aside">
        <section class="repay-summary">
          <small>REPAYMENT OVERVIEW</small>
          <span>当前待还总额</span>
          <strong>{{ money(totalUnpaid) }}</strong>
          <div>
            <p><span>本金</span><b>{{ money(outstandingPrincipal) }}</b></p>
            <p><span>利息</span><b>{{ money(outstandingInterest) }}</b></p>
          </div>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>还款方式</strong><small>按合同计划执行</small></div>
          <div class="repay-method">
            <div><b>01</b><span>还款将优先结清指定期次的应还本金与利息。</span></div>
            <div><b>02</b><span>完成还款后，借款剩余本金和状态自动更新。</span></div>
            <div><b>03</b><span>建议在到期日前完成，保持良好信用记录。</span></div>
          </div>
        </section>
      </aside>
    </div>

    <section class="finance-card">
      <div class="finance-card-head"><strong>全部还款计划</strong><small>{{ plans.length }} 条计划</small></div>
      <el-table :data="plans" style="width: 100%">
        <el-table-column prop="loanNo" label="借款编号" min-width="145" />
        <el-table-column prop="period" label="期次" width="65" align="center" />
        <el-table-column label="应还本金" min-width="105" align="right">
          <template #default="{ row }">{{ money(row.principal) }}</template>
        </el-table-column>
        <el-table-column label="应还利息" min-width="100" align="right">
          <template #default="{ row }">{{ money(row.interest) }}</template>
        </el-table-column>
        <el-table-column label="应还总额" min-width="110" align="right">
          <template #default="{ row }">{{ money(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="还款日期" min-width="125">
          <template #default="{ row }">{{ shortDate(row.dueDate) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><FinanceStatus :value="row.status" /></template>
        </el-table-column>
      </el-table>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, money, shortDate } from '@/api/finance'

const loading = ref(true)
const payingId = ref('')
const plans = ref([])
const planStatus = ref('unpaid')

const unpaidPlans = computed(() => plans.value.filter((item) => item.status !== '已还款'))
const paidPlans = computed(() => plans.value.filter((item) => item.status === '已还款'))
const totalUnpaid = computed(() => unpaidPlans.value.reduce((total, item) => total + Number(item.totalAmount || 0), 0))
const outstandingPrincipal = computed(() => unpaidPlans.value.reduce((total, item) => total + Number(item.principal || 0), 0))
const outstandingInterest = computed(() => unpaidPlans.value.reduce((total, item) => total + Number(item.interest || 0), 0))
const totalPaid = computed(() => paidPlans.value.reduce((total, item) => total + Number(item.totalAmount || 0), 0))
const dueIn30Days = computed(() => unpaidPlans.value
  .filter((item) => new Date(item.dueDate).getTime() <= Date.now() + 30 * 86400000)
  .reduce((total, item) => total + Number(item.totalAmount || 0), 0))
const nextPlan = computed(() => [...unpaidPlans.value].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] || null)
const displayedPlans = computed(() => planStatus.value === 'paid' ? paidPlans.value : unpaidPlans.value)

function isOverdue(plan) {
  return plan.status !== '已还款' && new Date(plan.dueDate).getTime() < Date.now()
}

async function repay(plan) {
  await ElMessageBox.confirm(
    `确认归还第 ${plan.period} 期账单 ${money(plan.totalAmount)}？`,
    '确认还款',
    { confirmButtonText: '确认还款', cancelButtonText: '取消', type: 'info' },
  )
  payingId.value = plan.id
  try {
    await financeApi.payRepayment(plan.id)
    ElMessage.success('还款成功，借款余额已更新')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '还款失败')
  } finally {
    payingId.value = ''
  }
}

async function load() {
  loading.value = true
  try {
    plans.value = (await financeApi.repaymentPlans()) || []
  } catch (err) {
    ElMessage.error(err.message || '还款计划加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi .date-value {
  font-size: 16px;
}

.repay-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  align-items: start;
  gap: 14px;
}

.repayment-list {
  display: grid;
}

.repayment-list article {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 145px;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-top: 1px solid #edf2ee;
}

.repayment-list article:first-child { border-top: 0; }
.repayment-list article.overdue { background: #fff8f7; }

.repayment-period span {
  display: block;
  margin-bottom: 6px;
  color: #3f5b49;
  font-size: 11px;
  font-weight: 700;
}

.repayment-main strong {
  color: #415d4c;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 9px;
}

.repayment-main > p {
  margin: 4px 0 8px;
  color: #8a9991;
  font-size: 8px;
}

.repayment-breakdown {
  display: flex;
  gap: 10px;
}

.repayment-breakdown span {
  color: #7c8e82;
  font-size: 8px;
}

.repayment-breakdown b {
  color: #435d4c;
}

.repayment-total {
  text-align: right;
}

.repayment-total > span,
.repayment-total > strong,
.repayment-total > small {
  display: block;
}

.repayment-total > span {
  color: #8a9990;
  font-size: 7.5px;
}

.repayment-total > strong {
  margin: 2px 0 7px;
  color: #d0523f;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
}

.repayment-total > small {
  color: #95a098;
  font-size: 8px;
}

.repay-aside {
  display: grid;
  gap: 12px;
}

.repay-summary {
  padding: 18px;
  border-radius: 15px;
  background:
    radial-gradient(circle at 88% 10%, rgba(131, 228, 170, .18), transparent 10rem),
    linear-gradient(135deg, #083c27, #0f7048);
  color: #fff;
}

.repay-summary small,
.repay-summary > span,
.repay-summary > strong {
  display: block;
}

.repay-summary > small {
  color: #a8dfbd;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: .1em;
}

.repay-summary > span {
  margin-top: 13px;
  color: rgba(255, 255, 255, .57);
  font-size: 8px;
}

.repay-summary > strong {
  margin-top: 4px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 25px;
}

.repay-summary > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(255, 255, 255, .12);
}

.repay-summary p {
  margin: 0;
  padding: 9px;
  background: rgba(255, 255, 255, .06);
}

.repay-summary p span,
.repay-summary p b {
  display: block;
}

.repay-summary p span {
  color: rgba(255, 255, 255, .48);
  font-size: 7px;
}

.repay-summary p b {
  margin-top: 2px;
  font-size: 9px;
}

.repay-method {
  display: grid;
  padding: 13px 15px;
}

.repay-method > div {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid #edf2ee;
}

.repay-method > div:first-child { border-top: 0; }

.repay-method b {
  color: var(--fin-green-700);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 8px;
}

.repay-method span {
  color: #71857a;
  font-size: 8.5px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .repay-layout { grid-template-columns: 1fr; }
  .repay-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .repayment-list article { grid-template-columns: 1fr auto; }
  .repayment-main { grid-column: 1 / -1; grid-row: 2; }
  .repayment-total { grid-column: 2; grid-row: 1 / span 2; }
  .repay-aside { grid-template-columns: 1fr; }
}
</style>
