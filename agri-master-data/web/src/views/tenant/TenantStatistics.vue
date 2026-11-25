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
        <p v-if="!typeRows.length" class="empty-inline">暂无主体类型分布数据</p>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>认证状态</h2><p>主体当前认证阶段分布</p></div></div>
        <div class="distribution-list">
          <div v-for="row in verifyRows" :key="row.name">
            <div class="distribution-head"><span>{{ verifyText(row.name) }}</span><strong>{{ row.count }}</strong></div>
            <div class="distribution-track"><i :class="statusClass(row.name)" :style="{ width: ratio(row.count, summary.totalTenants) + '%' }" /></div>
          </div>
        </div>
        <p v-if="!verifyRows.length" class="empty-inline">暂无认证状态分布数据</p>
      </section>
    </div>

    <AgriVueTable
      :columns="rankingColumns"
      :data="rankings"
      row-key="tenantId"
      empty-text="暂无主体数据"
      column-settings-storage-key="mds:cols:tenant-statistics-rank"
      client-pagination
      @refresh="load"
    >
      <template #toolbar-left>
        <strong style="font-size: 14px; color: #1f2937">主体成员活跃度排行</strong>
        <span class="mds-muted" style="font-size: 12px">按当前主体有效成员数量排序（前 10）</span>
        <button class="mds-btn" @click="exportRankings">导出 CSV</button>
      </template>

      <template #cell-rank="{ row }">
        <span class="rank" :class="{ top: row.rank <= 3 }">{{ row.rank }}</span>
      </template>
      <template #cell-tenantName="{ row }">
        <div class="mds-cell-inline" :title="`${row.tenantName}（${row.tenantId}）`">
          <strong class="mds-cell-main">{{ row.tenantName }}</strong>
          <span class="mds-cell-sub mds-mono">{{ row.tenantId }}</span>
        </div>
      </template>
      <template #cell-tenantType="{ row }">
        {{ typeText(row.tenantType) }}
      </template>
      <template #cell-userCount="{ row }">
        {{ display(row.userCount) }}
      </template>
      <template #cell-orgCount="{ row }">
        {{ display(row.orgCount) }}
      </template>
    </AgriVueTable>

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
import { AgriVueTable } from '@agri/shared/vue/list'
import { getTenantStatistics } from '../../utils/api'

const rankingColumns = [
  { prop: 'rank', label: '排名', width: 76, align: 'center', ellipsis: false },
  { prop: 'tenantName', label: '经营主体', minWidth: 220, locked: true, ellipsis: false },
  { prop: 'tenantType', label: '类型', width: 110 },
  { prop: 'userCount', label: '成员数', width: 110, kind: 'number' },
  { prop: 'orgCount', label: '组织数', width: 110, kind: 'number' },
  { prop: 'status', label: '主体状态', width: 110, kind: 'status' },
]

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
.stats-page { padding:0; color:#1f2937; }
.page-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:6px; }
.page-head > div { display:flex; align-items:baseline; gap:10px; min-width:0; flex:1; }
.page-head h1 { margin:0; font-size:18px; line-height:28px; white-space:nowrap; }
.page-head p { margin:0; color:#8f959e; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.page-head select { height:30px; padding:0 10px; border:1px solid #d1d5db; border-radius:6px; background:#fff; font-size:12.5px; }
.error-banner { margin-bottom:8px; padding:6px 12px; border-radius:6px; background:#fef2f2; color:#b91c1c; font-size:12px; }
.kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:6px; }
.kpi-card { display:flex; align-items:center; gap:8px; padding:6px 12px; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.kpi-icon { width:26px; height:26px; display:grid; place-items:center; flex:none; border-radius:6px; background:#e9f6ef; font-size:14px; }
.kpi-card > div { display:flex; align-items:baseline; justify-content:space-between; gap:8px; flex:1; min-width:0; }
.kpi-card small { color:#646a73; font-size:12px; white-space:nowrap; }
.kpi-card strong { margin:0; color:#0f6740; font-size:18px; line-height:22px; font-family:ui-monospace,Consolas,monospace; }
.kpi-card p { display:none; }
.chart-grid { display:grid; grid-template-columns:1.3fr .7fr .7fr; gap:8px; margin-bottom:8px; }
.card { padding:8px 12px; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.card-head { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
.card-head > div { display:flex; align-items:baseline; gap:8px; min-width:0; }
.card-head h2 { margin:0; font-size:14px; white-space:nowrap; }
.card-head p { margin:0; color:#94a3b8; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.total-badge { padding:2px 8px; border-radius:999px; background:#e9f6ef; color:#0f7a45; font-size:12px; white-space:nowrap; }
.bar-chart { height:88px; display:flex; align-items:flex-end; gap:3px; overflow-x:auto; }
.bar-cell { min-width:9px; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; flex:1; }
.bar-value { min-height:14px; color:#64748b; font-size:12px; line-height:1; }
.bar-track { width:70%; height:56px; display:flex; align-items:flex-end; }
.bar-track i { width:100%; min-height:2px; border-radius:3px 3px 0 0; background:linear-gradient(#2d8f4e,#0f7a45); }
.bar-label { margin-top:2px; color:#94a3b8; font-size:12px; line-height:1; white-space:nowrap; }
.distribution-list { display:flex; flex-direction:column; gap:6px; }
.distribution-head { display:flex; justify-content:space-between; margin-bottom:2px; color:#4b5563; font-size:12px; line-height:1.2; }
.distribution-head strong { color:#0f6740; }
.distribution-track { height:6px; overflow:hidden; border-radius:999px; background:#edf1ee; }
.distribution-track i { display:block; height:100%; border-radius:999px; background:#2d8f4e; }
.distribution-track i.warn { background:#f59e0b; }
.distribution-track i.danger { background:#ef4444; }
.distribution-track i.draft { background:#94a3b8; }
.ranking-card { padding:0; margin-bottom:10px; overflow:hidden; }
.ranking-head { padding:6px 14px; margin-bottom:0; border-bottom:1px solid #f0f2f5; }
.export { height:28px; padding:0 10px; border:1px solid #a7d9bf; border-radius:6px; background:#e9f6ef; color:#0f7a45; font-size:12px; cursor:pointer; }
.rank { width:22px; height:22px; display: inline-grid; place-items:center; border-radius:50%; background:#f1f5f3; color:#64748b; font-size:12px; }
.rank.top { background:#fff7e6; color:#b45309; font-weight:600; }
.empty-inline,.empty-cell { padding:18px !important; color:#9ca3af; text-align:center; }
.scope-card { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:10px 14px; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.scope-card h2 { margin:0 0 2px; font-size:13px; }
.scope-card p { margin:0; color:#718078; font-size:12px; line-height:1.4; }
.scope-tags { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.scope-tags span { padding:3px 8px; border-radius:999px; background:#f2f3f5; color:#64748b; font-size:12px; }
@media(max-width:1050px){.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-grid{grid-template-columns:1fr 1fr}.growth-card{grid-column:1/-1}}
@media(max-width:650px){.page-head,.scope-card{flex-direction:column;align-items:flex-start}.kpi-grid,.chart-grid{grid-template-columns:1fr}.growth-card{grid-column:auto}}
</style>
