<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>ASSET MARKET</small><h1>资产市场</h1><p>筛选平台优质融资资产，结合 AI 推荐、信用评级和质押保障完成资金配置。</p></div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新资产</el-button>
      </div>
    </header>

    <section class="market-overview">
      <div><span>可配置资产</span><strong>{{ assets.length }}<em> 个</em></strong></div>
      <div><span>可投余额</span><strong>{{ money(totalAvailable) }}</strong></div>
      <div><span>平均 AI 推荐分</span><strong>{{ averageScore }}<em> 分</em></strong></div>
      <div><span>IoT 监控资产</span><strong>{{ iotCount }}<em> 个</em></strong></div>
    </section>

    <div class="market-toolbar">
      <div class="finance-tabs">
        <button v-for="item in filters" :key="item.key" type="button" :class="{ on: activeFilter === item.key }" @click="activeFilter = item.key">
          {{ item.label }}
        </button>
      </div>
      <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="搜索资产、借款主体或场景" class="market-search" />
    </div>

    <div v-if="filteredAssets.length" class="market-asset-grid">
      <article v-for="asset in filteredAssets" :key="asset.id">
        <div class="market-card-head">
          <span><Tickets /></span>
          <div><small>{{ asset.assetNo }} · {{ asset.assetType }}</small><strong>{{ asset.assetName }}</strong></div>
          <div class="market-score"><b>{{ Number(asset.aiRecommendationScore || 0).toFixed(0) }}</b><small>AI推荐</small></div>
        </div>
        <div class="market-borrower">
          <span>{{ asset.borrowerName?.slice(0, 1) || '农' }}</span>
          <div><strong>{{ asset.borrowerName }}</strong><small>{{ asset.borrowerRating }} 级 · {{ asset.financingScenario }}</small></div>
          <FinanceStatus value="正常" />
        </div>
        <div class="market-values">
          <div><span>可投金额</span><strong>{{ money(asset.availableAmount) }}</strong></div>
          <div><span>期限</span><strong>{{ asset.term }} 个月</strong></div>
          <div><span>参考年化</span><strong class="green">{{ assetRate(asset) }}%</strong></div>
        </div>
        <div class="market-security">
          <span><Lock /> {{ asset.collateralType || '信用融资' }}</span>
          <span>质押率 {{ asset.pledgeRate || 0 }}%</span>
          <span v-if="asset.iotMonitored">IoT 实时监控</span>
        </div>
        <p>{{ asset.recommendationReason }}</p>
        <div class="market-card-foot">
          <span>已投 {{ money(asset.investedAmount) }}</span>
          <el-button class="finance-action-button" @click="openInvest(asset)">配置资金</el-button>
        </div>
      </article>
    </div>
    <div v-else class="finance-card finance-empty"><strong>暂无可配置资产</strong><p>平台发布新的优质融资资产后会展示在这里。</p></div>

    <el-dialog v-model="investOpen" title="配置资产资金" width="min(580px, 92vw)">
      <div v-if="selectedAsset" class="invest-dialog">
        <div class="invest-asset">
          <span><Tickets /></span>
          <div><strong>{{ selectedAsset.assetName }}</strong><p>{{ selectedAsset.borrowerName }} · {{ selectedAsset.borrowerRating }} 级 · {{ selectedAsset.term }} 个月</p></div>
          <b>{{ assetRate(selectedAsset) }}%</b>
        </div>
        <div class="invest-facts">
          <div><span>可投金额</span><strong>{{ money(selectedAsset.availableAmount) }}</strong></div>
          <div><span>质押物</span><strong>{{ selectedAsset.collateralType || '信用融资' }}</strong></div>
          <div><span>AI 推荐分</span><strong>{{ selectedAsset.aiRecommendationScore }} 分</strong></div>
        </div>
        <el-form label-position="top">
          <el-form-item label="投资金额（元）">
            <el-input v-model="investAmount" inputmode="decimal" placeholder="请输入投资金额">
              <template #prefix>¥</template>
            </el-input>
          </el-form-item>
          <div class="invest-quick">
            <button v-for="ratio in [0.1, 0.25, 0.5, 1]" :key="ratio" type="button" @click="investAmount = String(Math.round(Number(selectedAsset.availableAmount) * ratio))">
              {{ ratio === 1 ? '全部' : `${ratio * 100}%` }}
            </button>
          </div>
        </el-form>
        <div class="invest-estimate">
          <span>预计到期收益</span><strong>{{ money(expectedGain) }}</strong>
          <small>预计回款 {{ money(Number(investAmount || 0) + expectedGain) }}</small>
        </div>
      </div>
      <template #footer>
        <el-button class="finance-ghost-button" @click="investOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="investing" @click="submitInvestment">确认配置</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lock, Search, Tickets } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { money } from '@/api/finance'

const route = useRoute()
const loading = ref(true)
const investing = ref(false)
const assets = ref([])
const activeFilter = ref('all')
const keyword = ref('')
const investOpen = ref(false)
const selectedAsset = ref(null)
const investAmount = ref('')
const filters = [
  { key: 'all', label: '全部资产' },
  { key: 'recommend', label: 'AI 优选' },
  { key: 'iot', label: 'IoT 监控' },
  { key: 'collateral', label: '有质押物' },
]

const totalAvailable = computed(() => assets.value.reduce((total, item) => total + Number(item.availableAmount || 0), 0))
const averageScore = computed(() => assets.value.length
  ? (assets.value.reduce((total, item) => total + Number(item.aiRecommendationScore || 0), 0) / assets.value.length).toFixed(1)
  : '0.0')
const iotCount = computed(() => assets.value.filter((item) => item.iotMonitored).length)
const filteredAssets = computed(() => {
  let rows = assets.value
  if (activeFilter.value === 'recommend') rows = rows.filter((item) => Number(item.aiRecommendationScore) >= 90)
  if (activeFilter.value === 'iot') rows = rows.filter((item) => item.iotMonitored)
  if (activeFilter.value === 'collateral') rows = rows.filter((item) => item.collateralType)
  const value = keyword.value.trim().toLowerCase()
  return value ? rows.filter((item) => `${item.assetName}${item.borrowerName}${item.financingScenario}${item.assetNo}`.toLowerCase().includes(value)) : rows
})
const expectedGain = computed(() => {
  if (!selectedAsset.value) return 0
  const ratio = Number(selectedAsset.value.expectedReturn || 0) / Number(selectedAsset.value.amount || 1)
  return Number(investAmount.value || 0) * ratio
})

function assetRate(asset) {
  return Number(asset.amount) > 0 ? ((Number(asset.expectedReturn) / Number(asset.amount)) * 100).toFixed(2) : '0.00'
}

function openInvest(asset) {
  selectedAsset.value = asset
  investAmount.value = String(Math.min(Number(asset.availableAmount), 50000))
  investOpen.value = true
}

async function submitInvestment() {
  const amount = Number(investAmount.value)
  if (!selectedAsset.value || !amount || amount <= 0 || amount > Number(selectedAsset.value.availableAmount)) {
    ElMessage.warning('请输入不超过可投余额的投资金额')
    return
  }
  await ElMessageBox.confirm(
    `确认向「${selectedAsset.value.assetName}」配置 ${money(amount)}？`,
    '确认资产投资',
    { confirmButtonText: '确认投资', cancelButtonText: '取消', type: 'info' },
  )
  investing.value = true
  try {
    await operationsApi.subscribe(selectedAsset.value.id, amount)
    ElMessage.success('资产投资成功，已计入投资组合')
    investOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '资产投资失败')
  } finally {
    investing.value = false
  }
}

async function load() {
  loading.value = true
  try {
    assets.value = (await operationsApi.availableAssets()) || []
    const targetId = String(route.query.assetId || '')
    const target = assets.value.find((item) => item.id === targetId)
    if (target) openInvest(target)
  } catch (err) {
    ElMessage.error(err.message || '资产市场加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.market-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--fin-line);
  border-radius: 14px;
  background: #fff;
}
.market-overview > div { padding: 14px 16px; border-left: 1px solid #edf2ee; }
.market-overview > div:first-child { border-left: 0; }
.market-overview span, .market-overview strong { display: block; }
.market-overview span { color: #84958c; font-size: 8px; }
.market-overview strong { margin-top: 4px; color: #234e36; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.market-overview em { color: #6d8174; font-size: 9px; font-style: normal; }
.market-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.market-search { width: 260px; }
.market-asset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.market-asset-grid article { padding: 16px; border: 1px solid var(--fin-line); border-radius: 15px; background: #fff; box-shadow: 0 5px 18px rgba(19, 67, 41, .03); }
.market-card-head { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.market-card-head > span { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 11px; background: #e8f5ee; color: var(--fin-green-700); }
.market-card-head > span svg { width: 18px; }
.market-card-head > div:nth-child(2) { min-width: 0; }
.market-card-head small, .market-card-head strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.market-card-head > div:nth-child(2) small { color: #8d9c93; font-family: ui-monospace, Consolas, monospace; font-size: 7px; }
.market-card-head > div:nth-child(2) strong { margin-top: 2px; color: #2f4b3a; font-size: 11px; }
.market-score { display: flex; width: 47px; height: 47px; align-items: center; justify-content: center; flex-direction: column; border-radius: 50%; background: #eef9f3; }
.market-score b { color: var(--fin-green-700); font-family: ui-monospace, Consolas, monospace; font-size: 14px; }
.market-score small { color: #74877b; font-size: 6.5px; }
.market-borrower { display: flex; align-items: center; gap: 8px; margin: 12px 0; padding: 9px; border-radius: 9px; background: #f7faf8; }
.market-borrower > span:first-child { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 8px; background: #e4f2ea; color: #356a4d; font-size: 9px; font-weight: 700; }
.market-borrower > div { min-width: 0; flex: 1; }
.market-borrower strong, .market-borrower small { display: block; }
.market-borrower strong { color: #3f5848; font-size: 9.5px; }
.market-borrower small { color: #89988f; font-size: 7.5px; }
.market-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #edf2ee; }
.market-values > div { padding: 9px 10px; background: #fbfcfb; }
.market-values span, .market-values strong { display: block; }
.market-values span { color: #89988f; font-size: 7.5px; }
.market-values strong { margin-top: 3px; color: #3b5645; font-family: ui-monospace, Consolas, monospace; font-size: 9px; }
.market-values strong.green { color: #15784c; }
.market-security { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
.market-security span { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 6px; background: #f2f7f4; color: #60786a; font-size: 7.5px; }
.market-security svg { width: 11px; }
.market-asset-grid article > p { min-height: 34px; margin: 0; color: #7d8e83; font-size: 8px; line-height: 1.55; }
.market-card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 11px; padding-top: 10px; border-top: 1px solid #edf2ee; }
.market-card-foot > span { color: #8a9991; font-size: 8px; }
.invest-dialog { display: grid; gap: 13px; }
.invest-asset { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 11px; background: #f5faf7; }
.invest-asset > span { display: grid; width: 39px; height: 39px; place-items: center; border-radius: 10px; background: #e2f2e9; color: var(--fin-green-700); }
.invest-asset > span svg { width: 17px; }
.invest-asset > div { min-width: 0; flex: 1; }
.invest-asset strong { display: block; color: #344f3f; font-size: 10px; }
.invest-asset p { margin: 3px 0 0; color: #89988f; font-size: 8px; }
.invest-asset > b { color: #17774d; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
.invest-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #edf2ee; }
.invest-facts > div { padding: 9px 10px; background: #fbfcfb; }
.invest-facts span, .invest-facts strong { display: block; }
.invest-facts span { color: #8a9991; font-size: 7.5px; }
.invest-facts strong { margin-top: 3px; color: #3c5746; font-size: 9px; }
.invest-quick { display: flex; gap: 7px; margin-top: -7px; }
.invest-quick button { padding: 5px 9px; border: 1px solid #d8e5dd; border-radius: 99px; background: #f8fbf9; color: #5f7768; cursor: pointer; font-size: 8px; }
.invest-quick button:hover { border-color: #9dcdb1; color: var(--fin-green-800); }
.invest-estimate { padding: 12px; border-radius: 9px; background: #f0f9f4; }
.invest-estimate span, .invest-estimate strong, .invest-estimate small { display: block; }
.invest-estimate span { color: #72867a; font-size: 8px; }
.invest-estimate strong { margin-top: 3px; color: #d0523f; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.invest-estimate small { color: #8a9991; font-size: 7.5px; }
@media (max-width: 900px) { .market-asset-grid { grid-template-columns: 1fr; } }
@media (max-width: 680px) { .market-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); } .market-overview > div:nth-child(3) { border-top: 1px solid #edf2ee; border-left: 0; } .market-overview > div:nth-child(4) { border-top: 1px solid #edf2ee; } .market-toolbar { align-items: stretch; flex-direction: column; } .market-search { width: 100%; } }
</style>
