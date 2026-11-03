<template>
  <div class="inventory-page">
    <div class="page-head">
      <div>
        <h2>库存管理</h2>
        <p>本渠道在架商品的供货侧库存与渠道内 7 日动销；门店现货与安全库存未建模，补货/集采归交易撮合。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>在架 SKU</span><b>{{ summary.skuCount || 0 }}</b><small>渠道货架 ACTIVE</small></div>
      <div class="stat-card"><span>总库存</span><b>{{ summary.totalStock || 0 }}</b><small>供货侧件数</small></div>
      <div class="stat-card"><span>库存预警</span><b>{{ summary.lowCount || 0 }}</b><small>可售天数 &lt; 7 天</small></div>
      <div class="stat-card"><span>缺货</span><b>{{ summary.outCount || 0 }}</b><small>库存 ≤ 0</small></div>
    </div>

    <el-table :data="rows" border>
      <el-table-column prop="name" label="商品" min-width="200" />
      <el-table-column label="零售价" width="110">
        <template #default="{ row }">¥{{ money(row.effectivePrice) }}</template>
      </el-table-column>
      <el-table-column label="货架" width="100">
        <template #default="{ row }">
          <el-tag :type="row.shelfStatus === 'OFF' ? 'info' : 'success'">{{ row.shelfStatus === 'OFF' ? '已下架' : '在售' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="库存" width="90"><template #default="{ row }">{{ row.stock }}{{ row.unit || '' }}</template></el-table-column>
      <el-table-column prop="sales7" label="本渠道 7 日销量" width="130" />
      <el-table-column label="可售天数" width="100">
        <template #default="{ row }">{{ row.daysOfSupply == null ? '—' : row.daysOfSupply }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusType(row.stockStatus)">{{ statusText(row.stockStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push('/products')">去货架</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="货架暂无在架商品" />
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
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const rows = ref([])
const summary = ref({})

onMounted(load)

async function load() {
  try {
    const data = (await channelApi.getInventory()) || {}
    rows.value = data.records || []
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '库存数据读取失败')
  }
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
