<template>
  <div class="customer-detail-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2>客户画像</h2>
        <p>本渠道内的消费汇总，仅用于店铺经营；客户账号、实名与跨渠道数据由用户中心主责。</p>
      </div>
      <el-button @click="$router.push('/customers')">返回列表</el-button>
    </div>

    <template v-if="profile">
      <div class="profile-card">
        <div class="avatar">{{ (profile.name || '客').slice(0, 1) }}</div>
        <div class="profile-main">
          <h3>{{ profile.name || '微信用户' }} <el-tag size="small" type="success">{{ profile.memberLevel || '普通会员' }}</el-tag></h3>
          <p>{{ profile.phone }} · 客户 ID {{ profile.consumerId }}</p>
        </div>
        <div class="profile-metrics">
          <div><span>下单次数</span><b>{{ profile.orderCount }}</b></div>
          <div><span>累计消费</span><b>¥{{ money(profile.totalAmount) }}</b></div>
          <div><span>客单价</span><b>¥{{ money(profile.avgAmount) }}</b></div>
          <div><span>最近下单</span><b>{{ profile.lastOrderTime || '—' }}</b></div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>常购商品</h3>
          <el-table :data="topProducts" border size="small">
            <el-table-column prop="name" label="商品" min-width="200" />
            <el-table-column prop="qty" label="累计件数" width="110" />
            <el-table-column label="累计金额" width="120">
              <template #default="{ row }">¥{{ money(row.amount) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!topProducts.length" description="暂无商品偏好数据" :image-size="60" />
        </div>
        <div class="card">
          <h3>最近订单</h3>
          <el-table :data="orders" border size="small">
            <el-table-column prop="orderNo" label="订单号" min-width="180" />
            <el-table-column label="金额" width="100">
              <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ row }">
                <el-button link type="primary" @click="$router.push(`/orders/${row.id}`)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!orders.length" description="暂无订单" :image-size="60" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const route = useRoute()
const loading = ref(true)
const profile = ref(null)
const orders = ref([])
const topProducts = ref([])

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await channelApi.getCustomerDetail(route.params.id)
    profile.value = data.profile || null
    orders.value = data.orders || []
    topProducts.value = data.topProducts || []
  } catch (e) {
    ElMessage.error(e?.message || '客户画像读取失败')
  } finally {
    loading.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.customer-detail-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.profile-card { display: flex; align-items: center; gap: 18px; padding: 20px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; flex-wrap: wrap; }
.avatar { display: grid; width: 56px; height: 56px; place-items: center; border-radius: 50%; background: #e5f5eb; color: #12764a; font-size: 24px; font-weight: 700; }
.profile-main h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 17px; }
.profile-main p { margin: 0; color: #84938a; font-size: 12px; }
.profile-metrics { display: flex; gap: 28px; margin-left: auto; flex-wrap: wrap; }
.profile-metrics span { display: block; color: #84938a; font-size: 12px; }
.profile-metrics b { color: #173e2a; font-size: 16px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
</style>
