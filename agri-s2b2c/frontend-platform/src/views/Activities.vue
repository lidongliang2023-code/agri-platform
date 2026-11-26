<template>
  <div class="activities-page">
    <div class="page-head">
      <div>
        <h2>活动列表</h2>
        <p>平台活动来自优惠券、秒杀与拼团三类数据；预算按活动原子扣减，费用承担方仅做记录，不自动生成结算单。</p>
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
        <AgriElementListTable
          :columns="couponColumns"
          :data="filteredCoupons"
          row-key="id"
          :loading="loading"
          client-pagination
          column-settings-storage-key="agri-s2b2c-platform:activities-coupons"
          empty-text="暂无优惠券"
          @refresh="load"
        >
          <template #filter>
            <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
              <div class="agri-vue-filter-field">
                <label>关键字</label>
                <el-input v-model="draft.keyword" placeholder="搜索优惠券名称" clearable @keyup.enter="applyFilter" />
              </div>
              <div class="agri-vue-filter-field">
                <label>状态</label>
                <el-select v-model="draft.status" placeholder="全部">
                  <el-option label="全部" value="" />
                  <el-option label="进行中" value="ACTIVE" />
                  <el-option label="未开始" value="PENDING" />
                  <el-option label="已结束" value="ENDED" />
                </el-select>
              </div>
            </AgriVueFilterBar>
          </template>
          <template #toolbar-left>
            <el-button type="primary" :loading="syncing" @click="syncStatus">同步活动状态</el-button>
          </template>
          <template #cell-type="{ row }">{{ couponType(row) }} · 满 ¥{{ money(row.minAmount) }} 可用</template>
          <template #cell-issue="{ row }">{{ row.received || 0 }} / {{ row.used || 0 }}</template>
          <template #cell-budget="{ row }">
            <span v-if="row.budget == null" class="muted">不限</span>
            <span v-else>
              ¥{{ money(row.budgetUsed) }} / ¥{{ money(row.budget) }}
              <el-tag v-if="Number(row.budgetUsed) >= Number(row.budget)" size="small" type="danger">用完</el-tag>
            </span>
          </template>
          <template #cell-costBearer="{ row }">{{ bearerText(row.costBearer) }}</template>
          <template #cell-valid="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
          <template #cell-status="{ row }">
            <el-tag :type="activityStatusType(row.status)">{{ activityStatusText(row.status) }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <AgriVueRowActions :actions="activityRowActions(row, changeCoupon)" />
          </template>
        </AgriElementListTable>
      </el-tab-pane>

      <el-tab-pane label="秒杀" name="flash">
        <AgriElementListTable
          :columns="flashColumns"
          :data="filteredFlashes"
          row-key="id"
          :loading="loading"
          client-pagination
          column-settings-storage-key="agri-s2b2c-platform:activities-flashes"
          empty-text="暂无秒杀活动"
          @refresh="load"
        >
          <template #filter>
            <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
              <div class="agri-vue-filter-field">
                <label>商品名称</label>
                <el-input v-model="draft.keyword" placeholder="搜索秒杀商品" clearable @keyup.enter="applyFilter" />
              </div>
              <div class="agri-vue-filter-field">
                <label>状态</label>
                <el-select v-model="draft.status" placeholder="全部">
                  <el-option label="全部" value="" />
                  <el-option label="进行中" value="ACTIVE" />
                  <el-option label="未开始" value="PENDING" />
                  <el-option label="已结束" value="ENDED" />
                </el-select>
              </div>
            </AgriVueFilterBar>
          </template>
          <template #toolbar-left>
            <el-button type="primary" :loading="syncing" @click="syncStatus">同步活动状态</el-button>
          </template>
          <template #cell-price="{ row }">¥{{ money(row.salePrice) }} / ¥{{ money(row.originalPrice) }}</template>
          <template #cell-stock="{ row }">{{ row.totalStock - row.remainStock }} / {{ row.totalStock }}</template>
          <template #cell-budget="{ row }">
            <span v-if="row.budget == null" class="muted">不限</span>
            <span v-else>
              ¥{{ money(row.budgetUsed) }} / ¥{{ money(row.budget) }}
              <el-tag v-if="Number(row.budgetUsed) >= Number(row.budget)" size="small" type="danger">用完</el-tag>
            </span>
          </template>
          <template #cell-costBearer="{ row }">{{ bearerText(row.costBearer) }}</template>
          <template #cell-status="{ row }">
            <el-tag :type="activityStatusType(row.status)">{{ activityStatusText(row.status) }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <AgriVueRowActions :actions="activityRowActions(row, changeFlash)" />
          </template>
        </AgriElementListTable>
      </el-tab-pane>

      <el-tab-pane label="拼团" name="group">
        <AgriElementListTable
          :columns="groupColumns"
          :data="filteredGroups"
          row-key="id"
          :loading="loading"
          client-pagination
          column-settings-storage-key="agri-s2b2c-platform:activities-groups"
          empty-text="暂无拼团活动"
          @refresh="load"
        >
          <template #filter>
            <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
              <div class="agri-vue-filter-field">
                <label>关键字</label>
                <el-input v-model="draft.keyword" placeholder="搜索活动或商品名称" clearable @keyup.enter="applyFilter" />
              </div>
              <div class="agri-vue-filter-field">
                <label>状态</label>
                <el-select v-model="draft.status" placeholder="全部">
                  <el-option label="全部" value="" />
                  <el-option label="进行中" value="ACTIVE" />
                  <el-option label="未开始" value="PENDING" />
                  <el-option label="已结束" value="ENDED" />
                </el-select>
              </div>
            </AgriVueFilterBar>
          </template>
          <template #toolbar-left>
            <el-button type="primary" :loading="syncing" @click="syncStatus">同步活动状态</el-button>
          </template>
          <template #cell-price="{ row }">¥{{ money(row.groupPrice) }} / ¥{{ money(row.singlePrice) }}</template>
          <template #cell-budget="{ row }">
            <span v-if="row.budget == null" class="muted">不限</span>
            <span v-else>
              ¥{{ money(row.budgetUsed) }} / ¥{{ money(row.budget) }}
              <el-tag v-if="Number(row.budgetUsed) >= Number(row.budget)" size="small" type="danger">用完</el-tag>
            </span>
          </template>
          <template #cell-costBearer="{ row }">{{ bearerText(row.costBearer) }}</template>
          <template #cell-status="{ row }">
            <el-tag :type="activityStatusType(row.status)">{{ activityStatusText(row.status) }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <AgriVueRowActions :actions="activityRowActions(row, changeGroup)" />
          </template>
        </AgriElementListTable>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const tab = ref('coupon')
const data = ref({})
const summary = ref({})
const loading = ref(false)
const syncing = ref(false)
const draft = reactive({ keyword: '', status: '' })
const activeFilter = reactive({ keyword: '', status: '' })

const couponColumns = [
  { key: 'name', prop: 'name', label: '优惠券', minWidth: 180 },
  { key: 'type', label: '类型/门槛', minWidth: 160 },
  { key: 'issue', label: '发放/核销', width: 130 },
  { key: 'budget', label: '预算/已用', width: 170 },
  { key: 'costBearer', prop: 'costBearer', label: '承担方', width: 100 },
  { key: 'valid', label: '有效期', minWidth: 180 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

const flashColumns = [
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 190 },
  { key: 'price', label: '秒杀价 / 原价', width: 160 },
  { key: 'stock', label: '库存', width: 120 },
  { key: 'budget', label: '预算/已用', width: 170 },
  { key: 'costBearer', prop: 'costBearer', label: '承担方', width: 100 },
  { key: 'startTime', prop: 'startTime', label: '开始', width: 175 },
  { key: 'endTime', prop: 'endTime', label: '结束', width: 175 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

const groupColumns = [
  { key: 'name', prop: 'name', label: '活动', minWidth: 170 },
  { key: 'productName', prop: 'productName', label: '商品', minWidth: 180 },
  { key: 'price', label: '拼团价 / 单买', width: 160 },
  { key: 'groupSize', prop: 'groupSize', label: '成团人数', width: 100 },
  { key: 'validHours', prop: 'validHours', label: '有效期(小时)', width: 110 },
  { key: 'budget', label: '预算/已用', width: 170 },
  { key: 'costBearer', prop: 'costBearer', label: '承担方', width: 100 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100 },
]

function filterRows(list, fieldGetter) {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return (list || []).filter((row) => {
    if (activeFilter.status && row.status !== activeFilter.status) return false
    if (kw && !fieldGetter(row).toLowerCase().includes(kw)) return false
    return true
  })
}

const filteredCoupons = computed(() => filterRows(data.value.coupons, (row) => String(row.name || '')))
const filteredFlashes = computed(() => filterRows(data.value.flashes, (row) => String(row.productName || '')))
const filteredGroups = computed(() => filterRows(data.value.groups, (row) => `${row.name || ''} ${row.productName || ''}`))

function activityRowActions(row, handler) {
  if (row.status === 'ACTIVE') return [{ key: 'end', label: '结束', danger: true, onClick: () => handler(row, 'ENDED') }]
  if (row.status === 'ENDED') return [{ key: 'enable', label: '启用', onClick: () => handler(row, 'ACTIVE') }]
  return []
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    data.value = (await platformApi.getActivities()) || {}
    summary.value = data.value.summary || {}
  } catch (e) {
    ElMessage.error(e?.message || '活动数据读取失败')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  activeFilter.keyword = draft.keyword
  activeFilter.status = draft.status
}

function resetFilter() {
  draft.keyword = ''
  draft.status = ''
  activeFilter.keyword = ''
  activeFilter.status = ''
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
const activityStatusText = (value) => ({
  ACTIVE: '进行中', PENDING: '未开始', NOT_STARTED: '未开始', ENDED: '已结束',
  EXPIRED: '已过期', DISABLED: '已停用', DRAFT: '草稿',
}[value] || value || '—')
const activityStatusType = (value) => ({
  ACTIVE: 'success', PENDING: 'warning', NOT_STARTED: 'warning',
  ENDED: 'info', EXPIRED: 'info', DISABLED: 'info',
}[value] || 'info')
const couponType = (row) => (row.type === 'DISCOUNT' ? `折扣 ${Number(row.discountRate || 0)} 折` : `满减 ¥${money(row.amount)}`)
</script>

<style scoped>
.activities-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 800px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.muted { color: #94a198; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
