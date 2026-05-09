<template>
  <div class="dashboard">
    <div class="section-header">
      <h1 class="section-title">运营总览</h1>
      <p class="section-desc">数据概览与统计分析</p>
    </div>

    <div class="stats-cards">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-icon">{{ stat.icon }}</div>
        <div class="stat-content">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
        <div class="stat-trend" :class="stat.trend">
          {{ stat.change }}
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="chart-section">
        <div class="section-header small">
          <h3>租户活跃度趋势</h3>
          <select class="time-select">
            <option>本周</option>
            <option>本月</option>
            <option>本季度</option>
          </select>
        </div>
        <div class="activity-chart">
          <div class="chart-bars">
            <div v-for="(day, index) in activityData" :key="index" class="bar-item">
              <div class="bar-wrapper">
                <div class="bar-fill" :style="{ height: day.value + '%' }"></div>
              </div>
              <span class="bar-label">{{ day.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="card">
          <div class="card-header">
            <h3>数据质量评分</h3>
          </div>
          <div class="quality-pie">
            <div class="pie-chart">
              <div class="pie-circle"></div>
              <div class="pie-center">
                <span class="pie-value">85</span>
                <span class="pie-unit">分</span>
              </div>
            </div>
            <div class="pie-legend">
              <div class="legend-item">
                <span class="legend-dot good"></span>
                <span>优质 75%</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot medium"></span>
                <span>中等 15%</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot poor"></span>
                <span>待优化 10%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>待审核事项</h3>
            <button class="view-all">查看全部</button>
          </div>
          <div class="audit-list">
            <div v-for="item in pendingAudits" :key="item.id" class="audit-item">
              <span class="audit-icon">{{ item.icon }}</span>
              <div class="audit-info">
                <span class="audit-title">{{ item.title }}</span>
                <span class="audit-time">{{ item.time }}</span>
              </div>
              <button class="audit-action">审核</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-section">
      <div class="card wide">
        <div class="card-header">
          <h3>系统告警</h3>
          <button class="view-all">查看全部</button>
        </div>
        <div class="alert-table">
          <table>
            <thead>
              <tr>
                <th>级别</th>
                <th>消息</th>
                <th>模块</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="alert in alerts" :key="alert.id">
                <td><span class="alert-badge" :class="alert.level">{{ alert.level }}</span></td>
                <td>{{ alert.message }}</td>
                <td>{{ alert.module }}</td>
                <td>{{ alert.time }}</td>
                <td><button class="handle-btn">处理</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getDashboard } from '../utils/api'

const stats = reactive([
  { label: '租户总数', value: '128', icon: '🏢', change: '+12.5%', trend: 'up' },
  { label: '用户总数', value: '3,542', icon: '👥', change: '+8.3%', trend: 'up' },
  { label: '组织总数', value: '567', icon: '🏠', change: '+5.2%', trend: 'up' },
  { label: '商品总数', value: '8,934', icon: '📦', change: '-2.1%', trend: 'down' }
])

const activityData = [
  { label: '周一', value: 65 },
  { label: '周二', value: 78 },
  { label: '周三', value: 82 },
  { label: '周四', value: 71 },
  { label: '周五', value: 85 },
  { label: '周六', value: 45 },
  { label: '周日', value: 38 }
]

const pendingAudits = [
  { id: 1, title: '用户张三实名认证审核', icon: '👤', time: '10分钟前' },
  { id: 2, title: '组织XX公司资质审核', icon: '🏠', time: '30分钟前' },
  { id: 3, title: '用户李四企业认证审核', icon: '👤', time: '1小时前' },
  { id: 4, title: '商品有机认证审核', icon: '📦', time: '2小时前' }
]

const alerts = [
  { id: 1, level: 'error', message: '租户T001数据同步失败', time: '5分钟前', module: '数据分发' },
  { id: 2, level: 'warning', message: '数据质量评分低于阈值', time: '15分钟前', module: '数据质量' },
  { id: 3, level: 'info', message: '新租户注册成功', time: '30分钟前', module: '租户管理' },
  { id: 4, level: 'warning', message: 'API调用次数接近上限', time: '1小时前', module: '系统监控' }
]

onMounted(() => {
  loadData()
})

const loadData = async () => {
  try {
    const response = await getDashboard()
    if (response.code === 200 && response.data) {
      const data = response.data
      if (data.tenantCount !== undefined) stats[0].value = data.tenantCount.toString()
      if (data.userCount !== undefined) stats[1].value = data.userCount.toString()
      if (data.orgCount !== undefined) stats[2].value = data.orgCount.toString()
      if (data.productCount !== undefined) stats[3].value = data.productCount.toString()
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.section-header {
  margin-bottom: 24px;
}

.section-header.small {
  margin-bottom: 16px;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.section-desc {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
}

.stat-label {
  font-size: 13px;
  color: #a0aec0;
}

.stat-trend {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 12px;
}

.stat-trend.up {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.stat-trend.down {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.chart-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.time-select {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
}

.activity-chart {
  padding-top: 20px;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 200px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-wrapper {
  width: 32px;
  height: 160px;
  background: #f0f0f0;
  border-radius: 4px;
  display: flex;
  align-items: flex-end;
  margin-bottom: 8px;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #238636 0%, #2ea043 100%);
  border-radius: 4px;
  transition: height 0.3s ease;
}

.bar-label {
  font-size: 12px;
  color: #a0aec0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card.wide {
  grid-column: span 2;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.view-all {
  font-size: 12px;
  color: #238636;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.view-all:hover {
  background: rgba(35, 134, 54, 0.1);
}

.quality-pie {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  padding: 20px 0;
}

.pie-chart {
  position: relative;
  width: 120px;
  height: 120px;
}

.pie-circle {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    #238636 0deg 270deg,
    #d29922 270deg 324deg,
    #da3633 324deg 360deg
  );
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.pie-value {
  font-size: 28px;
  font-weight: 700;
  color: #238636;
}

.pie-unit {
  font-size: 12px;
  color: #a0aec0;
  margin-left: 2px;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4a5568;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.good {
  background: #238636;
}

.legend-dot.medium {
  background: #d29922;
}

.legend-dot.poor {
  background: #da3633;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.audit-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(35, 134, 54, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.audit-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.audit-title {
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
}

.audit-time {
  font-size: 11px;
  color: #a0aec0;
}

.audit-action {
  font-size: 12px;
  color: #238636;
  background: rgba(35, 134, 54, 0.1);
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.audit-action:hover {
  background: #238636;
  color: #fff;
}

.bottom-section {
  display: grid;
  grid-template-columns: 1fr;
}

.alert-table {
  overflow-x: auto;
}

.alert-table table {
  width: 100%;
  border-collapse: collapse;
}

.alert-table th,
.alert-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.alert-table th {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
}

.alert-table td {
  font-size: 13px;
  color: #2d3748;
}

.alert-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 12px;
}

.alert-badge.error {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.alert-badge.warning {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.alert-badge.info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.handle-btn {
  font-size: 12px;
  color: #238636;
  background: rgba(35, 134, 54, 0.1);
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.handle-btn:hover {
  background: #238636;
  color: #fff;
}
</style>
