<template>
  <div class="user-report">
    <div class="page-header">
      <h1>数据报表</h1>
      <p>查看和分析数据统计报表</p>
    </div>

    <div class="report-section">
      <div class="report-tabs">
        <button 
          v-for="tab in reportTabs" 
          :key="tab.key"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="filter-section">
        <select v-model="timeRange" class="filter-select">
          <option value="7d">近7天</option>
          <option value="30d">近30天</option>
          <option value="90d">近90天</option>
          <option value="year">本年度</option>
        </select>
        <button class="export-btn" @click="handleExport">📥 导出报表</button>
      </div>
    </div>

    <div class="charts-section" v-if="activeTab === 'overview'">
      <div class="chart-row">
        <div class="chart-card large">
          <div class="chart-header">
            <h3>数据质量趋势</h3>
          </div>
          <div class="line-chart">
            <svg viewBox="0 0 400 200" class="chart-svg">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#238636;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#238636;stop-opacity:0" />
                </linearGradient>
              </defs>
              <path :d="areaPath" fill="url(#lineGradient)" />
              <path :d="linePath" fill="none" stroke="#238636" stroke-width="2" />
              <circle v-for="(point, index) in chartPoints" :key="index"
                :cx="point.x" :cy="point.y" r="4" fill="#238636" />
              <line v-for="(label, index) in xLabels" :key="'line-'+index"
                x1="30 + index * 55" y1="180" x2="30 + index * 55" y2="185" stroke="#e2e8f0" />
            </svg>
            <div class="chart-labels">
              <span v-for="label in xLabels" :key="label">{{ label }}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>数据类型分布</h3>
          </div>
          <div class="pie-chart">
            <svg viewBox="0 0 150 150" class="pie-svg">
              <circle cx="75" cy="75" r="60" fill="none" stroke="#e8f5e9" stroke-width="20" />
              <circle cx="75" cy="75" r="60" fill="none" stroke="#238636" stroke-width="20"
                :stroke-dasharray="`${userPercent * 3.77} 377`" stroke-dashoffset="-20" />
              <circle cx="75" cy="75" r="60" fill="none" stroke="#3b82f6" stroke-width="20"
                :stroke-dasharray="`${orgPercent * 3.77} 377`" 
                :stroke-dashoffset="`${-20 - userPercent * 3.77}`" />
              <circle cx="75" cy="75" r="60" fill="none" stroke="#d29922" stroke-width="20"
                :stroke-dasharray="`${productPercent * 3.77} 377`" 
                :stroke-dashoffset="`${-20 - userPercent * 3.77 - orgPercent * 3.77}`" />
            </svg>
            <div class="pie-legend">
              <div class="legend-item"><span class="legend-color" style="background:#238636"></span> 用户数据 {{ userPercent }}%</div>
              <div class="legend-item"><span class="legend-color" style="background:#3b82f6"></span> 组织数据 {{ orgPercent }}%</div>
              <div class="legend-item"><span class="legend-color" style="background:#d29922"></span> 商品数据 {{ productPercent }}%</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-row">
        <div class="chart-card">
          <div class="chart-header">
            <h3>数据质量评分</h3>
          </div>
          <div class="score-display">
            <div class="score-circle">
              <span class="score-value">{{ qualityScore }}</span>
              <span class="score-label">分</span>
            </div>
            <div class="score-bar">
              <div class="bar-fill" :style="{ width: qualityScore + '%' }"></div>
            </div>
            <div class="score-info">
              <span>数据完整性: {{ integrity }}%</span>
              <span>数据准确性: {{ accuracy }}%</span>
              <span>数据一致性: {{ consistency }}%</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>数据更新统计</h3>
          </div>
          <div class="bar-chart">
            <div v-for="item in updateStats" :key="item.label" class="bar-item">
              <div class="bar-wrapper">
                <div class="bar" :style="{ height: item.value + '%' }"></div>
                <span class="bar-value">{{ item.count }}</span>
              </div>
              <span class="bar-label">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>系统运行状态</h3>
          </div>
          <div class="status-grid">
            <div v-for="status in systemStatus" :key="status.name" class="status-item">
              <span class="status-icon" :class="status.status">{{ status.icon }}</span>
              <span class="status-name">{{ status.name }}</span>
              <span class="status-desc">{{ status.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="report-list" v-else-if="activeTab === 'quality'">
      <div class="report-card">
        <div class="report-header">
          <h3>数据质量检测报告</h3>
          <span class="report-date">生成时间: {{ reportDate }}</span>
        </div>
        <div class="report-content">
          <div class="quality-summary">
            <div class="summary-item">
              <span class="summary-label">检测记录数</span>
              <span class="summary-value">{{ qualityReport.totalCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">异常记录数</span>
              <span class="summary-value error">{{ qualityReport.errorCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">合格率</span>
              <span class="summary-value success">{{ qualityReport.rate }}%</span>
            </div>
          </div>
          <div class="quality-detail">
            <h4>检测项详情</h4>
            <table class="detail-table">
              <thead>
                <tr>
                  <th>检测项</th>
                  <th>检测结果</th>
                  <th>问题描述</th>
                  <th>处理状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in qualityReport.items" :key="item.id">
                  <td>{{ item.name }}</td>
                  <td><span :class="item.result === '通过' ? 'status-pass' : 'status-fail'">{{ item.result }}</span></td>
                  <td>{{ item.desc }}</td>
                  <td><span class="status-processing">{{ item.status }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="report-list" v-else-if="activeTab === 'usage'">
      <div class="report-card">
        <div class="report-header">
          <h3>数据使用统计报告</h3>
          <span class="report-date">统计周期: {{ timeRangeLabel }}</span>
        </div>
        <div class="report-content">
          <div class="usage-chart">
            <div class="usage-bars">
              <div v-for="item in usageData" :key="item.label" class="usage-bar-item">
                <div class="usage-bar" :style="{ height: item.value + '%' }">
                  <span class="usage-tooltip">{{ item.count }}次</span>
                </div>
                <span class="usage-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div class="usage-summary">
            <div class="usage-item">
              <span class="usage-icon">🔍</span>
              <span class="usage-text">总查询次数: {{ totalQueries }}</span>
            </div>
            <div class="usage-item">
              <span class="usage-icon">📥</span>
              <span class="usage-text">总导出次数: {{ totalExports }}</span>
            </div>
            <div class="usage-item">
              <span class="usage-icon">📊</span>
              <span class="usage-text">总报表生成: {{ totalReports }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const activeTab = ref('overview')
const timeRange = ref('30d')

const reportTabs = [
  { key: 'overview', label: '数据概览' },
  { key: 'quality', label: '质量报告' },
  { key: 'usage', label: '使用统计' }
]

const xLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const yData = [65, 78, 82, 71, 85, 45, 38]

const chartPoints = computed(() => {
  return yData.map((val, i) => ({
    x: 30 + i * 55,
    y: 180 - val * 1.5
  }))
})

const linePath = computed(() => {
  return chartPoints.value.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ')
})

const areaPath = computed(() => {
  const points = chartPoints.value
  if (points.length === 0) return ''
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return `${line} L ${points[points.length - 1].x} 180 L ${points[0].x} 180 Z`
})

const userPercent = 45
const orgPercent = 30
const productPercent = 25

const qualityScore = 92
const integrity = 95
const accuracy = 91
const consistency = 89

const updateStats = [
  { label: '用户', value: 75, count: 1256 },
  { label: '组织', value: 60, count: 89 },
  { label: '商品', value: 85, count: 3421 },
  { label: '客户', value: 70, count: 2156 }
]

const systemStatus = [
  { name: '数据库', status: 'ok', icon: '🟢', desc: '正常运行' },
  { name: 'API服务', status: 'ok', icon: '🟢', desc: '正常运行' },
  { name: '定时任务', status: 'ok', icon: '🟢', desc: '正常运行' },
  { name: '数据同步', status: 'warning', icon: '🟡', desc: '同步中' }
]

const reportDate = '2026-05-09 10:00:00'

const qualityReport = {
  totalCount: 12580,
  errorCount: 1006,
  rate: 91.99,
  items: [
    { id: 1, name: '字段完整性检查', result: '通过', desc: '所有必填字段均有值', status: '已完成' },
    { id: 2, name: '数据格式验证', result: '通过', desc: '数据格式符合规范', status: '已完成' },
    { id: 3, name: '数据唯一性检查', result: '失败', desc: '发现3条重复记录', status: '处理中' },
    { id: 4, name: '数据关联验证', result: '失败', desc: '发现5条关联缺失', status: '待处理' },
    { id: 5, name: '数据范围检查', result: '通过', desc: '数据值在有效范围内', status: '已完成' }
  ]
}

const timeRangeLabel = computed(() => {
  const labels = { '7d': '近7天', '30d': '近30天', '90d': '近90天', 'year': '本年度' }
  return labels[timeRange.value]
})

const usageData = [
  { label: '用户查询', value: 85, count: 2847 },
  { label: '报表生成', value: 60, count: 156 },
  { label: '数据导出', value: 45, count: 328 },
  { label: 'API调用', value: 95, count: 8934 },
  { label: '数据同步', value: 70, count: 1250 }
]

const totalQueries = 12856
const totalExports = 328
const totalReports = 156

const handleExport = () => {
  alert('报表导出功能已触发')
}

onMounted(() => {})
</script>

<style scoped>
.user-report {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.page-header p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.report-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.report-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.report-tabs button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  background: #f0f0f0;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.report-tabs button.active {
  background: #238636;
  color: #fff;
}

.filter-section {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.filter-select {
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.export-btn {
  padding: 8px 16px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.charts-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.chart-card.large {
  grid-column: span 2;
}

.chart-header {
  margin-bottom: 16px;
}

.chart-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.line-chart {
  position: relative;
}

.chart-svg {
  width: 100%;
  height: 200px;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 30px;
  margin-top: 8px;
  font-size: 11px;
  color: #a0aec0;
}

.pie-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pie-svg {
  width: 150px;
  height: 150px;
  transform: rotate(-90deg);
}

.pie-legend {
  margin-top: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4a5568;
  margin-bottom: 4px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.score-display {
  text-align: center;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(#238636 0deg, #238636 calc(var(--score) * 3.6deg), #e8f5e9 calc(var(--score) * 3.6deg), #e8f5e9 360deg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  position: relative;
}

.score-circle::before {
  content: '';
  position: absolute;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #fff;
}

.score-value {
  position: relative;
  font-size: 32px;
  font-weight: 700;
  color: #238636;
}

.score-label {
  position: relative;
  font-size: 14px;
  color: #a0aec0;
  margin-left: 4px;
}

.score-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636, #2ea043);
  border-radius: 4px;
}

.score-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #a0aec0;
}

.bar-chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 120px;
  padding-top: 20px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-wrapper {
  position: relative;
  width: 40px;
  height: 100px;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  background: linear-gradient(180deg, #238636, #2ea043);
  border-radius: 6px 6px 0 0;
  transition: height 0.3s ease;
}

.bar-value {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #4a5568;
  font-weight: 500;
}

.bar-label {
  font-size: 11px;
  color: #a0aec0;
  margin-top: 8px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
}

.status-icon {
  font-size: 18px;
}

.status-name {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
}

.status-desc {
  font-size: 11px;
  color: #a0aec0;
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.report-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.report-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.report-date {
  font-size: 13px;
  color: #a0aec0;
}

.report-content {
  padding: 20px;
}

.quality-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
}

.summary-item {
  flex: 1;
  text-align: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.summary-label {
  display: block;
  font-size: 13px;
  color: #a0aec0;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
}

.summary-value.error {
  color: #dc2626;
}

.summary-value.success {
  color: #238636;
}

.quality-detail h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
}

.detail-table th,
.detail-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.detail-table th {
  font-size: 12px;
  font-weight: 600;
  color: #a0aec0;
  background: #f8fafc;
}

.detail-table td {
  font-size: 13px;
  color: #2d3748;
}

.status-pass {
  padding: 4px 10px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border-radius: 12px;
  font-size: 11px;
}

.status-fail {
  padding: 4px 10px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border-radius: 12px;
  font-size: 11px;
}

.status-processing {
  padding: 4px 10px;
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
  border-radius: 12px;
  font-size: 11px;
}

.usage-chart {
  margin-bottom: 24px;
}

.usage-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 150px;
  padding-top: 20px;
}

.usage-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.usage-bar {
  width: 50px;
  background: linear-gradient(180deg, #3b82f6, #60a5fa);
  border-radius: 8px 8px 0 0;
  position: relative;
}

.usage-tooltip {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: #2d3748;
  color: #fff;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.usage-bar:hover .usage-tooltip {
  opacity: 1;
}

.usage-label {
  font-size: 12px;
  color: #a0aec0;
  margin-top: 10px;
}

.usage-summary {
  display: flex;
  gap: 24px;
}

.usage-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.usage-icon {
  font-size: 24px;
}

.usage-text {
  font-size: 13px;
  color: #2d3748;
}
</style>