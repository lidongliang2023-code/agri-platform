<template>
  <div class="commissions-page">
    <div class="summary-card">
      <div class="summary-item">
        <p class="summary-value">{{ totalCommission }}</p>
        <p class="summary-label">累计佣金(元)</p>
      </div>
      <div class="summary-item">
        <p class="summary-value">{{ pendingCommission }}</p>
        <p class="summary-label">待结算佣金(元)</p>
      </div>
      <div class="summary-item">
        <p class="summary-value">{{ settledCommission }}</p>
        <p class="summary-label">已结算佣金(元)</p>
      </div>
    </div>
    <div class="search-bar">
      <el-select v-model="status" placeholder="状态" style="width: 150px" @change="loadCommissions">
        <el-option label="全部" value="" />
        <el-option label="待结算" value="PENDING" />
        <el-option label="已结算" value="SETTLED" />
      </el-select>
    </div>
    <el-table :data="commissions" border>
      <el-table-column prop="orderNo" label="订单号" />
      <el-table-column prop="amount" label="佣金金额" />
      <el-table-column prop="rate" label="佣金比例">
        <template #default="{ row }">
          {{ row.rate }}%
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="settleTime" label="结算时间" />
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
import { ref, onMounted, computed } from 'vue'
import { channelApi } from '../api'

const status = ref('')
const commissions = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const totalCommission = ref(0)

const pendingCommission = computed(() => {
  return commissions.value.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)
})

const settledCommission = computed(() => {
  return commissions.value.filter(c => c.status === 'SETTLED').reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)
})

onMounted(() => {
  loadData()
})

const loadData = async () => {
  const [commRes, totalRes] = await Promise.all([
    channelApi.getCommissions({
      channelId: 1,
      page: page.value,
      size: size.value,
      status: status.value
    }),
    channelApi.getTotalCommission(1)
  ])
  commissions.value = commRes.records || []
  total.value = commRes.total || 0
  totalCommission.value = totalRes.total || 0
}

const loadCommissions = () => {
  page.value = 1
  loadData()
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadData()
}

const getStatusType = (status) => {
  const types = { 'PENDING': 'warning', 'SETTLED': 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { 'PENDING': '待结算', 'SETTLED': '已结算' }
  return texts[status] || status
}
</script>

<style scoped>
.commissions-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.summary-item {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.summary-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.summary-label {
  font-size: 14px;
  color: #999;
}

.search-bar {
  display: flex;
  gap: 15px;
  align-items: center;
}
</style>