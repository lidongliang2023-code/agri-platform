<template>
  <div class="orders-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索订单号" style="width: 300px" @keyup.enter="loadOrders" />
      <el-select v-model="status" placeholder="状态" style="width: 150px" @change="loadOrders">
        <el-option label="全部" value="" />
        <el-option label="待付款" value="PENDING_PAY" />
        <el-option label="待发货" value="PENDING_SHIP" />
        <el-option label="已发货" value="SHIPPED" />
        <el-option label="已完成" value="COMPLETED" />
      </el-select>
    </div>
    <el-table :data="orders" border>
      <el-table-column prop="orderNo" label="订单号" />
      <el-table-column prop="consumerId" label="消费者ID" />
      <el-table-column prop="payAmount" label="实付金额" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" />
    </el-table>
    <el-pagination
      @current-change="handlePageChange"
      :current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { platformApi } from '../api'

const keyword = ref('')
const status = ref('')
const orders = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(() => {
  loadOrders()
})

const loadOrders = async () => {
  const res = await platformApi.getOrders({
    page: page.value,
    size: size.value,
    status: status.value
  })
  orders.value = res.records || []
  total.value = res.total || 0
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadOrders()
}

const getStatusType = (status) => {
  const types = { 'PENDING_PAY': 'warning', 'PENDING_SHIP': 'info', 'SHIPPED': 'primary', 'COMPLETED': 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { 'PENDING_PAY': '待付款', 'PENDING_SHIP': '待发货', 'SHIPPED': '已发货', 'COMPLETED': '已完成' }
  return texts[status] || status
}
</script>

<style scoped>
.orders-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.search-bar {
  display: flex;
  gap: 15px;
  align-items: center;
}
</style>