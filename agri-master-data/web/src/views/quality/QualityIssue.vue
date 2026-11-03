<template>
  <div class="mds-page">
    <PageHeader
      title="问题治理与合并"
      subtitle="质量问题的登记、处置与关闭：状态口径 pending / processing / resolved / ignored，处置人由服务端记当前登录账号。"
      source="数据治理 · 质量问题"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/quality/issues'" class="mds-btn mds-btn--primary" @click="openAddModal">+ 新建工单</button>
        <button class="mds-btn" @click="router.push('/quality/dashboard')">质量稽核</button>
      </template>
    </PageHeader>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="filterKeyword"
          class="mds-input"
          type="search"
          placeholder="当前页内搜索问题描述（后端暂无全文检索）"
          @keyup.enter="search"
        />
        <select v-model="filterStatus" class="mds-select" @change="search">
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </select>
        <select v-model="filterSeverity" class="mds-select" @change="search">
          <option value="all">全部等级</option>
          <option value="high">严重</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select v-model="filterDomain" class="mds-select" @change="search">
          <option value="all">全部数据域</option>
          <option value="user">用户主数据</option>
          <option value="org">组织主数据</option>
          <option value="product">商品主数据</option>
          <option value="customer">客户主数据</option>
          <option value="supplier">供应商主数据</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table issue-table">
          <thead>
            <tr>
              <th>工单编号</th>
              <th>问题描述</th>
              <th>所属数据域</th>
              <th>严重等级</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>处理人</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="mds-empty">正在加载问题工单…</td>
            </tr>
            <tr v-else-if="!visibleIssues.length">
              <td colspan="8">
                <EmptyState
                  title="暂无符合条件的问题工单"
                  description="调整筛选条件后重试；也可以直接新建一条质量问题。"
                />
              </td>
            </tr>
            <tr v-for="issue in visibleIssues" :key="issue.id">
              <td class="mds-mono">{{ issue.code }}</td>
              <td class="description-cell" :title="issue.description">{{ issue.description }}</td>
              <td>{{ issue.domain }}</td>
              <td><StatusTag :text="severityText(issue.severity)" :tone="severityTone(issue.severity)" /></td>
              <td><StatusTag :text="statusText(issue.status)" :tone="statusTone(issue.status)" /></td>
              <td class="mds-muted">{{ issue.createTime }}</td>
              <td>{{ issue.assignee || '—' }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="viewIssue(issue)">查看</button>
                <button
                  v-point="'PUT /admin/masterdata/quality/issues/{id}/handle'"
                  class="mds-btn mds-btn--link"
                  :disabled="busyId === issue.id || issue.status === 'resolved' || issue.status === 'ignored'"
                  @click="processIssue(issue)"
                >开始处理</button>
                <button
                  class="mds-btn mds-btn--link"
                  :class="{ 'mds-danger': issue.status !== 'resolved' }"
                  :disabled="busyId === issue.id || issue.status === 'resolved'"
                  @click="closeIssue(issue)"
                >关闭</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="currentPage"
        :page-size="pageSize"
        :total="total"
        @change="changePage"
        @update:page-size="changePageSize"
      />
    </div>

    <!-- 新建工单 -->
    <div v-if="showAddModal" class="mds-mask" @click="closeAddModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">新建工单</h2>
          <button class="mds-btn mds-btn--link" @click="closeAddModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">问题描述</span>
              <textarea v-model="form.description" class="mds-textarea" placeholder="描述问题现象、影响范围与复现条件" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">所属数据域</span>
              <select v-model="form.domain" class="mds-select">
                <option value="user">用户主数据</option>
                <option value="organization">组织主数据</option>
                <option value="product">商品主数据</option>
                <option value="customer">客户主数据</option>
                <option value="supplier">供应商主数据</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">严重等级</span>
              <select v-model="form.severity" class="mds-select">
                <option value="high">严重</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
          </div>
          <p class="mds-hint" style="margin-top: 10px">
            处理人由「谁点了处置」决定，服务端记当前登录账号，不在登记时填写；
            问题描述登记后不可修改（改结论应重新登记一条）。
          </p>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeAddModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveIssue">
              {{ saving ? '提交中…' : '登记工单' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 工单详情 -->
    <div v-if="showDetailModal" class="mds-mask" @click="closeDetailModal">
      <section class="mds-modal mds-modal--wide" @click.stop>
        <div class="mds-card-head">
          <div>
            <p class="mds-card-sub">工单详情 · {{ selectedIssue?.code }}</p>
            <h2 class="mds-card-title">{{ selectedIssue?.description }}</h2>
          </div>
          <button class="mds-btn" @click="closeDetailModal">关闭</button>
        </div>
        <div class="mds-card-body" v-if="selectedIssue">
          <div class="mds-kv-grid">
            <div class="mds-kv"><span class="mds-kv__k">工单编号</span><span class="mds-kv__v mds-mono">{{ selectedIssue.code }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">所属数据域</span><span class="mds-kv__v">{{ selectedIssue.domain }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">严重等级</span><span class="mds-kv__v">{{ severityText(selectedIssue.severity) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">状态</span><span class="mds-kv__v">{{ statusText(selectedIssue.status) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">创建时间</span><span class="mds-kv__v">{{ selectedIssue.createTime }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">处理人</span><span class="mds-kv__v">{{ selectedIssue.assignee || '未分配' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">处理进度</span><span class="mds-kv__v">{{ progressPercent(selectedIssue.status) }}%</span></div>
            <div class="mds-kv" v-if="selectedIssue.resolveRemark">
              <span class="mds-kv__k">处置结论</span><span class="mds-kv__v">{{ selectedIssue.resolveRemark }}</span>
            </div>
          </div>

          <div class="detail-section">
            <h4>处理日志</h4>
            <div v-if="!selectedIssue.logs?.length" class="mds-empty">暂无处置记录</div>
            <div v-else class="log-list">
              <div v-for="(log, index) in selectedIssue.logs" :key="index" class="log-item">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-action">{{ log.action }}<em v-if="log.remark"> · {{ log.remark }}</em></span>
                <span class="log-operator">{{ log.operator }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="mds-form-actions" v-if="selectedIssue">
          <button
            v-if="!['resolved', 'ignored'].includes(selectedIssue.status)"
            v-point="'PUT /admin/masterdata/quality/issues/{id}/handle'"
            class="mds-btn mds-btn--primary"
            @click="processIssue(selectedIssue)"
          >开始处理</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import {
  createQualityIssue,
  getQualityDetail,
  getQualityList,
  getQualityStatistics,
  handleQualityIssue,
} from '../../utils/api'

const router = useRouter()
const issues = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)
const showAddModal = ref(false)
const showDetailModal = ref(false)
const filterStatus = ref('all')
const filterSeverity = ref('all')
const filterDomain = ref('all')
const filterKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selectedIssue = ref(null)
const severityStats = ref({ high: 0, medium: 0, low: 0, open: 0 })

const form = reactive({
  description: '',
  domain: 'user',
  severity: 'medium',
})

const statItems = computed(() => [
  { label: '严重', value: severityStats.value.high ?? 0, tone: 'danger' },
  { label: '中等', value: severityStats.value.medium ?? 0, tone: 'warning' },
  { label: '低', value: severityStats.value.low ?? 0, tone: 'success' },
  { label: '待处理', value: severityStats.value.open ?? 0, hint: '待处理 + 处理中' },
])

/** 关键词只有「当前页内筛选」——后端 /issues 没有全文检索参数，不做假的全量搜索 */
const visibleIssues = computed(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  if (!kw) return issues.value
  return issues.value.filter((issue) => String(issue.description || '').toLowerCase().includes(kw))
})

const SEVERITY_TEXT = { high: '严重', medium: '中', low: '低' }
const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'success' }
const STATUS_TEXT = { pending: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭', ignored: '已忽略' }
const STATUS_TONE = { pending: 'warning', processing: 'info', resolved: 'success', closed: 'gray', ignored: 'gray' }
const severityText = (value) => SEVERITY_TEXT[value] ?? value ?? '—'
const severityTone = (value) => SEVERITY_TONE[value] ?? 'gray'
const statusText = (value) => STATUS_TEXT[value] ?? value ?? '—'
const statusTone = (value) => STATUS_TONE[value] ?? 'gray'
const progressPercent = (status) => ({ pending: 0, processing: 50, resolved: 100, closed: 100, ignored: 100 }[status] ?? 0)

/** 接口行 → 页面行：接口字段是 issueCode / handler / domainName */
const toRow = (row) => ({
  id: row.id,
  code: row.issueCode,
  description: row.description,
  domain: row.domainName || row.domain || '—',
  domainCode: row.domainCode,
  severity: row.severity || 'medium',
  status: row.status || 'pending',
  createTime: row.createTime,
  assignee: row.handler,
  logs: [],
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await getQualityList({
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      severity: filterSeverity.value === 'all' ? undefined : filterSeverity.value,
      status: filterStatus.value === 'all' ? undefined : filterStatus.value,
      domain: filterDomain.value === 'all' ? undefined : filterDomain.value,
    })
    if (response.code !== 200) throw new Error(response.message || '加载工单失败')
    issues.value = (response.data?.list ?? []).map(toRow)
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    issues.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '加载工单失败')
  } finally {
    loading.value = false
  }
}

/** 统计卡用全量统计，不是当前页计数 —— 否则"严重 2"只是这 10 行里的 2 条 */
const loadStats = async () => {
  try {
    const response = await getQualityStatistics()
    if (response.code !== 200 || !response.data) return
    const data = response.data
    const statusMap = {}
    ;(data.statusStatistics ?? []).forEach((item) => {
      statusMap[item.status] = item.issueCount ?? 0
    })
    severityStats.value = {
      high: data.highSeverityCount ?? 0,
      medium: data.mediumSeverityCount ?? 0,
      low: data.lowSeverityCount ?? 0,
      open: (statusMap.pending ?? 0) + (statusMap.processing ?? 0),
    }
  } catch {
    // 统计失败不影响列表
  }
}

function search() {
  currentPage.value = 1
  void loadData()
}

function reset() {
  filterStatus.value = 'all'
  filterSeverity.value = 'all'
  filterDomain.value = 'all'
  filterKeyword.value = ''
  search()
}

function changePage(next) {
  currentPage.value = next
  // 原来这里只改 currentPage、不发请求：翻页按钮点了没反应（谎报分页）
  void loadData()
}

function changePageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  void loadData()
}

const openAddModal = () => {
  Object.assign(form, { description: '', domain: 'user', severity: 'medium' })
  showAddModal.value = true
}

const closeAddModal = () => {
  showAddModal.value = false
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedIssue.value = null
}

const viewIssue = (issue) => {
  selectedIssue.value = { ...issue }
  showDetailModal.value = true
  // 处置历史单独取：列表不返回它（一页 10 行各带一串历史会把响应撑大）
  void (async () => {
    try {
      const response = await getQualityDetail(issue.id)
      if (response.code === 200 && selectedIssue.value?.id === issue.id) {
        const histories = response.data?.handleHistories ?? []
        selectedIssue.value = {
          ...selectedIssue.value,
          resolveRemark: response.data?.resolveRemark,
          logs: histories.map((h) => ({ time: h.time, action: h.action, operator: h.operator, remark: h.remark })),
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载处置历史失败')
    }
  })()
}

const processIssue = async (issue) => {
  if (['resolved', 'ignored'].includes(issue.status)) return
  busyId.value = issue.id
  try {
    const response = await handleQualityIssue(issue.id, { status: 'processing', remark: '开始处理' })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(`工单「${issue.code}」已开始处理`)
    await Promise.all([loadData(), loadStats()])
    if (showDetailModal.value && selectedIssue.value?.id === issue.id) {
      viewIssue({ ...issue, status: 'processing' })
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

const closeIssue = async (issue) => {
  if (!window.confirm(`确定关闭工单「${issue.code}」吗？关闭即标记为已解决。`)) return
  busyId.value = issue.id
  try {
    // 关闭 = 标记为已解决（状态口径：pending / processing / resolved / ignored）
    const response = await handleQualityIssue(issue.id, { status: 'resolved', remark: '工单关闭' })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success('工单已关闭')
    await Promise.all([loadData(), loadStats()])
    closeDetailModal()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

/** 页面上的数据域下拉值 → 后端用的域编码与名称 */
const DOMAIN_LABELS = {
  user: ['user', '用户主数据'],
  organization: ['org', '组织主数据'],
  product: ['product', '商品主数据'],
  customer: ['customer', '客户主数据'],
  supplier: ['supplier', '供应商主数据'],
}

const saveIssue = async () => {
  if (!form.description.trim()) {
    message.warning('请填写问题描述')
    return
  }
  saving.value = true
  const [domainCode, domainName] = DOMAIN_LABELS[form.domain] ?? ['user', '用户主数据']
  try {
    const response = await createQualityIssue({
      description: form.description.trim(),
      domainCode,
      domainName,
      severity: form.severity,
    })
    if (response.code !== 200) throw new Error(response.message || '创建失败')
    message.success('工单已登记')
    closeAddModal()
    currentPage.value = 1
    await Promise.all([loadData(), loadStats()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadData()
  void loadStats()
})
</script>

<style scoped>
.issue-table {
  min-width: 1080px;
}

.description-cell {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-section {
  margin-top: 16px;
}

.detail-section h4 {
  margin: 0 0 10px;
  font-size: 13.5px;
  font-weight: 600;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 12px;
  border-radius: 6px;
  background: #f8faf9;
  font-size: 12.5px;
}

.log-time {
  width: 140px;
  flex: none;
  color: var(--mds-text-3);
  font-family: var(--mds-mono);
}

.log-action {
  flex: 1;
}

.log-action em {
  color: var(--mds-text-3);
  font-style: normal;
}

.log-operator {
  flex: none;
  color: var(--mds-brand-deep);
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.mds-modal {
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}

.mds-modal--wide {
  width: 820px;
}
</style>
