<template>
  <div class="dashboard">
    <div class="page-head">
      <div>
        <h2>分销总览</h2>
        <p>商品由你供货、渠道负责分销；供货收入按当前供货价估算，最终以交易撮合合同与财务结算为准。</p>
      </div>
      <el-radio-group v-model="days" @change="load">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
        <el-radio-button :value="90">近 90 天</el-radio-button>
      </el-radio-group>
    </div>

    <div class="stats-row">
      <div class="stat-card"><span>分销订单</span><b>{{ kpi.orders || 0 }}</b><small>非取消订单</small></div>
      <div class="stat-card"><span>渠道 GMV</span><b>¥{{ money(kpi.gmv) }}</b><small>按订单实付</small></div>
      <div class="stat-card"><span>供货收入（估）</span><b>¥{{ money(kpi.supplyRevenue) }}</b><small>当前供货价 × 数量</small></div>
      <div class="stat-card"><span>在售商品</span><b>{{ kpi.products || 0 }}</b><small>待审核 {{ kpi.pendingProducts || 0 }}</small></div>
      <div class="stat-card"><span>待发货</span><b>{{ kpi.pendingShip || 0 }}</b><small>需及时履约</small></div>
      <div class="stat-card"><span>合作渠道</span><b>{{ kpi.channels || 0 }}</b><small>有授权关系</small></div>
      <div class="stat-card"><span>低库存商品</span><b>{{ kpi.lowStock || 0 }}</b><small>库存 &lt; 10</small></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>分销成交趋势</h3></div>
        <div ref="trendChart" class="chart" />
      </div>
      <div class="card">
        <div class="card-head"><h3>渠道销售排行</h3><el-button link type="primary" @click="$router.push('/distributors')">分销网络</el-button></div>
        <el-table :data="data.channelRanking || []" border size="small">
          <el-table-column prop="channelName" label="渠道" min-width="150" />
          <el-table-column prop="orders" label="订单" width="80" />
          <el-table-column label="GMV" width="110"><template #default="{ row }">¥{{ money(row.gmv) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!(data.channelRanking || []).length" description="暂无渠道成交" :image-size="60" />
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>热销商品 Top 5</h3><el-button link type="primary" @click="$router.push('/analytics')">动销分析</el-button></div>
      <el-table :data="data.topProducts || []" border size="small">
        <el-table-column prop="name" label="商品" min-width="200" />
        <el-table-column prop="qty" label="销量" width="90" />
        <el-table-column label="销售额" width="120"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
      </el-table>
      <el-empty v-if="!(data.topProducts || []).length" description="区间内暂无成交" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { supplierApi } from '../api'

const days = ref(30)
const data = ref({})
const trendChart = ref(null)
let chart = null
const kpi = computed(() => data.value.kpi || {})

onMounted(load)
onUnmounted(() => chart?.dispose())

async function load() {
  try {
    data.value = (await supplierApi.getOverview(days.value)) || {}
    await nextTick()
    renderTrend()
  } catch (e) {
    ElMessage.error(e?.message || '分销总览读取失败')
  }
}

function renderTrend() {
  if (!trendChart.value) return
  if (!chart) chart = echarts.init(trendChart.value)
  const trend = data.value.trend || []
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['GMV', '订单数'], top: 0, textStyle: { color: '#6b7c72', fontSize: 12 } },
    grid: { left: 48, right: 38, top: 30, bottom: 28 },
    xAxis: { type: 'category', data: trend.map((p) => p.date),
      axisLabel: { color: '#6b7c72', interval: Math.max(0, Math.floor(trend.length / 8) - 1) },
      axisLine: { lineStyle: { color: '#e3eae5' } } },
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
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stats-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 14px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 19px; }
.stat-card small { color: #94a198; font-size: var(--agri-font-size-micro); }
.grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.chart { height: 280px; }
@media (max-width: 1200px) { .stats-row { grid-template-columns: repeat(3, 1fr); } .grid { grid-template-columns: 1fr; } }
</style>
