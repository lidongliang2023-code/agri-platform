<template>
  <div class="dashboard">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📱</div>
        <div class="stat-info">
          <div class="stat-value">{{ deviceCount }}</div>
          <div class="stat-label">设备总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📶</div>
        <div class="stat-info">
          <div class="stat-value">{{ onlineCount }}</div>
          <div class="stat-label">在线设备</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔔</div>
        <div class="stat-info">
          <div class="stat-value">{{ alertCount }}</div>
          <div class="stat-label">告警数量</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-info">
          <div class="stat-value">{{ groupCount }}</div>
          <div class="stat-label">设备分组</div>
        </div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="card-header">
          <h3>设备在线率</h3>
          <select class="time-select">
            <option>今日</option>
            <option>本周</option>
            <option>本月</option>
          </select>
        </div>
        <div ref="onlineChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <div class="card-header">
          <h3>告警趋势</h3>
          <select class="time-select">
            <option>今日</option>
            <option>本周</option>
            <option>本月</option>
          </select>
        </div>
        <div ref="alertChart" class="chart"></div>
      </div>
    </div>

    <div class="bottom-row">
      <div class="table-card">
        <div class="card-header">
          <h3>最新告警</h3>
          <a href="/alert/list" class="view-all">查看全部</a>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>告警类型</th>
                <th>级别</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="alert in alertList" :key="alert.id">
                <td>{{ alert.deviceName }}</td>
                <td>{{ alert.alertType }}</td>
                <td>
                  <span :class="['status-tag', alert.level.toLowerCase()]">{{ alert.level }}</span>
                </td>
                <td>{{ alert.createTime }}</td>
                <td>
                  <button class="action-btn">处理</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="table-card">
        <div class="card-header">
          <h3>设备状态</h3>
          <a href="/device/list" class="view-all">查看全部</a>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>设备编号</th>
                <th>状态</th>
                <th>最后在线</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in deviceList" :key="device.id">
                <td>{{ device.deviceName }}</td>
                <td>{{ device.deviceCode }}</td>
                <td>
                  <span :class="['status-tag', device.status.toLowerCase()]">{{ device.status }}</span>
                </td>
                <td>{{ device.lastOnline }}</td>
                <td>
                  <button class="action-btn">详情</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'

const deviceCount = ref(156)
const onlineCount = ref(142)
const alertCount = ref(12)
const groupCount = ref(8)

const alertList = ref([
  { id: 1, deviceName: '温湿度传感器-001', alertType: '温度异常', level: '严重', createTime: '2024-01-15 10:30:00' },
  { id: 2, deviceName: '土壤湿度传感器-002', alertType: '湿度偏低', level: '警告', createTime: '2024-01-15 10:25:00' },
  { id: 3, deviceName: '光照传感器-003', alertType: '光照不足', level: '警告', createTime: '2024-01-15 10:20:00' },
  { id: 4, deviceName: '灌溉控制器-004', alertType: '设备离线', level: '严重', createTime: '2024-01-15 10:15:00' }
])

const deviceList = ref([
  { id: 1, deviceName: '温湿度传感器-001', deviceCode: 'D001', status: '在线', lastOnline: '刚刚' },
  { id: 2, deviceName: '土壤湿度传感器-002', deviceCode: 'D002', status: '在线', lastOnline: '1分钟前' },
  { id: 3, deviceName: '光照传感器-003', deviceCode: 'D003', status: '离线', lastOnline: '10分钟前' },
  { id: 4, deviceName: '灌溉控制器-004', deviceCode: 'D004', status: '在线', lastOnline: '刚刚' }
])

onMounted(() => {
  initCharts()
})

const initCharts = () => {
  const onlineChart = echarts.init(document.querySelector('.charts-row .chart-card:first-child .chart'))
  onlineChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 10, left: 'center' },
    series: [{
      name: '设备状态',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      data: [
        { value: onlineCount.value, name: '在线', itemStyle: { color: '#52c41a' } },
        { value: deviceCount.value - onlineCount.value, name: '离线', itemStyle: { color: '#ff4d4f' } }
      ]
    }]
  })

  const alertChart = echarts.init(document.querySelector('.charts-row .chart-card:last-child .chart'))
  alertChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
    yAxis: { type: 'value' },
    series: [{
      name: '告警数量',
      type: 'line',
      smooth: true,
      data: [120, 132, 101, 134, 190, 230],
      lineStyle: { color: '#ff7d00', width: 3 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255, 125, 0, 0.3)' }, { offset: 1, color: 'rgba(255, 125, 0, 0.05)' }]) },
      itemStyle: { color: '#ff7d00' }
    }]
  })

  window.addEventListener('resize', () => {
    onlineChart.resize()
    alertChart.resize()
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
  background: var(--bg-card);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  padding: 20px;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: var(--bg-card);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  padding: 20px;
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
  color: var(--text-primary);
}

.time-select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
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
  background: var(--bg-card);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  padding: 20px;
}

.view-all {
  color: var(--primary-color);
  font-size: 12px;
  text-decoration: none;
}

.view-all:hover {
  text-decoration: underline;
}

.table-wrapper {
  overflow-x: auto;
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
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
}

.data-table tbody td {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.status-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.在线 { background: #f6ffed; color: #52c41a; }
.status-tag.离线 { background: #fff2f0; color: #ff4d4f; }
.status-tag.严重 { background: #fff2f0; color: #ff4d4f; }
.status-tag.警告 { background: #fffbe6; color: #faad14; }
.status-tag.提示 { background: #e6f7ff; color: #1890ff; }

.action-btn {
  background: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--primary-color);
  color: white;
}
</style>