<template>
  <div class="supply-pool-page">
    <div class="page-head">
      <div>
        <h2>可投放货源</h2>
        <p>已审核通过、可被渠道选品的商品；渠道在平台商品池中选择后形成授权关系，可在“我的分销池”查看。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredRows"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:supply-pool"
      empty-text="暂无已审核商品，先新增并等待审核"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>商品名称</label>
            <el-input v-model="draftKeyword" placeholder="搜索商品名称或类目" clearable @keyup.enter="applyFilter" />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="$router.push('/supply/product-add')">新增商品</el-button>
      </template>

      <template #cell-price="{ row }">¥{{ money(row.price) }}</template>
      <template #cell-commissionRate="{ row }">{{ Number(row.commissionRate || 0) }}%</template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'edit', label: '编辑', onClick: () => $router.push(`/supply/product-edit/${row.id}`) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { supplierApi } from '../api'
import { currentSupplierId } from '../api/supplierSession'

const rows = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const draftKeyword = ref('')
const activeKeyword = ref('')

const columns = [
  { key: 'name', prop: 'name', label: '商品', minWidth: 200 },
  { key: 'categoryName', prop: 'categoryName', label: '类目', width: 110 },
  { key: 'price', prop: 'price', label: '供货价', width: 110 },
  { key: 'stock', prop: 'stock', label: '库存', width: 90 },
  { key: 'sales', prop: 'sales', label: '销量', width: 90 },
  { key: 'commissionRate', prop: 'commissionRate', label: '佣金率', width: 90 },
  { key: 'actions', label: '操作', width: 100 },
]

const filteredRows = computed(() => {
  const kw = activeKeyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((row) => `${row.name || ''} ${row.categoryName || ''}`.toLowerCase().includes(kw))
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const supplierId = await currentSupplierId()
    if (!supplierId) {
      rows.value = []
      total.value = 0
      return
    }
    const res = await supplierApi.getProducts({ supplierId, page: page.value, size: size.value, status: 'APPROVED' })
    rows.value = res.records || []
    total.value = Number(res.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '货源读取失败')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  activeKeyword.value = draftKeyword.value
}

function resetFilter() {
  draftKeyword.value = ''
  activeKeyword.value = ''
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.supply-pool-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
