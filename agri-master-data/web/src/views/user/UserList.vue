<template>
  <div class="mds-page">
    <PageHeader
      title="全平台用户"
      subtitle="统一认证账号、经营主体成员关系与认证状态；账号启停与实名审核由用户中心运营端办理。"
      source="只读 · 统一认证用户主档"
    />

    <NoticeBar tone="info" title="只读视图：">
      本页的「停用 / 启用」已移除 —— 账号状态改由用户中心运营端统一处置，避免同一账号在两处被改成不同状态。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <AgriVueTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      loading-text="正在加载统一用户…"
      column-settings-storage-key="mds:cols:user-list"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      @refresh="load"
      @update:page="changePage"
      @update:page-size="changePageSize"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="4" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <input
              v-model="filters.keyword"
              class="mds-input"
              type="search"
              placeholder="账号 / 昵称 / 手机号 / 邮箱 / 主体"
              @keyup.enter="search"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>主体类型</label>
            <select v-model="filters.userType" class="mds-select" @change="search">
              <option value="">全部主体类型</option>
              <option value="enterprise">企业主体成员</option>
              <option value="personal">个人主体成员</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>认证状态</label>
            <select v-model="filters.verifyStatus" class="mds-select" @change="search">
              <option value="">全部认证状态</option>
              <option value="approved">已认证</option>
              <option value="pending">审核中</option>
              <option value="rejected">已驳回</option>
              <option value="unverified">未认证</option>
            </select>
          </div>
          <div class="agri-vue-filter-field">
            <label>账号状态</label>
            <select v-model="filters.status" class="mds-select" @change="search">
              <option value="">全部账号状态</option>
              <option value="active">正常</option>
              <option value="inactive">已停用</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 用户管理</button>
      </template>

      <template #empty>
        <EmptyState title="暂无符合条件的统一用户" description="调整关键字或筛选条件后重试。" />
      </template>

      <template #cell-username="{ row }">
        <div class="user-account" :title="`${row.username}（${row.nickName || '未设置昵称'}）`">
          <span class="avatar">{{ (row.nickName || row.username || '用').slice(0, 1) }}</span>
          <strong class="mds-cell-main">{{ row.username }}</strong>
          <span v-if="row.nickName && row.nickName !== row.username" class="mds-cell-sub">{{ row.nickName }}</span>
        </div>
      </template>
      <template #cell-phone="{ row }">
        <div class="mds-cell-inline" :title="`${row.phone || '—'}${row.email ? ' · ' + row.email : ''}`">
          <span class="mds-mono">{{ row.phone || '—' }}</span>
          <span v-if="row.email" class="mds-cell-sub">{{ row.email }}</span>
        </div>
      </template>
      <template #cell-memberships="{ row }">
        <div
          v-if="row.memberships?.length"
          class="mds-cell-inline subject-tags"
          :title="row.memberships.map((m) => m.subjectName || m.subjectId).join('、')"
        >
          <StatusTag
            :text="row.memberships[0].subjectName || row.memberships[0].subjectId"
            :tone="row.memberships[0].memberType === 'personal' ? 'info' : 'brand'"
            plain
          />
          <span v-if="row.memberships.length > 1" class="mds-cell-sub">+{{ row.memberships.length - 1 }}</span>
        </div>
        <span v-else class="mds-muted">未绑定主体</span>
      </template>
      <template #cell-roleNames="{ row }">
        <div class="mds-cell-main" :title="roleText(row.roleNames)">{{ roleText(row.roleNames) }}</div>
      </template>
      <template #cell-realNameStatus="{ row }">
        <StatusTag :text="verifyText(row.realNameStatus)" :tone="verifyTone(row.realNameStatus)" />
      </template>
      <template #cell-status="{ row }">
        <StatusTag :text="isActive(row) ? '正常' : '已停用'" :tone="isActive(row) ? 'success' : 'gray'" />
      </template>
      <template #cell-createTime="{ row }">
        <span class="mds-muted">{{ formatDate(row.createTime) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions :actions="[{ key: 'detail', label: '查看详情', onClick: () => viewDetail(row.id) }]" />
      </template>
    </AgriVueTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'
import { getUserList } from '../../utils/api'

const columns = [
  { prop: 'username', label: '统一账号', width: 200, locked: true, ellipsis: false },
  { prop: 'phone', label: '联系方式', width: 170, ellipsis: false },
  { prop: 'memberships', label: '绑定主体', width: 200, ellipsis: false },
  { prop: 'roleNames', label: '主体内角色', width: 130 },
  { prop: 'realNameStatus', label: '认证状态', width: 100, kind: 'status' },
  { prop: 'status', label: '账号状态', width: 96, kind: 'status' },
  { prop: 'createTime', label: '创建时间', width: 148 },
  { key: 'actions', label: '操作', width: 100, kind: 'action' },
]

const router = useRouter()
const rows = ref([])
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = reactive({ keyword: '', userType: '', verifyStatus: '', status: '' })
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const activeCount = computed(() => rows.value.filter(isActive).length)
const boundCount = computed(() => rows.value.filter((user) => user.memberships?.length).length)
const pendingCount = computed(() => rows.value.filter((user) => user.realNameStatus === 'pending').length)
const isActive = (user) => Number(user?.status) === 1

/** 后三张卡是「当前页」口径：接口没有按状态聚合的字段，这里如实标注 */
const statItems = computed(() => [
  { label: '用户总数', value: total.value, hint: '统一认证账号' },
  { label: '当前页正常', value: activeCount.value, hint: '账号状态启用' },
  { label: '当前页已绑定', value: boundCount.value, hint: '至少加入一个经营主体' },
  {
    label: '当前页待认证',
    value: pendingCount.value,
    hint: '主体认证审核中',
    tone: pendingCount.value ? 'warning' : undefined,
  },
])

const load = async () => {
  loading.value = true
  try {
    const response = await getUserList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      username: filters.keyword || undefined,
      userType: filters.userType || undefined,
      realNameStatus: filters.verifyStatus || undefined,
      userStatus: filters.status || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '统一用户加载失败')
    rows.value = response.data?.list ?? []
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '统一用户加载失败')
  } finally {
    loading.value = false
  }
}

const search = () => {
  pageNum.value = 1
  void load()
}
const reset = () => {
  Object.assign(filters, { keyword: '', userType: '', verifyStatus: '', status: '' })
  search()
}
const changePage = (page) => {
  if (page < 1 || page > totalPages.value) return
  pageNum.value = page
  void load()
}
const changePageSize = (size) => {
  pageSize.value = size
  pageNum.value = 1
  void load()
}
const viewDetail = (id) => router.push(`/user/detail/${id}`)

const VERIFY_TEXT = { approved: '已认证', pending: '审核中', rejected: '已驳回', unverified: '未认证' }
const VERIFY_TONE = { approved: 'success', pending: 'warning', rejected: 'danger', unverified: 'gray' }
const verifyText = (status) => VERIFY_TEXT[status] ?? '未认证'
const verifyTone = (status) => VERIFY_TONE[status] ?? 'gray'
const roleText = (roles) => {
  if (!roles?.length) return '—'
  const labels = { owner: '负责人', buyer: '采购', seller: '销售', finance: '财务' }
  return [...new Set(roles)].map((role) => labels[role] || role).join('、')
}
const formatDate = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

onMounted(load)
</script>

<style scoped>
.user-table {
  min-width: 1120px;
}

.user-account {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.avatar {
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #2d8f4e, #159a5e);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.subject-tags :deep(.mds-tag) {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
