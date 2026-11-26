<template>
  <div class="monitor-page">
    <div class="page-head">
      <div>
        <h2>活动监控</h2>
        <p>按活动查看核销/售罄/成团与关联订单；券按 coupon_user_id、秒杀新订单按 flash_sale_id 精确归因，历史秒杀订单回退时间窗近似。</p>
      </div>
    </div>

    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="优惠券" name="COUPON">
        <AgriElementListTable
          :columns="couponColumns"
          :data="data.coupons || []"
          row-key="id"
          :loading="loading"
          client-pagination
          column-settings-storage-key="agri-s2b2c-platform:activity-monitor-coupon"
          empty-text="暂无优惠券"
          @refresh="load"
        >
          <template #cell-issue="{ row }">{{ row.received || 0 }} / {{ row.used || 0 }}</template>
          <template #cell-valid="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
          <template #cell-status="{ row }">
            <el-tag :type="activityStatusType(row.status)">{{ activityStatusText(row.status) }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <AgriVueRowActions :actions="[{ key: 'monitor', label: '监控', onClick: () => openMonitor('COUPON', row) }]" />
          </template>
        </AgriElementListTable>
      </el-tab-pane>

      <el-tab-pane label="秒杀" name="FLASH">
        <AgriElementListTable
          :columns="flashColumns"
          :data="data.flashes || []"
          row-key="id"
          :loading="loading"
          client-pagination
          column-settings-storage-key="agri-s2b2c-platform:activity-monitor-flash"
          empty-text="暂无秒杀活动"
          @refresh="load"
        >
          <template #cell-salePrice="{ row }">¥{{ money(row.salePrice) }}</template>
          <template #cell-sold="{ row }">{{ row.totalStock - row.remainStock }} / {{ row.totalStock }}</template>
          <template #cell-status="{ row }">
            <el-tag :type="activityStatusType(row.status)">{{ activityStatusText(row.status) }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <AgriVueRowActions :actions="[{ key: 'monitor', label: '监控', onClick: () => openMonitor('FLASH', row) }]" />
          </template>
        </AgriElementListTable>
      </el-tab-pane>

      <el-tab-pane label="拼团" name="GROUP">
        <AgriElementListTable
          :columns="groupColumns"
          :data="data.groups || []"
          row-key="id"
          :loading="loading"
          client-pagination
          column-settings-storage-key="agri-s2b2c-platform:activity-monitor-group"
          empty-text="暂无拼团活动"
          @refresh="load"
        >
          <template #cell-groupPrice="{ row }">¥{{ money(row.groupPrice) }}</template>
          <template #cell-status="{ row }">
            <el-tag :type="activityStatusType(row.status)">{{ activityStatusText(row.status) }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <AgriVueRowActions :actions="[{ key: 'monitor', label: '监控', onClick: () => openMonitor('GROUP', row) }]" />
          </template>
        </AgriElementListTable>
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
          <el-table-column label="状态" width="110"><template #default="{ row }">{{ orderStatusText(row.status) }}</template></el-table-column>
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
import { AgriElementListTable, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const tab = ref('COUPON')
const data = ref({})
const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('活动监控')
const monitor = ref(null)

const couponColumns = [
  { key: 'name', prop: 'name', label: '优惠券', minWidth: 180 },
  { key: 'issue', label: '发放/核销', width: 140 },
  { key: 'valid', label: '有效期', minWidth: 180 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

const flashColumns = [
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 190 },
  { key: 'salePrice', prop: 'salePrice', label: '秒杀价', width: 100 },
  { key: 'sold', label: '已售/库存', width: 130 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

const groupColumns = [
  { key: 'name', prop: 'name', label: '活动', minWidth: 170 },
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 180 },
  { key: 'groupPrice', prop: 'groupPrice', label: '拼团价', width: 110 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    data.value = (await platformApi.getActivities()) || {}
  } catch (e) {
    ElMessage.error(e?.message || '活动数据读取失败')
  } finally {
    loading.value = false
  }
}

async function openMonitor(type, row) {
  try {
    monitor.value = await platformApi.getActivityMonitor(type, row.id)
    dialogTitle.value = row.name || row.productName || '活动监控'
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
const activityStatusText = (value) => ({
  ACTIVE: '进行中', PENDING: '未开始', NOT_STARTED: '未开始', ENDED: '已结束',
  EXPIRED: '已过期', DISABLED: '已停用', DRAFT: '草稿',
}[value] || value || '—')
const activityStatusType = (value) => ({
  ACTIVE: 'success', PENDING: 'warning', NOT_STARTED: 'warning',
  ENDED: 'info', EXPIRED: 'info', DISABLED: 'info',
}[value] || 'info')
const orderStatusText = (value) => ({
  PENDING_PAY: '待付款', PENDING_SHIP: '待发货', SHIPPED: '已发货', PENDING_RECEIVE: '待收货',
  COMPLETED: '已完成', CANCELLED: '已取消', REFUNDING: '退款中', REFUNDED: '已退款',
}[value] || value || '—')
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
