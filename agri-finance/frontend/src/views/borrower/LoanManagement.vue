<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>MY FINANCING</small>
        <h1>我的借款</h1>
        <p>统一查看融资申请、借款状态、剩余本金与还款进度。</p>
      </div>
      <div class="finance-page-heading-actions">
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

    <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
      <div class="agri-vue-filter-field">
        <label>关键字</label>
        <el-input v-model="draft.keyword" clearable placeholder="搜索申请编号 / 借款编号 / 产品" @keyup.enter="applyFilter" />
      </div>
      <div class="agri-vue-filter-field">
        <label>借款状态</label>
        <el-select v-model="draft.status" clearable placeholder="全部状态">
          <el-option label="全部" value="" />
          <el-option label="待审批" value="待审批" />
          <el-option label="已通过" value="已通过" />
          <el-option label="已拒绝" value="已拒绝" />
          <el-option label="还款中" value="还款中" />
          <el-option label="已结清" value="已结清" />
          <el-option label="逾期" value="逾期" />
        </el-select>
      </div>
    </AgriVueFilterBar>

    <div class="loan-toolbar">
      <div class="finance-tabs">
        <button v-for="item in tabs" :key="item.key" type="button" :class="{ on: activeTab === item.key }" @click="activeTab = item.key">
          {{ item.label }}
        </button>
      </div>
    </div>

    <section v-if="activeTab !== 'loan'" class="finance-card">
      <div class="finance-card-head">
        <strong>{{ activeTab === 'application' ? '审批中申请' : '全部融资申请' }}</strong>
        <small>{{ filteredApplications.length }} 条记录</small>
      </div>
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
    </section>

    <AgriElementListTable
      v-else
      :columns="loanColumns"
      :data="filteredLoans"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-finance:borrower-loans"
      empty-text="暂无借款记录，审批通过的融资申请确认借款后会自动生成"
      @refresh="load"
    >
      <template #toolbar-left>
        <el-button class="finance-action-button" @click="$router.push('/borrower/loan-apply')">+ 新增融资申请</el-button>
      </template>
      <template #cell-productType="{ row }">{{ productName(row.productType) }}</template>
      <template #cell-amount="{ row }">{{ money(row.amount) }}</template>
      <template #cell-rate="{ row }">{{ row.rate }}%</template>
      <template #cell-remainingAmount="{ row }">{{ money(row.remainingAmount) }}</template>
      <template #cell-progress="{ row }">
        <div class="loan-progress-cell">
          <div class="finance-progress"><span :style="{ width: `${loanProgress(row)}%` }" /></div>
          <small>{{ loanProgress(row).toFixed(0) }}%</small>
        </div>
      </template>
      <template #cell-status="{ row }"><FinanceStatus :value="row.status" /></template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="loanRowActions(row)" />
      </template>
    </AgriElementListTable>

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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DocumentChecked } from '@element-plus/icons-vue'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { financeApi, money, productName, shortDate } from '@/api/finance'

const loanColumns = [
  { key: 'loanNo', prop: 'loanNo', label: '借款编号', kind: 'code', minWidth: 155, locked: true },
  { key: 'productType', prop: 'productType', label: '产品', minWidth: 120 },
  { key: 'amount', prop: 'amount', label: '借款金额', kind: 'number', minWidth: 115 },
  { key: 'rate', prop: 'rate', label: '年化利率', kind: 'number', width: 96 },
  { key: 'remainingAmount', prop: 'remainingAmount', label: '剩余本金', kind: 'number', minWidth: 115 },
  { key: 'progress', label: '还款进度', minWidth: 150, ellipsis: false },
  { key: 'status', prop: 'status', label: '状态', kind: 'status', width: 96 },
  { key: 'actions', label: '操作', kind: 'action', width: 130 },
]

const router = useRouter()
const loading = ref(true)
const confirmingId = ref('')
const applications = ref([])
const loans = ref([])
const activeTab = ref('all')
const draft = reactive({ keyword: '', status: '' })
const filters = reactive({ keyword: '', status: '' })
const detailOpen = ref(false)
const selectedLoan = ref(null)
const tabs = [
  { key: 'all', label: '全部申请' },
  { key: 'application', label: '审批中' },
  { key: 'loan', label: '借款记录' },
]

function applyFilter() {
  filters.keyword = draft.keyword
  filters.status = draft.status
}

function resetFilter() {
  draft.keyword = ''
  draft.status = ''
  applyFilter()
}

const pendingApplications = computed(() => applications.value.filter((item) => item.status === '待审批').length)
const totalBorrowed = computed(() => loans.value.reduce((total, item) => total + Number(item.amount || 0), 0))
const outstanding = computed(() => loans.value.reduce((total, item) => total + Number(item.remainingAmount || 0), 0))
const totalPaid = computed(() => loans.value.reduce((total, item) => total + Number(item.paidAmount || 0), 0))

const filteredApplications = computed(() => {
  const rows = activeTab.value === 'application'
    ? applications.value.filter((item) => item.status === '待审批')
    : applications.value
  const value = filters.keyword.trim().toLowerCase()
  return rows.filter((item) => {
    if (filters.status && item.status !== filters.status) return false
    if (value && !`${item.applicationNo}${productName(item.productType)}${item.fundPurpose || ''}`.toLowerCase().includes(value)) return false
    return true
  })
})

const filteredLoans = computed(() => {
  const value = filters.keyword.trim().toLowerCase()
  return loans.value.filter((item) => {
    if (filters.status && item.status !== filters.status) return false
    if (value && !`${item.loanNo}${productName(item.productType)}`.toLowerCase().includes(value)) return false
    return true
  })
})

function loanRowActions(row) {
  const list = []
  if (row.status === '还款中') {
    list.push({
      key: 'repay',
      label: '还款计划',
      onClick: () => router.push({ path: '/borrower/repayment', query: { loanId: row.id } }),
    })
  }
  list.push({
    key: 'detail',
    label: '详情',
    onClick: () => showLoan(row),
  })
  return list
}

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
  return '待确认借款'
}

function showLoan(loan) {
  selectedLoan.value = loan
  detailOpen.value = true
}

/**
 * 确认借款：生成待签合同，随后到「融资合同」页签署。
 *
 * <p>放款不在这里发生 —— 合同双方签齐后由后端自动生成借款与还款计划，
 * 这样"钱已借出但合同没签"的状态就不存在了。</p>
 */
async function confirmLoan(application) {
  await ElMessageBox.confirm(
    `确认按审批金额 ${money(application.actualAmount || application.suggestedAmount)} 借款？系统将生成借款合同，签署完成后由资金方放款。`,
    '确认借款',
    { confirmButtonText: '确认并生成合同', cancelButtonText: '取消', type: 'info' },
  )
  confirmingId.value = application.id
  try {
    await financeApi.acceptLoan(application.id)
    ElMessage.success('借款合同已生成，请前往签署')
    router.push('/borrower/contracts')
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
  font-size: var(--fin-fs-xs);
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
  font-size: var(--fin-fs-xs);
}

.application-main p {
  margin: 3px 0;
  color: #8a9991;
  font-family: ui-monospace, Consolas, monospace;
  font-size: var(--fin-fs-xs);
}

.application-main > span {
  display: block;
  overflow: hidden;
  color: #71857a;
  font-size: var(--fin-fs-xs);
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
  font-size: var(--fin-fs-xs);
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
  font-size: var(--fin-fs-xs);
}

.application-action {
  text-align: right;
}

.application-action > span {
  color: #7d8f83;
  font-size: var(--fin-fs-xs);
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
  font-size: var(--fin-fs-xs);
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
  font-size: var(--fin-fs-xs);
}

.loan-detail-dialog strong {
  margin-top: 3px;
  color: #3c5746;
  font-size: var(--fin-fs-xs);
}

@media (max-width: 760px) {
  .loan-toolbar { align-items: stretch; flex-direction: column; }
  .loan-search { width: 100%; }
  .application-list article { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .application-action { grid-column: 2 / -1; text-align: left; }
  .loan-detail-dialog { grid-template-columns: 1fr; }
}
</style>
