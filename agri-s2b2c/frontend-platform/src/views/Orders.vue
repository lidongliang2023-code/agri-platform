<template>
  <div class="orders-page">
    <div class="page-head">
      <div>
        <h2>订单管理</h2>
        <p>平台侧查看全量订单与履约/售后/佣金关联；超时未支付订单会由定时任务自动取消并回补库存与活动预算。</p>
      </div>
      <div class="head-actions">
        <el-button type="warning" :loading="expiring" @click="expireUnpaid">清理超时未付款</el-button>
        <el-button type="primary" :loading="completing" @click="autoComplete">自动确认收货</el-button>
      </div>
    </div>

    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索订单号" style="width: 300px" @keyup.enter="loadOrders" />
      <el-select v-model="status" placeholder="订单状态" style="width: 150px" @change="loadOrders">
        <el-option label="全部" value="" />
        <el-option label="待付款" value="PENDING_PAY" />
        <el-option label="待发货" value="PENDING_SHIP" />
        <el-option label="已发货" value="SHIPPED" />
        <el-option label="待收货" value="PENDING_RECEIVE" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="已取消" value="CANCELLED" />
        <el-option label="退款中" value="REFUNDING" />
        <el-option label="已退款" value="REFUNDED" />
      </el-select>
    </div>
    <el-table :data="orders" border>
      <el-table-column prop="orderNo" label="订单号" />
      <el-table-column prop="consumerId" label="消费者ID" />
      <el-table-column prop="shopId" label="店铺ID" />
      <el-table-column prop="supplierId" label="供应商ID" />
      <el-table-column prop="channelId" label="渠道商ID" />
      <el-table-column prop="totalAmount" label="订单金额" />
      <el-table-column prop="payAmount" label="实付金额" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="payMethod" label="支付方式" />
      <el-table-column prop="payTime" label="支付时间" />
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="text" @click="goDetail(row.id)">查看</el-button>
        </template>
      </el-table-column>
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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const expiring = ref(false)
const completing = ref(false)
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
    status: status.value,
    keyword: keyword.value.trim() || undefined,
  })
  orders.value = res.records || []
  total.value = res.total || 0
}

async function expireUnpaid() {
  expiring.value = true
  try {
    const res = await platformApi.expireUnpaidOrders(30)
    if (res?.success === false) return ElMessage.error(res.message || '清理失败')
    ElMessage.success(res?.message || '清理完成')
    await loadOrders()
  } catch (e) {
    ElMessage.error(e?.message || '清理失败')
  } finally {
    expiring.value = false
  }
}

async function autoComplete() {
  completing.value = true
  try {
    const res = await platformApi.autoCompleteOrders(7)
    if (res?.success === false) return ElMessage.error(res.message || '操作失败')
    ElMessage.success(res?.message || '操作完成')
    await loadOrders()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    completing.value = false
  }
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadOrders()
}

const getStatusType = (status) => {
  const types = {
    PENDING_PAY: 'warning', PENDING_SHIP: 'info', SHIPPED: 'primary', PENDING_RECEIVE: 'primary',
    COMPLETED: 'success', CANCELLED: 'info', REFUNDING: 'danger', REFUNDED: 'danger',
  }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = {
    PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
    COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
  }
  return texts[status] || status
}

const goDetail = (id) => {
  router.push(`/order-detail/${id}`)
}
</script>

<style scoped>
.orders-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-head h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.page-head p {
  margin: 0;
  color: #6b7c72;
  font-size: 13px;
  line-height: 1.6;
  max-width: 800px;
}

.head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.search-bar {
  display: flex;
  gap: 15px;
  align-items: center;
}
</style>