<template>
  <div class="revenue-page">
    <div class="page-head">
      <div>
        <h2>供货收入与对账</h2>
        <p>按下单时的供货价快照估算供货收入，后续调价不影响历史订单；最终以交易撮合合同与财务结算为准，本页不含打款与发票。</p>
      </div>
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择账期" @change="load" />
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>分销订单</span><b>{{ summary.orders || 0 }}</b><small>非取消订单</small></div>
      <div class="stat-card"><span>渠道 GMV</span><b>¥{{ money(summary.gmv) }}</b><small>按订单实付</small></div>
      <div class="stat-card"><span>供货收入（估）</span><b>¥{{ money(summary.supplyRevenue) }}</b><small>下单时供货价 × 数量</small></div>
    </div>

    <div class="grid">
      <AgriElementListTable
        :columns="productColumns"
        :data="byProduct"
        :row-key="(row) => String(row.productId ?? row.name)"
        :loading="loading"
        client-pagination
        :page-size="10"
        column-settings-storage-key="agri-s2b2c-platform:supply-revenue-product"
        empty-text="该账期暂无成交"
        @refresh="load"
      >
        <template #toolbar-left><h3 class="inline-title">按商品</h3></template>
        <template #cell-revenue="{ row }">¥{{ money(row.revenue) }}</template>
      </AgriElementListTable>

      <AgriElementListTable
        :columns="channelColumns"
        :data="byChannel"
        :row-key="(row) => String(row.channelId ?? row.channelName)"
        :loading="loading"
        client-pagination
        :page-size="10"
        column-settings-storage-key="agri-s2b2c-platform:supply-revenue-channel"
        empty-text="该账期暂无渠道成交"
        @refresh="load"
      >
        <template #toolbar-left><h3 class="inline-title">按渠道</h3></template>
        <template #cell-gmv="{ row }">¥{{ money(row.gmv) }}</template>
      </AgriElementListTable>
    </div>

    <AgriElementListTable
      :columns="statementColumns"
      :data="statements"
      row-key="id"
      :loading="loadingStatements"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:supply-revenue-statements"
      empty-text="暂无供货对账单"
      @refresh="loadStatements"
    >
      <template #toolbar-left>
        <div class="section-title">
          <h3>供货对账单</h3>
          <span class="note">平台按已完成订单的供货价快照生成，确认/差异仅作对账记录，不含打款。</span>
        </div>
      </template>
      <template #cell-period="{ row }">{{ row.periodStart }} ~ {{ row.periodEnd }}</template>
      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="statementStatusType(row.status)">{{ statementStatusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="statementActions(row)" />
      </template>
    </AgriElementListTable>

    <div class="card">
      <h3>口径说明</h3>
      <p class="note">{{ note }}</p>
    </div>

    <el-dialog v-model="statementVisible" title="对账单明细" width="720px">
      <template v-if="statementDetail">
        <p class="note">
          批次 {{ statementDetail.batchNo }} · {{ statementDetail.periodStart }} ~ {{ statementDetail.periodEnd }} ·
          合计 ¥{{ money(statementDetail.amount) }}
        </p>
        <el-table :data="statementDetail.orders || []" border size="small">
          <el-table-column prop="orderNo" label="订单号" min-width="190" />
          <el-table-column label="供货金额" width="120">
            <template #default="{ row }">¥{{ money(row.supplyAmount) }}</template>
          </el-table-column>
          <el-table-column prop="completedAt" label="完成时间" min-width="180" />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueRowActions } from '@agri/shared/vue/element'
import { supplierApi } from '../api'

const now = new Date()
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const summary = ref({})
const byProduct = ref([])
const byChannel = ref([])
const statements = ref([])
const loading = ref(false)
const loadingStatements = ref(false)
const statementVisible = ref(false)
const statementDetail = ref(null)
const note = ref('')

const productColumns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 180 },
  { key: 'qty', prop: 'qty', label: '数量', width: 90 },
  { key: 'revenue', prop: 'revenue', label: '供货收入（估）', width: 140 },
]

const channelColumns = [
  { key: 'channelName', prop: 'channelName', label: '渠道', minWidth: 150 },
  { key: 'orders', prop: 'orders', label: '订单', width: 85 },
  { key: 'gmv', prop: 'gmv', label: 'GMV', width: 120 },
]

const statementColumns = [
  { key: 'period', label: '账期', width: 210 },
  { key: 'batchNo', prop: 'batchNo', label: '批次号', minWidth: 210 },
  { key: 'orderCount', prop: 'orderCount', label: '订单数', width: 90 },
  { key: 'amount', prop: 'amount', label: '供货金额', width: 120 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'supplierRemark', prop: 'supplierRemark', label: '差异说明', minWidth: 150 },
  { key: 'actions', label: '操作', width: 155 },
]

function statementActions(row) {
  const list = [{ key: 'detail', label: '明细', onClick: () => openStatement(row) }]
  if (row.status === 'OPEN') {
    list.push({ key: 'confirm', label: '确认', onClick: () => confirmStatement(row) })
    list.push({ key: 'dispute', label: '有差异', danger: true, onClick: () => disputeStatement(row) })
  }
  return list
}

onMounted(() => { load(); loadStatements() })

async function loadStatements() {
  loadingStatements.value = true
  try {
    statements.value = (await supplierApi.getStatements()) || []
  } catch {
    statements.value = []
  } finally {
    loadingStatements.value = false
  }
}

async function openStatement(row) {
  try {
    statementDetail.value = (await supplierApi.getStatement(row.id)) || null
    statementVisible.value = true
  } catch (e) {
    ElMessage.error(e?.message || '对账明细读取失败')
  }
}

async function confirmStatement(row) {
  try {
    const result = await ElMessageBox.prompt('可填写确认说明（选填）', '确认对账单', {
      inputPlaceholder: '选填', confirmButtonText: '确认', cancelButtonText: '取消',
    })
    const res = await supplierApi.confirmStatement(row.id, result.value || '')
    if (res?.success === false) return ElMessage.error(res.message || '确认失败')
    ElMessage.success(res?.message || '对账单已确认')
    await loadStatements()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '确认失败')
  }
}

async function disputeStatement(row) {
  try {
    const result = await ElMessageBox.prompt('请填写差异说明', '提交对账差异', {
      inputPattern: /\S+/, inputErrorMessage: '请填写差异说明',
      confirmButtonText: '提交', cancelButtonText: '取消',
    })
    const res = await supplierApi.disputeStatement(row.id, result.value)
    if (res?.success === false) return ElMessage.error(res.message || '提交失败')
    ElMessage.success(res?.message || '已提交差异')
    await loadStatements()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '提交失败')
  }
}

const statementStatusText = (value) => ({ OPEN: '待确认', CONFIRMED: '已确认', DISPUTED: '有差异' }[value] || value)
const statementStatusType = (value) => ({ OPEN: 'warning', CONFIRMED: 'success', DISPUTED: 'danger' }[value] || 'info')

async function load() {
  loading.value = true
  try {
    const data = (await supplierApi.getRevenue(month.value)) || {}
    summary.value = data.summary || {}
    byProduct.value = data.byProduct || []
    byChannel.value = data.byChannel || []
    note.value = data.note || ''
  } catch (e) {
    ElMessage.error(e?.message || '供货收入读取失败')
  } finally {
    loading.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.revenue-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 820px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.inline-title { margin: 0; font-size: 15px; color: #173e2a; }
.section-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.section-title h3 { margin: 0; font-size: 15px; color: #173e2a; }
.note { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
@media (max-width: 1000px) { .grid, .stat-row { grid-template-columns: 1fr; } }
</style>
