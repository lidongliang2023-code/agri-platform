<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>PLEDGE OPERATIONS</small><h1>质押与仓单</h1><p>核验仓单来源（批次、库存、链上存证），审核质押并在结清或换货时释放仓单。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button></div>
    </header>
    <div class="finance-kpis">
      <article class="finance-kpi"><span>仓单</span><strong>{{ receipts.length }}<em> 张</em></strong><small>{{ receiptActive.length }} 张在押</small></article>
      <article class="finance-kpi"><span>在押货值</span><strong>{{ compactMoney(receiptPledgedValue) }}</strong><small>已质押仓单合计</small></article>
      <article class="finance-kpi"><span>质押记录</span><strong>{{ pledges.length }}<em> 笔</em></strong><small>{{ active.length }} 笔已生效</small></article>
      <article class="finance-kpi"><span>待审核</span><strong>{{ pending.length }}<em> 笔</em></strong><small>需完成仓单核验</small></article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head"><strong>仓单台账</strong><div class="finance-tabs"><button v-for="item in receiptFilters" :key="item.key" type="button" :class="{ on: receiptFilter === item.key }" @click="receiptFilter = item.key">{{ item.label }}</button></div></div>
      <el-table :data="filteredReceipts" style="width: 100%">
        <el-table-column prop="receiptNo" label="仓单号" min-width="150" />
        <el-table-column label="融资主体" min-width="130"><template #default="{ row }">{{ subjectName(row.userId) }}</template></el-table-column>
        <el-table-column label="来源批次" min-width="150"><template #default="{ row }">{{ row.batchNo || '—' }}<em v-if="row.traceCode" class="trace"> / {{ row.traceCode }}</em></template></el-table-column>
        <el-table-column prop="commodityType" label="品种" min-width="90" />
        <el-table-column label="数量" min-width="100"><template #default="{ row }">{{ num(row.quantity) }} {{ row.unit || '' }}</template></el-table-column>
        <el-table-column label="货值" min-width="100" align="right"><template #default="{ row }">{{ compactMoney(row.totalValue) }}</template></el-table-column>
        <el-table-column label="链上存证" min-width="120"><template #default="{ row }"><span v-if="row.blockchainHash" class="proof">{{ shortHash(row.blockchainHash) }}</span><span v-else class="cell-missing">未存证</span></template></el-table-column>
        <el-table-column prop="warehouseName" label="仓库" min-width="120" />
        <el-table-column label="状态" width="85"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="120" align="right"><template #default="{ row }"><el-button link class="finance-link-button" @click="openMonitor(row)">仓储读数</el-button></template></el-table-column>
      </el-table>
      <div v-if="!filteredReceipts.length" class="finance-empty"><strong>暂无仓单</strong><p>融资方从已入库的采收批次开出的仓单会进入这张台账；仓单与批次、库存、存证一一可核。</p></div>
    </section>

    <section class="finance-card">
      <div class="finance-card-head"><strong>仓单质押列表</strong><div class="finance-tabs"><button v-for="item in filters" :key="item.key" type="button" :class="{ on: filter === item.key }" @click="filter = item.key">{{ item.label }}</button></div></div>
      <el-table :data="filtered" style="width: 100%">
        <el-table-column prop="pledgeNo" label="质押编号" min-width="130" />
        <el-table-column label="来源仓单" min-width="150"><template #default="{ row }"><span v-if="row.receiptNo">{{ row.receiptNo }}<em v-if="row.batchNo" class="trace"> / {{ row.batchNo }}</em></span><span v-else class="cell-missing">历史数据，未关联仓单</span></template></el-table-column>
        <el-table-column prop="commodityType" label="质押物" min-width="100" />
        <el-table-column label="数量" min-width="90"><template #default="{ row }">{{ num(row.quantity) }}</template></el-table-column>
        <el-table-column label="质押价值" min-width="105" align="right"><template #default="{ row }">{{ compactMoney(row.totalValue) }}</template></el-table-column>
        <el-table-column label="质押率" width="75" align="right"><template #default="{ row }">{{ row.pledgeRate }}%</template></el-table-column>
        <el-table-column label="融资金额" min-width="105" align="right"><template #default="{ row }">{{ compactMoney(row.loanAmount) }}</template></el-table-column>
        <el-table-column label="担保的融资" min-width="120"><template #default="{ row }">{{ row.loanId ? `借款 ${row.loanId}` : row.applicationId ? `申请 ${row.applicationId}` : '未绑定' }}</template></el-table-column>
        <el-table-column prop="warehouseName" label="仓库" min-width="120" />
        <el-table-column label="状态" width="85"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="150" align="right"><template #default="{ row }"><el-button v-if="row.status === '待审核'" link class="finance-link-button" @click="approve(row)">审核通过</el-button><el-button v-if="row.status === '已生效'" link class="finance-link-button" @click="release(row)">释放质押</el-button></template></el-table-column>
      </el-table>
      <div v-if="!filtered.length" class="finance-empty"><strong>暂无匹配质押记录</strong><p>新的仓单质押申请会进入运营审核列表。</p></div>
    </section>

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
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, num, shortDate } from '@/api/finance'

const loading = ref(true)
const pledges = ref([])
const receipts = ref([])
const subjects = ref([])
const filter = ref('all')
const receiptFilter = ref('all')
const monitorOpen = ref(false)
const monitorLoading = ref(false)
const monitor = ref({})
const monitorTarget = ref(null)
const filters = [{ key: 'all', label: '全部' }, { key: 'pending', label: '待审核' }, { key: 'active', label: '已生效' }, { key: 'released', label: '已释放' }]
const receiptFilters = [{ key: 'all', label: '全部' }, { key: '待质押', label: '待质押' }, { key: '已质押', label: '已质押' }, { key: '已释放', label: '已释放' }]
const active = computed(() => pledges.value.filter((item) => item.status === '已生效'))
const pending = computed(() => pledges.value.filter((item) => item.status === '待审核'))
const filtered = computed(() => {
  if (filter.value === 'pending') return pending.value
  if (filter.value === 'active') return active.value
  if (filter.value === 'released') return pledges.value.filter((item) => item.status === '已释放')
  return pledges.value
})
const receiptActive = computed(() => receipts.value.filter((item) => item.status === '已质押'))
const receiptPledgedValue = computed(() => receiptActive.value.reduce((total, item) => total + Number(item.totalValue || 0), 0))
const filteredReceipts = computed(() => (receiptFilter.value === 'all'
  ? receipts.value : receipts.value.filter((item) => item.status === receiptFilter.value)))

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
