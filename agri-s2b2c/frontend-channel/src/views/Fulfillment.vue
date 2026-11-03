<template>
  <div class="fulfillment-page">
    <div class="page-head">
      <div>
        <h2>履约与云仓代发</h2>
        <p>消费者付款后的订单在此统一履约：云仓代发订单填写物流单号即回传「已发货」，历史物流可在订单详情查看。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>待发货</span><b>{{ stats.pendingShip || 0 }}</b><small>需在承诺时效内出库</small></div>
      <div class="stat-card"><span>今日订单</span><b>{{ stats.todayOrders || 0 }}</b><small>今日新成交</small></div>
      <div class="stat-card"><span>今日 GMV</span><b>¥{{ money(stats.todayAmount) }}</b><small>不含已取消订单</small></div>
      <div class="stat-card"><span>待处理售后</span><b>{{ stats.pendingAfterSale || 0 }}</b><small>售后页统一处理</small></div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>待发货订单</h3>
        <span class="muted">云仓代发自营履约；物流单号回传后订单进入已发货</span>
      </div>
      <el-table :data="pendingOrders" border>
        <el-table-column prop="orderNo" label="订单号" min-width="190" />
        <el-table-column prop="consumerId" label="买家ID" width="170" show-overflow-tooltip />
        <el-table-column label="实付" width="110">
          <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
        </el-table-column>
        <el-table-column prop="payTime" label="支付时间" width="180" />
        <el-table-column prop="createTime" label="下单时间" width="180" />
        <el-table-column label="发货协同" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.shipConfirmStatus === 'PENDING'" type="warning">
              {{ row.shipProposedBy === 'CHANNEL' ? '待供应商确认' : '待我方确认' }}
            </el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
            <el-button v-if="row.shipConfirmStatus !== 'PENDING'" link type="success" @click="openShip(row)">一键代发</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!pendingOrders.length" description="没有待发货订单，履约链路正常" :image-size="70" />
      <el-pagination
        v-model:current-page="page"
        :page-size="size"
        :total="total"
        layout="prev, pager, next, jumper"
        @current-change="loadPending"
      />
    </div>

    <div class="card">
      <div class="card-head">
        <h3>在途与已发货</h3>
        <span class="muted">物流信息由渠道履约回传，买家侧可查看同一单号</span>
      </div>
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
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!shippedOrders.length" description="暂无已发货订单" :image-size="70" />
    </div>

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
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

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
    stats.value = (await channelApi.getOrderStats()) || {}
  } catch {
    stats.value = {}
  }
}

async function loadPending() {
  try {
    const res = await channelApi.getOrders({ page: page.value, size: size.value, status: 'PENDING_SHIP' })
    pendingOrders.value = res.records || []
    total.value = res.total || 0
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
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; display: flex; flex-direction: column; gap: 12px; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
.dialog-tip { margin: 0 0 4px; color: #84938a; font-size: 12px; line-height: 1.6; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
