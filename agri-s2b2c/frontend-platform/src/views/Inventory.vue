<template>
  <div class="inventory-page">
    <div class="page-head">
      <div>
        <h2>库存与云仓</h2>
        <p>当前为商品供货侧库存（s2b2c_product.stock）与真实动销；云仓/门店分仓、安全库存与调拨尚未建模，本页只读，不提供补货写入。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>在售 SKU</span><b>{{ summary.skuCount || 0 }}</b><small>已审核商品</small></div>
      <div class="stat-card"><span>总库存</span><b>{{ summary.totalStock || 0 }}</b><small>供货侧件数</small></div>
      <div class="stat-card"><span>库存货值</span><b>¥{{ money(summary.stockValue) }}</b><small>按供货价估算</small></div>
      <div class="stat-card"><span>低库存 / 缺货</span><b>{{ summary.lowCount || 0 }} / {{ summary.outCount || 0 }}</b><small>可售天数 &lt; 7 天 / 库存 ≤ 0</small></div>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索商品" style="width: 280px" clearable @keyup.enter="load" @clear="load" />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="$router.push('/price-center')">价格与价盘</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="name" label="商品" min-width="200" />
      <el-table-column prop="supplierName" label="供应商" min-width="150" />
      <el-table-column prop="categoryName" label="类目" width="110" />
      <el-table-column label="供货价" width="100">
        <template #default="{ row }">¥{{ money(row.price) }}</template>
      </el-table-column>
      <el-table-column prop="stock" label="库存" width="90" />
      <el-table-column prop="sales7" label="7 日销量" width="100" />
      <el-table-column label="可售天数" width="100">
        <template #default="{ row }">{{ row.daysOfSupply == null ? '—' : row.daysOfSupply }}</template>
      </el-table-column>
      <el-table-column prop="channelListings" label="渠道在售" width="100" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.stockStatus)">{{ statusText(row.stockStatus) }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="没有符合条件的商品" />
    <p class="note">补货与集采归交易撮合；本页不提供库存写入，避免与商品主数据/采购流程冲突。</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const keyword = ref('')
const rows = ref([])
const summary = ref({})

onMounted(load)

async function load() {
  try {
    const data = (await platformApi.getInventory(keyword.value.trim() || undefined)) || {}
    rows.value = data.records || []
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '库存数据读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({ NORMAL: '正常', LOW: '低库存', OUT: '缺货' }[value] || value)
const statusType = (value) => ({ NORMAL: 'success', LOW: 'warning', OUT: 'danger' }[value] || 'info')
</script>

<style scoped>
.inventory-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 23px; }
.stat-card small { color: #94a198; font-size: 12px; }
.filter-bar { display: flex; gap: 10px; align-items: center; }
.note { margin: 0; color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
