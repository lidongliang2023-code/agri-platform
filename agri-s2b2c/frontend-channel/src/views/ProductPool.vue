<template>
  <div class="product-pool-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索商品" style="width: 300px" @keyup.enter="loadProducts" />
      <el-select v-model="categoryId" placeholder="分类" style="width: 150px" @change="loadProducts">
        <el-option label="全部" :value="null" />
        <el-option v-for="cat in categories" :key="cat.id" :label="cat.name" :value="cat.id" />
      </el-select>
    </div>
    <el-table :data="products" border>
      <el-table-column prop="name" label="商品名称" />
      <el-table-column prop="categoryName" label="分类" />
      <el-table-column prop="supplierName" label="供应商" />
      <el-table-column prop="price" label="供货价" />
      <el-table-column prop="commissionRate" label="佣金比例">
        <template #default="{ row }">
          {{ row.commissionRate }}%
        </template>
      </el-table-column>
      <el-table-column prop="sales" label="销量" />
      <el-table-column prop="stock" label="库存" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="selectProduct(row.id)">选品上架</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      @current-change="handlePageChange"
      :current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { channelApi } from '../api'

const keyword = ref('')
const categoryId = ref(null)
const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

const categories = ref([
  { id: 7, name: '大米' },
  { id: 8, name: '面粉' },
  { id: 9, name: '食用油' },
  { id: 11, name: '时令蔬菜' },
  { id: 12, name: '新鲜水果' },
  { id: 14, name: '猪肉' },
  { id: 16, name: '鲜蛋' },
  { id: 17, name: '绿茶' },
  { id: 18, name: '红茶' }
])

onMounted(() => {
  loadProducts()
})

const loadProducts = async () => {
  const res = await channelApi.getProductPool({
    page: page.value,
    size: size.value,
    keyword: keyword.value,
    categoryId: categoryId.value
  })
  products.value = res.records || []
  total.value = res.total || 0
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadProducts()
}

const selectProduct = async (productId) => {
  const res = await channelApi.selectProduct({
    channelId: 1,
    productId: productId
  })
  if (res.success) {
    alert('选品成功')
  }
}
</script>

<style scoped>
.product-pool-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.search-bar {
  display: flex;
  gap: 15px;
  align-items: center;
}
</style>