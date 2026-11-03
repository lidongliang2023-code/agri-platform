<template>
  <section class="finance-page asset-detail-page">
    <header class="asset-detail-nav">
      <button type="button" @click="router.push('/fund/asset-market')">← 返回资产市场</button>
      <span>资产编号 {{ asset?.assetNo || route.params.assetId }}</span>
    </header>

    <div v-if="error" class="finance-card detail-error">
      <strong>资产加载失败</strong>
      <p>{{ error }}</p>
      <el-button class="finance-action-button" @click="load">重新加载</el-button>
    </div>
    <el-skeleton v-else-if="loading" :rows="12" animated />

    <template v-else-if="asset">
      <section class="asset-detail-hero">
        <div class="asset-detail-title">
          <div class="asset-detail-mark">{{ asset.assetType?.slice(0, 1) || '资' }}</div>
          <div>
            <span>{{ asset.assetType }} · {{ asset.financingScenario }}</span>
            <h1>{{ asset.assetName }}</h1>
            <p>{{ asset.borrowerName }} · 主体评级 {{ asset.borrowerRating }} 级 · 期限 {{ asset.term }} 个月</p>
          </div>
        </div>
        <div class="asset-detail-score">
          <span>AI 推荐分</span>
          <strong>{{ number(asset.aiRecommendationScore) }}</strong>
          <em :class="riskTone(asset.riskLevel)">{{ riskText(asset.riskLevel) }}</em>
        </div>
        <div class="asset-detail-hero-actions">
          <el-button class="asset-detail-ghost" @click="router.push('/fund/risk-center')">查看风控中台</el-button>
          <el-button class="asset-detail-primary" :disabled="Number(asset.availableAmount) <= 0" @click="investOpen = true">配置资金</el-button>
        </div>
      </section>

      <section class="asset-detail-metrics">
        <div><span>资产发行规模</span><strong>{{ compactMoney(asset.amount) }}</strong><small>剩余可投 {{ compactMoney(asset.availableAmount) }}</small></div>
        <div><span>持有期参考收益</span><strong>{{ number(asset.holdingPeriodRate) }}%</strong><small>年化参考 {{ number(asset.annualizedRate) }}%</small></div>
        <div><span>资金募集进度</span><strong>{{ number(asset.fundingProgress) }}%</strong><small>{{ asset.investorCount }} 笔资金配置</small></div>
        <div><span>我的已配置</span><strong>{{ compactMoney(asset.myInvestedAmount) }}</strong><small>可用于计算组合占比</small></div>
      </section>

      <div class="asset-detail-layout">
        <main class="asset-detail-main">
          <section class="finance-card">
            <div class="finance-card-head"><strong>资产要素</strong><span class="finance-muted">{{ asset.assetNo }}</span></div>
            <div class="asset-fact-grid">
              <div><span>融资主体</span><strong>{{ asset.borrowerName }}</strong><small>主体编号 {{ asset.borrowerId }}</small></div>
              <div><span>主体信用</span><strong>{{ asset.borrowerRating }} 级</strong><small>结合平台交易与履约数据</small></div>
              <div><span>融资期限</span><strong>{{ asset.term }} 个月</strong><small>到期后进入回款确认</small></div>
              <div><span>质押率</span><strong>{{ number(asset.pledgeRate) }}%</strong><small>{{ asset.collateralType || '信用融资' }}</small></div>
              <div><span>资产状态</span><strong>{{ asset.status }}</strong><small>剩余额度实时更新</small></div>
              <div><span>数据监控</span><strong>{{ asset.iotMonitored ? 'IoT 已接入' : '待接入' }}</strong><small>生产、仓储与物流数据</small></div>
            </div>
          </section>

          <section class="finance-card">
            <div class="finance-card-head"><strong>配置依据</strong><small>资产准入与风险核验</small></div>
            <div class="asset-evidence-list">
              <div v-for="item in asset.riskEvidence" :key="item.label">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <p>{{ item.description }}</p>
              </div>
            </div>
            <div class="asset-recommendation">
              <span>平台配置建议</span>
              <p>{{ asset.recommendationReason || '暂无配置建议' }}</p>
            </div>
          </section>

          <section class="finance-card">
            <div class="finance-card-head"><strong>资产流转进度</strong><small>资金配置与回款闭环</small></div>
            <div class="asset-process">
              <div v-for="(step, index) in asset.fundingSteps" :key="step.title" :class="{ done: step.done }">
                <span>{{ step.done ? '✓' : index + 1 }}</span>
                <div><strong>{{ step.title }}</strong><p>{{ step.description }}</p></div>
              </div>
            </div>
          </section>
        </main>

        <aside class="asset-invest-panel">
          <section class="asset-invest-card">
            <span>FUNDING SUMMARY</span>
            <h2>资金配置</h2>
            <div class="asset-progress-big">
              <div><span>募集进度</span><b>{{ number(asset.fundingProgress) }}%</b></div>
              <div class="finance-progress"><span :style="{ width: `${Math.min(100, Number(asset.fundingProgress || 0))}%` }" /></div>
            </div>
            <dl>
              <div><dt>剩余可投</dt><dd>{{ money(asset.availableAmount) }}</dd></div>
              <div><dt>资金方可配置</dt><dd>{{ money(asset.account?.availableAmount) }}</dd></div>
              <div><dt>最低起投</dt><dd>{{ money(asset.account?.minimumInvestment) }}</dd></div>
              <div><dt>质押物</dt><dd>{{ asset.collateralType || '信用融资' }}</dd></div>
            </dl>
            <el-button class="finance-action-button" :disabled="Number(asset.availableAmount) <= 0" @click="investOpen = true">
              {{ Number(asset.availableAmount) > 0 ? '配置该资产' : '资产已售罄' }}
            </el-button>
            <p>提交后将生成正式投资记录、占用机构资金额度并进入回款跟踪。</p>
          </section>

          <section class="asset-provider-card">
            <span>资产服务机构</span>
            <strong>{{ asset.provider?.institutionName || '平台合作资金机构' }}</strong>
            <p>{{ asset.provider?.reviewStatus || '已通过' }} · {{ asset.provider?.institutionType || 'BANK' }}</p>
          </section>

          <section class="asset-risk-note">
            <strong>风险提示</strong>
            <p>农业经营受气候、价格与市场周期影响。平台数据和 AI 评分仅用于辅助决策，不构成本息保障承诺。</p>
          </section>
        </aside>
      </div>
    </template>

    <FundAssetInvestDialog
      v-model="investOpen"
      :asset="asset"
      :account="asset?.account"
      @success="handleInvestmentSuccess"
    />
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import FundAssetInvestDialog from '@/components/FundAssetInvestDialog.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money } from '@/api/finance'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const asset = ref(null)
const investOpen = ref(false)

const number = (value) => Number(value || 0).toFixed(2)
const riskTone = (level) => Number(level) <= 1 ? 'low' : Number(level) === 2 ? 'medium' : 'high'
const riskText = (level) => Number(level) <= 1 ? '优先配置' : Number(level) === 2 ? '审慎配置' : '重点复核'

async function handleInvestmentSuccess() {
  await load()
  try {
    await ElMessageBox.confirm(
      '资金配置成功，已生成投资记录并更新资产额度。是否前往投资组合查看回款计划？',
      '配置完成',
      { confirmButtonText: '查看投资组合', cancelButtonText: '留在此页', type: 'success' },
    )
    router.push('/fund/my-investment')
  } catch {
    // 用户选择继续查看资产详情。
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    asset.value = await operationsApi.fundAssetDetail(route.params.assetId)
  } catch (err) {
    error.value = err.message || '资产详情加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.asset-detail-nav { display: flex; align-items: center; justify-content: space-between; }
.asset-detail-nav button { padding: 0; border: 0; background: transparent; color: #53705d; cursor: pointer; font-size: var(--fin-fs-xs); }
.asset-detail-nav span { color: #8a9a91; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.detail-error { padding: 40px; text-align: center; }
.detail-error strong { color: #3b5545; }
.detail-error p { color: #ba5b48; font-size: var(--fin-fs-xs); }
.asset-detail-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 22px; padding: 22px 24px; border-radius: 17px; background: radial-gradient(circle at 92% 5%, rgba(133, 231, 172, .18), transparent 14rem), linear-gradient(135deg, #083b26, #0f704a); color: #fff; }
.asset-detail-title { display: flex; align-items: center; gap: 13px; min-width: 0; }
.asset-detail-mark { display: grid; width: 48px; height: 48px; place-items: center; flex: 0 0 auto; border: 1px solid rgba(255, 255, 255, .18); border-radius: 13px; background: rgba(255, 255, 255, .09); color: #c3efd3; font-size: 16px; font-weight: 800; }
.asset-detail-title > div:last-child { min-width: 0; }
.asset-detail-title span { color: #a5ddb9; font-size: var(--fin-fs-xs); }
.asset-detail-title h1 { overflow: hidden; margin: 5px 0 4px; font-size: 22px; text-overflow: ellipsis; white-space: nowrap; }
.asset-detail-title p { margin: 0; color: rgba(255, 255, 255, .54); font-size: var(--fin-fs-xs); }
.asset-detail-score { min-width: 84px; text-align: center; }
.asset-detail-score span, .asset-detail-score strong, .asset-detail-score em { display: block; }
.asset-detail-score span { color: rgba(255, 255, 255, .48); font-size: var(--fin-fs-xs); }
.asset-detail-score strong { margin: 2px 0; font-family: ui-monospace, Consolas, monospace; font-size: 26px; }
.asset-detail-score em { width: fit-content; margin: auto; padding: 3px 7px; border-radius: 5px; font-size: var(--fin-fs-xs); font-style: normal; }
.asset-detail-score em.low { background: rgba(131, 229, 170, .18); color: #b8edca; }
.asset-detail-score em.medium { background: rgba(255, 189, 89, .18); color: #ffd99d; }
.asset-detail-score em.high { background: rgba(255, 120, 92, .18); color: #ffc0b3; }
.asset-detail-hero-actions { display: flex; gap: 7px; }
.asset-detail-hero-actions :deep(.el-button) { height: 33px; margin: 0; border-radius: 8px; font-size: var(--fin-fs-xs); }
.asset-detail-ghost { border-color: rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .06); color: #fff; }
.asset-detail-primary { border-color: #fff; background: #fff; color: #0d613f; font-weight: 700; }
.asset-detail-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--fin-line); border-radius: 13px; background: #e9efeb; }
.asset-detail-metrics > div { padding: 13px 15px; background: #fff; }
.asset-detail-metrics span, .asset-detail-metrics strong, .asset-detail-metrics small { display: block; }
.asset-detail-metrics span { color: #85958c; font-size: var(--fin-fs-xs); }
.asset-detail-metrics strong { margin-top: 5px; color: #2c5039; font-family: ui-monospace, Consolas, monospace; font-size: 15px; }
.asset-detail-metrics small { margin-top: 3px; color: #8b9991; font-size: var(--fin-fs-xs); }
.asset-detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; align-items: start; gap: 13px; }
.asset-detail-main { display: grid; gap: 12px; min-width: 0; }
.asset-fact-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #e9efeb; }
.asset-fact-grid > div { padding: 11px 13px; background: #fff; }
.asset-fact-grid span, .asset-fact-grid strong, .asset-fact-grid small { display: block; }
.asset-fact-grid span { color: #87978e; font-size: var(--fin-fs-xs); }
.asset-fact-grid strong { margin-top: 4px; color: #365441; font-size: var(--fin-fs-xs); }
.asset-fact-grid small { margin-top: 3px; color: #909d96; font-size: var(--fin-fs-xs); }
.asset-evidence-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #e9efeb; }
.asset-evidence-list > div { padding: 12px 14px; background: #fff; }
.asset-evidence-list span, .asset-evidence-list strong { display: block; }
.asset-evidence-list span { color: #87978e; font-size: var(--fin-fs-xs); }
.asset-evidence-list strong { margin-top: 4px; color: #2f6848; font-size: var(--fin-fs-xs); }
.asset-evidence-list p { margin: 4px 0 0; color: #7d8e83; font-size: var(--fin-fs-xs); line-height: 1.55; }
.asset-recommendation { padding: 12px 14px; background: #f4faf6; }
.asset-recommendation span { color: #597565; font-size: var(--fin-fs-xs); font-weight: 700; }
.asset-recommendation p { margin: 4px 0 0; color: #718479; font-size: var(--fin-fs-xs); line-height: 1.65; }
.asset-process { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; padding: 16px 14px 20px; }
.asset-process > div { position: relative; padding-right: 10px; }
.asset-process > div::after { content: ''; position: absolute; top: 12px; right: 0; left: 28px; height: 1px; background: #dfe9e2; }
.asset-process > div:last-child::after { display: none; }
.asset-process > div > span { display: grid; width: 24px; height: 24px; place-items: center; border: 1px solid #d8e4dc; border-radius: 50%; background: #f7faf8; color: #87978e; font-size: var(--fin-fs-xs); }
.asset-process > div.done > span { border-color: #8bc9a5; background: #e8f6ee; color: #17744a; }
.asset-process strong { display: block; margin-top: 8px; color: #405b4a; font-size: var(--fin-fs-xs); }
.asset-process p { margin: 3px 0 0; color: #89988f; font-size: var(--fin-fs-xs); line-height: 1.5; }
.asset-invest-panel { display: grid; gap: 11px; position: sticky; top: 14px; }
.asset-invest-card { padding: 17px; border-radius: 14px; background: linear-gradient(145deg, #0b4f34, #0e6746); color: #fff; }
.asset-invest-card > span { color: #9fd9b4; font-size: var(--fin-fs-xs); font-weight: 800; letter-spacing: .12em; }
.asset-invest-card h2 { margin: 6px 0 13px; font-size: 17px; }
.asset-progress-big > div:first-child { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
.asset-progress-big span { color: rgba(255, 255, 255, .5); font-size: var(--fin-fs-xs); }
.asset-progress-big b { color: #a8e2bd; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.asset-invest-card :deep(.finance-progress) { background: rgba(255, 255, 255, .12); }
.asset-invest-card :deep(.finance-progress > span) { background: #8fe2ae; }
.asset-invest-card dl { margin: 13px 0; }
.asset-invest-card dl > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-top: 1px solid rgba(255, 255, 255, .09); }
.asset-invest-card dt { color: rgba(255, 255, 255, .48); font-size: var(--fin-fs-xs); }
.asset-invest-card dd { overflow: hidden; margin: 0; color: rgba(255, 255, 255, .86); font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.asset-invest-card :deep(.el-button) { width: 100%; border-color: #fff; background: #fff; color: #0e6040; font-weight: 700; }
.asset-invest-card > p { margin: 8px 0 0; color: rgba(255, 255, 255, .42); font-size: var(--fin-fs-xs); line-height: 1.55; }
.asset-provider-card { padding: 14px; border: 1px solid var(--fin-line); border-radius: 12px; background: #fff; }
.asset-provider-card span, .asset-provider-card strong, .asset-provider-card p { display: block; }
.asset-provider-card span { color: #8a9991; font-size: var(--fin-fs-xs); }
.asset-provider-card strong { margin-top: 4px; color: #3b5545; font-size: var(--fin-fs-xs); }
.asset-provider-card p { margin: 3px 0 0; color: #8a9991; font-size: var(--fin-fs-xs); }
.asset-risk-note { padding: 13px; border: 1px solid #efe1c6; border-radius: 11px; background: #fffaf1; }
.asset-risk-note strong { color: #725b2f; font-size: var(--fin-fs-xs); }
.asset-risk-note p { margin: 4px 0 0; color: #827255; font-size: var(--fin-fs-xs); line-height: 1.6; }
@media (max-width: 980px) {
  .asset-detail-hero { grid-template-columns: minmax(0, 1fr) auto; }
  .asset-detail-hero-actions { grid-column: 1 / -1; }
  .asset-detail-layout { grid-template-columns: 1fr; }
  .asset-invest-panel { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .asset-invest-card { grid-row: span 2; }
}
@media (max-width: 680px) {
  .asset-detail-hero { grid-template-columns: 1fr; }
  .asset-detail-score { text-align: left; }
  .asset-detail-score em { margin: 0; }
  .asset-detail-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .asset-fact-grid, .asset-evidence-list { grid-template-columns: 1fr; }
  .asset-process { grid-template-columns: 1fr; gap: 12px; }
  .asset-process > div::after { top: 25px; right: auto; bottom: -13px; left: 11px; width: 1px; height: auto; }
  .asset-invest-panel { grid-template-columns: 1fr; }
  .asset-invest-card { grid-row: auto; }
}
</style>
