<template>
  <div class="mds-page">
    <PageHeader
      title="质量监控"
      subtitle="数据质量问题的实时清单：按严重级别与状态筛选，查看详情并登记处置结果。"
      source="数据治理 · 质量问题"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="reloadAll">刷新</button>
        <button class="mds-btn mds-btn--primary" @click="router.push('/quality/issue')">问题工单</button>
      </template>
    </PageHeader>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="keyword"
          class="mds-input"
          type="search"
          placeholder="当前页内搜索问题描述（后端无全文检索）"
          @keyup.enter="() => {}"
        />
        <select v-model="severity" class="mds-select" @change="search">
          <option value="">全部级别</option>
          <option value="high">严重</option>
          <option value="medium">警告</option>
          <option value="low">提示</option>
        </select>
        <select v-model="status" class="mds-select" @change="search">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="resolved">已解决</option>
          <option value="ignored">已忽略</option>
        </select>
        <span class="mds-hint">共 {{ total }} 条</span>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table monitor-table">
          <thead>
            <tr>
              <th>问题编码</th>
              <th>级别</th>
              <th>问题类型</th>
              <th>问题描述</th>
              <th>关联数据</th>
              <th>检测时间</th>
              <th>状态</th>
              <th>处理人</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="9" class="mds-empty">正在加载质量问题…</td>
            </tr>
            <tr v-else-if="!visibleRows.length">
              <td colspan="9">
                <EmptyState
                  :title="rows.length ? '当前页没有匹配的问题' : '暂无质量问题'"
                  :description="rows.length ? '关键词只过滤当前页；清空后翻页查看其他页。' : '检测任务产出问题后，这里会出现记录。'"
                />
              </td>
            </tr>
            <tr v-for="row in visibleRows" :key="row.id">
              <td class="mds-mono">{{ row.issueCode }}</td>
              <td><StatusTag :text="severityText(row.severity)" :tone="severityTone(row.severity)" /></td>
              <td>{{ row.issueType || '—' }}</td>
              <td class="desc-cell" :title="row.description">{{ row.description || '—' }}</td>
              <td class="mds-muted">{{ row.affectedData || '—' }}</td>
              <td class="mds-muted time-cell">{{ formatTime(row.createTime) }}</td>
              <td><StatusTag :text="statusText(row.status)" :tone="statusTone(row.status)" /></td>
              <td>{{ row.handler || '—' }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="openDetail(row)">详情</button>
                <button
                  class="mds-btn mds-btn--link"
                  :disabled="busyId === row.id || row.status === 'resolved' || row.status === 'ignored'"
                  @click="openHandle(row)"
                >处理</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="pageNum"
        :page-size="pageSize"
        :total="total"
        @change="changePage"
        @update:page-size="changePageSize"
      />
    </div>

    <!-- 详情 -->
    <div v-if="detail" class="mds-mask" @click="detail = null">
      <section class="mds-modal mds-modal--wide" @click.stop>
        <div class="mds-card-head">
          <div>
            <p class="mds-card-sub">问题详情 · {{ detail.issueCode }}</p>
            <h2 class="mds-card-title">{{ detail.description }}</h2>
          </div>
          <button class="mds-btn" @click="detail = null">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-kv-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
            <div class="mds-kv"><span class="mds-kv__k">级别</span><span class="mds-kv__v">{{ severityText(detail.severity) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">问题类型</span><span class="mds-kv__v">{{ detail.issueType || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">数据域</span><span class="mds-kv__v">{{ detail.domainName || detail.domain || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">关联数据</span><span class="mds-kv__v mds-mono">{{ detail.affectedData || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">状态</span><span class="mds-kv__v">{{ statusText(detail.status) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">处理人</span><span class="mds-kv__v">{{ detail.handler || '未分配' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">检测时间</span><span class="mds-kv__v">{{ formatTime(detail.createTime) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">最后更新</span><span class="mds-kv__v">{{ formatTime(detail.lastUpdateTime) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">所属主体</span><span class="mds-kv__v mds-mono">{{ detail.tenantName || detail.tenantId || '平台' }}</span></div>
          </div>

          <div class="history">
            <h4>处置历史</h4>
            <div v-if="!history.length" class="mds-empty">暂无处置记录</div>
            <div v-else class="history-list">
              <div v-for="(item, index) in history" :key="index" class="history-row">
                <span class="mds-mono">{{ formatTime(item.time) }}</span>
                <span>{{ item.action }}<em v-if="item.remark"> · {{ item.remark }}</em></span>
                <span class="mds-muted">{{ item.operator }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="mds-form-actions" v-if="detail.status !== 'resolved' && detail.status !== 'ignored'">
          <button v-point="'PUT /admin/masterdata/quality/issues/{id}/handle'" class="mds-btn mds-btn--primary" @click="openHandle(detail)">处理</button>
        </div>
      </section>
    </div>

    <!-- 处置 -->
    <div v-if="handleTarget" class="mds-mask" @click="closeHandle">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">处理问题 · {{ handleTarget.issueCode }}</h2>
            <p class="mds-card-sub">{{ handleTarget.description }}</p>
          </div>
          <button class="mds-btn mds-btn--link" @click="closeHandle">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">处理结果</span>
              <select v-model="handleForm.result" class="mds-select">
                <option value="">请选择处理结果</option>
                <option value="fixed">已修复</option>
                <option value="ignored">无需处理</option>
                <option value="pending">待确认</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">处理备注</span>
              <textarea v-model="handleForm.remark" class="mds-textarea" placeholder="说明修复方式或无需处理的原因" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeHandle">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitHandle">
              {{ saving ? '提交中…' : '确认处理' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import { getQualityDetail, getQualityList, getQualityStatistics, handleQualityIssue } from '../../utils/api'

interface IssueRow {
  id: number
  issueCode?: string
  issueType?: string
  severity?: string
  domain?: string
  domainName?: string
  description?: string
  affectedData?: string
  status?: string
  createTime?: string
  lastUpdateTime?: string
  handler?: string
  tenantId?: string
  tenantName?: string
}

const router = useRouter()
const rows = ref<IssueRow[]>([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref<number | null>(null)
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const severity = ref('')
const status = ref('')
const keyword = ref('')
const stats = ref<Record<string, number | null>>({})
const detail = ref<IssueRow | null>(null)
const history = ref<Array<{ time?: string; action?: string; operator?: string; remark?: string }>>([])
const handleTarget = ref<IssueRow | null>(null)
const handleForm = reactive({ result: '', remark: '' })

/** 关键词只过滤当前页：后端 /quality/issues 没有全文检索参数，不做假的全量搜索 */
const visibleRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((row) =>
    [row.description, row.issueCode, row.affectedData].some((field) =>
      String(field ?? '').toLowerCase().includes(kw),
    ),
  )
})

const statItems = computed(() => [
  { label: '问题总数', value: stats.value.totalIssues ?? '—' },
  { label: '警告问题', value: stats.value.mediumSeverityCount ?? '—', tone: 'warning' },
  {
    label: '严重问题',
    value: stats.value.highSeverityCount ?? '—',
    tone: Number(stats.value.highSeverityCount ?? 0) > 0 ? 'danger' : undefined,
  },
  {
    label: '解决率',
    value: stats.value.resolutionRate == null ? '—' : `${stats.value.resolutionRate}%`,
    tone: 'success',
  },
])

const SEVERITY_TEXT: Record<string, string> = { high: '严重', medium: '警告', low: '提示' }
const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'success' | 'gray'> = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
}
const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
}
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'gray'> = {
  pending: 'warning',
  processing: 'info',
  resolved: 'success',
  ignored: 'gray',
}
const severityText = (value?: string) => SEVERITY_TEXT[value ?? ''] ?? value ?? '—'
const severityTone = (value?: string) => SEVERITY_TONE[value ?? ''] ?? 'gray'
const statusText = (value?: string) => STATUS_TEXT[value ?? ''] ?? value ?? '—'
const statusTone = (value?: string) => STATUS_TONE[value ?? ''] ?? 'gray'
const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 19) : '—')

async function loadStats() {
  try {
    const response = await getQualityStatistics()
    stats.value = response.code === 200 && response.data ? (response.data as Record<string, number | null>) : {}
  } catch {
    stats.value = {}
  }
}

async function loadData() {
  loading.value = true
  try {
    const response = await getQualityList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      severity: severity.value || undefined,
      status: status.value || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '加载质量问题失败')
    rows.value = (response.data?.list ?? []) as IssueRow[]
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '加载质量问题失败')
  } finally {
    loading.value = false
  }
}

function reloadAll() {
  void loadData()
  void loadStats()
}

function search() {
  pageNum.value = 1
  void loadData()
}

function changePage(next: number) {
  pageNum.value = next
  void loadData()
}

function changePageSize(size: number) {
  pageSize.value = size
  pageNum.value = 1
  void loadData()
}

async function openDetail(row: IssueRow) {
  detail.value = row
  history.value = []
  try {
    const response = await getQualityDetail(row.id)
    if (response.code === 200 && detail.value?.id === row.id) {
      const data = response.data as {
        handleHistories?: Array<{ time?: string; action?: string; operator?: string; remark?: string }>
      }
      history.value = data?.handleHistories ?? []
    }
  } catch {
    history.value = []
  }
}

function openHandle(row: IssueRow) {
  handleTarget.value = row
  handleForm.result = ''
  handleForm.remark = ''
}

function closeHandle() {
  handleTarget.value = null
}

async function submitHandle() {
  if (!handleForm.result) {
    message.warning('请选择处理结果')
    return
  }
  // 弹窗里的结果值（fixed/ignored/pending）是页面叫法，后端状态口径是 resolved/ignored/processing
  const RESULT_TO_STATUS: Record<string, string> = {
    fixed: 'resolved',
    ignored: 'ignored',
    pending: 'processing',
  }
  const target = handleTarget.value
  if (!target) return
  saving.value = true
  busyId.value = target.id
  try {
    const response = await handleQualityIssue(target.id, {
      status: RESULT_TO_STATUS[handleForm.result] ?? handleForm.result,
      remark: handleForm.remark,
    })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success('处理成功')
    closeHandle()
    detail.value = null
    await Promise.all([loadData(), loadStats()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
    busyId.value = null
  }
}

onMounted(reloadAll)
</script>

<style scoped>
.monitor-table {
  min-width: 1120px;
}

.time-cell {
  white-space: nowrap;
}

.desc-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history {
  margin-top: 16px;
}

.history h4 {
  margin: 0 0 10px;
  font-size: 13.5px;
  font-weight: 600;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 12px;
  border-radius: 6px;
  background: #f8faf9;
  font-size: 12.5px;
}

.history-row em {
  color: var(--mds-text-3);
  font-style: normal;
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
