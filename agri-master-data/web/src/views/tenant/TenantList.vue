<template>
  <div class="mds-page">
    <PageHeader
      title="租户列表"
      subtitle="经营主体（租户）主档查询：注册信息、认证状态与生命周期；主体由统一认证注册产生。"
      source="统一认证 · 经营主体主档"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="loadSubjects">刷新</button>
        <button class="mds-btn mds-btn--primary" @click="router.push('/subject/audit')">入驻与生命周期</button>
      </template>
    </PageHeader>

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="searchForm.keyword"
          type="search"
          class="mds-input"
          placeholder="搜索主体名称、编码、信用代码、联系人或电话"
          @keyup.enter="handleSearch"
        />
        <select v-model="searchForm.tenantType" class="mds-select" @change="handleSearch">
          <option value="">全部主体类型</option>
          <option value="ENTERPRISE">企业主体</option>
          <option value="INDIVIDUAL">个人主体</option>
        </select>
        <select v-model="searchForm.status" class="mds-select" @change="handleSearch">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">停用</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="handleSearch">查询</button>
        <button class="mds-btn" @click="resetSearch">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>主体类型</th>
              <th>主体名称</th>
              <th>主体编码</th>
              <th>信用代码 / 证件号</th>
              <th>行业 / 经营类型</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>认证状态</th>
              <th>主体状态</th>
              <th>创建时间</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="11" class="mds-empty">正在加载经营主体…</td>
            </tr>
            <tr v-else-if="subjects.length === 0">
              <td colspan="11">
                <EmptyState title="暂无符合条件的经营主体" description="调整关键字或筛选条件后重试。" />
              </td>
            </tr>
            <tr v-for="subject in subjects" :key="subject.id">
              <td>
                <StatusTag
                  :text="subjectTypeText(subject.tenantType)"
                  :tone="subject.tenantType === 'INDIVIDUAL' ? 'info' : 'brand'"
                  plain
                />
              </td>
              <td class="mds-name">{{ subject.tenantName || '—' }}</td>
              <td class="mds-mono">{{ subject.tenantCode || '—' }}</td>
              <td class="mds-mono">
                {{ subject.tenantType === 'INDIVIDUAL' ? subject.idNoMasked || '—' : subject.creditCode || '—' }}
              </td>
              <td>{{ subject.tenantType === 'INDIVIDUAL' ? subject.businessType || '—' : subject.industry || '—' }}</td>
              <td>{{ subject.contactPerson || '—' }}</td>
              <td class="mds-mono">{{ subject.contactPhone || '—' }}</td>
              <td><StatusTag :text="verifyText(subject.verifyStatus)" :tone="verifyTone(subject.verifyStatus)" /></td>
              <td>
                <StatusTag
                  :text="isEnabled(subject) ? '启用' : '停用'"
                  :tone="isEnabled(subject) ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-muted">{{ formatDate(subject.createTime) }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="viewSubject(subject.id)">查看</button>
                <button class="mds-btn mds-btn--link" @click="editSubject(subject.id)">编辑</button>
                <button v-point="'PUT /admin/masterdata/subject/{id}/status'"
                  class="mds-btn mds-btn--link"
                  :class="{ 'mds-danger': isEnabled(subject) }"
                  @click="toggleStatus(subject)"
                >
                  {{ isEnabled(subject) ? '停用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="currentPage"
        :page-size="pageSize"
        :total="totalCount"
        @change="goPage"
        @update:page-size="changePageSize"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
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
