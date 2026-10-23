<template>
  <div class="products-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索商品名称" style="width: 300px" @keyup.enter="loadProducts" />
      <el-select v-model="status" placeholder="审核状态" style="width: 150px" @change="loadProducts">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已拒绝" value="REJECTED" />
      </el-select>
    </div>
    <el-table :data="products" border>
      <el-table-column prop="name" label="商品名称" />
      <el-table-column prop="categoryName" label="分类" />
      <el-table-column prop="supplierName" label="供应商" />
      <el-table-column prop="price" label="价格" />
      <el-table-column prop="stock" label="库存" />
      <el-table-column prop="sales" label="销量" />
      <el-table-column prop="status" label="审核状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="text" @click="goDetail(row.id)">查看</el-button>
          <el-button type="primary" size="small" v-if="row.status === 'PENDING'" @click="audit(row.id)">审核</el-button>
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
    <el-dialog v-model="showAudit" title="商品审核">
      <el-form :model="auditForm" label-width="80px">
        <el-form-item label="审核结果">
          <el-radio-group v-model="auditForm.status">
            <el-radio label="APPROVED">通过</el-radio>
            <el-radio label="REJECTED">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核意见" v-if="auditForm.status === 'REJECTED'">
          <el-input v-model="auditForm.opinion" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAudit = false">取消</el-button>
        <el-button type="primary" @click="confirmAudit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { platformApi } from '../api'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const showAudit = ref(false)
const currentId = ref(null)

const auditForm = reactive({
  status: 'APPROVED',
  opinion: ''
})

onMounted(() => {
  loadProducts()
})

const loadProducts = async () => {
  const res = await platformApi.getProducts({
    page: page.value,
    size: size.value,
    keyword: keyword.value,
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

const goDetail = (id) => {
  router.push(`/product-detail/${id}`)
}

const audit = (id) => {
  currentId.value = id
  showAudit.value = true
}

const confirmAudit = async () => {
  const res = await platformApi.auditProduct({
    id: currentId.value,
    status: auditForm.status,
    opinion: auditForm.opinion
  })
  if (res.success) {
    alert('审核成功')
    showAudit.value = false
    loadProducts()
  }
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