<template>
  <div class="monitor-page">
    <div class="page-head">
      <div>
        <h2>活动监控</h2>
        <p>按活动查看核销/售罄/成团与关联订单；券按 coupon_user_id、秒杀新订单按 flash_sale_id 精确归因，历史秒杀订单回退时间窗近似。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="优惠券" name="COUPON">
        <el-table :data="data.coupons || []" border>
          <el-table-column prop="name" label="优惠券" min-width="180" />
          <el-table-column label="发放/核销" width="140">
            <template #default="{ row }">{{ row.received || 0 }} / {{ row.used || 0 }}</template>
          </el-table-column>
          <el-table-column label="有效期" min-width="180">
            <template #default="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }"><el-button link type="primary" @click="openMonitor('COUPON', row)">监控</el-button></template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.coupons || []).length" description="暂无优惠券" :image-size="70" />
      </el-tab-pane>

      <el-tab-pane label="秒杀" name="FLASH">
        <el-table :data="data.flashes || []" border>
          <el-table-column prop="productName" label="商品" min-width="190" />
          <el-table-column label="秒杀价" width="100"><template #default="{ row }">¥{{ money(row.salePrice) }}</template></el-table-column>
          <el-table-column label="已售/库存" width="130">
            <template #default="{ row }">{{ row.totalStock - row.remainStock }} / {{ row.totalStock }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }"><el-button link type="primary" @click="openMonitor('FLASH', row)">监控</el-button></template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.flashes || []).length" description="暂无秒杀活动" :image-size="70" />
      </el-tab-pane>

      <el-tab-pane label="拼团" name="GROUP">
        <el-table :data="data.groups || []" border>
          <el-table-column prop="name" label="活动" min-width="170" />
          <el-table-column prop="productName" label="商品" min-width="180" />
          <el-table-column label="拼团价" width="110"><template #default="{ row }">¥{{ money(row.groupPrice) }}</template></el-table-column>
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }"><el-button link type="primary" @click="openMonitor('GROUP', row)">监控</el-button></template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.groups || []).length" description="暂无拼团活动" :image-size="70" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px">
      <template v-if="monitor">
        <div class="metrics">
          <div v-for="(value, key) in monitor.metrics || {}" :key="key" class="metric">
            <span>{{ metricLabel(key) }}</span>
            <b>{{ metricValue(key, value) }}</b>
          </div>
        </div>
        <p class="attribution">费用承担方：{{ bearerText(monitor.activity?.costBearer) }} · 归因口径：{{ monitor.attribution }}</p>
        <h4>关联订单（最近 10 单）</h4>
        <el-table :data="monitor.recentOrders || []" border size="small">
          <el-table-column prop="orderNo" label="订单号" min-width="190" />
          <el-table-column label="实付" width="110">
            <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }">{{ row.status }}</template></el-table-column>
          <el-table-column prop="createTime" label="下单时间" width="180" />
        </el-table>
        <el-empty v-if="!(monitor.recentOrders || []).length" description="暂无关联订单" :image-size="60" />
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const tab = ref('COUPON')
const data = ref({})
const dialogVisible = ref(false)
const dialogTitle = ref('活动监控')
const monitor = ref(null)

onMounted(load)

async function load() {
  try {
    data.value = (await platformApi.getActivities()) || {}
  } catch (e) {
    ElMessage.error(e?.message || '活动数据读取失败')
  }
}

async function openMonitor(type, row) {
  try {
    monitor.value = await platformApi.getActivityMonitor(type, row.id)
    dialogTitle.value = row.name || row.productName || row.name || '活动监控'
    dialogVisible.value = true
  } catch (e) {
    ElMessage.error(e?.message || '监控数据读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const metricLabel = (key) => ({
  received: '领取数', used: '核销数', usageRate: '核销率(%)', gmv: '关联 GMV',
  discountAmount: '券优惠金额', budget: '活动预算', budgetUsed: '预算已用', budgetRemain: '预算剩余',
  sold: '已售件数', totalStock: '活动库存', remainStock: '剩余库存', sellThrough: '售罄率(%)',
  orderCount: '关联订单', instances: '成团数', participants: '参团人数',
}[key] || key)
const metricValue = (key, value) => {
  if (key === 'gmv' || key === 'discountAmount') return `¥${money(value)}`
  if (key === 'budget' || key === 'budgetUsed' || key === 'budgetRemain') {
    return value == null ? '不限' : `¥${money(value)}`
  }
  if (key === 'usageRate' || key === 'sellThrough') return `${Number(value || 0).toFixed(1)}%`
  return value
}
const bearerText = (value) => ({ PLATFORM: '平台', SUPPLIER: '供应商', CHANNEL: '渠道' }[value] || value || '平台')
</script>

<style scoped>
.monitor-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 12px; }
.metric { padding: 12px 14px; border-radius: 10px; background: #f6faf7; }
.metric span { display: block; color: #84938a; font-size: 12px; }
.metric b { display: block; margin-top: 4px; color: #173e2a; font-size: 18px; }
.attribution { margin: 0 0 12px; color: #a96a08; font-size: 12px; line-height: 1.6; }
h4 { margin: 0 0 8px; font-size: 14px; }
</style>
