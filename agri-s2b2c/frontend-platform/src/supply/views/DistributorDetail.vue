<template>
  <div class="distributor-detail-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>分销商详情与授权</h2>
        <p v-if="channel">{{ channel.shopName }} · 渠道 ID {{ channel.id }} · {{ channel.region || '区域未填' }}</p>
      </div>
      <el-button @click="$router.push('/supply/distributors')">返回列表</el-button>
    </div>

    <template v-if="channel">
      <div class="stat-row">
        <div class="stat-card"><span>累计订单</span><b>{{ metrics.orders || 0 }}</b><small>非取消订单</small></div>
        <div class="stat-card"><span>累计 GMV</span><b>¥{{ money(metrics.gmv) }}</b><small>渠道成交</small></div>
        <div class="stat-card"><span>在售授权</span><b>{{ activeCount }}</b><small>ACTIVE 关系</small></div>
        <div class="stat-card"><span>已撤销</span><b>{{ revokedCount }}</b><small>REVOKED 关系</small></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>货源商品授权</h3><span class="muted">撤销后渠道不能再下单该商品，历史订单不变</span></div>
        <el-table :data="products" border>
          <el-table-column prop="name" label="商品" min-width="190" />
          <el-table-column label="渠道零售价" width="120">
            <template #default="{ row }">{{ row.retailPrice ? `¥${money(row.retailPrice)}` : '按商品价' }}</template>
          </el-table-column>
          <el-table-column label="货架" width="100">
            <template #default="{ row }">{{ row.shelfStatus === 'OFF' ? '已下架' : '在售' }}</template>
          </el-table-column>
          <el-table-column label="授权状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '有效' : '已撤销' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="pickedAt" label="授权时间" width="180" />
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="revoke(row)">撤销授权</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!products.length" description="该渠道暂无平台货源商品授权" :image-size="60" />
      </div>

      <div class="card">
        <div class="card-head"><h3>最近订单</h3></div>
        <el-table :data="recentOrders" border size="small">
          <el-table-column prop="orderNo" label="订单号" min-width="190" />
          <el-table-column label="实付" width="110"><template #default="{ row }">¥{{ money(row.payAmount) }}</template></el-table-column>
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column prop="createTime" label="下单时间" width="180" />
        </el-table>
        <el-empty v-if="!recentOrders.length" description="暂无订单" :image-size="60" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { supplierApi } from '../api'

const route = useRoute()
const loading = ref(true)
const channel = ref(null)
const products = ref([])
const recentOrders = ref([])
const metrics = ref({})

const activeCount = computed(() => products.value.filter((row) => row.status === 'ACTIVE').length)
const revokedCount = computed(() => products.value.filter((row) => row.status !== 'ACTIVE').length)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await supplierApi.getChannelDetail(route.params.id)
    channel.value = data.channel || null
    products.value = data.products || []
    recentOrders.value = data.recentOrders || []
    metrics.value = data.metrics || {}
  } catch (e) {
    ElMessage.error(e?.message || '分销商详情读取失败')
  } finally {
    loading.value = false
  }
}

async function revoke(row) {
  try {
    await ElMessageBox.confirm(`撤销「${row.name}」在该渠道的授权？撤销后渠道不能再下单该商品。`, '撤销授权', {
      confirmButtonText: '确认撤销', cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    const res = await supplierApi.revokeChannelAuthorization(row.relationId)
    if (res?.success === false) {
      ElMessage.error(res.message || '撤销失败')
      return
    }
    ElMessage.success('已撤销授权')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '撤销失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.distributor-detail-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
