<template>
  <div class="analytics-page">
    <div class="page-head">
      <div>
        <h2>经营数据分析</h2>
        <p>基于本渠道订单与佣金数据汇总；流量、加购与转化漏斗依赖埋点，当前未接入，页面不做估算。</p>
      </div>
      <el-radio-group v-model="days" @change="load">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
        <el-radio-button :value="90">近 90 天</el-radio-button>
      </el-radio-group>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>销售额</span><b>¥{{ money(data.sales) }}</b><small>{{ days }} 天内非取消订单</small></div>
      <div class="stat-card"><span>订单数</span><b>{{ data.orders || 0 }}</b><small>已支付口径</small></div>
      <div class="stat-card"><span>客单价</span><b>¥{{ money(data.avgOrderAmount) }}</b><small>销售额 / 订单数</small></div>
      <div class="stat-card"><span>佣金（已结算 / 待结算）</span><b>¥{{ money(data.commissionSettled) }}</b><small>待结算 ¥{{ money(data.commissionPending) }}</small></div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>销售走势</h3>
        <div ref="trendChart" class="chart" />
      </div>
      <div class="card">
        <h3>商品销售排行 Top 5</h3>
        <el-table :data="data.topProducts || []" border size="small">
          <el-table-column prop="name" label="商品" min-width="180" />
          <el-table-column prop="qty" label="销量" width="90" />
          <el-table-column label="销售额" width="110">
            <template #default="{ row }">¥{{ money(row.amount) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.topProducts || []).length" description="区间内暂无成交" :image-size="60" />
      </div>
    </div>

    <div class="card">
      <h3>订单状态分布</h3>
      <div class="status-grid">
        <div v-for="(count, key) in data.byStatus || {}" :key="key" class="status-item">
          <span>{{ statusText(key) }}</span><b>{{ count }}</b>
        </div>
      </div>
      <p class="note">转化漏斗（访问 → 浏览 → 加购 → 下单 → 支付）需要商城埋点数据，当前未接入；不展示推测值。</p>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const days = ref(30)
const data = ref({})
const trendChart = ref(null)
let chart = null

onMounted(load)
onUnmounted(() => chart?.dispose())

async function load() {
  try {
    data.value = (await channelApi.getAnalytics(days.value)) || {}
    await nextTick()
    renderTrend()
  } catch (e) {
    ElMessage.error(e?.message || '经营分析读取失败')
  }
}

function renderTrend() {
  if (!trendChart.value) return
  if (!chart) chart = echarts.init(trendChart.value)
  const trend = data.value.trend || []
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: trend.map((p) => p.date),
      axisLabel: { color: '#6b7c72', interval: Math.max(0, Math.floor(trend.length / 8) - 1) },
      axisLine: { lineStyle: { color: '#e3eae5' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7c72' },
      splitLine: { lineStyle: { color: '#eef3ef' } },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: trend.map((p) => Number(p.amount || 0)),
      areaStyle: { color: 'rgba(18,118,74,0.12)' },
      lineStyle: { color: '#12764a', width: 2 },
    }],
  }, true)
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value)
</script>

<style scoped>
.analytics-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.chart { height: 300px; }
.status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.status-item { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 10px; background: #f6faf7; color: #52665a; font-size: 13px; }
.status-item b { color: #173e2a; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .grid, .stat-row { grid-template-columns: 1fr; } }
</style>
