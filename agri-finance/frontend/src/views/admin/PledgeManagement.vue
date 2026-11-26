<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>PLEDGE OPERATIONS</small><h1>质押与仓单</h1><p>核验仓单来源（批次、库存、链上存证），审核质押并在结清或换货时释放仓单。</p></div>
      <div class="finance-page-heading-actions" />
    </header>
    <div class="finance-kpis">
      <article class="finance-kpi"><span>仓单</span><strong>{{ receipts.length }}<em> 张</em></strong><small>{{ receiptActive.length }} 张在押</small></article>
      <article class="finance-kpi"><span>在押货值</span><strong>{{ compactMoney(receiptPledgedValue) }}</strong><small>已质押仓单合计</small></article>
      <article class="finance-kpi"><span>质押记录</span><strong>{{ pledges.length }}<em> 笔</em></strong><small>{{ active.length }} 笔已生效</small></article>
      <article class="finance-kpi"><span>待审核</span><strong>{{ pending.length }}<em> 笔</em></strong><small>需完成仓单核验</small></article>
    </div>

    <AgriElementListTable
      :columns="receiptColumns"
      :data="filteredReceipts"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-finance:admin-receipts"
      empty-text="暂无仓单，融资方从已入库采收批次开出的仓单会进入这张台账"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyReceiptFilter" @reset="resetReceiptFilter">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <el-input v-model="receiptDraft.keyword" clearable placeholder="仓单号 / 批次号 / 品种 / 仓库" @keyup.enter="applyReceiptFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>仓单状态</label>
            <el-select v-model="receiptDraft.status" placeholder="全部状态">
              <el-option v-for="item in receiptFilters" :key="item.key" :label="item.label" :value="item.key" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>
      <template #toolbar-left>
        <strong class="finance-table-title">仓单台账</strong>
        <div class="finance-tabs">
          <button v-for="item in receiptFilters" :key="item.key" type="button" :class="{ on: receiptFilter === item.key }" @click="selectReceiptTab(item.key)">{{ item.label }}</button>
        </div>
      </template>
      <template #cell-userId="{ row }">{{ subjectName(row.userId) }}</template>
      <template #cell-batchNo="{ row }">{{ row.batchNo || '—' }}<em v-if="row.traceCode" class="trace"> / {{ row.traceCode }}</em></template>
      <template #cell-quantity="{ row }">{{ num(row.quantity) }} {{ row.unit || '' }}</template>
      <template #cell-totalValue="{ row }">{{ compactMoney(row.totalValue) }}</template>
      <template #cell-blockchainHash="{ row }"><span v-if="row.blockchainHash" class="proof">{{ shortHash(row.blockchainHash) }}</span><span v-else class="cell-missing">未存证</span></template>
      <template #cell-status="{ row }"><FinanceStatus :value="row.status" /></template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'monitor', label: '仓储读数', onClick: () => openMonitor(row) }]" />
      </template>
    </AgriElementListTable>

    <AgriElementListTable
      :columns="pledgeColumns"
      :data="filtered"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-finance:admin-pledges"
      empty-text="暂无匹配质押记录，新的仓单质押申请会进入运营审核列表"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyPledgeFilter" @reset="resetPledgeFilter">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <el-input v-model="pledgeDraft.keyword" clearable placeholder="质押编号 / 仓单号 / 质押物 / 仓库" @keyup.enter="applyPledgeFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>质押状态</label>
            <el-select v-model="pledgeDraft.status" placeholder="全部状态">
              <el-option v-for="item in filters" :key="item.key" :label="item.label" :value="item.key" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>
      <template #toolbar-left>
        <strong class="finance-table-title">仓单质押列表</strong>
        <div class="finance-tabs">
          <button v-for="item in filters" :key="item.key" type="button" :class="{ on: filter === item.key }" @click="selectPledgeTab(item.key)">{{ item.label }}</button>
        </div>
      </template>
      <template #cell-receiptNo="{ row }"><span v-if="row.receiptNo">{{ row.receiptNo }}<em v-if="row.batchNo" class="trace"> / {{ row.batchNo }}</em></span><span v-else class="cell-missing">历史数据，未关联仓单</span></template>
      <template #cell-quantity="{ row }">{{ num(row.quantity) }}</template>
      <template #cell-totalValue="{ row }">{{ compactMoney(row.totalValue) }}</template>
      <template #cell-pledgeRate="{ row }">{{ row.pledgeRate }}%</template>
      <template #cell-loanAmount="{ row }">{{ compactMoney(row.loanAmount) }}</template>
      <template #cell-loanRef="{ row }">{{ row.loanId ? `借款 ${row.loanId}` : row.applicationId ? `申请 ${row.applicationId}` : '未绑定' }}</template>
      <template #cell-status="{ row }"><FinanceStatus :value="row.status" /></template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="pledgeRowActions(row)" />
      </template>
    </AgriElementListTable>

    <el-drawer v-model="monitorOpen" :title="monitorTarget ? `仓储读数 · ${monitorTarget.receiptNo}` : '仓储读数'" size="min(460px, 92vw)">
      <div v-loading="monitorLoading" class="monitor-body">
        <el-button class="finance-ghost-button" size="small" :loading="monitorLoading" @click="refresh">从生产管理模块取最新读数</el-button>
        <div v-if="monitor.id" class="monitor-grid">
          <div><span>温度</span><strong>{{ reading(monitor.temperature, ' ℃') }}</strong></div>
          <div><span>湿度</span><strong>{{ reading(monitor.humidity, ' %') }}</strong></div>
          <div><span>实时重量</span><strong>{{ reading(monitor.realtimeWeight) }}</strong></div>
          <div><span>气体浓度</span><strong>{{ reading(monitor.gasConcentration) }}</strong></div>
          <div><span>设备状态</span><strong>{{ monitor.deviceStatus || '—' }}</strong></div>
          <div><span>告警</span><strong :class="{ red: monitor.alertLevel && monitor.alertLevel !== '无' }">{{ monitor.alertLevel || '—' }}</strong></div>
          <div class="wide"><span>读数来源</span><strong>{{ monitor.deviceCode || '—' }}</strong></div>
          <div class="wide"><span>口径说明</span><strong class="note">{{ monitor.deviceNote || '—' }}</strong></div>
          <div class="wide"><span>读数时间</span><strong>{{ shortDate(monitor.monitorTime) }}</strong></div>
          <div class="wide"><span>告警内容</span><strong>{{ monitor.alertContent || '—' }}</strong></div>
        </div>
        <div v-else class="finance-empty"><strong>暂无监控读数</strong><p>重量与气体浓度本部署没有采集通道，读到空值显示「—」而不是 0。</p></div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, num, shortDate } from '@/api/finance'

const receiptColumns = [
  { key: 'receiptNo', prop: 'receiptNo', label: '仓单号', kind: 'code', minWidth: 150, locked: true },
  { key: 'userId', prop: 'userId', label: '融资主体', minWidth: 130 },
  { key: 'batchNo', prop: 'batchNo', label: '来源批次', minWidth: 155 },
  { key: 'commodityType', prop: 'commodityType', label: '品种', minWidth: 96 },
  { key: 'quantity', prop: 'quantity', label: '数量', kind: 'number', minWidth: 105 },
  { key: 'totalValue', prop: 'totalValue', label: '货值', kind: 'number', minWidth: 105 },
  { key: 'blockchainHash', prop: 'blockchainHash', label: '链上存证', minWidth: 130 },
  { key: 'warehouseName', prop: 'warehouseName', label: '仓库', minWidth: 120 },
  { key: 'status', prop: 'status', label: '状态', kind: 'status', width: 92 },
  { key: 'actions', label: '操作', kind: 'action', width: 105 },
]

const pledgeColumns = [
  { key: 'pledgeNo', prop: 'pledgeNo', label: '质押编号', kind: 'code', minWidth: 135, locked: true },
  { key: 'receiptNo', prop: 'receiptNo', label: '来源仓单', minWidth: 155 },
  { key: 'commodityType', prop: 'commodityType', label: '质押物', minWidth: 105 },
  { key: 'quantity', prop: 'quantity', label: '数量', kind: 'number', minWidth: 96 },
  { key: 'totalValue', prop: 'totalValue', label: '质押价值', kind: 'number', minWidth: 110 },
  { key: 'pledgeRate', prop: 'pledgeRate', label: '质押率', kind: 'number', width: 85 },
  { key: 'loanAmount', prop: 'loanAmount', label: '融资金额', kind: 'number', minWidth: 110 },
  { key: 'loanRef', label: '担保的融资', minWidth: 120 },
  { key: 'warehouseName', prop: 'warehouseName', label: '仓库', minWidth: 120 },
  { key: 'status', prop: 'status', label: '状态', kind: 'status', width: 92 },
  { key: 'actions', label: '操作', kind: 'action', width: 120 },
]

const loading = ref(true)
const pledges = ref([])
const receipts = ref([])
const subjects = ref([])
const filter = ref('all')
const receiptFilter = ref('all')
const receiptDraft = reactive({ keyword: '', status: 'all' })
const receiptQuery = reactive({ keyword: '' })
const pledgeDraft = reactive({ keyword: '', status: 'all' })
const pledgeQuery = reactive({ keyword: '' })
const monitorOpen = ref(false)
const monitorLoading = ref(false)
const monitor = ref({})
const monitorTarget = ref(null)
const filters = [{ key: 'all', label: '全部' }, { key: 'pending', label: '待审核' }, { key: 'active', label: '已生效' }, { key: 'released', label: '已释放' }]
const receiptFilters = [{ key: 'all', label: '全部' }, { key: '待质押', label: '待质押' }, { key: '已质押', label: '已质押' }, { key: '已释放', label: '已释放' }]

function applyReceiptFilter() {
  receiptQuery.keyword = receiptDraft.keyword
  receiptFilter.value = receiptDraft.status || 'all'
}

function resetReceiptFilter() {
  receiptDraft.keyword = ''
  receiptDraft.status = 'all'
  applyReceiptFilter()
}

function selectReceiptTab(key) {
  receiptFilter.value = key
  receiptDraft.status = key
}

function applyPledgeFilter() {
  pledgeQuery.keyword = pledgeDraft.keyword
  filter.value = pledgeDraft.status || 'all'
}

function resetPledgeFilter() {
  pledgeDraft.keyword = ''
  pledgeDraft.status = 'all'
  applyPledgeFilter()
}

function selectPledgeTab(key) {
  filter.value = key
  pledgeDraft.status = key
}

const active = computed(() => pledges.value.filter((item) => item.status === '已生效'))
const pending = computed(() => pledges.value.filter((item) => item.status === '待审核'))
const filtered = computed(() => {
  let rows = pledges.value
  if (filter.value === 'pending') rows = pending.value
  else if (filter.value === 'active') rows = active.value
  else if (filter.value === 'released') rows = pledges.value.filter((item) => item.status === '已释放')
  const kw = pledgeQuery.keyword.trim().toLowerCase()
  if (kw) rows = rows.filter((item) => `${item.pledgeNo || ''}${item.receiptNo || ''}${item.commodityType || ''}${item.warehouseName || ''}`.toLowerCase().includes(kw))
  return rows
})
const receiptActive = computed(() => receipts.value.filter((item) => item.status === '已质押'))
const receiptPledgedValue = computed(() => receiptActive.value.reduce((total, item) => total + Number(item.totalValue || 0), 0))
const filteredReceipts = computed(() => {
  const base = receiptFilter.value === 'all' ? receipts.value : receipts.value.filter((item) => item.status === receiptFilter.value)
  const kw = receiptQuery.keyword.trim().toLowerCase()
  if (!kw) return base
  return base.filter((item) => `${item.receiptNo || ''}${item.batchNo || ''}${item.commodityType || ''}${item.warehouseName || ''}${subjectName(item.userId)}`.toLowerCase().includes(kw))
})

function pledgeRowActions(row) {
  const list = []
  if (row.status === '待审核') list.push({ key: 'approve', label: '审核通过', onClick: () => approve(row) })
  if (row.status === '已生效') list.push({ key: 'release', label: '释放质押', danger: true, onClick: () => release(row) })
  return list
}

function subjectName(userId) {
  const hit = subjects.value.find((item) => item.subjectId === userId)
  return hit ? `${hit.subjectName}` : userId || '—'
}

function shortHash(value) {
  const text = String(value || '')
  return text.length > 18 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text
}

function reading(value, suffix = '') {
  return value == null || value === '' ? '—' : `${num(value)}${suffix}`
}

async function approve(row) {
  await ElMessageBox.confirm(`确认仓单 ${row.receiptNo || row.pledgeNo} 的质押审核通过？生效后货主要还完借款才会自动释放。`, '仓单质押审核', { confirmButtonText: '审核通过', cancelButtonText: '取消', type: 'info' })
  try { await operationsApi.approvePledge(row.id); ElMessage.success('仓单质押已生效'); await load() } catch (err) { ElMessage.error(err.message || '审核失败') }
}

async function release(row) {
  await ElMessageBox.confirm(`确认释放仓单 ${row.receiptNo || row.pledgeNo} 的质押物？对应仓单会一起置为已释放。`, '释放质押', { confirmButtonText: '确认释放', cancelButtonText: '取消', type: 'warning' })
  try { await operationsApi.releasePledge(row.id); ElMessage.success('质押与仓单已释放'); await load() } catch (err) { ElMessage.error(err.message || '释放失败') }
}

function openMonitor(row) {
  monitorTarget.value = row
  monitor.value = {}
  monitorOpen.value = true
  loadMonitor(row)
}

async function loadMonitor(row) {
  monitorLoading.value = true
  try {
    const detail = await operationsApi.receiptDetail(row.id)
    monitor.value = detail?.monitor || {}
  } catch (err) { ElMessage.error(err.message || '仓储读数加载失败') } finally { monitorLoading.value = false }
}

async function refresh() {
  monitorLoading.value = true
  try {
    monitor.value = await operationsApi.refreshReceiptMonitor(monitorTarget.value.id)
    ElMessage.success('已拉取最新读数')
  } catch (err) { ElMessage.error(err.message || '读数拉取失败') } finally { monitorLoading.value = false }
}

async function load() {
  loading.value = true
  try {
    const [rows, pledgeRows, subjectRows] = await Promise.all([
      operationsApi.receipts(),
      operationsApi.pledges(),
      operationsApi.subjects().catch(() => []),
    ])
    receipts.value = rows || []
    pledges.value = pledgeRows || []
    subjects.value = subjectRows || []
  } catch (err) { ElMessage.error(err.message || '质押与仓单加载失败') } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: var(--fin-fs-xs); font-style: normal; }
.trace { margin-left: 4px; color: #9aa8a0; font-size: var(--fin-fs-xs); font-style: normal; }
.cell-missing { color: #c2653f; font-size: var(--fin-fs-xs); }
.proof { font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); color: #16764a; }
.monitor-body { padding: 0 4px; }
.monitor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 12px; border-radius: 10px; overflow: hidden; background: #edf2ee; }
.monitor-grid > div { padding: 10px 11px; background: #f8fbf9; }
.monitor-grid .wide { grid-column: 1 / -1; }
.monitor-grid span { display: block; color: #8b9a91; font-size: var(--fin-fs-xs); }
.monitor-grid strong { display: block; margin-top: 4px; color: #395544; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.monitor-grid .red { color: #c2653f; }
.monitor-grid .note { font-size: var(--fin-fs-xs); line-height: 1.6; color: #8b9a91; font-family: inherit; }
</style>
