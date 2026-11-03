<template>
  <div class="stats-page">
    <header class="page-head">
      <div>
        <h1>主体数据统计</h1>
        <p>基于统一经营主体的真实数量、认证状态、成员活跃度和新增趋势。</p>
      </div>
      <select v-model="timeRange" @change="load">
        <option value="7d">近 7 天</option>
        <option value="30d">近 30 天</option>
        <option value="90d">近 90 天</option>
        <option value="1y">近一年</option>
      </select>
    </header>

    <div v-if="loadError" class="error-banner">{{ loadError }}</div>

    <section class="kpi-grid">
      <div v-for="item in kpis" :key="item.label" class="kpi-card">
        <span class="kpi-icon">{{ item.icon }}</span>
        <div><small>{{ item.label }}</small><strong>{{ item.value }}</strong><p>{{ item.hint }}</p></div>
      </div>
    </section>

    <div class="chart-grid">
      <section class="card growth-card">
        <div class="card-head">
          <div><h2>主体新增趋势</h2><p>{{ rangeText }}按主体创建时间统计</p></div>
          <span class="total-badge">区间新增 {{ totalNew }}</span>
        </div>
        <div class="bar-chart">
          <div v-for="(item, index) in trends" :key="`${item.date}-${index}`" class="bar-cell">
            <span class="bar-value">{{ item.newTenants || '' }}</span>
            <div class="bar-track"><i :style="{ height: barHeight(item.newTenants) + '%' }" /></div>
            <span class="bar-label">{{ index % labelStep === 0 ? item.date : '' }}</span>
          </div>
        </div>
        <div v-if="!trends.length" class="empty-inline">暂无趋势数据</div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>主体类型</h2><p>企业主体与个人主体占比</p></div></div>
        <div class="distribution-list">
          <div v-for="row in typeRows" :key="row.name">
            <div class="distribution-head"><span>{{ typeText(row.name) }}</span><strong>{{ row.count }}</strong></div>
            <div class="distribution-track"><i :style="{ width: ratio(row.count, summary.totalTenants) + '%' }" /></div>
          </div>
        </div>
        <p v-if="!typeRows.length" class="empty-inline">暂无数据</p>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>认证状态</h2><p>主体当前认证阶段分布</p></div></div>
        <div class="distribution-list">
          <div v-for="row in verifyRows" :key="row.name">
            <div class="distribution-head"><span>{{ verifyText(row.name) }}</span><strong>{{ row.count }}</strong></div>
            <div class="distribution-track"><i :class="statusClass(row.name)" :style="{ width: ratio(row.count, summary.totalTenants) + '%' }" /></div>
          </div>
        </div>
        <p v-if="!verifyRows.length" class="empty-inline">暂无数据</p>
      </section>
    </div>

    <section class="card ranking-card">
      <div class="card-head">
        <div><h2>主体成员活跃度排行</h2><p>按当前主体有效成员数量排序，最多展示前 10 个主体。</p></div>
        <button class="export" @click="exportRankings">导出 CSV</button>
      </div>
      <table>
        <thead><tr><th>排名</th><th>经营主体</th><th>类型</th><th>成员数</th><th>组织数</th><th>主体状态</th></tr></thead>
        <tbody>
          <tr v-if="rankings.length === 0"><td colspan="6" class="empty-cell">暂无主体数据</td></tr>
          <tr v-for="row in rankings" :key="row.tenantId">
            <td><span class="rank" :class="{ top: row.rank <= 3 }">{{ row.rank }}</span></td>
            <td><strong>{{ row.tenantName }}</strong><small>{{ row.tenantId }}</small></td>
            <td>{{ typeText(row.tenantType) }}</td>
            <td>{{ display(row.userCount) }}</td>
            <td>{{ display(row.orgCount) }}</td>
            <td>{{ row.status || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="scope-card">
      <div>
        <h2>统计口径</h2>
        <p>主体、类型、状态、新增时间和认证状态均来自统一经营主体；成员数和组织数分别来自主体成员绑定和主体内组织。</p>
      </div>
      <div class="scope-tags">
        <span>结构化地域未采集</span>
        <span>套餐归属未建立</span>
        <span>质量得分未汇总</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getTenantStatistics } from '../../utils/api'

const timeRange = ref('30d')
const loadError = ref('')
const trends = ref([])
const rankings = ref([])
const typeRows = ref([])
const verifyRows = ref([])
const summary = reactive({
  totalTenants: null,
  enterpriseTenants: null,
  individualTenants: null,
  activeTenants: null,
  inactiveTenants: null,
  totalUsers: null,
})

const display = (value) => value === null || value === undefined ? '—' : Number(value).toLocaleString('zh-CN')
const activeRate = computed(() => !summary.totalTenants ? null : `${Math.round((summary.activeTenants || 0) / summary.totalTenants * 1000) / 10}%`)
const kpis = computed(() => [
  { icon: '🏢', label: '主体总数', value: display(summary.totalTenants), hint: '统一经营主体' },
  { icon: '🏭', label: '企业主体', value: display(summary.enterpriseTenants), hint: '企业会员主体' },
  { icon: '👤', label: '个人主体', value: display(summary.individualTenants), hint: '个人会员主体' },
  { icon: '✅', label: '启用率', value: activeRate.value || '—', hint: `${display(summary.activeTenants)} 个主体启用中` },
])
const rangeText = computed(() => ({ '7d': '近 7 天', '30d': '近 30 天', '90d': '近 90 天', '1y': '近一年' }[timeRange.value]))
const maxNew = computed(() => Math.max(1, ...trends.value.map(item => Number(item.newTenants) || 0)))
const totalNew = computed(() => trends.value.reduce((sum, item) => sum + (Number(item.newTenants) || 0), 0))
const labelStep = computed(() => Math.max(1, Math.ceil(trends.value.length / 10)))
const barHeight = (value) => Math.round((Number(value) || 0) / maxNew.value * 100)
const ratio = (value, total) => !total ? 0 : Math.max(2, Math.round((Number(value) || 0) / total * 100))
const typeText = (type) => ({ ENTERPRISE: '企业主体', INDIVIDUAL: '个人主体' }[String(type || '').toUpperCase()] || type || '—')
const verifyText = (status) => ({ approved: '已认证', pending: '审核中', rejected: '已驳回', unverified: '未认证', draft: '草稿' }[status] || status || '未认证')
const statusClass = (status) => ({ approved: 'ok', pending: 'warn', rejected: 'danger', draft: 'draft' }[status] || '')

const load = async () => {
  loadError.value = ''
  try {
    const response = await getTenantStatistics({ timeRange: timeRange.value })
    if (response.code !== 200) throw new Error(response.message || '主体统计加载失败')
    const data = response.data ?? {}
    const source = data.summary ?? {}
    Object.assign(summary, {
      totalTenants: source.totalTenants ?? null,
      enterpriseTenants: source.enterpriseTenants ?? null,
      individualTenants: source.individualTenants ?? null,
      activeTenants: source.activeTenants ?? null,
      inactiveTenants: source.inactiveTenants ?? null,
      totalUsers: source.totalUsers ?? null,
    })
    trends.value = data.trends ?? []
    rankings.value = data.rankings ?? []
    typeRows.value = data.tenantTypes ?? []
    verifyRows.value = data.verificationStatuses ?? []
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '主体统计加载失败'
    trends.value = []
    rankings.value = []
    typeRows.value = []
    verifyRows.value = []
  }
}

const exportRankings = () => {
  const header = '排名,主体ID,主体名称,类型,成员数,组织数,状态'
  const rows = rankings.value.map(item => [
    item.rank, item.tenantId, item.tenantName, typeText(item.tenantType),
    item.userCount ?? '', item.orgCount ?? '', item.status ?? '',
  ].join(','))
  const blob = new Blob(['\ufeff' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `主体统计_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(load)
</script>

<style scoped>
.stats-page { padding:20px; color:#1f2937; }
.page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.page-head select { height:38px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
.error-banner { margin-bottom:14px; padding:11px 13px; border-radius:8px; background:#fef2f2; color:#b91c1c; }
.kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:14px; }
.kpi-card { display:flex; gap:12px; padding:16px; border:1px solid #e3eae5; border-radius:10px; background:#fff; }
.kpi-icon { width:40px; height:40px; display:grid; place-items:center; flex:none; border-radius:10px; background:#ecfdf5; font-size:19px; }
.kpi-card small,.kpi-card strong,.kpi-card p { display:block; }
.kpi-card small { color:#8a9890; font-size: var(--agri-font-size-micro); }
.kpi-card strong { margin:4px 0; color:#0f6740; font-size:23px; }
.kpi-card p { margin:0; color:#9ca3af; font-size: var(--agri-font-size-micro); }
.chart-grid { display:grid; grid-template-columns:1.3fr .7fr .7fr; gap:14px; margin-bottom:14px; }
.card { padding:18px; border:1px solid #e3eae5; border-radius:10px; background:#fff; }
.card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:15px; }
.card-head h2 { margin:0; font-size:16px; }
.card-head p { margin:4px 0 0; color:#94a3b8; font-size: var(--agri-font-size-micro); }
.total-badge { padding:5px 9px; border-radius:999px; background:#ecfdf5; color:#047857; font-size: var(--agri-font-size-micro); }
.bar-chart { height:220px; display:flex; align-items:flex-end; gap:3px; overflow-x:auto; }
.bar-cell { min-width:9px; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; flex:1; }
.bar-value { min-height:16px; color:#64748b; font-size: var(--agri-font-size-micro); }
.bar-track { width:70%; height:165px; display:flex; align-items:flex-end; }
.bar-track i { width:100%; min-height:2px; border-radius:4px 4px 0 0; background:linear-gradient(#10b981,#047857); }
.bar-label { margin-top:5px; color:#94a3b8; font-size: var(--agri-font-size-micro); white-space:nowrap; }
.distribution-list { display:flex; flex-direction:column; gap:16px; }
.distribution-head { display:flex; justify-content:space-between; margin-bottom:6px; color:#4b5563; font-size:12px; }
.distribution-head strong { color:#0f6740; }
.distribution-track { height:8px; overflow:hidden; border-radius:999px; background:#edf1ee; }
.distribution-track i { display:block; height:100%; border-radius:999px; background:#10b981; }
.distribution-track i.warn { background:#f59e0b; }
.distribution-track i.danger { background:#ef4444; }
.distribution-track i.draft { background:#94a3b8; }
.ranking-card { margin-bottom:14px; overflow-x:auto; }
.export { height:34px; padding:0 13px; border:1px solid #a7d9bf; border-radius:7px; background:#ecfdf5; color:#047857; cursor:pointer; }
table { width:100%; min-width:850px; border-collapse:collapse; }
th,td { padding:11px 12px; border-bottom:1px solid #edf0f2; text-align:left; font-size:12.5px; }
th { background:#f8fafc; color:#64748b; font-size: var(--agri-font-size-micro); }
td strong,td small { display:block; }
td small { margin-top:3px; color:#9ca3af; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
.rank { width:26px; height:26px; display:grid; place-items:center; border-radius:50%; background:#f1f5f3; color:#64748b; font-size: var(--agri-font-size-micro); }
.rank.top { background:#fff7e6; color:#b45309; }
.empty-inline,.empty-cell { padding:28px !important; color:#9ca3af; text-align:center; }
.scope-card { display:flex; justify-content:space-between; gap:20px; padding:17px; border-radius:10px; background:linear-gradient(120deg,#f8fcf9,#f1f8ff); }
.scope-card h2 { margin:0 0 5px; font-size:15px; }
.scope-card p { margin:0; color:#718078; font-size:12px; line-height:1.6; }
.scope-tags { display:flex; align-items:center; flex-wrap:wrap; gap:7px; }
.scope-tags span { padding:5px 9px; border-radius:999px; background:#fff; color:#64748b; font-size: var(--agri-font-size-micro); }
@media(max-width:1050px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-grid{grid-template-columns:1fr 1fr}.growth-card{grid-column:1/-1}}
@media(max-width:650px){.page-head,.scope-card{flex-direction:column}.kpi-grid,.chart-grid{grid-template-columns:1fr}.growth-card{grid-column:auto}}
</style>
