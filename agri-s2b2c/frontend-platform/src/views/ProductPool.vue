<template>
  <div class="pool-page">
    <div class="page-head">
      <div>
        <h2>总部选品池</h2>
        <p>平台统采统建的商品池（已审核通过）；货源、供货价与类目主数据由交易撮合/主数据主责，本页只做选品视角的只读视图。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:product-pool"
      empty-text="商品池暂无已审核商品"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>商品名称</label>
            <el-input v-model="keyword" placeholder="搜索商品名称" clearable @keyup.enter="search" />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="$router.push('/products')">去商品审核</el-button>
      </template>

      <template #cell-price="{ row }">¥{{ money(row.price) }}</template>
      <template #cell-originalPrice="{ row }">{{ row.originalPrice ? `¥${money(row.originalPrice)}` : '—' }}</template>
      <template #cell-commissionRate="{ row }">{{ Number(row.commissionRate || 0) }}%</template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'detail', label: '详情', onClick: () => $router.push(`/product-detail/${row.id}`) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const keyword = ref('')
const rows = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 200 },
  { key: 'categoryName', prop: 'categoryName', label: '类目', width: 120 },
  { key: 'supplierName', prop: 'supplierName', label: '供应商', minWidth: 150 },
  { key: 'price', prop: 'price', label: '供货价', width: 110 },
  { key: 'originalPrice', prop: 'originalPrice', label: '建议零售价', width: 120 },
  { key: 'stock', prop: 'stock', label: '库存', width: 90 },
  { key: 'sales', prop: 'sales', label: '销量', width: 90 },
  { key: 'commissionRate', prop: 'commissionRate', label: '佣金率', width: 90 },
  { key: 'actions', label: '操作', width: 100 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await platformApi.getProducts({
      page: page.value,
      size: size.value,
      status: 'APPROVED',
      keyword: keyword.value.trim() || undefined,
    })
    rows.value = res.records || []
    total.value = Number(res.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '选品池读取失败')
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
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.pool-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
