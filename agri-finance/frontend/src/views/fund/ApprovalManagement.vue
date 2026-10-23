<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>INVESTMENT APPROVAL</small><h1>审批管理</h1><p>结合借款主体信用、贸易背景和 AI 预审结果，完成资金方投资决策。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新申请</el-button></div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>待审批</span><strong>{{ pending.length }}<em> 笔</em></strong><small>需资金方决策</small></article>
      <article class="finance-kpi"><span>今日申请</span><strong>{{ todayCount }}<em> 笔</em></strong><small>融资申请提交量</small></article>
      <article class="finance-kpi"><span>AI 建议通过</span><strong>{{ aiPassCount }}<em> 笔</em></strong><small>置信度 ≥ 85%</small></article>
      <article class="finance-kpi"><span>本轮申请金额</span><strong>{{ compactMoney(applicationAmount) }}</strong><small>待审批申请金额</small></article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head">
        <strong>借款申请</strong>
        <div class="finance-tabs">
          <button type="button" :class="{ on: filter === 'pending' }" @click="filter = 'pending'">待审批</button>
          <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
          <button type="button" :class="{ on: filter === 'done' }" @click="filter = 'done'">已处理</button>
        </div>
      </div>
      <el-table v-if="filtered.length" :data="filtered" style="width: 100%">
        <el-table-column label="申请信息" min-width="210">
          <template #default="{ row }">
            <div class="approval-subject"><span>{{ row.userName?.slice(0, 1) || '农' }}</span><div><strong>{{ row.userName }}</strong><small>{{ row.applicationNo }}</small></div></div>
          </template>
        </el-table-column>
        <el-table-column label="产品/用途" min-width="170">
          <template #default="{ row }"><strong>{{ productName(row.productType) }}</strong><p class="approval-desc">{{ row.fundPurpose || '—' }}</p></template>
        </el-table-column>
        <el-table-column label="申请金额" min-width="110" align="right"><template #default="{ row }">{{ money(row.applyAmount) }}</template></el-table-column>
        <el-table-column label="期限" width="75" align="center"><template #default="{ row }">{{ row.applyTerm }} 月</template></el-table-column>
        <el-table-column label="AI 预审" width="120">
          <template #default="{ row }"><div class="approval-ai"><FinanceStatus :value="row.aiReviewResult" /><small>{{ Number(row.aiConfidence || 0) * 100 }}%</small></div></template>
        </el-table-column>
        <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="115" align="right">
          <template #default="{ row }"><el-button v-if="row.status === '待审批'" class="finance-action-button" @click="openReview(row)">审批</el-button><el-button v-else link class="finance-link-button" @click="showDetail(row)">详情</el-button></template>
        </el-table-column>
      </el-table>
      <div v-else class="finance-empty"><strong>暂无匹配申请</strong><p>当前筛选条件下没有融资申请。</p></div>
    </section>

    <el-dialog v-model="reviewOpen" title="融资审批" width="min(680px, 94vw)">
      <div v-if="selected" class="review-layout">
        <section class="review-summary">
          <div><span>借款主体</span><strong>{{ selected.userName }}</strong><small>{{ selected.applicationNo }}</small></div>
          <div><span>融资产品</span><strong>{{ productName(selected.productType) }}</strong><small>{{ selected.applyTerm }} 个月 · {{ selected.repaymentMethod }}</small></div>
          <div><span>申请金额</span><strong>{{ money(selected.applyAmount) }}</strong><small>建议额度 {{ money(selected.suggestedAmount) }}</small></div>
          <div><span>AI 预审</span><strong>{{ selected.aiReviewResult || '—' }}</strong><small>置信度 {{ Number(selected.aiConfidence || 0) * 100 }}%</small></div>
        </section>
        <div class="review-purpose"><span>融资用途</span><p>{{ selected.fundPurpose || '未填写' }}</p><span>还款来源</span><p>{{ selected.repaymentSource || '未填写' }}</p></div>
        <el-form label-position="top">
          <div class="finance-form-grid">
            <el-form-item label="审批金额（元）"><el-input v-model="reviewAmount" inputmode="decimal" /></el-form-item>
            <el-form-item label="审批利率（%）"><el-input v-model="reviewRate" inputmode="decimal" /></el-form-item>
          </div>
          <el-form-item label="审批意见"><el-input v-model="reviewOpinion" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
        </el-form>
        <div class="review-tip">审批通过后，融资方可在其移动端确认借款并生成还款计划。</div>
      </div>
      <template #footer>
        <el-button class="finance-ghost-button" @click="reviewOpen = false">取消</el-button>
        <el-button type="danger" plain :loading="reviewing" @click="submitReview('已拒绝')">拒绝</el-button>
        <el-button class="finance-action-button" :loading="reviewing" @click="submitReview('已通过')">通过审批</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney as sharedCompact, money, productName, shortDate } from '@/api/finance'

const loading = ref(true)
const reviewing = ref(false)
const applications = ref([])
const filter = ref('pending')
const reviewOpen = ref(false)
const selected = ref(null)
const reviewAmount = ref('')
const reviewRate = ref('')
const reviewOpinion = ref('')

const pending = computed(() => applications.value.filter((item) => item.status === '待审批'))
const todayCount = computed(() => applications.value.filter((item) => shortDate(item.applyTime).slice(0, 10) === new Date().toISOString().slice(0, 10)).length)
const aiPassCount = computed(() => pending.value.filter((item) => item.aiReviewResult === '通过').length)
const applicationAmount = computed(() => pending.value.reduce((total, item) => total + Number(item.applyAmount || 0), 0))
const compactMoney = (value) => sharedCompact(value)
const filtered = computed(() => {
  if (filter.value === 'pending') return pending.value
  if (filter.value === 'done') return applications.value.filter((item) => ['已通过', '已拒绝'].includes(item.status))
  return applications.value
})

function openReview(row) {
  selected.value = row
  reviewAmount.value = String(row.suggestedAmount || row.applyAmount || '')
  reviewRate.value = String(row.suggestedRate || '')
  reviewOpinion.value = row.aiReviewResult === '通过' ? 'AI预审通过，经营数据与贸易背景核验正常' : '完成人工复核后审批'
  reviewOpen.value = true
}

function showDetail(row) {
  selected.value = row
  reviewOpen.value = true
}

async function submitReview(result) {
  if (!selected.value) return
  reviewing.value = true
  try {
    await operationsApi.review(
      selected.value.id,
      result,
      reviewOpinion.value || (result === '已通过' ? '审核通过' : '审核拒绝'),
      result === '已通过' ? Number(reviewAmount.value) : null,
      result === '已通过' ? Number(reviewRate.value) : null,
    )
    ElMessage.success(result === '已通过' ? '审批通过' : '申请已拒绝')
    reviewOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '审批失败')
  } finally {
    reviewing.value = false
  }
}

async function load() {
  loading.value = true
  try {
    applications.value = (await operationsApi.applications()) || []
  } catch (err) {
    ElMessage.error(err.message || '审批申请加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.approval-subject { display: flex; align-items: center; gap: 9px; }
.approval-subject > span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; background: #e8f5ee; color: var(--fin-green-700); font-size: 9px; font-weight: 700; }
.approval-subject strong, .approval-subject small { display: block; }
.approval-subject strong { color: #3b5545; font-size: 10px; }
.approval-subject small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: 7.5px; }
.approval-desc { max-width: 180px; overflow: hidden; margin: 3px 0 0; color: #8a9991; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.approval-ai { display: flex; align-items: center; gap: 6px; }
.approval-ai small { color: #8c9a92; font-size: 7.5px; }
.review-layout { display: grid; gap: 13px; }
.review-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: hidden; border-radius: 10px; background: #edf2ee; gap: 1px; }
.review-summary > div { padding: 10px; background: #f9fbfa; }
.review-summary span, .review-summary strong, .review-summary small { display: block; }
.review-summary span { color: #8a9990; font-size: 7.5px; }
.review-summary strong { margin-top: 3px; color: #365441; font-size: 10px; }
.review-summary small { margin-top: 2px; color: #8e9b93; font-size: 7px; }
.review-purpose { padding: 11px 13px; border-radius: 9px; background: #f6faf7; }
.review-purpose span { color: #8a9990; font-size: 8px; }
.review-purpose p { margin: 3px 0 8px; color: #4d6656; font-size: 9px; }
.review-purpose p:last-child { margin-bottom: 0; }
.review-tip { padding: 10px 12px; border-radius: 8px; background: #eef8f2; color: #5e7768; font-size: 8.5px; }
@media (max-width: 680px) { .review-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
