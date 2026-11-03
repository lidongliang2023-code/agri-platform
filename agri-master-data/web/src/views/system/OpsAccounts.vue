<template>
  <div class="mds-page">
    <PageHeader
      title="运营账号与角色"
      subtitle="平台运营团队的账号目录与角色权限码：账号主档在平台认证中心，角色与权限码同源。"
      source="统一认证 · 平台账号 / 角色"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 账号管理</button>
        <button class="mds-btn" :disabled="loading" @click="loadUsers">刷新</button>
      </template>
    </PageHeader>

    <StatGrid :items="stats" />

    <NoticeBar tone="info" title="只读视图：">
      账号的新建、冻结 / 解冻、重置密码与角色绑定都在用户中心运营端办理；
      本页读取平台 <code>/api/v1/admin/uc/users</code> 与 <code>/api/v1/admin/roles</code>，
      用于核对「谁在运营、持有什么权限码」，避免在多个入口各改一份。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="filters.keyword"
          class="mds-input"
          type="search"
          placeholder="搜索用户名 / 昵称 / 手机号"
          @keyup.enter="search"
        />
        <select v-model="filters.roleCode" class="mds-select" @change="search">
          <option value="">全部角色</option>
          <option v-for="role in roles" :key="role.code" :value="role.code">{{ role.name }}（{{ role.code }}）</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>昵称</th>
              <th>手机号</th>
              <th>角色</th>
              <th>实名</th>
              <th>状态</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="mds-empty">正在加载运营账号…</td>
            </tr>
            <tr v-else-if="!users.length">
              <td colspan="7">
                <EmptyState
                  :title="loadError || '没有匹配的账号'"
                  :description="loadError ? '当前账号没有读取平台账号目录的权限（需要 SUPER_ADMIN），或认证中心不可达。' : '调整关键字或角色筛选后重试。'"
                />
              </td>
            </tr>
            <tr v-for="user in users" :key="user.id">
              <td class="mds-name">{{ user.username }}</td>
              <td>{{ user.nickname || '—' }}</td>
              <td class="mds-mono">{{ user.phone || '—' }}</td>
              <td>
                <template v-if="user.roles?.length">
                  <span v-for="code in user.roles" :key="code" class="role-chip">{{ code }}</span>
                </template>
                <span v-else class="mds-muted">未绑定角色</span>
              </td>
              <td><StatusTag :text="realnameText(user.realnameStatus)" :tone="realnameTone(user.realnameStatus)" /></td>
              <td>
                <StatusTag
                  :text="user.frozen ? '已冻结' : Number(user.status) === 1 ? '正常' : '停用'"
                  :tone="user.frozen || Number(user.status) !== 1 ? 'danger' : 'success'"
                />
              </td>
              <td class="mds-muted">{{ formatDate(user.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <PagerBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @change="changePage"
        @update:page-size="changePageSize"
      />
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">角色目录与权限码</h2>
          <p class="mds-card-sub">通配符 <code>*</code> 表示拥有全部权限；运营端准入依赖 <code>SUPER_ADMIN</code> / <code>MARKET_OPS</code></p>
        </div>
        <span class="mds-tag mds-tag--plain">{{ roles.length }} 个角色</span>
      </div>
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>角色编码</th>
              <th>角色名称</th>
              <th class="mds-num">权限码数</th>
              <th>权限码</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!roles.length">
              <td colspan="4">
                <EmptyState title="没有读取到角色目录" description="需要平台超管权限；也可在用户中心运营端的「角色管理」查看。" />
              </td>
            </tr>
            <tr v-for="role in roles" :key="role.code">
              <td class="mds-mono">{{ role.code }}</td>
              <td class="mds-name">{{ role.name }}</td>
              <td class="mds-num">{{ role.codes.length }}</td>
              <td>
                <span v-for="code in role.codes.slice(0, 8)" :key="code" class="perm-chip">{{ code }}</span>
                <span v-if="role.codes.length > 8" class="mds-muted">等 {{ role.codes.length }} 项</span>
                <span v-if="!role.codes.length" class="mds-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
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
</script>

<style scoped>
.role-chip,
.perm-chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  margin: 0 6px 4px 0;
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
