<template>
  <div class="dashboard">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrap user">👥</div>
        <div class="stat-info">
          <div class="stat-value">{{ userCount }}</div>
          <div class="stat-label">用户总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap device">📱</div>
        <div class="stat-info">
          <div class="stat-value">{{ deviceCount }}</div>
          <div class="stat-label">设备总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap alert">🔔</div>
        <div class="stat-info">
          <div class="stat-value">{{ alertCount }}</div>
          <div class="stat-label">待处理告警</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap gateway">🌐</div>
        <div class="stat-info">
          <div class="stat-value">{{ gatewayCount }}</div>
          <div class="stat-label">网关数量</div>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="card-header">
          <h3>用户增长趋势</h3>
        </div>
        <div ref="userChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <div class="card-header">
          <h3>设备在线率</h3>
        </div>
        <div ref="deviceChart" class="chart"></div>
      </div>
    </div>

    <div class="bottom-row">
      <div class="table-card">
        <div class="card-header">
          <h3>最新告警</h3>
          <a href="/alert" class="view-all">查看全部</a>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>设备名称</th>
              <th>告警类型</th>
              <th>级别</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="alert in alertList" :key="alert.id">
              <td>{{ alert.deviceName }}</td>
              <td>{{ alert.type }}</td>
              <td><span :class="['status-tag', alert.level]">{{ alert.level }}</span></td>
              <td>{{ alert.time }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-card">
        <div class="card-header">
          <h3>活跃用户</h3>
          <a href="/user" class="view-all">查看全部</a>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>设备数</th>
              <th>最后登录</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in userList" :key="user.id">
              <td>{{ user.name }}</td>
              <td>{{ user.deviceCount }}</td>
              <td>{{ user.lastLogin }}</td>
              <td><span :class="['status-tag', user.status]">{{ user.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'

const userCount = ref(1256)
const deviceCount = ref(5428)
const alertCount = ref(23)
const gatewayCount = ref(86)

const alertList = ref([
  { id: 1, deviceName: '温湿度传感器-001', type: '温度异常', level: '严重', time: '10分钟前' },
  { id: 2, deviceName: '灌溉控制器-004', type: '设备离线', level: '严重', time: '25分钟前' },
  { id: 3, deviceName: '土壤传感器-002', type: '湿度偏低', level: '警告', time: '40分钟前' },
  { id: 4, deviceName: '光照传感器-003', type: '光照不足', level: '警告', time: '1小时前' }
])

const userList = ref([
  { id: 1, name: '张三', deviceCount: 15, lastLogin: '10分钟前', status: '在线' },
  { id: 2, name: '李四', deviceCount: 8, lastLogin: '30分钟前', status: '在线' },
  { id: 3, name: '王五', deviceCount: 22, lastLogin: '1小时前', status: '离线' },
  { id: 4, name: '赵六', deviceCount: 5, lastLogin: '2小时前', status: '离线' }
])

onMounted(() => {
  initCharts()
})

const initCharts = () => {
  const userChart = echarts.init(document.querySelector('.charts-row .chart-card:first-child .chart'))
  userChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
    yAxis: { type: 'value' },
    series: [{
      name: '新增用户',
      type: 'bar',
      data: [120, 150, 180, 220, 190, 250],
      itemStyle: { color: '#4080ff', borderRadius: [4, 4, 0, 0] }
    }]
  })

  const deviceChart = echarts.init(document.querySelector('.charts-row .chart-card:last-child .chart'))
  deviceChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      name: '设备状态',
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: 4850, name: '在线', itemStyle: { color: '#52c41a' } },
        { value: 578, name: '离线', itemStyle: { color: '#ff4d4f' } }
      ],
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } }
    }]
  })

  window.addEventListener('resize', () => {
    userChart.resize()
    deviceChart.resize()
  })
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stat-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 16px;
}

.stat-icon-wrap.user { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon-wrap.device { background: linear-gradient(135deg, #4ecdc4 0%, #44a3a0 100%); }
.stat-icon-wrap.alert { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); }
.stat-icon-wrap.gateway { background: linear-gradient(135deg, #ffe66d 0%, #ffd93d 100%); }

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.view-all {
  color: #4080ff;
  font-size: 12px;
  text-decoration: none;
}

.chart {
  height: 240px;
}

.bottom-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.table-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead th {
  text-align: left;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #999;
  border-bottom: 1px solid #e8e8e8;
}

.data-table tbody td {
  padding: 12px 14px;
  font-size: 13px;
  color: #666;
  border-bottom: 1px solid #f5f5f5;
}

.status-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.严重 { background: #fff2f0; color: #ff4d4f; }
.status-tag.警告 { background: #fffbe6; color: #faad14; }
.status-tag.在线 { background: #f6ffed; color: #52c41a; }
.status-tag.离线 { background: #f5f5f5; color: #999; }
</style>