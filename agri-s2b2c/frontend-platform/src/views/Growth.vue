<template>
  <section class="growth-page">
    <header class="head"><div><small>GROWTH · RISK · SETTLEMENT</small><h1>增长与风控</h1><p>营销活动、订单履约、售后审核和渠道佣金结算闭环。</p></div><el-button @click="load">刷新数据</el-button></header>
    <div class="metrics">
      <article><span>待发货订单</span><b>{{ data.pendingShipOrders?.length || 0 }}</b></article>
      <article><span>待审售后</span><b>{{ pendingAfterSales }}</b></article>
      <article><span>佣金笔数</span><b>{{ data.commissionSummary?.count || 0 }}</b></article>
      <article><span>佣金金额</span><b>{{ money(data.commissionSummary?.amount) }}</b></article>
    </div>
    <div class="grid">
      <section class="card"><header><h2>待发货订单</h2><span>支付后进入履约</span></header>
        <div v-for="order in data.pendingShipOrders || []" :key="order.id" class="row"><div><b>{{ order.orderNo }}</b><small>消费者 {{ order.consumerId }} · {{ money(order.payAmount) }}</small></div><el-button type="primary" size="small" @click="ship(order)">发货</el-button></div>
        <el-empty v-if="!(data.pendingShipOrders || []).length" description="暂无待发货订单" />
      </section>
      <section class="card"><header><h2>促销活动</h2><span>秒杀与社区拼团</span></header>
        <div v-for="item in data.marketing?.flashSales || []" :key="`f${item.id}`" class="row"><div><b>{{ item.productName }}</b><small>秒杀价 {{ money(item.salePrice) }}</small></div><el-tag type="danger">秒杀</el-tag></div>
        <div v-for="item in data.marketing?.groupBuys || []" :key="`g${item.id}`" class="row"><div><b>{{ item.name }}</b><small>{{ item.groupSize }} 人团 {{ money(item.groupPrice) }}</small></div><el-tag type="success">拼团</el-tag></div>
      </section>
    </div>
    <section class="card"><header><h2>售后审核</h2><span>退款和售后工单</span></header>
      <div v-for="item in data.afterSales || []" :key="item.id" class="row"><div><b>订单 {{ item.orderId }} · {{ afterSaleTypeText(item.type) }}</b><small>{{ item.reason }} · {{ money(item.amount) }}</small></div><el-tag :type="afterSaleStatusType(item.status)">{{ afterSaleStatusText(item.status) }}</el-tag><div v-if="item.status==='PENDING'"><el-button size="small" type="danger" plain @click="review(item,'REJECTED')">驳回</el-button><el-button size="small" type="primary" @click="review(item,'APPROVED')">通过</el-button></div></div>
      <el-empty v-if="!(data.afterSales || []).length" description="暂无售后" />
    </section>

    <AgriElementListTable
      :columns="commissionColumns"
      :data="data.commissions || []"
      :row-key="(row) => String(row.id ?? `${row.orderId}-${row.channelId}`)"
      :loading="loading"
      client-pagination
      :page-size="10"
      column-settings-storage-key="agri-s2b2c-platform:growth-commissions"
      empty-text="暂无佣金结算记录"
      @refresh="load"
    >
      <template #toolbar-left>
        <div class="section-title"><h2>佣金结算</h2><span>渠道分润统一结算</span></div>
        <el-button type="primary" size="small" @click="settle">结算待处理佣金</el-button>
      </template>
      <template #cell-amount="{ row }">{{ money(row.amount) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="commissionStatusType(row.status)" size="small">{{ commissionStatusText(row.status) }}</el-tag>
      </template>
    </AgriElementListTable>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const data = ref({})
const loading = ref(false)
const pendingAfterSales = computed(() => (data.value.afterSales || []).filter((item) => item.status === 'PENDING').length)

const commissionColumns = [
  { key: 'orderId', prop: 'orderId', label: '订单', minWidth: 160 },
  { key: 'channelId', prop: 'channelId', label: '商家', minWidth: 150 },
  { key: 'rate', prop: 'rate', label: '比例', width: 100 },
  { key: 'amount', prop: 'amount', label: '佣金', width: 120 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
]

const money = (value) => `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
const afterSaleTypeText = (value) => ({ REFUND_ONLY: '仅退款', RETURN_REFUND: '退货退款', EXCHANGE: '换货', REFUND: '退款' }[value] || value || '售后')
const afterSaleStatusText = (value) => ({ PENDING: '待审核', APPROVED: '已同意', RETURNING: '退货中', COMPLETED: '已完成', REJECTED: '已驳回', CANCELLED: '已取消' }[value] || value || '—')
const afterSaleStatusType = (value) => ({ PENDING: 'warning', APPROVED: 'success', RETURNING: 'primary', COMPLETED: 'success', REJECTED: 'danger', CANCELLED: 'info' }[value] || 'info')
const commissionStatusText = (value) => ({ PENDING: '待结算', SETTLED: '已结算', CANCELLED: '已取消' }[value] || value || '—')
const commissionStatusType = (value) => ({ PENDING: 'warning', SETTLED: 'success', CANCELLED: 'info' }[value] || 'info')

async function load() {
  loading.value = true
  try {
    data.value = (await platformApi.getGrowth()) || {}
  } finally {
    loading.value = false
  }
}

async function review(item, status) {
  await platformApi.reviewAfterSale(item.id, status, status === 'APPROVED' ? '平台审核通过' : '材料不足，已驳回')
  ElMessage.success('售后审核已更新')
  load()
}

async function ship(order) {
  const { value } = await ElMessageBox.prompt('请输入物流单号', `订单 ${order.orderNo} 发货`, { confirmButtonText: '确认发货' })
  await platformApi.shipOrder(order.id, value, '丰链云物流')
  ElMessage.success('订单已发货')
  load()
}

async function settle() {
  const result = await platformApi.settleCommissions()
  ElMessage.success(`已结算 ${result.settled} 笔佣金`)
  load()
}

onMounted(load)
</script>

<style scoped>
.growth-page{display:grid;gap:16px;color:#0b1a12}.head{display:flex;justify-content:space-between;align-items:flex-end;padding:24px;border-radius:18px;background:radial-gradient(circle at 90% 0,rgba(104,222,150,.28),transparent 30%),linear-gradient(135deg,#073821,#2d8f4e);color:#fff}.head small{color:#a7d9b9;letter-spacing:.12em}.head h1{margin:7px 0;font-size:28px}.head p{color:rgba(255,255,255,.66)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics article,.card{padding:18px;border:1px solid #e1e9e3;border-radius:16px;background:#fff}.metrics span{color:#829188;font-size:12px}.metrics b{display:block;margin-top:8px;color:#173e2a;font-size:25px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.card header h2{font-size:17px}.card header span{flex:1;color:#87958d;font-size:12px}.section-title{display:flex;align-items:baseline;gap:8px}.section-title h2{margin:0;font-size:16px;color:#173e2a}.section-title span{color:#87958d;font-size:12px}.row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:12px 0;border-top:1px solid #edf2ee}.row:first-of-type{border-top:0}.row small{display:block;margin-top:4px;color:#87958d;font-size: var(--agri-font-size-micro)}@media(max-width:800px){.metrics,.grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.metrics,.grid{grid-template-columns:1fr}}
</style>
