<template>
  <div class="reports-page">
    <div class="page-head">
      <div>
        <h2>数据报表中心</h2>
        <p>交易 / 类目 / 渠道 / 营销 / 履约 / 财务六类主题汇总；数据来自 S2B2C 订单、佣金与售后，不含外部支付流水。</p>
      </div>
      <div class="head-actions">
        <el-radio-group v-model="days" @change="load">
          <el-radio-button :value="7">近 7 天</el-radio-button>
          <el-radio-button :value="30">近 30 天</el-radio-button>
          <el-radio-button :value="90">近 90 天</el-radio-button>
        </el-radio-group>
        <el-button @click="$router.push('/')">运营大盘</el-button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>GMV</span><b>¥{{ money(summary.gmv) }}</b><small>{{ data.days || days }} 天非取消订单</small></div>
      <div class="stat-card"><span>订单量</span><b>{{ summary.orders || 0 }}</b><small>客单 ¥{{ money(summary.avgOrderAmount) }}</small></div>
      <div class="stat-card"><span>买家数</span><b>{{ summary.consumers || 0 }}</b><small>去重消费者</small></div>
      <div class="stat-card"><span>退款率</span><b>{{ Number(summary.refundRate || 0).toFixed(2) }}%</b><small>售后金额 / GMV</small></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>GMV / 订单趋势</h3></div>
        <div ref="trendChart" class="chart" />
      </div>
      <div class="card">
        <div class="card-head"><h3>类目销售构成</h3></div>
        <div ref="categoryChart" class="chart" />
      </div>
    </div>

    <div class="grid">
      <AgriElementListTable
        :columns="channelColumns"
        :data="data.channelRanking || []"
        :row-key="(row) => String(row.channelId ?? row.channelName)"
        :loading="loading"
        client-pagination
        :page-size="10"
        column-settings-storage-key="agri-s2b2c-platform:reports-channel-ranking"
        empty-text="区间内没有渠道成交"
        @refresh="load"
      >
        <template #toolbar-left><h3 class="inline-title">渠道销售排行 Top 10</h3></template>
        <template #cell-rank="{ index }">{{ index + 1 }}</template>
        <template #cell-gmv="{ row }">¥{{ money(row.gmv) }}</template>
      </AgriElementListTable>

      <AgriElementListTable
        :columns="productColumns"
        :data="data.topProducts || []"
        :row-key="(row) => String(row.productId ?? row.name)"
        :loading="loading"
        client-pagination
        :page-size="10"
        column-settings-storage-key="agri-s2b2c-platform:reports-top-products"
        empty-text="区间内没有成交商品"
        @refresh="load"
      >
        <template #toolbar-left><h3 class="inline-title">商品销售 Top 5</h3></template>
        <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      </AgriElementListTable>
    </div>

    <div class="grid three">
      <div class="card">
        <h3>履约质量</h3>
        <dl class="descs">
          <dt>待发货</dt><dd>{{ fulfillment.pendingShip || 0 }}</dd>
          <dt>在途 / 待收货</dt><dd>{{ fulfillment.shipped || 0 }}</dd>
          <dt>已完成</dt><dd>{{ fulfillment.completed || 0 }}</dd>
          <dt>已取消</dt><dd>{{ fulfillment.cancelled || 0 }}</dd>
          <dt>售后待处理</dt><dd>{{ fulfillment.afterSalePending || 0 }}</dd>
        </dl>
      </div>
      <div class="card">
        <h3>财务概览</h3>
        <dl class="descs">
          <dt>已结算佣金</dt><dd>¥{{ money(finance.commissionSettled) }}</dd>
          <dt>待结算佣金</dt><dd>¥{{ money(finance.commissionPending) }}</dd>
          <dt>已打款提现</dt><dd>¥{{ money(finance.withdrawalPaid) }}</dd>
          <dt>结算批次</dt><dd>{{ finance.settlementBatches || 0 }} 批 / ¥{{ money(finance.settlementAmount) }}</dd>
        </dl>
      </div>
      <div class="card">
        <h3>营销概况（当前存量）</h3>
        <dl class="descs">
          <dt>进行中券种</dt><dd>{{ marketing.couponActive || 0 }}</dd>
          <dt>累计领取 / 核销</dt><dd>{{ marketing.couponReceived || 0 }} / {{ marketing.couponUsed || 0 }}</dd>
          <dt>进行中秒杀</dt><dd>{{ marketing.flashActive || 0 }}</dd>
          <dt>进行中拼团</dt><dd>{{ marketing.groupActive || 0 }}</dd>
        </dl>
        <p class="note">活动未与订单归因，营销 GMV/ROI 暂无法统计。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { AgriElementListTable } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const days = ref(30)
const data = ref({})
const loading = ref(false)
const summary = ref({})
const fulfillment = ref({})
const finance = ref({})
const marketing = ref({})
const trendChart = ref(null)
const categoryChart = ref(null)
let trendInstance = null
let categoryInstance = null

const channelColumns = [
  { key: 'rank', label: '#', width: 60 },
  { key: 'channelName', prop: 'channelName', label: '渠道', minWidth: 160 },
  { key: 'orders', prop: 'orders', label: '订单', width: 90 },
  { key: 'gmv', prop: 'gmv', label: 'GMV', width: 120 },
]

const productColumns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 160 },
  { key: 'qty', prop: 'qty', label: '销量', width: 90 },
  { key: 'amount', prop: 'amount', label: '销售额', width: 120 },
]

onMounted(load)
onUnmounted(() => {
  trendInstance?.dispose()
  categoryInstance?.dispose()
})

async function load() {
  loading.value = true
  try {
    data.value = (await platformApi.getReports(days.value)) || {}
    summary.value = data.value.summary || {}
    fulfillment.value = data.value.fulfillment || {}
    finance.value = data.value.finance || {}
    marketing.value = data.value.marketing || {}
    await nextTick()
    renderTrend()
    renderCategory()
  } catch (e) {
    ElMessage.error(e?.message || '报表数据读取失败')
  } finally {
    loading.value = false
  }
}

function renderTrend() {
  if (!trendChart.value) return
  if (!trendInstance) trendInstance = echarts.init(trendChart.value)
  const trend = data.value.trend || []
  trendInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['GMV', '订单数'], top: 0, textStyle: { color: '#6b7c72', fontSize: 12 } },
    grid: { left: 50, right: 40, top: 30, bottom: 28 },
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

function renderCategory() {
  if (!categoryChart.value) return
  if (!categoryInstance) categoryInstance = echarts.init(categoryChart.value)
  const rows = data.value.categoryShare || []
  categoryInstance.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6b7c72', fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      label: { color: '#52665a', fontSize: 12 },
      data: rows.map((row) => ({ name: row.name, value: Number(row.amount || 0) })),
    }],
  }, true)
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.head-actions { display: flex; gap: 10px; align-items: center; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.grid.three { grid-template-columns: repeat(3, 1fr); }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.inline-title { margin: 0; font-size: 15px; color: #173e2a; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; }
.chart { height: 280px; }
.descs { display: grid; grid-template-columns: 110px 1fr; gap: 10px 12px; margin: 0; font-size: 13px; }
.descs dt { color: #84938a; }
.descs dd { margin: 0; color: #173e2a; }
.note { margin: 10px 0 0; color: #84938a; font-size: 12px; }
@media (max-width: 1200px) { .stat-row { grid-template-columns: repeat(2, 1fr); } .grid, .grid.three { grid-template-columns: 1fr; } }
</style>
