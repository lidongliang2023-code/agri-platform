<template>
  <div class="order-detail-page">
    <el-button @click="goBack">返回</el-button>
    <div class="order-info" v-if="order">
      <h2>订单详情</h2>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(order.status)">{{ getStatusText(order.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="订单金额">{{ order.totalAmount }}</el-descriptions-item>
        <el-descriptions-item label="实付金额">{{ order.payAmount }}</el-descriptions-item>
        <el-descriptions-item label="运费">{{ order.freightAmount }}</el-descriptions-item>
        <el-descriptions-item label="优惠">{{ order.discountAmount }}</el-descriptions-item>
        <el-descriptions-item label="支付方式">{{ order.payMethod || '-' }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ order.payTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="物流单号">{{ order.logisticsNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="物流公司">{{ order.logisticsCompany || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ order.createTime }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ order.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="items-section">
        <h3>商品清单</h3>
        <el-table :data="items" border>
          <el-table-column prop="name" label="商品名称" />
          <el-table-column prop="spec" label="规格" />
          <el-table-column prop="price" label="单价" />
          <el-table-column prop="quantity" label="数量" />
          <el-table-column prop="totalAmount" label="小计" />
        </el-table>
      </div>
      <div class="actions-section" v-if="order.status === 'PENDING_SHIP'">
        <el-button type="primary" @click="shipOrder">确认发货</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { platformApi } from '../api'

const router = useRouter()
const route = useRoute()
const order = ref(null)
const items = ref([])

onMounted(() => {
  loadOrder()
})

const loadOrder = async () => {
  const res = await platformApi.getOrderDetail(route.params.id)
  order.value = res
}

const getStatusType = (status) => {
  const types = { 'PENDING_PAY': 'warning', 'PENDING_SHIP': 'info', 'SHIPPED': 'primary', 'COMPLETED': 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { 'PENDING_PAY': '待付款', 'PENDING_SHIP': '待发货', 'SHIPPED': '已发货', 'COMPLETED': '已完成' }
  return texts[status] || status
}

const goBack = () => {
  router.push('/orders')
}

const shipOrder = () => {
  alert('发货功能开发中')
}
</script>

<style scoped>
.order-detail-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.items-section {
  margin-top: 30px;
}

.actions-section {
  margin-top: 30px;
}
</style>