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
          <el-button type="text" v-if="row.status === 'REJECTED'" @click="resubmit(row)">重新提交</el-button>
          <el-button type="text" @click="openAuthorizations(row)">渠道授权</el-button>
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

    <el-dialog v-model="showAuthorizations" title="渠道授权" width="680px">
      <p class="dialog-hint">{{ currentProductName }}：以下渠道选中了该商品。撤销后渠道选品列表立即移除，已产生的订单不受影响。</p>
      <el-table :data="authorizations" border>
        <el-table-column prop="channelName" label="渠道" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === 'ACTIVE' ? '生效中' : '已撤销' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pickedAt" label="选品时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'ACTIVE'"
              type="danger"
              size="small"
              :loading="revokingId === row.id"
              @click="revoke(row)"
            >撤销授权</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!authorizations.length" description="还没有渠道选中该商品" />
      <template #footer>
        <el-button @click="showAuthorizations = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supplierApi } from '../api'
import { ElMessage } from 'element-plus'
import { currentSupplierId } from '../api/supplierSession'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const showAuthorizations = ref(false)
const authorizations = ref([])
const currentProductId = ref(null)
const currentProductName = ref('')
const revokingId = ref(null)

onMounted(() => {
  loadProducts()
})

const openAuthorizations = async (row) => {
  currentProductId.value = row.id
  currentProductName.value = row.name
  showAuthorizations.value = true
  await loadAuthorizations()
}

const loadAuthorizations = async () => {
  if (!currentProductId.value) return
  try {
    authorizations.value = await supplierApi.getChannelAuthorizations(currentProductId.value) || []
  } catch (e) {
    authorizations.value = []
    alert(e?.message || '渠道授权读取失败')
  }
}

const revoke = async (row) => {
  if (!confirm(`确定撤销「${row.channelName || '该渠道'}」对本商品的选品授权吗？`)) return
  revokingId.value = row.id
  try {
    const res = await supplierApi.revokeChannelAuthorization(row.id)
    if (res && res.success === false) {
      alert(res.message || '撤销失败')
      return
    }
    await loadAuthorizations()
  } catch (e) {
    alert(e?.message || '撤销失败')
  } finally {
    revokingId.value = null
  }
}

const loadProducts = async () => {
  const supplierId = await currentSupplierId()
  if (!supplierId) {
    products.value = []
    total.value = 0
    return
  }
  const res = await supplierApi.getProducts({
    supplierId,
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
  router.push('/supply/product-add')
}

const resubmit = async (row) => {
  try {
    const res = await supplierApi.resubmitProduct(row.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '重新提交失败')
      return
    }
    ElMessage.success('已重新提交审核')
    await loadProducts()
  } catch (e) {
    ElMessage.error(e?.message || '重新提交失败')
  }
}

const goEdit = (id) => {
  router.push(`/supply/product-edit/${id}`)
}
</script>

<style scoped>
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }

.dialog-hint {
  margin: 0 0 12px;
  color: #6b7c72;
  font-size: 13px;
  line-height: 1.6;
}

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