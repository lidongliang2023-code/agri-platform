<template>
  <div class="orders-page">
    <div class="page-head">
      <div>
        <h2>分销订单列表</h2>
        <p>仅展示供应商归属为本店的订单；渠道与买家信息按订单快照，发货后回传物流单号。</p>
      </div>
      <div class="head-stats">待发货 <b>{{ summary.pendingShip || 0 }}</b></div>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索订单号" style="width: 260px" clearable @keyup.enter="search" @clear="search" />
      <el-select v-model="status" placeholder="订单状态" style="width: 150px" @change="search">
        <el-option label="全部" value="" />
        <el-option label="待付款" value="PENDING_PAY" />
        <el-option label="待发货" value="PENDING_SHIP" />
        <el-option label="已发货" value="SHIPPED" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="已取消" value="CANCELLED" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table :data="orders" border>
      <el-table-column prop="orderNo" label="订单号" min-width="190" />
      <el-table-column prop="items" label="商品" min-width="200" show-overflow-tooltip />
      <el-table-column prop="channelName" label="渠道" width="150" />
      <el-table-column label="实付" width="110"><template #default="{ row }">¥{{ money(row.payAmount) }}</template></el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="发货协同" width="130">
        <template #default="{ row }">
          <el-tag v-if="row.shipConfirmStatus === 'PENDING'" type="warning">{{ row.shipProposedBy === 'SUPPLIER' ? '待渠道确认' : '待我方确认' }}</el-tag>
          <el-tag v-else-if="row.shipConfirmStatus === 'REJECTED'" type="danger">已驳回</el-tag>
          <el-tag v-else-if="row.shipConfirmStatus === 'CONFIRMED'" type="success">已确认</el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="logisticsNo" label="物流单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="createTime" label="下单时间" width="180" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/supply/order-detail/${row.id}`)">详情</el-button>
          <el-button v-if="row.status === 'PENDING_SHIP' && row.shipConfirmStatus !== 'PENDING'" link type="success" @click="openShip(row)">提交发货</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!orders.length" description="当前筛选下没有订单" />
    <el-pagination v-model:current-page="page" :page-size="size" :total="total" layout="prev, pager, next, jumper" @current-change="loadOrders" />

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px">
        <el-form-item label="订单号"><span>{{ shipForm.orderNo }}</span></el-form-item>
        <el-form-item label="物流公司"><el-input v-model="shipForm.company" placeholder="如：顺丰冷链" /></el-form-item>
        <el-form-item label="物流单号" required><el-input v-model="shipForm.logisticsNo" placeholder="填写电子面单号" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" :loading="shipping" @click="submitShip">确认发货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'

const keyword = ref('')
const status = ref('')
const orders = ref([])
const summary = ref({})
const page = ref(1)
const size = ref(10)
const total = ref(0)
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ id: '', orderNo: '', company: '顺丰冷链', logisticsNo: '' })

onMounted(loadOrders)

async function loadOrders() {
  try {
    const data = (await supplierApi.getOrders({
      page: page.value,
      size: size.value,
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
    })) || {}
    orders.value = data.records || []
    total.value = data.total || 0
    summary.value = data.summary || {}
  } catch (e) {
    orders.value = []
    total.value = 0
    ElMessage.error(e?.message || '订单读取失败')
  }
}

function search() {
  page.value = 1
  loadOrders()
}

function openShip(row) {
  shipForm.id = row.id
  shipForm.orderNo = row.orderNo
  shipForm.company = '顺丰冷链'
  shipForm.logisticsNo = ''
  shipVisible.value = true
}

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) return ElMessage.warning('请填写物流单号')
  shipping.value = true
  try {
    const res = await supplierApi.shipOrder(shipForm.id, {
      logisticsNo: shipForm.logisticsNo.trim(),
      company: shipForm.company.trim(),
    })
    if (res?.success === false) return ElMessage.error(res.message || '发货失败')
    ElMessage.success(res?.message || '发货成功')
    shipVisible.value = false
    await loadOrders()
  } catch (e) {
    ElMessage.error(e?.message || '发货失败')
  } finally {
    shipping.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value)
const statusType = (value) => ({
  PENDING_PAY: 'warning', PENDING_SHIP: 'warning', SHIPPED: 'primary', PENDING_RECEIVE: 'primary',
  COMPLETED: 'success', CANCELLED: 'info', REFUNDING: 'danger', REFUNDED: 'danger',
}[value] || 'info')
</script>

<style scoped>
.orders-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.head-stats { color: #6b7c72; font-size: 13px; }
.head-stats b { color: #173e2a; font-size: 20px; }
.filter-bar { display: flex; gap: 10px; align-items: center; }
.muted { color: #94a198; font-size: 12px; }
</style>
