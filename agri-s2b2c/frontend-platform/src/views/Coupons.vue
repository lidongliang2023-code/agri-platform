<template>
  <div class="coupons-page">
    <div class="page-head">
      <div>
        <h2>优惠券管理</h2>
        <p>平台券的发放与核销数据只读展示；创建、预算与风控规则尚未建模，避免显示无法生效的操作。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>进行中券种</span><b>{{ activeCount }}</b><small>状态 ACTIVE</small></div>
      <div class="stat-card"><span>累计领取</span><b>{{ received }}</b><small>按 coupon_user 统计</small></div>
      <div class="stat-card"><span>累计核销</span><b>{{ used }}</b><small>状态 USED</small></div>
      <div class="stat-card"><span>核销率</span><b>{{ rate }}%</b><small>核销 / 领取</small></div>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="name" label="优惠券" min-width="180" />
      <el-table-column label="类型" width="130">
        <template #default="{ row }">{{ row.type === 'DISCOUNT' ? `折扣 ${Number(row.discountRate || 0)} 折` : '满减券' }}</template>
      </el-table-column>
      <el-table-column label="面额/门槛" width="150">
        <template #default="{ row }">¥{{ money(row.amount) }} / 满 ¥{{ money(row.minAmount) }}</template>
      </el-table-column>
      <el-table-column label="发放/剩余" width="130">
        <template #default="{ row }">{{ row.totalCount || 0 }} / {{ row.remainCount || 0 }}</template>
      </el-table-column>
      <el-table-column label="领取/核销" width="130">
        <template #default="{ row }">{{ row.received || 0 }} / {{ row.used || 0 }}</template>
      </el-table-column>
      <el-table-column label="每人限领" width="100"><template #default="{ row }">{{ row.perUserLimit || 1 }} 张</template></el-table-column>
      <el-table-column label="有效期" min-width="180">
        <template #default="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status }}</el-tag></template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="暂无优惠券" :image-size="70" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const rows = ref([])

const activeCount = computed(() => rows.value.filter((row) => row.status === 'ACTIVE').length)
const received = computed(() => rows.value.reduce((sum, row) => sum + Number(row.received || 0), 0))
const used = computed(() => rows.value.reduce((sum, row) => sum + Number(row.used || 0), 0))
const rate = computed(() => received.value === 0 ? '0.0' : ((used.value / received.value) * 100).toFixed(1))

onMounted(load)

async function load() {
  try {
    const data = (await platformApi.getActivities()) || {}
    rows.value = data.coupons || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '优惠券读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.coupons-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
