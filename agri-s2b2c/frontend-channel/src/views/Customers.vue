<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <h2>客户列表</h2>
        <p>在本渠道店铺下过单的客户资产；客户来源与账号实名由用户中心主责，本页只做渠道内消费聚合与分层。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>客户总数</span><b>{{ summary.total || 0 }}</b><small>有过支付订单</small></div>
      <div class="stat-card"><span>复购客户</span><b>{{ summary.repeat || 0 }}</b><small>下单 ≥ 2 次</small></div>
      <div class="stat-card"><span>高价值客户</span><b>{{ summary.highValue || 0 }}</b><small>累计 ≥ ¥500 或 ≥ 5 单</small></div>
      <div class="stat-card"><span>沉睡客户</span><b>{{ summary.sleeping || 0 }}</b><small>30 天未下单</small></div>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索昵称 / 手机号" style="width: 240px" clearable @keyup.enter="search" @clear="search" />
      <el-select v-model="layer" placeholder="客户分层" style="width: 150px" @change="search">
        <el-option label="全部" value="" />
        <el-option label="新客" value="NEW" />
        <el-option label="活跃客" value="ACTIVE" />
        <el-option label="高价值" value="HIGH_VALUE" />
        <el-option label="沉睡客" value="SLEEPING" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table :data="rows" border>
      <el-table-column label="客户" min-width="180">
        <template #default="{ row }">
          <b>{{ row.name }}</b><br><small>{{ row.phone }}</small>
        </template>
      </el-table-column>
      <el-table-column label="分层" width="110">
        <template #default="{ row }">
          <el-tag :type="layerType(row.layer)">{{ layerText(row.layer) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderCount" label="下单次数" width="100" />
      <el-table-column label="累计消费" width="120">
        <template #default="{ row }">¥{{ money(row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column label="客单价" width="110">
        <template #default="{ row }">¥{{ money(row.avgAmount) }}</template>
      </el-table-column>
      <el-table-column prop="lastOrderTime" label="最近下单" width="180" />
      <el-table-column prop="memberLevel" label="会员等级" width="110" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="$router.push(`/customers/${row.consumerId}`)">画像</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length" description="当前筛选条件下没有客户" />
    <el-pagination
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
      @current-change="load"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const route = useRoute()
const keyword = ref('')
const layer = ref(String(route.query.layer || ''))
const rows = ref([])
const summary = ref({})
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(load)

async function load() {
  try {
    const data = await channelApi.getCustomers({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      layer: layer.value || undefined,
    })
    rows.value = data.records || []
    total.value = data.total || 0
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '客户列表读取失败')
  }
}

function search() {
  page.value = 1
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
const layerText = (value) => ({ NEW: '新客', ACTIVE: '活跃客', HIGH_VALUE: '高价值', SLEEPING: '沉睡客' }[value] || value)
const layerType = (value) => ({ NEW: 'info', ACTIVE: 'primary', HIGH_VALUE: 'success', SLEEPING: 'warning' }[value] || 'info')
</script>

<style scoped>
.customers-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
