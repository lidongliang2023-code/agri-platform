<template>
  <div class="dashboard">
    <div class="page-head">
      <div>
        <h2>经营看板</h2>
        <p>本店今日经营概览 · 数据来源为渠道订单、佣金与售后记录；跨模块数据只做引用。</p>
      </div>
      <div class="quick-actions">
        <el-button @click="$router.push('/product-pool')">去选品</el-button>
        <el-button @click="$router.push('/fulfillment')">去履约</el-button>
        <el-button type="primary" @click="$router.push('/wallet')">去提现</el-button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon sales"><el-icon><Money /></el-icon></div>
        <div class="stat-info"><p class="stat-value">¥{{ money(stats.todayAmount) }}</p><p class="stat-label">今日销售额</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orders"><el-icon><ShoppingCart /></el-icon></div>
        <div class="stat-info"><p class="stat-value">{{ stats.todayOrders || 0 }}</p><p class="stat-label">今日订单</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon pending"><el-icon><Box /></el-icon></div>
        <div class="stat-info"><p class="stat-value">{{ stats.pendingShip || 0 }}</p><p class="stat-label">待发货</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon wallet"><el-icon><Wallet /></el-icon></div>
        <div class="stat-info"><p class="stat-value">¥{{ money(summary.available) }}</p><p class="stat-label">可提现余额</p></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <h3>近 7 日销售</h3>
          <el-button link type="primary" @click="$router.push('/analytics')">经营分析</el-button>
        </div>
        <div ref="trendChart" class="chart" />
      </div>

      <div class="card">
        <div class="card-head"><h3>待办</h3></div>
        <ul class="todo-list">
          <li @click="$router.push('/after-sales')">
            <span>待处理售后</span><b>{{ stats.pendingAfterSale || 0 }}</b>
          </li>
          <li @click="$router.push('/fulfillment')">
            <span>待发货订单</span><b>{{ stats.pendingShip || 0 }}</b>
          </li>
          <li @click="$router.push('/commissions')">
            <span>待结算佣金</span><b>¥{{ money(summary.pendingTotal) }}</b>
          </li>
          <li @click="$router.push('/wallet')">
            <span>提现中</span><b>¥{{ money(summary.frozenTotal) }}</b>
          </li>
        </ul>
        <p class="note">佣金按订单确认收货后结算；批次结算与打款流水可在资金页查看。</p>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>最近佣金</h3>
        <el-button link type="primary" @click="$router.push('/commissions')">全部佣金</el-button>
      </div>
      <el-table :data="recentCommissions" border size="small">
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column label="佣金" width="110">
          <template #default="{ row }">¥{{ money(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SETTLED' ? 'success' : 'warning'">{{ row.status === 'SETTLED' ? '已结算' : '待结算' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="产生时间" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button v-if="row.orderId" link type="primary" @click="$router.push(`/orders/${row.orderId}`)">订单</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!recentCommissions.length" description="还没有佣金记录，先去选品铺货吧" :image-size="70" />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Money, ShoppingCart, Box, Wallet } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { channelApi } from '../api'
import { currentChannelId } from '../api/channelSession'

const stats = ref({})
const summary = ref({})
const todayTrend = ref([])
const recentCommissions = ref([])
const trendChart = ref(null)
let chart = null

onMounted(load)
onUnmounted(() => chart?.dispose())

async function load() {
  const channelId = await currentChannelId()
  if (!channelId) {
    ElMessage.warning('当前账号还没有渠道档案，请先提交渠道入驻')
    return
  }
  try {
    const [statsRes, summaryRes, analyticsRes, commissionsRes] = await Promise.all([
      channelApi.getOrderStats(),
      channelApi.getCommissionSummary(),
      channelApi.getAnalytics(7),
      channelApi.getCommissions({ channelId, page: 1, size: 5 }),
    ])
    stats.value = statsRes || {}
    summary.value = summaryRes || {}
    todayTrend.value = analyticsRes?.trend || []
    recentCommissions.value = commissionsRes?.records || []
    await nextTick()
    renderTrend()
  } catch (e) {
    ElMessage.error(e?.message || '看板数据读取失败')
  }
}

function renderTrend() {
  if (!trendChart.value) return
  if (!chart) chart = echarts.init(trendChart.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 12, top: 20, bottom: 28 },
    xAxis: {
      type: 'category',
      data: todayTrend.value.map((p) => p.date),
      axisLabel: { color: '#6b7c72', fontSize: 12 },
      axisLine: { lineStyle: { color: '#e3eae5' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#6b7c72' }, splitLine: { lineStyle: { color: '#eef3ef' } } },
    series: [{
      type: 'line', smooth: true, symbol: 'none',
      data: todayTrend.value.map((p) => Number(p.amount || 0)),
      lineStyle: { color: '#12764a', width: 2 },
      areaStyle: { color: 'rgba(18,118,74,0.12)' },
    }],
  }, true)
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; }
.quick-actions { display: flex; gap: 8px; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-icon { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 12px; font-size: 20px; }
.stat-icon.sales { background: #e5f5eb; color: #12764a; }
.stat-icon.orders { background: #e7f3fa; color: #176c93; }
.stat-icon.pending { background: #fff3dd; color: #a96a08; }
.stat-icon.wallet { background: #f1eefe; color: #6b4fd8; }
.stat-info { display: flex; flex-direction: column; gap: 4px; }
.stat-value { margin: 0; color: #173e2a; font-size: 22px; font-weight: 700; }
.stat-label { margin: 0; color: #84938a; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.chart { height: 260px; }
.todo-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 10px; background: #f6faf7; color: #52665a; font-size: 13px; cursor: pointer; }
.todo-list li:hover { background: #eef7f1; }
.todo-list b { color: #173e2a; font-size: 16px; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; line-height: 1.6; }
@media (max-width: 1000px) { .stats-row, .grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px) { .stats-row, .grid { grid-template-columns: 1fr; } }
</style>
