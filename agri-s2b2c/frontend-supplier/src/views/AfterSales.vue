<template>
  <div class="after-sales-page">
    <div class="page-head">
      <div>
        <h2>售后协同</h2>
        <p>售后由渠道端/平台处理，供应商负责配合核实与补发；本页只读跟踪，不做退款操作。</p>
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
    </div>
    <el-table :data="rows" border>
      <el-table-column prop="orderNo" label="订单号" min-width="190" />
      <el-table-column prop="channelName" label="渠道" width="150" />
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
      <el-table-column label="金额" width="100"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="handleOpinion" label="处理意见" min-width="160" />
      <el-table-column prop="createTime" label="申请时间" width="180" />
    </el-table>
    <el-empty v-if="!rows.length" description="当前筛选下没有售后" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'

const status = ref('')
const rows = ref([])

onMounted(load)

async function load() {
  try {
    rows.value = (await supplierApi.getAfterSales({ status: status.value || undefined })) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '售后读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  PENDING: '待处理', APPROVED: '已同意', RETURNING: '退货中', COMPLETED: '已完成', REJECTED: '已拒绝',
}[value] || value)
</script>

<style scoped>
.after-sales-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.filter-bar { display: flex; gap: 10px; }
</style>
