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

    <AgriVueTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      loading-text="正在加载配额数据…"
      empty-text="暂无主体配额数据"
      column-settings-storage-key="mds:cols:tenant-quota"
      :page="pageNum"
      :page-size="pageSize"
      :total="totalCount"
      @refresh="load"
      @update:page="goPage"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input v-model="filters.keyword" class="mds-input" placeholder="主体名称 / 编码 / 信用代码 / 手机号" @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>主体类型</label>
            <select v-model="filters.tenantType" class="mds-select" @change="search">
              <option value="">全部主体类型</option>
              <option value="ENTERPRISE">企业主体</option>
              <option value="INDIVIDUAL">个人主体</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-name="{ row }">
        <div class="mds-cell-inline" :title="`${row.name}（${row.code}）`">
          <span class="subject-name mds-cell-main">{{ row.name }}</span>
          <span class="subject-code mds-cell-sub">{{ row.code }}</span>
        </div>
      </template>
      <template #cell-type="{ row }">
        <span class="type-badge" :class="row.type === 'INDIVIDUAL' ? 'personal' : 'enterprise'">{{ typeText(row.type) }}</span>
      </template>
      <template #cell-userUsed="{ row }">
        <usage-cell :used="row.userUsed" :limit="row.userLimit" unit="" />
      </template>
      <template #cell-orgUsed="{ row }">
        <usage-cell :used="row.orgUsed" :limit="row.orgLimit" unit="" />
      </template>
      <template #cell-productUsed="{ row }">
        <usage-cell :used="row.productUsed" :limit="row.productLimit" unit="" />
      </template>
      <template #cell-storageUsed="{ row }">
        <usage-cell :used="row.storageUsed" :limit="row.storageLimit" unit="GB" />
      </template>
      <template #cell-apiUsed="{ row }">
        <usage-cell :used="row.apiUsed" :limit="row.apiLimit" unit="" />
      </template>
      <template #cell-hasQuota="{ row }">
        <span class="quota-state" :class="row.hasQuota ? 'ok' : 'off'">{{ row.hasQuota ? '已配置' : '未配置' }}</span>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'detail', label: '详情', onClick: () => viewDetail(row.id) },
            { key: 'edit', label: row.hasQuota ? '编辑配额' : '配置配额', onClick: () => editQuota(row.id) },
          ]"
        />
      </template>
    </AgriVueTable>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { getTenantQuotaOverview } from '../../utils/api'

const GB = 1024 ** 3
const router = useRouter()
const loading = ref(false)
const rows = ref([])
const pageNum = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const filters = reactive({ keyword: '', tenantType: '' })

const columns = [
  { prop: 'name', label: '经营主体', width: 200, locked: true, ellipsis: false },
  { prop: 'type', label: '类型', width: 96, align: 'center', ellipsis: false },
  { prop: 'userUsed', label: '用户', width: 120, align: 'left', ellipsis: false },
  { prop: 'orgUsed', label: '组织', width: 120, align: 'left', ellipsis: false },
  { prop: 'productUsed', label: '商品', width: 120, align: 'left', ellipsis: false },
  { prop: 'storageUsed', label: '存储', width: 130, align: 'left', ellipsis: false },
  { prop: 'apiUsed', label: 'API', width: 120, align: 'left', ellipsis: false },
  { prop: 'hasQuota', label: '配置状态', width: 96, kind: 'status' },
  { key: 'actions', label: '操作', width: 135, kind: 'action' },
]

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
      pageSize: pageSize.value,
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
  } catch (error) {
    rows.value = []
    totalCount.value = 0
    message.error(error instanceof Error ? error.message : '配额列表加载失败')
  } finally {
    loading.value = false
  }
}

const search = () => { pageNum.value = 1; void load() }
const reset = () => { Object.assign(filters, { keyword: '', tenantType: '' }); search() }
const goPage = (next) => {
  pageNum.value = next
  void load()
}
const changePageSize = (size) => {
  pageSize.value = size
  pageNum.value = 1
  void load()
}
const viewDetail = (id) => router.push(`/subject/quota/${id}`)
const editQuota = (id) => router.push(`/subject/quota/${id}/edit`)

onMounted(load)
</script>

<style scoped>
.quota-page { padding:0; color:#1f2937; }
.page-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.page-head > div { display:flex; align-items:baseline; gap:10px; min-width:0; flex:1; }
.page-head h1 { margin:0; font-size:18px; line-height:28px; white-space:nowrap; }
.page-head p { margin:0; color:#8f959e; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.source-tag { padding:4px 10px; border-radius:999px; background:#e9f6ef; color:#0f7a45; font-size:12px; white-space:nowrap; flex:none; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:8px; }
.summary-grid div { display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding:7px 14px; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.summary-grid span { display:block; color:#646a73; font-size:12px; white-space:nowrap; }
.summary-grid small { display:none; }
.summary-grid strong { display:block; margin:0; color:#0f6740; font-size:18px; line-height:24px; font-family:ui-monospace,Consolas,monospace; }
.summary-grid .warn { color:#b45309; }
.search-bar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:8px 14px; margin-bottom:8px; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.search-bar input { flex:1; min-width:260px; height:32px; padding:0 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; }
.search-bar select { min-width:136px; height:32px; padding:0 10px; border:1px solid #d1d5db; border-radius:6px; background:#fff; font-size:13px; }
.search-bar button { height:32px; padding:0 14px; border:1px solid #d1d5db; border-radius:6px; background:#fff; color:#4b5563; font-size:13px; cursor:pointer; }
.search-bar button.primary { border:0; background:#2d8f4e; color:#fff; }
.table-card { overflow:auto; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
table { width:100%; min-width:1180px; border-collapse:collapse; }
th,td { height:48px; padding:5px 10px; border-bottom:1px solid #f0f0f0; text-align:left; vertical-align:middle; }
th { background:#fafafa; color:#595959; font-size:12px; font-weight:600; }
.subject-name { font-weight:600; }
.subject-code { color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size:12px; }
.type-badge,.quota-state { padding:2px 8px; border-radius:999px; font-size:12px; white-space:nowrap; }
.type-badge.enterprise,.quota-state.ok { background:#e9f6ef; color:#0f7a45; }
.type-badge.personal { background:#eff6ff; color:#1d4ed8; }
.quota-state.off { background:#fff7ed; color:#c2410c; }
.actions { white-space:nowrap; }
.actions button { margin-right:6px; padding:4px 8px; border:0; border-radius:6px; background:#f3f4f6; color:#4b5563; cursor:pointer; }
.actions button.edit { background:#e9f6ef; color:#0f7a45; }
.pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:10px 14px; color:#6b7280; font-size:12.5px; }
.pagination button { padding:5px 11px; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; }
.pagination button:disabled { opacity:.45; cursor:not-allowed; }
.empty { padding:32px !important; text-align:center !important; color:#9ca3af !important; }
:deep(.usage) { display:flex; flex-direction:column; justify-content:center; gap:3px; min-width:96px; max-width:130px; }
:deep(.usage-text) { color:#64748b; font-size:12px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
:deep(.bar) { height:4px; overflow:hidden; border-radius:999px; background:#e8eeea; }
:deep(.bar i) { display:block; height:100%; border-radius:999px; background:#2d8f4e; }
:deep(.bar i.danger) { background:#ef4444; }
:deep(.unconfigured) { color:#94a3b8; font-size:12px; white-space:nowrap; }
@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.page-head{flex-direction:column;align-items:flex-start}.summary-grid{grid-template-columns:1fr}.search-bar input{min-width:100%}}
</style>
