<template>
  <div class="mds-page">
    <PageHeader
      title="意见反馈处理"
      subtitle="用户提交的功能建议 / 问题报错 / 投诉举报台账；回复与关闭由用户中心运营端办理。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 反馈处理</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      回复入口已移到用户中心运营端；本页保留反馈内容、状态与处理结果的核对能力。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>反馈总数</span><strong>{{ rows.length }}</strong><small>当前筛选结果</small></div>
      <div class="audit-kpi tech"><span>待处理</span><strong>{{ counts.pending }}</strong><small>需要运营回复</small></div>
      <div class="audit-kpi green"><span>已回复</span><strong>{{ counts.replied }}</strong><small>已答复用户</small></div>
      <div class="audit-kpi red"><span>已关闭</span><strong>{{ counts.closed }}</strong><small>不再跟进</small></div>
    </div>

    <div class="search-bar">
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select" @change="loadData">
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="replied">已回复</option>
          <option value="closed">已关闭</option>
        </select>
        <select v-model="typeFilter" class="filter-select" @change="loadData">
          <option value="all">全部类型</option>
          <option value="suggestion">功能建议</option>
          <option value="bug">问题报错</option>
          <option value="complaint">投诉举报</option>
          <option value="other">其他</option>
        </select>
      </div>
    </div>

    <div class="uc-table-wrap">
      <table class="uc-table">
        <thead>
          <tr>
            <th>提交人</th>
            <th>类型</th>
            <th>标题 / 内容</th>
            <th>联系方式</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="uc-td-empty">正在加载…</td></tr>
          <tr v-else-if="rows.length === 0"><td colspan="7" class="uc-td-empty">没有符合条件的反馈</td></tr>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.submitterName || row.userId }}</td>
            <td><span class="uc-tag">{{ typeLabel(row.feedbackType) }}</span></td>
            <td class="uc-fb-cell">
              <strong>{{ row.title }}</strong>
              <p>{{ row.content }}</p>
              <small v-if="row.pagePath" class="uc-muted">来源 {{ row.pagePath }}</small>
              <div v-if="row.replyContent" class="uc-fb-reply">
                <span>{{ row.replierName || '平台运营' }} 回复</span>
                <p>{{ row.replyContent }}</p>
              </div>
            </td>
            <td>{{ row.contact || '—' }}</td>
            <td><span class="uc-status" :class="row.status">{{ statusText(row.status) }}</span></td>
            <td>{{ (row.submitTime || '').replace('T', ' ').slice(0, 16) }}</td>
            <td>
              <button v-if="row.status !== 'closed'" class="mds-btn mds-btn--link" @click="openUserCenter">
                去用户中心回复
              </button>
              <span v-else class="uc-muted">已关闭</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 回复弹窗 -->
    <div v-if="replyTarget" class="uc-fb-mask" @click.self="closeReply">
      <div class="uc-fb-modal">
        <h3>回复反馈</h3>
        <p class="uc-fb-quote">「{{ replyTarget.title }}」— {{ replyTarget.submitterName || replyTarget.userId }}</p>
        <p class="uc-fb-origin">{{ replyTarget.content }}</p>
        <textarea v-model="replyContent" rows="5" maxlength="1000" placeholder="写明处理结论或需要用户补充的信息" />
        <label class="uc-fb-close">
          <input v-model="closeAfterReply" type="checkbox" />
          回复后直接关闭（不再跟进）
        </label>
        <div class="uc-fb-actions">
          <button class="search-btn" :disabled="saving !== ''" @click="closeReply">取消</button>
          <button class="search-btn" :disabled="saving !== ''" @click="submitReply">
            {{ saving !== '' ? '提交中…' : '提交回复' }}
          </button>
        </div>
      </div>
    </div>

    <p class="uc-foot">
      说明：回复内容会同时写入该用户的站内信；反馈单**不会**因用户删除站内信而消失。
      接口 <code>/api/v1/admin/feedback</code>，已收进超管白名单。
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
  submitterName: string | null
  feedbackType: string
  title: string
  content: string
  contact: string | null
  pagePath: string | null
  status: string
  replyContent: string | null
  replierName: string | null
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
const replyTarget = ref<Row | null>(null)
const replyContent = ref('')
const closeAfterReply = ref(false)

/** core-platform 成功码是 0；同时兼容 200 */
const isOk = (res: any): boolean => res?.code === 0 || res?.code === 200

const TYPE_LABEL: Record<string, string> = {
  suggestion: '功能建议',
  bug: '问题报错',
  complaint: '投诉举报',
  other: '其他',
}
const typeLabel = (code: string): string => TYPE_LABEL[code] ?? code

const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  replied: '已回复',
  closed: '已关闭',
}
const statusText = (status: string): string => STATUS_TEXT[status] ?? status

const counts = computed(() => ({
  pending: rows.value.filter((r) => r.status === 'pending').length,
  replied: rows.value.filter((r) => r.status === 'replied').length,
  closed: rows.value.filter((r) => r.status === 'closed').length,
}))

/**
 * 确保本地有访问令牌。
 *
 * <p>本页调 `/api/v1/admin/**`（超管白名单），必须带 Bearer；运营端的 `request`
 * 拦截器只从 `localStorage.token` 取，从 SSO 直接跳进来时可能还没有。</p>
 */
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
    const res: any = await callAdmin('get', '/v1/admin/feedback', {
      pageNum: 1,
      pageSize: 200,
      status: statusFilter.value,
      type: typeFilter.value,
    })
    if (!isOk(res)) {
      message.error(res?.message || '反馈加载失败')
      rows.value = []
      return
    }
    rows.value = res.data?.records ?? []
  } catch {
    message.error('加载反馈失败（请检查 core-platform 是否在运行）')
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openReply(row: Row): void {
  replyTarget.value = row
  replyContent.value = ''
  closeAfterReply.value = false
}

function closeReply(): void {
  replyTarget.value = null
  replyContent.value = ''
  closeAfterReply.value = false
}

async function submitReply(): Promise<void> {
  const target = replyTarget.value
  if (!target) return
  if (!replyContent.value.trim()) {
    message.error('请填写回复内容')
    return
  }
  saving.value = target.id
  try {
    const res: any = await callAdmin('post', `/v1/admin/feedback/${target.id}/reply`, {
      content: replyContent.value.trim(),
      close: closeAfterReply.value,
    })
    if (!isOk(res)) {
      message.error(res?.message || '回复失败')
      return
    }
    message.success(`已回复：${target.title}`)
    closeReply()
    await loadData()
  } catch {
    message.error('回复请求失败')
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
.uc-fb-cell { max-width: 460px; }
.uc-fb-cell strong { display: block; color: #1f3a2c; font-size: 12.5px; }
.uc-fb-cell p { margin: 4px 0 0; color: #526359; line-height: 1.6; white-space: pre-wrap; }
.uc-fb-reply { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #f7fcf9; border: 1px solid #dff0e6; }
.uc-fb-reply span { color: #12764a; font-size: var(--agri-font-size-micro); }
.uc-fb-reply p { margin: 4px 0 0; color: #2b4034; }
.uc-tag { padding: 2px 8px; border-radius: 999px; background: #eef4f1; color: #526359; font-size: var(--agri-font-size-micro); white-space: nowrap; }
.uc-status { padding: 2px 8px; border-radius: 999px; font-size: var(--agri-font-size-micro); background: #f1f4f2; color: #6b7c72; }
.uc-status.pending { background: #fff7df; color: #a16207; }
.uc-status.replied { background: #e9f6ef; color: #12764a; }
.uc-status.closed { background: #f1f4f2; color: #9aa8a0; }
.uc-muted { color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot { margin-top: 14px; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot code { background: #f4f7f5; padding: 1px 4px; border-radius: 4px; }
.uc-fb-mask { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; background: rgba(15, 40, 28, .28); }
.uc-fb-modal { width: 560px; max-width: 94vw; padding: 20px 22px; border-radius: 14px; background: #fff; box-shadow: 0 20px 60px rgba(15, 40, 28, .22); }
.uc-fb-modal h3 { margin: 0 0 12px; color: #1f3a2c; font-size: 15px; }
.uc-fb-quote { margin: 0 0 6px; color: #1f3a2c; font-size: 12.5px; }
.uc-fb-origin { margin: 0 0 12px; padding: 8px 10px; border-radius: 8px; background: #f7faf8; color: #526359; font-size: var(--agri-font-size-micro); line-height: 1.6; white-space: pre-wrap; }
.uc-fb-modal textarea { width: 100%; padding: 8px 10px; border: 1px solid #dbe6df; border-radius: 9px; font-size: 12px; font-family: inherit; outline: none; resize: vertical; }
.uc-fb-modal textarea:focus { border-color: #159a5e; }
.uc-fb-close { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: #526359; font-size: var(--agri-font-size-micro); }
.uc-fb-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
</style>
