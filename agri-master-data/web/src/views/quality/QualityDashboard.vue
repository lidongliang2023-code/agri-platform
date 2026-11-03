<template>
  <div class="mds-page">
    <PageHeader
      title="质量稽核"
      subtitle="主数据质量问题概览：等级与状态分布、趋势、规则检出排行与最近工单。全部来自质量统计接口的真实聚合。"
      source="数据治理 · 质量统计"
    >
      <template #actions>
        <select v-model="dateRange" class="mds-select" style="min-width: 120px">
          <option value="today">今日</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
          <option value="quarter">本季度</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="router.push('/quality/issue')">问题工单</button>
      </template>
    </PageHeader>

    <StatGrid :items="statItems" />

    <div class="mds-grid mds-grid--2">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">问题等级分布</h2>
        </div>
        <div class="mds-card-body">
          <div v-if="!stats.totalIssues" class="mds-empty">暂无质量问题数据</div>
          <div v-else class="chart-content">
            <div class="pie-chart" :style="{ background: pieBackground }">
              <div class="pie-center">
                <div class="center-value">{{ stats.totalIssues }}</div>
                <div class="center-label">总数</div>
              </div>
            </div>
            <div class="legend">
              <div v-for="item in severityDistribution" :key="item.severity" class="legend-item">
                <span class="legend-dot" :style="{ background: item.color }" />
                <span class="legend-label">{{ item.label }}</span>
                <span class="legend-value">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">问题状态分布</h2>
        </div>
        <div class="mds-card-body">
          <div v-if="!stats.totalIssues" class="mds-empty">暂无质量问题数据</div>
          <div v-else class="bar-chart">
            <div v-for="item in statusDistribution" :key="item.status" class="bar-item">
              <div class="bar-label">{{ item.label }}</div>
              <div class="bar-container">
                <div class="bar-fill" :style="{ width: item.percentage + '%', background: item.color }" />
              </div>
              <div class="bar-value">{{ item.count }}（{{ item.percentage }}%）</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">问题数量趋势</h2>
          <p class="mds-card-sub">最近 12 个数据点 · 口径为每日新增问题数</p>
        </div>
      </div>
      <div class="mds-card-body">
        <div v-if="!chartPoints.length" class="mds-empty">该区间暂无趋势数据</div>
        <div v-else class="line-chart">
          <svg viewBox="0 0 800 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color: #13a05a; stop-opacity: 0.25" />
                <stop offset="100%" style="stop-color: #13a05a; stop-opacity: 0" />
              </linearGradient>
            </defs>
            <path :d="areaPath" fill="url(#lineGradient)" />
            <path :d="linePath" fill="none" stroke="#13a05a" stroke-width="3" />
            <circle v-for="(point, index) in chartPoints" :key="index" :cx="point.x" :cy="point.y" r="5" fill="#13a05a" />
            <g v-for="(label, index) in chartLabels" :key="'label-' + index">
              <text :x="getLabelX(index)" y="288" fill="#8f959e" font-size="12" text-anchor="middle">{{ label }}</text>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <div class="mds-grid mds-grid--2">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">规则检出问题排行</h2>
            <p class="mds-card-sub">该规则当前未解决问题数占全部问题的比例</p>
          </div>
        </div>
        <div class="mds-card-body">
          <div v-if="!ruleRanking.length" class="mds-empty">暂无规则检出的未解决问题</div>
          <div v-else class="ranking-list">
            <div v-for="(item, index) in ruleRanking" :key="item.name" class="ranking-item">
              <div class="rank-badge" :class="'rank-' + (index + 1)">{{ index + 1 }}</div>
              <div class="rank-info">
                <div class="rank-name">{{ item.name }}</div>
                <div class="rank-rate">占全部问题 {{ item.hitRate }}%</div>
              </div>
              <div class="rank-bar-container">
                <div class="rank-bar" :style="{ width: item.hitRate + '%' }" />
              </div>
              <div class="rank-count">{{ item.count }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">数据域问题分布</h2>
        </div>
        <div class="mds-card-body">
          <div v-if="!domainDistribution.length" class="mds-empty">暂无数据域统计</div>
          <div v-else class="domain-list">
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

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">最近问题工单</h2>
          <p class="mds-card-sub">按创建时间倒序，最多 5 条</p>
        </div>
        <button class="mds-btn mds-btn--link" @click="router.push('/quality/issue')">查看全部</button>
      </div>
      <div class="mds-card-body">
        <div v-if="!recentIssues.length" class="mds-empty">暂无问题工单</div>
        <div v-else class="recent-issues">
          <button v-for="issue in recentIssues" :key="issue.id" class="issue-item" @click="router.push('/quality/issue')">
            <div class="issue-icon">{{ getSeverityIcon(issue.severity) }}</div>
            <div class="issue-content">
              <div class="issue-code">{{ issue.code }}</div>
              <div class="issue-desc">{{ issue.description }}</div>
            </div>
            <div class="issue-meta">
              <span class="issue-domain">{{ issue.domain }}</span>
              <span class="issue-time">{{ issue.time }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import { getQualityList, getQualityStatistics, getQualityTrend } from '../../utils/api'

const router = useRouter()
const dateRange = ref('week')

const stats = ref({
  totalIssues: null,
  openIssues: null,
  resolvedRate: null,
  // 没有数据来源的指标保持 null，模板显示「—」，不编数字
  averageTime: null,
  taskExecutions: null,
  taskSuccessRate: null,
})

const statItems = computed(() => [
  { label: '问题工单总数', value: stats.value.totalIssues ?? '—' },
  { label: '待处理工单', value: stats.value.openIssues ?? '—', hint: '待处理 + 处理中', tone: 'warning' },
  {
    label: '问题解决率',
    value: stats.value.resolvedRate == null ? '—' : `${stats.value.resolvedRate}%`,
    tone: 'success',
  },
  { label: '平均处理时长', value: stats.value.averageTime ?? '—', hint: '处置时长未接入' },
  {
    label: '任务执行次数',
    value: stats.value.taskExecutions ?? '—',
    hint: stats.value.taskExecutions == null ? '未接入' : '检测任务累计',
  },
  {
    label: '任务成功率',
    value: stats.value.taskSuccessRate ?? '—',
    hint: stats.value.taskSuccessRate == null ? '未接入' : '',
  },
])

const severityDistribution = ref([])
const statusDistribution = ref([])
const trendData = ref([])
const chartLabels = ref([])
const ruleRanking = ref([])
const domainDistribution = ref([])
const recentIssues = ref([])

const SEVERITY_META = {
  high: { label: '严重', color: '#c62828' },
  medium: { label: '警告', color: '#e65100' },
  low: { label: '提示', color: '#2e7d32' },
}
const STATUS_META = {
  pending: { label: '待处理', color: '#e65100' },
  processing: { label: '处理中', color: '#1565c0' },
  resolved: { label: '已解决', color: '#13a05a' },
  ignored: { label: '已忽略', color: '#8f959e' },
}
const DOMAIN_ICONS = { user: '👤', org: '🏢', product: '📦', permission: '🔒', customer: '👥', supplier: '🏭' }

/** 时间范围下拉 → 趋势接口的天数（后端认 7d/30d 这类写法） */
const RANGE_DAYS = { today: 1, week: 7, month: 30, quarter: 90 }

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
      getQualityList({ pageNum: 1, pageSize: 5 }),
    ])

    if (statRes.code === 200 && statRes.data) {
      const s = statRes.data
      const statusMap = {}
      ;(s.statusStatistics ?? []).forEach((item) => {
        statusMap[item.status] = item.issueCount ?? 0
      })

      stats.value.totalIssues = s.totalIssues ?? 0
      // 待处理 = pending + processing：只算 pending 会把正在处理的漏掉
      stats.value.openIssues = (statusMap.pending ?? 0) + (statusMap.processing ?? 0)
      stats.value.resolvedRate = s.resolutionRate
      stats.value.taskExecutions = s.taskExecutions ?? 0

      const total = s.totalIssues ?? 0
      const severityItems = [
        { severity: 'high', count: s.highSeverityCount ?? 0 },
        { severity: 'medium', count: s.mediumSeverityCount ?? 0 },
        { severity: 'low', count: s.lowSeverityCount ?? 0 },
      ].map((item) => ({ ...item, ...SEVERITY_META[item.severity] }))
      severityDistribution.value = withDegrees(severityItems, total)

      statusDistribution.value = Object.keys(STATUS_META).map((key) => {
        const count = statusMap[key] ?? 0
        return {
          status: key,
          label: STATUS_META[key].label,
          color: STATUS_META[key].color,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        }
      })

      domainDistribution.value = (s.domainStatistics ?? []).map((item) => ({
        domain: item.domainCode,
        name: item.domainName,
        count: item.issueCount,
        icon: DOMAIN_ICONS[item.domainCode] ?? '📄',
      }))

      ruleRanking.value = (s.ruleRanking ?? []).map((item) => ({
        name: item.ruleName,
        hitRate: item.hitRate,
        count: item.count,
      }))
    }

    if (trendRes.code === 200) {
      const points = (trendRes.data ?? []).slice(-12)
      trendData.value = points.map((p) => p.totalIssues ?? 0)
      chartLabels.value = points.map((p) => String(p.date).slice(5))
    }

    if (issueRes.code === 200) {
      recentIssues.value = (issueRes.data?.list ?? []).map((row) => ({
        id: row.id,
        code: row.issueCode,
        description: row.description,
        domain: row.domain || row.domainName,
        severity: row.severity,
        time: row.createTime,
      }))
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '质量数据加载失败')
  }
}

watch(dateRange, () => {
  void loadAll()
})

const chartPoints = computed(() => {
  // 空数组时 Math.max(...[]) 是 -Infinity，会算出 NaN 坐标导致整条线消失
  if (trendData.value.length === 0) return []
  const max = Math.max(...trendData.value)
  const min = Math.min(...trendData.value)
  const range = max - min || 1
  const width = 800
  const height = 250
  const padding = 50
  return trendData.value.map((value, index) => ({
    x: padding + (index / Math.max(1, trendData.value.length - 1)) * (width - padding * 2),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }))
})

const linePath = computed(() => {
  if (!chartPoints.value.length) return ''
  return chartPoints.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
})

const areaPath = computed(() => {
  if (!chartPoints.value.length) return ''
  const points = chartPoints.value
  return `${linePath.value} L ${points[points.length - 1].x} 250 L ${points[0].x} 250 Z`
})

const getLabelX = (index) => 50 + (index / Math.max(1, chartLabels.value.length - 1)) * 700

const getSeverityIcon = (severity) =>
  ({ critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[severity] ?? '⚪')

/**
 * 单层 conic-gradient 画完整环形。
 * 原来每段各渲染一层 conic，把后一段盖在前一段上，实际只能看到部分扇区。
 */
const pieBackground = computed(() => {
  const items = severityDistribution.value
  const total = stats.value.totalIssues ?? 0
  if (!total || !items.length) return '#f2f3f5'
  let cursor = 0
  const stops = items.map((item) => {
    const start = cursor
    cursor = Math.min(360, cursor + item.degrees)
    return `${item.color} ${start}deg ${cursor}deg`
  })
  if (cursor < 360) {
    stops.push(`${items[items.length - 1].color} ${cursor}deg 360deg`)
  }
  return `conic-gradient(${stops.join(', ')})`
})

onMounted(loadAll)
</script>

<style scoped>
.chart-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pie-chart {
  position: relative;
  width: 180px;
  height: 180px;
  margin: 0 auto;
  border-radius: 50%;
}

.pie-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 96px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
}

.center-value {
  font-family: var(--mds-mono);
  font-size: 24px;
  font-weight: 700;
}

.center-label {
  font-size: 12px;
  color: var(--mds-text-3);
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-label {
  flex: 1;
  color: var(--mds-text-2);
}

.legend-value {
  font-family: var(--mds-mono);
  font-weight: 600;
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
  font-size: 13px;
}

.bar-label {
  width: 60px;
  color: var(--mds-text-2);
}

.bar-container {
  flex: 1;
  height: 20px;
  border-radius: 5px;
  background: var(--mds-line-soft);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
}

.bar-value {
  width: 92px;
  text-align: right;
  font-family: var(--mds-mono);
  color: var(--mds-text-3);
  font-size: 12px;
}

.line-chart {
  width: 100%;
  height: 300px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rank-badge {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--mds-gray-soft);
  color: var(--mds-text-2);
}

.rank-1 {
  background: #13a05a;
  color: #fff;
}

.rank-2 {
  background: #5bb98a;
  color: #fff;
}

.rank-3 {
  background: #a8d8bf;
  color: #0b3b26;
}

.rank-info {
  width: 150px;
  min-width: 0;
}

.rank-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-rate {
  font-size: var(--agri-font-size-micro);
  color: var(--mds-text-3);
}

.rank-bar-container {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--mds-line-soft);
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  border-radius: 4px;
  background: var(--mds-brand);
}

.rank-count {
  width: 36px;
  text-align: right;
  font-family: var(--mds-mono);
  font-weight: 600;
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.domain-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8faf9;
}

.domain-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.domain-value {
  font-family: var(--mds-mono);
  font-size: 18px;
  font-weight: 700;
}

.recent-issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: 8px;
  background: #f8faf9;
  text-align: left;
  cursor: pointer;
}

.issue-item:hover {
  background: var(--mds-brand-soft);
}

.issue-icon {
  width: 30px;
  text-align: center;
  font-size: 16px;
}

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-code {
  font-family: var(--mds-mono);
  font-size: 12px;
  color: var(--mds-brand-deep);
}

.issue-desc {
  margin-top: 3px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  font-size: var(--agri-font-size-micro);
  color: var(--mds-text-3);
}

@media (max-width: 900px) {
  .chart-content {
    gap: 12px;
  }
}
</style>
