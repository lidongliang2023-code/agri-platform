<template>
  <div class="fulfillment-page">
    <div class="page-head">
      <div>
        <h2>履约与云仓代发</h2>
        <p>消费者付款后的订单在此统一履约：云仓代发订单填写物流单号即回传「已发货」，历史物流可在订单详情查看。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>待发货</span><b>{{ stats.pendingShip || 0 }}</b><small>需在承诺时效内出库</small></div>
      <div class="stat-card"><span>今日订单</span><b>{{ stats.todayOrders || 0 }}</b><small>今日新成交</small></div>
      <div class="stat-card"><span>今日 GMV</span><b>¥{{ money(stats.todayAmount) }}</b><small>不含已取消订单</small></div>
      <div class="stat-card"><span>待处理售后</span><b>{{ stats.pendingAfterSale || 0 }}</b><small>售后页统一处理</small></div>
    </div>

    <AgriElementListTable
      :columns="pendingColumns"
      :data="pendingOrders"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-channel:fulfillment-pending"
      empty-text="没有待发货订单，履约链路正常"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #toolbar-left>
        <div class="section-title">
          <h3>待发货订单</h3>
          <span class="muted">云仓代发自营履约；物流单号回传后订单进入已发货</span>
        </div>
      </template>
      <template #cell-payAmount="{ row }">¥{{ money(row.payAmount) }}</template>
      <template #cell-shipConfirmStatus="{ row }">
        <el-tag v-if="row.shipConfirmStatus === 'PENDING'" type="warning">
          {{ row.shipProposedBy === 'CHANNEL' ? '待供应商确认' : '待我方确认' }}
        </el-tag>
        <span v-else class="muted">—</span>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="pendingRowActions(row)" />
      </template>
    </AgriElementListTable>

    <AgriElementListTable
      :columns="shippedColumns"
      :data="shippedOrders"
      row-key="id"
      :loading="loading"
      client-pagination
      :page-size="10"
      column-settings-storage-key="agri-s2b2c-channel:fulfillment-shipped"
      empty-text="暂无已发货订单"
      @refresh="loadShipped"
    >
      <template #toolbar-left>
        <div class="section-title">
          <h3>在途与已发货</h3>
          <span class="muted">物流信息由渠道履约回传，买家侧可查看同一单号</span>
        </div>
      </template>
      <template #cell-status="{ row }">
        <el-tag :type="row.status === 'COMPLETED' ? 'success' : 'primary'">{{ statusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'detail', label: '详情', onClick: () => $router.push(`/orders/${row.id}`) }]" />
      </template>
    </AgriElementListTable>

    <el-dialog v-model="shipVisible" title="云仓代发" width="460px">
      <el-form label-width="90px">
        <el-form-item label="订单号"><span>{{ shipForm.orderNo }}</span></el-form-item>
        <el-form-item label="物流公司"><el-input v-model="shipForm.company" placeholder="如：顺丰冷链" /></el-form-item>
        <el-form-item label="物流单号" required><el-input v-model="shipForm.logisticsNo" placeholder="填写电子面单号" /></el-form-item>
      </el-form>
      <p class="dialog-tip">提交后需供应商确认，确认后订单才进入已发货；实际拣货/出库与运单由云仓/承运商完成。</p>
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
import { AgriElementListTable, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'

const router = useRouter()
const stats = ref({})
const pendingOrders = ref([])
const shippedOrders = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ id: '', orderNo: '', company: '云仓代发', logisticsNo: '' })

const pendingColumns = [
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 190 },
  { key: 'consumerId', prop: 'consumerId', label: '买家ID', width: 170 },
  { key: 'payAmount', prop: 'payAmount', label: '实付', width: 110 },
  { key: 'payTime', prop: 'payTime', label: '支付时间', width: 180 },
  { key: 'createTime', prop: 'createTime', label: '下单时间', width: 180 },
  { key: 'shipConfirmStatus', prop: 'shipConfirmStatus', label: '发货协同', width: 140 },
  { key: 'actions', label: '操作', width: 150 },
]

const shippedColumns = [
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 190 },
  { key: 'logisticsCompany', prop: 'logisticsCompany', label: '承运商', width: 130 },
  { key: 'logisticsNo', prop: 'logisticsNo', label: '物流单号', minWidth: 160 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'updateTime', prop: 'updateTime', label: '更新时间', width: 180 },
  { key: 'actions', label: '操作', width: 100 },
]

function pendingRowActions(row) {
  const list = [{ key: 'detail', label: '详情', onClick: () => router.push(`/orders/${row.id}`) }]
  if (row.shipConfirmStatus !== 'PENDING') {
    list.push({ key: 'ship', label: '一键代发', onClick: () => openShip(row) })
  }
  return list
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    await Promise.all([loadStats(), loadPending(), loadShipped()])
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = (await channelApi.getOrderStats()) || {}
  } catch {
    stats.value = {}
  }
}

async function loadPending() {
  try {
    const res = await channelApi.getOrders({ page: page.value, size: size.value, status: 'PENDING_SHIP' })
    pendingOrders.value = res.records || []
    total.value = Number(res.total || 0)
  } catch (e) {
    ElMessage.error(e?.message || '待发货订单读取失败')
  }
}

async function loadShipped() {
  try {
    const [shipped, completed] = await Promise.all([
      channelApi.getOrders({ page: 1, size: 10, status: 'SHIPPED' }),
      channelApi.getOrders({ page: 1, size: 10, status: 'COMPLETED' }),
    ])
    shippedOrders.value = [...(shipped.records || []), ...(completed.records || [])]
      .sort((a, b) => String(b.updateTime || '').localeCompare(String(a.updateTime || '')))
      .slice(0, 10)
  } catch {
    shippedOrders.value = []
  }
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  loadPending()
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
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '发货失败')
  } finally {
    shipping.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({ SHIPPED: '已发货', PENDING_RECEIVE: '待收货', COMPLETED: '已完成' }[value] || value)
</script>

<style scoped>
.fulfillment-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.section-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.section-title h3 { margin: 0; font-size: 15px; color: #173e2a; }
.muted { color: #84938a; font-size: 12px; }
.dialog-tip { margin: 0 0 4px; color: #84938a; font-size: 12px; line-height: 1.6; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
