<!--
  企业工作台（重构版）

  <p><b>改动要点</b>：原来这一页是"只读看板" —— 数据来自统一认证的主体/实名/资质/消息，
  组织、成员、商品、客户这些真正的经营数据一个都没接，页面顶部还挂着"后端尚未提供"的说明。
  实际上后端 `/api/user/**` 早已提供按主体隔离的读接口（`UserWorkspaceController`），
  只是工作台没用它们。</p>

  <p>现在改成**经营工作台**：</p>
  <ul>
    <li>统计与列表全部走 `/api/user/*`（主体上下文由 `X-Agri-Merchant` 头声明、后端回源校验）</li>
    <li>新增 / 编辑 / 删除客户档案，以及维护主体联系信息 —— **都能真正落库**</li>
    <li>待办由真实数据推导，不再写死文案</li>
  </ul>
-->
<template>
  <div class="mds-page">
    <PageHeader
      title="企业工作台"
      :subtitle="headerSubtitle"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" @click="router.push('/user/messages')">消息通知</button>
        <button class="mds-btn" :disabled="loading" @click="loadAll">刷新</button>
      </template>
    </PageHeader>

    <!-- 未绑定主体：后端会直接拒绝所有企业端接口，这里先给出口 -->
    <div v-if="!loading && !merchantId" class="mds-card">
      <div class="mds-card-body">
        <EmptyState
          icon="🏢"
          title="还没有绑定经营主体"
          description="企业端所有数据都按主体隔离。账号需要先加入（或创建）一个经营主体，才能使用工作台。"
        >
          <button class="mds-btn" style="margin-top: 12px" @click="openUserCenter">前往用户中心</button>
        </EmptyState>
      </div>
    </div>

    <template v-else>
      <!-- 1) 经营概览：全部来自 /api/user/tenant-summary -->
      <StatGrid :items="statItems" />

      <!-- 2) 客户档案：可增删改，直接落库 -->
      <div class="mds-card">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">客户档案</h2>
            <p class="mds-card-sub">
              本主体的客户由企业自己维护，保存后立即落库；归属主体由服务端写入，不接受前端指定
            </p>
          </div>
          <div class="wb-head-actions">
            <input
              v-model="customerKeyword"
              class="wb-input wb-input--sm"
              placeholder="搜索客户名称 / 编码 / 联系人"
              @keyup.enter="loadCustomers"
            />
            <button class="mds-btn" :disabled="customerLoading" @click="loadCustomers">搜索</button>
            <button v-point="'POST /api/user/customers'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新增客户</button>
          </div>
          <p v-if="!points.can('POST /api/user/customers')" class="wb-tip">
            当前账号未持有「新增客户」的权限点，建档入口已隐藏；服务端同样会拒绝这个操作。
          </p>
        </div>

        <div class="mds-table-wrap">
          <table class="mds-table">
            <thead>
              <tr>
                <th>客户编码</th>
                <th>客户名称</th>
                <th class="mds-center">等级</th>
                <th>联系人</th>
                <th>联系电话</th>
                <th>状态</th>
                <th class="mds-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="customerLoading">
                <td colspan="7" class="mds-empty">正在加载客户…</td>
              </tr>
              <tr v-else-if="!customers.length">
                <td colspan="7">
                  <EmptyState
                    icon="🤝"
                    title="还没有客户档案"
                    description="点右上角「新增客户」建档，保存后即可在本表看到，数据落在主数据库。"
                  />
                </td>
              </tr>
              <tr v-for="row in customers" :key="row.id">
                <td class="mds-mono">{{ row.customerCode || '—' }}</td>
                <td class="mds-name">{{ row.customerName || '—' }}</td>
                <td class="mds-center">
                  <StatusTag :text="row.level || '—'" :tone="levelTone(row.level)" plain />
                </td>
                <td>{{ row.contactName || '—' }}</td>
                <td class="mds-mono">{{ row.contactPhone || '—' }}</td>
                <td>
                  <StatusTag
                    :text="Number(row.status) === 1 ? '正常' : '禁用'"
                    :tone="Number(row.status) === 1 ? 'success' : 'gray'"
                  />
                </td>
                <td class="mds-center">
                  <button v-point="'PUT /api/user/customers/{id}'" class="wb-link" @click="openEdit(row)">编辑</button>
                  <button v-point="'DELETE /api/user/customers/{id}'" class="wb-link wb-link--danger" @click="askDelete(row)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="wb-foot">
          <span>共 {{ customerTotal }} 条</span>
          <span v-if="customerTotal > customerPageSize" class="wb-pager">
            <button class="wb-link" :disabled="customerPage <= 1" @click="turnPage(-1)">上一页</button>
            <span>{{ customerPage }} / {{ Math.ceil(customerTotal / customerPageSize) }}</span>
            <button
              class="wb-link"
              :disabled="customerPage >= Math.ceil(customerTotal / customerPageSize)"
              @click="turnPage(1)"
            >
              下一页
            </button>
          </span>
        </div>
      </div>

      <!-- 3) 主体联系信息：可编辑落库 -->
      <div class="mds-card">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">主体联系信息</h2>
            <p class="mds-card-sub">
              只能改联系人 / 电话 / 地址 / 简介；组织名称与认证状态属于认证信息，改动要走审核
            </p>
          </div>
          <StatusTag :text="verifyText(merchant?.verifyStatus)" :tone="verifyTone(merchant?.verifyStatus)" />
        </div>
        <div class="mds-card-body">
          <div class="wb-form-grid">
            <label class="wb-field">
              归属组织
              <select v-model="orgForm.orgId" class="wb-input" @change="onOrgChange">
                <option v-for="org in orgs" :key="org.id" :value="org.id">{{ org.orgName }}</option>
              </select>
            </label>
            <label class="wb-field">
              联系人
              <input v-model="orgForm.contactPerson" class="wb-input" placeholder="填写负责人姓名" />
            </label>
            <label class="wb-field">
              联系电话
              <input v-model="orgForm.contactPhone" class="wb-input" placeholder="11 位手机号或座机" />
            </label>
            <label class="wb-field">
              地址
              <input v-model="orgForm.address" class="wb-input" placeholder="详细地址" />
            </label>
          </div>
          <label class="wb-field">
            简介
            <textarea v-model="orgForm.intro" class="wb-input wb-textarea" rows="2" placeholder="一句话介绍主营业务" />
          </label>
          <div class="wb-form-actions">
            <button v-point="'PUT /api/user/orgs/{id}'" class="mds-btn mds-btn--primary" :disabled="orgSaving" @click="saveOrg">
              {{ orgSaving ? '保存中…' : '保存联系信息' }}
            </button>
            <span v-if="!points.can('PUT /api/user/orgs/{id}')" class="wb-tip">当前账号未持有「修改组织联系信息」的权限点，保存入口已隐藏。</span>
            <span v-if="orgTip" class="wb-tip">{{ orgTip }}</span>
          </div>
        </div>
      </div>

      <!-- 4) 待办 + 最近操作 -->
      <div class="mds-grid mds-grid--2">
        <div class="mds-card" style="margin-bottom: 0">
          <div class="mds-card-head">
            <div>
              <h2 class="mds-card-title">待办</h2>
              <p class="mds-card-sub">由当前真实状态推导，不写死文案</p>
            </div>
          </div>
          <div class="mds-card-body mds-card-body--flush">
            <button v-for="todo in todos" :key="todo.label" class="todo-row" @click="router.push(todo.to)">
              <span class="todo-icon">{{ todo.icon }}</span>
              <span class="todo-main">
                <span class="todo-title">{{ todo.label }}</span>
                <span class="todo-hint">{{ todo.hint }}</span>
              </span>
              <span class="todo-action">{{ todo.action }} →</span>
            </button>
          </div>
        </div>

        <div class="mds-card" style="margin-bottom: 0">
          <div class="mds-card-head">
            <div>
              <h2 class="mds-card-title">最近操作</h2>
              <p class="mds-card-sub">本主体下的写操作留痕（后端切面自动记录）</p>
            </div>
            <button class="mds-btn mds-btn--link" @click="router.push('/user/operation-log')">全部</button>
          </div>
          <div v-if="!logs.length" class="mds-card-body">
            <EmptyState icon="🗂" title="还没有操作记录" description="新增或修改客户后，这里会出现留痕。" />
          </div>
          <div v-else class="mds-card-body mds-card-body--flush">
            <div v-for="log in logs" :key="log.id" class="log-row">
              <span class="log-main">
                <span class="log-title">{{ logTitle(log) }}</span>
                <span class="log-hint">{{ logHint(log) }}</span>
              </span>
              <span class="log-time">{{ formatTime(log.createTime || log.operationTime) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 5) 平台公告 -->
      <div class="mds-card" style="margin-top: 16px">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">平台公告</h2>
            <p class="mds-card-sub">已发布且未到期，最多展示 3 条</p>
          </div>
          <button class="mds-btn mds-btn--link" @click="router.push('/user/messages?tab=notice')">全部公告</button>
        </div>
        <div v-if="!announcements.length" class="mds-card-body">
          <EmptyState icon="📢" title="暂无生效中的公告" description="平台发布公告后会出现在这里。" />
        </div>
        <div v-else class="notice-list">
          <button
            v-for="item in announcements"
            :key="item.id"
            class="notice-row"
            @click="router.push('/user/messages?tab=notice')"
          >
            <span class="notice-icon">📢</span>
            <span class="notice-main">
              <span class="notice-title">{{ item.title }}</span>
              <span class="notice-content">{{ item.content }}</span>
            </span>
            <span class="notice-time">{{ formatTime(item.publishTime) }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- 新增 / 编辑客户弹窗 -->
    <div v-if="dialogOpen" class="wb-mask" @click.self="closeDialog">
      <div class="wb-dialog">
        <div class="wb-dialog-head">
          <h3>{{ editingId ? '编辑客户' : '新增客户' }}</h3>
          <button class="wb-dialog-close" @click="closeDialog">×</button>
        </div>
        <div class="wb-dialog-body">
          <label class="wb-field">
            客户名称 <span class="wb-required">*</span>
            <input v-model="form.customerName" class="wb-input" placeholder="如：哈尔滨中央城农贸市场" />
          </label>
          <div class="wb-form-grid">
            <label class="wb-field">
              客户简称
              <input v-model="form.shortName" class="wb-input" placeholder="选填" />
            </label>
            <label class="wb-field">
              客户等级
              <select v-model="form.level" class="wb-input">
                <option value="">未定级</option>
                <option value="A">A（重点）</option>
                <option value="B">B（常规）</option>
                <option value="C">C（观察）</option>
              </select>
            </label>
            <label class="wb-field">
              联系人
              <input v-model="form.contactName" class="wb-input" placeholder="选填" />
            </label>
            <label class="wb-field">
              联系电话
              <input v-model="form.contactPhone" class="wb-input" placeholder="选填" />
            </label>
          </div>
          <label class="wb-field">
            地址
            <input v-model="form.address" class="wb-input" placeholder="选填" />
          </label>
          <label class="wb-field">
            备注
            <textarea v-model="form.remark" class="wb-input wb-textarea" rows="2" placeholder="选填" />
          </label>
          <p v-if="dialogError" class="wb-error">{{ dialogError }}</p>
          <p v-if="!editingId" class="wb-tip">
            客户编码由服务端按「CUS{{ merchantId }}-序号」自动生成，不需要手工填写。
          </p>
        </div>
        <div class="wb-dialog-foot">
          <button class="mds-btn" :disabled="saving" @click="closeDialog">取消</button>
          <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitForm">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="wb-mask" @click.self="deleteTarget = null">
      <div class="wb-dialog wb-dialog--sm">
        <div class="wb-dialog-head">
          <h3>删除客户</h3>
          <button class="wb-dialog-close" @click="deleteTarget = null">×</button>
        </div>
        <div class="wb-dialog-body">
          <p class="wb-confirm-text">
            确认删除「{{ deleteTarget.customerName }}」？<br />
            <span class="wb-tip">删除为逻辑删除，记录仍在库中（del_flag=1），可在审计中追溯。</span>
          </p>
          <p v-if="dialogError" class="wb-error">{{ dialogError }}</p>
        </div>
        <div class="wb-dialog-foot">
          <button class="mds-btn" :disabled="saving" @click="deleteTarget = null">取消</button>
          <button class="mds-btn wb-btn-danger" :disabled="saving" @click="confirmDelete">
            {{ saving ? '删除中…' : '确认删除' }}
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
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useMeStore } from '@/stores/me'
import { usePointStore } from '@/stores/points'
import { userGet, userPost, userPut, userDelete } from '@/utils/userApi'
import {
  getMyAnnouncements,
  getMyCertifications,
  getMyRealName,
  type AnnouncementRow,
  type MyCertification,
  type MyIdentity,
} from '@/utils/me'

interface CustomerRow {
  id: string
  customerCode?: string
  customerName?: string
  shortName?: string
  level?: string
  contactName?: string
  contactPhone?: string
  address?: string
  remark?: string
  status?: number | string
}

interface OrgRow {
  id: string
  orgName?: string
  contactPerson?: string
  contactPhone?: string
  address?: string
  intro?: string
}

interface LogRow {
  id: string
  module?: string
  operationType?: string
  operationDesc?: string
  operator?: string
  requestUri?: string
  createTime?: string
  operationTime?: string
}

const router = useRouter()
const me = useMeStore()
const points = usePointStore()

const loading = ref(false)
const merchantId = computed(() => String(me.current?.merchantId ?? ''))
const merchant = computed(() => me.current)

const cert = ref<MyCertification | null>(null)
const identity = ref<MyIdentity | null>(null)
const announcements = ref<AnnouncementRow[]>([])

/* ---------- 经营概览 ---------- */
const summary = ref<Record<string, unknown>>({})
const orgs = ref<OrgRow[]>([])
const logs = ref<LogRow[]>([])

/* ---------- 客户档案 ---------- */
const customers = ref<CustomerRow[]>([])
const customerTotal = ref(0)
const customerPage = ref(1)
const customerPageSize = 10
const customerKeyword = ref('')
const customerLoading = ref(false)

/* ---------- 弹窗 ---------- */
const dialogOpen = ref(false)
const editingId = ref('')
const saving = ref(false)
const dialogError = ref('')
const deleteTarget = ref<CustomerRow | null>(null)
const emptyForm = () => ({
  customerName: '',
  shortName: '',
  level: '',
  contactName: '',
  contactPhone: '',
  address: '',
  remark: '',
})
const form = ref(emptyForm())

/* ---------- 主体联系信息 ---------- */
const orgForm = ref({ orgId: '', contactPerson: '', contactPhone: '', address: '', intro: '' })
const orgSaving = ref(false)
const orgTip = ref('')

const ROLE_TEXT: Record<string, string> = { owner: '负责人', admin: '管理员', member: '成员', finance: '财务' }
const roleText = (code?: string) => ROLE_TEXT[code ?? ''] ?? code ?? '成员'
const VERIFY_TEXT: Record<string, string> = {
  approved: '已认证',
  verified: '已认证',
  pending: '认证中',
  rejected: '已驳回',
  unverified: '未认证',
}
const verifyText = (status?: string) => VERIFY_TEXT[status ?? ''] ?? status ?? '未认证'
const verifyTone = (status?: string) => {
  if (status === 'approved' || status === 'verified') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'gray'
}
const levelTone = (level?: string) => {
  if (level === 'A') return 'success'
  if (level === 'B') return 'info'
  if (level === 'C') return 'warning'
  return 'gray'
}
const IDENTITY_TEXT: Record<string, string> = {
  verified: '已实名',
  approved: '已实名',
  pending: '审核中',
  rejected: '已驳回',
  draft: '未提交',
}
const identityText = () =>
  identity.value?.status ? IDENTITY_TEXT[identity.value.status] ?? identity.value.status : '未实名'

const headerSubtitle = computed(() => {
  if (!me.current) return '当前账号尚未绑定经营主体'
  return `${me.current.merchantName} · 主体 ID ${me.current.merchantId} · 你在本主体的角色：${roleText(me.current.roleInMerchant)}`
})

const statItems = computed(() => [
  {
    label: '组织',
    value: Number(summary.value.orgCount ?? orgs.value.length ?? 0),
    hint: '本主体下的组织节点',
  },
  {
    label: '成员',
    value: Number(summary.value.memberCount ?? 0),
    hint: '本主体下的账号',
  },
  {
    label: '商品 SPU',
    value: Number(summary.value.productCount ?? 0),
    hint: '本主体的商品主数据',
  },
  {
    label: '客户',
    value: Number(summary.value.customerCount ?? customerTotal.value),
    hint: '本主体自维护的客户档案',
    tone: customerTotal.value > 0 ? 'success' : undefined,
  },
  {
    label: '供应商',
    value: Number(summary.value.supplierCount ?? 0),
    hint: '本主体的供应商档案',
  },
  {
    label: '未读消息',
    value: me.unread ?? 0,
    hint: '点右上角铃铛查看',
    tone: me.unread > 0 ? 'warning' : undefined,
  },
])

const todos = computed(() => {
  const list: Array<{ icon: string; label: string; hint: string; action: string; to: string }> = []
  if (merchant.value?.verifyStatus && !['approved', 'verified'].includes(merchant.value.verifyStatus)) {
    list.push({
      icon: '🏢',
      label: '主体认证未完成',
      hint: `当前状态：${verifyText(merchant.value.verifyStatus)}`,
      action: '查看资质',
      to: '/user/qualification',
    })
  }
  if (!identity.value || !['verified', 'approved'].includes(identity.value.status ?? '')) {
    list.push({
      icon: '🪪',
      label: '实名认证',
      hint: identity.value ? `当前状态：${identityText()}` : '尚未提交实名信息',
      action: '去认证',
      to: '/user/realname',
    })
  }
  if (!customers.value.length) {
    list.push({
      icon: '🤝',
      label: '还没有客户档案',
      hint: '客户档案是本主体自己维护的主数据，建议先建 1 条',
      action: '新增客户',
      to: '',
    })
  }
  if (me.unread > 0) {
    list.push({ icon: '🔔', label: '未读消息', hint: `${me.unread} 条未读`, action: '去查看', to: '/user/messages' })
  }
  if (!list.length) {
    list.push({ icon: '✅', label: '没有待办', hint: '认证与基础档案都已就绪', action: '刷新', to: '' })
  }
  return list
})

const formatTime = (value?: string | null) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

/**
 * 把操作日志翻译成人话。
 *
 * <p>后端切面记录的是 `operation_type`（HTTP 方法）与 `request_uri`，
 * 直接展示会变成 "delete · admin · UserWorkspaceController" —— 用户看不懂，
 * 而且暴露了内部类名。这里按 URI 归纳成业务动作。</p>
 */
const ACTION_TEXT: Record<string, string> = { create: '新增', update: '修改', delete: '删除' }
const logTitle = (log: LogRow): string => {
  const action = ACTION_TEXT[log.operationType ?? ''] ?? log.operationType ?? '操作'
  const uri = log.requestUri ?? ''
  if (uri.includes('/customers')) return `${action}客户档案`
  if (uri.includes('/orgs')) return `${action}主体联系信息`
  return log.operationDesc || action
}
const logHint = (log: LogRow): string => {
  const uri = log.requestUri ?? ''
  const kind = uri.includes('/customers') ? '客户档案' : uri.includes('/orgs') ? '主体联系信息' : '主数据'
  return `${log.operator || '—'} · ${kind}`
}

function openUserCenter() {
  window.open(
    `${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`,
    '_blank',
    'noopener',
  )
}

/* ---------- 数据加载 ---------- */

async function loadCustomers() {
  customerLoading.value = true
  try {
    const res = await userGet<{ list: CustomerRow[]; total: number | string }>('/api/user/customers', {
      pageNum: customerPage.value,
      pageSize: customerPageSize,
      keyword: customerKeyword.value.trim(),
    })
    customers.value = res.data?.list ?? []
    customerTotal.value = Number(res.data?.total ?? 0)
  } catch {
    customers.value = []
    customerTotal.value = 0
  } finally {
    customerLoading.value = false
  }
}

function turnPage(delta: number) {
  customerPage.value = Math.max(1, customerPage.value + delta)
  void loadCustomers()
}

async function loadOrgs() {
  try {
    const res = await userGet<OrgRow[]>('/api/user/orgs')
    orgs.value = res.data ?? []
    if (orgs.value.length && !orgForm.value.orgId) {
      orgForm.value.orgId = orgs.value[0].id
      onOrgChange()
    }
  } catch {
    orgs.value = []
  }
}

function onOrgChange() {
  const org = orgs.value.find((row) => row.id === orgForm.value.orgId)
  orgForm.value.contactPerson = org?.contactPerson ?? ''
  orgForm.value.contactPhone = org?.contactPhone ?? ''
  orgForm.value.address = org?.address ?? ''
  orgForm.value.intro = org?.intro ?? ''
  orgTip.value = ''
}

async function loadLogs() {
  try {
    const res = await userGet<{ list: LogRow[] }>('/api/user/operation-logs', { pageSize: 5 })
    logs.value = res.data?.list ?? []
  } catch {
    logs.value = []
  }
}

async function loadAll() {
  loading.value = true
  try {
    await me.load(true)
    if (!merchantId.value) return
    const [summaryRes, certRes, identityRes, noticeRes] = await Promise.all([
      userGet<Record<string, unknown>>('/api/user/tenant-summary').catch(() => null),
      getMyCertifications().catch(() => null),
      getMyRealName().catch(() => null),
      getMyAnnouncements(3).catch(() => null),
    ])
    summary.value = (summaryRes?.data ?? {}) as Record<string, unknown>
    cert.value = (certRes?.data ?? [])[0] ?? null
    identity.value = identityRes?.data ?? null
    announcements.value = (noticeRes?.data ?? []) as AnnouncementRow[]
    await Promise.all([loadCustomers(), loadOrgs(), loadLogs()])
  } finally {
    loading.value = false
  }
}

/* ---------- 客户档案写操作 ---------- */

function openCreate() {
  editingId.value = ''
  form.value = emptyForm()
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(row: CustomerRow) {
  editingId.value = row.id
  form.value = {
    customerName: row.customerName ?? '',
    shortName: row.shortName ?? '',
    level: row.level ?? '',
    contactName: row.contactName ?? '',
    contactPhone: row.contactPhone ?? '',
    address: row.address ?? '',
    remark: row.remark ?? '',
  }
  dialogError.value = ''
  dialogOpen.value = true
}

function closeDialog() {
  if (saving.value) return
  dialogOpen.value = false
}

async function submitForm() {
  if (!form.value.customerName.trim()) {
    dialogError.value = '请填写客户名称'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    if (editingId.value) {
      const res = await userPut(`/api/user/customers/${editingId.value}`, form.value)
      if (res.code !== 200) throw new Error(res.message || '保存失败')
    } else {
      const res = await userPost<{ customerCode?: string }>('/api/user/customers', form.value)
      if (res.code !== 200) throw new Error(res.message || '新增失败')
    }
    dialogOpen.value = false
    customerPage.value = 1
    await Promise.all([loadCustomers(), loadLogs(), refreshSummary()])
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}

function askDelete(row: CustomerRow) {
  deleteTarget.value = row
  dialogError.value = ''
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  saving.value = true
  dialogError.value = ''
  try {
    const res = await userDelete(`/api/user/customers/${target.id}`)
    if (res.code !== 200) throw new Error(res.message || '删除失败')
    deleteTarget.value = null
    await Promise.all([loadCustomers(), loadLogs(), refreshSummary()])
  } catch (e) {
    dialogError.value = (e as Error).message || '删除失败'
  } finally {
    saving.value = false
  }
}

async function refreshSummary() {
  const res = await userGet<Record<string, unknown>>('/api/user/tenant-summary').catch(() => null)
  if (res?.data) summary.value = res.data as Record<string, unknown>
}

/* ---------- 主体联系信息 ---------- */

async function saveOrg() {
  if (!orgForm.value.orgId) {
    orgTip.value = '没有可编辑的组织'
    return
  }
  orgSaving.value = true
  orgTip.value = ''
  try {
    const res = await userPut(`/api/user/orgs/${orgForm.value.orgId}`, {
      contactPerson: orgForm.value.contactPerson,
      contactPhone: orgForm.value.contactPhone,
      address: orgForm.value.address,
      intro: orgForm.value.intro,
    })
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    orgTip.value = '已保存到主数据库'
    await loadOrgs()
    onOrgChange()
  } catch (e) {
    orgTip.value = (e as Error).message || '保存失败'
  } finally {
    orgSaving.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.wb-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.wb-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--mds-line);
  border-radius: 8px;
  background: #fff;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--mds-text-1);
  outline: none;
}
.wb-input:focus { border-color: var(--mds-brand-deep); }
.wb-input--sm { width: 220px; }
.wb-textarea { resize: vertical; line-height: 1.6; }

.wb-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-bottom: 12px;
}
.wb-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--mds-text-2);
}
.wb-required { color: #c53030; }
.wb-form-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.wb-tip { font-size: var(--agri-font-size-micro); color: var(--mds-text-3); }
.wb-error { margin: 8px 0 0; font-size: 12px; color: #c53030; }

.wb-link {
  border: 0;
  background: none;
  padding: 0 6px;
  color: var(--mds-brand-deep);
  font-size: 12.5px;
  cursor: pointer;
}
.wb-link:disabled { color: var(--mds-text-3); cursor: not-allowed; }
.wb-link--danger { color: #c53030; }

.wb-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-top: 1px solid var(--mds-line-soft);
  font-size: 12px;
  color: var(--mds-text-3);
}
.wb-pager { display: flex; align-items: center; gap: 8px; }

.wb-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 30, 22, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 90;
}
.wb-dialog {
  width: 560px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.wb-dialog--sm { width: 420px; }
.wb-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--mds-line-soft);
}
.wb-dialog-head h3 { margin: 0; font-size: 15px; color: var(--mds-text-1); }
.wb-dialog-close {
  border: 0;
  background: none;
  font-size: 20px;
  line-height: 1;
  color: var(--mds-text-3);
  cursor: pointer;
}
.wb-dialog-body { padding: 18px 20px; }
.wb-dialog-body .wb-field { margin-bottom: 12px; }
.wb-dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--mds-line-soft);
}
.wb-confirm-text { margin: 0; font-size: 13px; line-height: 1.8; color: var(--mds-text-1); }
.wb-btn-danger { background: #c53030; border-color: #c53030; color: #fff; }

.todo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 13px 18px;
  border: 0;
  border-bottom: 1px solid var(--mds-line-soft);
  background: none;
  text-align: left;
  cursor: pointer;
}
.todo-row:last-child { border-bottom: 0; }
.todo-row:hover { background: #f7fbf9; }
.todo-icon { width: 26px; text-align: center; }
.todo-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.todo-title { font-size: 13px; font-weight: 600; }
.todo-hint { font-size: var(--agri-font-size-micro); color: var(--mds-text-3); }
.todo-action { flex: none; color: var(--mds-brand-deep); font-size: 12.5px; }

.log-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 18px;
  border-bottom: 1px solid var(--mds-line-soft);
}
.log-row:last-child { border-bottom: 0; }
.log-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.log-title { font-size: 12.5px; font-weight: 600; }
.log-hint { font-size: var(--agri-font-size-micro); color: var(--mds-text-3); }
.log-time { flex: none; font-family: var(--mds-mono); font-size: var(--agri-font-size-micro); color: var(--mds-text-3); }

.notice-list { display: flex; flex-direction: column; }
.notice-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 18px;
  border: 0;
  border-bottom: 1px solid var(--mds-line-soft);
  background: none;
  text-align: left;
  cursor: pointer;
}
.notice-row:last-child { border-bottom: 0; }
.notice-row:hover { background: #f7fbf9; }
.notice-icon { width: 24px; text-align: center; }
.notice-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.notice-title { font-size: 13px; font-weight: 600; }
.notice-content {
  font-size: 12px;
  color: var(--mds-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-time { flex: none; font-family: var(--mds-mono); font-size: var(--agri-font-size-micro); color: var(--mds-text-3); }
</style>
