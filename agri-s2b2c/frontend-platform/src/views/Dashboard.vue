<template>
  <div class="dashboard">
    <div class="page-head">
      <div>
        <h2>运营大盘</h2>
        <p>口径为 S2B2C 闭环交易（渠道订单 + 直购订单，排除已取消）；商品与类目主数据由交易撮合/主数据主责。</p>
      </div>
      <el-radio-group v-model="days" @change="load">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
        <el-radio-button :value="90">近 90 天</el-radio-button>
      </el-radio-group>
    </div>

    <div class="stats-row">
      <div class="stat-card"><span>GMV</span><b>¥{{ money(kpi.gmv) }}</b><small>{{ data.days || days }} 天内非取消订单</small></div>
      <div class="stat-card"><span>订单数</span><b>{{ kpi.orders || 0 }}</b><small>客单价 ¥{{ money(kpi.avgOrderAmount) }}</small></div>
      <div class="stat-card"><span>成交商家</span><b>{{ kpi.activeChannels || 0 }}</b><small>已审核渠道 {{ kpi.channels || 0 }}</small></div>
      <div class="stat-card"><span>在售商品</span><b>{{ kpi.products || 0 }}</b><small>供应商 {{ kpi.suppliers || 0 }}</small></div>
      <div class="stat-card"><span>买家数</span><b>{{ kpi.consumers || 0 }}</b><small>区间内下单去重</small></div>
      <div class="stat-card"><span>退款率</span><b>{{ Number(kpi.refundRate || 0).toFixed(2) }}%</b><small>已同意售后金额 / GMV</small></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>GMV / 订单趋势</h3><span class="muted">按日</span></div>
        <div ref="trendChart" class="chart" />
      </div>
      <div class="card">
        <div class="card-head"><h3>渠道等级分布</h3><span class="muted">GMV 取当前区间</span></div>
        <el-table :data="data.gradeDistribution || []" border size="small">
          <el-table-column label="等级" width="110">
            <template #default="{ row }">{{ gradeText(row.grade) }}</template>
          </el-table-column>
          <el-table-column prop="channels" label="渠道数" width="90" />
          <el-table-column label="GMV" width="120">
            <template #default="{ row }">¥{{ money(row.gmv) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.gradeDistribution || []).length" description="暂无渠道数据" :image-size="60" />
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>待办事项</h3></div>
        <ul class="todo-list">
          <li @click="$router.push('/channel-onboard')"><span>商家入驻审核</span><b>{{ todos.channelPending || 0 }}</b></li>
          <li @click="$router.push('/products')"><span>商品上架审核</span><b>{{ todos.productPending || 0 }}</b></li>
          <li @click="$router.push('/withdrawals')"><span>提现审批</span><b>{{ todos.withdrawalPending || 0 }}</b></li>
          <li @click="$router.push('/after-sales')"><span>售后待处理</span><b>{{ todos.afterSalePending || 0 }}</b></li>
        </ul>
      </div>
      <div class="card">
        <div class="card-head"><h3>热销商品 Top 5</h3><el-button link type="primary" @click="$router.push('/price-center')">价格与价盘</el-button></div>
        <el-table :data="data.topProducts || []" border size="small">
          <el-table-column prop="name" label="商品" min-width="180" />
          <el-table-column prop="qty" label="销量" width="90" />
          <el-table-column label="销售额" width="120">
            <template #default="{ row }">¥{{ money(row.amount) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.topProducts || []).length" description="区间内暂无成交" :image-size="60" />
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>订单状态分布</h3></div>
      <div class="status-grid">
        <div v-for="(count, key) in data.byStatus || {}" :key="key" class="status-item">
          <span>{{ statusText(key) }}</span><b>{{ count }}</b>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { platformApi } from '../api'

const days = ref(7)
const data = ref({})
const trendChart = ref(null)
let chart = null

const kpi = computed(() => data.value.kpi || {})
const todos = computed(() => data.value.todos || {})

onMounted(load)
onUnmounted(() => chart?.dispose())

async function load() {
  try {
    data.value = (await platformApi.getOverview(days.value)) || {}
    await nextTick()
    renderTrend()
  } catch (e) {
    ElMessage.error(e?.message || '运营大盘读取失败')
  }
}

function renderTrend() {
  if (!trendChart.value) return
  if (!chart) chart = echarts.init(trendChart.value)
  const trend = data.value.trend || []
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['GMV', '订单数'], top: 0, textStyle: { color: '#6b7c72', fontSize: 12 } },
    grid: { left: 50, right: 40, top: 32, bottom: 30 },
    xAxis: {
      type: 'category',
      data: trend.map((p) => p.date),
      axisLabel: { color: '#6b7c72', interval: Math.max(0, Math.floor(trend.length / 8) - 1) },
      axisLine: { lineStyle: { color: '#e3eae5' } },
    },
    yAxis: [
      { type: 'value', axisLabel: { color: '#6b7c72' }, splitLine: { lineStyle: { color: '#eef3ef' } } },
      { type: 'value', axisLabel: { color: '#6b7c72' }, splitLine: { show: false } },
    ],
    series: [
      { name: 'GMV', type: 'line', smooth: true, symbol: 'none', data: trend.map((p) => Number(p.amount || 0)),
        lineStyle: { color: '#12764a', width: 2 }, areaStyle: { color: 'rgba(18,118,74,0.12)' } },
      { name: '订单数', type: 'bar', yAxisIndex: 1, data: trend.map((p) => Number(p.orders || 0)),
        itemStyle: { color: 'rgba(23,108,147,0.35)', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
    ],
  }, true)
}

const money = (value) => Number(value || 0).toFixed(2)
const gradeText = (value) => ({ LEVEL_1: '铜牌', LEVEL_2: '银牌', LEVEL_3: '金牌' }[value] || value || '未定级')
const statusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value)
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 21px; }
.stat-card small { color: #94a198; font-size: var(--agri-font-size-micro); }
.grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
.chart { height: 280px; }
.todo-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.todo-list li { display: flex; justify-content: space-between; padding: 12px 14px; border-radius: 10px; background: #f6faf7; color: #52665a; font-size: 13px; cursor: pointer; }
.todo-list li:hover { background: #eef7f1; }
.todo-list b { color: #173e2a; font-size: 16px; }
.status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.status-item { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 10px; background: #f6faf7; color: #52665a; font-size: 13px; }
.status-item b { color: #173e2a; }
@media (max-width: 1200px) { .stats-row { grid-template-columns: repeat(3, 1fr); } .grid { grid-template-columns: 1fr; } }
</style>
