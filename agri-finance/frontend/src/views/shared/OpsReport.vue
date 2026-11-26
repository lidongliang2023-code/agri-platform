<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>FINANCE ANALYTICS</small><h1>{{ role === 'fund' ? '数据报表' : '报表中心' }}</h1><p>{{ role === 'fund' ? '查看资金配置、资产收益和审批效率。' : '查看融资规模、逾期风险和信用表现。' }}</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新报表</el-button></div>
    </header>

    <div v-if="error" class="report-error">
      <span>{{ error }}</span>
      <el-button link @click="load">重新加载</el-button>
    </div>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>申请笔数</span><strong>{{ applications.length }}<em> 笔</em></strong><small>{{ pendingCount }} 笔待审批</small></article>
      <article class="finance-kpi"><span>融资规模</span><strong>{{ compactMoney(totalApplied) }}</strong><small>累计申请金额</small></article>
      <article class="finance-kpi"><span>在贷余额</span><strong>{{ compactMoney(outstanding) }}</strong><small>{{ activeLoans }} 笔履约中</small></article>
      <article class="finance-kpi"><span>逾期金额</span><strong>{{ compactMoney(overdueAmount) }}</strong><small>{{ overdue.length }} 笔逾期记录</small></article>
    </div>

    <div class="report-layout">
      <section class="finance-card">
        <div class="finance-card-head"><strong>业务趋势</strong><small>按数据生成</small></div>
        <div class="report-bars">
          <div v-for="item in trends" :key="item.label">
            <span>{{ item.label }}</span>
            <div class="report-track"><b :style="{ width: `${item.percent}%` }" /></div>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </section>
      <section class="finance-card">
        <div class="finance-card-head"><strong>关键指标</strong><small>当前业务口径</small></div>
        <dl class="report-metrics">
          <div><dt>近 30 天申请</dt><dd>{{ recentApplications }} 笔</dd></div>
          <div><dt>平均申请金额</dt><dd>{{ compactMoney(avgAmount) }}</dd></div>
          <div><dt>{{ role === 'fund' ? '在投资产' : '已放款笔数' }}</dt><dd>{{ role === 'fund' ? investments.length : loans.length }} 笔</dd></div>
          <div><dt>{{ role === 'fund' ? '累计预期收益' : '逾期本金' }}</dt><dd>{{ compactMoney(role === 'fund' ? expectedReturn : overduePrincipal) }}</dd></div>
        </dl>
      </section>
    </div>

    <AgriElementListTable
      :columns="reportColumns"
      :data="filteredRecords"
      row-key="id"
      :loading="loading"
      client-pagination
      :column-settings-storage-key="role === 'fund' ? 'agri-finance:fund-report-records' : 'agri-finance:admin-report-records'"
      empty-text="暂无匹配的业务记录"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <el-input v-model="draft.keyword" clearable :placeholder="role === 'fund' ? '投资编号 / 资产名称' : '申请编号 / 融资主体'" @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>业务状态</label>
            <el-select v-model="draft.status" clearable placeholder="全部状态">
              <el-option label="全部" value="" />
              <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>
      <template #toolbar-left>
        <strong class="finance-table-title">最近业务记录</strong>
        <small class="finance-table-hint">{{ role === 'fund' ? '最新投资配置' : '最新融资申请' }}</small>
      </template>
      <template #cell-recordNo="{ row }">{{ row.investmentNo || row.applicationNo }}</template>
      <template #cell-target="{ row }">{{ role === 'fund' ? row.assetName : row.userName }}</template>
      <template #cell-amount="{ row }">{{ compactMoney(row.investmentAmount || row.applyAmount) }}</template>
      <template #cell-status="{ row }"><FinanceStatus :value="row.status" /></template>
      <template #cell-recordTime="{ row }">{{ shortDate(row.investmentTime || row.applyTime) }}</template>
    </AgriElementListTable>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AgriElementListTable, AgriVueFilterBar } from '@agri/shared/vue/element'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, shortDate } from '@/api/finance'

const route = useRoute()
const role = computed(() => route.path.startsWith('/fund') ? 'fund' : 'admin')
const reportColumns = computed(() => [
  { key: 'recordNo', label: role.value === 'fund' ? '投资编号' : '申请编号', kind: 'code', minWidth: 155, locked: true },
  { key: 'target', label: role.value === 'fund' ? '资产' : '融资主体', minWidth: 185 },
  { key: 'amount', label: role.value === 'fund' ? '投资金额' : '申请金额', kind: 'number', minWidth: 120 },
  { key: 'status', prop: 'status', label: '状态', kind: 'status', width: 100 },
  { key: 'recordTime', label: '时间', minWidth: 140 },
])
const draft = reactive({ keyword: '', status: '' })
const query = reactive({ keyword: '', status: '' })
function applyFilter() {
  query.keyword = draft.keyword
  query.status = draft.status
}
function resetFilter() {
  draft.keyword = ''
  draft.status = ''
  applyFilter()
}
const rawRecords = computed(() => (role.value === 'fund' ? investments.value : applications.value))
const statusOptions = computed(() => [...new Set(rawRecords.value.map((item) => item.status).filter(Boolean))])
const filteredRecords = computed(() => {
  const kw = query.keyword.trim().toLowerCase()
  return rawRecords.value.filter((row) => {
    if (query.status && row.status !== query.status) return false
    const text = `${row.investmentNo || ''}${row.applicationNo || ''}${row.assetName || ''}${row.userName || ''}`.toLowerCase()
    if (kw && !text.includes(kw)) return false
    return true
  })
})
const loading = ref(true)
const error = ref('')
const applications = ref([])
const loans = ref([])
const investments = ref([])
const overdue = ref([])
const pendingCount = computed(() => applications.value.filter((item) => item.status === '待审批').length)
const totalApplied = computed(() => applications.value.reduce((total, item) => total + Number(item.applyAmount || 0), 0))
const outstanding = computed(() => loans.value.reduce((total, item) => total + Number(item.remainingAmount || 0), 0))
const activeLoans = computed(() => loans.value.filter((item) => item.status === '还款中').length)
const overdueAmount = computed(() => overdue.value.reduce((total, item) => total + Number(item.overdueAmount || 0), 0))
const overduePrincipal = computed(() => overdue.value.reduce((total, item) => total + Number(item.overduePrincipal || 0), 0))
const recentApplications = computed(() => applications.value.filter((item) => new Date(item.applyTime).getTime() > Date.now() - 30 * 86400000).length)
const avgAmount = computed(() => applications.value.length ? totalApplied.value / applications.value.length : 0)
const expectedReturn = computed(() => investments.value.reduce((total, item) => total + Number(item.expectedReturn || 0), 0))
const trends = computed(() => {
  const max = Math.max(totalApplied.value, overdueAmount.value, outstanding.value, 1)
  return [
    { label: '申请规模', value: compactMoney(totalApplied.value), percent: totalApplied.value / max * 100 },
    { label: '在贷余额', value: compactMoney(outstanding.value), percent: outstanding.value / max * 100 },
    { label: '逾期金额', value: compactMoney(overdueAmount.value), percent: overdueAmount.value / max * 100 },
    { label: role.value === 'fund' ? '预期收益' : '已完成申请', value: role.value === 'fund' ? compactMoney(expectedReturn.value) : `${applications.value.filter((item) => item.status === '已通过').length} 笔`, percent: role.value === 'fund' ? Math.min(100, expectedReturn.value / max * 100) : 55 },
  ]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const isFund = role.value === 'fund'
    const [applicationData, loanData, investmentData, overdueData] = await Promise.all([
      operationsApi.applications(),
      operationsApi.loans(),
      isFund ? operationsApi.investments() : Promise.resolve([]),
      operationsApi.overdue(),
    ])
    applications.value = applicationData || []
    loans.value = loanData || []
    investments.value = investmentData || []
    overdue.value = overdueData || []
  } catch (err) {
    error.value = err?.message || '报表数据加载失败'
  } finally { loading.value = false }
}

onMounted(load)
watch(role, () => {
  resetFilter()
  load()
})
</script>

<style scoped>
.report-error { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border: 1px solid #efd4ce; border-radius: 8px; background: #fff8f6; color: #a44f3f; font-size: var(--fin-fs-xs); }
.finance-kpi em { color: #60776a; font-size: var(--fin-fs-xs); font-style: normal; }
.report-layout { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(270px, .7fr); gap: 14px; }
.report-bars { display: grid; gap: 17px; padding: 19px; }
.report-bars > div { display: grid; grid-template-columns: 75px minmax(0, 1fr) 100px; align-items: center; gap: 10px; }
.report-bars span { color: #62786b; font-size: var(--fin-fs-xs); }
.report-bars strong { color: #395443; font-size: var(--fin-fs-xs); text-align: right; }
.report-track { overflow: hidden; height: 10px; border-radius: 99px; background: #e9f1ec; }
.report-track b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--fin-green-700), var(--fin-green-500, #159a5e)); }
.report-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 0; background: #edf2ee; }
.report-metrics > div { padding: 13px 15px; background: #fff; }
.report-metrics dt { color: #87978e; font-size: var(--fin-fs-xs); }
.report-metrics dd { margin: 4px 0 0; color: #294f38; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
@media (max-width: 820px) { .report-layout { grid-template-columns: 1fr; } }
</style>
