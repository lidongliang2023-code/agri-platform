<template>
  <div class="mds-page">
    <PageHeader
      title="角色权限矩阵"
      subtitle="角色 × 权限点全景对照：● 已授权，— 未授权。单元格全部来自角色与菜单的真实绑定关系，不做推断。"
      source="角色 / 菜单 · 主数据后端"
    >
      <template #actions>
        <span class="mds-hint">组织级角色由企业端租户管理员维护，本页只读</span>
        <button class="mds-btn" :disabled="loading" @click="load">重新计算</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="归属说明：">
      组织级角色数据归属本主体（agri_md_role），成员分配与权限授予由各主体企业端「角色与权限」页的租户管理员维护。
      运营端不再提供组织级角色的增删改入口；本页只做全景对照与授权申请审批。
    </NoticeBar>

    <StatGrid :items="stats" />

    <NoticeBar v-if="partial" tone="warning" title="部分角色明细读取失败：">
      失败的角色列显示「?」，不按「未授权」渲染 —— 把读取失败画成「无权限」会让人误删真实授权。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-tabs">
        <button
          type="button"
          class="mds-tab"
          :class="{ 'is-active': activeMatrixTab === 'menu' }"
          @click="activeMatrixTab = 'menu'"
        >
          页面权限矩阵<span class="mds-tab__count">{{ visibleRows.length }}</span>
        </button>
        <button
          type="button"
          class="mds-tab"
          :class="{ 'is-active': activeMatrixTab === 'point' }"
          @click="activeMatrixTab = 'point'"
        >
          接口权限点（按钮 / API）<span class="mds-tab__count">{{ visiblePointRows.length }}</span>
        </button>
        <button
          type="button"
          class="mds-tab"
          :class="{ 'is-active': activeMatrixTab === 'request' }"
          @click="activeMatrixTab = 'request'"
        >
          授权申请<span class="mds-tab__count">{{ requests.length }}</span>
        </button>
      </div>

      <!-- 页签 1：页面权限矩阵 -->
      <div v-if="activeMatrixTab === 'menu'" style="padding: 12px 14px">
        <AgriVueTable
          :columns="menuMatrixColumns"
          :data="visibleRows"
          row-key="id"
          :loading="loading"
          loading-text="正在读取角色与权限点…"
          column-settings-storage-key="mds:cols:role-matrix-menu"
          client-pagination
          v-model:page="menuPage"
          v-model:page-size="menuPageSize"
          @refresh="load"
        >
          <template #filter>
            <AgriVueFilterBar :field-count="2" :loading="loading" @search="menuPage = 1" @reset="resetMenuFilter">
              <div class="agri-vue-filter-field">
                <label>角色搜索</label>
                <input v-model="keyword" class="mds-input" type="search" placeholder="角色名称 / 编码" />
              </div>
              <div class="agri-vue-filter-field">
                <label>授权状态</label>
                <select v-model="onlyGranted" class="mds-select">
                  <option value="">全部权限点</option>
                  <option value="granted">只看已被授予</option>
                </select>
              </div>
            </AgriVueFilterBar>
          </template>

          <template #toolbar-left>
            <span class="mds-hint">页面级权限点（菜单节点）· 覆盖式保存</span>
          </template>

          <template #empty>
            <EmptyState
              v-if="!matrixRows.length"
              icon="🔐"
              title="权限点目录为空，暂时无法生成矩阵"
              description="矩阵的行来自主数据后端的菜单 / 权限点表（agri_md_menu）。"
            >
              <div class="mds-head-actions" style="justify-content: center; margin-top: 14px">
                <button class="mds-btn" @click="router.push('/permission/role')">去角色与权限点</button>
                <button class="mds-btn" :disabled="loading" @click="load">重新计算</button>
              </div>
            </EmptyState>
            <EmptyState
              v-else
              title="没有匹配的权限点"
              description="调整筛选条件；或到角色与权限点页维护权限点目录。"
            />
          </template>

          <template #cell-group="{ row }">
            <span class="mds-muted">{{ row.group }}</span>
          </template>
          <template #cell-name="{ row }">
            <div class="mds-cell-inline" :title="`${row.name}${row.perms ? '（' + row.perms + '）' : ''}`">
              <span class="mds-name mds-cell-main">{{ row.name }}</span>
              <span v-if="row.perms" class="mds-cell-sub mds-mono">{{ row.perms }}</span>
            </div>
          </template>
          <template v-for="role in visibleRoles" :key="role.id" #[`cell-role_${role.id}`]="{ row }">
            <button
              v-if="canToggle(role)"
              class="mark mark--toggle"
              :class="{ 'is-busy': savingKey === cellKey(row.id, role.id) }"
              :disabled="savingKey !== ''"
              :title="row.granted[role.id] === true ? '点击取消授权' : '点击授予权限'"
              @click="toggleGrant(row as MatrixRow, role)"
            >
              {{ row.granted[role.id] === true ? '●' : '—' }}
            </button>
            <span v-else-if="row.granted[role.id] === true" class="mark mark--yes">●</span>
            <span v-else-if="row.granted[role.id] === 'error'" class="mark mark--error" title="角色明细读取失败">?</span>
            <span v-else class="mark mark--no">—</span>
          </template>
        </AgriVueTable>
      </div>

      <!-- 页签 2：接口权限点 -->
      <div v-else-if="activeMatrixTab === 'point'" style="padding: 12px 14px">
        <AgriVueTable
          :columns="pointMatrixColumns"
          :data="visiblePointRows"
          row-key="id"
          :loading="loading"
          loading-text="正在读取接口权限点…"
          column-settings-storage-key="mds:cols:role-matrix-point"
          client-pagination
          v-model:page="pointPage"
          v-model:page-size="pointPageSize"
          @refresh="load"
        >
          <template #filter>
            <AgriVueFilterBar :field-count="1" :loading="loading" @search="pointPage = 1" @reset="resetPointFilter">
              <div class="agri-vue-filter-field">
                <label>接口关键字</label>
                <input v-model="pointKeyword" class="mds-input" type="search" placeholder="搜索接口路径 / 操作名称" />
              </div>
            </AgriVueFilterBar>
          </template>

          <template #toolbar-left>
            <button class="mds-btn mds-btn--primary" v-point="'POST /admin/masterdata/permission/points/sync'" :disabled="syncing || loading" @click="syncCatalog">
              {{ syncing ? '同步中…' : '同步端点目录' }}
            </button>
            <span class="mds-tag mds-tag--plain">{{ visiblePointRows.length }} / {{ pointRows.length }} 条</span>
            <span class="mds-hint">只登记写操作端点；勾上即收紧</span>
          </template>

          <template #empty>
            <EmptyState
              v-if="!pointRows.length"
              icon="🔌"
              title="接口权限点目录为空"
              description="点工具栏「同步端点目录」从当前应用的实际端点映射生成。"
            />
            <EmptyState
              v-else
              title="没有匹配的接口权限点"
              description="调整搜索词，或点「同步端点目录」刷新目录。"
            />
          </template>

          <template #cell-group="{ row }">
            <span class="mds-muted">{{ row.group }}</span>
          </template>
          <template #cell-name="{ row }">
            <div class="mds-cell-inline" :title="`${row.name}${row.perms ? '（' + row.perms + '）' : ''}`">
              <span class="mds-name mds-cell-main">{{ row.name }}</span>
              <span v-if="row.perms" class="mds-cell-sub mds-mono">{{ row.perms }}</span>
            </div>
          </template>
          <template v-for="role in visibleRoles" :key="role.id" #[`cell-role_${role.id}`]="{ row }">
            <button
              v-if="canTogglePoint(role)"
              class="mark mark--toggle"
              :class="{ 'is-busy': savingKey === cellKey(row.id, role.id) }"
              :disabled="savingKey !== ''"
              :title="row.granted[role.id] === true ? '点击取消授权（该端点可能回到未纳管）' : '点击授予：勾上后此端点只对持有者开放'"
              @click="togglePointGrant(row as MatrixRow, role)"
            >
              {{ row.granted[role.id] === true ? '●' : '—' }}
            </button>
            <span v-else-if="row.granted[role.id] === true" class="mark mark--yes">●</span>
            <span v-else-if="row.granted[role.id] === 'error'" class="mark mark--error" title="角色明细读取失败">?</span>
            <span v-else class="mark mark--no">—</span>
          </template>
        </AgriVueTable>
      </div>

      <!-- 页签 3：授权申请 -->
      <div v-else style="padding: 12px 14px">
        <NoticeBar v-if="requestError" tone="danger" title="授权申请读取失败：">{{ requestError }}</NoticeBar>

        <AgriVueTable
          :columns="requestColumns"
          :data="requests"
          row-key="id"
          :loading="requestLoading"
          loading-text="正在读取授权申请…"
          column-settings-storage-key="mds:cols:role-matrix-requests"
          client-pagination
          @refresh="loadRequests"
        >
          <template #filter>
            <AgriVueFilterBar :field-count="1" :loading="requestLoading" @search="loadRequests" @reset="resetRequestFilter">
              <div class="agri-vue-filter-field">
                <label>申请状态</label>
                <select v-model="requestStatus" class="mds-select" @change="loadRequests">
                  <option value="PENDING">待处理</option>
                  <option value="APPROVED">已同意</option>
                  <option value="REJECTED">已驳回</option>
                  <option value="">全部</option>
                </select>
              </div>
            </AgriVueFilterBar>
          </template>

          <template #toolbar-left>
            <span class="mds-tag mds-tag--plain">{{ requests.length }} 条</span>
            <span class="mds-hint">同意即写入申请人角色授权；驳回需填原因</span>
          </template>

          <template #empty>
            <EmptyState
              icon="📥"
              title="这一档没有授权申请"
              description="申请来自「部分操作已隐藏」横幅：账号被权限点拦掉的按钮会计入清单，本人从这里发起申请，运营端在这里处理。"
            />
          </template>

          <template #cell-applicant="{ row }">
            <div class="mds-cell-inline" :title="`${row.applicantName || row.applicant}（${row.applicant}）`">
              <span class="mds-name mds-cell-main">{{ row.applicantName || row.applicant }}</span>
              <span class="mds-cell-sub mds-mono">{{ row.applicant }}</span>
            </div>
          </template>
          <template #cell-permCode="{ row }">
            <div class="mds-cell-inline" :title="`${row.permCode} ${row.permName || ''}`.trim()">
              <span class="mds-mono mds-cell-main">{{ row.permCode }}</span>
              <span v-if="row.permName" class="mds-cell-sub">{{ row.permName }}</span>
            </div>
          </template>
          <template #cell-pagePath="{ row }">
            <span class="mds-muted mds-mono">{{ row.pagePath || '-' }}</span>
          </template>
          <template #cell-reason="{ row }">
            <span class="mds-muted">{{ row.reason || '（未填理由）' }}</span>
          </template>
          <template #cell-status="{ row }">
            <span class="mds-tag" :class="statusTone(row.status)">{{ statusText(row.status) }}</span>
          </template>
          <template #cell-actions="{ row }">
            <MdsRowActions
              v-if="row.status === 'PENDING'"
              :actions="[
                { key: 'approve', label: '同意', point: 'PUT /admin/masterdata/permission/requests/{id}/handle', disabled: handlingId !== '', onClick: () => handle(row as RequestRow, true) },
                { key: 'reject', label: '驳回', danger: true, point: 'PUT /admin/masterdata/permission/requests/{id}/handle', disabled: handlingId !== '', onClick: () => startReject(row as RequestRow) },
              ]"
            />
            <span v-else class="mds-hint">{{ row.handler || '-' }} {{ row.handleRemark || '' }}</span>
          </template>
        </AgriVueTable>

        <div v-if="rejectingRequest" class="reject-form" style="margin-top: 10px">
          <span class="mds-hint">驳回「{{ rejectingRequest.applicantName || rejectingRequest.applicant }}」的 {{ rejectingRequest.permCode }}：</span>
          <input
            v-model="rejectRemark"
            class="mds-input"
            type="text"
            maxlength="200"
            placeholder="驳回原因（必填，会显示给申请人）"
            @keyup.enter="handle(rejectingRequest, false)"
          />
          <button class="mds-btn mds-btn--primary mds-btn--sm" :disabled="handlingId !== ''" @click="handle(rejectingRequest, false)">
            确认驳回
          </button>
          <button class="mds-btn mds-btn--sm" @click="startReject(null)">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable, type VueListColumn } from '@agri/shared/vue/list'
import { usePointStore } from '@/stores/points'
import {
  assignRoleMenus,
  assignRolePoints,
  getMenuTree,
  getPermissionPoints,
  getPermissionRequests,
  getRoleDetail,
  getRoleList,
  getRolePoints,
  handlePermissionRequest,
  syncPermissionPoints,
} from '@/utils/api'

// 主键统一用 string：雪花 id 是 18 位，超过 Number.MAX_SAFE_INTEGER，
// 转 Number 会丢精度（930000000000000201 → ...200），提交上去后端就"查不到这个权限点"。
interface RoleRow {
  id: string
  roleName: string
  roleCode: string
  status?: number
  menuIds?: string[] | null
  /** 接口级权限点授权；null 表示还没读到（不参与渲染） */
  pointIds?: string[] | null
  editable?: boolean
  failed?: boolean
}

interface MenuNode {
  id: string
  menuName: string
  perms?: string
  children?: MenuNode[]
}

interface MatrixRow {
  id: string
  group: string
  name: string
  perms?: string
  granted: Record<string, boolean | 'error'>
}

interface PointNode {
  id: string
  permCode: string
  permName: string
  module?: string
  apiPath?: string
  httpMethod?: string
  /** 已被多少个角色持有；0 表示这个点还没被纳管（不拦任何人） */
  roleCount?: number
}

/** agri_md_permission_request 的出参形态（主键已由后端转成字符串） */
interface RequestRow {
  id: string
  applicant: string
  applicantName?: string
  permCode: string
  permName?: string
  pagePath?: string
  reason?: string
  status: string
  handler?: string
  handleRemark?: string
}

const loading = ref(false)
const activeMatrixTab = ref<'menu' | 'point' | 'request'>('menu')
// 注意：本页已经有一个 `points`（权限点目录数组），这里必须用别的名字，否则同名声明直接编译失败
const pointGuard = usePointStore()
const roles = ref<RoleRow[]>([])
const menus = ref<MenuNode[]>([])
const points = ref<PointNode[]>([])
const pointKeyword = ref('')
const syncing = ref(false)
const keyword = ref('')
const onlyGranted = ref('')
const editing = ref(false)
const savingKey = ref('')
const router = useRouter()

/* ---------- 授权申请队列 ---------- */
const requests = ref<RequestRow[]>([])
const requestStatus = ref('PENDING')
const requestLoading = ref(false)
const requestError = ref('')
const handlingId = ref('')
const rejectingId = ref<string | null>(null)
const rejectRemark = ref('')

const cellKey = (menuId: string, roleId: string) => `${roleId}:${menuId}`

/** 只有"可编辑角色 + 明细读取成功 + 当前账号持有授权端点"的单元格才能点。 */
const canToggle = (role: RoleRow) =>
  editing.value && Boolean(role.editable) && !role.failed && Array.isArray(role.menuIds)
  && pointGuard.can('PUT /admin/masterdata/permission/role/{id}/menus')

/**
 * 接口权限点的单元格与菜单行共用同一条可编辑规则，两张矩阵的行为必须一致。
 *
 * <p>这里用"不可点"而不是把按钮藏掉：格子本身要照常显示 ● / —（那是授权事实，
 * 不该因为看的人没权限就消失），只是他改不动 —— 与运营端其它只读列的画法一致。</p>
 */
const canTogglePoint = (role: RoleRow) =>
  editing.value && Boolean(role.editable) && !role.failed && Array.isArray(role.pointIds)
  && pointGuard.can('PUT /admin/masterdata/permission/role/{id}/points')

const visibleRoles = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return roles.value
  return roles.value.filter(
    (role) => role.roleName.toLowerCase().includes(kw) || role.roleCode.toLowerCase().includes(kw),
  )
})

const matrixRows = computed<MatrixRow[]>(() => {
  const rows: MatrixRow[] = []
  menus.value.forEach((group) => {
    const children = group.children?.length ? group.children : [group]
    children.forEach((node) => {
      const granted: Record<string, boolean | 'error'> = {}
      roles.value.forEach((role) => {
        if (role.failed) granted[role.id] = 'error'
        else granted[role.id] = Array.isArray(role.menuIds) && role.menuIds.includes(node.id)
      })
      rows.push({ id: node.id, group: group.menuName, name: node.menuName, perms: node.perms, granted })
    })
  })
  return rows
})

const visibleRows = computed(() => {
  if (onlyGranted.value !== 'granted') return matrixRows.value
  return matrixRows.value.filter((row) =>
    visibleRoles.value.some((role) => row.granted[role.id] === true),
  )
})

/** 接口权限点行：按 module 分组，单元格读角色的 pointIds（与菜单矩阵同一套渲染口径） */
const pointRows = computed<MatrixRow[]>(() =>
  points.value.map((point) => {
    const granted: Record<string, boolean | 'error'> = {}
    visibleRoles.value.forEach((role) => {
      if (role.failed) granted[role.id] = 'error'
      else granted[role.id] = Array.isArray(role.pointIds) && role.pointIds.includes(point.id)
    })
    return {
      id: point.id,
      group: point.module || '未分组',
      name: `${point.httpMethod ?? ''} ${point.apiPath ?? point.permName}`.trim(),
      perms: point.permName,
      granted,
    }
  }),
)

const visiblePointRows = computed(() => {
  const kw = pointKeyword.value.trim().toLowerCase()
  if (!kw) return pointRows.value
  return pointRows.value.filter(
    (row) => row.name.toLowerCase().includes(kw) || (row.perms ?? '').toLowerCase().includes(kw),
  )
})

const menuPage = ref(1)
const menuPageSize = ref(20)
const pointPage = ref(1)
const pointPageSize = ref(20)
watch([keyword, onlyGranted], () => { menuPage.value = 1 })
watch(pointKeyword, () => { pointPage.value = 1 })

const menuMatrixColumns = computed<VueListColumn[]>(() => [
  { prop: 'group', label: '功能模块', width: 140, locked: true },
  { prop: 'name', label: '权限点', width: 220, locked: true, ellipsis: false },
  ...visibleRoles.value.map((role) => ({
    key: `role_${role.id}`,
    label: role.roleName,
    width: 110,
    align: 'center' as const,
    ellipsis: false,
  })),
])

const pointMatrixColumns = computed<VueListColumn[]>(() => [
  { prop: 'group', label: '功能模块', width: 140, locked: true },
  { prop: 'name', label: '端点', width: 260, locked: true, ellipsis: false },
  ...visibleRoles.value.map((role) => ({
    key: `role_${role.id}`,
    label: role.roleName,
    width: 110,
    align: 'center' as const,
    ellipsis: false,
  })),
])

const requestColumns: VueListColumn[] = [
  { prop: 'applicant', label: '申请人', width: 165, locked: true, ellipsis: false },
  { prop: 'permCode', label: '申请的权限点', width: 240, ellipsis: false },
  { prop: 'pagePath', label: '来自页面', width: 160, kind: 'code' },
  { prop: 'reason', label: '理由', minWidth: 160 },
  { prop: 'status', label: '状态', width: 96, kind: 'status' },
  { key: 'actions', label: '操作', width: 130, kind: 'action' },
]

const rejectingRequest = computed(() => requests.value.find((req) => req.id === rejectingId.value) ?? null)

function resetMenuFilter() {
  keyword.value = ''
  onlyGranted.value = ''
  menuPage.value = 1
}

function resetPointFilter() {
  pointKeyword.value = ''
  pointPage.value = 1
}

function resetRequestFilter() {
  requestStatus.value = 'PENDING'
  void loadRequests()
}

const partial = computed(() => roles.value.some((role) => role.failed))

const stats = computed<StatItem[]>(() => {
  const grantedCount = roles.value.reduce((sum, role) => sum + (role.menuIds?.length ?? 0), 0)
  const grantedPointCount = roles.value.reduce((sum, role) => sum + (role.pointIds?.length ?? 0), 0)
  const restrictedCount = points.value.filter((point) => (point.roleCount ?? 0) > 0).length
  return [
    { label: '角色数', value: roles.value.length },
    { label: '页面权限点', value: matrixRows.value.length },
    { label: '接口权限点', value: points.value.length, tone: 'brand' },
    { label: '已纳管接口', value: restrictedCount, tone: restrictedCount > 0 ? 'danger' : undefined },
    { label: '授权关系', value: grantedCount + grantedPointCount },
  ]
})

async function load() {
  loading.value = true
  try {
    const [roleResponse, menuResponse, pointResponse] = await Promise.all([
      getRoleList({ pageNum: 1, pageSize: 100 }),
      getMenuTree(),
      getPermissionPoints(),
    ])
    if (roleResponse.code !== 200) throw new Error(roleResponse.message || '角色加载失败')
    const list = ((roleResponse.data?.list ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      roleName: String(item.roleName ?? item.roleCode ?? '未命名角色'),
      roleCode: String(item.roleCode ?? ''),
      status: Number(item.status ?? 1),
    }))
    roles.value = list.map((role) => ({ ...role, menuIds: null, pointIds: null }))

    const detailResults = await Promise.all(
      list.map(async (role) => {
        try {
          const [detailResponse, pointResponseOfRole] = await Promise.all([
            getRoleDetail(role.id),
            getRolePoints(role.id),
          ])
          if (detailResponse.code !== 200) return { id: role.id, failed: true as const }
          const detail = detailResponse.data as { menuIds?: Array<number | string>; editable?: boolean }
          const menuIds = (detail?.menuIds ?? []).map(String)
          const pointIds = pointResponseOfRole.code === 200
            ? ((pointResponseOfRole.data ?? []) as Array<number | string>).map(String)
            : []
          return { id: role.id, menuIds, pointIds, editable: Boolean(detail.editable) }
        } catch {
          return { id: role.id, failed: true as const }
        }
      }),
    )
    const detailMap = new Map(detailResults.map((item) => [item.id, item]))
    roles.value = roles.value.map((role) => {
      const detail = detailMap.get(role.id)
      if (!detail || 'failed' in detail) return { ...role, failed: true }
      return { ...role, menuIds: detail.menuIds, pointIds: detail.pointIds, editable: detail.editable }
    })

    menus.value = menuResponse.code === 200 ? ((menuResponse.data ?? []) as MenuNode[]) : []
    points.value = pointResponse.code === 200 ? ((pointResponse.data ?? []) as PointNode[]) : []
  } catch (error) {
    roles.value = []
    menus.value = []
    points.value = []
    message.error(error instanceof Error ? error.message : '权限矩阵加载失败')
  } finally {
    loading.value = false
  }
}

/** 目录来自代码里的真实端点，所以"同步"不是重新拉数据，而是让库里那份跟上这次发版。 */
async function syncCatalog() {
  syncing.value = true
  try {
    const response = await syncPermissionPoints()
    if (response.code !== 200) throw new Error(response.message || '目录同步失败')
    const data = (response.data ?? {}) as { created?: number; updated?: number; retired?: number; scanned?: number }
    message.success(
      `端点目录已同步：映射 ${data.scanned ?? 0} 个，新增 ${data.created ?? 0}，刷新 ${data.updated ?? 0}，下线 ${data.retired ?? 0}`,
    )
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '目录同步失败')
  } finally {
    syncing.value = false
  }
}

/**
 * 读取授权申请队列。
 *
 * <p>失败只让这一张卡自己显示错误，不牵连矩阵：读不到申请单不代表角色授权不可信，
 * 把整页判成"加载失败"反而让人不敢在这页改权限。</p>
 */
async function loadRequests() {
  requestLoading.value = true
  requestError.value = ''
  try {
    // 「全部」就是不传 status（后端空值即不按状态筛；"默认看待处理"只在这一处初始化）
    const response = await getPermissionRequests(requestStatus.value ? { status: requestStatus.value } : undefined)
    if (response.code !== 200) throw new Error(response.message || '授权申请读取失败')
    requests.value = ((response.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      applicant: String(item.applicant ?? ''),
      applicantName: item.applicantName == null ? undefined : String(item.applicantName),
      permCode: String(item.permCode ?? ''),
      permName: item.permName == null ? undefined : String(item.permName),
      pagePath: item.pagePath == null ? undefined : String(item.pagePath),
      reason: item.reason == null ? undefined : String(item.reason),
      status: String(item.status ?? ''),
      handler: item.handler == null ? undefined : String(item.handler),
      handleRemark: item.handleRemark == null ? undefined : String(item.handleRemark),
    }))
    rejectingId.value = null
  } catch (error) {
    requests.value = []
    requestError.value = error instanceof Error ? error.message : '授权申请读取失败'
  } finally {
    requestLoading.value = false
  }
}

function startReject(target: RequestRow | null) {
  rejectingId.value = target ? target.id : null
  rejectRemark.value = ''
}

const statusText = (status: string) =>
  status === 'PENDING' ? '待处理' : status === 'APPROVED' ? '已同意' : status === 'REJECTED' ? '已驳回' : status

const statusTone = (status: string) =>
  status === 'APPROVED' ? 'mds-tag--success' : status === 'REJECTED' ? 'mds-tag--danger' : 'mds-tag--warning'

/**
 * 处理一条申请。同意会真的写 agri_md_role_permission，所以成功后要把矩阵重算一遍 ——
 * 让操作者当场看见那一格从 — 变成 ●，"同意了"才不只是提示条上的一句话。
 */
async function handle(req: RequestRow, approve: boolean) {
  if (handlingId.value) return
  if (!approve && !rejectRemark.value.trim()) {
    message.warning('驳回必须写原因')
    return
  }
  handlingId.value = req.id
  try {
    const response = await handlePermissionRequest(req.id, approve, approve ? undefined : rejectRemark.value.trim())
    if (response.code !== 200) throw new Error(response.message || '处理失败')
    const data = (response.data ?? {}) as { granted?: number; message?: string }
    message.success(
      approve
        ? `已同意「${req.permCode}」：${data.message ?? `授给 ${data.granted ?? 0} 个角色`}`
        : `已驳回「${req.permCode}」`,
    )
    startReject(null)
    await loadRequests()
    if (approve) await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '处理失败')
  } finally {
    handlingId.value = ''
  }
}

async function toggleGrant(row: MatrixRow, role: RoleRow) {
  if (!canToggle(role) || savingKey.value) return
  const grantedNow = row.granted[role.id] === true
  const next = grantedNow
    ? (role.menuIds ?? []).filter((id) => id !== row.id)
    : [...(role.menuIds ?? []), row.id]
  savingKey.value = cellKey(row.id, role.id)
  try {
    const response = await assignRoleMenus(role.id, next)
    if (response.code !== 200) throw new Error(response.message || '授权保存失败')
    role.menuIds = next
    message.success(`${role.roleName} · ${grantedNow ? '已取消' : '已授予'}「${row.name}」`)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '授权保存失败')
  } finally {
    savingKey.value = ''
  }
}

/**
 * 两个读取各自独立：矩阵要逐角色拉 20 个请求（慢），申请队列一次就返回。
 * 绑在一起会让慢的一侧把快的一侧也拖住 —— 分开发，谁先回来谁先渲染。
 */
onMounted(() => {
  void load()
  void loadRequests()
})

/**
 * 接口权限点的授权：与菜单授权同样是覆盖式保存。
 *
 * <p>勾上即收紧 —— 该端点从此只有持有它的角色能调；把最后一个持有者取消掉，它又回到"未纳管"。
 * 这条语义在页面说明里写给操作者看，不然"我勾了一个点，别人怎么就 403 了"会被当成 bug。</p>
 */
async function togglePointGrant(row: MatrixRow, role: RoleRow) {
  if (!canTogglePoint(role) || savingKey.value) return
  const grantedNow = row.granted[role.id] === true
  const next = grantedNow
    ? (role.pointIds ?? []).filter((id) => id !== row.id)
    : [...(role.pointIds ?? []), row.id]
  savingKey.value = cellKey(row.id, role.id)
  try {
    const response = await assignRolePoints(role.id, next)
    if (response.code !== 200) throw new Error(response.message || '授权保存失败')
    role.pointIds = next
    message.success(`${role.roleName} · ${grantedNow ? '已取消' : '已授予'}「${row.perms || row.name}」`)
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '授权保存失败')
  } finally {
    savingKey.value = ''
  }
}
</script>

<style scoped>
.mark {
  font-size: 14px;
  font-weight: 600;
}

.mark--yes {
  color: #13a05a;
}

.mark--no {
  color: #c9cdd4;
}

.mark--error {
  color: #e65100;
}

.mark--toggle {
  width: 28px;
  height: 24px;
  border: 1px dashed #d7dbe0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #8a919b;
  line-height: 1;
}

.mark--toggle:hover:not(:disabled) {
  border-color: #13a05a;
  color: #13a05a;
}

.mark--toggle.is-busy {
  opacity: 0.4;
  cursor: progress;
}

.reject-form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reject-form .mds-input {
  flex: 1;
  min-width: 220px;
}
</style>
