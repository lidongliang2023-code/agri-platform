<template>
  <div class="products-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索商品" style="width: 300px" @keyup.enter="loadProducts" />
      <el-select v-model="status" placeholder="状态" style="width: 150px" @change="loadProducts">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已拒绝" value="REJECTED" />
      </el-select>
      <el-button type="primary" @click="goAdd">发布商品</el-button>
    </div>
    <el-table :data="products" border>
      <el-table-column prop="name" label="商品名称" />
      <el-table-column prop="categoryName" label="分类" />
      <el-table-column prop="price" label="价格" />
      <el-table-column prop="stock" label="库存" />
      <el-table-column prop="sales" label="销量" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="text" @click="goEdit(row.id)">编辑</el-button>
          <el-button type="text" v-if="row.status === 'REJECTED'" @click="goEdit(row.id)">重新提交</el-button>
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
import { useRouter } from 'vue-router'
import { supplierApi } from '../api'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)

onMounted(() => {
  loadProducts()
})

const loadProducts = async () => {
  const res = await supplierApi.getProducts({
    supplierId: 1,
    page: page.value,
    size: size.value,
    status: status.value
  })
  products.value = res.records || []
  total.value = res.total || 0
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadProducts()
}

const getStatusType = (status) => {
  const types = { 'PENDING': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { 'PENDING': '待审核', 'APPROVED': '已通过', 'REJECTED': '已拒绝' }
  return texts[status] || status
}

const goAdd = () => {
  router.push('/product-add')
}

const goEdit = (id) => {
  router.push(`/product-edit/${id}`)
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