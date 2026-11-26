<template>
  <div class="page-stack uc-user-list-dense">
    <div class="uc-dense-head">
      <h1>用户列表</h1>
      <span class="uc-dense-head-meta">全平台注册账号 {{ total }} 个 · 支持按身份、实名状态、账号状态筛选</span>
    </div>

    <ErrorBlock v-if="error" :message="error" @retry="loadUsers" />

    <AgriAntdvListTable
      v-else
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      total-unit="个账号"
      column-settings-storage-key="uc-ops:users"
      @page-change="handlePageChange"
      @refresh="loadUsers"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="4" :loading="loading" @search="submitSearch" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜账号 / 昵称 / 手机号"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>业务身份</label>
            <a-select
              v-model:value="roleCode"
              :options="[{ label: '全部身份', value: '' }, ...roles]"
              @change="pageNum = 1"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>实名状态</label>
            <a-select
              v-model:value="realnameStatus"
              :options="REALNAME_OPTIONS"
              @change="pageNum = 1"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>账号状态</label>
            <a-select
              :value="status === undefined ? '' : String(status)"
              :options="STATUS_OPTIONS"
              @change="handleStatusChange"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-username="{ record }">
        <div
          class="uc-dense-inline-cell"
          :title="`${record.nickname || record.username}（${record.username} · ${record.phone || '未绑定手机'}）`"
        >
          <b class="uc-dense-primary">{{ record.nickname || record.username }}</b>
          <span class="small muted uc-dense-secondary">{{ record.username }} · {{ record.phone || '未绑定手机' }}</span>
        </div>
      </template>
      <template #cell-roles="{ record }">
        <span v-if="!(record.roles as string[] | undefined)?.length" class="small muted">无角色</span>
        <div
          v-else
          class="tag-row uc-dense-nowrap"
          :title="(record.roles as string[]).map((c: string) => roleText(c)).join('、')"
        >
          <a-tag class="soft-tag">{{ roleText((record.roles as string[])[0]) }}</a-tag>
          <a-tag v-if="(record.roles as string[]).length > 1" class="soft-tag">
            +{{ (record.roles as string[]).length - 1 }}
          </a-tag>
        </div>
      </template>
      <template #cell-realnameStatus="{ record }">
        <div class="uc-dense-inline-cell" :title="String(record.realName || '') || undefined">
          <StatusTag :status="String(record.realnameStatus ?? '')" />
          <span v-if="record.realName" class="small muted uc-dense-secondary">{{ record.realName }}</span>
        </div>
      </template>
      <template #cell-orgCount="{ record }">
        <span v-if="record.orgCount === 0" class="small muted">未绑定</span>
        <div
          v-else
          class="uc-dense-inline-cell"
          :title="`${record.orgCount} 个：${((record.orgNames as string[]) || []).join('、') || '—'}`"
        >
          <b class="uc-dense-count">{{ record.orgCount }} 个</b>
          <span class="small muted uc-dense-secondary">{{ ((record.orgNames as string[]) || []).join('、') || '—' }}</span>
        </div>
      </template>
      <template #cell-status="{ record }">
        <div class="tag-row uc-dense-nowrap">
          <StatusTag :status="record.status === 1 ? 'success' : 'frozen'" />
          <a-tag v-if="record.frozen" class="soft-tag tone-up">{{ record.freezeType ?? '冻结' }}</a-tag>
        </div>
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatTime(String(value ?? '')) }}
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions :actions="rowActions(record as UserRow)" />
      </template>
    </AgriAntdvListTable>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
  type VueRowActionItem,
} from '@agri/shared/vue/antdv'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import StatusTag from '../components/StatusTag.vue'
import { ROLE_LABEL, formatTime, roleText } from '../components/ui-constants'
import type { UserRow } from '../types'

const REALNAME_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已实名', value: 'verified' },
  { label: '待审核', value: 'pending' },
  { label: '已驳回', value: 'rejected' },
]

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '正常', value: '1' },
  { label: '停用', value: '0' },
]

const columns: VueListColumn[] = [
  { key: 'username', prop: 'username', label: '账号', width: 260, ellipsis: true },
  { key: 'roles', prop: 'roles', label: '身份', width: 180, ellipsis: true },
  { key: 'realnameStatus', prop: 'realnameStatus', label: '实名', width: 145, ellipsis: true },
  { key: 'orgCount', prop: 'orgCount', label: '所属组织', width: 200, ellipsis: true },
  { key: 'status', prop: 'status', label: '账号状态', width: 130 },
  { key: 'createdAt', prop: 'createdAt', label: '注册时间', width: 160, ellipsis: true },
  { key: 'action', label: '操作', width: 130, fixed: 'right' },
]

const app = useAppStore()
const rows = ref<UserRow[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const draft = ref('')
const roleCode = ref('')
const realnameStatus = ref('')
const status = ref<number | undefined>(undefined)
const roles = ref<Array<{ label: string; value: string }>>([])
const loading = ref(true)
const error = ref('')

onMounted(() => {
  ucApi.roles()
    .then((list) => {
      roles.value = list.map((role) => ({
        value: role.code,
        label: ROLE_LABEL[role.code] ?? role.name ?? role.code,
      }))
    })
    .catch(() => undefined)
})

function loadUsers() {
  loading.value = true
  error.value = ''
  ucApi.users({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    roleCode: roleCode.value || undefined,
    realnameStatus: realnameStatus.value || undefined,
    status: status.value,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword, roleCode, realnameStatus, status], loadUsers, { immediate: true })

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) loadUsers()
}

function resetFilters() {
  const same = !keyword.value && !draft.value && !roleCode.value && !realnameStatus.value && status.value === undefined && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  roleCode.value = ''
  realnameStatus.value = ''
  status.value = undefined
  pageNum.value = 1
  if (same) loadUsers()
}

function handleStatusChange(val: unknown) {
  const str = String(val ?? '')
  status.value = str === '' ? undefined : Number(str)
  pageNum.value = 1
}

function handlePageChange(nextPage: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = nextPage
}

function rowActions(row: UserRow): VueRowActionItem[] {
  return [
    { key: 'detail', label: '详情', onClick: () => app.navigate('user-detail', row.id) },
    {
      key: 'toggle',
      label: row.status === 1 ? '停用' : '启用',
      danger: row.status === 1,
      onClick: () => toggleStatus(row),
    },
  ]
}

function toggleStatus(row: UserRow) {
  const next = row.status === 1 ? 0 : 1
  ucApi.setUserStatus(row.id, next)
    .then(() => {
      message.success(next === 1 ? '已启用该账号' : '已停用该账号')
      rows.value = rows.value.map((item) => (item.id === row.id ? { ...item, status: next } : item))
    })
    .catch((reason: Error) => message.error(reason.message))
}
</script>
