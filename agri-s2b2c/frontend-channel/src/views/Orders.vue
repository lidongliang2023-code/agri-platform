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

    <AgriElementListTable
      :columns="columns"
      :data="orders"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-channel:orders"
      empty-text="当前筛选条件下没有订单"
      @page-change="handlePageChange"
      @refresh="loadAll"
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
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-payAmount="{ row }">¥{{ money(row.payAmount) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
      </template>
      <template #cell-shipConfirmStatus="{ row }">
        <el-tag v-if="row.shipConfirmStatus === 'PENDING'" type="warning">{{ row.shipProposedBy === 'CHANNEL' ? '待供应商确认' : '待我方确认' }}</el-tag>
        <el-tag v-else-if="row.shipConfirmStatus === 'REJECTED'" type="danger">已驳回</el-tag>
        <el-tag v-else-if="row.shipConfirmStatus === 'CONFIRMED'" type="success">已确认</el-tag>
        <span v-else class="muted">—</span>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="rowActions(row)" />
      </template>
    </AgriElementListTable>

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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const orders = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const stats = ref({})
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ id: '', orderNo: '', company: '云仓代发', logisticsNo: '' })

const columns = [
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 190 },
  { key: 'consumerId', prop: 'consumerId', label: '买家ID', width: 170 },
  { key: 'payAmount', prop: 'payAmount', label: '实付金额', width: 120 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'shipConfirmStatus', prop: 'shipConfirmStatus', label: '发货协同', width: 140 },
  { key: 'logisticsNo', prop: 'logisticsNo', label: '物流单号', minWidth: 160 },
  { key: 'createTime', prop: 'createTime', label: '下单时间', width: 180 },
  { key: 'actions', label: '操作', width: 145 },
]

function rowActions(row) {
  const list = [{ key: 'detail', label: '详情', onClick: () => router.push(`/orders/${row.id}`) }]
  if (row.status === 'PENDING_SHIP' && row.shipConfirmStatus !== 'PENDING') {
    list.push({ key: 'ship', label: '提交发货', onClick: () => openShip(row) })
  }
  return list
}

onMounted(loadAll)

async function loadAll() {
  await Promise.all([loadOrders(), loadStats()])
}

async function loadStats() {
  try {
    stats.value = (await channelApi.getOrderStats()) || {}
  } catch {
    stats.value = {}
  }
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await channelApi.getOrders({
      page: page.value,
      size: size.value,
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
    })
    orders.value = res.records || []
    total.value = Number(res.total || 0)
  } catch (e) {
    orders.value = []
    total.value = 0
    ElMessage.error(e?.message || '订单读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  loadOrders()
}

function reset() {
  keyword.value = ''
  status.value = ''
  page.value = 1
  loadOrders()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
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
    await loadAll()
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
.muted { color: #94a198; font-size: 12px; }
</style>
