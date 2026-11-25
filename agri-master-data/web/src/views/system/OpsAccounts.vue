<template>
  <div class="mds-page">
    <PageHeader
      title="运营账号与角色"
      subtitle="平台运营团队的账号目录与角色权限码：账号主档在平台认证中心，角色与权限码同源。"
      source="统一认证 · 平台账号 / 角色"
    >
      
    </PageHeader>

    <StatGrid :items="stats" />

    <NoticeBar tone="info" title="只读视图：">
      账号新建、冻结/解冻、重置密码与角色绑定由用户中心运营端办理；本页只做平台账号目录与权限码核对。
    </NoticeBar>

    <div class="mds-card">
      
      <AgriVueTable
        :columns="listColumns1"
        :data="users"
        row-key="id"
        :loading="loading"
        loading-text="正在加载运营账号…"
        column-settings-storage-key="mds:cols:ops-accounts-1"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @page-change="(next, size) => size !== pageSize ? changePageSize(size) : changePage(next)"
        @refresh="loadUsers"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
            <div class="agri-vue-filter-field">
              <label>关键字</label>
              <input
                        v-model="filters.keyword"
                        class="mds-input"
                        type="search"
                        placeholder="搜索用户名 / 昵称 / 手机号"
                      />
            </div>
            <div class="agri-vue-filter-field">
              <label>角色</label>
              <select v-model="filters.roleCode" class="mds-select" @change="search">
                        <option value="">全部角色</option>
                        <option v-for="role in roles" :key="role.code" :value="role.code">{{ role.name }}（{{ role.code }}）</option>
                      </select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #toolbar-left>
          <button class="mds-btn" @click="openUserCenter">前往用户中心 · 账号管理</button>
        </template>
        <template #empty>
          <EmptyState
                            :title="loadError || '没有匹配的账号'"
                            :description="loadError ? '当前账号没有读取平台账号目录的权限（需要 SUPER_ADMIN），或认证中心不可达。' : '调整关键字或角色筛选后重试。'"
                          />
        </template>
        <template #cell-username="{ row: user }">
          <div class="mds-name">
            {{ user.username }}
          </div>
        </template>
        <template #cell-roles="{ row: user }">
          <template v-if="user.roles?.length">
                            <span v-for="code in user.roles" :key="code" class="role-chip">{{ code }}</span>
                          </template>
                          <span v-else class="mds-muted">未绑定角色</span>
        </template>
        <template #cell-realnameStatus="{ row: user }">
          <StatusTag :text="realnameText(user.realnameStatus)" :tone="realnameTone(user.realnameStatus)" />
        </template>
        <template #cell-frozen="{ row: user }">
          <StatusTag
                            :text="user.frozen ? '已冻结' : Number(user.status) === 1 ? '正常' : '停用'"
                            :tone="user.frozen || Number(user.status) !== 1 ? 'danger' : 'success'"
                          />
        </template>
        <template #cell-createdAt="{ row: user }">
          <div class="mds-muted">
            {{ formatDate(user.createdAt) }}
          </div>
        </template>
      </AgriVueTable>
      
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">角色目录与权限码</h2>
          <p class="mds-card-sub">通配符 <code>*</code> 表示拥有全部权限；运营端准入依赖 <code>SUPER_ADMIN</code> / <code>MARKET_OPS</code></p>
        </div>
        <span class="mds-tag mds-tag--plain">{{ roles.length }} 个角色</span>
      </div>
      <AgriVueTable
        :columns="listColumns2"
        :data="roles"
        row-key="code"
        column-settings-storage-key="mds:cols:ops-accounts-2"
        client-pagination
        @refresh="loadRoles"
      >
        <template #empty>
          <EmptyState title="没有读取到角色目录" description="需要平台超管权限；也可在用户中心运营端的「角色管理」查看。" />
        </template>
        <template #cell-name="{ row: role }">
          <div class="mds-name">
            {{ role.name }}
          </div>
        </template>
        <template #cell-codes="{ row: role }">
          {{ role.codes.length }}
        </template>
        <template #cell-codes2="{ row: role }">
          <span v-for="code in role.codes.slice(0, 8)" :key="code" class="perm-chip">{{ code }}</span>
                          <span v-if="role.codes.length > 8" class="mds-muted">等 {{ role.codes.length }} 项</span>
                          <span v-if="!role.codes.length" class="mds-muted">—</span>
        </template>
      </AgriVueTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getPlatformOpsUsers, getPlatformRoles } from '@/utils/api'

interface OpsUser {
  id: string
  username: string
  nickname?: string
  phone?: string
  roles?: string[]
  realnameStatus?: string
  status?: number
  frozen?: boolean
  createdAt?: string
}

interface RoleRow {
  code: string
  name: string
  codes: string[]
}

const users = ref<OpsUser[]>([])
const roles = ref<RoleRow[]>([])
const loading = ref(false)
const loadError = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = reactive({ keyword: '', roleCode: '' })

const stats = computed<StatItem[]>(() => {
  const wildcard = roles.value.filter((role) => role.codes.includes('*')).length
  const operator = roles.value.filter((role) => ['SUPER_ADMIN', 'MARKET_OPS'].includes(role.code)).length
  const permissionTotal = roles.value.reduce((sum, role) => sum + role.codes.length, 0)
  return [
    { label: '运营账号', value: total.value, hint: '平台统一账号' },
    { label: '角色目录', value: roles.value.length, hint: `运营角色 ${operator} 个` },
    { label: '通配角色', value: wildcard, hint: '权限为 *（全部权限）', tone: wildcard ? 'warning' : undefined },
    { label: '权限码总量', value: permissionTotal, tone: 'brand' },
  ]
})

async function loadRoles() {
  try {
    const response = await getPlatformRoles()
    if (response.code !== 200) return
    roles.value = ((response.data ?? []) as Array<{ code?: string; name?: string; permissions?: string }>).map(
      (role) => ({
        code: role.code ?? '',
        name: role.name ?? role.code ?? '',
        codes: parseCodes(role.permissions),
      }),
    )
  } catch {
    roles.value = []
  }
}

function parseCodes(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function loadUsers() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getPlatformOpsUsers({
      pageNum: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      roleCode: filters.roleCode || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '账号加载失败')
    const data = (response.data ?? {}) as { records?: OpsUser[]; total?: number | string }
    users.value = data.records ?? []
    total.value = Number(data.total ?? 0)
  } catch (error) {
    users.value = []
    total.value = 0
    loadError.value = error instanceof Error ? error.message : '账号加载失败'
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  void loadUsers()
}

function reset() {
  filters.keyword = ''
  filters.roleCode = ''
  search()
}

function changePage(next: number) {
  page.value = next
  void loadUsers()
}

function changePageSize(size: number) {
  pageSize.value = size
  page.value = 1
  void loadUsers()
}

const REALNAME_TEXT: Record<string, string> = {
  verified: '已实名',
  pending: '审核中',
  rejected: '已驳回',
  draft: '未提交',
  none: '未实名',
}
const REALNAME_TONE: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  draft: 'gray',
  none: 'gray',
}
const realnameText = (value?: string) => REALNAME_TEXT[value ?? 'none'] ?? '未实名'
const realnameTone = (value?: string) => REALNAME_TONE[value ?? 'none'] ?? 'gray'
const formatDate = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

onMounted(async () => {
  await Promise.all([loadRoles(), loadUsers()])
})

const listColumns1: VueListColumn[] = [
  { prop: 'username', label: '账号', minWidth: 174, locked: true },
  { prop: 'nickname', label: '昵称', width: 128 },
  { prop: 'phone', label: '手机号', width: 142, kind: 'code' },
  { prop: 'roles', label: '角色', width: 128, ellipsis: false },
  { prop: 'realnameStatus', label: '实名', width: 104, kind: 'status', ellipsis: false },
  { prop: 'frozen', label: '状态', width: 104, kind: 'status', ellipsis: false },
  { prop: 'createdAt', label: '创建时间', width: 152, ellipsis: false },
]

const listColumns2: VueListColumn[] = [
  { prop: 'code', label: '角色编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'name', label: '角色名称', width: 128 },
  { prop: 'codes', label: '权限码数', width: 104, kind: 'number', ellipsis: false },
  { key: 'codes2', prop: 'codes', label: '权限码', width: 210, ellipsis: false },
]
</script>

<style scoped>
.role-chip,
.perm-chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  margin: 0 4px 0 0;
  padding: 0 7px;
  border-radius: 4px;
  background: #e9f6ef;
  color: #0f7a45;
  font-family: var(--mds-mono);
  font-size: var(--agri-font-size-micro);
}

.perm-chip {
  background: #f2f3f5;
  color: #4e5969;
}
</style>
