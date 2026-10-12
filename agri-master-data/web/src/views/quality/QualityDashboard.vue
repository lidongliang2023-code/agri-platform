<template>
  <div class="quality-dashboard">
    <div class="page-header">
      <div class="header-left">
        <h1>质量仪表盘</h1>
        <p>数据质量检测概览与趋势分析</p>
      </div>
      <div class="date-filter">
        <select v-model="dateRange" class="date-select">
          <option value="today">今日</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
          <option value="quarter">本季度</option>
        </select>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon green">📊</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalIssues }}</div>
          <div class="stat-label">问题工单总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">🔴</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.openIssues }}</div>
          <div class="stat-label">待处理工单</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">✅</div>
        <div class="stat-content">
          <!-- 解决率可能为 null（一条问题都没有时无法计算），显示 "—" 而不是 0% -->
          <div class="stat-value">{{ stats.resolvedRate == null ? '—' : stats.resolvedRate + '%' }}</div>
          <div class="stat-label">问题解决率</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">⚡</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.averageTime ?? '—' }}</div>
          <div class="stat-label">平均处理时长(小时) · 未接入</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">🔄</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.taskExecutions ?? '—' }}</div>
          <!-- 标签里的"未接入"按有无数据决定：接了任务族之后这一项已经有真值，
               写死的后缀会让"57 次 · 未接入"自相矛盾 -->
          <div class="stat-label">检测任务执行次数{{ stats.taskExecutions == null ? ' · 未接入' : '' }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon teal">📈</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.taskSuccessRate ?? '—' }}</div>
          <div class="stat-label">任务成功率{{ stats.taskSuccessRate == null ? ' · 未接入' : '' }}</div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-card">
        <div class="card-header">
          <h3>问题等级分布</h3>
        </div>
        <div class="chart-content">
          <div class="pie-chart">
            <div 
              v-for="(item, index) in severityDistribution" 
              :key="item.severity"
              class="pie-slice"
              :style="{
                background: `conic-gradient(${item.color} 0deg, ${item.color} ${item.degrees}deg, transparent ${item.degrees}deg, transparent ${index < severityDistribution.length - 1 ? severityDistribution[index + 1].startDegrees : 360}deg)`
              }"
            ></div>
            <div class="pie-center">
              <div class="center-value">{{ stats.totalIssues }}</div>
              <div class="center-label">总数</div>
            </div>
          </div>
          <div class="legend">
            <div v-for="item in severityDistribution" :key="item.severity" class="legend-item">
              <span class="legend-dot" :style="{background: item.color}"></span>
              <span class="legend-label">{{ item.label }}</span>
              <span class="legend-value">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <div class="card-header">
          <h3>问题状态分布</h3>
        </div>
        <div class="chart-content">
          <div class="bar-chart">
            <div v-for="item in statusDistribution" :key="item.status" class="bar-item">
              <div class="bar-label">{{ item.label }}</div>
              <div class="bar-container">
                <div 
                  class="bar-fill" 
                  :style="{width: item.percentage + '%', background: item.color}"
                ></div>
              </div>
              <div class="bar-value">{{ item.count }} ({{ item.percentage }}%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-card full-width">
        <div class="card-header">
          <h3>问题趋势</h3>
          <div class="chart-tabs">
            <button 
              v-for="tab in trendTabs" 
              :key="tab.value"
              class="tab-btn"
              :class="{active: activeTrendTab === tab.value}"
              @click="activeTrendTab = tab.value"
            >{{ tab.label }}</button>
          </div>
        </div>
        <div class="chart-content">
          <div class="line-chart">
            <svg viewBox="0 0 800 300" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#238636;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#238636;stop-opacity:0" />
                </linearGradient>
              </defs>
              <path :d="areaPath" fill="url(#lineGradient)" />
              <path :d="linePath" fill="none" stroke="#238636" stroke-width="3" />
              <circle 
                v-for="(point, index) in chartPoints" 
                :key="index"
                :cx="point.x" 
                :cy="point.y" 
                r="6" 
                fill="#238636"
                class="chart-point"
              />
              <g v-for="(label, index) in chartLabels" :key="'label-' + index">
                <text :x="getLabelX(index)" y="280" fill="#718096" font-size="12" text-anchor="middle">{{ label }}</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-card">
        <div class="card-header">
          <!-- 改称"检出问题排行"：口径是"该规则当前未解决的问题数占全部问题的比例"。
               命中率需要检测样本量（跑了多少次、检出多少次），没有检测引擎时算不出来。 -->
          <h3>规则检出问题排行</h3>
        </div>
        <div class="chart-content">
          <div class="ranking-list">
            <div v-if="ruleRanking.length === 0" class="empty-hint">
              暂无规则检出的未解决问题
            </div>
            <div v-for="(item, index) in ruleRanking" :key="item.name" class="ranking-item">
              <div class="rank-badge" :class="'rank-' + (index + 1)">{{ index + 1 }}</div>
              <div class="rank-info">
                <div class="rank-name">{{ item.name }}</div>
                <div class="rank-rate">占全部问题 {{ item.hitRate }}%</div>
              </div>
              <div class="rank-bar-container">
                <div class="rank-bar" :style="{width: item.hitRate + '%'}"></div>
              </div>
              <div class="rank-count">{{ item.count }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <div class="card-header">
          <h3>数据域问题分布</h3>
        </div>
        <div class="chart-content">
          <div class="domain-list">
            <div v-for="item in domainDistribution" :key="item.domain" class="domain-item">
              <div class="domain-info">
                <span class="domain-icon">{{ item.icon }}</span>
                <span class="domain-name">{{ item.name }}</span>
              </div>
              <div class="domain-value">{{ item.count }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-card full-width">
        <div class="card-header">
          <h3>最近问题工单</h3>
          <button class="view-all-btn">查看全部</button>
        </div>
        <div class="chart-content">
          <div class="recent-issues">
            <div v-if="recentIssues.length === 0" class="empty-hint">暂无问题工单</div>
            <div v-for="issue in recentIssues" :key="issue.id" class="issue-item">
              <div class="issue-severity" :class="issue.severity">{{ getSeverityIcon(issue.severity) }}</div>
              <div class="issue-content">
                <div class="issue-code">{{ issue.code }}</div>
                <div class="issue-desc">{{ issue.description }}</div>
              </div>
              <div class="issue-meta">
                <span class="issue-domain">{{ issue.domain }}</span>
                <span class="issue-time">{{ issue.time }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { getQualityStatistics, getQualityTrend, getQualityList } from '../../utils/api'

const dateRange = ref('week')
const activeTrendTab = ref('issues')

const stats = ref({
  // 全部先置空：原来这里是 156 / 23 / 85 / 4.2 / 1247 / 98 六个写死的数字，
  // 页面看起来"有数据"，实际一条都不是真的。
  totalIssues: null,
  openIssues: null,
  resolvedRate: null,
  // 下面三项没有数据来源：处置时长要处置时间戳、任务执行要有检测任务族。
  // 保持 null，模板显示"—"，不编数字。
  averageTime: null,
  taskExecutions: null,
  taskSuccessRate: null
})

const trendTabs = [
  { value: 'issues', label: '问题数量' },
  { value: 'tasks', label: '任务执行' },
  { value: 'quality', label: '质量评分' }
]

const severityDistribution = ref([])
const statusDistribution = ref([])
const trendData = ref([])
const chartLabels = ref([])
/** 规则检出问题排行（来自统计接口的 ruleRanking） */
const ruleRanking = ref([])
const domainDistribution = ref([])
const recentIssues = ref([])

const SEVERITY_META = {
  high: { label: '严重', color: '#dc2626' },
  medium: { label: '警告', color: '#d29922' },
  low: { label: '提示', color: '#238636' }
}
const STATUS_META = {
  pending: { label: '待处理', color: '#ea580c' },
  processing: { label: '处理中', color: '#2563eb' },
  resolved: { label: '已解决', color: '#238636' },
  ignored: { label: '已忽略', color: '#6b7280' }
}
const DOMAIN_ICONS = { user: '👤', org: '🏢', product: '📦', permission: '🔒', customer: '👥', supplier: '🏭' }

/** 时间范围下拉 → 趋势接口的天数（后端认 7d/30d 这类写法） */
const RANGE_DAYS = { today: 1, week: 7, month: 30, quarter: 90 }

/** 给饼图算每段的角度与起始角 */
function withDegrees(items, total) {
  let start = 0
  return items.map((item) => {
    const degrees = total > 0 ? (item.count / total) * 360 : 0
    const entry = { ...item, degrees, startDegrees: start }
    start += degrees
    return entry
  })
}

const loadAll = async () => {
  try {
    const [statRes, trendRes, issueRes] = await Promise.all([
      getQualityStatistics(),
      getQualityTrend({ timeRange: `${RANGE_DAYS[dateRange.value] ?? 7}d` }),
      getQualityList({ pageNum: 1, pageSize: 5 })
    ])

    if (statRes.code === 200 && statRes.data) {
      const s = statRes.data
      const statusMap = {}
      ;(s.statusStatistics ?? []).forEach((item) => { statusMap[item.status] = item.issueCount ?? 0 })

      stats.value.totalIssues = s.totalIssues ?? 0
      // "待处理工单"= 待处理 + 处理中：只算 pending 会把正在处理的漏掉
      stats.value.openIssues = (statusMap.pending ?? 0) + (statusMap.processing ?? 0)
      stats.value.resolvedRate = s.resolutionRate
      // 检测任务累计执行次数：真数据（各任务 run_count 之和）
      stats.value.taskExecutions = s.taskExecutions ?? 0

      const total = s.totalIssues ?? 0
      const severityItems = [
        { severity: 'high', count: s.highSeverityCount ?? 0 },
        { severity: 'medium', count: s.mediumSeverityCount ?? 0 },
        { severity: 'low', count: s.lowSeverityCount ?? 0 }
      ].map((item) => ({ ...item, ...SEVERITY_META[item.severity] }))
      severityDistribution.value = withDegrees(severityItems, total)

      statusDistribution.value = Object.keys(STATUS_META).map((key) => {
        const count = statusMap[key] ?? 0
        return {
          status: key,
          label: STATUS_META[key].label,
          color: STATUS_META[key].color,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
        }
      })

      domainDistribution.value = (s.domainStatistics ?? []).map((item) => ({
        domain: item.domainCode,
        name: item.domainName,
        count: item.issueCount,
        icon: DOMAIN_ICONS[item.domainCode] ?? '📄'
      }))

      // 规则检出问题排行。口径是"该规则当前未解决的问题数占全部问题的比例"，
      // 不是命中率（命中率需要检测样本量，没有引擎时算不出来），页面按"占比"表述。
      ruleRanking.value = (s.ruleRanking ?? []).map((item) => ({
        name: item.ruleName,
        hitRate: item.hitRate,
        count: item.count
      }))
    }

    if (trendRes.code === 200) {
      // 折线图放最近 12 个点，与图表的坐标逻辑一致
      const points = (trendRes.data ?? []).slice(-12)
      trendData.value = points.map((p) => p.totalIssues ?? 0)
      chartLabels.value = points.map((p) => String(p.date).slice(5))
    }

    if (issueRes.code === 200) {
      recentIssues.value = (issueRes.data.list ?? []).map((row) => ({
        id: row.id,
        code: row.issueCode,
        description: row.description,
        domain: row.domain || row.domainName,
        severity: row.severity,
        time: row.createTime
      }))
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '质量数据加载失败')
  }
}

watch(dateRange, () => { void loadAll() })

const chartPoints = computed(() => {
  // 趋势还没加载完（或该区间没有问题）时返回空数组：Math.max(...[]) 是 -Infinity，
  // 会算出 NaN 坐标，SVG 上的表现是整条折线消失。
  if (trendData.value.length === 0) {
    return []
  }
  const max = Math.max(...trendData.value)
  const min = Math.min(...trendData.value)
  const range = max - min || 1
  const width = 800
  const height = 250
  const padding = 50
  
  return trendData.value.map((value, index) => ({
    x: padding + (index / (trendData.value.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2)
  }))
})

const linePath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  return chartPoints.value.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ')
})

const areaPath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  const points = chartPoints.value
  const startX = points[0].x
  const endX = points[points.length - 1].x
  return `${linePath.value} L ${endX} 250 L ${startX} 250 Z`
})

const getLabelX = (index) => {
  const padding = 50
  const width = 800
  return padding + (index / (chartLabels.value.length - 1)) * (width - padding * 2)
}

const getSeverityIcon = (severity) => {
  const icons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  }
  return icons[severity] || '⚪'
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.empty-hint {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: #a0aec0;
  background: #fafafa;
  border-radius: 8px;
}

.quality-dashboard {
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
  grid-template-columns: repeat(6, 1fr);
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
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.green {
  background: rgba(35, 134, 54, 0.1);
}

.stat-icon.red {
  background: rgba(239, 68, 68, 0.1);
}

.stat-icon.blue {
  background: rgba(37, 99, 235, 0.1);
}

.stat-icon.orange {
  background: rgba(234, 88, 12, 0.1);
}

.stat-icon.purple {
  background: rgba(147, 51, 234, 0.1);
}

.stat-icon.teal {
  background: rgba(20, 184, 166, 0.1);
}

.stat-content {
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

.chart-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.chart-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  background: #f0f0f0;
  color: #718096;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.view-all-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  cursor: pointer;
  transition: all 0.2s;
}

.view-all-btn:hover {
  background: rgba(35, 134, 54, 0.2);
}

.chart-content {
  padding: 20px;
}

.pie-chart {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  margin: 0 auto;
}

.pie-slice {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.center-value {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
}

.center-label {
  font-size: 12px;
  color: #718096;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-label {
  flex: 1;
  font-size: 13px;
  color: #4a5568;
}

.legend-value {
  font-size: 13px;
  font-weight: 600;
  color: #2d3748;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.bar-container {
  flex: 1;
  height: 24px;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
}

.bar-value {
  width: 80px;
  font-size: 12px;
  color: #718096;
  text-align: right;
}

.line-chart {
  width: 100%;
  height: 300px;
}

.chart-point {
  cursor: pointer;
  transition: r 0.2s;
}

.chart-point:hover {
  r: 10;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rank-badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.rank-1 {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.rank-2 {
  background: linear-gradient(135deg, #9ca3af, #6b7280);
}

.rank-3 {
  background: linear-gradient(135deg, #d97706, #b45309);
}

.rank-4,
.rank-5 {
  background: #e2e8f0;
  color: #718096;
}

.rank-info {
  width: 120px;
}

.rank-name {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
}

.rank-rate {
  font-size: 11px;
  color: #718096;
}

.rank-bar-container {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  background: linear-gradient(90deg, #238636, #2ea043);
  border-radius: 4px;
}

.rank-count {
  width: 40px;
  font-size: 13px;
  font-weight: 600;
  color: #2d3748;
  text-align: right;
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.domain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.domain-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.domain-icon {
  font-size: 20px;
}

.domain-name {
  font-size: 13px;
  color: #4a5568;
}

.domain-value {
  font-size: 20px;
  font-weight: 700;
  color: #2d3748;
}

.recent-issues {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border-radius: 8px;
  transition: all 0.2s;
}

.issue-item:hover {
  background: #f0f0f0;
}

.issue-severity {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.issue-severity.critical {
  background: rgba(239, 68, 68, 0.1);
}

.issue-severity.high {
  background: rgba(234, 88, 12, 0.1);
}

.issue-severity.medium {
  background: rgba(210, 153, 34, 0.1);
}

.issue-severity.low {
  background: rgba(35, 134, 54, 0.1);
}

.issue-content {
  flex: 1;
}

.issue-code {
  font-size: 13px;
  font-family: monospace;
  color: #238636;
  font-weight: 500;
}

.issue-desc {
  font-size: 13px;
  color: #4a5568;
  margin-top: 4px;
}

.issue-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.issue-domain {
  font-size: 12px;
  color: #718096;
}

.issue-time {
  font-size: 11px;
  color: #a0aec0;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .chart-row {
    grid-template-columns: 1fr;
  }
}
</style>
