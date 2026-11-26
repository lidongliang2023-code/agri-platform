<template>
  <div class="orders-page">
    <div class="page-head">
      <div>
        <h2>订单管理</h2>
        <p>平台侧查看全量订单与履约/售后/佣金关联；超时未支付订单会由定时任务自动取消并回补库存与活动预算。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="orders"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:orders"
      empty-text="暂无符合条件的订单"
      @page-change="handlePageChange"
      @refresh="loadOrders"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>订单号</label>
            <el-input v-model="keyword" placeholder="搜索订单号" clearable @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>订单状态</label>
            <el-select v-model="status" placeholder="全部">
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
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" :loading="completing" @click="autoComplete">自动确认收货</el-button>
        <el-button type="warning" :loading="expiring" @click="expireUnpaid">清理超时未付款</el-button>
      </template>

      <template #cell-status="{ row }">
        <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'detail', label: '查看', onClick: () => goDetail(row.id) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const loading = ref(false)
const expiring = ref(false)
const completing = ref(false)
const orders = ref([])
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 185 },
  { key: 'consumerId', prop: 'consumerId', label: '消费者ID', width: 120 },
  { key: 'shopId', prop: 'shopId', label: '店铺ID', width: 110 },
  { key: 'supplierId', prop: 'supplierId', label: '供应商ID', width: 120 },
  { key: 'channelId', prop: 'channelId', label: '商家ID', width: 120 },
  { key: 'totalAmount', prop: 'totalAmount', label: '订单金额', width: 110 },
  { key: 'payAmount', prop: 'payAmount', label: '实付金额', width: 110 },
  { key: 'status', prop: 'status', label: '状态', width: 105 },
  { key: 'payMethod', prop: 'payMethod', label: '支付方式', width: 110 },
  { key: 'payTime', prop: 'payTime', label: '支付时间', width: 170 },
  { key: 'createTime', prop: 'createTime', label: '创建时间', width: 170 },
  { key: 'actions', label: '操作', width: 100 },
]

async function loadOrders() {
  loading.value = true
  try {
    const res = await platformApi.getOrders({
      page: page.value,
      size: size.value,
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
    })
    orders.value = res.records || []
    total.value = Number(res.total || 0)
  } finally {
    loading.value = false
  }
}

onMounted(loadOrders)

const search = () => {
  page.value = 1
  loadOrders()
}

const reset = () => {
  keyword.value = ''
  status.value = ''
  page.value = 1
  loadOrders()
}

const handlePageChange = (nextPage, nextSize) => {
  page.value = nextPage
  size.value = nextSize
  loadOrders()
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

const getStatusType = (value) => ({
  PENDING_PAY: 'warning', PENDING_SHIP: 'info', SHIPPED: 'primary', PENDING_RECEIVE: 'primary',
  COMPLETED: 'success', CANCELLED: 'info', REFUNDING: 'danger', REFUNDED: 'danger',
}[value] || 'info')

const getStatusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value)

const goDetail = (id) => {
  router.push(`/order-detail/${id}`)
}
</script>

<style scoped>
.orders-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 800px; }
</style>
