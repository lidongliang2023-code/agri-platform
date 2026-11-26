<template>
  <div class="analytics-page">
    <div class="page-head">
      <div>
        <h2>分销动销分析</h2>
        <p>基于供应商归属订单的成交与商品动销；渠道经营与转化漏斗归商家/消费者端，本页不做跨渠道推断。</p>
      </div>
      <el-radio-group v-model="days" @change="load">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
        <el-radio-button :value="90">近 90 天</el-radio-button>
      </el-radio-group>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>订单</span><b>{{ kpi.orders || 0 }}</b><small>{{ data.days || days }} 天</small></div>
      <div class="stat-card"><span>渠道 GMV</span><b>¥{{ money(kpi.gmv) }}</b><small>按实付</small></div>
      <div class="stat-card"><span>客单价</span><b>¥{{ money(kpi.avgOrderAmount) }}</b><small>GMV / 订单</small></div>
      <div class="stat-card"><span>供货收入（估）</span><b>¥{{ money(kpi.supplyRevenue) }}</b><small>当前供货价</small></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>成交走势</h3></div>
        <div ref="trendChart" class="chart" />
      </div>
      <AgriElementListTable
        :columns="topProductColumns"
        :data="data.topProducts || []"
        :row-key="(row) => String(row.productId ?? row.name)"
        :loading="loading"
        client-pagination
        :page-size="10"
        column-settings-storage-key="agri-s2b2c-platform:supply-analytics-products"
        empty-text="区间内暂无动销"
        @refresh="load"
      >
        <template #toolbar-left><h3 class="inline-title">商品动销 Top 5</h3></template>
        <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      </AgriElementListTable>
    </div>

    <AgriElementListTable
      :columns="channelColumns"
      :data="data.channelRanking || []"
      :row-key="(row) => String(row.channelId ?? row.channelName)"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:supply-analytics-channels"
      empty-text="区间内暂无渠道成交"
      @refresh="load"
    >
      <template #toolbar-left><h3 class="inline-title">渠道贡献排行</h3></template>
      <template #cell-gmv="{ row }">¥{{ money(row.gmv) }}</template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions
          v-if="row.channelId"
          :actions="[{ key: 'profile', label: '画像', onClick: () => $router.push(`/supply/distributor-detail/${row.channelId}`) }]"
        />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { AgriElementListTable, AgriVueRowActions } from '@agri/shared/vue/element'
import { supplierApi } from '../api'

const days = ref(30)
const data = ref({})
const loading = ref(false)
const trendChart = ref(null)
let chart = null
const kpi = computed(() => data.value.kpi || {})

const topProductColumns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 160 },
  { key: 'qty', prop: 'qty', label: '销量', width: 90 },
  { key: 'amount', prop: 'amount', label: '销售额', width: 120 },
]

const channelColumns = [
  { key: 'channelName', prop: 'channelName', label: '渠道', minWidth: 180 },
  { key: 'orders', prop: 'orders', label: '订单', width: 100 },
  { key: 'gmv', prop: 'gmv', label: 'GMV', width: 140 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)
onUnmounted(() => chart?.dispose())

async function load() {
  loading.value = true
  try {
    data.value = (await supplierApi.getOverview(days.value)) || {}
    await nextTick()
    renderTrend()
  } catch (e) {
    ElMessage.error(e?.message || '动销数据读取失败')
  } finally {
    loading.value = false
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
      {
        name: 'GMV', type: 'line', smooth: true, symbol: 'none', data: trend.map((p) => Number(p.amount || 0)),
        lineStyle: { color: '#2d8f4e', width: 2 }, areaStyle: { color: 'rgba(18,118,74,0.12)' },
      },
      {
        name: '订单数', type: 'bar', yAxisIndex: 1, data: trend.map((p) => Number(p.orders || 0)),
        itemStyle: { color: 'rgba(23,108,147,0.35)', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14,
      },
    ],
  }, true)
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.analytics-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.inline-title { margin: 0; font-size: 15px; color: #173e2a; }
.chart { height: 280px; }
@media (max-width: 1000px) { .stat-row, .grid { grid-template-columns: 1fr; } }
</style>
