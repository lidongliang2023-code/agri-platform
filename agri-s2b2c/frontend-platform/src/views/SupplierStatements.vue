<template>
  <div class="statement-page">
    <div class="page-head">
      <div>
        <h2>供应商对账单</h2>
        <p>按已完成订单的下单供货价快照生成；只做供应商对账确认，不含打款，付款仍归交易撮合/财务。</p>
      </div>
      <el-button @click="load">刷新</el-button>
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

    <div class="filter-bar">
      <el-select v-model="status" placeholder="状态" style="width: 160px" @change="load">
        <el-option label="全部" value="" />
        <el-option label="待确认" value="OPEN" />
        <el-option label="已确认" value="CONFIRMED" />
        <el-option label="有差异" value="DISPUTED" />
      </el-select>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="batchNo" label="批次号" width="210" show-overflow-tooltip />
      <el-table-column prop="supplierName" label="供应商" min-width="160">
        <template #default="{ row }">{{ row.shopName || row.supplierName || row.supplierId }}</template>
      </el-table-column>
      <el-table-column label="账期" width="210">
        <template #default="{ row }">{{ row.periodStart }} ~ {{ row.periodEnd }}</template>
      </el-table-column>
      <el-table-column prop="orderCount" label="订单数" width="90" />
      <el-table-column label="供货金额" width="130">
        <template #default="{ row }">¥{{ money(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="supplierRemark" label="供应商说明" min-width="160" show-overflow-tooltip />
      <el-table-column prop="createTime" label="生成时间" width="180" />
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">明细</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="暂无供应商对账单" />

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
import { platformApi } from '../api'

const rows = ref([])
const status = ref('')
const supplierId = ref('')
const periodStart = ref('')
const periodEnd = ref('')
const generating = ref(false)
const detailVisible = ref(false)
const detail = ref(null)

onMounted(load)

async function load() {
  try {
    rows.value = (await platformApi.getSupplierStatements({
      supplierId: supplierId.value.trim() || undefined,
      status: status.value || undefined,
    })) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '对账单读取失败')
  }
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
.filter-bar { display: flex; gap: 10px; }
</style>