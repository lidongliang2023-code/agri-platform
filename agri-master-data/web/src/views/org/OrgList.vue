<template>
  <div class="mds-page">
    <PageHeader
      title="全平台组织"
      subtitle="组织属于经营主体内部数据：日常由主体负责人维护，运营端保留跨主体核查、异常处置与应急修正。"
      source="运营监管视图"
    />

    <NoticeBar tone="info" title="权限边界：">
      组织属于经营主体内部数据，日常维护由主体负责人或主体管理员完成。运营端的变更会纳入操作审计；
      历史组织（未关联统一主体）只读。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <AgriVueTable
      v-if="viewMode === 'table'"
      :columns="columns"
      :data="tableData"
      row-key="id"
      :loading="loading"
      loading-text="正在加载组织档案…"
      column-settings-storage-key="mds:cols:org-list"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      @refresh="refresh"
      @update:page="goPage"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="4" :loading="loading" @search="handleSearch" @reset="resetSearch">
          <div class="agri-vue-filter-field">
            <label>经营主体</label>
            <select v-model="searchForm.tenantId" class="mds-select" @change="handleSubjectChange">
              <option value="">全部经营主体（含历史）</option>
              <option v-for="subject in subjectOptions" :key="subject.id" :value="String(subject.id)">
                {{ subject.tenantName }}（{{ subjectTypeText(subject.tenantType) }}）
              </option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input
              v-model.trim="searchForm.keyword"
              class="mds-input"
              type="search"
              placeholder="组织名称 / 编码 / 负责人"
              @keyup.enter="handleSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>组织类型</label>
            <select v-model="searchForm.orgType" class="mds-select" @change="handleSearch">
              <option value="">全部组织类型</option>
              <option value="ENTERPRISE">企业组织</option>
              <option value="COOPERATIVE">合作社</option>
              <option value="FARM">农场/基地</option>
              <option value="DEPARTMENT">部门</option>
              <option value="TEAM">团队</option>
              <option value="PRODUCTION_UNIT">生产单位</option>
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
        <button v-point="'POST /admin/masterdata/org'" class="mds-btn mds-btn--primary" :disabled="!activeSubject" @click="openCreate">+ 新增组织</button>
        <div class="view-switch" role="group" aria-label="展示方式" :title="listSummary">
          <button :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">列表</button>
          <button :class="{ active: viewMode === 'tree' }" @click="viewMode = 'tree'">层级</button>
        </div>
      </template>

      <template #empty>
        <EmptyState
          :title="activeSubject ? '当前主体下暂无符合条件的组织' : '暂无符合条件的组织'"
          description="调整关键字或筛选条件后重试；历史组织需先关联统一主体才能维护。"
        />
      </template>

      <template #cell-orgName="{ row }">
        <div class="mds-cell-inline" :title="`${row.orgName}（${row.orgCode}）`">
          <button class="link-name mds-cell-main" @click="viewDetail(row.id)">{{ row.orgName }}</button>
          <span class="mds-mono mds-cell-sub">{{ row.orgCode }}</span>
        </div>
      </template>
      <template #cell-tenantName="{ row }">
        <div class="mds-cell-inline" :title="`${row.tenantName || '未匹配主体'} · ${row.legacy ? '历史只读' : '统一主体'}`">
          <span class="mds-cell-main">{{ row.tenantName || '未匹配主体' }}</span>
          <StatusTag v-if="row.legacy" text="历史" tone="gray" plain />
        </div>
      </template>
      <template #cell-parentName="{ row }">
        <div class="mds-cell-inline" :title="`${row.parentName || '一级组织'} · 第 ${row.orgLevel || 1} 级`">
          <span class="mds-cell-main">{{ row.parentName || '一级组织' }}</span>
          <span class="mds-cell-sub">L{{ row.orgLevel || 1 }}</span>
        </div>
      </template>
      <template #cell-orgType="{ row }">
        <StatusTag :text="orgTypeText(row)" :tone="typeTone(row.orgType)" plain />
      </template>
      <template #cell-contactPerson="{ row }">
        <div class="mds-cell-inline" :title="`${row.contactPerson || '—'} ${row.contactPhone || ''}`.trim()">
          <span class="mds-cell-main">{{ row.contactPerson || '—' }}</span>
          <span v-if="row.contactPhone" class="mds-cell-sub mds-mono">{{ row.contactPhone }}</span>
        </div>
      </template>
      <template #cell-status="{ row }">
        <StatusTag
          :text="Number(row.status) === 1 ? '启用' : '停用'"
          :tone="Number(row.status) === 1 ? 'success' : 'gray'"
        />
      </template>
      <template #cell-updateTime="{ row }">
        <span class="mds-muted">{{ formatDateTime(row.updateTime || row.createTime) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'view', label: '查看', onClick: () => viewDetail(row.id) },
            { key: 'edit', label: '编辑', point: 'PUT /admin/masterdata/org/{id}', disabled: row.legacy, title: row.legacy ? '历史组织未关联统一主体，只允许查看' : '编辑组织', onClick: () => editOrg(row) },
            { key: 'toggle', label: Number(row.status) === 1 ? '停用' : '启用', point: 'PUT /admin/masterdata/org/{id}/status', disabled: row.legacy, onClick: () => toggleOrgStatus(row) },
            { key: 'delete', label: '删除', danger: true, point: 'DELETE /admin/masterdata/org/{id}', disabled: row.legacy, onClick: () => deleteOrgById(row) },
          ]"
        />
      </template>
    </AgriVueTable>

    <div v-else class="agri-vue-list-page">
      <AgriVueFilterBar :field-count="4" :loading="loading" @search="handleSearch" @reset="resetSearch">
        <div class="agri-vue-filter-field">
          <label>经营主体</label>
          <select v-model="searchForm.tenantId" class="mds-select" @change="handleSubjectChange">
            <option value="">全部经营主体（含历史）</option>
            <option v-for="subject in subjectOptions" :key="subject.id" :value="String(subject.id)">
              {{ subject.tenantName }}（{{ subjectTypeText(subject.tenantType) }}）
            </option>
          </select>
        </div>
        <div class="agri-vue-filter-field">
          <label>关键字</label>
          <input
            v-model.trim="searchForm.keyword"
            class="mds-input"
            type="search"
            placeholder="组织名称 / 编码 / 负责人"
            @keyup.enter="handleSearch"
          />
        </div>
        <div class="agri-vue-filter-field">
          <label>组织类型</label>
          <select v-model="searchForm.orgType" class="mds-select" @change="handleSearch">
            <option value="">全部组织类型</option>
            <option value="ENTERPRISE">企业组织</option>
            <option value="COOPERATIVE">合作社</option>
            <option value="FARM">农场/基地</option>
            <option value="DEPARTMENT">部门</option>
            <option value="TEAM">团队</option>
            <option value="PRODUCTION_UNIT">生产单位</option>
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

      <div class="agri-vue-table-card">
        <div class="agri-vue-toolbar">
          <div class="agri-vue-toolbar-left">
            <button v-point="'POST /admin/masterdata/org'" class="mds-btn mds-btn--primary" :disabled="!activeSubject" @click="openCreate">+ 新增组织</button>
            <div class="view-switch" role="group" aria-label="展示方式" :title="listSummary">
              <button :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">列表</button>
              <button :class="{ active: viewMode === 'tree' }" @click="viewMode = 'tree'">层级</button>
            </div>
          </div>
          <div class="agri-vue-toolbar-right">
            <button type="button" class="agri-vue-tool-btn" :disabled="loading" @click="refresh">刷新</button>
          </div>
        </div>
        <div class="tree-view">
          <div v-if="treeError" class="mds-empty">{{ treeError }}</div>
          <div v-else-if="flatTree.length === 0">
            <EmptyState title="暂无符合条件的分层组织" description="切换主体或调整筛选条件后再看层级视图。" />
          </div>
          <template v-else>
            <div
              v-for="node in flatTree"
              :key="node.id"
              class="tree-row"
              :style="{ paddingLeft: `${12 + node.depth * 24}px` }"
            >
              <button class="tree-toggle" :disabled="!node.hasChildren" @click="toggleNode(node.id)">
                {{ node.hasChildren ? (expandedIds.includes(String(node.id)) ? '−' : '+') : '·' }}
              </button>
              <div class="tree-main">
                <button class="link-name" @click="viewDetail(node.id)">{{ node.orgName }}</button>
                <span class="mds-mono mds-muted">{{ node.orgCode }}</span>
                <StatusTag :text="orgTypeText(node)" :tone="typeTone(node.orgType)" plain />
                <StatusTag v-if="node.legacy" text="历史只读" tone="gray" plain />
              </div>
              <div class="tree-meta">{{ node.parentName || '一级组织' }} · 第 {{ node.orgLevel || 1 }} 级</div>
              <div class="tree-person">{{ node.contactPerson || '未设置负责人' }}</div>
              <StatusTag
                :text="Number(node.status) === 1 ? '启用' : '停用'"
                :tone="Number(node.status) === 1 ? 'success' : 'gray'"
              />
              <div class="tree-actions">
                <button class="mds-btn mds-btn--link" @click="viewDetail(node.id)">查看</button>
                <button v-point="'PUT /admin/masterdata/org/{id}'" class="mds-btn mds-btn--link" :disabled="node.legacy" @click="editOrg(node)">编辑</button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'

const columns = [
  { prop: 'orgName', label: '组织', width: 200, locked: true, ellipsis: false },
  { prop: 'tenantName', label: '所属主体', width: 170, ellipsis: false },
  { prop: 'parentName', label: '上级 / 层级', width: 155, ellipsis: false },
  { prop: 'orgType', label: '组织类型', width: 110, align: 'center', ellipsis: false },
  { prop: 'contactPerson', label: '负责人', width: 165, ellipsis: false },
  { prop: 'status', label: '状态', width: 92, kind: 'status' },
  { prop: 'updateTime', label: '更新时间', width: 148 },
  { key: 'actions', label: '操作', width: 120, kind: 'action' },
]
import {
  deleteOrg,
  getOrgList,
  getOrgTree,
  getTenantList,
  updateOrgStatus,
} from '../../utils/api'

const route = useRoute()
const router = useRouter()
const subjectOptions = ref([])
const tableData = ref([])
const treeRoots = ref([])
const treeError = ref('')
const expandedIds = ref([])
const loading = ref(false)
const viewMode = ref('table')
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({
  tenantId: '',
  keyword: '',
  orgType: '',
  status: '',
})

const activeSubject = computed(() =>
  subjectOptions.value.find((subject) => String(subject.id) === String(searchForm.tenantId)),
)
const listSummary = computed(
  () => `${activeSubject.value?.tenantName || '全部经营主体'} · 运营端应急维护与跨主体核查`,
)

const subjectTypeText = (type) => (type === 'INDIVIDUAL' || type === 'personal' ? '个人主体' : '企业主体')
// 取值以库里实际 org_type 为准（ENTERPRISE / COOPERATIVE / FARM / DEPARTMENT / TEAM / PRODUCTION_UNIT）
const ORG_TYPE_TEXT = {
  ENTERPRISE: '企业组织',
  COOPERATIVE: '合作社',
  FARM: '农场/基地',
  DEPARTMENT: '部门',
  TEAM: '团队',
  PRODUCTION_UNIT: '生产单位',
}
const orgTypeText = (org) => {
  const mapped = ORG_TYPE_TEXT[String(org.orgType || '').toUpperCase()]
  if (mapped) return mapped
  const rawName = String(org.orgTypeName || '').trim()
  if (rawName && rawName.toUpperCase() !== String(org.orgType || '').toUpperCase()) return rawName
  return '未分类'
}
const TYPE_TONE = {
  ENTERPRISE: 'info',
  COOPERATIVE: 'cyan',
  FARM: 'brand',
  DEPARTMENT: 'info',
  TEAM: 'purple',
  PRODUCTION_UNIT: 'warning',
}
const typeTone = (type) => TYPE_TONE[type] ?? 'gray'
const formatDateTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

const loadSubjects = async () => {
  const response = await getTenantList({ pageNum: 1, pageSize: 200, tenantStatus: 'ACTIVE' })
  if (response.code !== 200) throw new Error(response.message || '经营主体加载失败')
  subjectOptions.value = response.data?.list ?? []
}

const loadData = async () => {
  loading.value = true
  try {
    const response = await getOrgList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      orgType: searchForm.orgType || undefined,
      tenantId: searchForm.tenantId || undefined,
      status: searchForm.status === '' ? undefined : Number(searchForm.status),
    })
    if (response.code !== 200) throw new Error(response.message || '组织列表加载失败')
    tableData.value = response.data?.list ?? []
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    tableData.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '组织列表加载失败')
  } finally {
    loading.value = false
  }
}

const loadTree = async () => {
  treeError.value = ''
  try {
    const response = await getOrgTree(searchForm.tenantId || undefined)
    if (response.code !== 200) throw new Error(response.message || '组织层级加载失败')
    treeRoots.value = response.data ?? []
    const ids = []
    const collect = (nodes) =>
      nodes.forEach((node) => {
        if (node.children?.length) ids.push(String(node.id))
        collect(node.children ?? [])
      })
    collect(treeRoots.value)
    expandedIds.value = ids
  } catch (error) {
    treeRoots.value = []
    treeError.value = error instanceof Error ? error.message : '组织层级加载失败'
  }
}

const matches = (org) => {
  const keyword = searchForm.keyword.toLowerCase()
  const keywordMatched =
    !keyword ||
    [org.orgName, org.orgCode, org.contactPerson].some((value) =>
      String(value || '').toLowerCase().includes(keyword),
    )
  const typeMatched = !searchForm.orgType || org.orgType === searchForm.orgType
  const statusMatched = searchForm.status === '' || Number(org.status) === Number(searchForm.status)
  return keywordMatched && typeMatched && statusMatched
}

const filterTree = (nodes) =>
  nodes.flatMap((node) => {
    const children = filterTree(node.children ?? [])
    if (!matches(node) && children.length === 0) return []
    return [{ ...node, children }]
  })

const filteredTree = computed(() => filterTree(treeRoots.value))

const flatten = (nodes, depth = 0, out = []) => {
  nodes.forEach((node) => {
    out.push({ ...node, depth, hasChildren: Boolean(node.children?.length) })
    if (node.children?.length && expandedIds.value.includes(String(node.id))) {
      flatten(node.children, depth + 1, out)
    }
  })
  return out
}

const flatTree = computed(() => flatten(filteredTree.value))

const treeStats = computed(() => {
  const all = []
  const collect = (nodes) =>
    nodes.forEach((node) => {
      all.push(node)
      collect(node.children ?? [])
    })
  collect(filteredTree.value)
  return {
    total: all.length,
    departments: all.filter((org) => org.orgType === 'DEPARTMENT').length,
    teams: all.filter((org) => org.orgType === 'TEAM').length,
    production: all.filter((org) => org.orgType === 'PRODUCTION_UNIT' || org.orgType === 'FARM').length,
    legacy: all.filter((org) => org.legacy).length,
  }
})

const statItems = computed(() => {
  const current = treeStats.value
  // 表格视图用的是分页总数；层级视图统计的是当前树，两种口径分别标注，避免把 20 当全部
  return [
    { label: '组织总数', value: viewMode.value === 'table' ? total.value : current.total, hint: viewMode.value === 'table' ? '符合筛选条件的分页总数' : '当前层级树节点数' },
    { label: '部门', value: current.departments, hint: '层级树口径' },
    { label: '团队', value: current.teams, hint: '层级树口径' },
    { label: '生产单位 / 基地', value: current.production, hint: '层级树口径' },
    { label: '历史只读数据', value: current.legacy, hint: '未关联统一主体', tone: current.legacy ? 'warning' : undefined },
  ]
})

const refresh = async () => {
  pageNum.value = 1
  await Promise.all([loadData(), loadTree()])
}

const handleSearch = () => refresh()

const handleSubjectChange = async () => {
  await refresh()
  const query = { ...route.query }
  if (searchForm.tenantId) query.tenantId = searchForm.tenantId
  else delete query.tenantId
  await router.replace({ path: '/org/list', query })
}

const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.orgType = ''
  searchForm.status = ''
  refresh()
}

function goPage(next) {
  pageNum.value = next
  void loadData()
}

function changePageSize(size) {
  pageSize.value = size
  pageNum.value = 1
  void loadData()
}

const toggleNode = (id) => {
  const key = String(id)
  expandedIds.value = expandedIds.value.includes(key)
    ? expandedIds.value.filter((item) => item !== key)
    : [...expandedIds.value, key]
}

const openCreate = () => {
  if (!activeSubject.value) {
    message.warning('请先选择一个经营主体，再新增其内部组织')
    return
  }
  router.push({ path: '/org/new', query: { tenantId: searchForm.tenantId } })
}

const editOrg = (org) => {
  if (org.legacy) {
    message.warning('历史组织未关联统一经营主体，只允许查看')
    return
  }
  router.push(`/org/edit/${org.id}`)
}

const viewDetail = (id) => router.push(`/org/detail/${id}`)

const toggleOrgStatus = async (org) => {
  if (org.legacy) return
  const next = Number(org.status) === 1 ? 0 : 1
  if (!window.confirm(`确定要${next === 1 ? '启用' : '停用'}“${org.orgName}”吗？`)) return
  try {
    const response = await updateOrgStatus(org.id, next)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(next === 1 ? '组织已启用' : '组织已停用')
    await Promise.all([loadData(), loadTree()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

const deleteOrgById = async (org) => {
  if (org.legacy) return
  if (Number(org.childCount) > 0) {
    message.warning('该组织下仍有子组织，请先调整或删除子组织')
    return
  }
  if (!window.confirm(`确定删除“${org.orgName}”吗？删除后由运营端保留操作审计。`)) return
  try {
    const response = await deleteOrg(org.id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('组织已删除')
    await refresh()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

onMounted(async () => {
  try {
    await loadSubjects()
    const requestedTenant = String(route.query.tenantId || '')
    const validRequested = subjectOptions.value.some((subject) => String(subject.id) === requestedTenant)
    // 默认看「全部经营主体」：默认落在第一个主体上时，随机挑到一个小主体就会是一张空表，
    // 看起来像"组织数据丢了"。要看单个主体再从下拉里选。
    searchForm.tenantId = validRequested ? requestedTenant : ''
    await Promise.all([loadData(), loadTree()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : '页面初始化失败')
  }
})
</script>

<style scoped>
.subject-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.subject-copy {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.subject-label {
  font-size: 12px;
  color: var(--mds-text-3);
}

.subject-copy strong {
  font-size: 17px;
}

.subject-copy small {
  width: 100%;
  color: var(--mds-text-3);
  font-size: 12px;
}

.org-subject-select {
  min-width: 210px;
  max-width: 260px;
}

.org-view-switch {
  margin-left: auto;
}

.view-switch {
  display: flex;
  padding: 3px;
  border-radius: 8px;
  background: var(--mds-gray-soft);
}

.view-switch button {
  padding: 5px 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--mds-text-2);
  font-size: 12.5px;
  cursor: pointer;
}

.view-switch button.active {
  background: #fff;
  color: var(--mds-brand-deep);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  font-weight: 600;
}

.org-table {
  min-width: 1160px;
}

.link-name {
  max-width: 260px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--mds-brand-deep);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.link-name:hover {
  text-decoration: underline;
}

.tree-view {
  min-height: 220px;
  padding: 8px 0;
}

.tree-row {
  display: grid;
  grid-template-columns: 24px minmax(320px, 1.2fr) minmax(180px, 0.7fr) minmax(130px, 0.45fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding-right: 16px;
  border-bottom: 1px solid var(--mds-line-soft);
  font-size: 12.5px;
}

.tree-toggle {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #d7dbe0;
  border-radius: 5px;
  background: #fff;
  color: var(--mds-text-2);
  cursor: pointer;
}

.tree-toggle:disabled {
  border-color: transparent;
  cursor: default;
}

.tree-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tree-meta,
.tree-person {
  color: var(--mds-text-2);
}

.tree-actions {
  white-space: nowrap;
}

@media (max-width: 1050px) {
  .tree-row {
    grid-template-columns: 24px minmax(280px, 1fr) auto auto;
  }

  .tree-meta,
  .tree-person {
    display: none;
  }
}

@media (max-width: 720px) {
  .subject-bar {
    align-items: flex-start;
  }

  .tree-row {
    grid-template-columns: 24px 1fr auto;
  }

  .tree-actions,
  .tree-row > .mds-tag {
    display: none;
  }
}
</style>
