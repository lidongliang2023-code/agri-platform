<template>
  <div class="mds-page">
    <PageHeader
      title="入驻与生命周期"
      subtitle="经营主体（租户）的生命周期视图：认证状态从统一认证与用户中心回填，本页负责启用、停用与状态总览。"
      source="统一认证 · 经营主体主档"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 认证审核</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="职责边界：">
      主体注册在统一认证中心、实名与资质审核在用户中心运营端办理；本页不提供审核动作，
      只负责主体主数据侧的生命周期（启用 / 停用）与状态核对。
    </NoticeBar>

    <StatGrid :items="stats" />

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">生命周期状态机</h2>
          <p class="mds-card-sub">状态取自主体主档的 verifyStatus（认证）与 status（启用/停用）两个真实字段</p>
        </div>
      </div>
      <div class="mds-card-body">
        <div class="mds-steps">
          <div class="mds-step is-done">
            <span class="mds-step__no">1</span>注册主体
          </div>
          <span class="mds-step__line" />
          <div class="mds-step" :class="{ 'is-current': pendingCount > 0, 'is-done': pendingCount === 0 }">
            <span class="mds-step__no">2</span>实名 / 资质审核
          </div>
          <span class="mds-step__line" />
          <div class="mds-step" :class="{ 'is-done': verifiedCount > 0 }">
            <span class="mds-step__no">3</span>认证通过
          </div>
          <span class="mds-step__line" />
          <div class="mds-step" :class="{ 'is-current': activeCount > 0 }">
            <span class="mds-step__no">4</span>启用运行
          </div>
          <span class="mds-step__line" />
          <div class="mds-step">
            <span class="mds-step__no">5</span>停用 / 归档
          </div>
        </div>
        <p class="mds-hint" style="margin: 12px 0 0">
          停用后主体仍保留全部主数据与历史记录，可随时重新启用；审核驳回由用户中心发起整改，不在本页重置。
        </p>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="filters.keyword"
          class="mds-input"
          type="search"
          placeholder="搜索主体名称 / 编码 / 联系人"
          @keyup.enter="search"
        />
        <select v-model="filters.status" class="mds-select" @change="search">
          <option value="">全部生命周期状态</option>
          <option value="1">启用</option>
          <option value="0">停用</option>
        </select>
        <select v-model="filters.type" class="mds-select" @change="search">
          <option value="">全部主体类型</option>
          <option value="ENTERPRISE">企业主体</option>
          <option value="INDIVIDUAL">个人主体</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>主体名称</th>
              <th>主体编码</th>
              <th>类型</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>认证状态</th>
              <th>生命周期</th>
              <th>创建时间</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="9" class="mds-empty">正在加载经营主体…</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="9">
                <EmptyState title="暂无经营主体" description="调整筛选条件后重试；主体由统一认证注册产生，不会在本模块新建。" />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-name">{{ row.tenantName || '—' }}</td>
              <td class="mds-mono">{{ row.tenantCode || '—' }}</td>
              <td>{{ row.tenantType === 'INDIVIDUAL' ? '个人主体' : '企业主体' }}</td>
              <td>{{ row.contactPerson || '—' }}</td>
              <td class="mds-mono">{{ row.contactPhone || '—' }}</td>
              <td><StatusTag :text="verifyText(row.verifyStatus)" :tone="verifyTone(row.verifyStatus)" /></td>
              <td><StatusTag :text="lifecycleText(row)" :tone="lifecycleTone(row)" /></td>
              <td class="mds-muted">{{ formatDate(row.createTime) }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="openDetail(row.id)">详情</button>
                <button v-point="'PUT /admin/masterdata/subject/{id}/status'"
                  class="mds-btn mds-btn--link"
                  :class="{ 'mds-danger': isEnabled(row) }"
                  :disabled="busyId === row.id"
                  @click="toggleStatus(row)"
                >
                  {{ isEnabled(row) ? '停用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PagerBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @change="changePage"
        @update:page-size="changePageSize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import { getTenantList, getTenantStatistics, updateTenantStatus } from '@/utils/api'

interface TenantRow {
  id: number | string
  tenantCode?: string
  tenantName?: string
  tenantType?: string
  contactPerson?: string
  contactPhone?: string
  verifyStatus?: string
  status?: number
  createTime?: string
}

const router = useRouter()
const route = useRoute()
const rows = ref<TenantRow[]>([])
const loading = ref(false)
const busyId = ref<string | number | null>(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = reactive({
  keyword: typeof route.query.keyword === 'string' ? route.query.keyword : '',
  status: '',
  type: '',
})

const summary = ref<Record<string, number>>({})
const verificationCounts = ref<Record<string, number>>({})

const pendingCount = computed(() => verificationCounts.value.pending ?? 0)
const verifiedCount = computed(() => verificationCounts.value.approved ?? 0)
const activeCount = computed(() => summary.value.activeTenants ?? 0)

const stats = computed<StatItem[]>(() => [
  {
    label: '主体总数',
    value: summary.value.totalTenants ?? total.value,
    hint: '统一认证主体主档；与运营大盘「本地表启用数」不是同一口径',
  },
  {
    label: '认证通过',
    value: verifiedCount.value,
    hint: `待审核 ${pendingCount.value}`,
    tone: 'success',
  },
  { label: '启用运行', value: activeCount.value, tone: 'brand', hint: `停用 ${summary.value.inactiveTenants ?? 0}` },
  { label: '关联账号', value: summary.value.totalUsers ?? '—', hint: '主体主档关联的统一账号数' },
])

async function load() {
  loading.value = true
  try {
    const response = await getTenantList({
      pageNum: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      tenantStatus: filters.status || undefined,
      tenantType: filters.type || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '主体加载失败')
    rows.value = (response.data?.list ?? []) as TenantRow[]
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '主体加载失败')
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    const response = await getTenantStatistics()
    if (response.code !== 200) return
    const data = (response.data ?? {}) as {
      summary?: Record<string, unknown>
      verificationStatuses?: Array<{ name?: string; count?: number | string }>
    }
    const normalized: Record<string, number> = {}
    Object.entries(data.summary ?? {}).forEach(([key, value]) => {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) normalized[key] = numeric
    })
    summary.value = normalized
    const counts: Record<string, number> = {}
    ;(data.verificationStatuses ?? []).forEach((item) => {
      if (item?.name) counts[item.name] = Number(item.count ?? 0)
    })
    verificationCounts.value = counts
  } catch {
    // 汇总失败不影响列表可用性，统计区保持「—」
  }
}

function search() {
  page.value = 1
  void load()
}

function reset() {
  filters.keyword = ''
  filters.status = ''
  filters.type = ''
  search()
}

function changePage(next: number) {
  page.value = next
  void load()
}

function changePageSize(size: number) {
  pageSize.value = size
  page.value = 1
  void load()
}

const isEnabled = (row: TenantRow) => Number(row.status) === 1

const VERIFY_TEXT: Record<string, string> = {
  approved: '已认证',
  pending: '审核中',
  rejected: '已驳回',
  unverified: '未认证',
}
const VERIFY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  unverified: 'gray',
}
const verifyText = (value?: string) => VERIFY_TEXT[value ?? 'unverified'] ?? '未认证'
const verifyTone = (value?: string) => VERIFY_TONE[value ?? 'unverified'] ?? 'gray'

function lifecycleText(row: TenantRow) {
  if (!isEnabled(row)) return '已停用'
  if (row.verifyStatus === 'approved') return '运行中'
  if (row.verifyStatus === 'pending') return '待审核'
  if (row.verifyStatus === 'rejected') return '待整改'
  return '未认证'
}

function lifecycleTone(row: TenantRow): 'success' | 'warning' | 'danger' | 'gray' {
  if (!isEnabled(row)) return 'gray'
  if (row.verifyStatus === 'approved') return 'success'
  if (row.verifyStatus === 'pending' || row.verifyStatus === 'rejected') return 'warning'
  return 'gray'
}

async function toggleStatus(row: TenantRow) {
  const nextStatus = isEnabled(row) ? 0 : 1
  if (nextStatus === 0 && !window.confirm(`确认停用「${row.tenantName || row.tenantCode}」？停用后该主体将无法继续业务操作。`)) {
    return
  }
  busyId.value = row.id
  try {
    const response = await updateTenantStatus(row.id, nextStatus)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(nextStatus === 1 ? '主体已启用' : '主体已停用')
    await load()
    await loadSummary()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  } finally {
    busyId.value = null
  }
}

const formatDate = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')
const openDetail = (id: number | string) => router.push(`/subject/detail/${id}`)

function openUserCenter() {
  const url = `${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`
  window.open(url, '_blank', 'noopener')
}

onMounted(() => {
  void load()
  void loadSummary()
})
</script>
