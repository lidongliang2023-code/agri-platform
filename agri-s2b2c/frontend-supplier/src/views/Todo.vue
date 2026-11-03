<template>
  <div class="todo-page">
    <div class="page-head">
      <div>
        <h2>待办与预警</h2>
        <p>基于真实商品、订单与库存数据；处理动作跳转到对应页面，不在此处直接改状态。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card" @click="$router.push('/products')">
        <span>待审核商品</span><b>{{ kpi.pendingProducts || 0 }}</b><small>去我的分销池查看</small>
      </div>
      <div class="stat-card" @click="$router.push('/orders')">
        <span>待发货订单</span><b>{{ kpi.pendingShip || 0 }}</b><small>48 小时内发货</small>
      </div>
      <div class="stat-card" @click="$router.push('/products')">
        <span>低库存商品</span><b>{{ kpi.lowStock || 0 }}</b><small>库存 &lt; 10</small>
      </div>
      <div class="stat-card" @click="$router.push('/distributors')">
        <span>合作渠道</span><b>{{ kpi.channels || 0 }}</b><small>有授权关系</small>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>待审核商品</h3><el-button link type="primary" @click="$router.push('/products')">全部</el-button></div>
        <el-table :data="pendingProducts" border size="small">
          <el-table-column prop="name" label="商品" min-width="180" />
          <el-table-column label="供货价" width="100"><template #default="{ row }">¥{{ money(row.price) }}</template></el-table-column>
          <el-table-column prop="createTime" label="提交时间" width="180" />
        </el-table>
        <el-empty v-if="!pendingProducts.length" description="没有待审核商品" :image-size="60" />
      </div>
      <div class="card">
        <div class="card-head"><h3>待发货订单</h3><el-button link type="primary" @click="$router.push('/orders')">全部</el-button></div>
        <el-table :data="pendingOrders" border size="small">
          <el-table-column prop="orderNo" label="订单号" min-width="180" />
          <el-table-column label="实付" width="100"><template #default="{ row }">¥{{ money(row.payAmount) }}</template></el-table-column>
          <el-table-column prop="payTime" label="支付时间" width="180" />
        </el-table>
        <el-empty v-if="!pendingOrders.length" description="没有待发货订单" :image-size="60" />
      </div>
    </div>

    <div class="card">
      <h3>预警说明</h3>
      <ul>
        <li>低库存按商品库存 &lt; 10 计算；补货与集采报名在 S2B2C 渠道端/交易撮合处理，本端只提示。</li>
        <li>待审核商品由平台运营审核；驳回后需修改并重新提交（当前重新提审流程未接入）。</li>
        <li>待发货订单超时会影响平台履约指标，请及时在订单页回传物流。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'
import { currentSupplierId } from '../api/supplierSession'

const kpi = ref({})
const pendingProducts = ref([])
const pendingOrders = ref([])

onMounted(load)

async function load() {
  try {
    const supplierId = await currentSupplierId()
    const [overview, products, orders] = await Promise.all([
      supplierApi.getOverview(7),
      supplierApi.getProducts({ supplierId, page: 1, size: 5, status: 'PENDING' }),
      supplierApi.getOrders({ page: 1, size: 5, status: 'PENDING_SHIP' }),
    ])
    kpi.value = overview?.kpi || {}
    pendingProducts.value = products?.records || []
    pendingOrders.value = orders?.records || []
  } catch (e) {
    ElMessage.error(e?.message || '待办数据读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.todo-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; cursor: pointer; }
.stat-card:hover { border-color: #b9dfc9; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.card-head h3 { margin: 0; }
.card ul { margin: 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
@media (max-width: 1000px) { .stat-row, .grid { grid-template-columns: 1fr 1fr; } }
</style>
