<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>CREDIT ENQUIRY</small><h1>信用查询</h1><p>查询融资主体信用评分、可用授信和平台经营画像。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="loadSubjects">刷新主体</el-button></div>
    </header>

    <section class="credit-search-card">
      <div><span>查询融资主体</span><strong>输入主体 ID 或从申请记录中选择</strong></div>
      <el-select v-model="subjectId" filterable allow-create placeholder="请选择融资主体" @change="loadCredit">
        <el-option v-for="item in subjects" :key="item.id" :label="`${item.name}（${item.id}）`" :value="item.id" />
      </el-select>
      <el-button class="finance-action-button" @click="loadCredit">查询信用</el-button>
    </section>

    <div v-if="credit" class="credit-profile-hero">
      <div class="credit-profile-score"><strong>{{ credit.compositeScore }}</strong><span>{{ credit.creditLevel }} 级</span></div>
      <div><span>融资主体</span><h2>{{ selectedSubjectName }}</h2><p>{{ credit.riskAlerts || '当前信用画像稳定' }}</p></div>
      <div class="credit-profile-values"><div><span>可用授信</span><strong>{{ compactMoney(credit.availableAmount) }}</strong></div><div><span>参考利率</span><strong>{{ credit.referenceRate }}%</strong></div><div><span>近30天</span><strong>{{ credit.changeTrend }}</strong></div></div>
    </div>

    <div v-if="credit" class="finance-kpis">
      <article class="finance-kpi"><span>经营能力</span><strong>{{ credit.businessAbilityScore }}<em> 分</em></strong><small>经营规模与收入稳定度</small></article>
      <article class="finance-kpi"><span>偿债能力</span><strong>{{ credit.debtAbilityScore }}<em> 分</em></strong><small>现金流与负债结构</small></article>
      <article class="finance-kpi"><span>履约率</span><strong>{{ credit.fulfillmentRate }}<em>%</em></strong><small>{{ credit.overdueCount }} 次历史逾期</small></article>
      <article class="finance-kpi"><span>平台交易</span><strong>{{ compactMoney(credit.totalTransactionAmount) }}</strong><small>经营 {{ credit.platformMonths }} 个月</small></article>
    </div>

    <div class="credit-admin-layout">
      <section class="finance-card">
        <div class="finance-card-head"><strong>该主体融资申请</strong><small>{{ subjectApplications.length }} 条记录</small></div>
        <el-table :data="subjectApplications" style="width: 100%">
          <el-table-column prop="applicationNo" label="申请编号" min-width="150" />
          <el-table-column label="产品" min-width="100"><template #default="{ row }">{{ productName(row.productType) }}</template></el-table-column>
          <el-table-column label="申请金额" min-width="110" align="right"><template #default="{ row }">{{ compactMoney(row.applyAmount) }}</template></el-table-column>
          <el-table-column label="期限" width="75" align="center"><template #default="{ row }">{{ row.applyTerm }} 月</template></el-table-column>
          <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        </el-table>
        <div v-if="!subjectApplications.length" class="finance-empty"><strong>暂无融资申请</strong><p>该主体还没有发起融资申请。</p></div>
      </section>
      <aside class="finance-card">
        <div class="finance-card-head"><strong>风险画像</strong><CreditCard /></div>
        <div class="credit-risk-list">
          <div><span>历史逾期</span><b :class="{ danger: credit?.overdueCount > 0 }">{{ credit?.overdueCount || 0 }} 次</b></div>
          <div><span>复购率</span><b>{{ credit?.repurchaseRate || 0 }}%</b></div>
          <div><span>信用趋势</span><b>{{ credit?.changeTrend || '—' }}</b></div>
          <div><span>风险提示</span><p>{{ credit?.riskAlerts || '无' }}</p></div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CreditCard } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, productName } from '@/api/finance'

const loading = ref(true)
const applications = ref([])
const subjectId = ref('2001')
const credit = ref(null)
const subjects = computed(() => {
  const map = new Map([['2001', '绿源农业合作社']])
  applications.value.forEach((item) => map.set(String(item.userId), item.userName || String(item.userId)))
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})
const selectedSubjectName = computed(() => subjects.value.find((item) => item.id === subjectId.value)?.name || subjectId.value)
const subjectApplications = computed(() => applications.value.filter((item) => String(item.userId) === String(subjectId.value)))

async function loadSubjects() {
  loading.value = true
  try { applications.value = (await operationsApi.applications()) || []; await loadCredit() } catch (err) { ElMessage.error(err.message || '主体列表加载失败') } finally { loading.value = false }
}

async function loadCredit() {
  if (!subjectId.value) return
  try { credit.value = await operationsApi.credit(subjectId.value); if (!credit.value) ElMessage.warning('未找到该主体信用记录') } catch (err) { credit.value = null; ElMessage.error(err.message || '信用查询失败') }
}

onMounted(loadSubjects)
</script>

<style scoped>
.credit-search-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--fin-line); border-radius: 13px; background: #fff; }
.credit-search-card > div { display: flex; flex-direction: column; margin-right: auto; }
.credit-search-card span { color: #8a9990; font-size: 8px; }
.credit-search-card strong { margin-top: 2px; color: #3e5848; font-size: 10px; }
.credit-search-card :deep(.el-select) { width: 280px; }
.credit-profile-hero { display: flex; align-items: center; gap: 18px; padding: 21px 24px; border-radius: 16px; background: radial-gradient(circle at 88% 9%, rgba(131, 228, 170, .18), transparent 13rem), linear-gradient(135deg, #083c27, #0f7048); color: #fff; }
.credit-profile-score { display: flex; width: 90px; height: 90px; align-items: center; justify-content: center; flex-direction: column; border: 1px solid rgba(255, 255, 255, .16); border-radius: 50%; background: rgba(255, 255, 255, .08); }
.credit-profile-score strong { font-family: ui-monospace, Consolas, monospace; font-size: 27px; }
.credit-profile-score span { color: rgba(255, 255, 255, .5); font-size: 8px; }
.credit-profile-hero > div:nth-child(2) { flex: 1; }
.credit-profile-hero > div:nth-child(2) > span { color: #a8dfbd; font-size: 8px; }
.credit-profile-hero h2 { margin: 4px 0 3px; font-size: 19px; }
.credit-profile-hero p { margin: 0; color: rgba(255, 255, 255, .56); font-size: 8.5px; }
.credit-profile-values { display: flex; gap: 1px; }
.credit-profile-values > div { min-width: 100px; padding: 10px; background: rgba(255, 255, 255, .06); }
.credit-profile-values span, .credit-profile-values strong { display: block; }
.credit-profile-values span { color: rgba(255, 255, 255, .45); font-size: 7.5px; }
.credit-profile-values strong { margin-top: 3px; font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.credit-admin-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; align-items: start; }
.credit-admin-layout :deep(.finance-card-head > svg) { width: 14px; height: 14px; color: var(--fin-green-700); }
.credit-risk-list { display: grid; padding: 13px 15px; }
.credit-risk-list > div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid #edf2ee; }
.credit-risk-list > div:first-child { border-top: 0; }
.credit-risk-list span { color: #84948a; font-size: 8px; }
.credit-risk-list b { color: #31583f; font-size: 9px; }
.credit-risk-list b.danger { color: #b34c44; }
.credit-risk-list p { max-width: 170px; margin: 0; color: #526c5b; font-size: 8.5px; line-height: 1.55; text-align: right; }
@media (max-width: 800px) { .credit-search-card { align-items: stretch; flex-direction: column; } .credit-search-card :deep(.el-select) { width: 100%; } .credit-profile-hero { align-items: flex-start; flex-wrap: wrap; } .credit-profile-values { width: 100%; } .credit-admin-layout { grid-template-columns: 1fr; } }
</style>
