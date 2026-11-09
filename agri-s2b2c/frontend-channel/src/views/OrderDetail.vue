<template>
  <div class="order-detail-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>订单详情</h2>
        <p v-if="order">订单号 {{ order.orderNo }} · 下单时间 {{ order.createTime }} · 商家编号 {{ channelCode }}</p>
      </div>
      <div class="head-actions">
        <el-button @click="$router.push('/orders')">返回列表</el-button>
        <el-button v-if="canSubmit" type="primary" @click="shipVisible = true">提交发货</el-button>
      </div>
    </div>

    <template v-if="order">
      <div class="status-card">
        <div class="status-main">
          <el-tag :type="statusType(order.status)" size="large">{{ statusText(order.status) }}</el-tag>
          <p>{{ statusHint }}</p>
        </div>
        <div class="status-facts">
          <span>实付金额 <b>¥{{ money(order.payAmount) }}</b></span>
          <span>支付时间 <b>{{ order.payTime || '未支付' }}</b></span>
          <span>物流 <b>{{ order.logisticsCompany || '待发货' }} {{ order.logisticsNo || '' }}</b></span>
        </div>
      </div>

      <div class="card" v-if="shipment">
        <div class="ship-head">
          <h3>发货协同</h3>
          <el-tag :type="shipment.status === 'PROPOSED' ? 'warning' : shipment.status === 'CONFIRMED' ? 'success' : shipment.status === 'REJECTED' ? 'danger' : 'info'">
            {{ shipmentStatusText(shipment.status) }}
          </el-tag>
        </div>
        <dl class="descs">
          <dt>提交方</dt><dd>{{ shipment.proposerType === 'CHANNEL' ? '商家（我方）' : '供应商' }}</dd>
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
            <el-table-column prop="name" label="商品" min-width="200" />
            <el-table-column prop="spec" label="规格" width="120" />
            <el-table-column label="单价" width="100">
              <template #default="{ row }">¥{{ money(row.price) }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" />
            <el-table-column label="小计" width="110">
              <template #default="{ row }">¥{{ money(row.totalAmount) }}</template>
            </el-table-column>
          </el-table>
        </div>

        <div class="card">
          <h3>买家与收货</h3>
          <dl class="descs">
            <dt>买家</dt><dd>{{ buyer?.nickname || '微信用户' }}（{{ buyer?.phone || '未留手机号' }}）</dd>
            <dt>本渠道下单</dt><dd>{{ buyer?.orderCount || 0 }} 单 · 累计 ¥{{ money(buyer?.totalAmount) }}</dd>
            <dt v-if="address">收货人</dt><dd v-if="address">{{ address.name }} · {{ address.phone }}</dd>
            <dt v-if="address">收货地址</dt><dd v-if="address">{{ address.region }}{{ address.detail }}</dd>
            <dt>买家备注</dt><dd>{{ order.remark || '无' }}</dd>
          </dl>
          <el-button v-if="buyer?.id" link type="primary" @click="$router.push(`/customers/${buyer.id}`)">查看客户画像</el-button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>佣金与结算</h3>
          <el-table :data="commissions" border size="small">
            <el-table-column label="佣金金额" width="110">
              <template #default="{ row }">¥{{ money(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="比例" width="90">
              <template #default="{ row }">{{ Number(row.rate) }}%</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'SETTLED' ? 'success' : 'warning'">
                  {{ row.status === 'SETTLED' ? '已结算' : '待结算' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="settleTime" label="结算时间" />
            <el-table-column prop="settleBatchNo" label="结算批次" width="180" show-overflow-tooltip />
          </el-table>
          <el-empty v-if="!commissions.length" description="本单暂无佣金记录（直购单或未结算）" :image-size="60" />
        </div>

        <div class="card">
          <h3>售后记录</h3>
          <el-table :data="afterSales" border size="small">
            <el-table-column prop="type" label="类型" width="90" />
            <el-table-column label="金额" width="100">
              <template #default="{ row }">¥{{ money(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">{{ afterSaleStatus(row.status) }}</template>
            </el-table-column>
            <el-table-column prop="createTime" label="申请时间" />
          </el-table>
          <el-empty v-if="!afterSales.length" description="本单没有售后申请" :image-size="60" />
        </div>
      </div>
    </template>

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px">
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { channelApi } from '../api'

const route = useRoute()
const loading = ref(true)
const order = ref(null)
const items = ref([])
const commissions = ref([])
const afterSales = ref([])
const shipment = ref(null)
const acting = ref(false)
const canSubmit = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status !== 'PROPOSED')
const canConfirm = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'SUPPLIER')
const canWithdraw = computed(() => order.value?.status === 'PENDING_SHIP' && shipment.value?.status === 'PROPOSED' && shipment.value?.proposerType === 'CHANNEL')
const buyer = ref(null)
const address = ref(null)
const shipVisible = ref(false)
const shipping = ref(false)
const shipForm = reactive({ company: '云仓代发', logisticsNo: '' })

const channelCode = computed(() => String(order.value?.channelId || '').slice(-6))

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await channelApi.getOrderDetail(route.params.id)
    order.value = data.order || null
    items.value = data.items || []
    commissions.value = data.commissions || []
    afterSales.value = data.afterSales || []
    shipment.value = await channelApi.getShipment(route.params.id).catch(() => null)
    buyer.value = data.buyer || null
    address.value = data.address || null
  } catch (e) {
    ElMessage.error(e?.message || '订单详情读取失败')
  } finally {
    loading.value = false
  }
}

async function submitShip() {
  if (!shipForm.logisticsNo.trim()) {
    ElMessage.warning('请填写物流单号')
    return
  }
  shipping.value = true
  try {
    const res = await channelApi.shipOrder(order.value.id, {
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

async function confirmShipment() {
  acting.value = true
  try {
    const res = await channelApi.confirmShipment(order.value.id)
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
    const res = await channelApi.rejectShipment(order.value.id, result.value)
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
    const res = await channelApi.withdrawShipment(order.value.id)
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
const statusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value)
const statusType = (value) => ({
  PENDING_PAY: 'warning', PENDING_SHIP: 'warning', SHIPPED: 'primary', PENDING_RECEIVE: 'primary',
  COMPLETED: 'success', CANCELLED: 'info', REFUNDING: 'danger', REFUNDED: 'danger',
}[value] || 'info')
const afterSaleStatus = (value) => ({ PENDING: '待处理', APPROVED: '已同意', REJECTED: '已拒绝' }[value] || value)
const statusHint = computed(() => ({
  PENDING_PAY: '买家尚未支付，超时后订单将自动关闭。',
  PENDING_SHIP: '买家已付款，请及时发货并回传物流单号。',
  SHIPPED: '商品已出库，等待买家确认收货。',
  PENDING_RECEIVE: '商品运输中，等待买家确认收货。',
  COMPLETED: '订单已完成，佣金按 T+1 规则结算。',
  CANCELLED: '订单已取消，不产生佣金。',
  REFUNDING: '售后处理中，退款完成后佣金自动冲回。',
}[order.value?.status] || ''))
</script>

<style scoped>
.order-detail-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; }
.head-actions { display: flex; gap: 8px; }
.status-card { display: flex; justify-content: space-between; gap: 16px; padding: 18px 20px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; flex-wrap: wrap; }
ship-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.ship-head h3 { margin: 0; }
.ship-actions { display: flex; gap: 8px; margin-top: 12px; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; }
.status-main p { margin: 10px 0 0; color: #6b7c72; font-size: 13px; }
.status-facts { display: flex; gap: 24px; flex-wrap: wrap; color: #6b7c72; font-size: 13px; }
.status-facts b { display: block; margin-top: 4px; color: #173e2a; font-size: 14px; }
.grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.descs { display: grid; grid-template-columns: 90px 1fr; gap: 10px 12px; margin: 0; font-size: 13px; }
.descs dt { color: #84938a; }
.descs dd { margin: 0; color: #173e2a; word-break: break-all; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
</style>
