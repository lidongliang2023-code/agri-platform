<template>
  <section class="finance-page portfolio-page">
    <header class="finance-page-heading">
      <div>
        <small>INVESTMENT PORTFOLIO</small>
        <h1>我的投资</h1>
        <p>统一跟踪资金配置、资产履约、到期回款与已实现收益，完成投资业务闭环。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新组合</el-button>
        <el-button class="finance-ghost-button" :disabled="!filtered.length" @click="exportPortfolio">导出明细</el-button>
        <el-button class="finance-action-button" @click="router.push('/fund/asset-market')">继续配置</el-button>
      </div>
    </header>

    <div v-if="error" class="portfolio-error">
      <span>{{ error }}</span>
      <el-button link @click="load">重新加载</el-button>
    </div>

    <el-skeleton v-if="loading && !portfolio" :rows="10" animated />

    <template v-if="portfolio">
      <section class="portfolio-command">
        <div class="portfolio-command-main">
          <small>ACTIVE CAPITAL PORTFOLIO</small>
          <span>在投本金</span>
          <strong>{{ money(summary.activeAmount) }}</strong>
          <p>{{ summary.activeCount || 0 }} 笔资产履约中 · {{ summary.pendingReturnCount || 0 }} 笔待确认回款</p>
          <div class="portfolio-command-actions">
            <el-button class="portfolio-primary" @click="filter = 'due'">处理待回款</el-button>
            <el-button class="portfolio-ghost" @click="router.push('/fund/asset-market')">发现新资产</el-button>
          </div>
        </div>
        <div class="portfolio-headroom">
          <span>机构可用资金</span>
          <strong>{{ compactMoney(account.availableAmount) }}</strong>
          <div><b :style="{ width: `${Math.min(100, Number(account.utilizationRate || 0))}%` }" /></div>
          <small>总额度 {{ compactMoney(account.totalLimit) }} · 已占用 {{ compactMoney(account.committedAmount) }}</small>
        </div>
        <div class="portfolio-command-stat"><span>在投预期收益</span><strong>{{ compactMoney(summary.expectedReturn) }}</strong><small>按当前资产收益测算</small></div>
        <div class="portfolio-command-stat"><span>已回收本息</span><strong>{{ compactMoney(summary.returnedAmount) }}</strong><small>已实现收益 {{ compactMoney(summary.realizedIncome) }}</small></div>
      </section>

      <section class="portfolio-kpis">
        <article><span>累计投资</span><strong>{{ compactMoney(summary.totalInvested) }}</strong><small>{{ summary.investmentCount || 0 }} 笔投资记录</small></article>
        <article><span>待回款</span><strong>{{ summary.pendingReturnCount || 0 }}<em> 笔</em></strong><small>{{ summary.dueSoonCount || 0 }} 笔将在 30 天内到期</small></article>
        <article><span>已完成</span><strong>{{ summary.completedCount || 0 }}<em> 笔</em></strong><small>完成率 {{ number(summary.completionRate) }}%</small></article>
        <article :class="{ warning: Number(summary.overdueCount) > 0 }"><span>回款异常</span><strong>{{ summary.overdueCount || 0 }}<em> 笔</em></strong><small>{{ Number(summary.overdueCount) ? '已到期，请及时确认处置' : '当前无到期待回款资产' }}</small></article>
      </section>

      <div v-if="Number(summary.overdueCount) > 0" class="portfolio-alert">
        <span>!</span>
        <div><strong>存在 {{ summary.overdueCount }} 笔已到期待回款资产</strong><p>请核验借款人回款并确认本息到账，避免资金头寸长期占用。</p></div>
        <el-button link @click="filter = 'overdue'">立即处理 →</el-button>
      </div>

      <div class="portfolio-layout">
        <main class="finance-card portfolio-list-card">
          <div class="portfolio-toolbar">
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
            <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="搜索投资编号或资产" />
          </div>

          <el-table v-if="filtered.length" :data="filtered" style="width: 100%">
            <el-table-column label="投资资产" min-width="215">
              <template #default="{ row }">
                <div class="portfolio-asset-cell">
                  <span>{{ row.assetType?.slice(0, 1) || '资' }}</span>
                  <div>
                    <el-button link class="portfolio-asset-link" @click="openAsset(row)">{{ row.assetName }}</el-button>
                    <small>{{ row.investmentNo }} · {{ row.assetType }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="配置金额" min-width="115" align="right">
              <template #default="{ row }"><strong class="portfolio-money">{{ money(row.investmentAmount) }}</strong></template>
            </el-table-column>
            <el-table-column label="预期收益" min-width="105" align="right">
              <template #default="{ row }"><span class="portfolio-return">{{ money(row.expectedReturn) }}</span></template>
            </el-table-column>
            <el-table-column label="期限/收益率" width="105">
              <template #default="{ row }"><span>{{ row.term }} 个月</span><small class="portfolio-sub">{{ number(row.interestRate) }}%</small></template>
            </el-table-column>
            <el-table-column label="到期日" min-width="115">
              <template #default="{ row }">
                <span>{{ dateOnly(row.expectedReturnTime) }}</span>
                <small class="portfolio-sub" :class="{ danger: row.overdue }">{{ dueText(row) }}</small>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }"><FinanceStatus :value="row.status" /></template>
            </el-table-column>
            <el-table-column label="操作" width="125" align="right">
              <template #default="{ row }">
                <el-button link class="finance-link-button" @click="openDetail(row)">详情</el-button>
                <el-button
                  v-if="['投资中', '待回款'].includes(row.status)"
                  link
                  class="finance-link-button"
                  @click="complete(row)"
                >
                  确认回款
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-else class="finance-empty portfolio-empty">
            <strong>暂无匹配投资</strong>
            <p>{{ keyword || filter !== 'all' ? '请调整筛选条件后重试。' : '从资产市场完成资金配置后，会在这里形成投资组合。' }}</p>
          </div>
        </main>

        <aside class="portfolio-aside">
          <section class="portfolio-allocation">
            <div class="portfolio-aside-head"><strong>资产配置分布</strong><span>按在投本金</span></div>
            <div v-for="item in allocation" :key="item.type" class="allocation-row">
              <div><span>{{ item.type }}</span><b>{{ number(item.percent) }}%</b></div>
              <div class="finance-progress"><span :style="{ width: `${Math.min(100, Number(item.percent))}%` }" /></div>
              <small>{{ compactMoney(item.amount) }}</small>
            </div>
            <div v-if="!allocation.length" class="portfolio-aside-empty">暂无在投资产配置</div>
          </section>

          <section class="finance-card">
            <div class="finance-card-head"><strong>近期回款计划</strong><span class="finance-muted">未来 30 天</span></div>
            <div class="portfolio-upcoming">
              <div v-for="item in dueSchedule" :key="item.id">
                <time>{{ dateDay(item.expectedReturnTime) }}</time>
                <div><strong>{{ item.assetName }}</strong><small>预计到账 {{ money(item.expectedTotal) }}</small></div>
                <b>{{ item.remainingDays }} 天</b>
              </div>
              <div v-if="!dueSchedule.length" class="portfolio-upcoming-empty">
                <strong>暂无近期回款</strong>
                <span>30 天内没有到期投资</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <el-dialog v-model="detailOpen" title="投资详情" width="min(700px, 94vw)">
      <div v-if="selected" class="investment-detail">
        <section class="investment-detail-head">
          <div class="investment-detail-mark">{{ selected.assetType?.slice(0, 1) || '资' }}</div>
          <div><small>{{ selected.investmentNo }}</small><h2>{{ selected.assetName }}</h2><p>{{ selected.borrowerName || '历史融资主体' }} · {{ selected.borrowerRating || '—' }} 级 · {{ selected.term }} 个月</p></div>
          <FinanceStatus :value="selected.status" />
        </section>
        <section class="investment-detail-values">
          <div><span>配置本金</span><strong>{{ money(selected.investmentAmount) }}</strong></div>
          <div><span>预期收益</span><strong>{{ money(selected.expectedReturn) }}</strong></div>
          <div><span>预计回款</span><strong>{{ money(selected.expectedTotal) }}</strong></div>
          <div><span>持有期收益率</span><strong>{{ number(selected.interestRate) }}%</strong></div>
        </section>
        <section class="investment-detail-timeline">
          <div class="done"><span>✓</span><p><strong>资金配置成功</strong><small>{{ shortDate(selected.investmentTime) }}</small></p></div>
          <div :class="{ done: ['待回款', '已完成'].includes(selected.status), risk: selected.overdue }"><span>{{ selected.overdue ? '!' : '2' }}</span><p><strong>{{ selected.overdue ? '已到期，待确认回款' : '资产履约与到期跟踪' }}</strong><small>{{ dateOnly(selected.expectedReturnTime) }} 到期</small></p></div>
          <div :class="{ done: selected.status === '已完成' }"><span>{{ selected.status === '已完成' ? '✓' : '3' }}</span><p><strong>本息回收</strong><small>{{ selected.status === '已完成' ? `${dateOnly(selected.actualReturnTime)} 到账 ${money(selected.actualReturnAmount)}` : '等待资金方确认到账' }}</small></p></div>
        </section>
        <section class="investment-detail-meta">
          <div><span>资产类型</span><strong>{{ selected.assetType }}</strong></div>
          <div><span>增信措施</span><strong>{{ selected.collateralType || '信用融资' }}</strong></div>
          <div><span>借款人</span><strong>{{ selected.borrowerName || '历史资产' }}</strong></div>
          <div><span>当前动作</span><strong>{{ selected.nextAction }}</strong></div>
        </section>
        <div v-if="selected.overdue" class="investment-detail-risk">该笔投资已超过预计回款日 {{ Math.abs(selected.remainingDays) }} 天，请核验借款人还款并尽快完成回款确认。</div>
      </div>
      <template #footer>
        <el-button class="finance-ghost-button" @click="detailOpen = false">关闭</el-button>
        <el-button class="finance-ghost-button" @click="openAsset(selected)">查看资产</el-button>
        <el-button
          v-if="selected && ['投资中', '待回款'].includes(selected.status)"
          class="finance-action-button"
          @click="complete(selected)"
        >
          确认本息到账
        </el-button>
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
import { compactMoney, money, shortDate } from '@/api/finance'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const portfolio = ref(null)
const filter = ref('all')
const keyword = ref('')
const detailOpen = ref(false)
const selected = ref(null)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '履约中' },
  { key: 'due', label: '待回款' },
  { key: 'overdue', label: '已到期' },
  { key: 'complete', label: '已完成' },
]
const account = computed(() => portfolio.value?.account || {})
const summary = computed(() => portfolio.value?.summary || {})
const investments = computed(() => portfolio.value?.investments || [])
const allocation = computed(() => portfolio.value?.allocation || [])
const dueSchedule = computed(() => portfolio.value?.dueSchedule || [])
const filtered = computed(() => {
  let rows = investments.value
  if (filter.value === 'active') rows = rows.filter((item) => item.status === '投资中')
  if (filter.value === 'due') rows = rows.filter((item) => item.status === '待回款')
  if (filter.value === 'overdue') rows = rows.filter((item) => item.overdue)
  if (filter.value === 'complete') rows = rows.filter((item) => item.status === '已完成')
  const search = keyword.value.trim().toLowerCase()
  if (search) {
    rows = rows.filter((item) => `${item.investmentNo}${item.assetName}${item.assetType}`.toLowerCase().includes(search))
  }
  return rows
})

const number = (value) => Number(value || 0).toFixed(2)
const dateOnly = (value) => value ? String(value).replace('T', ' ').slice(0, 10) : '—'
const dateDay = (value) => value ? String(value).replace('T', ' ').slice(5, 10) : '--'

function dueText(item) {
  if (item.status === '已完成') return '已回款'
  if (item.overdue || Number(item.remainingDays) < 0) return `已超期 ${Math.abs(Number(item.remainingDays))} 天`
  if (Number(item.remainingDays) === 0) return '今日到期'
  return `剩余 ${item.remainingDays} 天`
}

function countFor(key) {
  if (key === 'active') return investments.value.filter((item) => item.status === '投资中').length
  if (key === 'due') return summary.value.pendingReturnCount || 0
  if (key === 'overdue') return summary.value.overdueCount || 0
  if (key === 'complete') return summary.value.completedCount || 0
  return investments.value.length
}

function openDetail(item) {
  selected.value = item
  detailOpen.value = true
}

function openAsset(item) {
  if (!item?.assetId) return
  router.push(`/fund/asset-market/${encodeURIComponent(item.assetId)}`)
}

async function complete(item) {
  if (!item) return
  try {
    await ElMessageBox.confirm(
      `确认「${item.assetName}」本息 ${money(item.expectedTotal)} 已到账？确认后将关闭投资并释放机构资金额度。`,
      '确认投资回款',
      { confirmButtonText: '确认已到账', cancelButtonText: '取消', type: 'warning' },
    )
    await operationsApi.completeInvestment(item.id)
    ElMessage.success('本息回款已确认，资金额度已释放')
    detailOpen.value = false
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err.message || '回款确认失败')
  }
}

function exportPortfolio() {
  const header = ['投资编号', '资产名称', '资产类型', '投资金额', '预期收益', '预计回款', '持有期收益率', '到期日', '状态']
  const lines = filtered.value.map((item) => [
    item.investmentNo,
    item.assetName,
    item.assetType,
    item.investmentAmount,
    item.expectedReturn,
    item.expectedTotal,
    item.interestRate,
    dateOnly(item.expectedReturnTime),
    item.status,
  ])
  const csv = `\uFEFF${[header, ...lines].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `资金方投资组合_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    portfolio.value = await operationsApi.portfolio()
  } catch (err) {
    error.value = err.message || '投资组合加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.portfolio-error { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border: 1px solid #efd4ce; border-radius: 10px; background: #fff8f6; color: #a44f3f; font-size: var(--fin-fs-xs); }
.portfolio-command { display: grid; grid-template-columns: 1.35fr 1fr repeat(2, minmax(0, 1fr)); overflow: hidden; border-radius: 16px; background: radial-gradient(circle at 78% 0%, rgba(134, 232, 173, .18), transparent 14rem), linear-gradient(135deg, #073c26, #0d6b47); color: #fff; }
.portfolio-command > div { min-width: 0; padding: 18px 20px; border-left: 1px solid rgba(255, 255, 255, .1); }
.portfolio-command > div:first-child { border-left: 0; }
.portfolio-command-main small { color: #a6dfbb; font-size: var(--fin-fs-xs); letter-spacing: .11em; }
.portfolio-command-main > span { display: block; margin-top: 10px; color: rgba(255, 255, 255, .52); font-size: var(--fin-fs-xs); }
.portfolio-command-main > strong { display: block; margin-top: 3px; font-family: ui-monospace, Consolas, monospace; font-size: 27px; }
.portfolio-command-main > p { margin: 4px 0 0; color: rgba(255, 255, 255, .46); font-size: var(--fin-fs-xs); }
.portfolio-command-actions { display: flex; gap: 7px; margin-top: 13px; }
.portfolio-command-actions :deep(.el-button) { height: 30px; margin: 0; border-radius: 7px; font-size: var(--fin-fs-xs); }
.portfolio-primary { border-color: #fff; background: #fff; color: #0c603f; font-weight: 700; }
.portfolio-ghost { border-color: rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .07); color: #fff; }
.portfolio-headroom, .portfolio-command-stat { display: flex; justify-content: center; flex-direction: column; }
.portfolio-headroom > span, .portfolio-command-stat > span { color: rgba(255, 255, 255, .46); font-size: var(--fin-fs-xs); }
.portfolio-headroom > strong, .portfolio-command-stat > strong { display: block; margin-top: 6px; font-family: ui-monospace, Consolas, monospace; font-size: 17px; }
.portfolio-headroom > div { height: 4px; margin-top: 9px; overflow: hidden; border-radius: 99px; background: rgba(255, 255, 255, .12); }
.portfolio-headroom > div b { display: block; height: 100%; border-radius: inherit; background: #8fe2ae; }
.portfolio-headroom > small, .portfolio-command-stat > small { display: block; margin-top: 5px; color: rgba(255, 255, 255, .42); font-size: var(--fin-fs-xs); line-height: 1.5; }
.portfolio-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.portfolio-kpis article { padding: 13px 15px; border: 1px solid var(--fin-line); border-radius: 11px; background: #fff; }
.portfolio-kpis article.warning { border-color: #efd9d3; background: #fffaf8; }
.portfolio-kpis span, .portfolio-kpis strong, .portfolio-kpis small { display: block; }
.portfolio-kpis span { color: #82938a; font-size: var(--fin-fs-xs); }
.portfolio-kpis strong { margin-top: 6px; color: #294d38; font-family: ui-monospace, Consolas, monospace; font-size: 17px; }
.portfolio-kpis article.warning strong { color: #b94f3e; }
.portfolio-kpis em { color: #7a8f81; font-size: var(--fin-fs-xs); font-style: normal; }
.portfolio-kpis small { margin-top: 3px; color: #8b9991; font-size: var(--fin-fs-xs); }
.portfolio-alert { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid #efdad4; border-radius: 10px; background: #fff9f7; }
.portfolio-alert > span { display: grid; width: 25px; height: 25px; place-items: center; flex: 0 0 auto; border-radius: 50%; background: #fbe8e4; color: #bb4c3c; font-size: var(--fin-fs-xs); font-weight: 800; }
.portfolio-alert > div { min-width: 0; flex: 1; }
.portfolio-alert strong { color: #875045; font-size: var(--fin-fs-xs); }
.portfolio-alert p { margin: 2px 0 0; color: #9a7168; font-size: var(--fin-fs-xs); }
.portfolio-layout { display: grid; grid-template-columns: minmax(0, 1fr) 285px; align-items: start; gap: 13px; }
.portfolio-list-card { min-width: 0; overflow: hidden; }
.portfolio-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #edf2ee; }
.portfolio-toolbar :deep(.el-input) { width: 235px; }
.finance-tabs button > span { margin-left: 4px; color: #91a097; font-size: var(--fin-fs-xs); }
.portfolio-asset-cell { display: flex; align-items: center; gap: 8px; }
.portfolio-asset-cell > span { display: grid; width: 32px; height: 32px; place-items: center; flex: 0 0 auto; border-radius: 8px; background: #e8f5ee; color: #26704c; font-size: var(--fin-fs-xs); font-weight: 700; }
.portfolio-asset-cell > div { min-width: 0; }
.portfolio-asset-cell small { display: block; overflow: hidden; margin-top: 2px; color: #89988f; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.portfolio-asset-link { padding: 0; color: #315f46; font-size: var(--fin-fs-xs); }
.portfolio-money { color: #31523e; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.portfolio-return { color: #d05741; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.portfolio-sub { display: block; margin-top: 3px; color: #87978e; font-size: var(--fin-fs-xs); }
.portfolio-sub.danger { color: #bb4b3b; }
.portfolio-empty { min-height: 260px; }
.portfolio-aside { display: grid; gap: 11px; }
.portfolio-allocation { padding: 15px; border: 1px solid var(--fin-line); border-radius: 13px; background: #fff; }
.portfolio-aside-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.portfolio-aside-head strong { color: #304f3c; font-size: var(--fin-fs-xs); }
.portfolio-aside-head span { color: #8a9991; font-size: var(--fin-fs-xs); }
.allocation-row { margin-top: 11px; }
.allocation-row > div:first-child { display: flex; justify-content: space-between; margin-bottom: 5px; }
.allocation-row span { color: #687e70; font-size: var(--fin-fs-xs); }
.allocation-row b { color: #285d3f; font-size: var(--fin-fs-xs); }
.allocation-row small { display: block; margin-top: 3px; color: #8c9a92; font-size: var(--fin-fs-xs); }
.portfolio-aside-empty { padding: 20px 0; color: #8c9a92; font-size: var(--fin-fs-xs); text-align: center; }
.portfolio-upcoming { padding: 4px 13px 9px; }
.portfolio-upcoming > div { display: grid; grid-template-columns: 37px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 9px 0; border-top: 1px solid #edf2ee; }
.portfolio-upcoming > div:first-child { border-top: 0; }
.portfolio-upcoming time { display: grid; height: 30px; place-items: center; border-radius: 7px; background: #edf7f1; color: #28714d; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.portfolio-upcoming strong, .portfolio-upcoming small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.portfolio-upcoming strong { color: #415b4a; font-size: var(--fin-fs-xs); }
.portfolio-upcoming small { margin-top: 2px; color: #89988f; font-size: var(--fin-fs-xs); }
.portfolio-upcoming b { color: #d05843; font-size: var(--fin-fs-xs); }
.portfolio-upcoming-empty { display: flex !important; align-items: center; justify-content: center; flex-direction: column; padding: 22px 0 !important; }
.portfolio-upcoming-empty span { margin-top: 3px; color: #8c9a92; font-size: var(--fin-fs-xs); }
.investment-detail { display: grid; gap: 12px; }
.investment-detail-head { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; background: #f5faf7; }
.investment-detail-mark { display: grid; width: 42px; height: 42px; place-items: center; flex: 0 0 auto; border-radius: 11px; background: #e0f1e7; color: #1d7149; font-size: 13px; font-weight: 800; }
.investment-detail-head > div:nth-child(2) { min-width: 0; flex: 1; }
.investment-detail-head small, .investment-detail-head h2, .investment-detail-head p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.investment-detail-head small { color: #8a9991; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.investment-detail-head h2 { margin: 3px 0 2px; color: #2f4d3a; font-size: 13px; }
.investment-detail-head p { margin: 0; color: #7e9085; font-size: var(--fin-fs-xs); }
.investment-detail-values { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: 9px; background: #e9efeb; }
.investment-detail-values > div { padding: 10px; background: #fbfcfb; }
.investment-detail-values span, .investment-detail-values strong { display: block; }
.investment-detail-values span { color: #87978e; font-size: var(--fin-fs-xs); }
.investment-detail-values strong { margin-top: 4px; color: #31563f; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.investment-detail-timeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; padding: 11px 2px; }
.investment-detail-timeline > div { position: relative; display: flex; gap: 7px; padding-right: 9px; }
.investment-detail-timeline > div::after { content: ''; position: absolute; top: 11px; right: 0; left: 24px; height: 1px; background: #e0e9e3; }
.investment-detail-timeline > div:last-child::after { display: none; }
.investment-detail-timeline > div > span { display: grid; width: 23px; height: 23px; place-items: center; flex: 0 0 auto; border: 1px solid #d9e4dc; border-radius: 50%; background: #f8fbf9; color: #8a9991; font-size: var(--fin-fs-xs); }
.investment-detail-timeline > div.done > span { border-color: #8fcaab; background: #e8f6ee; color: #1c744b; }
.investment-detail-timeline > div.risk > span { border-color: #e8b0a7; background: #fcebe7; color: #b64b3a; }
.investment-detail-timeline p { margin: 0; }
.investment-detail-timeline strong, .investment-detail-timeline small { display: block; }
.investment-detail-timeline strong { color: #405b4a; font-size: var(--fin-fs-xs); }
.investment-detail-timeline small { margin-top: 2px; color: #89988f; font-size: var(--fin-fs-xs); }
.investment-detail-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: 8px; background: #e9efeb; }
.investment-detail-meta > div { padding: 9px 10px; background: #fff; }
.investment-detail-meta span, .investment-detail-meta strong { display: block; }
.investment-detail-meta span { color: #87978e; font-size: var(--fin-fs-xs); }
.investment-detail-meta strong { margin-top: 3px; color: #45604e; font-size: var(--fin-fs-xs); }
.investment-detail-risk { padding: 9px 11px; border-radius: 8px; background: #fff6f3; color: #a65243; font-size: var(--fin-fs-xs); line-height: 1.55; }
@media (max-width: 1050px) {
  .portfolio-command { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .portfolio-command > div:nth-child(3) { border-top: 1px solid rgba(255, 255, 255, .1); border-left: 0; }
  .portfolio-command > div:nth-child(4) { border-top: 1px solid rgba(255, 255, 255, .1); }
  .portfolio-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .portfolio-layout { grid-template-columns: 1fr; }
  .portfolio-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .portfolio-toolbar { align-items: stretch; flex-direction: column; }
  .portfolio-toolbar :deep(.el-input) { width: 100%; }
  .portfolio-aside, .portfolio-command { grid-template-columns: 1fr; }
  .portfolio-command > div { border-top: 1px solid rgba(255, 255, 255, .1); border-left: 0; }
  .portfolio-command > div:first-child { border-top: 0; }
  .investment-detail-values, .investment-detail-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .investment-detail-timeline { grid-template-columns: 1fr; gap: 10px; }
  .investment-detail-timeline > div::after { top: 23px; bottom: -11px; left: 11px; width: 1px; height: auto; }
}
@media (max-width: 500px) {
  .portfolio-kpis, .portfolio-command { grid-template-columns: 1fr; }
}
</style>
