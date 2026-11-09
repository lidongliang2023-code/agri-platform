<template>
  <div class="mds-page">
    <PageHeader
      title="身份申请审核"
      subtitle="用户申请开通业务身份的台账：本页只做核对，审核动作由用户中心运营端办理。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 身份审核</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      通过 / 驳回在本页已移除，审核统一在用户中心运营端办理；本页保留台账与状态核对能力。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>申请总数</span><strong>{{ rows.length }}</strong><small>当前筛选结果</small></div>
      <div class="audit-kpi tech"><span>待审核</span><strong>{{ counts.pending }}</strong><small>需要运营处理</small></div>
      <div class="audit-kpi green"><span>已通过</span><strong>{{ counts.approved }}</strong><small>身份已开通</small></div>
      <div class="audit-kpi red"><span>已驳回</span><strong>{{ counts.rejected }}</strong><small>材料不合格</small></div>
    </div>

    <div class="search-bar">
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select" @change="loadData">
          <option value="all">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
          <option value="cancelled">已撤回</option>
        </select>
      </div>
    </div>

    <div class="uc-table-wrap">
      <table class="uc-table">
        <thead>
          <tr>
            <th>申请人</th>
            <th>申请身份</th>
            <th>主体名称</th>
            <th>信用代码</th>
            <th>联系人</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="uc-td-empty">正在加载…</td></tr>
          <tr v-else-if="rows.length === 0"><td colspan="8" class="uc-td-empty">没有符合条件的身份申请</td></tr>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.applicantName || row.userId }}</td>
            <td>{{ identityLabel(row.identityType) }}</td>
            <td>{{ row.subjectName || '—' }}</td>
            <td class="uc-mono">{{ row.creditCode || '—' }}</td>
            <td>{{ row.contactName || '—' }}<br /><small class="uc-muted">{{ row.contactPhone || '' }}</small></td>
            <td><span class="uc-status" :class="row.status">{{ statusText(row.status) }}</span></td>
            <td>{{ (row.applyTime || '').replace('T', ' ').slice(0, 16) }}</td>
            <td>
              <template v-if="row.status === 'pending'">
                <button class="mds-btn mds-btn--link" @click="openUserCenter">去用户中心审核</button>
              </template>
              <span v-else class="uc-muted">{{ row.reviewerName || '—' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="uc-foot">
      说明：审核只改申请单状态，**不会**自动改主体绑定或 RBAC 权限 ——
      对应业务权限由角色管理另行开通。接口 <code>/api/v1/admin/identity-applications</code>，
      已收进超管白名单。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import '@/styles/admin-page.css'
import request from '@/utils/request'
import { refreshAccessToken } from '@/utils/sso'

interface Row {
  id: string
  userId: string
  applicantName: string | null
  identityType: string
  subjectName: string | null
  creditCode: string | null
  contactName: string | null
  contactPhone: string | null
  status: string
  applyTime: string | null
  reviewerName: string | null
}

const loading = ref(false)
const statusFilter = ref('pending')
const rows = ref<Row[]>([])

function openUserCenter(): void {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

/** core-platform 成功码是 0；同时兼容 200 */
const isOk = (res: any): boolean => res?.code === 0 || res?.code === 200

/**
 * 身份码 → 中文名。
 *
 * <p>同一张申请单表里用户端写入小写业务码，历史种子/联调脚本写入大写枚举，
 * 因此按大写归一后查表，避免「申请身份」列直接露出 PURCHASER / COOP_ADMIN
 * 这类原始枚举；空值统一显示「—」。</p>
 */
const IDENTITY_LABEL: Record<string, string> = {
  PURCHASER: '收购商',
  WHOLESALER: '批发商',
  RETAILER: '零售商',
  FARMER: '农户',
  COOP_ADMIN: '合作社管理员',
  MALL_SUPPLIER: '商城供应商',
  SERVICE_PROVIDER: '服务商',
  GOVERNMENT: '政府人员',
}
const identityLabel = (code: string): string => {
  const key = String(code ?? '').trim().toUpperCase()
  if (!key) return '—'
  return IDENTITY_LABEL[key] ?? String(code)
}

const STATUS_TEXT: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已撤回',
}
const statusText = (status: string): string => STATUS_TEXT[status] ?? status

const counts = computed(() => ({
  pending: rows.value.filter((r) => r.status === 'pending').length,
  approved: rows.value.filter((r) => r.status === 'approved').length,
  rejected: rows.value.filter((r) => r.status === 'rejected').length,
}))

/**
 * 确保本地有访问令牌。
 *
 * <p>本页调的是 `/api/v1/admin/**`（超管白名单），必须带 Bearer 令牌，
 * 而运营端的 `request` 拦截器只从 `localStorage.token` 取。直接从 SSO 跳进来时
 * 这个值可能还没被写入 —— 那就用 HttpOnly 刷新凭证换一次，别让页面白跑一趟 401。</p>
 */
async function ensureToken(force = false): Promise<void> {
  if (!force && localStorage.getItem('token')) return
  if (force) localStorage.removeItem('token')
  const result = await refreshAccessToken()
  if (result?.accessToken) {
    localStorage.setItem('token', result.accessToken)
  }
}

/**
 * 调超管接口，令牌失效时强制续签并重试一次。
 *
 * <p>只在"没令牌"时补是不够的：从 SSO 跳过来时 localStorage 里可能躺着一枚
 * 早已过期的旧令牌，照样 401。所以按响应码判断，过期就换新令牌再打一次。</p>
 */
async function callAdmin<T = any>(
  method: 'get' | 'post',
  url: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  await ensureToken()
  const send = () =>
    method === 'get'
      ? request.get(url, { params: payload })
      : request.post(url, payload)
  let res: any = await send()
  const expired = res?.code === 401 || /未认证|凭证已失效/.test(String(res?.message ?? ''))
  if (expired) {
    await ensureToken(true)
    res = await send()
  }
  return res
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const res: any = await callAdmin('get', '/v1/admin/identity-applications', {
      pageNum: 1,
      pageSize: 200,
      status: statusFilter.value,
    })
    if (!isOk(res)) {
      message.error(res?.message || '身份申请加载失败')
      rows.value = []
      return
    }
    rows.value = res.data?.records ?? []
  } catch {
    message.error('加载身份申请失败（请检查 core-platform 是否在运行）')
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.uc-table-wrap { border: 1px solid #e6ede9; border-radius: 12px; background: #fff; overflow: auto; }
.uc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.uc-table th { text-align: left; padding: 10px 12px; background: #f7faf8; color: #526359; font-weight: 600; white-space: nowrap; }
.uc-table td { padding: 10px 12px; border-top: 1px solid #f0f4f2; color: #2b4034; vertical-align: middle; }
.uc-td-empty { text-align: center; color: #9aa8a0; padding: 28px 12px !important; }
.uc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--agri-font-size-micro); }
.uc-status { padding: 2px 8px; border-radius: 999px; font-size: var(--agri-font-size-micro); background: #f1f4f2; color: #6b7c72; }
.uc-status.pending { background: #fff7df; color: #a16207; }
.uc-status.approved { background: #e9f6ef; color: #12764a; }
.uc-status.rejected { background: #fff0f0; color: #c53030; }
.uc-status.cancelled { background: #f1f4f2; color: #9aa8a0; }
.uc-danger { color: #c53030; border-color: #ffd4d4; }
.uc-muted { color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot { margin-top: 14px; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot code { background: #f4f7f5; padding: 1px 4px; border-radius: 4px; }
</style>
