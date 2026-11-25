<template>
  <div class="mds-page">
    <PageHeader
      title="租户列表"
      subtitle="经营主体（租户）主档查询：注册信息、认证状态与生命周期；主体由统一认证注册产生。"
      source="统一认证 · 经营主体主档"
    />

    <AgriVueTable
      :columns="columns"
      :data="subjects"
      row-key="id"
      :loading="loading"
      loading-text="正在加载经营主体…"
      column-settings-storage-key="mds:cols:tenant-list"
      :page="currentPage"
      :page-size="pageSize"
      :total="totalCount"
      @refresh="loadSubjects"
      @update:page="goPage"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="3" :loading="loading" @search="handleSearch" @reset="resetSearch">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input
              v-model="searchForm.keyword"
              type="search"
              class="mds-input"
              placeholder="主体名称 / 编码 / 信用代码 / 联系人 / 电话"
              @keyup.enter="handleSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>主体类型</label>
            <select v-model="searchForm.tenantType" class="mds-select" @change="handleSearch">
              <option value="">全部主体类型</option>
              <option value="ENTERPRISE">企业主体</option>
              <option value="INDIVIDUAL">个人主体</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>主体状态</label>
            <select v-model="searchForm.status" class="mds-select" @change="handleSearch">
              <option value="">全部状态</option>
              <option value="1">启用</option>
              <option value="0">停用</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button class="mds-btn mds-btn--primary" @click="router.push('/subject/audit')">入驻与生命周期</button>
      </template>

      <template #empty>
        <EmptyState title="暂无符合条件的经营主体" description="调整关键字或筛选条件后重试。" />
      </template>

      <template #cell-tenantType="{ row }">
        <StatusTag
          :text="subjectTypeText(row.tenantType)"
          :tone="row.tenantType === 'INDIVIDUAL' ? 'info' : 'brand'"
          plain
        />
      </template>
      <template #cell-tenantName="{ row }">
        <span class="mds-name">{{ row.tenantName || '—' }}</span>
      </template>
      <template #cell-creditCode="{ row }">
        <span class="mds-mono">{{ row.tenantType === 'INDIVIDUAL' ? row.idNoMasked || '—' : row.creditCode || '—' }}</span>
      </template>
      <template #cell-industry="{ row }">
        {{ row.tenantType === 'INDIVIDUAL' ? row.businessType || '—' : row.industry || '—' }}
      </template>
      <template #cell-verifyStatus="{ row }">
        <StatusTag :text="verifyText(row.verifyStatus)" :tone="verifyTone(row.verifyStatus)" />
      </template>
      <template #cell-status="{ row }">
        <StatusTag :text="isEnabled(row) ? '启用' : '停用'" :tone="isEnabled(row) ? 'success' : 'gray'" />
      </template>
      <template #cell-createTime="{ row }">
        <span class="mds-muted">{{ formatDate(row.createTime) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'view', label: '查看', onClick: () => viewSubject(row.id) },
            { key: 'edit', label: '编辑', onClick: () => editSubject(row.id) },
            { key: 'toggle', label: isEnabled(row) ? '停用' : '启用', danger: isEnabled(row), point: 'PUT /admin/masterdata/subject/{id}/status', onClick: () => toggleStatus(row) },
          ]"
        />
      </template>
    </AgriVueTable>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'

const columns = [
  { prop: 'tenantType', label: '主体类型', width: 105, align: 'center', ellipsis: false },
  { prop: 'tenantName', label: '主体名称', width: 180, locked: true },
  { prop: 'tenantCode', label: '主体编码', width: 140, kind: 'code' },
  { prop: 'creditCode', label: '信用代码 / 证件号', width: 175, kind: 'code' },
  { prop: 'industry', label: '行业 / 经营类型', width: 130 },
  { prop: 'contactPerson', label: '联系人', width: 100 },
  { prop: 'contactPhone', label: '联系电话', width: 130, kind: 'code' },
  { prop: 'verifyStatus', label: '认证状态', width: 100, kind: 'status' },
  { prop: 'status', label: '主体状态', width: 96, kind: 'status' },
  { prop: 'createTime', label: '创建时间', width: 145 },
  { key: 'actions', label: '操作', width: 130, kind: 'action' },
]
import { getTenantList, updateTenantStatus } from '../../utils/api'

const router = useRouter()
const route = useRoute()
const searchForm = reactive({ keyword: '', tenantType: '', status: '' })
const subjects = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)

const VERIFY_TEXT = { approved: '已认证', pending: '审核中', rejected: '已驳回', unverified: '未认证' }
const VERIFY_TONE = { approved: 'success', pending: 'warning', rejected: 'danger', unverified: 'gray' }

const loadSubjects = async () => {
  loading.value = true
  try {
    const response = await getTenantList({
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      tenantType: searchForm.tenantType || undefined,
      tenantStatus: searchForm.status || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '经营主体加载失败')
    subjects.value = response.data?.list ?? []
    totalCount.value = Number(response.data?.total ?? 0)
  } catch (error) {
    subjects.value = []
    totalCount.value = 0
    message.error(error instanceof Error ? error.message : '经营主体加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  void loadSubjects()
}

const resetSearch = () => {
  Object.assign(searchForm, { keyword: '', tenantType: '', status: '' })
  handleSearch()
}

function goPage(next) {
  currentPage.value = next
  void loadSubjects()
}

function changePageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  void loadSubjects()
}

const isEnabled = (subject) => Number(subject?.status) === 1
const subjectTypeText = (type) => (type === 'INDIVIDUAL' ? '个人主体' : '企业主体')
const verifyText = (status) => VERIFY_TEXT[status] ?? '未认证'
const verifyTone = (status) => VERIFY_TONE[status] ?? 'gray'
const formatDate = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

const viewSubject = (id) => router.push(`/subject/detail/${id}`)
const editSubject = (id) => router.push(`/subject/edit/${id}`)

const toggleStatus = async (subject) => {
  if (isEnabled(subject) && !window.confirm(`确认停用「${subject.tenantName || subject.tenantCode}」？`)) return
  try {
    const response = await updateTenantStatus(subject.id, isEnabled(subject) ? 0 : 1)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(isEnabled(subject) ? '主体已停用' : '主体已启用')
    await loadSubjects()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

onMounted(loadSubjects)

/**
 * 顶栏全局搜索会带 `?keyword=` 进来。
 * 只改搜索框不重新查询的话，页面会显示"关键字填了、列表没筛"，比不填更误导。
 */
watch(
  () => route.query.keyword,
  (value) => {
    searchForm.keyword = typeof value === 'string' ? value : ''
    currentPage.value = 1
    void loadSubjects()
  },
)
</script>
