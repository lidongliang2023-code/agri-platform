<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <h2>客户列表</h2>
        <p>在本渠道店铺下过单的客户资产；客户来源与账号实名由用户中心主责，本页只做渠道内消费聚合与分层。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>客户总数</span><b>{{ summary.total || 0 }}</b><small>有过支付订单</small></div>
      <div class="stat-card"><span>复购客户</span><b>{{ summary.repeat || 0 }}</b><small>下单 ≥ 2 次</small></div>
      <div class="stat-card"><span>高价值客户</span><b>{{ summary.highValue || 0 }}</b><small>累计 ≥ ¥500 或 ≥ 5 单</small></div>
      <div class="stat-card"><span>沉睡客户</span><b>{{ summary.sleeping || 0 }}</b><small>30 天未下单</small></div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="consumerId"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-channel:customers"
      empty-text="当前筛选条件下没有客户"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>昵称 / 手机号</label>
            <el-input v-model="keyword" placeholder="搜索昵称 / 手机号" clearable @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>客户分层</label>
            <el-select v-model="layer" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="新客" value="NEW" />
              <el-option label="活跃客" value="ACTIVE" />
              <el-option label="高价值" value="HIGH_VALUE" />
              <el-option label="沉睡客" value="SLEEPING" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-customer="{ row }">
        <b>{{ row.name }}</b><br><small>{{ row.phone }}</small>
      </template>
      <template #cell-layer="{ row }">
        <el-tag :type="layerType(row.layer)">{{ layerText(row.layer) }}</el-tag>
      </template>
      <template #cell-totalAmount="{ row }">¥{{ money(row.totalAmount) }}</template>
      <template #cell-avgAmount="{ row }">¥{{ money(row.avgAmount) }}</template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'profile', label: '画像', onClick: () => $router.push(`/customers/${row.consumerId}`) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'

const route = useRoute()
const keyword = ref('')
const layer = ref(String(route.query.layer || ''))
const rows = ref([])
const summary = ref({})
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'customer', prop: 'name', label: '客户', minWidth: 180 },
  { key: 'layer', prop: 'layer', label: '分层', width: 110 },
  { key: 'orderCount', prop: 'orderCount', label: '下单次数', width: 100 },
  { key: 'totalAmount', prop: 'totalAmount', label: '累计消费', width: 120 },
  { key: 'avgAmount', prop: 'avgAmount', label: '客单价', width: 110 },
  { key: 'lastOrderTime', prop: 'lastOrderTime', label: '最近下单', width: 180 },
  { key: 'memberLevel', prop: 'memberLevel', label: '会员等级', width: 110 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await channelApi.getCustomers({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      layer: layer.value || undefined,
    })
    rows.value = data.records || []
    total.value = Number(data.total || 0)
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '客户列表读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  keyword.value = ''
  layer.value = ''
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
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
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>
