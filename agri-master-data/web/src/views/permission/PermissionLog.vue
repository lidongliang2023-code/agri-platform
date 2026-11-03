<template>
  <div class="mds-page">
    <PageHeader
      title="操作审计"
      subtitle="追踪运营端写操作的操作人、来源、请求、结果与失败原因；日志只追加，不可编辑或删除。"
      source="只追加审计流水"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="loadData">{{ loading ? '刷新中…' : '刷新日志' }}</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="审计口径：">
      记录运营端全部新增、修改、删除与状态变更，成功与失败都留痕；查询操作不写入，避免淹没真正的业务变更。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model.trim="searchForm.keyword"
          class="mds-input"
          type="search"
          placeholder="操作人 / 描述 / 目标 ID / 请求路径"
          @keyup.enter="handleSearch"
        />
        <select v-model="searchForm.operationType" class="mds-select" @change="handleSearch">
          <option value="">全部操作类型</option>
          <option value="create">新增</option>
          <option value="update">修改</option>
          <option value="delete">删除</option>
          <option value="other">其他</option>
        </select>
        <select v-model="searchForm.module" class="mds-select" style="min-width: 170px" @change="handleSearch">
          <option value="">全部模块</option>
          <option v-for="item in moduleOptions" :key="item" :value="item">{{ item }}</option>
        </select>
        <select v-model="searchForm.result" class="mds-select" @change="handleSearch">
          <option value="">全部结果</option>
          <option value="success">成功</option>
          <option value="fail">失败</option>
        </select>
        <label class="date-field">
          <span>起</span>
          <input v-model="searchForm.startTime" type="date" />
        </label>
        <label class="date-field">
          <span>止</span>
          <input v-model="searchForm.endTime" type="date" />
        </label>
        <button class="mds-btn mds-btn--primary" @click="handleSearch">查询</button>
        <button class="mds-btn" @click="resetSearch">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table audit-table">
          <thead>
            <tr>
              <th>操作时间</th>
              <th>操作人 / 来源</th>
              <th>操作</th>
              <th>模块</th>
              <th>目标</th>
              <th>请求</th>
              <th>结果</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="mds-empty">正在加载审计流水…</td>
            </tr>
            <tr v-else-if="!logs.length">
              <td colspan="8">
                <EmptyState title="暂无符合条件的操作日志" description="调整筛选条件或时间范围后重试；查询操作本身不写日志。" />
              </td>
            </tr>
            <tr v-for="log in logs" :key="log.id">
              <td class="time-cell">{{ formatDateTime(log.createTime) }}</td>
              <td>
                <div>{{ log.username || '未登录' }}</div>
                <small class="mds-mono mds-muted">{{ formatIp(log.ipAddress) }}</small>
              </td>
              <td>
                <StatusTag :text="operationText(log.operationType)" :tone="operationTone(log.operationType)" plain />
                <div class="desc-cell">{{ log.operationDesc || '未填写操作描述' }}</div>
              </td>
              <td>{{ log.module || '—' }}</td>
              <td class="mds-mono">{{ log.targetId || '—' }}</td>
              <td>
                <StatusTag :text="log.requestMethod || '—'" tone="gray" plain />
                <small class="uri-text">{{ log.requestUri || '—' }}</small>
              </td>
              <td>
                <StatusTag
                  :text="log.result === 'success' ? '成功' : '失败'"
                  :tone="log.result === 'success' ? 'success' : 'danger'"
                />
                <small class="mds-muted">{{ log.durationMs ?? '—' }} ms</small>
              </td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="selectedLog = log">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="pageNum"
        :page-size="pageSize"
        :total="total"
        @change="goPage"
        @update:page-size="handlePageSize"
      />
    </div>

    <div v-if="selectedLog" class="mds-mask" @click="selectedLog = null">
      <section class="mds-modal mds-modal--wide" @click.stop>
        <div class="mds-card-head">
          <div>
            <p class="mds-card-sub">审计详情 #{{ selectedLog.id }}</p>
            <h2 class="mds-card-title">{{ selectedLog.operationDesc || operationText(selectedLog.operationType) }}</h2>
          </div>
          <button class="mds-btn" @click="selectedLog = null">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="modal-status">
            <StatusTag
              :text="selectedLog.result === 'success' ? '操作成功' : '操作失败'"
              :tone="selectedLog.result === 'success' ? 'success' : 'danger'"
            />
            <span>{{ selectedLog.durationMs ?? '—' }} ms</span>
            <span>{{ formatDateTime(selectedLog.createTime) }}</span>
          </div>
          <div class="mds-kv-grid">
            <div class="mds-kv"><span class="mds-kv__k">操作人</span><span class="mds-kv__v">{{ selectedLog.username || '未登录' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">来源 IP</span><span class="mds-kv__v mds-mono">{{ formatIp(selectedLog.ipAddress) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">业务模块</span><span class="mds-kv__v">{{ selectedLog.module || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">操作类型</span><span class="mds-kv__v">{{ operationText(selectedLog.operationType) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">目标 ID</span><span class="mds-kv__v mds-mono">{{ selectedLog.targetId || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">所属主体</span><span class="mds-kv__v mds-mono">{{ selectedLog.tenantId || '平台公共' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">操作人 ID</span><span class="mds-kv__v mds-mono">{{ selectedLog.operatorId || '—' }}</span></div>
            <div class="mds-kv" style="grid-column: 1 / -1">
              <span class="mds-kv__k">请求</span>
              <span class="mds-kv__v mds-mono">{{ selectedLog.requestMethod || '—' }} {{ selectedLog.requestUri || '—' }}</span>
            </div>
          </div>
          <div class="payload-section">
            <label>请求参数摘要</label>
            <pre>{{ prettyParams(selectedLog.params) }}</pre>
          </div>
          <div v-if="selectedLog.errorMessage" class="error-section">
            <label>失败原因</label>
            <p>{{ selectedLog.errorMessage }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import {
  getOperationLogModules,
  getOperationLogSummary,
  getOperationLogs,
} from '../../utils/api'

const loading = ref(false)
const logs = ref([])
const moduleOptions = ref([])
const selectedLog = ref(null)
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const summary = reactive({ total: 0, success: 0, failed: 0, today: 0, moduleCount: 0 })
const searchForm = reactive({
  keyword: '',
  operationType: '',
  module: '',
  result: '',
  startTime: '',
  endTime: '',
})

const statItems = computed(() => [
  { label: '结果总数', value: summary.total ?? 0 },
  { label: '成功操作', value: summary.success ?? 0, tone: 'success' },
  { label: '失败操作', value: summary.failed ?? 0, tone: summary.failed ? 'danger' : undefined },
  { label: '今日操作', value: summary.today ?? 0, tone: 'brand' },
  { label: '涉及模块', value: summary.moduleCount ?? 0 },
])

const queryParams = () => ({
  keyword: searchForm.keyword || undefined,
  operationType: searchForm.operationType || undefined,
  module: searchForm.module || undefined,
  result: searchForm.result || undefined,
  startTime: searchForm.startTime || undefined,
  endTime: searchForm.endTime || undefined,
})

const loadData = async () => {
  loading.value = true
  try {
    const [listResponse, summaryResponse] = await Promise.all([
      getOperationLogs({ pageNum: pageNum.value, pageSize: pageSize.value, ...queryParams() }),
      getOperationLogSummary(queryParams()),
    ])
    if (listResponse.code !== 200) throw new Error(listResponse.message || '操作日志加载失败')
    if (summaryResponse.code !== 200) throw new Error(summaryResponse.message || '日志统计加载失败')
    logs.value = listResponse.data?.list ?? []
    total.value = Number(listResponse.data?.total ?? 0)
    Object.assign(summary, summaryResponse.data ?? {})
  } catch (error) {
    logs.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '操作日志加载失败')
  } finally {
    loading.value = false
  }
}

const loadModules = async () => {
  try {
    const response = await getOperationLogModules()
    if (response.code === 200) moduleOptions.value = response.data ?? []
  } catch {
    moduleOptions.value = []
  }
}

const handleSearch = () => {
  pageNum.value = 1
  void loadData()
}

const resetSearch = () => {
  Object.assign(searchForm, { keyword: '', operationType: '', module: '', result: '', startTime: '', endTime: '' })
  handleSearch()
}

function goPage(next) {
  pageNum.value = next
  void loadData()
}

const handlePageSize = (size) => {
  pageSize.value = size
  pageNum.value = 1
  void loadData()
}

const OPERATION_TEXT = { create: '新增', update: '修改', delete: '删除', other: '其他' }
const OPERATION_TONE = { create: 'success', update: 'warning', delete: 'danger', other: 'gray' }
const operationText = (type) => OPERATION_TEXT[type] ?? type ?? '其他'
const operationTone = (type) => OPERATION_TONE[type] ?? 'gray'
const formatDateTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 19) : '—')
const formatIp = (value) => (['0:0:0:0:0:0:0:1', '::1'].includes(value) ? `${value}（本机）` : value || '—')
const prettyParams = (value) => {
  if (!value) return '无请求参数摘要'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

onMounted(async () => {
  await Promise.all([loadData(), loadModules()])
})
</script>

<style scoped>
.date-field {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d7dbe0;
  border-radius: 6px;
  background: #fff;
  color: var(--mds-text-3);
  font-size: 12px;
}

.date-field input {
  border: 0;
  background: transparent;
  color: var(--mds-text);
  font-size: 12.5px;
  outline: none;
}

.audit-table {
  min-width: 1260px;
}

.time-cell {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.desc-cell {
  max-width: 240px;
  margin-top: 5px;
  line-height: 1.45;
  color: var(--mds-text-2);
}

.uri-text {
  display: block;
  max-width: 260px;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mds-mono);
  color: var(--mds-text-3);
}

.modal-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  border-radius: 8px;
  background: #f8fafc;
  color: var(--mds-text-2);
  font-size: 12px;
}

.payload-section,
.error-section {
  margin-top: 14px;
}

.payload-section label,
.error-section label {
  display: block;
  margin-bottom: 6px;
  color: var(--mds-text-3);
  font-size: var(--agri-font-size-micro);
}

.payload-section pre {
  max-height: 240px;
  overflow: auto;
  margin: 0;
  padding: 13px;
  border-radius: 8px;
  background: #0f172a;
  color: #dbeafe;
  font-family: var(--mds-mono);
  font-size: var(--agri-font-size-micro);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-section p {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--mds-danger-soft);
  color: var(--mds-danger);
  font-size: 12.5px;
  line-height: 1.65;
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.55);
  padding: 20px;
}

.mds-modal {
  width: 720px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.3);
}

.mds-modal--wide {
  width: 820px;
}
</style>
