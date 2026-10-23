<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>INVESTMENT PORTFOLIO</small><h1>我的投资</h1><p>查看资金配置、预计回款与已完成投资记录。</p></div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新组合</el-button>
        <el-button class="finance-action-button" @click="$router.push('/fund/asset-market')">继续配置</el-button>
      </div>
    </header>

    <div class="portfolio-hero">
      <div><small>ACTIVE PORTFOLIO</small><span>在投资金</span><strong>{{ money(activeAmount) }}</strong><p>{{ activeInvestments.length }} 笔投资持续跟踪中</p></div>
      <div class="portfolio-stats">
        <div><span>累计投资</span><strong>{{ compactMoney(totalAmount) }}</strong></div>
        <div><span>预期收益</span><strong>{{ compactMoney(expectedReturn) }}</strong></div>
        <div><span>已回收本息</span><strong>{{ compactMoney(returnedAmount) }}</strong></div>
      </div>
    </div>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>投资资产</span><strong>{{ investments.length }}<em> 个</em></strong><small>平台农业供应链资产</small></article>
      <article class="finance-kpi"><span>在投金额</span><strong>{{ compactMoney(activeAmount) }}</strong><small>尚未到期资产</small></article>
      <article class="finance-kpi"><span>预计总收益</span><strong>{{ compactMoney(expectedReturn) }}</strong><small>按资产预期收益测算</small></article>
      <article class="finance-kpi"><span>已完成</span><strong>{{ completedInvestments.length }}<em> 笔</em></strong><small>本息已回到资金账户</small></article>
    </div>

    <div class="portfolio-layout">
      <section class="finance-card">
        <div class="finance-card-head"><strong>投资明细</strong><div class="finance-tabs"><button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button><button type="button" :class="{ on: filter === 'active' }" @click="filter = 'active'">投资中</button><button type="button" :class="{ on: filter === 'complete' }" @click="filter = 'complete'">已完成</button></div></div>
        <el-table v-if="filtered.length" :data="filtered" style="width: 100%">
          <el-table-column prop="investmentNo" label="投资编号" min-width="145" />
          <el-table-column prop="assetName" label="资产" min-width="190" />
          <el-table-column label="投资金额" min-width="110" align="right"><template #default="{ row }">{{ money(row.investmentAmount) }}</template></el-table-column>
          <el-table-column label="预期收益" min-width="100" align="right"><template #default="{ row }">{{ money(row.expectedReturn) }}</template></el-table-column>
          <el-table-column label="年化" width="75" align="right"><template #default="{ row }">{{ row.interestRate }}%</template></el-table-column>
          <el-table-column label="到期日" min-width="105"><template #default="{ row }">{{ shortDate(row.expectedReturnTime).slice(0, 10) }}</template></el-table-column>
          <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
          <el-table-column label="操作" width="105" align="right"><template #default="{ row }"><el-button v-if="row.status === '投资中'" link class="finance-link-button" @click="complete(row)">确认回款</el-button><span v-else class="portfolio-done">已回款</span></template></el-table-column>
        </el-table>
        <div v-else class="finance-empty"><strong>暂无投资记录</strong><p>从资产市场完成资金配置后，会形成投资组合。</p></div>
      </section>

      <aside class="portfolio-aside">
        <section class="portfolio-allocation">
          <h3>资产配置分布</h3>
          <div v-for="item in allocation" :key="item.type">
            <div><span>{{ item.type }}</span><b>{{ item.percent.toFixed(1) }}%</b></div>
            <div class="finance-progress"><span :style="{ width: `${item.percent}%` }" /></div>
            <small>{{ money(item.amount) }}</small>
          </div>
        </section>
        <section class="finance-card">
          <div class="finance-card-head"><strong>回款计划</strong><small>近期到期</small></div>
          <div class="portfolio-upcoming">
            <div v-for="item in upcoming" :key="item.id"><span>{{ shortDate(item.expectedReturnTime).slice(0, 10) }}</span><p>{{ item.assetName }}</p><strong>{{ money(Number(item.investmentAmount) + Number(item.expectedReturn)) }}</strong></div>
            <p v-if="!upcoming.length" class="portfolio-empty">暂无近期回款计划</p>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money, shortDate } from '@/api/finance'

const loading = ref(true)
const investments = ref([])
const filter = ref('all')
const activeInvestments = computed(() => investments.value.filter((item) => item.status === '投资中'))
const completedInvestments = computed(() => investments.value.filter((item) => item.status === '已完成'))
const totalAmount = computed(() => investments.value.reduce((total, item) => total + Number(item.investmentAmount || 0), 0))
const activeAmount = computed(() => activeInvestments.value.reduce((total, item) => total + Number(item.investmentAmount || 0), 0))
const expectedReturn = computed(() => investments.value.reduce((total, item) => total + Number(item.expectedReturn || 0), 0))
const returnedAmount = computed(() => completedInvestments.value.reduce((total, item) => total + Number(item.actualReturnAmount || 0), 0))
const filtered = computed(() => filter.value === 'active' ? activeInvestments.value : filter.value === 'complete' ? completedInvestments.value : investments.value)
const upcoming = computed(() => [...activeInvestments.value].sort((a, b) => String(a.expectedReturnTime).localeCompare(String(b.expectedReturnTime))).slice(0, 3))
const allocation = computed(() => {
  const groups = new Map()
  activeInvestments.value.forEach((item) => {
    const type = item.assetName?.includes('仓单') ? '仓单质押资产' : item.assetName?.includes('订单') ? '订单融资资产' : '农业经营资产'
    groups.set(type, (groups.get(type) || 0) + Number(item.investmentAmount || 0))
  })
  return Array.from(groups.entries()).map(([type, amount]) => ({ type, amount, percent: activeAmount.value ? amount / activeAmount.value * 100 : 0 }))
})

async function complete(item) {
  await ElMessageBox.confirm(`确认资产 ${item.assetName} 的本息已回款？`, '确认投资回款', { confirmButtonText: '确认回款', cancelButtonText: '取消', type: 'info' })
  try {
    await operationsApi.completeInvestment(item.id)
    ElMessage.success('投资已完成，回款记录已更新')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '回款确认失败')
  }
}

async function load() {
  loading.value = true
  try {
    investments.value = (await operationsApi.investments()) || []
  } catch (err) {
    ElMessage.error(err.message || '投资组合加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.portfolio-hero { display: flex; min-height: 175px; align-items: center; justify-content: space-between; gap: 24px; padding: 24px 27px; border-radius: 18px; background: radial-gradient(circle at 88% 9%, rgba(131, 228, 170, .19), transparent 13rem), linear-gradient(135deg, #083c27, #0f7048); color: #fff; }
.portfolio-hero > div:first-child small, .portfolio-hero > div:first-child span, .portfolio-hero > div:first-child strong, .portfolio-hero > div:first-child p { display: block; }
.portfolio-hero > div:first-child small { color: #a8dfbd; font-size: 7px; letter-spacing: .11em; }
.portfolio-hero > div:first-child span { margin-top: 13px; color: rgba(255, 255, 255, .57); font-size: 9px; }
.portfolio-hero > div:first-child strong { margin-top: 3px; font-family: ui-monospace, Consolas, monospace; font-size: 31px; }
.portfolio-hero > div:first-child p { margin: 3px 0 0; color: rgba(255, 255, 255, .5); font-size: 8px; }
.portfolio-stats { display: flex; gap: 1px; overflow: hidden; border-radius: 10px; background: rgba(255, 255, 255, .12); }
.portfolio-stats > div { min-width: 120px; padding: 13px; background: rgba(255, 255, 255, .06); }
.portfolio-stats span, .portfolio-stats strong { display: block; }
.portfolio-stats span { color: rgba(255, 255, 255, .48); font-size: 8px; }
.portfolio-stats strong { margin-top: 4px; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.portfolio-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; align-items: start; gap: 14px; }
.portfolio-aside { display: grid; gap: 12px; }
.portfolio-allocation { padding: 16px; border: 1px solid var(--fin-line); border-radius: 14px; background: #fff; }
.portfolio-allocation h3 { margin: 0 0 14px; color: #2d4b39; font-size: 13px; }
.portfolio-allocation > div { margin-top: 13px; }
.portfolio-allocation > div > div:first-child { display: flex; justify-content: space-between; margin-bottom: 5px; }
.portfolio-allocation span { color: #6d8175; font-size: 8.5px; }
.portfolio-allocation b { color: #2b6342; font-size: 9px; }
.portfolio-allocation small { display: block; margin-top: 3px; color: #8c9a92; font-size: 7.5px; }
.portfolio-upcoming { display: grid; padding: 12px 14px; }
.portfolio-upcoming > div { display: grid; grid-template-columns: 65px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid #edf2ee; }
.portfolio-upcoming > div:first-child { border-top: 0; }
.portfolio-upcoming span { color: #8a9991; font-size: 7.5px; }
.portfolio-upcoming p { overflow: hidden; margin: 0; color: #47604f; font-size: 8.5px; text-overflow: ellipsis; white-space: nowrap; }
.portfolio-upcoming strong { color: #d0523f; font-size: 8.5px; }
.portfolio-empty { color: #8b9a92; font-size: 8px; text-align: center; }
.portfolio-done { color: #7b8e82; font-size: 8px; }
@media (max-width: 900px) { .portfolio-layout { grid-template-columns: 1fr; } .portfolio-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 680px) { .portfolio-hero { align-items: stretch; flex-direction: column; } .portfolio-stats { flex-direction: column; } .portfolio-stats > div { min-width: 0; } .portfolio-aside { grid-template-columns: 1fr; } }
</style>
