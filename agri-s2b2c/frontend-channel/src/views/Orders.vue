<template>
  <div class="orders-page">
    <div class="page-head">
      <div>
        <h2>订单列表</h2>
        <p>我的渠道店铺全部交易订单；订单归属按渠道快照固化，售后、佣金、结算均可回查到本单。</p>
      </div>
      <div class="head-stats">
        <span>今日订单 <b>{{ stats.todayOrders || 0 }}</b></span>
        <span>今日 GMV <b>¥{{ money(stats.todayAmount) }}</b></span>
        <span>待发货 <b>{{ stats.pendingShip || 0 }}</b></span>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索订单号" style="width: 260px" clearable @keyup.enter="search" @clear="search" />
      <el-select v-model="status" placeholder="订单状态" style="width: 160px" @change="search">
        <el-option label="全部" value="" />
        <el-option label="待付款" value="PENDING_PAY" />
        <el-option label="待发货" value="PENDING_SHIP" />
        <el-option label="已发货" value="SHIPPED" />
        <el-option label="待收货" value="PENDING_RECEIVE" />
        <el-option label="已完成" value="COMPLETED" />
        <el-option label="已取消" value="CANCELLED" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table :data="orders" border>
      <el-table-column prop="orderNo" label="订单号" min-width="190" />
      <el-table-column prop="consumerId" label="买家ID" width="170" show-overflow-tooltip />
      <el-table-column label="实付金额" width="120">
        <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="发货协同" width="140">
        <template #default="{ row }">
          <el-tag v-if="row.shipConfirmStatus === 'PENDING'" type="warning">{{ row.shipProposedBy === 'CHANNEL' ? '待供应商确认' : '待我方确认' }}</el-tag>
          <el-tag v-else-if="row.shipConfirmStatus === 'REJECTED'" type="danger">已驳回</el-tag>
          <el-tag v-else-if="row.shipConfirmStatus === 'CONFIRMED'" type="success">已确认</el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="logisticsNo" label="物流单号" min-width="160" show-overflow-tooltip />
      <el-table-column prop="createTime" label="下单时间" width="180" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
          <el-button v-if="row.status === 'PENDING_SHIP' && row.shipConfirmStatus !== 'PENDING'" link type="success" @click="openShip(row)">提交发货</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!orders.length" description="当前筛选条件下没有订单" />
    <el-pagination
      @current-change="handlePageChange"
      :current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
    />

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px">
        <el-form-item label="订单号">
          <span>{{ shipForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="物流公司">
          <el-input v-model="shipForm.company" placeholder="如：顺丰冷链" />
        </el-form-item>
        <el-form-item label="物流单号" required>
          <el-input v-model="shipForm.logisticsNo" placeholder="填写电子面单号" />
        </el-form-item>
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
import { channelApi } from '../api'

const keyword = ref('')
const status = ref('')
const orders = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const stats = ref({})
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ id: '', orderNo: '', company: '云仓代发', logisticsNo: '' })

onMounted(() => {
  loadOrders()
  loadStats()
})

async function loadStats() {
  try {
    stats.value = (await channelApi.getOrderStats()) || {}
  } catch {
    stats.value = {}
  }
}

async function loadOrders() {
  try {
    const res = await channelApi.getOrders({
      page: page.value,
      size: size.value,
      status: status.value,
      keyword: keyword.value.trim() || undefined,
    })
    orders.value = res.records || []
    total.value = res.total || 0
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

function handlePageChange(currentPage) {
  page.value = currentPage
  loadOrders()
}

function openShip(row) {
  shipForm.id = row.id
  shipForm.orderNo = row.orderNo
  shipForm.company = '云仓代发'
  shipForm.logisticsNo = ''
  shipVisible.value = true
}

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) {
    ElMessage.warning('请填写物流单号')
    return
  }
  shipping.value = true
  try {
    const res = await channelApi.shipOrder(shipForm.id, {
      logisticsNo: shipForm.logisticsNo.trim(),
      company: shipForm.company.trim(),
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '发货失败')
      return
    }
    ElMessage.success(res?.message || '发货成功')
    shipVisible.value = false
    await Promise.all([loadOrders(), loadStats()])
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
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.head-stats { display: flex; gap: 18px; color: #6b7c72; font-size: 13px; white-space: nowrap; }
.head-stats b { color: #173e2a; font-size: 16px; }
.filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.muted { color: #94a198; font-size: 12px; }
</style>
