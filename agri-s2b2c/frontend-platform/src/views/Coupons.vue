<template>
  <div class="coupons-page">
    <div class="page-head">
      <div>
        <h2>优惠券管理</h2>
        <p>平台券的发放与核销数据只读展示；创建、预算与风控规则尚未建模，避免显示无法生效的操作。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>进行中券种</span><b>{{ activeCount }}</b><small>当前有效可用</small></div>
      <div class="stat-card"><span>累计领取</span><b>{{ received }}</b><small>按领券记录统计</small></div>
      <div class="stat-card"><span>累计核销</span><b>{{ used }}</b><small>订单已核销张数</small></div>
      <div class="stat-card"><span>核销率</span><b>{{ rate }}%</b><small>核销 / 领取</small></div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredRows"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:coupons"
      empty-text="暂无优惠券"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>优惠券名称</label>
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

      <template #cell-type="{ row }">{{ row.type === 'DISCOUNT' ? `折扣 ${Number(row.discountRate || 0)} 折` : '满减券' }}</template>
      <template #cell-amount="{ row }">¥{{ money(row.amount) }} / 满 ¥{{ money(row.minAmount) }}</template>
      <template #cell-supply="{ row }">{{ row.totalCount || 0 }} / {{ row.remainCount || 0 }}</template>
      <template #cell-usage="{ row }">{{ row.received || 0 }} / {{ row.used || 0 }}</template>
      <template #cell-perUserLimit="{ row }">{{ row.perUserLimit || 1 }} 张</template>
      <template #cell-valid="{ row }">{{ row.validStart }} ~ {{ row.validEnd }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const rows = ref([])
const loading = ref(false)
const draft = reactive({ keyword: '', status: '' })
const activeFilter = reactive({ keyword: '', status: '' })

const columns = [
  { key: 'name', prop: 'name', label: '优惠券', minWidth: 180 },
  { key: 'type', label: '类型', width: 130 },
  { key: 'amount', label: '面额/门槛', width: 150 },
  { key: 'supply', label: '发放/剩余', width: 130 },
  { key: 'usage', label: '领取/核销', width: 130 },
  { key: 'perUserLimit', prop: 'perUserLimit', label: '每人限领', width: 100 },
  { key: 'valid', label: '有效期', minWidth: 180 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
]

const filteredRows = computed(() => {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (activeFilter.status && row.status !== activeFilter.status) return false
    if (kw && !String(row.name || '').toLowerCase().includes(kw)) return false
    return true
  })
})

const activeCount = computed(() => rows.value.filter((row) => row.status === 'ACTIVE').length)
const received = computed(() => rows.value.reduce((sum, row) => sum + Number(row.received || 0), 0))
const used = computed(() => rows.value.reduce((sum, row) => sum + Number(row.used || 0), 0))
const rate = computed(() => (received.value === 0 ? '0.0' : ((used.value / received.value) * 100).toFixed(1)))

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = (await platformApi.getActivities()) || {}
    rows.value = data.coupons || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '优惠券读取失败')
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

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  ACTIVE: '进行中', PENDING: '未开始', NOT_STARTED: '未开始',
  ENDED: '已结束', EXPIRED: '已过期', DISABLED: '已停用',
}[value] || value || '—')
const statusType = (value) => ({
  ACTIVE: 'success', PENDING: 'warning', NOT_STARTED: 'warning',
  ENDED: 'info', EXPIRED: 'info', DISABLED: 'info',
}[value] || 'info')
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
