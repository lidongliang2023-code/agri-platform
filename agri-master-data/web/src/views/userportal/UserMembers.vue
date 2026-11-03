<!--
  成员账号

  <p><b>数据来源（三层，职责不重叠）</b>：</p>
  <ol>
    <li><b>账号与成员归属</b> —— 用户中心 `/api/v1/sso/account/businesses/{id}/members`，唯一权威源；</li>
    <li><b>组织 / 部门 / 岗位</b> —— 主数据 `agri_md_member_profile`（成员任职档案），
        只存「账号 ID → 组织位置」，不冗余用户名手机号；</li>
    <li>两者按 `platformUserId` 连接。<b>以成员列表为主表</b>，任职档案里若有对不上的孤儿记录
        （账号已离开主体）不会显示。</li>
  </ol>

  <p>早先这一页读的是本地 `agri_md_user`，那里面是种子数据（主体 2001 有 5 条），
  而真实账号只有 2 个 —— 拿种子数据冒充员工。现在不这么做了。</p>
-->
<template>
  <div class="mds-page">
    <PageHeader
      title="成员账号"
      :subtitle="`账号来自统一认证；组织/部门/岗位由主数据任职档案维护（主体 ${merchantId || '—'}）`"
      source="用户中心 · 主体成员"
    >
      <template #actions>
        <button class="mds-btn" @click="router.push('/user/invite')">成员邀请与审批</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="两套数据的分工：">
      账号（用户名 / 手机号 / 角色 / 状态）来自<b>用户中心</b>的成员绑定关系，是唯一权威源；
      这里维护的是<b>「这个账号在组织里担任什么职务」</b>（组织 / 部门 / 岗位）。
      本地表里的历史种子数据若匹配不到真实账号，不会显示在成员列表里。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">成员列表</h2>
          <p class="mds-card-sub">
            共 {{ rows.length }} 人 · 已分配职务 {{ assignedCount }} 人 · 数据源：用户中心成员绑定
          </p>
        </div>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table member-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>主体内角色</th>
              <th>组织 / 部门 / 岗位</th>
              <th>加入时间</th>
              <th>账号状态</th>
              <th class="mds-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="mds-empty">正在加载成员…</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="6">
                <EmptyState
                  icon="👥"
                  title="当前主体还没有成员账号"
                  description="成员由用户中心的「申请加入 → 负责人审批」产生。到「成员邀请与审批」查看待处理申请。"
                >
                  <button class="mds-btn" style="margin-top: 12px" @click="router.push('/user/invite')">
                    去处理加入申请
                  </button>
                </EmptyState>
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.userId">
              <td>
                <div class="member-cell">
                  <span class="avatar">{{ (row.nickname || row.username || '用').slice(0, 1) }}</span>
                  <div>
                    <strong>{{ row.nickname || row.username }}</strong>
                    <small class="mds-hint">{{ row.username }} · {{ row.phone || '未填手机号' }}</small>
                  </div>
                </div>
              </td>
              <td>
                <StatusTag
                  :text="roleText(row.roleInMerchant)"
                  :tone="row.roleInMerchant === 'owner' ? 'brand' : 'info'"
                  plain
                />
              </td>
              <td>
                <div v-if="row.orgName || row.deptName || row.positionName" class="job-cell">
                  <span class="job-main">{{ row.deptName || row.orgName || '—' }}</span>
                  <small class="mds-hint">
                    <template v-if="row.positionName">{{ row.positionName }}</template>
                    <template v-if="row.orgName && row.deptName"> · {{ row.orgName }}</template>
                  </small>
                </div>
                <span v-else class="mds-hint">未分配</span>
              </td>
              <td class="mds-mono">{{ formatTime(row.joinedAt) }}</td>
              <td>
                <StatusTag
                  :text="Number(row.status) === 1 ? '正常' : '停用'"
                  :tone="Number(row.status) === 1 ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-center">
                <button
                  v-point="'PUT /api/user/member-profiles/{platformUserId}'"
                  class="row-link"
                  @click="openAssign(row)"
                >
                  {{ row.deptId || row.orgId ? '调整' : '分配' }}
                </button>
                <button
                  v-if="row.deptId || row.orgId || row.positionId"
                  v-point="'DELETE /api/user/member-profiles/{platformUserId}'"
                  class="row-link row-link--danger"
                  @click="clearAssign(row)"
                >
                  清除
                </button>
                <span v-if="!canAssign && !canClear" class="mds-hint">未授权该操作</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 分配组织 / 部门 / 岗位 -->
    <div v-if="dialogOpen" class="mds-mask" @click.self="dialogOpen = false">
      <div class="mds-dialog">
        <div class="mds-dialog__head">
          <h3>分配职务 · {{ assigning?.nickname || assigning?.username }}</h3>
          <button class="mds-dialog__close" @click="dialogOpen = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <label class="mds-field">
            所属组织
            <select v-model="form.orgId" class="mds-select" @change="onOrgChange">
              <option value="">不指定</option>
              <option v-for="org in orgs" :key="org.id" :value="String(org.id)">{{ org.orgName }}</option>
            </select>
          </label>
          <label class="mds-field">
            所属部门
            <select v-model="form.deptId" class="mds-select" @change="onDeptChange">
              <option value="">不指定</option>
              <option v-for="dept in visibleDepts" :key="dept.id" :value="String(dept.id)">
                {{ dept.deptName }}
              </option>
            </select>
          </label>
          <label class="mds-field">
            岗位
            <select v-model="form.positionId" class="mds-select" :disabled="!form.deptId || loadingPositions">
              <option value="">{{ form.deptId ? '不指定' : '请先选择部门' }}</option>
              <option v-for="pos in positions" :key="pos.id" :value="String(pos.id)">
                {{ pos.positionName }}
              </option>
            </select>
          </label>
          <p v-if="dialogError" class="mds-dialog__error">{{ dialogError }}</p>
          <p class="mds-dialog__tip">
            只选了部门时，组织会按部门自动补齐；岗位必须属于所选部门。
            这里改的是主数据的任职档案，<b>不影响</b>账号本身与登录权限。
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet, userPut, userDelete } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'
import { usePointStore } from '@/stores/points'

interface CoreMember {
  userId: string
  username?: string
  nickname?: string
  phone?: string
  status?: number | string
  roleInMerchant?: string
  joinedAt?: string
}

interface MemberProfile {
  platformUserId: string
  orgId?: string
  deptId?: string
  positionId?: string
  orgName?: string
  deptName?: string
  positionName?: string
}

interface OrgRow { id: string; orgName?: string }
interface DeptRow { id: string; deptName?: string; orgId?: string }
interface PosRow { id: string; positionName?: string }

interface MemberRow extends CoreMember, MemberProfile {}

const router = useRouter()
const me = useMeStore()
const points = usePointStore()
const canAssign = computed(() => points.can('PUT /api/user/member-profiles/{platformUserId}'))
const canClear = computed(() => points.can('DELETE /api/user/member-profiles/{platformUserId}'))
const loading = ref(false)
const rows = ref<MemberRow[]>([])
const merchantId = computed(() => String(me.current?.merchantId ?? ''))
const assignedCount = computed(
  () => rows.value.filter((r) => r.deptId || r.orgId || r.positionId).length,
)

/* ---------- 组织 / 部门 / 岗位（弹窗用） ---------- */
const orgs = ref<OrgRow[]>([])
const depts = ref<DeptRow[]>([])
const positions = ref<PosRow[]>([])
const loadingPositions = ref(false)

const dialogOpen = ref(false)
const assigning = ref<MemberRow | null>(null)
const saving = ref(false)
const dialogError = ref('')
const form = ref({ orgId: '', deptId: '', positionId: '' })

/** 部门按所选组织过滤；没选组织时全列出来 */
const visibleDepts = computed(() => {
  if (!form.value.orgId) return depts.value
  return depts.value.filter((d) => String(d.orgId ?? '') === form.value.orgId)
})

const ROLE_TEXT: Record<string, string> = {
  owner: '负责人',
  admin: '管理员',
  member: '成员',
  finance: '财务',
}
const roleText = (code?: string) => ROLE_TEXT[code ?? ''] ?? code ?? '成员'
const formatTime = (value?: string | null) =>
  value ? String(value).replace('T', ' ').slice(0, 16) : '—'

async function loadDicts() {
  try {
    const [orgRes, deptRes] = await Promise.all([
      userGet<OrgRow[]>('/api/user/orgs'),
      userGet<DeptRow[]>('/api/user/depts'),
    ])
    orgs.value = orgRes.data ?? []
    depts.value = deptRes.data ?? []
  } catch {
    orgs.value = []
    depts.value = []
  }
}

async function loadPositions(deptId: string) {
  positions.value = []
  if (!deptId) return
  loadingPositions.value = true
  try {
    const res = await userGet<PosRow[]>('/api/user/positions', { deptId })
    positions.value = res.data ?? []
  } catch {
    positions.value = []
  } finally {
    loadingPositions.value = false
  }
}

function onOrgChange() {
  // 换了组织，原部门可能不在新组织下 —— 直接清掉，避免提交一个"部门不属于组织"的组合
  form.value.deptId = ''
  form.value.positionId = ''
  positions.value = []
}

async function onDeptChange() {
  form.value.positionId = ''
  const dept = depts.value.find((d) => String(d.id) === form.value.deptId)
  // 选了部门但没选组织：按部门的所属组织补齐（后端也会补，这里补是为了让界面立刻一致）
  if (dept?.orgId) form.value.orgId = String(dept.orgId)
  await loadPositions(form.value.deptId)
}

async function openAssign(row: MemberRow) {
  assigning.value = row
  dialogError.value = ''
  form.value = {
    orgId: row.orgId ?? '',
    deptId: row.deptId ?? '',
    positionId: row.positionId ?? '',
  }
  if (!depts.value.length) await loadDicts()
  if (form.value.deptId) await loadPositions(form.value.deptId)
  dialogOpen.value = true
}

async function submit() {
  if (!assigning.value) return
  if (!form.value.orgId && !form.value.deptId && !form.value.positionId) {
    dialogError.value = '组织、部门、岗位至少选一项'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    const res = await userPut(`/api/user/member-profiles/${assigning.value.userId}`, {
      orgId: form.value.orgId,
      deptId: form.value.deptId,
      positionId: form.value.positionId,
    })
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    dialogOpen.value = false
    await load()
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function clearAssign(row: MemberRow) {
  if (!window.confirm(`确定清除「${row.nickname || row.username}」的组织/部门/岗位吗？`)) return
  try {
    const res = await userDelete(`/api/user/member-profiles/${row.userId}`)
    if (res.code !== 200) throw new Error(res.message || '清除失败')
    await load()
  } catch (e) {
    window.alert((e as Error).message || '清除失败')
  }
}

async function load() {
  loading.value = true
  try {
    await me.load()
    if (!merchantId.value) {
      rows.value = []
      return
    }
    /* 1) 真实成员：用户中心（权威源） */
    const res = await userGet<{ records: CoreMember[] }>(
      `/api/v1/sso/account/businesses/${merchantId.value}/members`,
    )
    const members = res.data?.records ?? []

    /* 2) 任职档案：组织/部门/岗位。取不到就当没分配，不让整页失败 */
    let profiles: MemberProfile[] = []
    try {
      const profileRes = await userGet<MemberProfile[]>('/api/user/member-profiles')
      profiles = profileRes.data ?? []
    } catch {
      profiles = []
    }
    const byUserId = new Map(profiles.map((item) => [String(item.platformUserId), item]))

    /* 3) 以成员列表为主表左连接：任职档案里的孤儿记录不会显示出来 */
    rows.value = members.map((member) => {
      const profile = byUserId.get(String(member.userId))
      return {
        ...member,
        orgId: profile?.orgId,
        deptId: profile?.deptId,
        positionId: profile?.positionId,
        orgName: profile?.orgName,
        deptName: profile?.deptName,
        positionName: profile?.positionName,
      }
    })
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  await loadDicts()
})
</script>

<style scoped>
.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  background: #e9f6ef;
  color: #12764a;
  font-size: 13px;
  font-weight: 600;
}
.job-cell {
  display: grid;
  gap: 2px;
}
.job-main {
  color: var(--mds-text-1);
  font-size: 13px;
}
.row-link {
  border: 0;
  background: none;
  padding: 0 6px;
  color: var(--mds-brand-deep);
  font-size: 12.5px;
  cursor: pointer;
}
.row-link--danger {
  color: #c53030;
}
</style>
