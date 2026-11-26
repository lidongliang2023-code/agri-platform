<template>
  <div class="statement-page">
    <div class="page-head">
      <div>
        <h2>供应商对账单</h2>
        <p>按已完成订单的下单供货价快照生成；只做供应商对账确认，不含打款，付款仍归交易撮合/财务。</p>
      </div>
    </div>

    <div class="card">
      <h3>生成对账单</h3>
      <div class="form-row">
        <el-input v-model="supplierId" placeholder="供应商 ID" style="width: 200px" />
        <el-date-picker v-model="periodStart" type="date" value-format="YYYY-MM-DD" placeholder="账期开始" style="width: 160px" />
        <el-date-picker v-model="periodEnd" type="date" value-format="YYYY-MM-DD" placeholder="账期结束" style="width: 160px" />
        <el-button type="primary" :loading="generating" @click="generate">生成对账单</el-button>
      </div>
      <p class="note">同一供应商同账期只生成一次；没有已完成订单时会提示无可对账订单。</p>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:supplier-statements"
      empty-text="暂无供应商对账单"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="load" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>供应商 ID</label>
            <el-input v-model="supplierId" placeholder="按供应商 ID 筛选" clearable @keyup.enter="load" />
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <el-select v-model="status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待确认" value="OPEN" />
              <el-option label="已确认" value="CONFIRMED" />
              <el-option label="有差异" value="DISPUTED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-supplier="{ row }">{{ row.shopName || row.supplierName || row.supplierId }}</template>
      <template #cell-period="{ row }">{{ row.periodStart }} ~ {{ row.periodEnd }}</template>
      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'detail', label: '明细', onClick: () => openDetail(row) }]" />
      </template>
    </AgriElementListTable>

    <el-dialog v-model="detailVisible" title="对账单明细" width="760px">
      <template v-if="detail">
        <p class="note">
          批次 {{ detail.batchNo }} · 供应商 {{ detail.shopName || detail.supplierName }} ·
          {{ detail.periodStart }} ~ {{ detail.periodEnd }} · 合计 ¥{{ money(detail.amount) }}
        </p>
        <el-table :data="detail.orders || []" border size="small">
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
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const rows = ref([])
const loading = ref(false)
const status = ref('')
const supplierId = ref('')
const periodStart = ref('')
const periodEnd = ref('')
const generating = ref(false)
const detailVisible = ref(false)
const detail = ref(null)

const columns = [
  { key: 'batchNo', prop: 'batchNo', label: '批次号', width: 210 },
  { key: 'supplier', prop: 'supplierName', label: '供应商', minWidth: 160 },
  { key: 'period', label: '账期', width: 210 },
  { key: 'orderCount', prop: 'orderCount', label: '订单数', width: 90 },
  { key: 'amount', prop: 'amount', label: '供货金额', width: 130 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'supplierRemark', prop: 'supplierRemark', label: '供应商说明', minWidth: 160 },
  { key: 'createTime', prop: 'createTime', label: '生成时间', width: 180 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    rows.value = (await platformApi.getSupplierStatements({
      supplierId: supplierId.value.trim() || undefined,
      status: status.value || undefined,
    })) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '对账单读取失败')
  } finally {
    loading.value = false
  }
}

function reset() {
  supplierId.value = ''
  status.value = ''
  load()
}

async function generate() {
  if (!supplierId.value.trim() || !periodStart.value || !periodEnd.value) {
    ElMessage.warning('请填写供应商 ID 与账期')
    return
  }
  generating.value = true
  try {
    const res = await platformApi.generateSupplierStatement({
      supplierId: supplierId.value.trim(),
      periodStart: periodStart.value,
      periodEnd: periodEnd.value,
    })
    if (res?.success === false) {
      ElMessage.warning(res.message || '生成失败')
      return
    }
    ElMessage.success(res?.message || '对账单已生成')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

async function openDetail(row) {
  try {
    detail.value = (await platformApi.getSupplierStatement(row.id)) || null
    detailVisible.value = true
  } catch (e) {
    ElMessage.error(e?.message || '对账明细读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({ OPEN: '待确认', CONFIRMED: '已确认', DISPUTED: '有差异' }[value] || value)
const statusType = (value) => ({ OPEN: 'warning', CONFIRMED: 'success', DISPUTED: 'danger' }[value] || 'info')
</script>

<style scoped>
.statement-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.form-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.note { margin: 8px 0 0; color: #84938a; font-size: 12px; }
</style>
