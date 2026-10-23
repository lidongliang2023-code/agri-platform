<template>
  <div class="dashboard">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon sales">📈</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.sales || 0 }}</p>
          <p class="stat-label">本月销售额(元)</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orders">📦</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.orderCount || 0 }}</p>
          <p class="stat-label">本月订单数</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon products">🥬</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.productCount || 0 }}</p>
          <p class="stat-label">在售商品数</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon pending">⏳</div>
        <div class="stat-info">
          <p class="stat-value">{{ dashboard.pendingOrders || 0 }}</p>
          <p class="stat-label">待发货订单</p>
        </div>
      </div>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <h3>销售趋势</h3>
        <div ref="salesChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <h3>订单状态分布</h3>
        <div ref="orderChart" class="chart"></div>
      </div>
    </div>
    <div class="recent-orders">
      <h3>最近订单</h3>
      <el-table :data="recentOrders" border>
        <el-table-column prop="orderNo" label="订单号" />
        <el-table-column prop="createTime" label="下单时间" />
        <el-table-column prop="payAmount" label="金额" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button type="text" @click="goDetail(row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
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
const recentOrders = ref([])
const salesChart = ref(null)
const orderChart = ref(null)

onMounted(() => {
  loadData()
})

const loadData = async () => {
  const [dashRes, orderRes] = await Promise.all([
    platformApi.getDashboard(),
    platformApi.getOrders({ page: 1, size: 10 })
  ])
  dashboard.value = dashRes
  recentOrders.value = orderRes.records || []
  initCharts()
}

const initCharts = () => {
  if (salesChart.value) {
    const chart = echarts.init(salesChart.value)
    chart.setOption({
      xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
      yAxis: { type: 'value' },
      series: [{
        data: [12000, 15000, 18000, 22000, 19000, 25000],
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

const getStatusType = (status) => {
  const types = { 'PENDING_PAY': 'warning', 'PENDING_SHIP': 'info', 'SHIPPED': 'primary', 'COMPLETED': 'success' }
  return types[status] || 'default'
}

const goDetail = (id) => {
  router.push(`/order-detail/${id}`)
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
  grid-template-columns: repeat(4, 1fr);
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

.stat-icon.sales {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.orders {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.products {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-icon.pending {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
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

.recent-orders {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.recent-orders h3 {
  font-size: 16px;
  margin-bottom: 20px;
}
</style>