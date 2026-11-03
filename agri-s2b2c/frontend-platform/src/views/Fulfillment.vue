<template>
  <div class="fulfillment-page">
    <div class="page-head">
      <div>
        <h2>履约调度</h2>
        <p>平台视角的待发货与在途订单；发货动作回传物流单号，实际仓储/承运由云仓与承运商完成。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>待发货</span><b>{{ stats.pendingShip || 0 }}</b><small>需关注超时</small></div>
      <div class="stat-card"><span>今日订单</span><b>{{ stats.todayOrders || 0 }}</b><small>今日新成交</small></div>
      <div class="stat-card"><span>今日 GMV</span><b>¥{{ money(stats.todayAmount) }}</b><small>非取消订单</small></div>
      <div class="stat-card"><span>待处理售后</span><b>{{ stats.pendingAfterSale || 0 }}</b><small>售后页处理</small></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>待发货订单</h3><span class="muted">按支付时间升序，优先处理早期订单</span></div>
      <el-table :data="pendingOrders" border>
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column prop="channelId" label="渠道归属" width="170" show-overflow-tooltip />
        <el-table-column label="实付" width="110">
          <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
        </el-table-column>
        <el-table-column prop="payTime" label="支付时间" width="180" />
        <el-table-column prop="createTime" label="下单时间" width="180" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="success" @click="openShip(row)">发货</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!pendingOrders.length" description="没有待发货订单" :image-size="70" />
      <el-pagination v-model:current-page="page" :page-size="size" :total="total" layout="prev, pager, next, jumper" @current-change="loadPending" />
    </div>

    <div class="card">
      <div class="card-head"><h3>在途 / 已发货</h3><span class="muted">最近 10 单</span></div>
      <el-table :data="shippedOrders" border>
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column prop="logisticsCompany" label="承运商" width="130" />
        <el-table-column prop="logisticsNo" label="物流单号" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'COMPLETED' ? 'success' : 'primary'">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="180" />
      </el-table>
      <el-empty v-if="!shippedOrders.length" description="暂无在途订单" :image-size="70" />
    </div>

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
import { platformApi } from '../api'

const stats = ref({})
const pendingOrders = ref([])
const shippedOrders = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ id: '', orderNo: '', company: '云仓代发', logisticsNo: '' })

onMounted(load)

async function load() {
  await Promise.all([loadStats(), loadPending(), loadShipped()])
}

async function loadStats() {
  try {
    stats.value = (await platformApi.getOrderStats()) || {}
  } catch {
    stats.value = {}
  }
}

async function loadPending() {
  try {
    const res = await platformApi.getOrders({ page: page.value, size: size.value, status: 'PENDING_SHIP' })
    pendingOrders.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    ElMessage.error(e?.message || '待发货订单读取失败')
  }
}

async function loadShipped() {
  try {
    const [shipped, completed] = await Promise.all([
      platformApi.getOrders({ page: 1, size: 10, status: 'SHIPPED' }),
      platformApi.getOrders({ page: 1, size: 10, status: 'COMPLETED' }),
    ])
    shippedOrders.value = [...(shipped.records || []), ...(completed.records || [])]
      .sort((a, b) => String(b.updateTime || '').localeCompare(String(a.updateTime || '')))
      .slice(0, 10)
  } catch {
    shippedOrders.value = []
  }
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
    const res = await platformApi.shipOrder(shipForm.id, shipForm.logisticsNo.trim(), shipForm.company.trim())
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
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
