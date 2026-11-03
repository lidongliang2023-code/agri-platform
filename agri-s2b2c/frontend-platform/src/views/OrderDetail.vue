<template>
  <div class="order-detail-page" v-loading="loading">
    <div class="page-head">
      <el-button @click="$router.back()">返回订单列表</el-button>
      <el-tag v-if="order.id" :type="statusType(order.status)">{{ statusText(order.status) }}</el-tag>
    </div>

    <template v-if="order.id">
      <div class="card">
        <div class="card-head">
          <div>
            <h2>订单 {{ order.orderNo }}</h2>
            <p>下单时间 {{ formatTime(order.createTime) }} · 支付时间 {{ formatTime(order.payTime) || '—' }}</p>
          </div>
          <span class="amount">实付 ¥{{ money(order.payAmount) }}</span>
        </div>
        <el-descriptions border :column="3">
          <el-descriptions-item label="消费者">{{ consumer?.nickname || consumer?.phone || order.consumerId }}</el-descriptions-item>
          <el-descriptions-item label="供应商">{{ supplier?.shopName || supplier?.companyName || order.supplierId || '直购' }}</el-descriptions-item>
          <el-descriptions-item label="渠道">{{ channel?.shopName || order.channelId || '直购' }}</el-descriptions-item>
          <el-descriptions-item label="商品金额">¥{{ money(order.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="优惠">¥{{ money(order.discountAmount) }}</el-descriptions-item>
          <el-descriptions-item label="运费">¥{{ money(order.freightAmount) }}</el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ order.payMethod || '演示支付' }}</el-descriptions-item>
          <el-descriptions-item label="物流">{{ order.logisticsCompany || '—' }}</el-descriptions-item>
          <el-descriptions-item label="物流单号">{{ order.logisticsNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="订单备注" :span="3">{{ order.remark || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="card">
        <h3>商品明细</h3>
        <el-table :data="items" border size="small">
          <el-table-column prop="name" label="商品" min-width="220" />
          <el-table-column prop="spec" label="规格" width="140" />
          <el-table-column label="成交单价" width="110">
            <template #default="{ row }">¥{{ money(row.price) }}</template>
          </el-table-column>
          <el-table-column label="供货价快照" width="120">
            <template #default="{ row }">
              {{ row.supplyPrice == null ? '—' : `¥${money(row.supplyPrice)}` }}
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="小计" width="120">
            <template #default="{ row }">¥{{ money(row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column label="秒杀" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.flashSaleId" size="small" type="danger">已参与</el-tag>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="grid">
        <div class="card">
          <h3>收货信息</h3>
          <dl class="descs" v-if="address">
            <dt>收货人</dt><dd>{{ address.name }} {{ address.phone }}</dd>
            <dt>地址</dt><dd>{{ [address.province, address.city, address.district, address.address].filter(Boolean).join(' ') }}</dd>
          </dl>
          <el-empty v-else description="无收货地址" :image-size="50" />
        </div>

        <div class="card">
          <h3>发货协同</h3>
          <dl class="descs" v-if="shipment">
            <dt>状态</dt><dd>{{ shipment.status }} · {{ shipment.proposerType }}</dd>
            <dt>物流</dt><dd>{{ shipment.logisticsCompany || '—' }} {{ shipment.logisticsNo || '' }}</dd>
            <dt>提交时间</dt><dd>{{ formatTime(shipment.createTime) }}</dd>
            <dt>驳回原因</dt><dd>{{ shipment.reason || '—' }}</dd>
          </dl>
          <el-empty v-else description="暂无发货协同记录" :image-size="50" />
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>售后记录</h3>
          <el-table :data="afterSales" border size="small">
            <el-table-column prop="type" label="类型" width="90" />
            <el-table-column prop="reason" label="原因" min-width="160" />
            <el-table-column label="金额" width="100">
              <template #default="{ row }">¥{{ money(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="handleOpinion" label="处理意见" min-width="160" />
          </el-table>
          <el-empty v-if="!afterSales.length" description="无售后记录" :image-size="50" />
        </div>

        <div class="card">
          <h3>佣金</h3>
          <dl class="descs" v-if="commission">
            <dt>渠道 ID</dt><dd>{{ commission.channelId }}</dd>
            <dt>佣金比例</dt><dd>{{ commission.rate }}%</dd>
            <dt>佣金金额</dt><dd>¥{{ money(commission.amount) }}</dd>
            <dt>状态</dt><dd>{{ commission.status }}</dd>
            <dt>结算时间</dt><dd>{{ formatTime(commission.settleTime) || '—' }}</dd>
          </dl>
          <el-empty v-else description="直购订单无渠道佣金" :image-size="50" />
        </div>
      </div>
    </template>

    <el-empty v-else-if="!loading" description="订单不存在或无权查看" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const route = useRoute()
const loading = ref(true)
const order = ref({})
const items = ref([])
const consumer = ref(null)
const address = ref(null)
const supplier = ref(null)
const channel = ref(null)
const shipment = ref(null)
const afterSales = ref([])
const commission = ref(null)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = (await platformApi.getOrderDetail(route.params.id)) || {}
    order.value = data.order || {}
    items.value = data.items || []
    consumer.value = data.consumer || null
    address.value = data.address || null
    supplier.value = data.supplier || null
    channel.value = data.channel || null
    shipment.value = data.shipment || null
    afterSales.value = data.afterSales || []
    commission.value = data.commission || null
  } catch (e) {
    ElMessage.error(e?.message || '订单详情读取失败')
  } finally {
    loading.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const formatTime = (value) => value ? String(value).replace('T', ' ').slice(0, 19) : ''
const statusText = (status) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[status] || status)
const statusType = (status) => ({
  PENDING_PAY: 'warning', PENDING_SHIP: 'info', SHIPPED: 'primary', PENDING_RECEIVE: 'primary',
  COMPLETED: 'success', CANCELLED: 'info', REFUNDING: 'danger', REFUNDED: 'danger',
}[status] || 'info')
</script>

<style scoped>
.order-detail-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.card-head h2 { margin: 0 0 4px; font-size: 18px; }
.card-head p { margin: 0; color: #84938a; font-size: 12px; }
.amount { color: #c54b4b; font-size: 22px; font-weight: 700; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.descs { display: grid; grid-template-columns: 90px 1fr; gap: 10px 12px; margin: 0; font-size: 13px; }
.descs dt { color: #84938a; }
.descs dd { margin: 0; color: #173e2a; word-break: break-all; }
.muted { color: #94a198; font-size: 12px; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
</style>