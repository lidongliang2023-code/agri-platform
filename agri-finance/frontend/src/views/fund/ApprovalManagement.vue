<template>
  <section class="finance-page approval-page">
    <header class="finance-page-heading">
      <div>
        <small>FINANCING DECISION CENTER</small>
        <h1>审批管理</h1>
        <p>结合主体信用、贸易背景、质押保障与 AI 预审完成审批决策，审批通过后自动形成可投资产。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新申请</el-button>
        <el-button class="finance-action-button" @click="router.push('/fund/risk-center')">进入风控中台</el-button>
      </div>
    </header>

    <div v-if="error" class="approval-error">
      <span>{{ error }}</span>
      <el-button link @click="load">重新加载</el-button>
    </div>

    <el-skeleton v-if="loading && !overview" :rows="9" animated />

    <template v-if="overview">
      <section class="approval-overview">
        <div class="approval-overview-primary">
          <small>PENDING DECISIONS</small>
          <span>待审批申请</span>
          <strong>{{ summary.pendingCount || 0 }}<em> 笔</em></strong>
          <p>申请金额 {{ compactMoney(summary.pendingAmount) }}</p>
        </div>
        <div class="approval-overview-stat">
          <span>AI 建议通过</span>
          <strong>{{ summary.aiPassCount || 0 }}<em> 笔</em></strong>
          <p>仍需人工核验贸易背景与还款来源</p>
        </div>
        <div class="approval-overview-stat">
          <span>累计批准</span>
          <strong>{{ compactMoney(summary.approvedAmount) }}</strong>
          <p>{{ summary.approvedCount || 0 }} 笔申请 · {{ summary.rejectedCount || 0 }} 笔拒绝</p>
        </div>
        <div class="approval-overview-stat">
          <span>已形成资产</span>
          <strong>{{ summary.generatedAssetCount || 0 }}<em> 个</em></strong>
          <p>审批通过后自动进入资产市场</p>
        </div>
      </section>

      <section v-if="pendingContracts.length" class="finance-card approval-contracts">
        <div class="finance-card-head">
          <strong>待签署借款合同</strong>
          <small>{{ pendingContracts.length }} 份 · 资金方签署后系统立即放款并生成还款计划</small>
        </div>
        <el-table :data="pendingContracts" style="width: 100%">
          <el-table-column label="合同与主体" min-width="210">
            <template #default="{ row }">
              <div class="approval-subject">
                <span>{{ row.userName?.slice(0, 1) || '合' }}</span>
                <div>
                  <strong>{{ row.userName || row.userId }}</strong>
                  <small>{{ row.contractNo }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="金额/期限" min-width="130" align="right">
            <template #default="{ row }">
              <strong class="approval-amount">{{ money(row.amount) }}</strong>
              <small class="approval-rate">{{ row.term || 0 }} 个月 · {{ number(row.rate) }}%</small>
            </template>
          </el-table-column>
          <el-table-column label="融资方" width="110">
            <template #default="{ row }">
              <FinanceStatus :value="row.borrowerSignTime ? '已签署' : '待签署'" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="right">
            <template #default="{ row }">
              <el-button
                v-if="row.borrowerSignTime"
                class="finance-action-button"
                :loading="signingId === row.id"
                @click="lenderSign(row)"
              >签署并放款</el-button>
              <span v-else class="approval-muted">等待融资方签署</span>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="approval-workbench">
        <main class="finance-card approval-table-card">
          <div class="approval-toolbar">
            <div class="finance-tabs">
              <button
                v-for="item in tabs"
                :key="item.key"
                type="button"
                :class="{ on: filter === item.key }"
                @click="filter = item.key"
              >
                {{ item.label }}<span>{{ countFor(item.key) }}</span>
              </button>
            </div>
            <el-input
              v-model="keyword"
              :prefix-icon="Search"
              clearable
              placeholder="搜索申请编号、主体、产品"
            />
          </div>

          <el-table v-if="filteredItems.length" :data="filteredItems" style="width: 100%">
            <el-table-column label="申请主体" min-width="205">
              <template #default="{ row }">
                <div class="approval-subject">
                  <span>{{ row.application.userName?.slice(0, 1) || '农' }}</span>
                  <div>
                    <strong>{{ row.application.userName }}</strong>
                    <small>{{ row.application.applicationNo }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="产品与用途" min-width="175">
              <template #default="{ row }">
                <strong class="approval-product">{{ productName(row.application.productType) }}</strong>
                <p class="approval-purpose">{{ row.application.fundPurpose || '未填写用途' }}</p>
              </template>
            </el-table-column>
            <el-table-column label="申请/审批金额" min-width="145" align="right">
              <template #default="{ row }">
                <strong class="approval-amount">{{ money(row.application.applyAmount) }}</strong>
                <small v-if="row.application.actualAmount" class="approval-approved-amount">批准 {{ money(row.application.actualAmount) }}</small>
              </template>
            </el-table-column>
            <el-table-column label="期限/利率" width="105">
              <template #default="{ row }">
                <span class="approval-term">{{ row.application.applyTerm }} 个月</span>
                <small class="approval-rate">{{ number(row.application.actualRate || row.application.suggestedRate) }}%</small>
              </template>
            </el-table-column>
            <el-table-column label="AI 预审" width="115">
              <template #default="{ row }">
                <div class="approval-ai">
                  <FinanceStatus :value="row.application.aiReviewResult" />
                  <small>{{ confidencePercent(row.application.aiConfidence) }}%</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="95">
              <template #default="{ row }"><FinanceStatus :value="row.application.status" /></template>
            </el-table-column>
            <el-table-column label="后续资产" min-width="125">
              <template #default="{ row }">
                <el-button v-if="row.generatedAsset" link class="finance-link-button" @click="openAsset(row)">已转资产 →</el-button>
                <span v-else-if="row.application.status === '已通过'" class="approval-legacy">历史审批</span>
                <span v-else class="approval-muted">审批后生成</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="105" align="right">
              <template #default="{ row }">
                <el-button v-if="row.canReview" class="finance-action-button" @click="openDecision(row)">审批</el-button>
                <el-button v-else link class="finance-link-button" @click="openDecision(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-else class="finance-empty approval-empty">
            <strong>暂无匹配申请</strong>
            <p>请调整筛选条件或等待新的融资申请。</p>
          </div>
        </main>

        <aside class="approval-aside">
          <section class="finance-card">
            <div class="finance-card-head"><strong>今日待办</strong><span>{{ summary.todayCount || 0 }} 笔新申请</span></div>
            <div class="approval-todo">
              <div><span class="approval-todo-icon amber">审</span><div><strong>{{ summary.pendingCount || 0 }} 笔待审批</strong><p>优先处理 AI 建议人工复核的申请</p></div></div>
              <div><span class="approval-todo-icon green">资</span><div><strong>{{ summary.generatedAssetCount || 0 }} 个资产已生成</strong><p>进入资产市场查看募集进度</p></div></div>
            </div>
          </section>
          <section class="approval-guideline">
            <span>审批口径</span>
            <h3>四看一验证</h3>
            <p>看主体信用、看真实用途、看贸易背景、看还款来源，并验证质押物或订单回款链路。</p>
            <ul>
              <li>审批金额不超过申请金额</li>
              <li>资金成本覆盖风险与期限</li>
              <li>审批通过后自动发行资产</li>
            </ul>
          </section>
        </aside>
      </section>
    </template>

    <el-dialog v-model="decisionOpen" :title="selected?.canReview ? '融资审批决策' : '审批详情'" width="min(760px, 94vw)">
      <div v-if="selected" class="approval-dialog">
        <section class="approval-dialog-head">
          <div class="approval-subject-mark">{{ selected.application.userName?.slice(0, 1) || '农' }}</div>
          <div>
            <small>{{ selected.application.applicationNo }}</small>
            <h2>{{ selected.application.userName }}</h2>
            <p>{{ productName(selected.application.productType) }} · {{ selected.application.applyTerm }} 个月 · {{ selected.application.repaymentMethod }}</p>
          </div>
          <FinanceStatus :value="selected.application.status" />
        </section>

        <section class="approval-risk-grid">
          <div><span>主体信用</span><strong>{{ selected.application.creditLevel || '—' }}</strong><small>评分 {{ selected.application.creditScore || '—' }}</small></div>
          <div><span>申请金额</span><strong>{{ money(selected.application.applyAmount) }}</strong><small>建议授信 {{ money(selected.application.suggestedAmount) }}</small></div>
          <div><span>AI 预审</span><strong>{{ selected.application.aiReviewResult || '—' }}</strong><small>置信度 {{ confidencePercent(selected.application.aiConfidence) }}%</small></div>
          <div><span>建议利率</span><strong>{{ number(selected.application.suggestedRate) }}%</strong><small>{{ selected.application.repaymentMethod }}</small></div>
        </section>

        <section class="approval-business">
          <div><span>融资用途</span><p>{{ selected.application.fundPurpose || '未填写' }}</p></div>
          <div><span>还款来源</span><p>{{ selected.application.repaymentSource || '未填写' }}</p></div>
          <div><span>质押与增信</span><p>{{ selected.application.collateralInfo || '信用融资，无质押物' }}</p></div>
          <div><span>补充材料</span><p><a v-if="selected.application.evidenceUrl" :href="selected.application.evidenceUrl" target="_blank" rel="noreferrer">查看申请材料</a><template v-else>暂未上传</template></p></div>
        </section>

        <template v-if="selected.canReview">
          <section class="approval-check-list">
            <div><span>1</span><p><strong>主体与经营真实性</strong><small>平台交易、履约、结算与信用记录已交叉核验</small></p></div>
            <div><span>2</span><p><strong>资金用途与还款来源</strong><small>融资用途明确，销售回款可覆盖本息</small></p></div>
            <div><span>3</span><p><strong>风险缓释与资产形成</strong><small>通过后自动生成资产，进入资金配置流程</small></p></div>
          </section>
          <el-form label-position="top">
            <div class="finance-form-grid">
              <el-form-item label="审批金额（元）">
                <el-input v-model="reviewAmount" inputmode="decimal" />
                <small class="approval-field-tip">不得超过申请金额 {{ money(selected.application.applyAmount) }}</small>
              </el-form-item>
              <el-form-item label="审批年化利率（%）">
                <el-input v-model="reviewRate" inputmode="decimal" />
                <small class="approval-field-tip">建议不低于风险成本 {{ number(selected.application.suggestedRate) }}%</small>
              </el-form-item>
            </div>
            <el-form-item label="审批意见">
              <el-input v-model="reviewOpinion" type="textarea" :rows="3" maxlength="500" show-word-limit />
            </el-form-item>
          </el-form>
          <div class="approval-dialog-tip">审批提交后不可重复处理；通过将同步生成消息、审计记录和可投资产。</div>
        </template>

        <section v-else class="approval-result">
          <div>
            <span>审批结果</span>
            <strong>{{ selected.approvalRecord?.decision || selected.application.status }}</strong>
            <small>{{ selected.approvalRecord?.reviewerName || selected.application.reviewerName || '历史审批' }} · {{ shortDate(selected.approvalRecord?.createdAt || selected.application.reviewTime) }}</small>
          </div>
          <div>
            <span>审批意见</span>
            <p>{{ selected.approvalRecord?.opinion || selected.application.reviewOpinion || '无审批意见' }}</p>
          </div>
          <div v-if="selected.application.actualAmount">
            <span>批准条件</span>
            <p>{{ money(selected.application.actualAmount) }} · 年化 {{ number(selected.application.actualRate) }}%</p>
          </div>
          <div v-if="selected.generatedAsset">
            <span>形成的可投资产</span>
            <el-button link class="finance-link-button" @click="openAsset(selected)">{{ selected.generatedAsset.assetName }} →</el-button>
          </div>
        </section>
      </div>

      <template #footer>
        <el-button class="finance-ghost-button" @click="decisionOpen = false">{{ selected?.canReview ? '取消' : '关闭' }}</el-button>
        <template v-if="selected?.canReview">
          <el-button type="danger" plain :loading="reviewing" @click="submitDecision('已拒绝')">拒绝申请</el-button>
          <el-button class="finance-action-button" :loading="reviewing" @click="submitDecision('已通过')">通过并生成资产</el-button>
        </template>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money, productName, shortDate } from '@/api/finance'

const router = useRouter()
const loading = ref(true)
const reviewing = ref(false)
const error = ref('')
const overview = ref(null)
const filter = ref('pending')
const keyword = ref('')
const decisionOpen = ref(false)
const selected = ref(null)
const reviewAmount = ref('')
const reviewRate = ref('')
const reviewOpinion = ref('')
const contracts = ref([])
const signingId = ref('')

const pendingContracts = computed(() => contracts.value.filter((item) => item.signStatus !== '已签署'))

const tabs = [
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'all', label: '全部' },
]
const items = computed(() => overview.value?.items || [])
const summary = computed(() => overview.value?.summary || {})
const filteredItems = computed(() => {
  let rows = items.value
  if (filter.value === 'pending') rows = rows.filter((item) => item.canReview)
  if (filter.value === 'approved') rows = rows.filter((item) => item.application.status === '已通过')
  if (filter.value === 'rejected') rows = rows.filter((item) => item.application.status === '已拒绝')
  const search = keyword.value.trim().toLowerCase()
  if (search) {
    rows = rows.filter((item) => [
      item.application.applicationNo,
      item.application.userName,
      item.application.productType,
      item.application.fundPurpose,
    ].join(' ').toLowerCase().includes(search))
  }
  return rows
})

const number = (value) => Number(value || 0).toFixed(2)
const confidencePercent = (value) => Math.round(Number(value || 0) * 1000) / 10

function countFor(key) {
  if (key === 'pending') return summary.value.pendingCount || 0
  if (key === 'approved') return summary.value.approvedCount || 0
  if (key === 'rejected') return summary.value.rejectedCount || 0
  return items.value.length
}

function openDecision(item) {
  selected.value = item
  reviewAmount.value = String(item.application.actualAmount || item.application.applyAmount || '')
  reviewRate.value = String(item.application.actualRate || item.application.suggestedRate || '')
  reviewOpinion.value = item.application.aiReviewResult === '通过'
    ? '主体经营、交易履约与贸易背景核验正常，同意批准。'
    : '已完成人工复核，经营与还款来源符合准入要求，同意批准。'
  decisionOpen.value = true
}

function openAsset(item) {
  const assetId = item.generatedAsset?.id
  if (assetId) router.push(`/fund/asset-market/${encodeURIComponent(assetId)}`)
}

async function submitDecision(result) {
  if (!selected.value) return
  const amount = Number(reviewAmount.value)
  const rate = Number(reviewRate.value)
  if (result === '已通过' && (!Number.isFinite(amount) || amount <= 0)) {
    ElMessage.warning('请输入有效的审批金额')
    return
  }
  if (result === '已通过' && amount > Number(selected.value.application.applyAmount || 0)) {
    ElMessage.warning('审批金额不能超过申请金额')
    return
  }
  if (result === '已通过' && (!Number.isFinite(rate) || rate <= 0)) {
    ElMessage.warning('请输入有效的审批利率')
    return
  }
  if (!reviewOpinion.value.trim()) {
    ElMessage.warning('请填写审批意见')
    return
  }

  try {
    await ElMessageBox.confirm(
      result === '已通过'
        ? `确认批准 ${money(amount)}、年化 ${rate}%？通过后将自动形成可投资产。`
        : `确认拒绝「${selected.value.application.userName}」的融资申请？`,
      result === '已通过' ? '确认审批通过' : '确认拒绝申请',
      {
        confirmButtonText: result === '已通过' ? '确认通过' : '确认拒绝',
        cancelButtonText: '返回检查',
        type: result === '已通过' ? 'info' : 'warning',
      },
    )
    reviewing.value = true
    const response = await operationsApi.review(
      selected.value.application.id,
      result,
      reviewOpinion.value.trim(),
      result === '已通过' ? amount : null,
      result === '已通过' ? rate : null,
    )
    decisionOpen.value = false
    await load()
    if (result === '已通过' && response.generatedAsset) {
      ElMessage.success('审批通过，可投资产已生成')
    } else {
      ElMessage.success(result === '已通过' ? '审批通过' : '申请已拒绝')
    }
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err.message || '审批失败')
  } finally {
    reviewing.value = false
  }
}

/** 资金方落签：合同两半边签齐后由后端放款，前端不再单独点"放款"。 */
async function lenderSign(contract) {
  await ElMessageBox.confirm(
    `确认以本机构名义签署「${contract.userName || contract.userId}」的借款合同 ${contract.contractNo}？签署完成后系统立即放款。`,
    '确认签署并放款',
    { confirmButtonText: '确认签署', cancelButtonText: '返回检查', type: 'info' },
  )
  signingId.value = contract.id
  try {
    const result = await operationsApi.lenderSignContract(contract.id)
    ElMessage.success(result?.disbursed ? '已签署并放款，还款计划已生成' : '已签署，等待融资方签署')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '签署失败')
  } finally {
    signingId.value = ''
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [overviewData, contractData] = await Promise.all([
      operationsApi.approvalOverview(),
      operationsApi.contracts(),
    ])
    overview.value = overviewData
    contracts.value = contractData || []
  } catch (err) {
    error.value = err.message || '审批申请加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.approval-error { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border: 1px solid #efd4ce; border-radius: 10px; background: #fff8f6; color: #a44f3f; font-size: var(--fin-fs-xs); }
.approval-overview { display: grid; grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--fin-line); border-radius: 14px; background: #fff; }
.approval-overview > div { min-width: 0; padding: 15px 17px; border-left: 1px solid #edf2ee; }
.approval-overview > div:first-child { border-left: 0; }
.approval-overview-primary { background: linear-gradient(135deg, #0a432c, #116b49); color: #fff; }
.approval-overview-primary small { color: #a5dfba; font-size: var(--fin-fs-xs); letter-spacing: .1em; }
.approval-overview-primary > span { display: block; margin-top: 7px; color: rgba(255, 255, 255, .58); font-size: var(--fin-fs-xs); }
.approval-overview-primary > strong { display: block; margin-top: 2px; font-family: ui-monospace, Consolas, monospace; font-size: 26px; }
.approval-overview-primary em, .approval-overview-stat em { color: #7e9185; font-size: var(--fin-fs-xs); font-style: normal; }
.approval-overview-primary p { margin: 5px 0 0; color: rgba(255, 255, 255, .48); font-size: var(--fin-fs-xs); }
.approval-overview-stat span, .approval-overview-stat strong, .approval-overview-stat p { display: block; }
.approval-overview-stat span { color: #84958c; font-size: var(--fin-fs-xs); }
.approval-overview-stat strong { margin-top: 8px; color: #2b4e39; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.approval-overview-stat p { margin: 4px 0 0; color: #89988f; font-size: var(--fin-fs-xs); line-height: 1.5; }
.approval-workbench { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 13px; }
.approval-table-card { min-width: 0; overflow: hidden; }
.approval-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #edf2ee; }
.approval-toolbar :deep(.el-input) { width: 260px; }
.finance-tabs button > span { margin-left: 4px; color: #91a097; font-size: var(--fin-fs-xs); }
.approval-subject { display: flex; align-items: center; gap: 8px; }
.approval-subject > span { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 8px; background: #e8f5ee; color: #27704d; font-size: var(--fin-fs-xs); font-weight: 700; }
.approval-subject strong, .approval-subject small { display: block; }
.approval-subject strong { color: #3a5544; font-size: var(--fin-fs-xs); }
.approval-subject small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.approval-product { color: #365441; font-size: var(--fin-fs-xs); }
.approval-purpose { max-width: 170px; overflow: hidden; margin: 3px 0 0; color: #8a9991; font-size: var(--fin-fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.approval-amount { display: block; color: #31533e; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.approval-approved-amount, .approval-rate { display: block; margin-top: 3px; color: #7e9085; font-size: var(--fin-fs-xs); }
.approval-term { color: #526a5b; font-size: var(--fin-fs-xs); }
.approval-ai { display: flex; align-items: center; gap: 5px; }
.approval-ai small { color: #89988f; font-size: var(--fin-fs-xs); }
.approval-legacy { color: #9b865b; font-size: var(--fin-fs-xs); }
.approval-muted { color: #9aa69f; font-size: var(--fin-fs-xs); }
.approval-empty { min-height: 260px; }
.approval-aside { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
.approval-todo { padding: 4px 13px 10px; }
.approval-todo > div { display: flex; gap: 8px; padding: 10px 0; border-top: 1px solid #edf2ee; }
.approval-todo > div:first-child { border-top: 0; }
.approval-todo-icon { display: grid; width: 30px; height: 30px; place-items: center; flex: 0 0 auto; border-radius: 8px; font-size: var(--fin-fs-xs); font-weight: 700; }
.approval-todo-icon.amber { background: #fff3df; color: #a67426; }
.approval-todo-icon.green { background: #e8f6ee; color: #20744c; }
.approval-todo strong { color: #405948; font-size: var(--fin-fs-xs); }
.approval-todo p { margin: 3px 0 0; color: #85958c; font-size: var(--fin-fs-xs); line-height: 1.5; }
.approval-guideline { padding: 16px; border-radius: 13px; background: linear-gradient(145deg, #edf8f2, #f9fcfa); }
.approval-guideline > span { color: #6f8778; font-size: var(--fin-fs-xs); }
.approval-guideline h3 { margin: 5px 0 7px; color: #28573b; font-size: 14px; }
.approval-guideline p { margin: 0; color: #6d8275; font-size: var(--fin-fs-xs); line-height: 1.65; }
.approval-guideline ul { margin: 9px 0 0; padding-left: 14px; color: #778b7e; font-size: var(--fin-fs-xs); line-height: 1.8; }
.approval-dialog { display: grid; gap: 12px; }
.approval-dialog-head { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 11px; background: #f5faf7; }
.approval-subject-mark { display: grid; width: 42px; height: 42px; place-items: center; flex: 0 0 auto; border-radius: 11px; background: #e0f1e7; color: #1b7048; font-size: 13px; font-weight: 800; }
.approval-dialog-head > div:nth-child(2) { min-width: 0; flex: 1; }
.approval-dialog-head small, .approval-dialog-head h2, .approval-dialog-head p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.approval-dialog-head small { color: #8a9991; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.approval-dialog-head h2 { margin: 3px 0 2px; color: #2f4d3a; font-size: 13px; }
.approval-dialog-head p { margin: 0; color: #7e9085; font-size: var(--fin-fs-xs); }
.approval-risk-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: 9px; background: #e9efeb; }
.approval-risk-grid > div { padding: 10px; background: #fbfcfb; }
.approval-risk-grid span, .approval-risk-grid strong, .approval-risk-grid small { display: block; }
.approval-risk-grid span { color: #84958c; font-size: var(--fin-fs-xs); }
.approval-risk-grid strong { margin-top: 4px; color: #345640; font-size: var(--fin-fs-xs); }
.approval-risk-grid small { margin-top: 2px; color: #8b9991; font-size: var(--fin-fs-xs); }
.approval-business { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.approval-business > div { padding: 9px 11px; border: 1px solid #e8eee9; border-radius: 8px; }
.approval-business span { color: #87978e; font-size: var(--fin-fs-xs); }
.approval-business p { margin: 4px 0 0; color: #4c6555; font-size: var(--fin-fs-xs); line-height: 1.55; }
.approval-business a { color: #1a744c; text-decoration: none; }
.approval-check-list { display: grid; gap: 5px; }
.approval-check-list > div { display: flex; gap: 8px; padding: 7px 9px; border-radius: 7px; background: #f4f9f6; }
.approval-check-list > div > span { display: grid; width: 20px; height: 20px; place-items: center; flex: 0 0 auto; border-radius: 50%; background: #e1f1e8; color: #1b7048; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.approval-check-list p { margin: 0; }
.approval-check-list strong, .approval-check-list small { display: block; }
.approval-check-list strong { color: #42604d; font-size: var(--fin-fs-xs); }
.approval-check-list small { margin-top: 2px; color: #86968d; font-size: var(--fin-fs-xs); }
.approval-field-tip { display: block; margin-top: 4px; color: #8b9991; font-size: var(--fin-fs-xs); }
.approval-dialog-tip { padding: 9px 11px; border-radius: 8px; background: #fff8e9; color: #806b43; font-size: var(--fin-fs-xs); }
.approval-result { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: 9px; background: #e8eee9; }
.approval-result > div { padding: 11px 12px; background: #fbfcfb; }
.approval-result span, .approval-result strong, .approval-result small { display: block; }
.approval-result span { color: #87978e; font-size: var(--fin-fs-xs); }
.approval-result strong { margin-top: 4px; color: #2f6647; font-size: var(--fin-fs-xs); }
.approval-result small { margin-top: 2px; color: #8b9991; font-size: var(--fin-fs-xs); }
.approval-result p { margin: 4px 0 0; color: #526b5b; font-size: var(--fin-fs-xs); line-height: 1.55; }
@media (max-width: 1050px) {
  .approval-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .approval-overview > div:nth-child(3) { border-top: 1px solid #edf2ee; border-left: 0; }
  .approval-overview > div:nth-child(4) { border-top: 1px solid #edf2ee; }
}
@media (max-width: 700px) {
  .approval-toolbar { align-items: stretch; flex-direction: column; }
  .approval-toolbar :deep(.el-input) { width: 100%; }
  .approval-aside, .approval-business { grid-template-columns: 1fr; }
  .approval-risk-grid, .approval-result { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 500px) {
  .approval-overview, .approval-risk-grid, .approval-result { grid-template-columns: 1fr; }
  .approval-overview > div { border-top: 1px solid #edf2ee; border-left: 0; }
  .approval-overview > div:first-child { border-top: 0; }
}
</style>
