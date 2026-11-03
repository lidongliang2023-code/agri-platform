<template>
  <div class="role-list">
    <header class="page-header">
      <div>
        <h1>角色管理</h1>
        <p>统一查看平台公共角色、经营主体角色及其数据范围和成员使用情况。</p>
      </div>
      <div class="header-actions">
        <span class="source-tag">权限监管视图</span>
        <button class="add-btn" v-point="'POST /admin/masterdata/permission/role'" @click="openCreate">+ 新增角色</button>
      </div>
    </header>

    <section class="governance-note">
      <span class="note-icon">i</span>
      <div>
        <strong>职责边界</strong>
        <p>主体内部角色的日常维护由主体负责人或管理员在个人中心完成。运营端负责平台公共角色、跨主体核查和应急修正；历史主体角色与系统内置角色只读。</p>
      </div>
    </section>

    <section class="filter-card">
      <input
        v-model.trim="searchForm.keyword"
        class="search-input"
        type="search"
        placeholder="搜索角色名称、编码、标识或说明"
        @keyup.enter="handleSearch"
      />
      <select v-model="searchForm.ownership" class="filter-select" @change="handleOwnershipChange">
        <option value="">全部归属</option>
        <option value="PLATFORM">平台公共角色</option>
        <option value="SUBJECT">指定经营主体</option>
      </select>
      <select
        v-if="searchForm.ownership === 'SUBJECT'"
        v-model="searchForm.tenantId"
        class="filter-select subject-select"
        @change="handleSearch"
      >
        <option value="">全部经营主体</option>
        <option v-for="subject in subjects" :key="subject.id" :value="String(subject.id)">
          {{ subject.tenantName }}
        </option>
      </select>
      <select v-model="searchForm.roleType" class="filter-select" @change="handleSearch">
        <option value="">全部类型</option>
        <option value="system">系统角色</option>
        <option value="custom">自定义角色</option>
      </select>
      <select v-model="searchForm.status" class="filter-select" @change="handleSearch">
        <option value="">全部状态</option>
        <option value="1">启用</option>
        <option value="0">停用</option>
      </select>
      <button class="search-btn" @click="handleSearch">查询</button>
      <button class="reset-btn" @click="resetSearch">重置</button>
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
        <span>平台 / 主体角色</span>
        <strong>{{ summary.platformRoles }} / {{ summary.subjectRoles }}</strong>
      </div>
      <div class="stat-card legacy-stat">
        <span>历史只读角色</span>
        <strong>{{ summary.legacyRoles }}</strong>
      </div>
    </section>

    <section class="table-card">
      <div class="card-toolbar">
        <div>
          <h2>角色档案</h2>
          <span>共 {{ total }} 个角色 · 运营端应急维护与跨主体核查</span>
        </div>
        <span class="readonly-hint">系统角色不可修改</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>角色</th>
              <th>归属</th>
              <th>角色类型</th>
              <th>数据范围</th>
              <th>成员数</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="empty-cell">正在加载角色档案…</td>
            </tr>
            <tr v-else-if="roles.length === 0">
              <td colspan="8" class="empty-cell">暂无符合条件的角色</td>
            </tr>
            <template v-else>
            <tr v-for="role in roles" :key="role.id">
              <td>
                <button class="role-name" @click="viewDetail(role.id)">{{ role.roleName }}</button>
                <div class="role-code">{{ role.roleCode }} · {{ role.roleKey || '未设置标识' }}</div>
                <small v-if="role.description">{{ role.description }}</small>
              </td>
              <td>
                <div>{{ role.tenantName || '平台公共' }}</div>
                <span class="ownership-badge" :class="ownershipClass(role.ownershipType)">
                  {{ role.ownershipLabel }}
                </span>
              </td>
              <td>
                <span class="type-badge" :class="role.roleType">
                  {{ role.roleType === 'system' ? '系统角色' : '自定义角色' }}
                </span>
              </td>
              <td>
                <div>{{ role.dataScopeName || '未设置' }}</div>
                <small>{{ role.dataScope || '—' }}</small>
              </td>
              <td>{{ role.userCount ?? 0 }}</td>
              <td>
                <span class="status-badge" :class="role.status === 1 ? 'active' : 'inactive'">
                  {{ role.status === 1 ? '启用' : '停用' }}
                </span>
              </td>
              <td>{{ formatDateTime(role.updateTime || role.createTime) }}</td>
              <td class="action-cell">
                <button class="action-btn view" @click="viewDetail(role.id)">查看</button>
                <button
                  v-point="'PUT /admin/masterdata/permission/role/{id}'"
                  class="action-btn edit"
                  :disabled="!role.editable"
                  :title="role.isSystem ? '系统角色只读' : role.legacy ? '历史角色只读' : '编辑角色'"
                  @click="editRole(role)"
                >编辑</button>
                <button
                  v-point="'PUT /admin/masterdata/permission/role/{id}/status'"
                  class="action-btn status"
                  :disabled="!role.editable"
                  @click="toggleStatus(role)"
                >{{ role.status === 1 ? '停用' : '启用' }}</button>
                <button class="action-btn delete" v-point="'DELETE /admin/masterdata/permission/role/{id}'" :disabled="!role.editable" @click="deleteRole(role)">删除</button>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <span>共 {{ total }} 个角色</span>
        <button :disabled="pageNum === 1" @click="changePage(-1)">上一页</button>
        <span>第 {{ pageNum }} / {{ totalPages }} 页</span>
        <button :disabled="pageNum >= totalPages" @click="changePage(1)">下一页</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  deleteRole as deleteRoleApi,
  getRoleList,
  getRoleSummary,
  getTenantList,
  updateRoleStatus,
} from '../../utils/api'

const router = useRouter()
const loading = ref(false)
const roles = ref([])
const subjects = ref([])
const pageNum = ref(1)
const pageSize = 20
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
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
      getRoleList({ pageNum: pageNum.value, pageSize, ...queryParams() }),
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

const changePage = (delta) => {
  const next = pageNum.value + delta
  if (next < 1 || next > totalPages.value) return
  pageNum.value = next
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
.role-list { padding:20px; color:#1f2937; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }
.page-header h1 { margin:0 0 6px; font-size:24px; }
.page-header p { margin:0; color:#6b7280; }
.header-actions { display:flex; align-items:center; gap:10px; }
.source-tag,.type-badge,.status-badge,.ownership-badge { display:inline-block; padding:4px 9px; border-radius:999px; font-size:12px; white-space:nowrap; }
.source-tag { background:#ecfdf5; color:#047857; }
.add-btn,.search-btn,.reset-btn { height:38px; padding:0 18px; border:0; border-radius:8px; cursor:pointer; }
.add-btn,.search-btn { background:#10b981; color:#fff; }
.reset-btn { background:#f3f4f6; color:#4b5563; }
.governance-note { display:flex; gap:12px; padding:14px 16px; margin-bottom:14px; border:1px solid #d1fae5; border-radius:10px; background:#f0fdf4; }
.note-icon { width:22px; height:22px; display:grid; place-items:center; flex:0 0 auto; border-radius:50%; background:#10b981; color:#fff; font-family:Georgia,serif; font-weight:700; }
.governance-note strong { display:block; margin-bottom:3px; color:#065f46; font-size:13px; }
.governance-note p { margin:0; color:#4b7c68; font-size:12.5px; line-height:1.65; }
.filter-card { display:flex; flex-wrap:wrap; gap:10px; padding:16px; margin-bottom:14px; border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.search-input { min-width:300px; flex:1; height:38px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; }
.filter-select { min-width:145px; height:38px; padding:0 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
.subject-select { min-width:240px; }
.search-input:focus,.filter-select:focus { outline:none; border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.stats-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin-bottom:14px; }
.stat-card { padding:14px 16px; border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.stat-card span,.stat-card strong { display:block; }
.stat-card span { color:#94a3b8; font-size:12px; }
.stat-card strong { margin-top:7px; color:#1f3b2a; font-size:21px; }
.legacy-stat strong { color:#6b7280; }
.table-card { overflow:hidden; border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.card-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; border-bottom:1px solid #edf0f2; }
.card-toolbar h2 { margin:0 0 4px; font-size:16px; }
.card-toolbar span { color:#94a3b8; font-size:12px; }
.readonly-hint { padding:5px 10px; border-radius:999px; background:#f3f4f6; color:#6b7280 !important; }
.table-wrap { overflow:auto; }
.data-table { width:100%; min-width:1180px; border-collapse:collapse; }
.data-table th,.data-table td { padding:12px 14px; border-bottom:1px solid #edf0f2; text-align:left; vertical-align:top; }
.data-table th { background:#f8fafc; color:#64748b; font-size:12.5px; font-weight:600; white-space:nowrap; }
.data-table td { color:#334155; font-size:12.5px; }
.data-table td small { display:block; max-width:300px; margin-top:4px; color:#94a3b8; line-height:1.45; }
.role-name { padding:0; border:0; background:none; color:#065f46; font-weight:600; text-align:left; cursor:pointer; }
.role-name:hover { color:#10b981; }
.role-code { margin-top:4px; color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
.ownership-badge { margin-top:5px; padding:3px 8px; font-size: var(--agri-font-size-micro); }
.ownership-badge.platform { background:#eff6ff; color:#1d4ed8; }
.ownership-badge.subject { background:#ecfdf5; color:#047857; }
.ownership-badge.legacy { background:#f3f4f6; color:#6b7280; }
.type-badge.system { background:#fff7ed; color:#c2410c; }
.type-badge.custom { background:#f5f3ff; color:#6d28d9; }
.status-badge.active { background:#ecfdf5; color:#047857; }
.status-badge.inactive { background:#f3f4f6; color:#6b7280; }
.empty-cell { padding:42px !important; text-align:center !important; color:#9ca3af !important; }
.action-cell { min-width:205px; white-space:nowrap; }
.action-btn { margin-right:5px; padding:5px 9px; border:0; border-radius:6px; cursor:pointer; }
.action-btn:last-child { margin-right:0; }
.action-btn.view { color:#0369a1; background:#e0f2fe; }
.action-btn.edit { color:#047857; background:#ecfdf5; }
.action-btn.status { color:#b45309; background:#fffbeb; }
.action-btn.delete { color:#b91c1c; background:#fef2f2; }
.action-btn:disabled { opacity:.4; cursor:not-allowed; }
.pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:16px; color:#6b7280; font-size:12.5px; }
.pagination button { padding:6px 12px; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; }
.pagination button:disabled { opacity:.45; cursor:not-allowed; }
@media(max-width:1200px){.stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){.page-header{align-items:flex-start;flex-direction:column}.header-actions{width:100%;justify-content:space-between}.search-input{min-width:100%}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
