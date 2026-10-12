<template>
  <div class="tenant-statistics">
    <div class="page-header">
      <div class="header-left">
        <h1>租户数据统计</h1>
        <p>租户数据分析与对比报表</p>
      </div>
      <div class="date-filter">
        <select v-model="timeRange" class="date-select" @change="loadData">
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
          <div class="stat-value">{{ display(summary.totalTenants) }}</div>
          <div class="stat-label">租户总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-info">
          <div class="stat-value">{{ display(summary.totalUsers) }}</div>
          <div class="stat-label">用户总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-info">
          <div class="stat-value">{{ activeRate === null ? '-' : activeRate + '%' }}</div>
          <div class="stat-label">启用中占比（{{ display(summary.activeTenants) }} / {{ display(summary.totalTenants) }}）</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏳</div>
        <div class="stat-info">
          <div class="stat-value">{{ display(summary.expiredTenants) }}</div>
          <div class="stat-label">已到期租户</div>
        </div>
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
                v-for="(item, index) in trends"
                :key="index"
                class="chart-bar-wrapper"
                :title="`${item.date} 新增 ${item.newTenants} 家`"
              >
                <span class="chart-tip">{{ item.newTenants }}</span>
                <div
                  class="chart-bar"
                  :style="{height: barHeight(item.newTenants) + '%', minHeight: item.newTenants ? '4px' : '0'}"
                ></div>
                <!-- 近 30 天会有 30 根柱子，日期标签全画出来必然互相压住，
                     所以按需要隔几根显示一个（近 7 天仍然是每天都显示）。 -->
                <span class="chart-label">{{ index % labelStep === 0 ? item.date : '' }}</span>
              </div>
            </div>
          </div>
          <p v-if="!trends.length" class="chart-empty">暂无数据</p>
          <p v-else-if="totalNewInRange === 0" class="chart-empty">
            所选区间内没有新增租户（当前库里的租户都是更早创建的）
          </p>
          <p class="chart-note">
            仅统计新增租户。区间内的活跃租户数与流失租户数需要租户活跃度日志 / 状态变更历史，暂未接入。
          </p>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3>租户类型分布</h3>
        </div>
        <div class="chart-content">
          <!-- 原来这里是一个只画"企业 / 个人"两段的甜甜圈，而库里实际有四种租户类型
               （企业 / 个人 / 合作社 / 系统），两段圆环表达不了，且百分比是写死的。
               改成按类型逐行列出：有几类就画几行，比例由真实计数算出来。 -->
          <div class="location-list">
            <div v-for="row in typeRows" :key="row.name" class="location-item">
              <span class="location-name">{{ row.name }}</span>
              <span class="location-count">{{ row.count }}</span>
              <div class="location-bar">
                <div
                  class="location-fill"
                  :style="{width: ratio(row.count, summary.totalTenants) + '%'}"
                ></div>
              </div>
            </div>
          </div>
          <p v-if="!typeRows.length" class="chart-empty">暂无数据</p>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-card full-width">
        <div class="chart-header">
          <h3>租户活跃度排行</h3>
          <button class="export-btn" @click="exportRankings">导出报表</button>
        </div>
        <div class="chart-content">
          <table class="ranking-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>租户名称</th>
                <th>类型</th>
                <th>用户数</th>
                <th>组织数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(tenant, index) in rankings" :key="tenant.tenantId">
                <td class="rank-cell">
                  <span class="rank" :class="{top3: index < 3}">{{ tenant.rank }}</span>
                </td>
                <td class="name-cell">
                  <span class="tenant-icon">🏢</span>
                  <span>{{ tenant.tenantName }}</span>
                </td>
                <td>{{ tenantTypeLabel(tenant.tenantType) }}</td>
                <td>{{ display(tenant.userCount) }}</td>
                <td>{{ display(tenant.orgCount) }}</td>
                <td>{{ tenant.status || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!rankings.length" class="chart-empty">暂无租户数据</p>
        </div>
        <p class="chart-note">
          按租户下的用户数排序。"数据质量得分"与"数据变更次数"没有数据来源（缺按租户汇总得分与变更计数的表），
          因此未展示；原先那两列是随机数。
        </p>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-card">
        <div class="chart-header">
          <h3>套餐分布</h3>
        </div>
        <div class="chart-content">
          <!-- 这里原本画的是"基础版 65 / 专业版 48 / 企业版 15"三个写死的数字。
               现在没有任何真实来源：agri_md_tenant_package 只是套餐定义表，
               租户表上没有套餐字段、也没有"租户-套餐"明细表，所以统计不出分布。
               如实说明缺什么，而不是留一张看起来很饱满的假图。 -->
          <p class="chart-empty">
            未接入：租户与套餐之间没有关联数据
          </p>
          <p class="chart-note">
            要画出这个分布，需要先给 agri_md_tenant 加套餐字段（或建一张租户-套餐明细表），
            并在开通/变更套餐时写入。当前只有套餐定义（租户套餐页），没有"哪个租户用哪个套餐"。
          </p>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <h3>地域分布</h3>
        </div>
        <div class="chart-content">
          <div class="location-list">
            <div v-for="loc in regions" :key="loc.name" class="location-item">
              <span class="location-name">{{ loc.name }}</span>
              <span class="location-count">{{ loc.count }}</span>
              <div class="location-bar">
                <div
                  class="location-fill"
                  :style="{width: ratio(loc.count, maxRegionCount) + '%'}"
                ></div>
              </div>
            </div>
          </div>
          <p v-if="!regions.length" class="chart-empty">暂无数据</p>
          <p v-else class="chart-note">按租户登记的省份统计，"未填写"表示该租户没有填省份。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 租户数据统计。
 *
 * <p>这个页面此前<b>整页都是写死的</b>：统计卡片是 128 / 12568 / 78.5% / ¥1258000，
 * 增长曲线是 5 个常量，类型分布 70%/30%，排行榜 10 个编出来的租户名，
 * 地域分布 8 个省份。而后端接口其实是有的（GET /tenant/statistics），只是从来没被调用过 ——
 * "页面能打开"和"数据是真的"完完全全是两回事。</p>
 *
 * <p>现在全部来自 /tenant/statistics：summary 是库里的真实计数，trends 按
 * agri_md_tenant.create_time 分桶，rankings 按租户下的用户数排序，
 * tenantTypes / regions 是真实的分组统计。</p>
 *
 * <p>没有数据来源的部分（套餐分布、质量得分、数据变更次数、活跃/流失租户）
 * 不再拿假数字填满，改为在页面上写清楚缺什么。</p>
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { getTenantStatistics } from '../../utils/api'

const timeRange = ref('30d')
const loadError = ref('')

const summary = reactive({
  totalTenants: null,
  totalUsers: null,
  activeTenants: null,
  inactiveTenants: null,
  expiredTenants: null
})

const trends = ref([])
const rankings = ref([])
const regions = ref([])
const typeRows = ref([])

/** null 表示"这个数据没有来源"，0 表示"确实是零"，两者在页面上不能混为一谈。 */
const display = (value) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString()

/** 启用中占比。租户总数为 0 时不给百分比（0/0 无意义），显示"—"。 */
const activeRate = computed(() => {
  const total = summary.totalTenants
  if (!total) {
    return null
  }
  return Math.round(((summary.activeTenants ?? 0) / total) * 1000) / 10
})

const maxNewTenants = computed(() =>
  Math.max(1, ...trends.value.map((item) => item.newTenants ?? 0)),
)

const totalNewInRange = computed(() =>
  trends.value.reduce((sum, item) => sum + (item.newTenants ?? 0), 0),
)

/** 日期标签的显示间隔：桶多了就抽样显示，否则 30 个"09-14"会叠成一团。 */
const labelStep = computed(() => Math.max(1, Math.ceil(trends.value.length / 10)))

const barHeight = (value) => Math.round(((value ?? 0) / maxNewTenants.value) * 100)

const maxRegionCount = computed(() =>
  Math.max(1, ...regions.value.map((row) => row.count ?? 0)),
)

/** 条形宽度百分比。给一个 2% 的下限，否则数量为 0 的那一行完全看不见。 */
const ratio = (value, total) => {
  const base = Number(total) || 0
  if (!base) {
    return 0
  }
  return Math.max(2, Math.round(((Number(value) || 0) / base) * 100))
}

const TENANT_TYPE_LABELS = {
  ENTERPRISE: '企业租户',
  INDIVIDUAL: '个人租户',
  COOPERATIVE: '合作社',
  SYSTEM: '系统租户'
}

const tenantTypeLabel = (type) =>
  TENANT_TYPE_LABELS[String(type || '').toUpperCase()] || type || '—'

const loadData = async () => {
  try {
    const response = await getTenantStatistics({ timeRange: timeRange.value })
    if (response.code !== 200) {
      throw new Error(response.message || '接口返回失败')
    }
    const data = response.data ?? {}
    const dataSummary = data.summary ?? {}
    Object.assign(summary, {
      totalTenants: dataSummary.totalTenants ?? null,
      totalUsers: dataSummary.totalUsers ?? null,
      activeTenants: dataSummary.activeTenants ?? null,
      inactiveTenants: dataSummary.inactiveTenants ?? null,
      expiredTenants: dataSummary.expiredTenants ?? null
    })
    trends.value = data.trends ?? []
    rankings.value = data.rankings ?? []
    regions.value = data.regions ?? []
    typeRows.value = (data.tenantTypes ?? []).map((row) => ({
      name: tenantTypeLabel(row.name),
      count: row.count ?? 0
    }))
    loadError.value = ''
  } catch (error) {
    // 接口失败时**不再**退回一份写着假数字的页面：那会让人以为数据没问题，
    // 而实际上看到的是一份和库里毫无关系的报表。
    loadError.value =
      '加载租户统计失败：' + (error instanceof Error ? error.message : String(error))
    trends.value = []
    rankings.value = []
    regions.value = []
    typeRows.value = []
  }
}

/** 导出报表：把当前排行榜导成 CSV（真实数据，不再是一个点了没反应的按钮）。 */
const exportRankings = () => {
  const header = '排名,租户编码,租户名称,类型,用户数,组织数,状态'
  const rows = rankings.value.map((item) =>
    [
      item.rank,
      item.tenantId,
      item.tenantName,
      tenantTypeLabel(item.tenantType),
      item.userCount ?? '',
      item.orgCount ?? '',
      item.status ?? ''
    ].join(','),
  )
  const csv = [header, ...rows].join('\n')
  // 带 BOM，否则 Excel 打开中文列名是乱码
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `租户活跃度排行_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(loadData)

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

/* 柱子顶上的数值：鼠标悬停时用 title 还能看到完整信息，这里给个直接可读的数字 */
.chart-tip {
  font-size: 11px;
  color: #4a5568;
}

/* "未接入 / 暂无数据"的空状态：要看得见，但不能像错误一样刺眼 */
.chart-empty {
  margin: 12px 0 0;
  font-size: 13px;
  color: #a0aec0;
}

/* 说明文字：解释哪一块没有数据来源、缺的是哪张表 */
.chart-note {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #a0aec0;
}

.load-error {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(218, 54, 51, 0.08);
  color: #da3633;
  font-size: 13px;
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
