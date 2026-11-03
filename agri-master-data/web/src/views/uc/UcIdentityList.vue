<template>
  <div class="mds-page">
    <PageHeader
      title="身份管理"
      subtitle="平台个人实名身份台账：跨模块核对实名结果，审核动作由用户中心运营端办理。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 实名审核</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      通过 / 驳回在本页<b>已移除</b> —— 同一动作在用户中心运营端有入口，两边都能改会让审核记录出现两套口径。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>身份总数</span><strong>{{ counts.total }}</strong><small>全部实名记录</small></div>
      <div class="audit-kpi tech"><span>待审核</span><strong>{{ counts.pending }}</strong><small>已提交待处理</small></div>
      <div class="audit-kpi green"><span>已通过</span><strong>{{ counts.approved }}</strong><small>实名生效</small></div>
      <div class="audit-kpi red"><span>已驳回</span><strong>{{ counts.rejected }}</strong><small>材料不合格</small></div>
      <div class="audit-kpi"><span>草稿</span><strong>{{ counts.draft }}</strong><small>未提交，不占待办</small></div>
    </div>

    <div class="search-bar">
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
          <option value="draft">草稿</option>
        </select>
      </div>
      <div class="search-group">
        <input v-model="keyword" class="search-input" placeholder="搜索姓名 / 身份编号 / 联系电话" />
      </div>
    </div>

    <div class="uc-table-wrap">
      <table class="uc-table">
        <thead>
          <tr>
            <th>身份编号</th>
            <th>姓名</th>
            <th>证件号</th>
            <th>联系电话</th>
            <th>核验</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="uc-td-empty">正在加载…</td></tr>
          <tr v-else-if="filtered.length === 0"><td colspan="8" class="uc-td-empty">没有符合条件的身份记录</td></tr>
          <tr v-for="row in filtered" :key="row.id">
            <td class="uc-mono">{{ row.identityNo || '—' }}</td>
            <td>{{ row.realName || '—' }}</td>
            <td class="uc-mono">{{ row.idNoMasked || '—' }}</td>
            <td>{{ row.contactPhone || '—' }}</td>
            <td>
              <span class="uc-chip" :class="row.policeVerified ? 'ok' : ''">公安</span>
              <span class="uc-chip" :class="row.livenessVerified ? 'ok' : ''">活体</span>
            </td>
            <td><span class="uc-status" :class="row.status">{{ statusText(row.status) }}</span></td>
            <td>{{ row.submitTime || '—' }}</td>
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
      说明：数据来自 <code>/api/v1/admin/user-identities</code>。证件号由服务端掩码返回，
      前端不接触明文；草稿状态表示用户尚未提交，不进入待办。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import '@/styles/admin-page.css'
import { getUserIdentities } from '@/utils/certification'

interface Row {
  id: string
  identityNo: string
  realName: string
  idNoMasked: string
  contactPhone: string
  policeVerified: boolean
  livenessVerified: boolean
  status: string
  submitTime: string
  reviewerName: string
}

const loading = ref(false)
const statusFilter = ref('all')
const keyword = ref('')
const rows = ref<Row[]>([])

function openUserCenter(): void {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

/** core-platform 成功码是 0；同时兼容 200 */
const isOk = (res: any): boolean => res?.code === 0 || res?.code === 200

/** 个人实名的终态叫 verified，不是 approved */
function normalizeStatus(raw: unknown): string {
  const text = String(raw ?? '').toLowerCase()
  if (text === 'verified' || text === 'approved') return 'approved'
  if (text === 'rejected') return 'rejected'
  if (text === 'pending') return 'pending'
  if (text === 'draft') return 'draft'
  return text || 'unknown'
}

const STATUS_TEXT: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  draft: '草稿',
  unknown: '未知',
}
const statusText = (status: string): string => STATUS_TEXT[status] ?? status

const counts = computed(() => ({
  total: rows.value.length,
  pending: rows.value.filter((r) => r.status === 'pending').length,
  approved: rows.value.filter((r) => r.status === 'approved').length,
  rejected: rows.value.filter((r) => r.status === 'rejected').length,
  draft: rows.value.filter((r) => r.status === 'draft').length,
}))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
    if (!kw) return true
    return [row.realName, row.identityNo, row.contactPhone]
      .some((field) => String(field ?? '').toLowerCase().includes(kw))
  })
})

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const res: any = await getUserIdentities({ pageNum: 1, pageSize: 200 })
    if (!isOk(res)) {
      message.error(res?.message || '身份列表加载失败')
      rows.value = []
      return
    }
    rows.value = (res.data?.records ?? []).map((item: any) => ({
      id: String(item.id),
      identityNo: item.identityNo ?? '',
      realName: item.realName ?? '',
      idNoMasked: item.idNoMasked ?? '',
      contactPhone: item.contactPhone ?? '',
      policeVerified: Boolean(item.policeVerified),
      livenessVerified: Boolean(item.livenessVerified),
      status: normalizeStatus(item.status),
      submitTime: item.submitTime ?? '',
      reviewerName: item.reviewerName ?? '',
    }))
  } catch {
    message.error('加载身份数据失败（请检查 core-platform 是否在运行）')
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
.uc-chip { display: inline-block; margin-right: 4px; padding: 1px 6px; border-radius: 999px; background: #f1f4f2; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-chip.ok { background: #e9f6ef; color: #12764a; }
.uc-status { padding: 2px 8px; border-radius: 999px; font-size: var(--agri-font-size-micro); background: #f1f4f2; color: #6b7c72; }
.uc-status.pending { background: #fff7df; color: #a16207; }
.uc-status.approved { background: #e9f6ef; color: #12764a; }
.uc-status.rejected { background: #fff0f0; color: #c53030; }
.uc-status.draft { background: #eef5ff; color: #3b6ea5; }
.uc-danger { color: #c53030; border-color: #ffd4d4; }
.uc-muted { color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot { margin-top: 14px; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot code { background: #f4f7f5; padding: 1px 4px; border-radius: 4px; }
</style>
