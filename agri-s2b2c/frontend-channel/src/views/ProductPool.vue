<template>
  <div class="product-pool-page">
    <div class="page-head">
      <div>
        <h2>平台商品池</h2>
        <p>浏览平台审核通过的可选供货商品，支持按名称与分类检索并一键选品上架到渠道货架。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="products"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-channel:product-pool"
      empty-text="暂无可选商品"
      @page-change="handlePageChange"
      @refresh="loadProducts"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>商品名称</label>
            <el-input v-model="keyword" placeholder="搜索商品" clearable @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>分类</label>
            <el-select v-model="categoryId" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="String(cat.id)" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-commissionRate="{ row }">{{ row.commissionRate }}%</template>
      <template #cell-regionNames="{ row }">
        <span v-if="!row.regionNames?.length" class="muted">全国</span>
        <span v-else>{{ row.regionNames.join('、') }}</span>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'select', label: '选品上架', onClick: () => selectProduct(row.id) }]" />
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'
import { currentChannelId } from '../api/channelSession'

const keyword = ref('')
const categoryId = ref('')
const products = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'name', prop: 'name', label: '商品名称', minWidth: 180 },
  { key: 'categoryName', prop: 'categoryName', label: '分类', width: 110 },
  { key: 'supplierName', prop: 'supplierName', label: '供应商', minWidth: 140 },
  { key: 'price', prop: 'price', label: '供货价', width: 105 },
  { key: 'commissionRate', prop: 'commissionRate', label: '佣金比例', width: 105 },
  { key: 'sales', prop: 'sales', label: '销量', width: 90 },
  { key: 'stock', prop: 'stock', label: '库存', width: 90 },
  { key: 'regionNames', label: '限售区域', minWidth: 150 },
  { key: 'actions', label: '操作', width: 110 },
]

const categories = ref([
  { id: 7, name: '大米' },
  { id: 8, name: '面粉' },
  { id: 9, name: '食用油' },
  { id: 11, name: '时令蔬菜' },
  { id: 12, name: '新鲜水果' },
  { id: 14, name: '猪肉' },
  { id: 16, name: '鲜蛋' },
  { id: 17, name: '绿茶' },
  { id: 18, name: '红茶' },
])

onMounted(() => loadProducts())

const loadProducts = async () => {
  loading.value = true
  try {
    const res = await channelApi.getProductPool({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      categoryId: categoryId.value ? Number(categoryId.value) : null,
    })
    products.value = res.records || []
    total.value = Number(res.total || 0)
  } finally {
    loading.value = false
  }
}

const search = () => {
  page.value = 1
  loadProducts()
}

const reset = () => {
  keyword.value = ''
  categoryId.value = ''
  page.value = 1
  loadProducts()
}

const handlePageChange = (nextPage, nextSize) => {
  page.value = nextPage
  size.value = nextSize
  loadProducts()
}

const selectProduct = async (productId) => {
  const channelId = await currentChannelId()
  if (!channelId) {
    ElMessage.warning('当前账号还没有渠道档案，请先提交渠道入驻申请')
    return
  }
  const res = await channelApi.selectProduct({ channelId, productId })
  if (res?.success) {
    ElMessage.success('选品成功')
  } else if (res?.message) {
    ElMessage.error(res.message)
  }
}
</script>

<style scoped>
.product-pool-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.muted { color: #84938a; font-size: 12px; }
</style>
