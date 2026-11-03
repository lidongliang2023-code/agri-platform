<template>
  <div class="after-sales-page">
    <div class="page-head">
      <div>
        <h2>异常与售后</h2>
        <p>平台视角的售后工单：渠道主责处理，平台在此复核/兜底；退款资金动作与支付通道不在本模块。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="status" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="PENDING">待处理</el-radio-button>
        <el-radio-button value="APPROVED">已同意</el-radio-button>
        <el-radio-button value="RETURNING">退货中</el-radio-button>
        <el-radio-button value="COMPLETED">已完成</el-radio-button>
        <el-radio-button value="REJECTED">已拒绝</el-radio-button>
      </el-radio-group>
      <span class="muted">待处理 {{ pendingCount }} 单</span>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="id" label="售后单" width="190" show-overflow-tooltip />
      <el-table-column prop="orderNo" label="订单号" min-width="180" />
      <el-table-column prop="channelName" label="渠道" width="150" />
      <el-table-column prop="items" label="商品" min-width="180" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="90" />
      <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ money(row.amount) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="申请时间" width="180" />
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'PENDING'">
            <el-button link type="success" @click="review(row, 'APPROVED')">同意</el-button>
            <el-button link type="danger" @click="review(row, 'REJECTED')">拒绝</el-button>
          </template>
          <template v-else-if="row.status === 'RETURNING'">
            <el-button v-if="row.returnShippedAt" link type="success" @click="confirmReturn(row)">确认收到退货</el-button>
            <span v-else class="muted">等待买家寄回</span>
          </template>
          <el-button link type="primary" @click="$router.push('/orders')">订单</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="当前筛选下没有售后工单" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { platformApi } from '../api'

const status = ref('')
const rows = ref([])
const pendingCount = ref(0)

onMounted(load)

async function load() {
  try {
    rows.value = (await platformApi.getAfterSales({ status: status.value || undefined })) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '售后工单读取失败')
  }
  if (status.value !== 'PENDING') {
    try {
      pendingCount.value = ((await platformApi.getAfterSales({ status: 'PENDING' })) || []).length
    } catch {
      pendingCount.value = 0
    }
  } else {
    pendingCount.value = rows.value.length
  }
}

async function review(row, next) {
  let opinion = ''
  try {
    const result = await ElMessageBox.prompt(
      next === 'APPROVED' ? '可填写复核意见（选填）' : '请填写拒绝依据',
      next === 'APPROVED' ? '同意售后' : '拒绝售后',
      { inputPlaceholder: next === 'APPROVED' ? '选填' : '必填', confirmButtonText: '确认', cancelButtonText: '取消' },
    )
    opinion = result.value || ''
  } catch {
    return
  }
  try {
    const res = await platformApi.reviewAfterSale(row.id, next, opinion)
    if (res?.success === false) {
      ElMessage.error(res.message || '处理失败')
      return
    }
    ElMessage.success(res?.message || '处理成功')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '处理失败')
  }
}

async function confirmReturn(row) {
  try {
    const result = await ElMessageBox.prompt('可填写收货说明（选填）', '确认收到退货', {
      inputPlaceholder: '选填', confirmButtonText: '确认收货', cancelButtonText: '取消',
    })
    const res = await platformApi.confirmAfterSaleReturn(row.id, result.value || '')
    if (res?.success === false) {
      ElMessage.error(res.message || '确认失败')
      return
    }
    ElMessage.success(res?.message || '已确认收货并退款')
    await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '确认失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  PENDING: '待处理', APPROVED: '已同意', RETURNING: '退货中', COMPLETED: '已完成', REJECTED: '已拒绝',
}[value] || value)
const statusType = (value) => ({
  PENDING: 'warning', APPROVED: 'success', RETURNING: 'primary', COMPLETED: 'success', REJECTED: 'danger',
}[value] || 'info')
</script>

<style scoped>
.after-sales-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.filter-bar { display: flex; align-items: center; gap: 16px; }
.muted { color: #84938a; font-size: 12px; }
</style>
