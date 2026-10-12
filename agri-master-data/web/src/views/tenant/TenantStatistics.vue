<template>
  <div class="tenant-statistics">
    <div class="page-header">
      <div class="header-left">
        <h1>租户数据统计</h1>
        <p>租户数据分析与对比报表</p>
      </div>
      <div class="date-filter">
        <select v-model="dateRange" class="date-select">
          <option value="7d">近7天</option>
          <option value="30d">近30天</option>
          <option value="90d">近90天</option>
          <option value="1y">近一年</option>
        </select>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🏢</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalTenants }}</div>
          <div class="stat-label">租户总数</div>
        </div>
        <div class="stat-trend up">+12.5%</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalUsers.toLocaleString() }}</div>
          <div class="stat-label">用户总数</div>
        </div>
        <div class="stat-trend up">+8.3%</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.activeRate }}%</div>
          <div class="stat-label">活跃率</div>
        </div>
        <div class="stat-trend up">+2.1%</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-info">
          <div class="stat-value">¥{{ stats.revenue.toLocaleString() }}</div>
          <div class="stat-label">月收入</div>
        </div>
        <div class="stat-trend up">+15.7%</div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-card">
        <div class="chart-header">
          <h3>租户增长趋势</h3>
        </div>
        <div class="chart-content">
          <div class="line-chart">
            <div class="chart-bars">
              <div 
                v-for="(item, index) in tenantGrowth" 
                :key="index" 
                class="chart-bar-wrapper"
              >
                <div 
                  class="chart-bar" 
                  :style="{height: (item.value / maxGrowth * 100) + '%'}"
                ></div>
                <span class="chart-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3>租户类型分布</h3>
        </div>
        <div class="chart-content">
          <div class="pie-chart-container">
            <div class="pie-chart">
              <svg viewBox="0 0 100 100">
                <circle 
                  cx="50" cy="50" r="40" 
                  :style="{
                    stroke: '#238636',
                    strokeDasharray: `${typeDistribution.enterprisePercent * 2.51} 251`,
                    fill: 'none',
                    strokeWidth: '20',
                    transform: 'rotate(-90 50 50)'
                  }"
                />
                <circle 
                  cx="50" cy="50" r="40" 
                  :style="{
                    stroke: '#d29922',
                    strokeDasharray: `${typeDistribution.personalPercent * 2.51} 251`,
                    fill: 'none',
                    strokeWidth: '20',
                    transform: `rotate(${(typeDistribution.enterprisePercent - 100) * 3.6} 50 50)`
                  }"
                />
              </svg>
              <div class="pie-center">
                <div class="pie-total">{{ stats.totalTenants }}</div>
                <div class="pie-label">租户</div>
              </div>
            </div>
            <div class="pie-legend">
              <div class="legend-item">
                <span class="legend-color enterprise"></span>
                <span>企业租户 {{ typeDistribution.enterprisePercent }}%</span>
              </div>
              <div class="legend-item">
                <span class="legend-color personal"></span>
                <span>个人租户 {{ typeDistribution.personalPercent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-card full-width">
        <div class="chart-header">
          <h3>租户活跃度排行</h3>
          <button class="export-btn">导出报表</button>
        </div>
        <div class="chart-content">
          <table class="ranking-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>租户名称</th>
                <th>用户数</th>
                <th>组织数</th>
                <th>数据质量</th>
                <th>活跃天数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(tenant, index) in topTenants" :key="tenant.id">
                <td class="rank-cell">
                  <span class="rank" :class="{top3: index < 3}">{{ index + 1 }}</span>
                </td>
                <td class="name-cell">
                  <span class="tenant-icon">🏢</span>
                  <span>{{ tenant.name }}</span>
                </td>
                <td>{{ tenant.userCount.toLocaleString() }}</td>
                <td>{{ tenant.orgCount }}</td>
                <td>
                  <div class="quality-bar">
                    <div 
                      class="quality-fill" 
                      :class="getQualityClass(tenant.quality)"
                      :style="{width: tenant.quality + '%'}"
                    ></div>
                  </div>
                  <span class="quality-text">{{ tenant.quality }}%</span>
                </td>
                <td>{{ tenant.activeDays }}天</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-card">
        <div class="chart-header">
          <h3>套餐分布</h3>
        </div>
        <div class="chart-content">
          <div class="bar-chart">
            <div v-for="pkg in packageDistribution" :key="pkg.name" class="bar-item">
              <div class="bar-label">{{ pkg.name }}</div>
              <div class="bar-track">
                <div 
                  class="bar-fill" 
                  :class="pkg.type"
                  :style="{width: pkg.percent + '%'}"
                ></div>
              </div>
              <div class="bar-value">{{ pkg.count }}个</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3>地域分布</h3>
        </div>
        <div class="chart-content">
          <div class="location-list">
            <div v-for="loc in locationDistribution" :key="loc.name" class="location-item">
              <span class="location-name">{{ loc.name }}</span>
              <span class="location-count">{{ loc.count }}</span>
              <div class="location-bar">
                <div 
                  class="location-fill"
                  :style="{width: (loc.count / maxLocation * 100) + '%'}"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const dateRange = ref('30d')

const stats = reactive({
  totalTenants: 128,
  totalUsers: 12568,
  activeRate: 78.5,
  revenue: 1258000
})

const tenantGrowth = [
  { label: '1月', value: 85 },
  { label: '2月', value: 92 },
  { label: '3月', value: 105 },
  { label: '4月', value: 118 },
  { label: '5月', value: 128 }
]

const maxGrowth = computed(() => Math.max(...tenantGrowth.map(t => t.value)))

const typeDistribution = reactive({
  enterprisePercent: 70,
  personalPercent: 30
})

const topTenants = [
  { id: 1, name: '阳光农业集团', userCount: 1256, orgCount: 56, quality: 99.2, activeDays: 120 },
  { id: 2, name: '绿野生态科技', userCount: 986, orgCount: 32, quality: 98.5, activeDays: 95 },
  { id: 3, name: '丰收供应链', userCount: 856, orgCount: 28, quality: 98.1, activeDays: 88 },
  { id: 4, name: '绿色果园联盟', userCount: 723, orgCount: 45, quality: 97.8, activeDays: 76 },
  { id: 5, name: '现代农业园区', userCount: 654, orgCount: 38, quality: 97.5, activeDays: 68 },
  { id: 6, name: '农资经销商联盟', userCount: 521, orgCount: 25, quality: 96.8, activeDays: 55 },
  { id: 7, name: '农产品合作社', userCount: 445, orgCount: 18, quality: 96.2, activeDays: 48 },
  { id: 8, name: '生态农庄集团', userCount: 389, orgCount: 22, quality: 95.8, activeDays: 42 },
  { id: 9, name: '智慧农业科技', userCount: 334, orgCount: 15, quality: 95.2, activeDays: 35 },
  { id: 10, name: '乡村振兴项目', userCount: 289, orgCount: 12, quality: 94.8, activeDays: 30 }
]

const packageDistribution = [
  { name: '基础版', count: 65, percent: 51, type: 'base' },
  { name: '专业版', count: 48, percent: 38, type: 'pro' },
  { name: '企业版', count: 15, percent: 11, type: 'enterprise' }
]

const locationDistribution = [
  { name: '山东省', count: 28 },
  { name: '河南省', count: 22 },
  { name: '广东省', count: 18 },
  { name: '浙江省', count: 15 },
  { name: '江苏省', count: 14 },
  { name: '四川省', count: 12 },
  { name: '湖北省', count: 10 },
  { name: '其他', count: 9 }
]

const maxLocation = computed(() => Math.max(...locationDistribution.map(l => l.count)))

const getQualityClass = (quality) => {
  if (quality >= 98) return 'excellent'
  if (quality >= 95) return 'good'
  if (quality >= 90) return 'normal'
  return 'poor'
}

onMounted(() => {
  console.log('租户数据统计页面加载完成')
})
</script>

<style scoped>
.tenant-statistics {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.header-left p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.date-select {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
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
}

.stat-icon {
  font-size: 32px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
}

.stat-label {
  font-size: 13px;
  color: #718096;
  margin: 4px 0 0;
}

.stat-trend {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
}

.stat-trend.up {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.stat-trend.down {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.chart-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.chart-card.full-width {
  grid-column: 1 / -1;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.chart-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.export-btn {
  padding: 8px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover {
  background: #e2e8f0;
}

.chart-content {
  padding: 20px;
}

.line-chart {
  height: 200px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-top: 20px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  width: 100%;
  height: 100%;
}

.chart-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.chart-bar {
  width: 30px;
  background: linear-gradient(180deg, #238636 0%, #2ea043 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s;
  min-height: 4px;
}

.chart-label {
  font-size: 12px;
  color: #718096;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.pie-chart {
  position: relative;
  width: 150px;
  height: 150px;
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.pie-total {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
}

.pie-label {
  font-size: 12px;
  color: #718096;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4a5568;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-color.enterprise {
  background: #238636;
}

.legend-color.personal {
  background: #d29922;
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
}

.ranking-table th,
.ranking-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.ranking-table th {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  background: #f8fafc;
}

.ranking-table td {
  font-size: 13px;
  color: #2d3748;
}

.rank-cell {
  width: 60px;
}

.rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
}

.rank.top3 {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #fff;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tenant-icon {
  font-size: 16px;
}

.quality-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.quality-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.quality-fill.excellent {
  background: #238636;
}

.quality-fill.good {
  background: #2ea043;
}

.quality-fill.normal {
  background: #d29922;
}

.quality-fill.poor {
  background: #dc2626;
}

.quality-text {
  font-size: 12px;
  color: #718096;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 60px;
  font-size: 13px;
  color: #4a5568;
}

.bar-track {
  flex: 1;
  height: 20px;
  background: #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.3s;
}

.bar-fill.base {
  background: linear-gradient(90deg, #6b7280 0%, #9ca3af 100%);
}

.bar-fill.pro {
  background: linear-gradient(90deg, #238636 0%, #2ea043 100%);
}

.bar-fill.enterprise {
  background: linear-gradient(90deg, #1f2937 0%, #374151 100%);
}

.bar-value {
  width: 40px;
  font-size: 13px;
  color: #718096;
  text-align: right;
}

.location-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.location-name {
  width: 60px;
  font-size: 13px;
  color: #4a5568;
}

.location-count {
  width: 30px;
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
  text-align: right;
}

.location-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.location-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636 0%, #2ea043 100%);
  border-radius: 4px;
  transition: width 0.3s;
}
</style>