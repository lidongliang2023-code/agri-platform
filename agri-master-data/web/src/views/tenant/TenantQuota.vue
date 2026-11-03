<template>
  <div class="quota-page">
    <header class="page-head">
      <div>
        <h1>主体资源配额</h1>
        <p>以统一经营主体为对象配置用户、组织、商品、存储和 API 限额。</p>
      </div>
      <span class="source-tag">统一主体 · 配额主档</span>
    </header>

    <div class="summary-grid">
      <div><span>当前结果</span><strong>{{ totalCount }}</strong><small>个经营主体</small></div>
      <div><span>已配置</span><strong>{{ configuredCount }}</strong><small>当前页已建立配额</small></div>
      <div><span>未配置</span><strong>{{ unconfiguredCount }}</strong><small>当前页待配置</small></div>
      <div><span>高用量</span><strong class="warn">{{ highUsageCount }}</strong><small>任一资源使用率 ≥ 80%</small></div>
    </div>

    <div class="search-bar">
      <input v-model="filters.keyword" placeholder="搜索主体名称、编码、信用代码或手机号" @keyup.enter="search" />
      <select v-model="filters.tenantType" @change="search">
        <option value="">全部主体类型</option>
        <option value="ENTERPRISE">企业主体</option>
        <option value="INDIVIDUAL">个人主体</option>
      </select>
      <button class="primary" @click="search">查询</button>
      <button @click="reset">重置</button>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>经营主体</th>
            <th>类型</th>
            <th>用户</th>
            <th>组织</th>
            <th>商品</th>
            <th>存储</th>
            <th>API</th>
            <th>配置状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="9" class="empty">正在加载配额数据…</td></tr>
          <tr v-else-if="rows.length === 0"><td colspan="9" class="empty">暂无主体配额数据</td></tr>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <div class="subject-name">{{ row.name }}</div>
              <div class="subject-code">{{ row.code }}</div>
            </td>
            <td><span class="type-badge" :class="row.type === 'INDIVIDUAL' ? 'personal' : 'enterprise'">{{ typeText(row.type) }}</span></td>
            <td><usage-cell :used="row.userUsed" :limit="row.userLimit" unit="" /></td>
            <td><usage-cell :used="row.orgUsed" :limit="row.orgLimit" unit="" /></td>
            <td><usage-cell :used="row.productUsed" :limit="row.productLimit" unit="" /></td>
            <td><usage-cell :used="row.storageUsed" :limit="row.storageLimit" unit="GB" /></td>
            <td><usage-cell :used="row.apiUsed" :limit="row.apiLimit" unit="" /></td>
            <td><span class="quota-state" :class="row.hasQuota ? 'ok' : 'off'">{{ row.hasQuota ? '已配置' : '未配置' }}</span></td>
            <td class="actions">
              <button @click="viewDetail(row.id)">详情</button>
              <button class="edit" @click="editQuota(row.id)">{{ row.hasQuota ? '编辑配额' : '配置配额' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <span>共 {{ totalCount }} 条</span>
        <button :disabled="pageNum <= 1" @click="changePage(-1)">上一页</button>
        <span>第 {{ pageNum }} / {{ totalPages }} 页</span>
        <button :disabled="pageNum >= totalPages" @click="changePage(1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getTenantQuotaOverview } from '../../utils/api'

const PAGE_SIZE = 20
const GB = 1024 ** 3
const router = useRouter()
const loading = ref(false)
const rows = ref([])
const pageNum = ref(1)
const totalCount = ref(0)
const totalPages = ref(1)
const filters = reactive({ keyword: '', tenantType: '' })

const UsageCell = defineComponent({
  props: { used: Number, limit: Number, unit: { type: String, default: '' } },
  setup(props) {
    return () => {
      if (props.limit === null || props.limit === undefined) {
        return h('span', { class: 'unconfigured' }, `${formatValue(props.used, props.unit)} / —`)
      }
      const percent = props.limit > 0 ? Math.min(100, Math.round((props.used || 0) / props.limit * 100)) : 0
      return h('div', { class: 'usage' }, [
        h('div', { class: 'usage-text' }, `${formatValue(props.used, props.unit)} / ${formatValue(props.limit, props.unit)}`),
        h('div', { class: 'bar' }, [
          h('i', { class: percent >= 80 ? 'danger' : '', style: { width: `${percent}%` } }),
        ]),
      ])
    }
  },
})

const formatValue = (value, unit) => {
  if (value === null || value === undefined) return '—'
  const number = unit === 'GB' ? Math.round(Number(value) / GB * 10) / 10 : Number(value)
  return `${number.toLocaleString('zh-CN')}${unit === 'GB' ? ' GB' : ''}`
}

const typeText = (type) => type === 'INDIVIDUAL' ? '个人主体' : '企业主体'
const configuredCount = computed(() => rows.value.filter(item => item.hasQuota).length)
const unconfiguredCount = computed(() => rows.value.filter(item => !item.hasQuota).length)
const highUsageCount = computed(() => rows.value.filter(item => [
  [item.userUsed, item.userLimit],
  [item.orgUsed, item.orgLimit],
  [item.productUsed, item.productLimit],
  [item.storageUsed, item.storageLimit],
  [item.apiUsed, item.apiLimit],
].some(([used, limit]) => Number(limit) > 0 && Number(used || 0) / Number(limit) >= 0.8)).length)

const load = async () => {
  loading.value = true
  try {
    const response = await getTenantQuotaOverview({
      pageNum: pageNum.value,
      pageSize: PAGE_SIZE,
      keyword: filters.keyword || undefined,
      tenantType: filters.tenantType || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '配额列表加载失败')
    rows.value = (response.data?.list ?? []).map(item => ({
      ...item,
      name: item.tenantName,
      code: item.tenantCode,
      type: item.tenantType,
    }))
    totalCount.value = Number(response.data?.total ?? 0)
    totalPages.value = Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE))
  } catch (error) {
    rows.value = []
    totalCount.value = 0
    totalPages.value = 1
    message.error(error instanceof Error ? error.message : '配额列表加载失败')
  } finally {
    loading.value = false
  }
}

const search = () => { pageNum.value = 1; void load() }
const reset = () => { Object.assign(filters, { keyword: '', tenantType: '' }); search() }
const changePage = (delta) => {
  const next = pageNum.value + delta
  if (next < 1 || next > totalPages.value) return
  pageNum.value = next
  void load()
}
const viewDetail = (id) => router.push(`/subject/quota/${id}`)
const editQuota = (id) => router.push(`/subject/quota/${id}/edit`)

onMounted(load)
</script>

<style scoped>
.quota-page { padding:20px; color:#1f2937; }
.page-head { display:flex; justify-content:space-between; gap:16px; margin-bottom:18px; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.source-tag { align-self:flex-start; padding:7px 12px; border-radius:999px; background:#ecfdf5; color:#047857; font-size:12px; white-space:nowrap; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
.summary-grid div { padding:15px; border:1px solid #e3eae5; border-radius:10px; background:#fff; }
.summary-grid span,.summary-grid small { display:block; color:#8a9890; font-size: var(--agri-font-size-micro); }
.summary-grid strong { display:block; margin:6px 0; color:#0f6740; font-size:24px; }
.summary-grid .warn { color:#b45309; }
.search-bar { display:flex; flex-wrap:wrap; gap:9px; padding:14px; margin-bottom:14px; border-radius:10px; background:#fff; }
.search-bar input { flex:1; min-width:300px; height:38px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; }
.search-bar select { min-width:145px; height:38px; padding:0 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
.search-bar button { height:38px; padding:0 17px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#4b5563; cursor:pointer; }
.search-bar button.primary { border:0; background:#10b981; color:#fff; }
.table-card { overflow:auto; border-radius:10px; background:#fff; }
table { width:100%; min-width:1180px; border-collapse:collapse; }
th,td { padding:12px 14px; border-bottom:1px solid #edf0f2; text-align:left; vertical-align:middle; }
th { background:#f8fafc; color:#4b5563; font-size:12px; }
.subject-name { font-weight:600; }
.subject-code { margin-top:3px; color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
.type-badge,.quota-state { padding:3px 9px; border-radius:999px; font-size: var(--agri-font-size-micro); white-space:nowrap; }
.type-badge.enterprise,.quota-state.ok { background:#ecfdf5; color:#047857; }
.type-badge.personal { background:#eff6ff; color:#1d4ed8; }
.quota-state.off { background:#fff7ed; color:#c2410c; }
.actions { white-space:nowrap; }
.actions button { margin-right:6px; padding:5px 9px; border:0; border-radius:6px; background:#f3f4f6; color:#4b5563; cursor:pointer; }
.actions button.edit { background:#ecfdf5; color:#047857; }
.pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:15px; color:#6b7280; font-size:12.5px; }
.pagination button { padding:6px 11px; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; }
.pagination button:disabled { opacity:.45; cursor:not-allowed; }
.empty { padding:40px !important; text-align:center !important; color:#9ca3af !important; }
:deep(.usage) { min-width:128px; }
:deep(.usage-text) { margin-bottom:4px; color:#64748b; font-size: var(--agri-font-size-micro); }
:deep(.bar) { height:7px; overflow:hidden; border-radius:999px; background:#e8eeea; }
:deep(.bar i) { display:block; height:100%; border-radius:999px; background:#10b981; }
:deep(.bar i.danger) { background:#ef4444; }
:deep(.unconfigured) { color:#94a3b8; font-size: var(--agri-font-size-micro); }
@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.page-head{flex-direction:column}.summary-grid{grid-template-columns:1fr}.search-bar input{min-width:100%}}
</style>
