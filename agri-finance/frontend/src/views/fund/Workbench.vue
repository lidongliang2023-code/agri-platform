<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>FUND WORKBENCH</small><h1>资金工作台</h1><p>发现优质农业资产、配置资金并跟踪投资收益与风险。</p></div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新数据</el-button>
        <el-button class="finance-action-button" @click="$router.push('/fund/asset-market')">进入资产市场</el-button>
      </div>
    </header>

    <section class="fund-hero">
      <div>
        <span>FENGCHAIN CAPITAL PARTNER</span>
        <h1>{{ provider?.institutionName || '丰链云合作资金机构' }}</h1>
        <p>机构状态：{{ provider?.reviewStatus || '审核中' }} · 资金业务与风控策略已接入平台数据。</p>
        <div>
          <el-button class="hero-primary" @click="$router.push('/fund/asset-market')">配置新资产</el-button>
          <el-button class="hero-ghost" @click="$router.push('/fund/my-investment')">查看投资组合</el-button>
        </div>
      </div>
      <div class="fund-hero-orb">
        <span>资金</span>
        <strong>{{ compactMoney(totalInvested) }}</strong>
        <small>累计配置资金</small>
      </div>
    </section>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>累计投资</span><strong>{{ compactMoney(totalInvested) }}</strong><small>{{ investments.length }} 笔投资记录</small></article>
      <article class="finance-kpi"><span>已回收本息</span><strong>{{ compactMoney(totalReturn) }}</strong><small>已完成投资回款</small></article>
      <article class="finance-kpi"><span>可配置资产</span><strong>{{ compactMoney(availableAmount) }}</strong><small>{{ assets.length }} 个可投资资产</small></article>
      <article class="finance-kpi"><span>待审批</span><strong>{{ pendingApplications.length }}<em> 笔</em></strong><small>AI 已完成预审辅助</small></article>
    </div>

    <section>
      <div class="ops-section-head">
        <div><strong>AI 推荐资产</strong><span>按收益、质押物与借款主体信用综合排序</span></div>
        <el-button link class="finance-link-button" @click="$router.push('/fund/asset-market')">查看全部 →</el-button>
      </div>
      <div class="fund-asset-grid">
        <article v-for="asset in recommendedAssets" :key="asset.id" @click="openAsset(asset)">
          <div class="fund-asset-head">
            <span><Tickets /></span>
            <div><small>{{ asset.assetNo }}</small><strong>{{ asset.assetName }}</strong></div>
            <i>{{ Number(asset.aiRecommendationScore || 0).toFixed(0) }}<small>分</small></i>
          </div>
          <p>{{ asset.recommendationReason }}</p>
          <div class="fund-asset-meta">
            <span>{{ asset.financingScenario }}</span><span>{{ asset.borrowerRating }} 级</span>
            <span v-if="asset.iotMonitored">IoT 已监控</span>
          </div>
          <div class="fund-asset-values">
            <div><span>可投金额</span><strong>{{ money(asset.availableAmount) }}</strong></div>
            <div><span>期限</span><strong>{{ asset.term }} 个月</strong></div>
            <div><span>参考年化</span><strong class="green">{{ assetRate(asset) }}%</strong></div>
          </div>
        </article>
      </div>
    </section>

    <div class="finance-grid-two">
      <section class="finance-card">
        <div class="finance-card-head"><strong>投资组合</strong><el-button link class="finance-link-button" @click="$router.push('/fund/my-investment')">全部 →</el-button></div>
        <el-table v-if="investments.length" :data="investments.slice(0, 5)" style="width: 100%">
          <el-table-column prop="assetName" label="资产" min-width="190" />
          <el-table-column label="投资金额" min-width="110" align="right"><template #default="{ row }">{{ money(row.investmentAmount) }}</template></el-table-column>
          <el-table-column label="预期收益" min-width="100" align="right"><template #default="{ row }">{{ money(row.expectedReturn) }}</template></el-table-column>
          <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        </el-table>
        <div v-else class="finance-empty"><strong>暂无投资记录</strong><p>从资产市场选择资产并完成投资后，会在这里形成投资组合。</p></div>
      </section>

      <aside class="fund-side-stack">
        <section class="finance-card">
          <div class="finance-card-head"><strong>待审批事项</strong><span class="finance-muted">{{ pendingApplications.length }} 笔</span></div>
          <div class="fund-approval-list">
            <button v-for="item in pendingApplications.slice(0, 3)" :key="item.id" type="button" @click="$router.push('/fund/approval')">
              <span>{{ item.userName }}</span>
              <div><strong>{{ productName(item.productType) }} · {{ compactMoney(item.applyAmount) }}</strong><small>{{ item.applicationNo }}</small></div>
              <b>→</b>
            </button>
            <div v-if="!pendingApplications.length" class="fund-empty-line">暂无待审批申请</div>
          </div>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>风险策略状态</strong><FinanceStatus value="正常" /></div>
          <div class="fund-risk-summary">
            <div><span>启用规则</span><strong>{{ enabledRules }}<em> 条</em></strong></div>
            <div><span>本月风险预警</span><strong>{{ overdue.length }}<em> 笔</em></strong></div>
            <p>资产准入、质押率、逾期和多头融资规则已纳入自动预审。</p>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Tickets } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney as sharedCompact, money as sharedMoney, productName } from '@/api/finance'

const router = useRouter()
const loading = ref(true)
const provider = ref(null)
const assets = ref([])
const investments = ref([])
const applications = ref([])
const rules = ref([])
const overdue = ref([])
const totalInvested = ref(0)
const totalReturn = ref(0)

const pendingApplications = computed(() => applications.value.filter((item) => item.status === '待审批'))
const availableAmount = computed(() => assets.value.reduce((total, item) => total + Number(item.availableAmount || 0), 0))
const recommendedAssets = computed(() => [...assets.value].sort((a, b) => Number(b.aiRecommendationScore || 0) - Number(a.aiRecommendationScore || 0)).slice(0, 3))
const enabledRules = computed(() => rules.value.filter((item) => item.status === '启用').length)
const compactMoney = (value) => sharedCompact(value)
const money = (value) => sharedMoney(value)
const assetRate = (asset) => asset.amount > 0 ? ((Number(asset.expectedReturn) / Number(asset.amount)) * 100).toFixed(2) : '0.00'

function openAsset(asset) {
  router.push({ path: '/fund/asset-market', query: { assetId: asset.id } })
}

async function load() {
  loading.value = true
  try {
    const [providerData, assetData, investmentData, applicationData, ruleData, overdueData, invested, returned] = await Promise.all([
      operationsApi.provider(),
      operationsApi.availableAssets(),
      operationsApi.investments(),
      operationsApi.applications(),
      operationsApi.riskRules(),
      operationsApi.overdue(),
      operationsApi.totalInvested(),
      operationsApi.totalReturn(),
    ])
    provider.value = providerData
    assets.value = assetData || []
    investments.value = investmentData || []
    applications.value = applicationData || []
    rules.value = ruleData || []
    overdue.value = overdueData || []
    totalInvested.value = Number(invested || 0)
    totalReturn.value = Number(returned || 0)
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.fund-hero {
  display: grid;
  min-height: 205px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 25px 28px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 87% 10%, rgba(132, 231, 172, .2), transparent 14rem),
    linear-gradient(135deg, #083c27, #0f7048 68%, #159a5e);
  color: #fff;
}

.fund-hero > div:first-child > span {
  color: #a9dfbe;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .12em;
}

.fund-hero h1 {
  margin: 9px 0 5px;
  font-size: 27px;
}

.fund-hero p {
  margin: 0;
  color: rgba(255, 255, 255, .62);
  font-size: 9px;
}

.fund-hero > div:first-child > div {
  display: flex;
  gap: 8px;
  margin-top: 17px;
}

.fund-hero :deep(.el-button) {
  height: 35px;
  border-radius: 9px;
  font-size: 9px;
}

.fund-hero :deep(.hero-primary) { border-color: #fff; background: #fff; color: var(--fin-green-800); font-weight: 700; }
.fund-hero :deep(.hero-ghost) { border-color: rgba(255, 255, 255, .24); background: rgba(255, 255, 255, .08); color: #fff; }

.fund-hero-orb {
  display: flex;
  width: 160px;
  height: 160px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  margin-right: 20px;
  border: 1px solid rgba(255, 255, 255, .15);
  border-radius: 50%;
  background: rgba(255, 255, 255, .07);
  box-shadow: 0 0 0 13px rgba(255, 255, 255, .035);
}

.fund-hero-orb > span { color: #bdeed0; font-size: 9px; font-weight: 700; }
.fund-hero-orb > strong { margin: 5px 0 2px; font-family: ui-monospace, Consolas, monospace; font-size: 22px; }
.fund-hero-orb > small { color: rgba(255, 255, 255, .48); font-size: 7.5px; }
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }

.ops-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin: 3px 0 10px;
}

.ops-section-head > div { display: flex; flex-direction: column; gap: 2px; }
.ops-section-head strong { color: #244735; font-size: 15px; }
.ops-section-head span { color: #86968c; font-size: 8.5px; }

.fund-asset-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 11px; }
.fund-asset-grid article {
  padding: 15px; border: 1px solid var(--fin-line); border-radius: 14px; background: #fff;
  cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.fund-asset-grid article:hover { border-color: #9dcdb1; box-shadow: 0 12px 25px rgba(18, 70, 42, .07); transform: translateY(-2px); }
.fund-asset-head { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.fund-asset-head > span { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 10px; background: #e8f5ee; color: var(--fin-green-700); }
.fund-asset-head > span svg { width: 17px; }
.fund-asset-head > div { min-width: 0; }
.fund-asset-head small, .fund-asset-head strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fund-asset-head small { color: #91a097; font-family: ui-monospace, Consolas, monospace; font-size: 7px; }
.fund-asset-head strong { margin-top: 2px; color: #314d3d; font-size: 10.5px; }
.fund-asset-head > i { color: var(--fin-green-700); font-family: ui-monospace, Consolas, monospace; font-size: 16px; font-style: normal; font-weight: 800; }
.fund-asset-head > i small { display: inline; margin-left: 1px; color: #8a9990; font-size: 7px; }
.fund-asset-grid article > p { min-height: 42px; margin: 10px 0; color: #7d8e83; font-size: 8.5px; line-height: 1.6; }
.fund-asset-meta { display: flex; flex-wrap: wrap; gap: 5px; }
.fund-asset-meta span { padding: 3px 7px; border-radius: 6px; background: #f3f8f5; color: #5e7867; font-size: 7.5px; }
.fund-asset-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 11px; overflow: hidden; border-radius: 8px; background: #edf2ee; }
.fund-asset-values > div { padding: 8px; background: #f9fbfa; }
.fund-asset-values span, .fund-asset-values strong { display: block; }
.fund-asset-values span { color: #8c9b92; font-size: 7px; }
.fund-asset-values strong { margin-top: 2px; color: #3b5745; font-family: ui-monospace, Consolas, monospace; font-size: 8px; }
.fund-asset-values strong.green { color: #16764a; }

.fund-side-stack { display: grid; gap: 14px; }
.fund-approval-list { display: grid; }
.fund-approval-list button {
  display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 9px;
  padding: 11px 14px; border: 0; border-top: 1px solid #edf2ee; background: #fff; color: inherit; text-align: left; cursor: pointer;
}
.fund-approval-list button:first-child { border-top: 0; }
.fund-approval-list button > span { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 10px; background: #e9f6ef; color: #3d7658; font-size: 8px; font-weight: 700; }
.fund-approval-list button > div { min-width: 0; }
.fund-approval-list strong, .fund-approval-list small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fund-approval-list strong { color: #3a5444; font-size: 9px; }
.fund-approval-list small { margin-top: 3px; color: #8d9b93; font-family: ui-monospace, Consolas, monospace; font-size: 7.5px; }
.fund-approval-list button > b { color: #98a49c; font-size: 10px; }
.fund-empty-line { padding: 20px; color: #8d9b93; font-size: 9px; text-align: center; }
.fund-risk-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #edf2ee; }
.fund-risk-summary > div { padding: 11px 13px; background: #fff; }
.fund-risk-summary span, .fund-risk-summary strong { display: block; }
.fund-risk-summary span { color: #8a9990; font-size: 8px; }
.fund-risk-summary strong { margin-top: 4px; color: #274e38; font-family: ui-monospace, Consolas, monospace; font-size: 15px; }
.fund-risk-summary em { color: #71847a; font-size: 8px; font-style: normal; }
.fund-risk-summary p { grid-column: 1 / -1; margin: 0; padding: 10px 13px; background: #f6faf7; color: #708479; font-size: 8px; line-height: 1.6; }

@media (max-width: 1000px) { .fund-asset-grid { grid-template-columns: 1fr; } }
@media (max-width: 680px) { .fund-hero { grid-template-columns: 1fr; } .fund-hero-orb { display: none; } }
</style>
