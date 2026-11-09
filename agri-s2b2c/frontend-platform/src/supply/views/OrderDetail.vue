<template>
  <div class="order-detail-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>订单详情</h2>
        <p v-if="order">{{ order.orderNo }} · {{ order.createTime }} · 渠道：{{ channel?.shopName || '直购' }}</p>
      </div>
      <div class="head-actions">
        <el-button @click="$router.push('/supply/orders')">返回列表</el-button>
        <el-button v-if="canSubmit" type="primary" @click="shipVisible = true">提交发货</el-button>
      </div>
    </div>

    <el-dialog v-model="traceBindVisible" title="绑定出货单品码" width="620px">
      <el-alert type="info" :closable="false" title="每件销售单位一码；码须激活、质检合格且与下单批次一致。绑定后不允许覆盖。" />
      <p>{{ traceItem?.name }} · 来源批次 {{ traceItem?.prodBatchNo }} · 需绑定 {{ traceItem?.quantity }} 个码</p>
      <el-input v-model="traceCodes" type="textarea" :rows="8" placeholder="每行一个单品溯源码" />
      <el-alert v-if="traceError" type="error" :closable="false" :title="traceError" style="margin-top: 12px" />
      <template #footer><el-button @click="traceBindVisible = false">取消</el-button><el-button type="primary" :loading="traceBinding" @click="bindTrace">校验并绑定</el-button></template>
    </el-dialog>
    <el-dialog v-model="traceViewVisible" title="订单来源与单品履约" width="760px">
      <el-alert v-if="traceError" type="error" :title="traceError" :closable="false" />
      <template v-if="traceView">
        <p>下单来源批次：{{ traceView.batchNo || '未记录' }}；这不是按当前商品反查的批次。</p>
        <el-table :data="traceView.units || []" border><el-table-column prop="traceCode" label="出货单品码" min-width="260" /><el-table-column prop="batchNo" label="批次" /><el-table-column prop="boundAt" label="绑定时间" /></el-table>
        <el-empty v-if="!traceView.units?.length" description="尚未记录单品履约绑定" />
        <el-timeline style="margin-top: 24px"><el-timeline-item v-for="(node, index) in traceView.nodes || []" :key="index" :timestamp="node.occurredAt || node.time || '未记录时间'">{{ node.title || node.nodeName || node.stage }} · {{ node.description || node.detail }}</el-timeline-item></el-timeline>
      </template>
    </el-dialog>
    <template v-if="order">
      <div class="stat-row">
        <div class="stat-card"><span>订单状态</span><b><el-tag :type="statusType(order.status)">{{ statusText(order.status) }}</el-tag></b><small>{{ order.payTime || '未支付' }}</small></div>
        <div class="stat-card"><span>实付金额</span><b>¥{{ money(order.payAmount) }}</b><small>含运费 ¥{{ money(order.freightAmount) }}</small></div>
        <div class="stat-card"><span>物流</span><b>{{ order.logisticsCompany || '未发货' }}</b><small>{{ order.logisticsNo || '—' }}</small></div>
        <div class="stat-card"><span>售后</span><b>{{ afterSales.length }}</b><small>本单售后记录</small></div>
      </div>

      <div class="card" v-if="shipment">
        <div class="card-head">
          <h3>发货协同</h3>
          <el-tag :type="shipment.status === 'PROPOSED' ? 'warning' : shipment.status === 'CONFIRMED' ? 'success' : shipment.status === 'REJECTED' ? 'danger' : 'info'">
            {{ shipmentStatusText(shipment.status) }}
          </el-tag>
        </div>
        <dl class="descs">
          <dt>提交方</dt><dd>{{ shipment.proposerType === 'SUPPLIER' ? '供应商' : '商家' }}</dd>
          <dt>物流</dt><dd>{{ shipment.logisticsCompany }} · {{ shipment.logisticsNo }}</dd>
          <dt>提交时间</dt><dd>{{ shipment.createTime }}</dd>
          <dt v-if="shipment.reason">驳回原因</dt><dd v-if="shipment.reason">{{ shipment.reason }}</dd>
        </dl>
        <div class="ship-actions" v-if="canConfirm || canWithdraw">
          <template v-if="canConfirm">
            <el-button type="success" :loading="acting" @click="confirmShipment">确认发货</el-button>
            <el-button type="danger" :loading="acting" @click="rejectShipment">驳回</el-button>
          </template>
          <el-button v-if="canWithdraw" :loading="acting" @click="withdrawShipment">撤回发货信息</el-button>
        </div>
        <p class="note">确认后订单才进入已发货；驳回后可修改物流信息重新提交。</p>
      </div>

      <div class="grid">
        <div class="card">
          <h3>商品明细</h3>
          <el-table :data="items" border size="small">
            <el-table-column prop="name" label="商品" min-width="190" />
            <el-table-column prop="spec" label="规格" width="110" />
            <el-table-column prop="prodBatchNo" label="下单来源批次" min-width="170"><template #default="{ row }">{{ row.prodBatchNo || '历史来源未记录' }}</template></el-table-column>
            <el-table-column label="单品溯源" min-width="160"><template #default="{ row }">
              <el-button link type="primary" @click="showTrace(row)">查看链路</el-button>
              <el-button v-if="order.status === 'PENDING_SHIP' && row.prodBatchNo" link type="success" @click="openTraceBind(row)">绑定单品码</el-button>
            </template></el-table-column>
            <el-table-column label="单价" width="100"><template #default="{ row }">¥{{ money(row.price) }}</template></el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="小计" width="110"><template #default="{ row }">¥{{ money(row.totalAmount) }}</template></el-table-column>
          </el-table>
        </div>
        <div class="card">
          <h3>渠道与履约</h3>
          <dl class="descs">
            <dt>渠道</dt><dd>{{ channel?.shopName || '直购订单（无渠道归属）' }}</dd>
            <dt>渠道等级</dt><dd>{{ gradeText(channel?.grade) }}</dd>
            <dt>买家备注</dt><dd>{{ order.remark || '无' }}</dd>
            <dt>发货方式</dt><dd>{{ order.deliveryType || '供应商直发' }}</dd>
            <dt>收货地址</dt><dd>{{ order.addressId ? '以订单快照为准' : '—' }}</dd>
          </dl>
          <p class="note">收货人信息由消费者端与用户中心管理，本端只用于履约。</p>
        </div>
      </div>

      <div class="card">
        <h3>售后记录</h3>
        <el-table :data="afterSales" border size="small">
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="reason" label="原因" min-width="200" />
          <el-table-column label="金额" width="100"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="handleOpinion" label="处理意见" min-width="160" />
          <el-table-column prop="createTime" label="申请时间" width="180" />
        </el-table>
        <el-empty v-if="!afterSales.length" description="本单暂无售后" :image-size="60" />
      </div>
    </template>

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px">
        <el-form-item label="物流公司"><el-input v-model="shipForm.company" /></el-form-item>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { supplierApi } from '../api'

const traceBindVisible = ref(false)
const traceViewVisible = ref(false)
const traceBinding = ref(false)
const traceItem = ref(null)
const traceView = ref(null)
const traceCodes = ref('')
const traceError = ref('')
function openTraceBind(item) { traceItem.value = item; traceCodes.value = ''; traceError.value = ''; traceBindVisible.value = true }
async function bindTrace() {
  if (traceBinding.value) return
  traceBinding.value = true; traceError.value = ''
  try {
    const codes = traceCodes.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean)
    await supplierApi.bindTraceUnits(order.value.id, traceItem.value.id, codes)
    traceBindVisible.value = false; ElMessage.success('出货单品码已绑定')
  } catch (e) { traceError.value = e?.response?.data?.message || e?.message || '绑定失败' }
  finally { traceBinding.value = false }
}
async function showTrace(item) {
  traceError.value = ''; traceView.value = null; traceViewVisible.value = true
  try { traceView.value = await supplierApi.getItemTrace(order.value.id, item.id) }
  catch (e) { traceError.value = e?.response?.data?.message || e?.message || '溯源加载失败' }
}
const route = useRoute()
const loading = ref(true)
const order = ref(null)
const items = ref([])
const channel = ref(null)
const afterSales = ref([])
const shipment = ref(null)
const acting = ref(false)
const canSubmit = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status !== 'PROPOSED')
const canConfirm = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'CHANNEL')
const canWithdraw = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'SUPPLIER')
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ company: '顺丰冷链', logisticsNo: '' })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await supplierApi.getOrderDetail(route.params.id)
    order.value = data.order || null
    items.value = data.items || []
    channel.value = data.channel || null
    afterSales.value = data.afterSales || []
    shipment.value = await supplierApi.getShipment(route.params.id).catch(() => null)
  } catch (e) {
    ElMessage.error(e?.message || '订单详情读取失败')
  } finally {
    loading.value = false
  }
}

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) return ElMessage.warning('请填写物流单号')
  shipping.value = true
  try {
    const res = await supplierApi.shipOrder(order.value.id, {
      logisticsNo: shipForm.logisticsNo.trim(),
      company: shipForm.company.trim(),
    })
    if (res?.success === false) return ElMessage.error(res.message || '发货失败')
    ElMessage.success(res?.message || '发货成功')
    shipVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '发货失败')
  } finally {
    shipping.value = false
  }
}

async function confirmShipment() {
  acting.value = true
  try {
    const res = await supplierApi.confirmShipment(order.value.id)
    if (res?.success === false) return ElMessage.error(res.message || '确认失败')
    ElMessage.success(res?.message || '已确认发货')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '确认失败')
  } finally {
    acting.value = false
  }
}

async function rejectShipment() {
  try {
    const result = await ElMessageBox.prompt('请填写驳回原因', '驳回发货信息', { inputPattern: /S+/, inputErrorMessage: '请填写原因' })
    acting.value = true
    const res = await supplierApi.rejectShipment(order.value.id, result.value)
    if (res?.success === false) return ElMessage.error(res.message || '驳回失败')
    ElMessage.success('已驳回')
    await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '驳回失败')
  } finally {
    acting.value = false
  }
}

async function withdrawShipment() {
  acting.value = true
  try {
    const res = await supplierApi.withdrawShipment(order.value.id)
    if (res?.success === false) return ElMessage.error(res.message || '撤回失败')
    ElMessage.success('已撤回')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '撤回失败')
  } finally {
    acting.value = false
  }
}

const shipmentStatusText = (value) => ({ PROPOSED: '待对方确认', CONFIRMED: '已确认', REJECTED: '已驳回', CANCELLED: '已撤回' }[value] || value)
const money = (value) => Number(value || 0).toFixed(2)
const gradeText = (value) => ({ LEVEL_1: '铜牌', LEVEL_2: '银牌', LEVEL_3: '金牌' }[value] || value || '—')
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
.order-detail-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; }
.head-actions { display: flex; gap: 8px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 22px; }
.stat-card small { color: #94a198; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.descs { display: grid; grid-template-columns: 90px 1fr; gap: 10px 12px; margin: 0; font-size: 13px; }
.descs dt { color: #84938a; }
.descs dd { margin: 0; color: #173e2a; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; line-height: 1.6; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; }
.ship-actions { display: flex; gap: 8px; margin-top: 12px; }
@media (max-width: 1000px) { .stat-row, .grid { grid-template-columns: 1fr 1fr; } }
</style>
