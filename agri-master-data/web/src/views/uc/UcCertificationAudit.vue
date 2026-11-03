<template>
  <div class="mds-page">
    <PageHeader
      title="资质审核"
      subtitle="经营主体企业资质台账：营业执照 / 法人信息 / 对公打款核验。审核动作由用户中心运营端办理。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 资质审核</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      通过 / 驳回在本页已移除，审核统一在用户中心运营端办理；本页保留资质台账与状态核对能力。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi"><span>资质总数</span><strong>{{ counts.total }}</strong><small>全部企业认证</small></div>
      <div class="audit-kpi tech"><span>待审核</span><strong>{{ counts.pending }}</strong><small>已提交待处理</small></div>
      <div class="audit-kpi green"><span>已通过</span><strong>{{ counts.approved }}</strong><small>资质生效</small></div>
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
        <input v-model="keyword" class="search-input" placeholder="搜索主体名称 / 认证编号 / 信用代码 / 联系人" />
      </div>
    </div>

    <div class="uc-table-wrap">
      <table class="uc-table">
        <thead>
          <tr>
            <th>认证编号</th>
            <th>主体名称</th>
            <th>统一社会信用代码</th>
            <th>法人</th>
            <th>联系人</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="uc-td-empty">正在加载…</td></tr>
          <tr v-else-if="filtered.length === 0"><td colspan="8" class="uc-td-empty">没有符合条件的资质记录</td></tr>
          <tr v-for="row in filtered" :key="row.id">
            <td class="uc-mono">{{ row.certNo || '—' }}</td>
            <td>{{ row.name || '—' }}</td>
            <td class="uc-mono">{{ row.creditCode || '—' }}</td>
            <td>{{ row.legalPerson || '—' }}</td>
            <td>{{ row.contactName || '—' }}<br /><small class="uc-muted">{{ row.contactPhone || '' }}</small></td>
            <td><span class="uc-status" :class="row.status">{{ statusText(row.status) }}</span></td>
            <td>{{ row.submitTime || '—' }}</td>
            <td>
              <template v-if="row.status === 'pending'">
                <button class="mds-btn mds-btn--link" @click="openUserCenter">去用户中心审核</button>
              </template>
              <span v-else class="uc-muted">{{ row.reviewer || '—' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="uc-foot">
      说明：数据来自 <code>/api/v1/admin/merchant-certifications</code>。
      草稿表示主体刚建档、尚未提交认证，不进入待办；材料文件按需走
      <code>/certification-files</code> 受控地址读取。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import '@/styles/admin-page.css'
import { getMerchantCertifications } from '@/utils/certification'

interface Row {
  id: string
  certNo: string
  name: string
  creditCode: string
  legalPerson: string
  contactName: string
  contactPhone: string
  status: string
  submitTime: string
  reviewer: string
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

/** 企业认证的状态列叫 certStatus（draft/pending/approved/rejected） */
function normalizeStatus(raw: unknown): string {
  const text = String(raw ?? '').toLowerCase()
  if (text === 'approved' || text === 'verified') return 'approved'
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
    return [row.name, row.certNo, row.creditCode, row.contactName]
      .some((field) => String(field ?? '').toLowerCase().includes(kw))
  })
})

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const res: any = await getMerchantCertifications({ pageNum: 1, pageSize: 200 })
    if (!isOk(res)) {
      message.error(res?.message || '资质列表加载失败')
      rows.value = []
      return
    }
    rows.value = (res.data?.records ?? []).map((item: any) => ({
      id: String(item.id),
      certNo: item.certNo ?? '',
      name: item.companyName ?? item.merchantName ?? '',
      creditCode: item.creditCode ?? '',
      legalPerson: item.legalPerson ?? '',
      contactName: item.contactName ?? '',
      contactPhone: item.contactPhone ?? '',
      status: normalizeStatus(item.certStatus),
      submitTime: item.submitTime ?? item.createdAt ?? '',
      reviewer: item.reviewer ?? '',
    }))
  } catch {
    message.error('加载资质数据失败（请检查 core-platform 是否在运行）')
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
.uc-status.draft { background: #eef5ff; color: #3b6ea5; }
.uc-danger { color: #c53030; border-color: #ffd4d4; }
.uc-muted { color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot { margin-top: 14px; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot code { background: #f4f7f5; padding: 1px 4px; border-radius: 4px; }
</style>
