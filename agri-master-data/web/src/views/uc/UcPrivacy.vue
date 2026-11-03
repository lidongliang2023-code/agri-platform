<template>
  <div class="mds-page">
    <PageHeader
      title="隐私与数据申请"
      subtitle="用户提交的数据导出 / 账号注销申请台账；办理动作由用户中心运营端执行。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 隐私申请</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      办结 / 驳回入口已移到用户中心运营端；本页保留申请内容、处理说明与状态的核对能力。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>申请总数</span><strong>{{ rows.length }}</strong><small>当前筛选结果</small></div>
      <div class="audit-kpi tech"><span>待处理</span><strong>{{ counts.pending }}</strong><small>需要运营办理</small></div>
      <div class="audit-kpi green"><span>已办结</span><strong>{{ counts.completed }}</strong><small>导出已交付 / 已注销</small></div>
      <div class="audit-kpi red"><span>未通过</span><strong>{{ counts.rejected }}</strong><small>不具备办理条件</small></div>
    </div>

    <div class="search-bar">
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select" @change="loadData">
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="completed">已办结</option>
          <option value="rejected">未通过</option>
          <option value="cancelled">已撤回</option>
        </select>
        <select v-model="typeFilter" class="filter-select" @change="loadData">
          <option value="all">全部类型</option>
          <option value="export">数据导出</option>
          <option value="deletion">账号注销</option>
        </select>
      </div>
    </div>

    <div class="uc-table-wrap">
      <table class="uc-table">
        <thead>
          <tr>
            <th>申请人</th>
            <th>类型</th>
            <th>理由 / 范围</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="uc-td-empty">正在加载…</td></tr>
          <tr v-else-if="rows.length === 0"><td colspan="6" class="uc-td-empty">没有符合条件的申请</td></tr>
          <tr v-for="row in rows" :key="row.id">
            <td>
              {{ row.applicantName || row.userId }}
              <br /><small class="uc-muted">{{ row.applicantPhone || '' }}</small>
            </td>
            <td>
              <span class="uc-tag" :class="row.requestType">{{ typeLabel(row.requestType) }}</span>
            </td>
            <td class="uc-pv-cell">
              <p v-if="row.reason">{{ row.reason }}</p>
              <p v-else class="uc-muted">未填写理由</p>
              <small v-if="row.scope" class="uc-muted">范围：{{ row.scope }}</small>
              <div v-if="row.handleRemark" class="uc-pv-reply">
                <span>{{ row.handlerName || '平台运营' }} 处理</span>
                <p>{{ row.handleRemark }}</p>
              </div>
            </td>
            <td><span class="uc-status" :class="row.status">{{ statusText(row.status) }}</span></td>
            <td>{{ (row.submitTime || '').replace('T', ' ').slice(0, 16) }}</td>
            <td>
              <template v-if="row.status === 'pending' || row.status === 'processing'">
                <button class="mds-btn mds-btn--link" @click="openUserCenter">去用户中心办理</button>
              </template>
              <span v-else class="uc-muted">{{ row.handlerName || '—' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 办理弹窗 -->
    <div v-if="target" class="uc-pv-mask" @click.self="closeHandle">
      <div class="uc-pv-modal">
        <h3>{{ nextStatus === 'completed' ? '办结申请' : '驳回申请' }}</h3>
        <p class="uc-pv-quote">
          「{{ typeLabel(target.requestType) }}」— {{ target.applicantName || target.userId }}
        </p>
        <p v-if="nextStatus === 'completed'" class="uc-pv-hint">
          <template v-if="target.requestType === 'deletion'">
            请确认已完成：未结清交易已处理、未到期合同已协商、主体负责人身份已移交、审计留存已归档。
            本操作**不会**删除账号，只把单据置为已办结。
          </template>
          <template v-else>
            请确认已把导出文件交付给申请人（线上发送或线下拷贝），再置为已办结。
          </template>
        </p>
        <p v-else class="uc-pv-hint warn">
          驳回理由会直接展示给用户，请写明具体原因与后续可做的动作。
        </p>
        <textarea v-model="handleRemark" rows="4" maxlength="500" placeholder="处理说明（用户可见，必填）" />
        <div class="uc-pv-actions">
          <button class="search-btn" :disabled="saving !== ''" @click="closeHandle">取消</button>
          <button class="search-btn" :disabled="saving !== ''" @click="submitHandle">
            {{ saving !== '' ? '提交中…' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>

    <p class="uc-foot">
      说明：导出与注销都要跨多个业务库操作，不是一个接口能安全做完的事，所以这里刻意只做状态流转。
      接口 <code>/api/v1/admin/privacy-requests</code>，已收进超管白名单。
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
  applicantPhone: string | null
  requestType: string
  reason: string | null
  scope: string | null
  status: string
  handlerName: string | null
  handleRemark: string | null
  submitTime: string | null
}

const loading = ref(false)
const saving = ref('')
const statusFilter = ref('pending')
const typeFilter = ref('all')
const rows = ref<Row[]>([])

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}
const target = ref<Row | null>(null)
const nextStatus = ref<'completed' | 'rejected'>('completed')
const handleRemark = ref('')

const isOk = (res: any): boolean => res?.code === 0 || res?.code === 200

const TYPE_LABEL: Record<string, string> = {
  export: '数据导出',
  deletion: '账号注销',
}
const typeLabel = (code: string): string => TYPE_LABEL[code] ?? code

const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已办结',
  rejected: '未通过',
  cancelled: '已撤回',
}
const statusText = (status: string): string => STATUS_TEXT[status] ?? status

const counts = computed(() => ({
  pending: rows.value.filter((r) => r.status === 'pending' || r.status === 'processing').length,
  completed: rows.value.filter((r) => r.status === 'completed').length,
  rejected: rows.value.filter((r) => r.status === 'rejected').length,
}))

/** 确保本地有访问令牌；从 SSO 直接跳进来时 localStorage 可能还是空的 */
async function ensureToken(force = false): Promise<void> {
  if (!force && localStorage.getItem('token')) return
  if (force) localStorage.removeItem('token')
  const result = await refreshAccessToken()
  if (result?.accessToken) {
    localStorage.setItem('token', result.accessToken)
  }
}

/** 调超管接口，令牌失效时强制续签并重试一次 */
async function callAdmin<T = any>(
  method: 'get' | 'post',
  url: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  await ensureToken()
  const send = () =>
    method === 'get' ? request.get(url, { params: payload }) : request.post(url, payload)
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
    const res: any = await callAdmin('get', '/v1/admin/privacy-requests', {
      pageNum: 1,
      pageSize: 200,
      status: statusFilter.value,
      type: typeFilter.value,
    })
    if (!isOk(res)) {
      message.error(res?.message || '申请加载失败')
      rows.value = []
      return
    }
    rows.value = res.data?.records ?? []
  } catch {
    message.error('加载申请失败（请检查 core-platform 是否在运行）')
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openHandle(row: Row, status: 'completed' | 'rejected'): void {
  target.value = row
  nextStatus.value = status
  handleRemark.value = ''
}

function closeHandle(): void {
  target.value = null
  handleRemark.value = ''
}

async function submitHandle(): Promise<void> {
  const row = target.value
  if (!row) return
  if (!handleRemark.value.trim()) {
    message.error('请填写处理说明（用户会看到）')
    return
  }
  saving.value = row.id
  try {
    const res: any = await callAdmin('post', `/v1/admin/privacy-requests/${row.id}/handle`, {
      status: nextStatus.value,
      remark: handleRemark.value.trim(),
    })
    if (!isOk(res)) {
      message.error(res?.message || '处理失败')
      return
    }
    message.success(`${nextStatus.value === 'completed' ? '已办结' : '已驳回'}：${row.applicantName || row.userId}`)
    closeHandle()
    await loadData()
  } catch {
    message.error('处理请求失败')
  } finally {
    saving.value = ''
  }
}

onMounted(loadData)
</script>

<style scoped>
.uc-table-wrap { border: 1px solid #e6ede9; border-radius: 12px; background: #fff; overflow: auto; }
.uc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.uc-table th { text-align: left; padding: 10px 12px; background: #f7faf8; color: #526359; font-weight: 600; white-space: nowrap; }
.uc-table td { padding: 10px 12px; border-top: 1px solid #f0f4f2; color: #2b4034; vertical-align: top; }
.uc-td-empty { text-align: center; color: #9aa8a0; padding: 28px 12px !important; }
.uc-pv-cell { max-width: 420px; }
.uc-pv-cell p { margin: 0; color: #3c5347; line-height: 1.6; }
.uc-pv-reply { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #f7fcf9; border: 1px solid #dff0e6; }
.uc-pv-reply span { color: #12764a; font-size: var(--agri-font-size-micro); }
.uc-pv-reply p { margin: 4px 0 0; color: #2b4034; }
.uc-tag { padding: 2px 8px; border-radius: 999px; background: #eef4f1; color: #526359; font-size: var(--agri-font-size-micro); white-space: nowrap; }
.uc-tag.deletion { background: #fff0f0; color: #c53030; }
.uc-tag.export { background: #e8f1ff; color: #1d4ed8; }
.uc-status { padding: 2px 8px; border-radius: 999px; font-size: var(--agri-font-size-micro); background: #f1f4f2; color: #6b7c72; }
.uc-status.pending { background: #fff7df; color: #a16207; }
.uc-status.processing { background: #e8f1ff; color: #1d4ed8; }
.uc-status.completed { background: #e9f6ef; color: #12764a; }
.uc-status.rejected { background: #fff0f0; color: #c53030; }
.uc-status.cancelled { background: #f1f4f2; color: #9aa8a0; }
.uc-danger { color: #c53030; border-color: #ffd4d4; }
.uc-muted { color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot { margin-top: 14px; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot code { background: #f4f7f5; padding: 1px 4px; border-radius: 4px; }
.uc-pv-mask { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; background: rgba(15, 40, 28, .28); }
.uc-pv-modal { width: 560px; max-width: 94vw; padding: 20px 22px; border-radius: 14px; background: #fff; box-shadow: 0 20px 60px rgba(15, 40, 28, .22); }
.uc-pv-modal h3 { margin: 0 0 12px; color: #1f3a2c; font-size: 15px; }
.uc-pv-quote { margin: 0 0 10px; color: #1f3a2c; font-size: 12.5px; }
.uc-pv-hint { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: #f4f9f6; border: 1px solid #dff0e6; color: #3c5347; font-size: var(--agri-font-size-micro); line-height: 1.65; }
.uc-pv-hint.warn { background: #fff7f7; border-color: #ffd4d4; color: #a13a3a; }
.uc-pv-modal textarea { width: 100%; padding: 8px 10px; border: 1px solid #dbe6df; border-radius: 9px; font-size: 12px; font-family: inherit; outline: none; resize: vertical; }
.uc-pv-modal textarea:focus { border-color: #159a5e; }
.uc-pv-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
</style>
