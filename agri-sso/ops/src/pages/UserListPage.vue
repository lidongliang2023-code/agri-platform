<template>
  <div class="page-stack uc-user-list-dense">
    <div class="uc-dense-head">
      <h1>用户列表</h1>
      <span class="uc-dense-head-meta">全平台注册账号 {{ total }} 个 · 支持按身份、实名状态、账号状态筛选</span>
    </div>

    <section class="surface-card uc-dense-card">
      <div class="chip-row uc-dense-filter">
        <a-input
          v-model:value="draft"
          placeholder="搜账号 / 昵称 / 手机号"
          style="width: 220px"
          @press-enter="submitSearch"
        />
        <a-button type="primary" @click="submitSearch">搜索</a-button>
        <a-select
          :value="roleCode"
          style="width: 160px"
          :options="[{ label: '全部身份', value: '' }, ...roles]"
          @change="(val: string) => { roleCode = val; pageNum = 1 }"
        />
        <a-select
          :value="realnameStatus"
          style="width: 130px"
          :options="REALNAME_OPTIONS"
          @change="(val: string) => { realnameStatus = val; pageNum = 1 }"
        />
        <a-select
          :value="status === undefined ? '' : String(status)"
          style="width: 120px"
          :options="STATUS_OPTIONS"
          @change="handleStatusChange"
        />
      </div>

      <ErrorBlock v-if="error" :message="error" @retry="loadUsers" />
      <a-table
        v-else
        row-key="id"
        size="middle"
        :loading="loading"
        :columns="columns"
        :data-source="rows"
        :scroll="{ x: 1120 }"
        :pagination="{
          current: pageNum,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count: number) => `共 ${count} 个账号`,
          onChange: handlePageChange,
        }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'username'">
            <div class="uc-dense-inline-cell" :title="`${record.nickname || record.username}（${record.username} · ${record.phone || '未绑定手机'}）`">
              <b class="uc-dense-primary">{{ record.nickname || record.username }}</b>
              <span class="small muted uc-dense-secondary">{{ record.username }} · {{ record.phone || '未绑定手机' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'roles'">
            <span v-if="!record.roles?.length" class="small muted">无角色</span>
            <div v-else class="tag-row uc-dense-nowrap" :title="record.roles.map((c: string) => roleText(c)).join('、')">
              <a-tag class="soft-tag">{{ roleText(record.roles[0]) }}</a-tag>
              <a-tag v-if="record.roles.length > 1" class="soft-tag">+{{ record.roles.length - 1 }}</a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'realnameStatus'">
            <div class="uc-dense-inline-cell" :title="record.realName || undefined">
              <StatusTag :status="record.realnameStatus" />
              <span v-if="record.realName" class="small muted uc-dense-secondary">{{ record.realName }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'orgCount'">
            <span v-if="record.orgCount === 0" class="small muted">未绑定</span>
            <div v-else class="uc-dense-inline-cell" :title="`${record.orgCount} 个：${(record.orgNames || []).join('、') || '—'}`">
              <b class="uc-dense-count">{{ record.orgCount }} 个</b>
              <span class="small muted uc-dense-secondary">{{ (record.orgNames || []).join('、') || '—' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <div class="tag-row uc-dense-nowrap">
              <StatusTag :status="record.status === 1 ? 'success' : 'frozen'" />
              <a-tag v-if="record.frozen" class="soft-tag tone-up">{{ record.freezeType ?? '冻结' }}</a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="link" @click="app.navigate('user-detail', record.id)">详情</a-button>
            <a-button size="small" type="link" :danger="record.status === 1" @click="toggleStatus(record as UserRow)">
              {{ record.status === 1 ? '停用' : '启用' }}
            </a-button>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
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

const columns = [
  { title: '账号', dataIndex: 'username', key: 'username', width: 260, ellipsis: true },
  { title: '身份', dataIndex: 'roles', key: 'roles', width: 180, ellipsis: true },
  { title: '实名', dataIndex: 'realnameStatus', key: 'realnameStatus', width: 145, ellipsis: true },
  { title: '所属组织', dataIndex: 'orgCount', key: 'orgCount', width: 200, ellipsis: true },
  { title: '账号状态', dataIndex: 'status', key: 'status', width: 130 },
  { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt', width: 156, ellipsis: true },
  { title: '操作', key: 'action', width: 140, fixed: 'right' as const },
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
  keyword.value = draft.value.trim()
  pageNum.value = 1
}

function handleStatusChange(val: string) {
  status.value = val === '' ? undefined : Number(val)
  pageNum.value = 1
}

function handlePageChange(nextPage: number, nextSize: number) {
  pageNum.value = nextPage
  pageSize.value = nextSize
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
