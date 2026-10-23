<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>FINANCE OPERATIONS</small><h1>运营工作台</h1><p>统一监控融资审批、信用风险、质押资产和逾期催收。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新数据</el-button><el-button class="finance-action-button" @click="$router.push('/admin/approval')">处理待审批</el-button></div>
    </header>

    <section class="ops-hero">
      <div>
        <span>AI RISK OPERATIONS</span>
        <h1>供应链金融风控运营中心</h1>
        <p>风险规则、信用数据、仓单质押和贷后表现在同一工作台联动。</p>
        <div><b>{{ riskRules.filter((item) => item.status === '启用').length }}</b><span>条启用风控规则</span><i /> <b>{{ overdue.length }}</b><span>笔逾期关注</span></div>
      </div>
      <div class="ops-hero-risk">
        <span>风险健康度</span>
        <strong>{{ riskHealth }}</strong>
        <small>/ 100</small>
        <em>贷后组合稳定</em>
      </div>
    </section>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>待审批申请</span><strong>{{ pending.length }}<em> 笔</em></strong><small>申请金额 {{ compactMoney(pendingAmount) }}</small></article>
      <article class="finance-kpi"><span>在贷余额</span><strong>{{ compactMoney(outstanding) }}</strong><small>{{ activeLoans }} 笔履约中</small></article>
      <article class="finance-kpi"><span>逾期金额</span><strong>{{ compactMoney(overdueAmount) }}</strong><small>{{ overdue.length }} 笔逾期记录</small></article>
      <article class="finance-kpi"><span>质押仓单</span><strong>{{ pledges.length }}<em> 笔</em></strong><small>{{ pendingPledges }} 笔待审核</small></article>
    </div>

    <div class="ops-dashboard-layout">
      <section class="finance-card">
        <div class="finance-card-head"><strong>审批队列</strong><el-button link class="finance-link-button" @click="$router.push('/admin/approval')">全部 →</el-button></div>
        <el-table v-if="applications.length" :data="applications.slice(0, 6)" style="width: 100%">
          <el-table-column label="融资主体" min-width="160"><template #default="{ row }"><div class="ops-subject"><span>{{ row.userName?.slice(0, 1) || '农' }}</span><div><strong>{{ row.userName }}</strong><small>{{ row.applicationNo }}</small></div></div></template></el-table-column>
          <el-table-column label="产品" min-width="100"><template #default="{ row }">{{ productName(row.productType) }}</template></el-table-column>
          <el-table-column label="申请金额" min-width="110" align="right"><template #default="{ row }">{{ compactMoney(row.applyAmount) }}</template></el-table-column>
          <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        </el-table>
        <div v-else class="finance-empty"><strong>暂无融资申请</strong><p>新的融资申请会进入审批队列。</p></div>
      </section>

      <aside class="ops-side">
        <section class="finance-card">
          <div class="finance-card-head"><strong>风险预警</strong><span class="finance-muted">{{ overdue.length }} 条</span></div>
          <div class="ops-alert-list">
            <button v-for="item in overdue.slice(0, 3)" :key="item.id" type="button" @click="$router.push('/admin/overdue')">
              <span class="ops-alert-level">{{ item.overdueStage }}</span>
              <div><strong>{{ item.userName }} · 逾期 {{ item.overdueDays }} 天</strong><p>{{ money(item.overdueAmount) }} · {{ item.overdueReason }}</p></div>
              <Warning />
            </button>
            <div v-if="!overdue.length" class="ops-empty">暂无风险预警</div>
          </div>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>规则运行状态</strong><FinanceStatus value="正常" /></div>
          <div class="ops-rule-summary">
            <div><span>信用规则</span><strong>{{ countRules('CREDIT') }}</strong></div>
            <div><span>还款规则</span><strong>{{ countRules('REPAYMENT') }}</strong></div>
            <div><span>质押规则</span><strong>{{ countRules('PLEDGE') }}</strong></div>
            <div><span>IoT规则</span><strong>{{ countRules('IOT') }}</strong></div>
          </div>
        </section>
      </aside>
    </div>

    <section class="finance-card">
      <div class="finance-card-head"><strong>贷后资产监控</strong><small>按风险阶段排序</small></div>
      <div class="ops-monitor-grid">
        <div><span>正常履约</span><strong>{{ activeLoans }} 笔</strong><div class="finance-progress"><span :style="{ width: `${normalPercent}%` }" /></div><small>{{ compactMoney(outstanding) }} 在贷</small></div>
        <div><span>中期逾期</span><strong>{{ mediumOverdue }} 笔</strong><div class="finance-progress amber"><span :style="{ width: `${mediumPercent}%` }" /></div><small>需制定催收方案</small></div>
        <div><span>高风险资产</span><strong>{{ highRiskCount }} 笔</strong><div class="finance-progress red"><span :style="{ width: `${highPercent}%` }" /></div><small>黑名单及长期逾期</small></div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Warning } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money, productName } from '@/api/finance'

const loading = ref(true)
const applications = ref([])
const loans = ref([])
const overdue = ref([])
const pledges = ref([])
const riskRules = ref([])
const blacklist = ref([])
const pending = computed(() => applications.value.filter((item) => item.status === '待审批'))
const pendingAmount = computed(() => pending.value.reduce((total, item) => total + Number(item.applyAmount || 0), 0))
const activeLoans = computed(() => loans.value.filter((item) => item.status === '还款中').length)
const outstanding = computed(() => loans.value.reduce((total, item) => total + Number(item.remainingAmount || 0), 0))
const overdueAmount = computed(() => overdue.value.reduce((total, item) => total + Number(item.overdueAmount || 0), 0))
const pendingPledges = computed(() => pledges.value.filter((item) => item.status === '待审核').length)
const normalPercent = computed(() => loans.value.length ? activeLoans.value / loans.value.length * 100 : 0)
const mediumOverdue = computed(() => overdue.value.filter((item) => item.overdueStage === '中期').length)
const mediumPercent = computed(() => overdue.value.length ? mediumOverdue.value / overdue.value.length * 100 : 0)
const highRiskCount = computed(() => overdue.value.filter((item) => item.overdueDays > 30).length + blacklist.value.filter((item) => item.reviewStatus === '已通过').length)
const highPercent = computed(() => Math.min(100, highRiskCount.value * 25))
const riskHealth = computed(() => Math.max(60, Math.min(98, 96 - overdue.value.length * 3 - pending.value.length)))

function countRules(type) {
  return riskRules.value.filter((item) => item.ruleType === type && item.status === '启用').length
}

async function load() {
  loading.value = true
  try {
    const [applicationData, loanData, overdueData, pledgeData, ruleData, blacklistData] = await Promise.all([
      operationsApi.applications(), operationsApi.loans(), operationsApi.overdue(), operationsApi.pledges(),
      operationsApi.riskRules(), operationsApi.blacklist(),
    ])
    applications.value = applicationData || []
    loans.value = loanData || []
    overdue.value = overdueData || []
    pledges.value = pledgeData || []
    riskRules.value = ruleData || []
    blacklist.value = blacklistData || []
  } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.ops-hero { display: flex; min-height: 180px; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 28px; border-radius: 18px; background: radial-gradient(circle at 88% 9%, rgba(131, 228, 170, .18), transparent 13rem), linear-gradient(135deg, #083c27, #0f7048); color: #fff; }
.ops-hero > div:first-child > span { color: #a9dfbe; font-size: 8px; letter-spacing: .12em; font-weight: 800; }
.ops-hero h1 { margin: 9px 0 5px; font-size: 26px; }
.ops-hero p { margin: 0; color: rgba(255, 255, 255, .6); font-size: 9px; }
.ops-hero > div:first-child > div { display: flex; align-items: baseline; gap: 5px; margin-top: 18px; }
.ops-hero b { font-family: ui-monospace, Consolas, monospace; font-size: 22px; }
.ops-hero > div:first-child span { color: rgba(255, 255, 255, .55); font-size: 8px; }
.ops-hero i { width: 1px; height: 15px; margin: 0 10px; background: rgba(255, 255, 255, .18); }
.ops-hero-risk { display: flex; width: 150px; height: 150px; align-items: center; justify-content: center; flex-direction: column; margin-right: 20px; border: 1px solid rgba(255, 255, 255, .16); border-radius: 50%; background: rgba(255, 255, 255, .07); box-shadow: 0 0 0 13px rgba(255, 255, 255, .035); }
.ops-hero-risk span { color: rgba(255, 255, 255, .55); font-size: 8px; }
.ops-hero-risk strong { margin-top: 4px; font-family: ui-monospace, Consolas, monospace; font-size: 35px; }
.ops-hero-risk small { margin-top: -3px; color: rgba(255, 255, 255, .44); font-size: 8px; }
.ops-hero-risk em { margin-top: 6px; color: #bcefd0; font-size: 8px; font-style: normal; }
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.ops-dashboard-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); align-items: start; gap: 14px; }
.ops-subject { display: flex; align-items: center; gap: 8px; }
.ops-subject > span { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 8px; background: #e8f5ee; color: var(--fin-green-700); font-size: 8px; font-weight: 700; }
.ops-subject strong, .ops-subject small { display: block; }
.ops-subject strong { color: #3a5544; font-size: 9.5px; }
.ops-subject small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: 7px; }
.ops-side { display: grid; gap: 14px; }
.ops-alert-list { display: grid; }
.ops-alert-list button { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 11px 13px; border: 0; border-top: 1px solid #edf2ee; background: #fff; text-align: left; cursor: pointer; }
.ops-alert-list button:first-child { border-top: 0; }
.ops-alert-level { padding: 3px 7px; border-radius: 7px; background: #fff1e1; color: #a76712; font-size: 7px; font-weight: 700; }
.ops-alert-list button > div { min-width: 0; }
.ops-alert-list strong, .ops-alert-list p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-alert-list strong { color: #425b4b; font-size: 8.5px; }
.ops-alert-list p { margin: 3px 0 0; color: #8b9a92; font-size: 7.5px; }
.ops-alert-list svg { width: 14px; color: #c58b2e; }
.ops-empty { padding: 18px; color: #8c9a92; font-size: 8px; text-align: center; }
.ops-rule-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #edf2ee; }
.ops-rule-summary > div { padding: 11px 13px; background: #fff; }
.ops-rule-summary span, .ops-rule-summary strong { display: block; }
.ops-rule-summary span { color: #8a9990; font-size: 8px; }
.ops-rule-summary strong { margin-top: 3px; color: #2f5c41; font-family: ui-monospace, Consolas, monospace; font-size: 14px; }
.ops-monitor-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px; }
.ops-monitor-grid > div { padding: 13px; border: 1px solid #e3ebe6; border-radius: 11px; }
.ops-monitor-grid span, .ops-monitor-grid strong, .ops-monitor-grid small { display: block; }
.ops-monitor-grid span { color: #87988e; font-size: 8px; }
.ops-monitor-grid strong { margin-top: 3px; color: #294f38; font-size: 14px; }
.ops-monitor-grid small { margin-top: 5px; color: #89988f; font-size: 7.5px; }
.finance-progress.amber > span { background: #d79b39; }
.finance-progress.red > span { background: #bf5b4f; }
@media (max-width: 900px) { .ops-dashboard-layout { grid-template-columns: 1fr; } .ops-side { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 680px) { .ops-hero { align-items: flex-start; flex-direction: column; } .ops-hero-risk { display: none; } .ops-side, .ops-monitor-grid { grid-template-columns: 1fr; } }
</style>
