<template>
  <div class="inventory-page">
    <div class="page-head">
      <div>
        <h2>库存管理</h2>
        <p>本渠道在架商品的供货侧库存与渠道内 7 日动销；门店现货与安全库存未建模，补货/集采归交易撮合。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>在架 SKU</span><b>{{ summary.skuCount || 0 }}</b><small>渠道货架在售</small></div>
      <div class="stat-card"><span>总库存</span><b>{{ summary.totalStock || 0 }}</b><small>供货侧件数</small></div>
      <div class="stat-card"><span>库存预警</span><b>{{ summary.lowCount || 0 }}</b><small>可售天数 &lt; 7 天</small></div>
      <div class="stat-card"><span>缺货</span><b>{{ summary.outCount || 0 }}</b><small>库存 ≤ 0</small></div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredRows"
      :row-key="(row) => String(row.id ?? row.productId ?? row.name)"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-channel:inventory"
      empty-text="货架暂无在架商品"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>商品名称</label>
            <el-input v-model="draft.keyword" placeholder="搜索商品名称" clearable @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>库存状态</label>
            <el-select v-model="draft.status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="正常" value="NORMAL" />
              <el-option label="预警" value="LOW" />
              <el-option label="缺货" value="OUT" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-effectivePrice="{ row }">¥{{ money(row.effectivePrice) }}</template>
      <template #cell-shelfStatus="{ row }">
        <el-tag :type="row.shelfStatus === 'OFF' ? 'info' : 'success'">{{ row.shelfStatus === 'OFF' ? '已下架' : '在售' }}</el-tag>
      </template>
      <template #cell-stock="{ row }">{{ row.stock }}{{ row.unit || '' }}</template>
      <template #cell-daysOfSupply="{ row }">{{ row.daysOfSupply == null ? '—' : row.daysOfSupply }}</template>
      <template #cell-stockStatus="{ row }">
        <el-tag :type="statusType(row.stockStatus)">{{ statusText(row.stockStatus) }}</el-tag>
      </template>
      <template #cell-actions>
        <AgriVueRowActions :actions="[{ key: 'shelf', label: '去货架', onClick: () => $router.push('/products') }]" />
      </template>
    </AgriElementListTable>

    <div class="card">
      <h3>说明</h3>
      <ul>
        <li>库存为供货侧共享库存，渠道不压货；下单时按共享库存扣减。</li>
        <li>库存预警按“库存 ÷ 近 7 日日均销量 &lt; 7 天”计算，仅作运营提示。</li>
        <li>集采补货与门店现货未接入，本页不提供补货写入。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'

const rows = ref([])
const summary = ref({})
const loading = ref(false)
const draft = reactive({ keyword: '', status: '' })
const activeFilter = reactive({ keyword: '', status: '' })

const columns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 200 },
  { key: 'effectivePrice', prop: 'effectivePrice', label: '零售价', width: 110 },
  { key: 'shelfStatus', prop: 'shelfStatus', label: '货架', width: 100 },
  { key: 'stock', prop: 'stock', label: '库存', width: 95 },
  { key: 'sales7', prop: 'sales7', label: '本渠道 7 日销量', width: 135 },
  { key: 'daysOfSupply', prop: 'daysOfSupply', label: '可售天数', width: 100 },
  { key: 'stockStatus', prop: 'stockStatus', label: '状态', width: 110 },
  { key: 'actions', label: '操作', width: 100 },
]

const filteredRows = computed(() => {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (activeFilter.status && row.stockStatus !== activeFilter.status) return false
    if (kw && !String(row.name || '').toLowerCase().includes(kw)) return false
    return true
  })
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = (await channelApi.getInventory()) || {}
    rows.value = data.records || []
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '库存数据读取失败')
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
const statusText = (value) => ({ NORMAL: '正常', LOW: '预警', OUT: '缺货' }[value] || value)
const statusType = (value) => ({ NORMAL: 'success', LOW: 'warning', OUT: 'danger' }[value] || 'info')
</script>

<style scoped>
.inventory-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.card ul { margin: 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
