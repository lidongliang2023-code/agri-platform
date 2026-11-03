<template>
  <section class="finance-page asset-market-page">
    <header class="finance-page-heading">
      <div>
        <small>ASSET OPPORTUNITY MARKET</small>
        <h1>资产市场</h1>
        <p>从平台核验的农业供应链资产中发现机会，查看募集进度与风险依据后完成资金配置。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新资产</el-button>
        <el-button class="finance-action-button" @click="router.push('/fund/my-investment')">我的投资</el-button>
      </div>
    </header>

    <div v-if="error" class="market-error">
      <span>{{ error }}</span>
      <el-button link @click="load">重新加载</el-button>
    </div>

    <el-skeleton v-if="loading && !data" :rows="10" animated />

    <template v-if="data">
      <section class="market-position">
        <div class="market-position-main">
          <span>可用资金头寸</span>
          <strong>{{ money(account.availableAmount) }}</strong>
          <p>机构总额度 {{ compactMoney(account.totalLimit) }} · 已占用 {{ compactMoney(account.committedAmount) }}</p>
          <div class="market-position-progress">
            <i :style="{ width: `${Math.min(100, Number(account.utilizationRate || 0))}%` }" />
          </div>
        </div>
        <div class="market-position-stat"><span>在募集资产</span><strong>{{ summary.assetCount }}<small> 个</small></strong><p>发行规模 {{ compactMoney(summary.totalAmount) }}</p></div>
        <div class="market-position-stat"><span>市场可投余额</span><strong>{{ compactMoney(summary.availableAmount) }}</strong><p>可继续配置的资产额度</p></div>
        <div class="market-position-stat"><span>平均 AI 推荐分</span><strong>{{ number(summary.averageScore) }}<small> 分</small></strong><p>{{ summary.iotAssetCount }} 个资产接入 IoT</p></div>
      </section>

      <section class="market-controls">
        <div class="finance-tabs">
          <button
            v-for="item in filters"
            :key="item.key"
            type="button"
            :class="{ on: activeFilter === item.key }"
            @click="activeFilter = item.key"
          >
            {{ item.label }}
            <span v-if="item.key === 'all'">{{ assets.length }}</span>
          </button>
        </div>
        <div class="market-control-actions">
          <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="搜索资产、主体或场景" />
          <el-select v-model="sortBy" style="width: 145px">
            <el-option label="AI 优先" value="score" />
            <el-option label="收益优先" value="rate" />
            <el-option label="剩余额度" value="available" />
            <el-option label="最新发布" value="newest" />
          </el-select>
        </div>
      </section>

      <div v-if="filteredAssets.length" class="market-card-grid">
        <article v-for="asset in filteredAssets" :key="asset.id" class="market-asset-card">
          <div class="market-card-head">
            <div class="market-asset-mark">{{ asset.assetType?.slice(0, 1) || '资' }}</div>
            <div>
              <small>{{ asset.assetNo }} · {{ asset.assetType }}</small>
              <h2>{{ asset.assetName }}</h2>
              <p>{{ asset.financingScenario }} · {{ asset.term }} 个月</p>
            </div>
            <div class="market-ai-score">
              <strong>{{ number(asset.aiRecommendationScore) }}</strong>
              <small>AI 推荐分</small>
            </div>
          </div>

          <div class="market-borrower">
            <span>{{ asset.borrowerName?.slice(0, 1) || '农' }}</span>
            <div><strong>{{ asset.borrowerName }}</strong><small>主体评级 {{ asset.borrowerRating }} 级 · {{ asset.investorCount }} 笔资金已配置</small></div>
            <em :class="riskTone(asset.riskLevel)">{{ riskText(asset.riskLevel) }}</em>
          </div>

          <div class="market-rate-grid">
            <div><span>持有期参考收益</span><strong>{{ number(asset.holdingPeriodRate) }}%</strong></div>
            <div><span>年化参考收益</span><b>{{ number(asset.annualizedRate) }}%</b></div>
            <div><span>质押率</span><b>{{ number(asset.pledgeRate) }}%</b></div>
          </div>

          <div class="market-funding-progress">
            <div>
              <span>募集进度</span>
              <b>{{ number(asset.fundingProgress) }}% · 剩余 {{ compactMoney(asset.availableAmount) }}</b>
            </div>
            <div class="finance-progress"><span :style="{ width: `${Math.min(100, Number(asset.fundingProgress || 0))}%` }" /></div>
          </div>

          <div class="market-security-tags">
            <span>{{ asset.collateralType || '信用融资' }}</span>
            <span v-if="asset.iotMonitored">IoT 持续监控</span>
            <span v-if="Number(asset.myInvestedAmount) > 0" class="owned">已配置 {{ compactMoney(asset.myInvestedAmount) }}</span>
          </div>

          <p class="market-reason">{{ asset.recommendationReason }}</p>

          <div class="market-card-footer">
            <el-button class="market-detail-button" @click="openDetail(asset)">查看资产详情</el-button>
            <el-button
              class="finance-action-button"
              :disabled="Number(asset.availableAmount) <= 0"
              @click="openInvest(asset)"
            >
              配置资金
            </el-button>
          </div>
        </article>
      </div>

      <div v-else class="finance-card finance-empty market-empty">
        <strong>{{ keyword || activeFilter !== 'all' ? '没有匹配的资产' : '暂无可配置资产' }}</strong>
        <p>{{ keyword || activeFilter !== 'all' ? '请调整筛选条件后重新查询。' : '平台发布新的融资资产后会展示在这里。' }}</p>
        <el-button v-if="keyword || activeFilter !== 'all'" class="finance-ghost-button" @click="resetFilters">清除筛选</el-button>
      </div>
    </template>

    <FundAssetInvestDialog
      v-model="investOpen"
      :asset="selectedAsset"
      :account="account"
      @success="handleInvestmentSuccess"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import FundAssetInvestDialog from '@/components/FundAssetInvestDialog.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money } from '@/api/finance'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const data = ref(null)
const activeFilter = ref('all')
const keyword = ref('')
const sortBy = ref('score')
const investOpen = ref(false)
const selectedAsset = ref(null)

const filters = [
  { key: 'all', label: '全部资产' },
  { key: 'recommend', label: 'AI 优选' },
  { key: 'iot', label: 'IoT 监控' },
  { key: 'collateral', label: '有质押物' },
]

const assets = computed(() => data.value?.assets || [])
const account = computed(() => data.value?.account || {})
const summary = computed(() => data.value?.summary || {})
const number = (value) => Number(value || 0).toFixed(2)
const riskTone = (level) => Number(level) <= 1 ? 'low' : Number(level) === 2 ? 'medium' : 'high'
const riskText = (level) => Number(level) <= 1 ? '优先配置' : Number(level) === 2 ? '审慎配置' : '重点复核'

const filteredAssets = computed(() => {
  let rows = [...assets.value]
  if (activeFilter.value === 'recommend') rows = rows.filter((item) => Number(item.aiRecommendationScore) >= 90)
  if (activeFilter.value === 'iot') rows = rows.filter((item) => item.iotMonitored)
  if (activeFilter.value === 'collateral') rows = rows.filter((item) => item.collateralType)
  const search = keyword.value.trim().toLowerCase()
  if (search) {
    rows = rows.filter((item) => [
      item.assetName,
      item.assetNo,
      item.borrowerName,
      item.financingScenario,
      item.collateralType,
    ].join(' ').toLowerCase().includes(search))
  }
  return rows.sort((a, b) => {
    if (sortBy.value === 'rate') return Number(b.annualizedRate) - Number(a.annualizedRate)
    if (sortBy.value === 'available') return Number(b.availableAmount) - Number(a.availableAmount)
    if (sortBy.value === 'newest') return String(b.publishTime || '').localeCompare(String(a.publishTime || ''))
    return Number(b.aiRecommendationScore) - Number(a.aiRecommendationScore)
  })
})

function openDetail(asset) {
  router.push(`/fund/asset-market/${encodeURIComponent(asset.id)}`)
}

function openInvest(asset) {
  selectedAsset.value = asset
  investOpen.value = true
}

function resetFilters() {
  activeFilter.value = 'all'
  keyword.value = ''
  sortBy.value = 'score'
}

async function handleInvestmentSuccess() {
  await load()
  try {
    await ElMessageBox.confirm(
      '资金配置已完成，资产额度和机构可用资金已实时更新。是否前往投资组合继续跟踪回款？',
      '配置成功',
      { confirmButtonText: '查看投资组合', cancelButtonText: '继续浏览', type: 'success' },
    )
    router.push('/fund/my-investment')
  } catch {
    // 用户选择继续浏览资产市场。
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await operationsApi.fundMarket()
    const queryAssetId = String(route.query.assetId || '')
    if (queryAssetId) {
      const target = assets.value.find((item) => item.id === queryAssetId)
      if (target) {
        router.replace(`/fund/asset-market/${encodeURIComponent(target.id)}`)
      } else {
        ElMessage.warning('资产不存在或已停止募集')
      }
    }
  } catch (err) {
    error.value = err.message || '资产市场加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.market-error { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border: 1px solid #efd3cd; border-radius: 10px; background: #fff8f6; color: #a34f3e; font-size: var(--fin-fs-xs); }
.market-position { display: grid; grid-template-columns: 1.25fr repeat(3, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--fin-line); border-radius: 15px; background: #fff; }
.market-position > div { min-width: 0; padding: 15px 17px; border-left: 1px solid #ebf0ec; }
.market-position > div:first-child { border-left: 0; }
.market-position-main { background: linear-gradient(135deg, #0a412b, #116d49); color: #fff; }
.market-position-main > span { color: rgba(255, 255, 255, .56); font-size: var(--fin-fs-xs); }
.market-position-main > strong { display: block; margin-top: 4px; font-family: ui-monospace, Consolas, monospace; font-size: 21px; }
.market-position-main > p { margin: 4px 0 0; color: rgba(255, 255, 255, .5); font-size: var(--fin-fs-xs); }
.market-position-progress { height: 4px; margin-top: 10px; overflow: hidden; border-radius: 99px; background: rgba(255, 255, 255, .12); }
.market-position-progress i { display: block; height: 100%; border-radius: inherit; background: #8ee4ae; }
.market-position-stat span, .market-position-stat strong, .market-position-stat p { display: block; }
.market-position-stat span { color: #83938a; font-size: var(--fin-fs-xs); }
.market-position-stat strong { margin-top: 7px; color: #294d38; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.market-position-stat strong small { color: #778c7f; font-size: var(--fin-fs-xs); }
.market-position-stat p { margin: 4px 0 0; color: #89988f; font-size: var(--fin-fs-xs); }
.market-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.market-control-actions { display: flex; gap: 7px; }
.market-control-actions :deep(.el-input) { width: 240px; }
.finance-tabs button > span { margin-left: 4px; color: #91a097; font-size: var(--fin-fs-xs); }
.market-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
.market-asset-card { min-width: 0; padding: 16px; border: 1px solid var(--fin-line); border-radius: 15px; background: #fff; box-shadow: 0 5px 18px rgba(20, 67, 41, .025); }
.market-card-head { display: grid; grid-template-columns: 42px minmax(0, 1fr) 55px; align-items: center; gap: 10px; }
.market-asset-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 11px; background: linear-gradient(135deg, #dff2e7, #edf8f2); color: #176f49; font-size: 14px; font-weight: 800; }
.market-card-head > div:nth-child(2) { min-width: 0; }
.market-card-head small, .market-card-head h2, .market-card-head p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.market-card-head small { color: #85958c; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.market-card-head h2 { margin: 3px 0 0; color: #2d4b39; font-size: 12px; }
.market-card-head p { margin: 3px 0 0; color: #8a9991; font-size: var(--fin-fs-xs); }
.market-ai-score { text-align: right; }
.market-ai-score strong { display: block; color: #16764a; font-family: ui-monospace, Consolas, monospace; font-size: 19px; }
.market-ai-score small { display: block; color: #85958c; font-size: var(--fin-fs-xs); }
.market-borrower { display: flex; align-items: center; gap: 8px; margin: 12px 0 10px; padding: 9px 10px; border-radius: 9px; background: #f7faf8; }
.market-borrower > span { display: grid; width: 30px; height: 30px; place-items: center; flex: 0 0 auto; border-radius: 8px; background: #e3f2e9; color: #2d6749; font-size: var(--fin-fs-xs); font-weight: 700; }
.market-borrower > div { min-width: 0; flex: 1; }
.market-borrower strong, .market-borrower small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.market-borrower strong { color: #3e5847; font-size: var(--fin-fs-xs); }
.market-borrower small { margin-top: 2px; color: #89988f; font-size: var(--fin-fs-xs); }
.market-borrower em { padding: 3px 6px; border-radius: 5px; font-size: var(--fin-fs-xs); font-style: normal; }
.market-borrower em.low { background: #e8f6ee; color: #19754b; }
.market-borrower em.medium { background: #fff3df; color: #a06f25; }
.market-borrower em.high { background: #fceae7; color: #b94c3d; }
.market-rate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: 8px; background: #e9efeb; }
.market-rate-grid > div { padding: 9px 10px; background: #fbfcfb; }
.market-rate-grid span, .market-rate-grid strong, .market-rate-grid b { display: block; }
.market-rate-grid span { color: #89988f; font-size: var(--fin-fs-xs); }
.market-rate-grid strong { margin-top: 3px; color: #137249; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
.market-rate-grid b { margin-top: 3px; color: #405b49; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.market-funding-progress { margin-top: 11px; }
.market-funding-progress > div:first-child { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
.market-funding-progress span { color: #7d8e83; font-size: var(--fin-fs-xs); }
.market-funding-progress b { color: #52695b; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.market-funding-progress :deep(.finance-progress) { height: 5px; }
.market-security-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.market-security-tags span { padding: 3px 7px; border-radius: 5px; background: #f2f7f4; color: #62786a; font-size: var(--fin-fs-xs); }
.market-security-tags span.owned { background: #e6f5ec; color: #18734a; }
.market-reason { display: -webkit-box; min-height: 31px; overflow: hidden; margin: 10px 0 0; color: #7d8e83; font-size: var(--fin-fs-xs); line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.market-card-footer { display: flex; align-items: center; justify-content: flex-end; gap: 7px; margin-top: 12px; padding-top: 11px; border-top: 1px solid #edf2ee; }
.market-card-footer :deep(.el-button) { height: 32px; margin: 0; border-radius: 8px; font-size: var(--fin-fs-xs); }
.market-detail-button { border-color: #d7e3db; background: #fff; color: #506b5a; }
.market-empty { padding: 50px 20px; }
.market-empty :deep(.el-button) { margin-top: 10px; }
@media (max-width: 1050px) {
  .market-position { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .market-position > div:nth-child(3) { border-top: 1px solid #ebf0ec; border-left: 0; }
  .market-position > div:nth-child(4) { border-top: 1px solid #ebf0ec; }
}
@media (max-width: 850px) {
  .market-card-grid { grid-template-columns: 1fr; }
  .market-controls { align-items: stretch; flex-direction: column; }
  .market-control-actions :deep(.el-input) { flex: 1; width: auto; }
}
@media (max-width: 560px) {
  .market-position { grid-template-columns: 1fr; }
  .market-position > div { border-top: 1px solid #ebf0ec; border-left: 0; }
  .market-position > div:first-child { border-top: 0; }
  .market-control-actions { flex-direction: column; }
  .market-control-actions :deep(.el-input), .market-control-actions :deep(.el-select) { width: 100% !important; }
  .market-card-head { grid-template-columns: 38px minmax(0, 1fr); }
  .market-ai-score { grid-column: 2; text-align: left; }
  .market-rate-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
