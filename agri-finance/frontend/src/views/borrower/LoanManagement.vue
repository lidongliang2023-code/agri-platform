<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>MY FINANCING</small>
        <h1>我的借款</h1>
        <p>统一查看融资申请、借款状态、剩余本金与还款进度。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
        <el-button class="finance-action-button" @click="$router.push('/borrower/loan-apply')">新增融资申请</el-button>
      </div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi">
        <span>融资申请</span>
        <strong>{{ applications.length }}<em> 笔</em></strong>
        <small>{{ pendingApplications }} 笔待审批</small>
      </article>
      <article class="finance-kpi">
        <span>借款总额</span>
        <strong>{{ compactMoney(totalBorrowed) }}</strong>
        <small>{{ loans.length }} 笔已放款</small>
      </article>
      <article class="finance-kpi">
        <span>剩余本金</span>
        <strong>{{ money(outstanding) }}</strong>
        <small>按实际还款计划动态更新</small>
      </article>
      <article class="finance-kpi">
        <span>已还本金</span>
        <strong>{{ money(totalPaid) }}</strong>
        <small>历史还款记录可追溯</small>
      </article>
    </div>

    <div class="loan-toolbar">
      <div class="finance-tabs">
        <button v-for="item in tabs" :key="item.key" type="button" :class="{ on: activeTab === item.key }" @click="activeTab = item.key">
          {{ item.label }}
        </button>
      </div>
      <el-input v-model="keyword" clearable placeholder="搜索申请编号 / 借款编号" class="loan-search" :prefix-icon="Search" />
    </div>

    <section class="finance-card">
      <div class="finance-card-head">
        <strong>{{ activeTab === 'application' ? '融资申请' : '借款记录' }}</strong>
        <small>{{ displayedCount }} 条记录</small>
      </div>

      <template v-if="activeTab !== 'loan'">
        <div v-if="filteredApplications.length" class="application-list">
          <article v-for="item in filteredApplications" :key="item.id">
            <div class="application-icon"><DocumentChecked /></div>
            <div class="application-main">
              <div><strong>{{ productName(item.productType) }}</strong><FinanceStatus :value="item.status" /></div>
              <p>{{ item.applicationNo }} · {{ shortDate(item.applyTime) }}</p>
              <span>{{ item.fundPurpose || '未填写融资用途' }}</span>
            </div>
            <div class="application-amount">
              <span>申请金额</span>
              <strong>{{ money(item.applyAmount) }}</strong>
              <small>{{ item.applyTerm }} 个月 · {{ item.repaymentMethod }}</small>
            </div>
            <div class="application-action">
              <el-button
                v-if="item.status === '已通过'"
                class="finance-action-button"
                :loading="confirmingId === item.id"
                @click="confirmLoan(item)"
              >确认借款</el-button>
              <span v-else>{{ statusHint(item) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="finance-empty">
          <strong>暂无匹配的融资申请</strong>
          <p>发起融资申请后，可以在这里跟踪智能预审与人工审批进度。</p>
        </div>
      </template>

      <template v-else>
        <el-table v-if="filteredLoans.length" :data="filteredLoans" style="width: 100%">
          <el-table-column prop="loanNo" label="借款编号" min-width="145" />
          <el-table-column label="产品" min-width="0">
            <template #default="{ row }">{{ productName(row.productType) }}</template>
          </el-table-column>
          <el-table-column label="借款金额" min-width="110" align="right">
            <template #default="{ row }">{{ money(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="年化利率" width="95" align="right">
            <template #default="{ row }">{{ row.rate }}%</template>
          </el-table-column>
          <el-table-column label="剩余本金" min-width="110" align="right">
            <template #default="{ row }">{{ money(row.remainingAmount) }}</template>
          </el-table-column>
          <el-table-column label="还款进度" min-width="145">
            <template #default="{ row }">
              <div class="loan-progress-cell">
                <div class="finance-progress"><span :style="{ width: `${loanProgress(row)}%` }" /></div>
                <small>{{ loanProgress(row).toFixed(0) }}%</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><FinanceStatus :value="row.status" /></template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="right">
            <template #default="{ row }">
              <el-button v-if="row.status === '还款中'" link class="finance-link-button" @click="$router.push({ path: '/borrower/repayment', query: { loanId: row.id } })">还款计划</el-button>
              <el-button v-else link class="finance-link-button" @click="showLoan(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="finance-empty">
          <strong>暂无借款记录</strong>
          <p>审批通过的融资申请确认借款后，会自动生成借款与还款计划。</p>
        </div>
      </template>
    </section>

    <el-dialog v-model="detailOpen" title="借款详情" width="min(620px, 92vw)">
      <div v-if="selectedLoan" class="loan-detail-dialog">
        <div><span>借款编号</span><strong>{{ selectedLoan.loanNo }}</strong></div>
        <div><span>融资产品</span><strong>{{ productName(selectedLoan.productType) }}</strong></div>
        <div><span>借款金额</span><strong>{{ money(selectedLoan.amount) }}</strong></div>
        <div><span>借款利率</span><strong>{{ selectedLoan.rate }}%</strong></div>
        <div><span>放款日期</span><strong>{{ shortDate(selectedLoan.loanDate) }}</strong></div>
        <div><span>到期日期</span><strong>{{ shortDate(selectedLoan.dueDate) }}</strong></div>
        <div><span>已还本金</span><strong>{{ money(selectedLoan.paidAmount) }}</strong></div>
        <div><span>剩余本金</span><strong>{{ money(selectedLoan.remainingAmount) }}</strong></div>
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DocumentChecked, Search } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, money, productName, shortDate } from '@/api/finance'

const loading = ref(true)
const confirmingId = ref('')
const applications = ref([])
const loans = ref([])
const activeTab = ref('all')
const keyword = ref('')
const detailOpen = ref(false)
const selectedLoan = ref(null)
const tabs = [
  { key: 'all', label: '全部申请' },
  { key: 'application', label: '审批中' },
  { key: 'loan', label: '借款记录' },
]

const pendingApplications = computed(() => applications.value.filter((item) => item.status === '待审批').length)
const totalBorrowed = computed(() => loans.value.reduce((total, item) => total + Number(item.amount || 0), 0))
const outstanding = computed(() => loans.value.reduce((total, item) => total + Number(item.remainingAmount || 0), 0))
const totalPaid = computed(() => loans.value.reduce((total, item) => total + Number(item.paidAmount || 0), 0))

const filteredApplications = computed(() => {
  const rows = activeTab.value === 'application'
    ? applications.value.filter((item) => item.status === '待审批')
    : applications.value
  const value = keyword.value.trim().toLowerCase()
  return value ? rows.filter((item) => `${item.applicationNo}${item.productType}${item.fundPurpose}`.toLowerCase().includes(value)) : rows
})

const filteredLoans = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return value ? loans.value.filter((item) => `${item.loanNo}${item.productType}`.toLowerCase().includes(value)) : loans.value
})

const displayedCount = computed(() => activeTab.value === 'loan' ? filteredLoans.value.length : filteredApplications.value.length)

function loanProgress(loan) {
  const amount = Number(loan.amount || 0)
  return amount > 0 ? Math.max(0, Math.min(100, Number(loan.paidAmount || 0) / amount * 100)) : 0
}

function compactMoney(value) {
  const amount = Number(value || 0)
  return amount >= 10000 ? `¥${(amount / 10000).toFixed(1)}万` : money(amount)
}

function statusHint(item) {
  if (item.status === '待审批') return '平台审批中'
  if (item.status === '已拒绝') return item.reviewOpinion || '审批未通过'
  return '已生成借款'
}

function showLoan(loan) {
  selectedLoan.value = loan
  detailOpen.value = true
}

async function confirmLoan(application) {
  await ElMessageBox.confirm(
    `确认按审批金额 ${money(application.actualAmount || application.suggestedAmount)} 发起借款？系统将生成借款记录和还款计划。`,
    '确认借款',
    { confirmButtonText: '确认借款', cancelButtonText: '取消', type: 'info' },
  )
  confirmingId.value = application.id
  try {
    await financeApi.confirmLoan(application.id)
    ElMessage.success('借款已确认，还款计划已生成')
    await load()
    activeTab.value = 'loan'
  } catch (err) {
    ElMessage.error(err.message || '确认借款失败')
  } finally {
    confirmingId.value = ''
  }
}

async function load() {
  loading.value = true
  try {
    const [applicationData, loanData] = await Promise.all([
      financeApi.applications(),
      financeApi.loans(),
    ])
    applications.value = applicationData || []
    loans.value = loanData || []
  } catch (err) {
    ElMessage.error(err.message || '借款数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em {
  color: #61786a;
  font-size: 10px;
  font-style: normal;
}

.loan-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.loan-search {
  width: 230px;
}

.application-list {
  display: grid;
}

.application-list article {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 150px 110px;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid #edf2ee;
}

.application-list article:first-child { border-top: 0; }

.application-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  background: #e8f5ee;
  color: var(--fin-green-700);
}

.application-icon svg {
  width: 18px;
}

.application-main {
  min-width: 0;
}

.application-main > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.application-main strong {
  color: #344f3f;
  font-size: 11px;
}

.application-main p {
  margin: 3px 0;
  color: #8a9991;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 8px;
}

.application-main > span {
  display: block;
  overflow: hidden;
  color: #71857a;
  font-size: 8.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.application-amount {
  text-align: right;
}

.application-amount span,
.application-amount strong,
.application-amount small {
  display: block;
}

.application-amount span {
  color: #8a9990;
  font-size: 7.5px;
}

.application-amount strong {
  margin-top: 2px;
  color: #d0523f;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}

.application-amount small {
  margin-top: 2px;
  color: #95a098;
  font-size: 7.5px;
}

.application-action {
  text-align: right;
}

.application-action > span {
  color: #7d8f83;
  font-size: 8px;
}

.loan-progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loan-progress-cell .finance-progress {
  min-width: 55px;
  flex: 1;
}

.loan-progress-cell small {
  color: #778a7e;
  font-size: 8px;
}

.loan-detail-dialog {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border-radius: 10px;
  background: #edf2ee;
}

.loan-detail-dialog > div {
  padding: 11px 13px;
  background: #fff;
}

.loan-detail-dialog span,
.loan-detail-dialog strong {
  display: block;
}

.loan-detail-dialog span {
  color: #89978f;
  font-size: 8px;
}

.loan-detail-dialog strong {
  margin-top: 3px;
  color: #3c5746;
  font-size: 10px;
}

@media (max-width: 760px) {
  .loan-toolbar { align-items: stretch; flex-direction: column; }
  .loan-search { width: 100%; }
  .application-list article { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .application-action { grid-column: 2 / -1; text-align: left; }
  .loan-detail-dialog { grid-template-columns: 1fr; }
}
</style>
