<template>
  <section class="finance-page fund-workbench">
    <header class="finance-page-heading">
      <div>
        <small>FUND OPERATIONS DESK</small>
        <h1>资金方工作台</h1>
        <p>统一查看资金头寸、资产机会、审批任务和回款风险，完成从资产配置到本息回收的业务闭环。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新数据</el-button>
        <el-button class="finance-action-button" @click="router.push('/fund/asset-market')">
          进入资产市场
        </el-button>
      </div>
    </header>

    <div v-if="error" class="workbench-error">
      <span>{{ error }}</span>
      <el-button link @click="load">重新加载</el-button>
    </div>

    <el-skeleton v-if="loading && !data" :rows="10" animated />

    <template v-if="data">
      <section class="fund-command">
        <div class="fund-command-copy">
          <span>CAPITAL COMMAND CENTER</span>
          <div class="fund-command-title">
            <h1>{{ provider.institutionName || '合作资金机构' }}</h1>
            <FinanceStatus :value="provider.reviewStatus || '待审核'" />
            <i>{{ statusText(provider.status) }}</i>
          </div>
          <p>机构额度、在投本金与待办事项已实时汇总；资金配置成功后会自动占用额度并形成投资记录。</p>
          <div class="fund-command-actions">
            <el-button class="hero-primary" @click="router.push('/fund/asset-market')">发现可投资产</el-button>
            <el-button class="hero-ghost" @click="router.push('/fund/my-investment')">管理投资组合</el-button>
          </div>
        </div>
        <div class="fund-command-position">
          <div class="position-ring" :style="{ '--usage': `${Math.min(100, Number(account.utilizationRate || 0))}%` }">
            <div>
              <small>可用资金</small>
              <strong>{{ compactMoney(account.availableAmount) }}</strong>
              <span>额度使用 {{ number(account.utilizationRate) }}%</span>
            </div>
          </div>
          <div class="position-foot">
            <span>机构总额度 <b>{{ compactMoney(account.totalLimit) }}</b></span>
            <span>已占用 <b>{{ compactMoney(account.committedAmount) }}</b></span>
          </div>
        </div>
      </section>

      <section class="workbench-kpis">
        <article>
          <div><span>在投本金</span><b>01</b></div>
          <strong>{{ compactMoney(portfolio.activeAmount) }}</strong>
          <small>{{ portfolio.activeCount }} 笔资产正在履约</small>
        </article>
        <article>
          <div><span>在投预期收益</span><b>02</b></div>
          <strong>{{ compactMoney(portfolio.expectedReturn) }}</strong>
          <small>按当前配置与资产收益测算</small>
        </article>
        <article>
          <div><span>累计回收本息</span><b>03</b></div>
          <strong>{{ compactMoney(portfolio.returnedAmount) }}</strong>
          <small>已实现收益 {{ compactMoney(portfolio.realizedIncome) }}</small>
        </article>
        <article>
          <div><span>待办事项</span><b>04</b></div>
          <strong>{{ totalTasks }}<em> 项</em></strong>
          <small>{{ tasks.pendingApprovals }} 笔审批 · {{ tasks.dueSoonCount }} 笔近期回款</small>
        </article>
      </section>

      <div class="workbench-core">
        <section class="workbench-main">
          <div class="ops-section-head">
            <div><strong>今日资金运营</strong><span>待决策事项、资金占用与近期回款集中处理</span></div>
          </div>
          <div class="workbench-task-grid">
            <button type="button" class="task-card" @click="router.push('/fund/approval')">
              <span class="task-icon amber"><Checked /></span>
              <div><small>融资审批</small><strong>{{ tasks.pendingApprovals }} 笔待处理</strong><p>{{ compactMoney(tasks.pendingApprovalAmount) }} 申请待决策</p></div>
              <b>→</b>
            </button>
            <button type="button" class="task-card" @click="router.push('/fund/my-investment')">
              <span class="task-icon green"><Money /></span>
              <div><small>近期回款</small><strong>{{ tasks.dueSoonCount }} 笔将到期</strong><p>{{ tasks.nextDueTime ? `${shortDate(tasks.nextDueTime)} 最近到期` : '暂无 30 天内到期资产' }}</p></div>
              <b>→</b>
            </button>
            <button type="button" class="task-card" @click="router.push('/fund/risk-center')">
              <span class="task-icon blue"><DataAnalysis /></span>
              <div><small>风控监测</small><strong>{{ tasks.enabledRules }} 条规则生效</strong><p>{{ tasks.overdueCount }} 笔存量逾期待跟进</p></div>
              <b>→</b>
            </button>
          </div>

          <div class="ops-section-head asset-section-head">
            <div><strong>优选资产机会</strong><span>按 AI 推荐分、主体信用与数据监控质量排序</span></div>
            <el-button link class="finance-link-button" @click="router.push('/fund/asset-market')">查看全部 →</el-button>
          </div>
          <div class="workbench-asset-grid">
            <article
              v-for="asset in recommendedAssets"
              :key="asset.id"
              @click="openAsset(asset)"
            >
              <div class="asset-card-top">
                <span>{{ asset.assetType }}</span>
                <b>{{ number(asset.aiRecommendationScore) }}<small> AI</small></b>
              </div>
              <h3>{{ asset.assetName }}</h3>
              <p>{{ asset.borrowerName }} · {{ asset.borrowerRating }} 级 · {{ asset.financingScenario }}</p>
              <div class="asset-funding">
                <div><span>募集进度 {{ number(asset.fundingProgress) }}%</span><b>{{ money(asset.availableAmount) }} 可投</b></div>
                <div class="finance-progress"><span :style="{ width: `${asset.fundingProgress}%` }" /></div>
              </div>
              <div class="asset-card-values">
                <div><span>持有期收益</span><strong>{{ number(asset.holdingPeriodRate) }}%</strong></div>
                <div><span>期限</span><strong>{{ asset.term }} 月</strong></div>
                <div><span>质押率</span><strong>{{ number(asset.pledgeRate) }}%</strong></div>
              </div>
              <div class="asset-card-tags">
                <span v-if="asset.iotMonitored">IoT 监控</span>
                <span>{{ asset.collateralType || '信用融资' }}</span>
              </div>
            </article>
            <div v-if="!recommendedAssets.length" class="finance-empty asset-empty">
              <strong>暂无可投资产</strong>
              <p>平台发布新资产后会在这里推荐。</p>
            </div>
          </div>

          <section class="finance-card workbench-investments">
            <div class="finance-card-head">
              <strong>最近投资</strong>
              <el-button link class="finance-link-button" @click="router.push('/fund/my-investment')">全部投资 →</el-button>
            </div>
            <el-table v-if="investments.length" :data="investments" style="width: 100%">
              <el-table-column label="资产" min-width="210">
                <template #default="{ row }">
                  <div class="investment-asset-cell">
                    <span>资</span>
                    <div><strong>{{ row.assetName }}</strong><small>{{ row.investmentNo }}</small></div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="配置金额" min-width="115" align="right">
                <template #default="{ row }">{{ money(row.investmentAmount) }}</template>
              </el-table-column>
              <el-table-column label="预期收益" min-width="105" align="right">
                <template #default="{ row }">{{ money(row.expectedReturn) }}</template>
              </el-table-column>
              <el-table-column label="到期日" min-width="110">
                <template #default="{ row }">{{ dateOnly(row.expectedReturnTime) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }"><FinanceStatus :value="row.status" /></template>
              </el-table-column>
            </el-table>
            <div v-else class="finance-empty">
              <strong>尚未配置资产</strong>
              <p>从资产市场完成首笔资金配置后，这里会显示投资和回款进度。</p>
            </div>
          </section>
        </section>

        <aside class="workbench-aside">
          <section class="finance-card">
            <div class="finance-card-head">
              <strong>回款日历</strong>
              <span class="finance-muted">未来 30 天</span>
            </div>
            <div class="return-list">
              <div v-for="item in upcomingReturns" :key="item.id">
                <time>{{ dateDay(item.expectedReturnTime) }}</time>
                <div><strong>{{ item.assetName }}</strong><small>{{ dateOnly(item.expectedReturnTime) }} 到期</small></div>
                <b>{{ compactMoney(Number(item.investmentAmount) + Number(item.expectedReturn)) }}</b>
              </div>
              <div v-if="!upcomingReturns.length" class="aside-empty">
                <strong>暂无近期回款</strong>
                <span>30 天内没有到期投资</span>
              </div>
            </div>
          </section>

          <section class="finance-card">
            <div class="finance-card-head">
              <strong>风险提示</strong>
              <span class="risk-count">{{ risks.length }} 项</span>
            </div>
            <div class="risk-brief-list">
              <div v-for="item in risks" :key="item.title" :class="riskTone(item.level)">
                <span>{{ riskSymbol(item.level) }}</span>
                <div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p></div>
              </div>
            </div>
          </section>

          <section class="workbench-market-note">
            <span>市场概览</span>
            <strong>{{ market.assetCount }} 个资产正在募集</strong>
            <p>可投余额 {{ compactMoney(market.availableAmount) }}，平均 AI 推荐分 {{ number(market.averageScore) }}，{{ market.iotAssetCount }} 个资产接入 IoT 监控。</p>
            <el-button class="finance-ghost-button" @click="router.push('/fund/asset-market')">查看市场</el-button>
          </section>
        </aside>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Checked, DataAnalysis, Money } from '@element-plus/icons-vue'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money, shortDate } from '@/api/finance'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const data = ref(null)

const provider = computed(() => data.value?.provider || {})
const account = computed(() => data.value?.account || {})
const tasks = computed(() => data.value?.tasks || {})
const portfolio = computed(() => data.value?.portfolio || {})
const market = computed(() => data.value?.market || {})
const risks = computed(() => data.value?.risks || [])
const recommendedAssets = computed(() => data.value?.recommendedAssets || [])
const investments = computed(() => data.value?.investments || [])
const upcomingReturns = computed(() => data.value?.upcomingReturns || [])
const totalTasks = computed(() => Number(tasks.value.pendingApprovals || 0)
  + Number(tasks.value.dueSoonCount || 0)
  + Number(tasks.value.overdueCount || 0)
  + Number(tasks.value.unreadMessages || 0))

const number = (value) => Number(value || 0).toFixed(2)
const dateOnly = (value) => value ? String(value).replace('T', ' ').slice(0, 10) : '—'
const dateDay = (value) => value ? String(value).replace('T', ' ').slice(5, 10) : '--'
const statusText = (value) => ({ 正常: '经营正常', ACTIVE: '经营正常', 禁用: '已停用' }[value] || value || '状态待确认')
const riskTone = (level) => ({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }[level] || 'low')
const riskSymbol = (level) => level === 'HIGH' ? '!' : level === 'MEDIUM' ? '▲' : '✓'

function openAsset(asset) {
  router.push(`/fund/asset-market/${encodeURIComponent(asset.id)}`)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await operationsApi.workbench()
  } catch (err) {
    error.value = err.message || '资金工作台加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.fund-workbench { --workbench-ink: #203f2d; }
.workbench-error { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border: 1px solid #f0d5cf; border-radius: 10px; background: #fff8f6; color: #a44d3c; font-size: var(--fin-fs-xs); }
.fund-command { display: grid; grid-template-columns: minmax(0, 1fr) 310px; align-items: stretch; overflow: hidden; border-radius: 18px; background: radial-gradient(circle at 85% 5%, rgba(144, 232, 178, .22), transparent 15rem), linear-gradient(132deg, #073923, #0d6b47 68%, #12945a); color: #fff; }
.fund-command-copy { padding: 25px 28px; }
.fund-command-copy > span { color: #a8dfbd; font-size: var(--fin-fs-xs); font-weight: 800; letter-spacing: .13em; }
.fund-command-title { display: flex; align-items: center; gap: 9px; margin-top: 9px; }
.fund-command-title h1 { margin: 0; font-size: 25px; }
.fund-command-title i { padding: 3px 7px; border: 1px solid rgba(255, 255, 255, .18); border-radius: 6px; color: rgba(255, 255, 255, .64); font-size: var(--fin-fs-xs); font-style: normal; }
.fund-command-copy > p { max-width: 660px; margin: 9px 0 0; color: rgba(255, 255, 255, .58); font-size: var(--fin-fs-xs); line-height: 1.7; }
.fund-command-actions { display: flex; gap: 8px; margin-top: 18px; }
.fund-command-actions :deep(.el-button) { height: 34px; border-radius: 8px; font-size: var(--fin-fs-xs); }
.fund-command-actions :deep(.hero-primary) { border-color: #fff; background: #fff; color: #0d5d3d; font-weight: 700; }
.fund-command-actions :deep(.hero-ghost) { border-color: rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .07); color: #fff; }
.fund-command-position { display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 18px; border-left: 1px solid rgba(255, 255, 255, .1); background: rgba(255, 255, 255, .035); }
.position-ring { position: relative; display: grid; width: 164px; height: 164px; place-items: center; border-radius: 50%; background: conic-gradient(#8be5ad var(--usage), rgba(255, 255, 255, .1) 0); }
.position-ring::before { content: ''; position: absolute; width: 138px; height: 138px; border-radius: 50%; background: #0b563a; }
.position-ring > div { position: relative; z-index: 1; text-align: center; }
.position-ring small, .position-ring strong, .position-ring span { display: block; }
.position-ring small { color: rgba(255, 255, 255, .5); font-size: var(--fin-fs-xs); }
.position-ring strong { margin: 4px 0 2px; font-family: ui-monospace, Consolas, monospace; font-size: 20px; }
.position-ring span { color: #a8dfbd; font-size: var(--fin-fs-xs); }
.position-foot { display: flex; width: 100%; justify-content: space-between; margin-top: 12px; color: rgba(255, 255, 255, .48); font-size: var(--fin-fs-xs); }
.position-foot b { color: rgba(255, 255, 255, .78); font-family: ui-monospace, Consolas, monospace; }
.workbench-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.workbench-kpis article { padding: 14px 16px; border: 1px solid var(--fin-line); border-radius: 12px; background: #fff; }
.workbench-kpis article > div { display: flex; align-items: center; justify-content: space-between; }
.workbench-kpis span { color: #7f9186; font-size: var(--fin-fs-xs); }
.workbench-kpis article > div b { color: #dbe7df; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.workbench-kpis strong { display: block; margin-top: 8px; color: var(--workbench-ink); font-family: ui-monospace, Consolas, monospace; font-size: 19px; }
.workbench-kpis strong em { color: #71877a; font-size: var(--fin-fs-xs); font-style: normal; }
.workbench-kpis small { display: block; margin-top: 4px; color: #8b9a92; font-size: var(--fin-fs-xs); }
.workbench-core { display: grid; grid-template-columns: minmax(0, 1fr) 292px; align-items: start; gap: 14px; }
.workbench-main { display: grid; gap: 13px; min-width: 0; }
.ops-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.ops-section-head > div { display: flex; flex-direction: column; gap: 2px; }
.ops-section-head strong { color: #284a37; font-size: 14px; }
.ops-section-head span { color: #87978e; font-size: var(--fin-fs-xs); }
.workbench-task-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.task-card { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-width: 0; padding: 12px; border: 1px solid var(--fin-line); border-radius: 12px; background: #fff; color: inherit; text-align: left; cursor: pointer; transition: border-color .16s ease, transform .16s ease; }
.task-card:hover { border-color: #a8cfb9; transform: translateY(-1px); }
.task-icon { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 9px; }
.task-icon svg { width: 16px; }
.task-icon.amber { background: #fff5e6; color: #af7722; }
.task-icon.green { background: #e8f6ee; color: #19764b; }
.task-icon.blue { background: #eaf3f8; color: #33718f; }
.task-card > div { min-width: 0; }
.task-card small, .task-card strong, .task-card p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-card small { color: #8a9991; font-size: var(--fin-fs-xs); }
.task-card strong { margin-top: 2px; color: #3b5545; font-size: var(--fin-fs-xs); }
.task-card p { margin: 3px 0 0; color: #8d9a93; font-size: var(--fin-fs-xs); }
.task-card > b { color: #9aa69e; font-size: var(--fin-fs-xs); }
.asset-section-head { margin-top: 5px; }
.workbench-asset-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.workbench-asset-grid article { min-width: 0; padding: 13px; border: 1px solid var(--fin-line); border-radius: 13px; background: #fff; cursor: pointer; transition: border-color .16s ease, box-shadow .16s ease; }
.workbench-asset-grid article:hover { border-color: #9fceb2; box-shadow: 0 10px 24px rgba(21, 67, 43, .06); }
.asset-card-top { display: flex; align-items: center; justify-content: space-between; }
.asset-card-top > span { padding: 3px 6px; border-radius: 5px; background: #eef7f2; color: #337052; font-size: var(--fin-fs-xs); }
.asset-card-top > b { color: #16764a; font-family: ui-monospace, Consolas, monospace; font-size: 14px; }
.asset-card-top > b small { color: #85958c; font-size: var(--fin-fs-xs); }
.workbench-asset-grid h3 { overflow: hidden; margin: 10px 0 3px; color: #2d4b39; font-size: var(--fin-fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.workbench-asset-grid article > p { overflow: hidden; margin: 0 0 10px; color: #87968e; font-size: var(--fin-fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.asset-funding > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 5px; }
.asset-funding span { color: #7c8e83; font-size: var(--fin-fs-xs); }
.asset-funding b { color: #456151; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.workbench-asset-grid :deep(.finance-progress) { height: 4px; }
.asset-card-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 9px; overflow: hidden; border-radius: 7px; background: #ebf0ec; }
.asset-card-values > div { padding: 7px; background: #fafcfb; }
.asset-card-values span, .asset-card-values strong { display: block; }
.asset-card-values span { color: #8b9991; font-size: var(--fin-fs-xs); }
.asset-card-values strong { margin-top: 2px; color: #33513e; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.asset-card-values > div:first-child strong { color: #14754a; }
.asset-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.asset-card-tags span { padding: 2px 6px; border-radius: 5px; background: #f4f8f5; color: #6c8073; font-size: var(--fin-fs-xs); }
.asset-empty { grid-column: 1 / -1; }
.workbench-investments { overflow: hidden; }
.investment-asset-cell { display: flex; align-items: center; gap: 8px; }
.investment-asset-cell > span { display: grid; width: 29px; height: 29px; place-items: center; border-radius: 8px; background: #e8f5ee; color: #23704d; font-size: var(--fin-fs-xs); font-weight: 700; }
.investment-asset-cell strong, .investment-asset-cell small { display: block; }
.investment-asset-cell strong { color: #3a5444; font-size: var(--fin-fs-xs); }
.investment-asset-cell small { margin-top: 2px; color: #8b9991; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.workbench-aside { display: grid; gap: 12px; }
.return-list { padding: 4px 13px 9px; }
.return-list > div { display: grid; grid-template-columns: 35px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 9px 0; border-top: 1px solid #edf2ee; }
.return-list > div:first-child { border-top: 0; }
.return-list time { display: grid; height: 31px; place-items: center; border-radius: 7px; background: #eef7f2; color: #2b714e; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.return-list strong, .return-list small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.return-list strong { color: #415b4a; font-size: var(--fin-fs-xs); }
.return-list small { margin-top: 2px; color: #8b9a92; font-size: var(--fin-fs-xs); }
.return-list b { color: #d05843; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.aside-empty { display: flex !important; align-items: center; justify-content: center; flex-direction: column; padding: 22px 0 !important; }
.aside-empty strong { color: #617669; }
.aside-empty span { color: #8c9a92; font-size: var(--fin-fs-xs); }
.risk-count { color: #8b9991; font-size: var(--fin-fs-xs); }
.risk-brief-list { padding: 3px 12px 10px; }
.risk-brief-list > div { display: flex; gap: 8px; padding: 9px 0; border-top: 1px solid #edf2ee; }
.risk-brief-list > div:first-child { border-top: 0; }
.risk-brief-list > div > span { display: grid; width: 21px; height: 21px; place-items: center; flex: 0 0 auto; border-radius: 50%; font-size: var(--fin-fs-xs); font-weight: 800; }
.risk-brief-list .high > span { background: #fceae7; color: #bc4c3c; }
.risk-brief-list .medium > span { background: #fff4e1; color: #a77628; }
.risk-brief-list .low > span { background: #e9f6ee; color: #26754e; }
.risk-brief-list strong { color: #415a49; font-size: var(--fin-fs-xs); }
.risk-brief-list p { margin: 3px 0 0; color: #83938a; font-size: var(--fin-fs-xs); line-height: 1.55; }
.workbench-market-note { padding: 15px; border-radius: 13px; background: linear-gradient(135deg, #edf8f1, #f7fbf8); }
.workbench-market-note span, .workbench-market-note strong, .workbench-market-note p { display: block; }
.workbench-market-note span { color: #6f8878; font-size: var(--fin-fs-xs); }
.workbench-market-note strong { margin-top: 5px; color: #28563b; font-size: var(--fin-fs-xs); }
.workbench-market-note p { margin: 5px 0 11px; color: #718479; font-size: var(--fin-fs-xs); line-height: 1.6; }
.workbench-market-note :deep(.el-button) { width: 100%; }
@media (max-width: 1100px) {
  .fund-command { grid-template-columns: 1fr 260px; }
  .workbench-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench-core { grid-template-columns: 1fr; }
  .workbench-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench-market-note { grid-column: 1 / -1; }
}
@media (max-width: 780px) {
  .fund-command { grid-template-columns: 1fr; }
  .fund-command-position { border-top: 1px solid rgba(255, 255, 255, .1); border-left: 0; }
  .position-ring { width: 138px; height: 138px; }
  .position-ring::before { width: 114px; height: 114px; }
  .workbench-task-grid, .workbench-asset-grid, .workbench-aside { grid-template-columns: 1fr; }
  .workbench-market-note { grid-column: auto; }
}
@media (max-width: 520px) {
  .fund-command-copy { padding: 21px 18px; }
  .fund-command-title { align-items: flex-start; flex-wrap: wrap; }
  .fund-command-title h1 { width: 100%; }
  .workbench-kpis { grid-template-columns: 1fr; }
}
</style>
