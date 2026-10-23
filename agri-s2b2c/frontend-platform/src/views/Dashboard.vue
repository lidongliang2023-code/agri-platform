<template>
  <div class="dashboard">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon suppliers">🏭</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.supplierCount || 0 }}</p>
          <p class="stat-label">供应商数量</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon channels">🤝</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.channelCount || 0 }}</p>
          <p class="stat-label">渠道商数量</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon products">🥬</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.productCount || 0 }}</p>
          <p class="stat-label">商品数量</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orders">📦</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.orderCount || 0 }}</p>
          <p class="stat-label">订单数量</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon consumers">👥</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.consumerCount || 0 }}</p>
          <p class="stat-label">消费者数量</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon revenue">💰</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.totalAmount || 0 }}</p>
          <p class="stat-label">交易总额(元)</p>
        </div>
      </div>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <h3>交易趋势</h3>
        <div ref="revenueChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <h3>订单状态分布</h3>
        <div ref="orderChart" class="chart"></div>
      </div>
    </div>
    <div class="audit-section">
      <h3>待审核事项</h3>
      <div class="audit-row">
        <div class="audit-card" @click="goToAudit('suppliers')">
          <div class="audit-icon">🏭</div>
          <div class="audit-info">
            <p class="audit-count">2</p>
            <p class="audit-label">供应商待审核</p>
          </div>
        </div>
        <div class="audit-card" @click="goToAudit('channel-partners')">
          <div class="audit-icon">🤝</div>
          <div class="audit-info">
            <p class="audit-count">1</p>
            <p class="audit-label">渠道商待审核</p>
          </div>
        </div>
        <div class="audit-card" @click="goToAudit('products')">
          <div class="audit-icon">🥬</div>
          <div class="audit-info">
            <p class="audit-count">5</p>
            <p class="audit-label">商品待审核</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { platformApi } from '../api'

const router = useRouter()
const dashboard = ref({})
const revenueChart = ref(null)
const orderChart = ref(null)

onMounted(() => {
  loadData()
})

const loadData = async () => {
  const res = await platformApi.getDashboard()
  dashboard.value = res
  initCharts()
}

const initCharts = () => {
  if (revenueChart.value) {
    const chart = echarts.init(revenueChart.value)
    chart.setOption({
      xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
      yAxis: { type: 'value' },
      series: [{
        data: [120000, 150000, 180000, 220000, 190000, 250000],
        type: 'line',
        smooth: true
      }]
    })
  }
  if (orderChart.value) {
    const chart = echarts.init(orderChart.value)
    chart.setOption({
      series: [{
        type: 'pie',
        data: [
          { value: 30, name: '待付款' },
          { value: 20, name: '待发货' },
          { value: 40, name: '已发货' },
          { value: 10, name: '已完成' }
        ]
      }]
    })
  }
}

const goToAudit = (path) => {
  router.push(`/${path}`)
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.stat-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border-radius: 12px;
  margin-right: 15px;
}

.stat-icon.suppliers {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.channels {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.products {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-icon.orders {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.consumers {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-icon.revenue {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.chart-card h3 {
  font-size: 16px;
  margin-bottom: 20px;
}

.chart {
  height: 250px;
}

.audit-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.audit-section h3 {
  font-size: 16px;
  margin-bottom: 20px;
}

.audit-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.audit-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 12px;
  cursor: pointer;
}

.audit-icon {
  font-size: 32px;
  margin-right: 15px;
}

.audit-count {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.audit-label {
  font-size: 14px;
  color: #666;
}
</style>