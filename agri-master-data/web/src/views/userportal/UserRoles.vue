<template>
  <div class="mds-page">
    <PageHeader
      title="角色与权限"
      subtitle="本主体可见的角色：平台共享角色（由平台维护）与本主体自定义角色。成员与权限由本主体的租户管理员维护。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
        <button v-point="'POST /api/user/roles'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新增角色</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="口径：">
      角色数据归属本主体（agri_md_role）。平台共享角色只读；自定义角色可维护成员与权限，
      可授予的权限点不超过平台已授予本主体的范围，超范围的服务端会直接拒绝。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>角色名称</th>
              <th>角色编码</th>
              <th>类型</th>
              <th>数据范围</th>
              <th class="mds-num">级别</th>
              <th>状态</th>
              <th class="mds-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="mds-empty">正在加载角色…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="7">
                <EmptyState
                  icon="🔑"
                  title="当前主体还没有可用角色"
                  description="平台角色目录为空或均未对租户开放；可在右上角新增本主体业务角色。"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-name">{{ row.roleName || '—' }}</td>
              <td class="mds-mono">{{ row.roleCode || '—' }}</td>
              <td>
                <StatusTag
                  :text="row.tenantId ? '本主体自定义' : '平台共享'"
                  :tone="row.tenantId ? 'brand' : 'info'"
                  plain
                />
              </td>
              <td>{{ scopeText(row.dataScope) }}</td>
              <td class="mds-num">{{ row.roleLevel ?? '—' }}</td>
              <td>
                <StatusTag
                  :text="Number(row.status) === 1 ? '启用' : '停用'"
                  :tone="Number(row.status) === 1 ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-center">
                <template v-if="roleEditable(row)">
                  <button v-point="'PUT /api/user/roles/{id}'" class="org-link" @click="openEdit(row)">编辑</button>
                  <button v-point="'GET /api/user/roles/{id}/members'" class="org-link" @click="openMembers(row)">成员</button>
                  <button v-point="'GET /api/user/roles/grantable-permissions'" class="org-link" @click="openPermissions(row)">权限</button>
                  <button v-point="'DELETE /api/user/roles/{id}'" class="org-link org-link--danger" @click="removeRole(row)">删除</button>
                </template>
                <!-- 隐藏的原因要分开说：内置/共享是角色本身不可改，缺权限点是这个账号没被授权 -->
                <span v-if="roleEditable(row) && !points.can('PUT /api/user/roles/{id}')" class="mds-hint">未授权该操作</span>
                <span v-if="!roleEditable(row)" class="mds-hint">内置/共享</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增 / 编辑角色 -->
    <div v-if="dialogOpen" class="mds-mask" @click.self="dialogOpen = false">
      <div class="mds-dialog">
        <div class="mds-dialog__head">
          <h3>{{ editingId ? '编辑角色' : '新增角色' }}</h3>
          <button class="mds-dialog__close" @click="dialogOpen = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <label class="mds-field">
            角色名称 <span class="mds-required">*</span>
            <input v-model="form.roleName" class="mds-input" placeholder="如：仓储管理员" />
          </label>
          <label v-if="!editingId" class="mds-field">
            角色编码
            <input v-model="form.roleCode" class="mds-input" placeholder="留空自动生成（如 ROLE2001-01）" />
          </label>
          <label class="mds-field">
            数据范围
            <select v-model="form.dataScope" class="mds-select">
              <option value="self">仅本人</option>
              <option value="dept">本部门</option>
              <option value="org">本组织</option>
              <option value="all">本主体全部</option>
            </select>
          </label>
          <label class="mds-field">
            角色说明
            <textarea v-model="form.description" class="mds-input" rows="2" placeholder="选填" />
          </label>
          <p v-if="dialogError" class="mds-dialog__error">{{ dialogError }}</p>
          <p class="mds-dialog__tip">
            只能维护本主体自建的角色；平台共享角色（如超级管理员）不在此处修改。
          </p>
        </div>
        <div class="mds-dialog__foot">
          <button class="mds-btn" :disabled="saving" @click="dialogOpen = false">取消</button>
          <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submit">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 成员管理 -->
    <div v-if="memberOpen" class="mds-mask" @click.self="memberOpen = false">
      <div class="mds-dialog mds-dialog--wide">
        <div class="mds-dialog__head">
          <h3>成员管理 · {{ memberRoleName }}</h3>
          <button class="mds-dialog__close" @click="memberOpen = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <p class="mds-dialog__tip">只能加入本主体的账号；跨主体的账号服务端会直接拒绝。</p>
          <div class="role-subhead">已加入成员（{{ memberRows.length }}）</div>
          <div v-if="!memberRows.length" class="mds-empty">还没有成员</div>
          <table v-else class="mds-table">
            <thead>
              <tr><th>账号</th><th>姓名</th><th>手机号</th><th class="mds-center">操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="member in memberRows" :key="member.userId">
                <td class="mds-mono">{{ member.username || '—' }}</td>
                <td>{{ member.realName || '—' }}</td>
                <td>{{ member.phone || '—' }}</td>
                <td class="mds-center">
                  <button
                    v-point="'DELETE /api/user/roles/{id}/members/{userId}'"
                    class="org-link org-link--danger"
                    @click="removeMember(member.userId)"
                  >
                    移出
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="role-subhead" style="margin-top: 16px">添加成员</div>
          <div class="role-inline">
            <input
              v-model="memberKeyword"
              class="mds-input"
              placeholder="搜账号 / 姓名 / 手机号"
              @keyup.enter="loadCandidates"
            />
            <button class="mds-btn" :disabled="memberBusy" @click="loadCandidates">搜索</button>
          </div>
          <div class="role-choice">
            <label v-for="candidate in candidates" :key="candidate.id" class="role-choice__item">
              <input v-model="selectedUserIds" type="checkbox" :value="candidate.id" />
              <span>{{ candidate.realName || candidate.username }}</span>
              <small>{{ candidate.username }}</small>
            </label>
            <span v-if="!candidates.length" class="mds-hint">没有可加入的账号</span>
          </div>
          <p v-if="memberError" class="mds-dialog__error">{{ memberError }}</p>
        </div>
        <div class="mds-dialog__foot">
          <button class="mds-btn" @click="memberOpen = false">关闭</button>
          <button class="mds-btn mds-btn--primary" :disabled="memberBusy || !selectedUserIds.length" @click="addMembers">
            {{ memberBusy ? '提交中…' : '加入所选成员' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 权限授权 -->
    <div v-if="permOpen" class="mds-mask" @click.self="permOpen = false">
      <div class="mds-dialog mds-dialog--wide">
        <div class="mds-dialog__head">
          <h3>权限授权 · {{ permRoleName }}</h3>
          <button class="mds-dialog__close" @click="permOpen = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <p class="mds-dialog__tip">
            仅展示平台已授予本主体的权限点（共 {{ grantable.length }} 个）。超范围的点不会出现在这里，
            强行提交也会被服务端拒绝。
          </p>
          <div v-if="!grantable.length" class="mds-empty">平台尚未向本主体授予任何权限点</div>
          <div v-for="group in permissionGroups" :key="group.module" class="role-perm-group">
            <div class="role-subhead">{{ group.module || '未分组' }}</div>
            <label v-for="point in group.points" :key="point.id" class="role-choice__item">
              <input v-model="checkedPermIds" type="checkbox" :value="point.id" />
              <span>{{ point.permName || point.permCode }}</span>
              <small>{{ point.permCode }}</small>
            </label>
          </div>
          <p v-if="permError" class="mds-dialog__error">{{ permError }}</p>
        </div>
        <div class="mds-dialog__foot">
          <button class="mds-btn" @click="permOpen = false">关闭</button>
          <button class="mds-btn mds-btn--primary" :disabled="permBusy" @click="savePermissions">
            {{ permBusy ? '保存中…' : '保存授权' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userDelete, userGet, userPost, userPut } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'
import { usePointStore } from '@/stores/points'

interface RoleRow {
  id?: string
  roleCode?: string
  roleName?: string
  roleType?: string
  roleLevel?: number
  dataScope?: string
  status?: number
  isSystem?: number
  tenantId?: string
}

interface RoleMember {
  userId: string
  username?: string
  realName?: string
  phone?: string
}

interface TenantUser {
  id: string
  username?: string
  realName?: string
}

interface PermissionPoint {
  id: string
  permCode?: string
  permName?: string
  module?: string
  apiPath?: string
  httpMethod?: string
}

const me = useMeStore()
const points = usePointStore()

/** 角色本身能不能改（内置与平台共享角色只读）；"这个账号有没有被授权改"由 v-point 与下面的占位文案负责。 */
const roleEditable = (row: RoleRow) => Number(row.isSystem) !== 1 && Boolean(row.tenantId)

/* ---------- 新增 / 编辑角色 ---------- */
const dialogOpen = ref(false)
const editingId = ref('')
const saving = ref(false)
const dialogError = ref('')
const emptyForm = () => ({ roleName: '', roleCode: '', dataScope: 'self', description: '' })
const form = ref(emptyForm())

function openCreate() {
  editingId.value = ''
  form.value = emptyForm()
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(row: RoleRow) {
  editingId.value = String(row.id)
  form.value = {
    roleName: row.roleName ?? '',
    roleCode: row.roleCode ?? '',
    dataScope: row.dataScope ?? 'self',
    description: '',
  }
  dialogError.value = ''
  dialogOpen.value = true
}

async function submit() {
  if (!form.value.roleName.trim()) {
    dialogError.value = '请填写角色名称'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    const res = editingId.value
      ? await userPut(`/api/user/roles/${editingId.value}`, {
          roleName: form.value.roleName,
          dataScope: form.value.dataScope,
          description: form.value.description,
        })
      : await userPost('/api/user/roles', form.value)
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    dialogOpen.value = false
    await load()
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}

/* ---------- 删除角色 ---------- */
async function removeRole(row: RoleRow) {
  if (!window.confirm(`确定删除角色「${row.roleName || row.roleCode}」吗？角色下有成员时会被服务端拒绝。`)) return
  try {
    const res = await userDelete(`/api/user/roles/${row.id}`)
    if (res.code !== 200) throw new Error(res.message || '删除失败')
    await load()
  } catch (e) {
    window.alert((e as Error).message || '删除失败')
  }
}

/* ---------- 成员管理 ---------- */
const memberOpen = ref(false)
const memberRoleId = ref('')
const memberRoleName = ref('')
const memberBusy = ref(false)
const memberError = ref('')
const memberRows = ref<RoleMember[]>([])
const memberKeyword = ref('')
const candidates = ref<TenantUser[]>([])
const selectedUserIds = ref<string[]>([])

async function openMembers(row: RoleRow) {
  memberRoleId.value = String(row.id)
  memberRoleName.value = row.roleName || row.roleCode || '角色'
  memberError.value = ''
  memberKeyword.value = ''
  selectedUserIds.value = []
  memberOpen.value = true
  await Promise.all([loadRoleMembers(), loadCandidates()])
}

async function loadRoleMembers() {
  try {
    const res = await userGet<RoleMember[]>(`/api/user/roles/${memberRoleId.value}/members`)
    memberRows.value = res.data ?? []
  } catch (e) {
    memberRows.value = []
    memberError.value = (e as Error).message || '成员加载失败'
  }
}

async function loadCandidates() {
  try {
    const res = await userGet<{ list?: TenantUser[] }>('/api/user/members', {
      pageNum: 1,
      pageSize: 100,
      keyword: memberKeyword.value.trim() || undefined,
    })
    const assigned = new Set(memberRows.value.map((item) => item.userId))
    candidates.value = (res.data?.list ?? []).filter((item) => !assigned.has(String(item.id)))
  } catch {
    candidates.value = []
  }
}

async function addMembers() {
  if (!selectedUserIds.value.length) return
  memberBusy.value = true
  memberError.value = ''
  try {
    const res = await userPost(`/api/user/roles/${memberRoleId.value}/members`, {
      userIds: selectedUserIds.value,
    })
    if (res.code !== 200) throw new Error(res.message || '加入失败')
    selectedUserIds.value = []
    await loadRoleMembers()
    await loadCandidates()
  } catch (e) {
    memberError.value = (e as Error).message || '加入失败'
  } finally {
    memberBusy.value = false
  }
}

async function removeMember(userId: string) {
  try {
    const res = await userDelete(`/api/user/roles/${memberRoleId.value}/members/${userId}`)
    if (res.code !== 200) throw new Error(res.message || '移出失败')
    await loadRoleMembers()
    await loadCandidates()
  } catch (e) {
    memberError.value = (e as Error).message || '移出失败'
  }
}

/* ---------- 权限授权 ---------- */
const permOpen = ref(false)
const permRoleId = ref('')
const permRoleName = ref('')
const permBusy = ref(false)
const permError = ref('')
const grantable = ref<PermissionPoint[]>([])
const checkedPermIds = ref<string[]>([])

const permissionGroups = computed(() => {
  const map = new Map<string, PermissionPoint[]>()
  grantable.value.forEach((point) => {
    const module = point.module || '未分组'
    if (!map.has(module)) map.set(module, [])
    map.get(module)!.push(point)
  })
  return Array.from(map.entries()).map(([module, list]) => ({ module, points: list }))
})

async function openPermissions(row: RoleRow) {
  permRoleId.value = String(row.id)
  permRoleName.value = row.roleName || row.roleCode || '角色'
  permError.value = ''
  permOpen.value = true
  try {
    const [catalog, granted] = await Promise.all([
      userGet<PermissionPoint[]>('/api/user/roles/grantable-permissions'),
      userGet<string[]>(`/api/user/roles/${permRoleId.value}/permissions`),
    ])
    grantable.value = catalog.data ?? []
    checkedPermIds.value = (granted.data ?? []).map(String)
  } catch (e) {
    grantable.value = []
    checkedPermIds.value = []
    permError.value = (e as Error).message || '权限加载失败'
  }
}

async function savePermissions() {
  permBusy.value = true
  permError.value = ''
  try {
    const res = await userPut(`/api/user/roles/${permRoleId.value}/permissions`, {
      permIds: checkedPermIds.value,
    })
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    // 回读校验：不做"看起来保存成功"的假象
    const readback = await userGet<string[]>(`/api/user/roles/${permRoleId.value}/permissions`)
    const saved = new Set((readback.data ?? []).map(String))
    const expected = new Set(checkedPermIds.value)
    if (saved.size !== expected.size || Array.from(expected).some((id) => !saved.has(id))) {
      throw new Error('保存后回读不一致，请刷新后重试')
    }
    permOpen.value = false
    await load()
  } catch (e) {
    permError.value = (e as Error).message || '保存失败'
  } finally {
    permBusy.value = false
  }
}

/* ---------- 列表 ---------- */
const rows = ref<RoleRow[]>([])
const loading = ref(false)

const SCOPE_TEXT: Record<string, string> = {
  ALL: '全部',
  TENANT: '本主体',
  ORG: '本组织',
  DEPT: '本部门',
  OWNER: '本人',
  SELF: '本人',
}
const scopeText = (scope?: string) => SCOPE_TEXT[(scope ?? '').toUpperCase()] ?? scope ?? '—'

const statItems = computed(() => [
  { label: '角色总数', value: rows.value.length },
  { label: '平台共享', value: rows.value.filter((row) => !row.tenantId).length, tone: 'brand' },
  { label: '本主体自定义', value: rows.value.filter((row) => Boolean(row.tenantId)).length },
  { label: '启用中', value: rows.value.filter((row) => Number(row.status) === 1).length, tone: 'success' },
])

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<RoleRow[]>('/api/user/roles')
    rows.value = response.data ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.org-link {
  border: 0;
  background: none;
  padding: 0 6px;
  font-size: 12.5px;
  color: var(--mds-brand-600, #12764a);
  cursor: pointer;
}
.org-link--danger {
  color: #c0392b;
}
.role-subhead {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--mds-ink-700, #3a4a41);
  margin: 10px 0 6px;
}
.role-inline {
  display: flex;
  gap: 8px;
  align-items: center;
}
.role-inline .mds-input {
  flex: 1;
}
.role-choice {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 8px;
  max-height: 150px;
  overflow: auto;
}
.role-choice__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.role-choice__item small {
  color: var(--mds-ink-400, #8b9a90);
}
.role-perm-group {
  margin-bottom: 10px;
}
.mds-dialog--wide {
  width: min(720px, 92vw);
}
</style>
