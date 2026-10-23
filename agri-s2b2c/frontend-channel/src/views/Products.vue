<template>
  <div class="products-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索商品" style="width: 300px" @keyup.enter="loadProducts" />
    </div>
    <el-table :data="products" border>
      <el-table-column prop="name" label="商品名称" />
      <el-table-column prop="categoryName" label="分类" />
      <el-table-column prop="price" label="售价" />
      <el-table-column prop="commissionRate" label="佣金比例">
        <template #default="{ row }">
          {{ row.commissionRate }}%
        </template>
      </el-table-column>
      <el-table-column prop="sales" label="销量" />
      <el-table-column prop="stock" label="库存" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="上架时间" />
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
const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(() => {
  loadProducts()
})

const loadProducts = async () => {
  const res = await channelApi.getProducts({
    channelId: 1,
    page: page.value,
    size: size.value
  })
  products.value = res.records || []
  total.value = res.total || 0
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadProducts()
}

const getStatusType = (status) => {
  const types = { 'APPROVED': 'success', 'PENDING': 'warning', 'REJECTED': 'danger' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { 'APPROVED': '已上架', 'PENDING': '待审核', 'REJECTED': '已拒绝' }
  return texts[status] || status
}
</script>

<style scoped>
.products-page {
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