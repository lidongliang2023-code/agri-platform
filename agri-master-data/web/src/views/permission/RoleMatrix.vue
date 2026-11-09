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

    <div class="mds-card request-queue">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">授权申请</h2>
          <p class="mds-card-sub">
            横幅上「申请授权」提交到这里。<b>同意即真的写授权</b>：该点授给申请人当前绑定的角色，
            他刷新页面后按钮就回来了；<b>驳回必须写原因</b> —— 不写原因的驳回只会让申请人再提一遍。
          </p>
        </div>
        <div class="mds-head-actions">
          <select v-model="requestStatus" class="mds-select" @change="loadRequests">
            <option value="PENDING">待处理</option>
            <option value="APPROVED">已同意</option>
            <option value="REJECTED">已驳回</option>
            <option value="">全部</option>
          </select>
          <span class="mds-tag mds-tag--plain">{{ requests.length }} 条</span>
          <button class="mds-btn" :disabled="requestLoading" @click="loadRequests">刷新</button>
        </div>
      </div>

      <div v-if="requestError" class="mds-card-body">
        <NoticeBar tone="danger" title="授权申请读取失败：">{{ requestError }}</NoticeBar>
      </div>

      <div v-else-if="!requestLoading && !requests.length" class="mds-card-body">
        <EmptyState
          icon="📥"
          title="这一档没有授权申请"
          description="申请来自「部分操作已隐藏」横幅：账号被权限点拦掉的按钮会计入清单，本人从这里发起申请，运营端在这里处理。"
        />
      </div>

      <div v-else class="mds-table-wrap" style="max-height: 360px; overflow: auto">
        <table class="mds-table">
          <thead>
            <tr>
              <th>申请人</th>
              <th>申请的权限点</th>
              <th>来自页面</th>
              <th>理由</th>
              <th class="mds-center">状态</th>
              <th class="mds-center">处理</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="requestLoading">
              <td colspan="6" class="mds-empty">正在读取授权申请…</td>
            </tr>
            <template v-for="req in requests" :key="req.id">
              <tr>
                <td>
                  <span class="mds-name">{{ req.applicantName || req.applicant }}</span>
                  <div class="mds-hint mds-mono">{{ req.applicant }}</div>
                </td>
                <td>
                  <span class="mds-mono">{{ req.permCode }}</span>
                  <div v-if="req.permName" class="mds-hint">{{ req.permName }}</div>
                </td>
                <td class="mds-muted mds-mono">{{ req.pagePath || '-' }}</td>
                <td class="mds-muted">{{ req.reason || '（未填理由）' }}</td>
                <td class="mds-center">
                  <span class="mds-tag" :class="statusTone(req.status)">{{ statusText(req.status) }}</span>
                </td>
                <td class="mds-center">
                  <template v-if="req.status === 'PENDING'">
                    <button
                      class="mds-btn mds-btn--sm"
                      v-point="'PUT /admin/masterdata/permission/requests/{id}/handle'"
                      :disabled="handlingId !== ''"
                      @click="handle(req, true)"
                    >同意</button>
                    <button
                      class="mds-btn mds-btn--sm"
                      v-point="'PUT /admin/masterdata/permission/requests/{id}/handle'"
                      :disabled="handlingId !== ''"
                      @click="startReject(req)"
                    >驳回</button>
                  </template>
                  <div v-else class="mds-hint">
                    {{ req.handler || '-' }}
                    <div>{{ req.handleRemark || '' }}</div>
                  </div>
                </td>
              </tr>
              <tr v-if="rejectingId === req.id">
                <td colspan="6">
                  <div class="reject-form">
                    <input
                      v-model="rejectRemark"
                      class="mds-input"
                      type="text"
                      maxlength="200"
                      placeholder="驳回原因（必填，会显示给申请人）"
                      @keyup.enter="handle(req, false)"
                    />
                    <button class="mds-btn mds-btn--primary mds-btn--sm" :disabled="handlingId !== ''" @click="handle(req, false)">
                      确认驳回
                    </button>
                    <button class="mds-btn mds-btn--sm" @click="startReject(null)">取消</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="keyword" class="mds-input" type="search" placeholder="搜索角色名称 / 编码" />
        <select v-model="onlyGranted" class="mds-select">
          <option value="">全部权限点</option>
          <option value="granted">只看已被授予</option>
        </select>
      </div>

      <!-- 权限点目录为空时不要渲染一张只有表头的矩阵：那看起来像"权限都丢了"，
           实际是 agri_md_menu 还没有数据。 -->
      <div v-if="!loading && !matrixRows.length" class="mds-card-body">
        <EmptyState
          icon="🔐"
          title="权限点目录为空，暂时无法生成矩阵"
          description="矩阵的行来自主数据后端的菜单 / 权限点表（agri_md_menu）。该表随服务启动由 data-menu-catalog.sql 写入运营端 9 组 / 43 个页面；若仍为空，说明目录脚本没有执行成功，先查后端启动日志。"
        >
          <div class="mds-head-actions" style="justify-content: center; margin-top: 14px">
            <button class="mds-btn" @click="router.push('/permission/role')">去角色与权限点</button>
            <button class="mds-btn" :disabled="loading" @click="load">重新计算</button>
          </div>
        </EmptyState>
      </div>

      <div v-else class="mds-table-wrap" style="max-height: 640px; overflow: auto">
        <table class="mds-table">
          <thead>
            <tr>
              <th>功能模块</th>
              <th>权限点</th>
              <th v-for="role in visibleRoles" :key="role.id" class="mds-center" :title="role.roleCode">
                {{ role.roleName }}
                <div class="mds-hint">{{ role.roleCode }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="visibleRoles.length + 2" class="mds-empty">正在读取角色与权限点…</td>
            </tr>
            <tr v-else-if="!visibleRows.length">
              <td :colspan="visibleRoles.length + 2">
                <EmptyState
                  title="没有匹配的权限点"
                  description="调整筛选条件；或到角色与权限点页维护权限点目录。"
                />
              </td>
            </tr>
            <tr v-for="row in visibleRows" :key="row.id">
              <td class="mds-muted">{{ row.group }}</td>
              <td>
                <span class="mds-name">{{ row.name }}</span>
                <div v-if="row.perms" class="mds-hint mds-mono">{{ row.perms }}</div>
              </td>
              <td v-for="role in visibleRoles" :key="role.id" class="mds-center">
                <button
                  v-if="canToggle(role)"
                  class="mark mark--toggle"
                  :class="{ 'is-busy': savingKey === cellKey(row.id, role.id) }"
                  :disabled="savingKey !== ''"
                  :title="row.granted[role.id] === true ? '点击取消授权' : '点击授予权限'"
                  @click="toggleGrant(row, role)"
                >
                  {{ row.granted[role.id] === true ? '●' : '—' }}
                </button>
                <span v-else-if="row.granted[role.id] === true" class="mark mark--yes">●</span>
                <span v-else-if="row.granted[role.id] === 'error'" class="mark mark--error" title="角色明细读取失败">?</span>
                <span v-else class="mark mark--no">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mds-hint" style="padding: 0 18px 14px">
        说明：这张矩阵的行是<b>页面级</b>权限点（菜单节点）；下一张是<b>接口级</b>权限点（写操作端点）。
        数据范围（全部 / 本租户 / 本组织 / 本人）在角色详情内维护，不体现在这两张功能权限矩阵里。
        编辑授权是覆盖式保存：每次提交该角色当前的完整权限点集合。
      </p>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">接口权限点（按钮级 / API 级）</h2>
          <p class="mds-card-sub">
            目录由后端真实端点映射同步（只登记 POST / PUT / DELETE / PATCH —— 读接口一旦被收紧就会把别人的列表页整片锁死）；
            <b>勾上即收紧</b>：该端点从此只有持有它的角色能调，取消最后一个持有者则回到"未纳管"。
          </p>
        </div>
        <div class="mds-head-actions">
          <span class="mds-tag mds-tag--plain">{{ visiblePointRows.length }} / {{ pointRows.length }} 条</span>
          <button class="mds-btn" v-point="'POST /admin/masterdata/permission/points/sync'" :disabled="syncing || loading" @click="syncCatalog">
            {{ syncing ? '同步中…' : '同步端点目录' }}
          </button>
        </div>
      </div>

      <div class="mds-filter">
        <input v-model="pointKeyword" class="mds-input" type="search" placeholder="搜索接口路径 / 操作名称" />
      </div>

      <div v-if="!loading && !pointRows.length" class="mds-card-body">
        <EmptyState
          icon="🔌"
          title="接口权限点目录为空"
          description="点右上角「同步端点目录」从当前应用的实际端点映射生成。目录不手工维护，所以它只可能是「还没同步」，不可能是「少了几条」。"
        />
      </div>

      <div v-else class="mds-table-wrap" style="max-height: 520px; overflow: auto">
        <table class="mds-table">
          <thead>
            <tr>
              <th>功能模块</th>
              <th>端点</th>
              <th v-for="role in visibleRoles" :key="role.id" class="mds-center" :title="role.roleCode">
                {{ role.roleName }}
                <div class="mds-hint">{{ role.roleCode }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="visibleRoles.length + 2" class="mds-empty">正在读取接口权限点…</td>
            </tr>
            <tr v-else-if="!visiblePointRows.length">
              <td :colspan="visibleRoles.length + 2">
                <EmptyState title="没有匹配的接口权限点" description="调整搜索词，或点「同步端点目录」刷新目录。" />
              </td>
            </tr>
            <tr v-for="row in visiblePointRows" :key="row.id">
              <td class="mds-muted">{{ row.group }}</td>
              <td>
                <span class="mds-name">{{ row.name }}</span>
                <div v-if="row.perms" class="mds-hint">{{ row.perms }}</div>
              </td>
              <td v-for="role in visibleRoles" :key="role.id" class="mds-center">
                <button
                  v-if="canTogglePoint(role)"
                  class="mark mark--toggle"
                  :class="{ 'is-busy': savingKey === cellKey(row.id, role.id) }"
                  :disabled="savingKey !== ''"
                  :title="row.granted[role.id] === true ? '点击取消授权（该端点可能回到未纳管）' : '点击授予：勾上后此端点只对持有者开放'"
                  @click="togglePointGrant(row, role)"
                >
                  {{ row.granted[role.id] === true ? '●' : '—' }}
                </button>
                <span v-else-if="row.granted[role.id] === true" class="mark mark--yes">●</span>
                <span v-else-if="row.granted[role.id] === 'error'" class="mark mark--error" title="角色明细读取失败">?</span>
                <span v-else class="mark mark--no">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mds-hint" style="padding: 0 18px 14px">
        平台超管（权限码含 *）不受这张矩阵约束，避免把自己关在门外；
        主体侧账号通过用户名桥接到本地角色，未绑定任何本地角色的账号在已收紧的端点上会被拒绝。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
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
  font-weight: 700;
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
  font-weight: 700;
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
