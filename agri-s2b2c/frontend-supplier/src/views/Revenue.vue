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
      <div class="card">
        <h3>按商品</h3>
        <el-table :data="byProduct" border size="small">
          <el-table-column prop="name" label="商品" min-width="190" />
          <el-table-column prop="qty" label="数量" width="90" />
          <el-table-column label="供货收入（估）" width="140"><template #default="{ row }">¥{{ money(row.revenue) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!byProduct.length" description="该账期暂无成交" :image-size="60" />
      </div>
      <div class="card">
        <h3>按渠道</h3>
        <el-table :data="byChannel" border size="small">
          <el-table-column prop="channelName" label="渠道" min-width="150" />
          <el-table-column prop="orders" label="订单" width="80" />
          <el-table-column label="GMV" width="120"><template #default="{ row }">¥{{ money(row.gmv) }}</template></el-table-column>
        </el-table>
        <el-empty v-if="!byChannel.length" description="该账期暂无渠道成交" :image-size="60" />
      </div>
    </div>

    <div class="card">
      <div class="card-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <h3 style="margin:0">供货对账单</h3>
        <span class="note">平台按已完成订单的供货价快照生成，确认/差异仅作对账记录，不含打款。</span>
      </div>
      <el-table :data="statements" border size="small">
        <el-table-column label="账期" width="210">
          <template #default="{ row }">{{ row.periodStart }} ~ {{ row.periodEnd }}</template>
        </el-table-column>
        <el-table-column prop="batchNo" label="批次号" min-width="210" show-overflow-tooltip />
        <el-table-column prop="orderCount" label="订单数" width="90" />
        <el-table-column label="供货金额" width="120"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statementStatusType(row.status)">{{ statementStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="supplierRemark" label="差异说明" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openStatement(row)">明细</el-button>
            <el-button v-if="row.status === 'OPEN'" link type="success" @click="confirmStatement(row)">确认</el-button>
            <el-button v-if="row.status === 'OPEN'" link type="danger" @click="disputeStatement(row)">有差异</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!statements.length" description="暂无供货对账单" :image-size="60" />
    </div>

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
import { supplierApi } from '../api'

const now = new Date()
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const summary = ref({})
const byProduct = ref([])
const byChannel = ref([])
const statements = ref([])
const statementVisible = ref(false)
const statementDetail = ref(null)
const note = ref('')

onMounted(() => { load(); loadStatements() })

async function loadStatements() {
  try {
    statements.value = (await supplierApi.getStatements()) || []
  } catch {
    statements.value = []
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

const statementStatusText = (value) => ({
  OPEN: '待确认', CONFIRMED: '已确认', DISPUTED: '有差异',
}[value] || value)
const statementStatusType = (value) => ({
  OPEN: 'warning', CONFIRMED: 'success', DISPUTED: 'danger',
}[value] || 'info')

async function load() {
  try {
    const data = (await supplierApi.getRevenue(month.value)) || {}
    summary.value = data.summary || {}
    byProduct.value = data.byProduct || []
    byChannel.value = data.byChannel || []
    note.value = data.note || ''
  } catch (e) {
    ElMessage.error(e?.message || '供货收入读取失败')
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
.note { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
@media (max-width: 1000px) { .grid, .stat-row { grid-template-columns: 1fr 1fr; } }
</style>
