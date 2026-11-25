<template>
  <div class="role-list">
    <header class="page-header">
      <div>
        <h1>角色管理</h1>
        <p>统一查看平台公共角色、经营主体角色及其数据范围和成员使用情况。</p>
      </div>
      <div class="header-actions">
        <span class="source-tag">权限监管视图 · 系统角色不可修改</span>
      </div>
    </header>

    <section class="governance-note">
      <span class="note-icon">i</span>
      <p><strong>职责边界：</strong>主体内部角色由企业端维护；运营端负责平台公共角色、跨主体核查和应急修正；历史与系统内置角色只读。</p>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <span>角色总数</span>
        <strong>{{ summary.total }}</strong>
      </div>
      <div class="stat-card">
        <span>启用角色</span>
        <strong>{{ summary.active }}</strong>
      </div>
      <div class="stat-card">
        <span>系统角色</span>
        <strong>{{ summary.systemRoles }}</strong>
      </div>
      <div class="stat-card">
        <span>自定义角色</span>
        <strong>{{ summary.customRoles }}</strong>
      </div>
      <div class="stat-card">
        <span>平台 / 主体</span>
        <strong>{{ summary.platformRoles }}/{{ summary.subjectRoles }}</strong>
      </div>
      <div class="stat-card legacy-stat">
        <span>历史只读</span>
        <strong>{{ summary.legacyRoles }}</strong>
      </div>
    </section>

    <AgriVueTable
      :columns="columns"
      :data="roles"
      row-key="id"
      :loading="loading"
      loading-text="正在加载角色档案…"
      empty-text="暂无符合条件的角色"
      column-settings-storage-key="mds:cols:role-list"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      total-unit="个角色"
      @refresh="loadData"
      @update:page="goPage"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar
          :field-count="searchForm.ownership === 'SUBJECT' ? 5 : 4"
          :loading="loading"
          @search="handleSearch"
          @reset="resetSearch"
        >
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input
              v-model.trim="searchForm.keyword"
              class="mds-input"
              type="search"
              placeholder="角色名称 / 编码 / 标识 / 说明"
              @keyup.enter="handleSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>角色归属</label>
            <select v-model="searchForm.ownership" class="mds-select" @change="handleOwnershipChange">
              <option value="">全部归属</option>
              <option value="PLATFORM">平台公共角色</option>
              <option value="SUBJECT">指定经营主体</option>
            </select>
          </div>
          <div v-if="searchForm.ownership === 'SUBJECT'" class="agri-vue-filter-field">
            <label>经营主体</label>
            <select v-model="searchForm.tenantId" class="mds-select" @change="handleSearch">
              <option value="">全部经营主体</option>
              <option v-for="subject in subjects" :key="subject.id" :value="String(subject.id)">
                {{ subject.tenantName }}
              </option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>角色类型</label>
            <select v-model="searchForm.roleType" class="mds-select" @change="handleSearch">
              <option value="">全部类型</option>
              <option value="system">系统角色</option>
              <option value="custom">自定义角色</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <select v-model="searchForm.status" class="mds-select" @change="handleSearch">
              <option value="">全部状态</option>
              <option value="1">启用</option>
              <option value="0">停用</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button class="mds-btn mds-btn--primary" v-point="'POST /admin/masterdata/permission/role'" @click="openCreate">+ 新增角色</button>
      </template>

      <template #cell-roleName="{ row }">
        <div class="mds-cell-inline" :title="`${row.roleName}（${row.roleCode} · ${row.roleKey || '未设置标识'}）${row.description ? ' - ' + row.description : ''}`">
          <button class="role-name mds-cell-main" @click="viewDetail(row.id)">{{ row.roleName }}</button>
          <span class="role-code mds-cell-sub">{{ row.roleCode }}</span>
        </div>
      </template>
      <template #cell-tenantName="{ row }">
        <div class="mds-cell-inline" :title="`${row.tenantName || '平台公共'} · ${row.ownershipLabel}`">
          <span class="mds-cell-main">{{ row.tenantName || '平台公共' }}</span>
          <span class="ownership-badge" :class="ownershipClass(row.ownershipType)">{{ row.ownershipLabel }}</span>
        </div>
      </template>
      <template #cell-roleType="{ row }">
        <span class="type-badge" :class="row.roleType">{{ row.roleType === 'system' ? '系统角色' : '自定义角色' }}</span>
      </template>
      <template #cell-dataScopeName="{ row }">
        <div class="mds-cell-main" :title="`${row.dataScopeName || '未设置'}（${row.dataScope || '—'}）`">{{ row.dataScopeName || '未设置' }}</div>
      </template>
      <template #cell-userCount="{ row }">
        {{ row.userCount ?? 0 }}
      </template>
      <template #cell-status="{ row }">
        <span class="status-badge" :class="row.status === 1 ? 'active' : 'inactive'">{{ row.status === 1 ? '启用' : '停用' }}</span>
      </template>
      <template #cell-updateTime="{ row }">
        {{ formatDateTime(row.updateTime || row.createTime) }}
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'view', label: '查看', onClick: () => viewDetail(row.id) },
            { key: 'edit', label: '编辑', point: 'PUT /admin/masterdata/permission/role/{id}', disabled: !row.editable, title: row.isSystem ? '系统角色只读' : row.legacy ? '历史角色只读' : '编辑角色', onClick: () => editRole(row) },
            { key: 'toggle', label: row.status === 1 ? '停用' : '启用', point: 'PUT /admin/masterdata/permission/role/{id}/status', disabled: !row.editable, onClick: () => toggleStatus(row) },
            { key: 'delete', label: '删除', danger: true, point: 'DELETE /admin/masterdata/permission/role/{id}', disabled: !row.editable, onClick: () => deleteRole(row) },
          ]"
        />
      </template>
    </AgriVueTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import {
  deleteRole as deleteRoleApi,
  getRoleList,
  getRoleSummary,
  getTenantList,
  updateRoleStatus,
} from '../../utils/api'

const columns = [
  { prop: 'roleName', label: '角色', width: 200, locked: true, ellipsis: false },
  { prop: 'tenantName', label: '归属', width: 175, ellipsis: false },
  { prop: 'roleType', label: '角色类型', width: 110, align: 'center', ellipsis: false },
  { prop: 'dataScopeName', label: '数据范围', width: 135 },
  { prop: 'userCount', label: '成员数', width: 92, kind: 'number' },
  { prop: 'status', label: '状态', width: 92, kind: 'status' },
  { prop: 'updateTime', label: '更新时间', width: 150 },
  { key: 'actions', label: '操作', width: 120, kind: 'action' },
]

const router = useRouter()
const loading = ref(false)
const roles = ref([])
const subjects = ref([])
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const summary = reactive({
  total: 0,
  active: 0,
  disabled: 0,
  systemRoles: 0,
  customRoles: 0,
  platformRoles: 0,
  subjectRoles: 0,
  legacyRoles: 0,
})
const searchForm = reactive({
  keyword: '',
  ownership: '',
  tenantId: '',
  roleType: '',
  status: '',
})

const queryParams = () => ({
  keyword: searchForm.keyword || undefined,
  ownership: searchForm.ownership || undefined,
  tenantId: searchForm.tenantId || undefined,
  roleType: searchForm.roleType || undefined,
  status: searchForm.status === '' ? undefined : Number(searchForm.status),
})

const loadSubjects = async () => {
  const response = await getTenantList({ pageNum: 1, pageSize: 500, tenantStatus: 'ACTIVE' })
  if (response.code !== 200) throw new Error(response.message || '经营主体加载失败')
  subjects.value = response.data?.list ?? []
}

const loadData = async () => {
  loading.value = true
  try {
    const [listResponse, summaryResponse] = await Promise.all([
      getRoleList({ pageNum: pageNum.value, pageSize: pageSize.value, ...queryParams() }),
      getRoleSummary(queryParams()),
    ])
    if (listResponse.code !== 200) throw new Error(listResponse.message || '角色列表加载失败')
    if (summaryResponse.code !== 200) throw new Error(summaryResponse.message || '角色统计加载失败')
    roles.value = listResponse.data?.list ?? []
    total.value = Number(listResponse.data?.total ?? 0)
    Object.assign(summary, summaryResponse.data ?? {})
  } catch (error) {
    roles.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '角色列表加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pageNum.value = 1
  void loadData()
}

const handleOwnershipChange = () => {
  if (searchForm.ownership !== 'SUBJECT') searchForm.tenantId = ''
  handleSearch()
}

const resetSearch = () => {
  Object.assign(searchForm, { keyword: '', ownership: '', tenantId: '', roleType: '', status: '' })
  handleSearch()
}

const goPage = (next) => {
  pageNum.value = next
  void loadData()
}
const changePageSize = (size) => {
  pageSize.value = size
  pageNum.value = 1
  void loadData()
}

const openCreate = () => {
  router.push({
    path: '/permission/role/new',
    query: searchForm.tenantId ? { tenantId: searchForm.tenantId } : {},
  })
}
const viewDetail = (id) => router.push(`/permission/role/${id}`)
const editRole = (role) => {
  if (!role.editable) return
  router.push(`/permission/role/${role.id}/edit`)
}

const toggleStatus = async (role) => {
  if (!role.editable) return
  const next = role.status === 1 ? 0 : 1
  if (!confirm(`确定要${next === 1 ? '启用' : '停用'}“${role.roleName}”吗？`)) return
  try {
    const response = await updateRoleStatus(role.id, next)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(next === 1 ? '角色已启用' : '角色已停用')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

const deleteRole = async (role) => {
  if (!role.editable) return
  if (!confirm(`确定删除“${role.roleName}”吗？角色编码将保留唯一性占用。`)) return
  try {
    const response = await deleteRoleApi(role.id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('角色已删除')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

const ownershipClass = (type) => String(type || '').toLowerCase()
const formatDateTime = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : '—'

onMounted(async () => {
  try {
    await loadSubjects()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '经营主体加载失败')
  }
  await loadData()
})
</script>

<style scoped>
.role-list { padding:0; color:#1f2937; }
.page-header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:8px; }
.page-header > div:first-child { display:flex; align-items:baseline; gap:10px; min-width:0; flex:1; }
.page-header h1 { margin:0; font-size:18px; line-height:28px; white-space:nowrap; }
.page-header p { margin:0; color:#8f959e; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.header-actions { display:flex; align-items:center; gap:8px; flex:none; }
.source-tag,.type-badge,.status-badge,.ownership-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; white-space:nowrap; }
.source-tag { background:#e9f6ef; color:#0f7a45; }
.add-btn,.search-btn,.reset-btn { height:32px; padding:0 14px; border:0; border-radius:6px; font-size:13px; cursor:pointer; }
.add-btn,.search-btn { background:#2d8f4e; color:#fff; }
.reset-btn { border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.governance-note { display:flex; align-items:center; gap:8px; padding:6px 12px; margin-bottom:8px; border-left:3px solid #2d8f4e; border-radius:0 6px 6px 0; background:#e9f6ef; }
.note-icon { width:18px; height:18px; display:grid; place-items:center; flex:0 0 auto; border-radius:50%; background:#2d8f4e; color:#fff; font-size:12px; font-weight:600; }
.governance-note strong { color:#065f46; font-size:12px; }
.governance-note p { margin:0; color:#1f4d35; font-size:12px; line-height:1.45; }
.stats-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; margin-bottom:8px; }
.stat-card { display:flex; align-items:baseline; justify-content:space-between; gap:6px; padding:7px 12px; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.stat-card span { color:#646a73; font-size:12px; white-space:nowrap; }
.stat-card strong { margin:0; color:#1f3b2a; font-size:18px; line-height:24px; font-family:ui-monospace,Consolas,monospace; }
.legacy-stat strong { color:#6b7280; }
.table-card { overflow:hidden; border:1px solid #e5e8ec; border-radius:8px; background:#fff; }
.filter-card { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:8px 14px; background:#fcfcfd; border-bottom:1px solid #f0f2f5; }
.search-input { min-width:240px; flex:1; height:32px; padding:0 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; }
.filter-select { min-width:128px; height:32px; padding:0 10px; border:1px solid #d1d5db; border-radius:6px; background:#fff; font-size:13px; }
.subject-select { min-width:200px; }
.search-input:focus,.filter-select:focus { outline:none; border-color:#2d8f4e; box-shadow:0 0 0 3px rgba(45,143,78,.12); }
.table-wrap { overflow:auto; }
.data-table { width:100%; min-width:1120px; border-collapse:collapse; }
.data-table th,.data-table td { height:48px; padding:5px 10px; border-bottom:1px solid #f0f0f0; text-align:left; vertical-align:middle; }
.data-table th { background:#fafafa; color:#595959; font-size:12px; font-weight:600; white-space:nowrap; }
.data-table td { color:#334155; font-size:14px; }
.role-name { padding:0; border:0; background:none; color:#0f7a45; font-weight:600; text-align:left; cursor:pointer; }
.role-name:hover { color:#2d8f4e; text-decoration:underline; }
.role-code { color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size:12px; }
.ownership-badge { padding:1px 7px; font-size:12px; flex:none; }
.ownership-badge.platform { background:#eff6ff; color:#1d4ed8; }
.ownership-badge.subject { background:#e9f6ef; color:#0f7a45; }
.ownership-badge.legacy { background:#f3f4f6; color:#6b7280; }
.type-badge.system { background:#fff7ed; color:#c2410c; }
.type-badge.custom { background:#f5f3ff; color:#6d28d9; }
.status-badge.active { background:#e9f6ef; color:#0f7a45; }
.status-badge.inactive { background:#f3f4f6; color:#6b7280; }
.empty-cell { padding:32px !important; text-align:center !important; color:#9ca3af !important; }
.action-cell { min-width:190px; white-space:nowrap; }
.action-btn { margin-right:5px; padding:4px 8px; border:0; border-radius:6px; cursor:pointer; }
.action-btn:last-child { margin-right:0; }
.action-btn.view { color:#0369a1; background:#e0f2fe; }
.action-btn.edit { color:#0f7a45; background:#e9f6ef; }
.action-btn.status { color:#b45309; background:#fffbeb; }
.action-btn.delete { color:#b91c1c; background:#fef2f2; }
.action-btn:disabled { opacity:.4; cursor:not-allowed; }
.pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:10px 14px; color:#6b7280; font-size:12.5px; }
.pagination button { padding:5px 11px; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; }
.pagination button:disabled { opacity:.45; cursor:not-allowed; }
@media(max-width:1200px){.stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){.page-header{align-items:flex-start;flex-direction:column}.header-actions{width:100%;justify-content:space-between}.search-input{min-width:100%}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
