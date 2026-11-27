<template>
  <section class="finance-page asset-detail-page">
    <div v-if="error" class="agri-detail-page">
      <div class="finance-detail-state is-error">
        <strong>资产加载失败</strong>
        <p>{{ error }}</p>
        <div class="finance-detail-state-actions">
          <el-button @click="goBack">返回资产市场</el-button>
          <el-button type="primary" @click="load">重新加载</el-button>
        </div>
      </div>
    </div>

    <div v-else-if="loading && !asset" class="agri-detail-page">
      <div class="finance-detail-state">
        <el-skeleton :rows="10" animated />
      </div>
    </div>

    <AgriVueDetailLayout
      v-else-if="asset"
      :code="asset.assetNo || String(route.params.assetId)"
      :title="asset.assetName || '融资资产详情'"
      :status="assetStatusBadge"
      :extra-statuses="extraStatuses"
      :meta="headerMeta"
      :tabs="tabs"
      v-model:active-tab="activeTab"
      back-label="返回资产市场"
      @back="goBack"
    >
      <template #actions>
        <el-button @click="printPage">打印</el-button>
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button @click="router.push('/fund/risk-center')">风控中台</el-button>
        <el-button
          type="primary"
          :disabled="!canInvest"
          @click="investOpen = true"
        >
          {{ canInvest ? '配置资金' : '资产已售罄' }}
        </el-button>
      </template>

      <template v-if="activeTab === 'detail'">
        <AgriVueDetailSection title="收益与募集指标">
          <div class="agri-detail-kpi-strip">
            <div class="agri-detail-kpi-cell">
              <span>资产发行规模</span>
              <strong>{{ compactMoney(asset.amount) }}</strong>
              <small>剩余可投 {{ compactMoney(asset.availableAmount) }}</small>
            </div>
            <div class="agri-detail-kpi-cell">
              <span>持有期参考收益</span>
              <strong>{{ number(asset.holdingPeriodRate) }}%</strong>
              <small>年化参考 {{ number(asset.annualizedRate) }}%</small>
            </div>
            <div class="agri-detail-kpi-cell">
              <span>资金募集进度</span>
              <strong>{{ number(asset.fundingProgress) }}%</strong>
              <small>{{ asset.investorCount ?? 0 }} 笔资金配置</small>
            </div>
            <div class="agri-detail-kpi-cell">
              <span>我的已配置</span>
              <strong>{{ compactMoney(asset.myInvestedAmount) }}</strong>
              <small>AI 推荐分 {{ number(asset.aiRecommendationScore) }}</small>
            </div>
          </div>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="资产要素">
          <AgriVueDetailInfoGrid :items="factItems" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="配置依据与核验明细" :flush="true">
          <template #extra>
            <button type="button" class="agri-detail-section-link" @click="activeTab = 'evidence'">
              查看全部 {{ evidenceRows.length }} 项
            </button>
          </template>
          <el-table :data="evidenceRows" style="width: 100%">
            <el-table-column prop="label" label="核验维度" width="130" />
            <el-table-column prop="value" label="评估结果" width="150">
              <template #default="{ row }">
                <strong class="agri-detail-mono">{{ row.value || '—' }}</strong>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="核验说明" min-width="260" />
          </el-table>
          <template #footer>
            <span>AI 推荐分 <strong class="agri-detail-mono">{{ number(asset.aiRecommendationScore) }}</strong> · 风险判定 <strong>{{ riskText(asset.riskLevel) }}</strong></span>
          </template>
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'evidence'">
        <AgriVueDetailSection title="资产准入与风险核验" :flush="true">
          <el-table :data="evidenceRows" style="width: 100%">
            <el-table-column prop="label" label="核验维度" width="140" />
            <el-table-column prop="value" label="核验结论" width="160">
              <template #default="{ row }">
                <strong class="agri-detail-mono">{{ row.value || '—' }}</strong>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="详细说明" min-width="280" />
          </el-table>
        </AgriVueDetailSection>

        <AgriVueDetailSection title="平台配置建议">
          <div class="asset-advice-box">
            <p>{{ asset.recommendationReason || '暂无平台配置建议' }}</p>
          </div>
          <div class="asset-risk-banner">
            <strong>风险提示：</strong>
            农业经营受气候、价格与市场周期影响。平台数据和 AI 评分仅用于辅助决策，不构成本息保障承诺。
          </div>
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'quota'">
        <AgriVueDetailSection title="募集进度与资金额度">
          <div class="asset-progress-block">
            <div class="asset-progress-head">
              <span>当前募集进度</span>
              <strong class="agri-detail-mono">{{ number(asset.fundingProgress) }}%</strong>
            </div>
            <div class="finance-progress">
              <span :style="{ width: `${Math.min(100, Number(asset.fundingProgress || 0))}%` }" />
            </div>
          </div>
          <AgriVueDetailInfoGrid :items="quotaItems" />
        </AgriVueDetailSection>
      </template>

      <template v-else-if="activeTab === 'provider'">
        <AgriVueDetailSection title="资产服务机构与风控说明">
          <AgriVueDetailInfoGrid :items="providerItems" />
          <div class="asset-risk-banner" style="margin-top: 16px">
            <strong>配置说明：</strong>
            点击右上角「配置资金」提交后将生成正式投资记录、占用机构可用资金额度并进入贷后回款跟踪。
          </div>
        </AgriVueDetailSection>
      </template>

      <template #aside>
        <AgriVueDetailSection title="资产流转进度">
          <AgriVueDetailTimeline :items="timelineSteps" />
        </AgriVueDetailSection>

        <AgriVueDetailSection title="关联单据与入口">
          <AgriVueDetailRelated :items="relatedDocs" />
        </AgriVueDetailSection>
      </template>
    </AgriVueDetailLayout>

    <FundAssetInvestDialog
      v-model="investOpen"
      :asset="asset"
      :account="asset?.account"
      @success="handleInvestmentSuccess"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  AgriVueDetailInfoGrid,
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
} from '@agri/shared/vue/detail'
import FundAssetInvestDialog from '@/components/FundAssetInvestDialog.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money } from '@/api/finance'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const asset = ref(null)
const investOpen = ref(false)
const activeTab = ref('detail')

const ASSET_STATUS_MAP = {
  AVAILABLE: { label: '可投资', tone: 'green' },
  OPEN: { label: '可投资', tone: 'green' },
  FUNDING: { label: '募集中', tone: 'blue' },
  ACTIVE: { label: '募集中', tone: 'blue' },
  PUBLISHED: { label: '已发布', tone: 'green' },
  SOLD_OUT: { label: '已售罄', tone: 'gray' },
  FULL: { label: '已募满', tone: 'gray' },
  FUNDED: { label: '已募满', tone: 'gray' },
  COMPLETED: { label: '已结清', tone: 'gray' },
  REPAID: { label: '已回款', tone: 'green' },
  CLOSED: { label: '已下线', tone: 'gray' },
  OFFLINE: { label: '已下线', tone: 'gray' },
  PENDING: { label: '待审核', tone: 'orange' },
  REVIEWING: { label: '审核中', tone: 'orange' },
  REJECTED: { label: '已驳回', tone: 'red' },
  OVERDUE: { label: '逾期预警', tone: 'red' },
  可投资: { label: '可投资', tone: 'green' },
  募集中: { label: '募集中', tone: 'blue' },
  已售罄: { label: '已售罄', tone: 'gray' },
  已募满: { label: '已募满', tone: 'gray' },
  已下线: { label: '已下线', tone: 'gray' },
  待审核: { label: '待审核', tone: 'orange' },
  已驳回: { label: '已驳回', tone: 'red' },
}

const INSTITUTION_TYPE_MAP = {
  BANK: '商业银行',
  COMMERCIAL_BANK: '商业银行',
  RURAL_BANK: '农商银行',
  POLICY_BANK: '政策性银行',
  TRUST: '信托机构',
  FACTORING: '商业保理',
  GUARANTEE: '担保机构',
  FINANCE_COMPANY: '财务公司',
  MICRO_LOAN: '小额贷款机构',
  SUPPLY_CHAIN: '供应链金融平台',
  FUND: '产业基金',
  COOP_FUND: '合作金融组织',
}

const REVIEW_STATUS_MAP = {
  APPROVED: '已通过',
  PASSED: '已通过',
  PENDING: '待审核',
  REVIEWING: '审核中',
  REJECTED: '已拒绝',
}

const number = (value) => Number(value || 0).toFixed(2)
const riskText = (level) => Number(level) <= 1 ? '优先配置' : Number(level) === 2 ? '审慎配置' : '重点复核'
const riskBadgeTone = (level) => Number(level) <= 1 ? 'green' : Number(level) === 2 ? 'orange' : 'red'
const formatTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

const resolveAssetStatus = (raw, availableAmount) => {
  if (Number(availableAmount || 0) <= 0 && (!raw || raw === '可投资' || String(raw).toUpperCase() === 'AVAILABLE')) {
    return { label: '已售罄', tone: 'gray' }
  }
  const text = String(raw || '').trim()
  if (!text) return { label: '可投资', tone: 'green' }
  return ASSET_STATUS_MAP[text] || ASSET_STATUS_MAP[text.toUpperCase()] || { label: text, tone: 'blue' }
}

const resolveInstitutionType = (raw) => {
  const text = String(raw || '').trim()
  if (!text) return '合作金融机构'
  return INSTITUTION_TYPE_MAP[text.toUpperCase()] || text
}

const resolveReviewStatus = (raw) => {
  const text = String(raw || '').trim()
  if (!text) return '已通过'
  return REVIEW_STATUS_MAP[text.toUpperCase()] || text
}

const canInvest = computed(() => Number(asset.value?.availableAmount || 0) > 0)
const evidenceRows = computed(() => asset.value?.riskEvidence || [])

const assetStatusBadge = computed(() =>
  resolveAssetStatus(asset.value?.status, asset.value?.availableAmount),
)

const extraStatuses = computed(() => {
  const d = asset.value
  if (!d) return []
  return [
    { label: riskText(d.riskLevel), tone: riskBadgeTone(d.riskLevel) },
    { label: d.iotMonitored ? 'IoT 已接入' : 'IoT 待接入', tone: d.iotMonitored ? 'blue' : 'gray' },
  ]
})

const headerMeta = computed(() => {
  const d = asset.value
  if (!d) return []
  return [
    { label: '融资主体', value: d.borrowerName || '—' },
    { label: '主体评级', value: d.borrowerRating ? `${d.borrowerRating} 级` : '待评' },
    { label: '融资期限', value: d.term ? `${d.term} 个月` : '—' },
    { label: 'AI 推荐分', value: `${number(d.aiRecommendationScore)} 分` },
  ]
})

const tabs = computed(() => [
  { key: 'detail', label: '资产详情' },
  { key: 'evidence', label: '配置依据', count: evidenceRows.value.length },
  { key: 'quota', label: '额度与账户' },
  { key: 'provider', label: '服务机构与风控' },
])

const factItems = computed(() => {
  const d = asset.value
  if (!d) return []
  return [
    { key: 'assetNo', label: '资产编号', value: d.assetNo, mono: true },
    { key: 'assetType', label: '资产类型', value: d.assetType || '—' },
    { key: 'scenario', label: '融资场景', value: d.financingScenario || '—' },
    { key: 'status', label: '资产状态', value: assetStatusBadge.value.label },
    { key: 'borrowerName', label: '融资主体', value: d.borrowerName || '—' },
    { key: 'borrowerId', label: '主体编号', value: d.borrowerId || '—', mono: Boolean(d.borrowerId) },
    { key: 'rating', label: '主体信用', value: d.borrowerRating ? `${d.borrowerRating} 级` : '待补充' },
    { key: 'term', label: '融资期限', value: d.term ? `${d.term} 个月` : '—', mono: true },
    { key: 'pledgeRate', label: '质押率', value: `${number(d.pledgeRate)}%`, mono: true },
    { key: 'collateral', label: '风险缓释', value: d.collateralType || '信用融资' },
    { key: 'iot', label: '贷后监控', value: d.iotMonitored ? 'IoT 已接入（生产/仓储监测）' : '待接入' },
    { key: 'publishTime', label: '发布时间', value: formatTime(d.publishTime), mono: true },
  ]
})

const quotaItems = computed(() => {
  const d = asset.value
  if (!d) return []
  return [
    { key: 'amount', label: '发行总额', value: money(d.amount), mono: true },
    { key: 'invested', label: '已募集金额', value: money(d.investedAmount), mono: true },
    { key: 'available', label: '剩余可投', value: money(d.availableAmount), mono: true },
    { key: 'myInvested', label: '我的已配置', value: money(d.myInvestedAmount), mono: true },
    { key: 'accountAvail', label: '资金方可配置', value: money(d.account?.availableAmount), mono: true },
    { key: 'minInvest', label: '最低起投', value: money(d.account?.minimumInvestment), mono: true },
    { key: 'annualized', label: '年化参考率', value: `${number(d.annualizedRate)}%`, mono: true },
    { key: 'holdingRate', label: '持有期参考率', value: `${number(d.holdingPeriodRate)}%`, mono: true },
    { key: 'expectedReturn', label: '参考收益总额', value: money(d.expectedReturn), mono: true },
    { key: 'investorCount', label: '已配置笔数', value: `${d.investorCount ?? 0} 笔`, mono: true },
  ]
})

const providerItems = computed(() => {
  const d = asset.value
  if (!d) return []
  const provider = d.provider || {}
  return [
    { key: 'name', label: '服务机构', value: provider.institutionName || '平台合作资金机构' },
    { key: 'type', label: '机构类型', value: resolveInstitutionType(provider.institutionType) },
    { key: 'review', label: '准入状态', value: resolveReviewStatus(provider.reviewStatus) },
    { key: 'riskLevel', label: '资产判定', value: riskText(d.riskLevel) },
    { key: 'collateral', label: '质押物类型', value: d.collateralType || '信用融资' },
    { key: 'updatedAt', label: '最近更新', value: formatTime(d.updatedAt), mono: true },
    { key: 'advice', label: '平台配置建议', value: d.recommendationReason || '暂无配置建议', fullWidth: true },
  ]
})

const timelineSteps = computed(() => {
  const steps = asset.value?.fundingSteps || []
  let foundCurrent = false
  return steps.map((step, index) => {
    let state = 'pending'
    if (step.done) {
      state = 'done'
    } else if (!foundCurrent) {
      state = 'current'
      foundCurrent = true
    }
    return {
      key: `${step.title}-${index}`,
      title: step.title,
      description: step.description,
      state,
    }
  })
})

const relatedDocs = computed(() => {
  const d = asset.value
  if (!d) return []
  return [
    {
      key: 'provider',
      label: '资产服务机构',
      text: d.provider?.institutionName || '平台合作资金机构',
      mono: false,
      badge: resolveInstitutionType(d.provider?.institutionType),
      badgeTone: 'blue',
      clickable: true,
      onClick: () => { activeTab.value = 'provider' },
    },
    {
      key: 'risk',
      label: '三角链风控中台',
      text: '核验主体风控画像',
      mono: false,
      badge: riskText(d.riskLevel),
      badgeTone: riskBadgeTone(d.riskLevel),
      clickable: true,
      onClick: () => router.push('/fund/risk-center'),
    },
    {
      key: 'investment',
      label: '我的投资组合',
      text: Number(d.myInvestedAmount || 0) > 0 ? `已配 ${compactMoney(d.myInvestedAmount)}` : '查看已投资产',
      mono: false,
      clickable: true,
      onClick: () => router.push('/fund/my-investment'),
    },
    {
      key: 'market',
      label: '资产市场大厅',
      text: '浏览更多可投项目',
      mono: false,
      clickable: true,
      onClick: goBack,
    },
  ]
})

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
    // 用户选择留在此页继续查看。
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

const goBack = () => router.push('/fund/asset-market')
const printPage = () => window.print()

watch(() => route.params.assetId, () => {
  activeTab.value = 'detail'
  load()
})

onMounted(load)
</script>

<style scoped>
.finance-detail-state {
  padding: 36px 24px;
  border: 1px solid #e8ecea;
  border-radius: 10px;
  background: #fff;
  text-align: center;
}

.finance-detail-state.is-error strong {
  color: #cf1322;
}

.finance-detail-state.is-error p {
  margin: 8px 0 0;
  color: #68776e;
  font-size: 13px;
}

.finance-detail-state-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
}

.asset-progress-block {
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid #e6eee9;
  border-radius: 8px;
  background: #f7fbf8;
}

.asset-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: #5b6a61;
}

.asset-progress-head strong {
  color: #2d8f4e;
  font-size: 15px;
}

.asset-advice-box {
  padding: 12px 14px;
  border-radius: 8px;
  background: #f4faf6;
  border: 1px solid #dfeee4;
}

.asset-advice-box p {
  margin: 0;
  color: #36453d;
  font-size: 13px;
  line-height: 1.7;
}

.asset-risk-banner {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid #efe1c6;
  border-radius: 8px;
  background: #fffaf1;
  color: #7c6233;
  font-size: 13px;
  line-height: 1.65;
}
</style>
