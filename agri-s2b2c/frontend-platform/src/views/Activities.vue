<template>
  <div class="activities-page">
    <div class="page-head">
      <div>
        <h2>活动列表</h2>
        <p>平台活动来自优惠券、秒杀与拼团三类数据；预算按活动原子扣减，费用承担方仅做记录，不自动生成结算单。</p>
      </div>
      <div class="head-actions">
        <el-button :loading="syncing" @click="syncStatus">同步活动状态</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>进行中优惠券</span><b>{{ summary.couponActive || 0 }}</b><small>累计领取 {{ summary.couponReceived || 0 }}</small></div>
      <div class="stat-card"><span>优惠券核销</span><b>{{ summary.couponUsed || 0 }}</b><small>核销/领取见券页</small></div>
      <div class="stat-card"><span>进行中秒杀</span><b>{{ summary.flashActive || 0 }}</b><small>按活动状态统计</small></div>
      <div class="stat-card"><span>进行中拼团</span><b>{{ summary.groupActive || 0 }}</b><small>成团数据未单独建模</small></div>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane label="优惠券" name="coupon">
        <el-table :data="data.coupons || []" border>
          <el-table-column prop="name" label="优惠券" min-width="180" />
          <el-table-column label="类型/门槛" min-width="160">
            <template #default="{ row }">
              {{ couponType(row) }} · 满 ¥{{ money(row.minAmount) }} 可用
            </template>
          </el-table-column>
          <el-table-column label="发放/核销" width="140">
            <template #default="{ row }">{{ row.received || 0 }} / {{ row.used || 0 }}</template>
          </el-table-column>
          <el-table-column label="预算/已用" width="170">
            <template #default="{ row }">
              <span v-if="row.budget == null" class="muted">不限</span>
              <span v-else>
                ¥{{ money(row.budgetUsed) }} / ¥{{ money(row.budget) }}
                <el-tag v-if="Number(row.budgetUsed) >= Number(row.budget)" size="small" type="danger">用完</el-tag>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="承担方" width="100">
            <template #default="{ row }">{{ bearerText(row.costBearer) }}</template>
          </el-table-column>
          <el-table-column label="有效期" min-width="180">
            <template #default="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '进行中' : row.status }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="changeCoupon(row, 'ENDED')">结束</el-button>
              <el-button v-else-if="row.status === 'ENDED'" link type="success" @click="changeCoupon(row, 'ACTIVE')">启用</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.coupons || []).length" description="暂无优惠券" :image-size="70" />
      </el-tab-pane>

      <el-tab-pane label="秒杀" name="flash">
        <el-table :data="data.flashes || []" border>
          <el-table-column prop="productName" label="商品" min-width="190" />
          <el-table-column label="秒杀价 / 原价" width="160">
            <template #default="{ row }">¥{{ money(row.salePrice) }} / ¥{{ money(row.originalPrice) }}</template>
          </el-table-column>
          <el-table-column label="库存" width="130">
            <template #default="{ row }">{{ row.totalStock - row.remainStock }} / {{ row.totalStock }}</template>
          </el-table-column>
          <el-table-column label="预算/已用" width="170">
            <template #default="{ row }">
              <span v-if="row.budget == null" class="muted">不限</span>
              <span v-else>
                ¥{{ money(row.budgetUsed) }} / ¥{{ money(row.budget) }}
                <el-tag v-if="Number(row.budgetUsed) >= Number(row.budget)" size="small" type="danger">用完</el-tag>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="承担方" width="100">
            <template #default="{ row }">{{ bearerText(row.costBearer) }}</template>
          </el-table-column>
          <el-table-column label="开始" width="180"><template #default="{ row }">{{ row.startTime }}</template></el-table-column>
          <el-table-column label="结束" width="180"><template #default="{ row }">{{ row.endTime }}</template></el-table-column>
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="changeFlash(row, 'ENDED')">结束</el-button>
              <el-button v-else-if="row.status === 'ENDED'" link type="success" @click="changeFlash(row, 'ACTIVE')">启用</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.flashes || []).length" description="暂无秒杀活动" :image-size="70" />
      </el-tab-pane>

      <el-tab-pane label="拼团" name="group">
        <el-table :data="data.groups || []" border>
          <el-table-column prop="name" label="活动" min-width="170" />
          <el-table-column prop="productName" label="商品" min-width="180" />
          <el-table-column label="拼团价 / 单买" width="160">
            <template #default="{ row }">¥{{ money(row.groupPrice) }} / ¥{{ money(row.singlePrice) }}</template>
          </el-table-column>
          <el-table-column prop="groupSize" label="成团人数" width="100" />
          <el-table-column prop="validHours" label="有效期(小时)" width="110" />
          <el-table-column label="预算/已用" width="170">
            <template #default="{ row }">
              <span v-if="row.budget == null" class="muted">不限</span>
              <span v-else>
                ¥{{ money(row.budgetUsed) }} / ¥{{ money(row.budget) }}
                <el-tag v-if="Number(row.budgetUsed) >= Number(row.budget)" size="small" type="danger">用完</el-tag>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="承担方" width="100">
            <template #default="{ row }">{{ bearerText(row.costBearer) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="changeGroup(row, 'ENDED')">结束</el-button>
              <el-button v-else-if="row.status === 'ENDED'" link type="success" @click="changeGroup(row, 'ACTIVE')">启用</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!(data.groups || []).length" description="暂无拼团活动" :image-size="70" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { platformApi } from '../api'

const tab = ref('coupon')
const data = ref({})
const summary = ref({})
const syncing = ref(false)

onMounted(load)

async function load() {
  try {
    data.value = (await platformApi.getActivities()) || {}
    summary.value = data.value.summary || {}
  } catch (e) {
    ElMessage.error(e?.message || '活动数据读取失败')
  }
}

async function syncStatus() {
  syncing.value = true
  try {
    const res = await platformApi.syncMarketingStatus()
    if (res?.success === false) return ElMessage.error(res.message || '同步失败')
    ElMessage.success(res?.message || '活动状态已同步')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

async function confirmAction(label) {
  try {
    await ElMessageBox.confirm(`确认${label}该活动？`, '活动状态', { confirmButtonText: '确认', cancelButtonText: '取消' })
    return true
  } catch {
    return false
  }
}

async function changeCoupon(row, status) {
  if (!(await confirmAction(status === 'ENDED' ? '结束' : '启用'))) return
  const res = await platformApi.updateCouponStatus(row.id, status)
  if (res?.success === false) return ElMessage.error(res.message || '操作失败')
  ElMessage.success('状态已更新')
  await load()
}

async function changeFlash(row, status) {
  if (!(await confirmAction(status === 'ENDED' ? '结束' : '启用'))) return
  const res = await platformApi.updateFlashStatus(row.id, status)
  if (res?.success === false) return ElMessage.error(res.message || '操作失败')
  ElMessage.success('状态已更新')
  await load()
}

async function changeGroup(row, status) {
  if (!(await confirmAction(status === 'ENDED' ? '结束' : '启用'))) return
  const res = await platformApi.updateGroupStatus(row.id, status)
  if (res?.success === false) return ElMessage.error(res.message || '操作失败')
  ElMessage.success('状态已更新')
  await load()
}

const money = (value) => Number(value || 0).toFixed(2)
const bearerText = (value) => ({ PLATFORM: '平台', SUPPLIER: '供应商', CHANNEL: '渠道' }[value] || value || '平台')
const couponType = (row) => {
  if (row.type === 'DISCOUNT') return `折扣 ${Number(row.discountRate || 0)} 折`
  return `满减 ¥${money(row.amount)}`
}
</script>

<style scoped>
.activities-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 800px; }
.head-actions { display: flex; gap: 8px; flex-shrink: 0; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.muted { color: #94a198; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
