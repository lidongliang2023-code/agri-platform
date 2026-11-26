<template>
  <div class="products-page">
    <div class="page-head">
      <div>
        <h2>货源商品维护</h2>
        <p>维护当前货源档案下的供货商品、审核状态及渠道选品授权关系。</p>
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
      column-settings-storage-key="agri-s2b2c-platform:supply-products"
      empty-text="暂无供货商品"
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
            <label>状态</label>
            <el-select v-model="status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已拒绝" value="REJECTED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="goAdd">发布商品</el-button>
      </template>

      <template #cell-status="{ row }">
        <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="rowActions(row)" />
      </template>
    </AgriElementListTable>

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
        <el-table-column label="操作" width="120" align="right" fixed="right">
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
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { supplierApi } from '../api'
import { currentSupplierId } from '../api/supplierSession'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const products = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const showAuthorizations = ref(false)
const authorizations = ref([])
const currentProductId = ref(null)
const currentProductName = ref('')
const revokingId = ref(null)

const columns = [
  { key: 'name', prop: 'name', label: '商品名称', minWidth: 180 },
  { key: 'categoryName', prop: 'categoryName', label: '分类', width: 120 },
  { key: 'price', prop: 'price', label: '价格', width: 105 },
  { key: 'stock', prop: 'stock', label: '库存', width: 90 },
  { key: 'sales', prop: 'sales', label: '销量', width: 90 },
  { key: 'status', prop: 'status', label: '状态', width: 105 },
  { key: 'createTime', prop: 'createTime', label: '创建时间', width: 175 },
  { key: 'actions', label: '操作', width: 155 },
]

function rowActions(row) {
  const list = [{ key: 'edit', label: '编辑', onClick: () => goEdit(row.id) }]
  if (row.status === 'REJECTED') {
    list.push({ key: 'resubmit', label: '重新提交', onClick: () => resubmit(row) })
  }
  list.push({ key: 'auth', label: '渠道授权', onClick: () => openAuthorizations(row) })
  return list
}

onMounted(() => loadProducts())

const openAuthorizations = async (row) => {
  currentProductId.value = row.id
  currentProductName.value = row.name
  showAuthorizations.value = true
  await loadAuthorizations()
}

const loadAuthorizations = async () => {
  if (!currentProductId.value) return
  try {
    authorizations.value = (await supplierApi.getChannelAuthorizations(currentProductId.value)) || []
  } catch (e) {
    authorizations.value = []
    ElMessage.error(e?.message || '渠道授权读取失败')
  }
}

const revoke = async (row) => {
  if (!confirm(`确定撤销「${row.channelName || '该渠道'}」对本商品的选品授权吗？`)) return
  revokingId.value = row.id
  try {
    const res = await supplierApi.revokeChannelAuthorization(row.id)
    if (res && res.success === false) {
      ElMessage.error(res.message || '撤销失败')
      return
    }
    await loadAuthorizations()
  } catch (e) {
    ElMessage.error(e?.message || '撤销失败')
  } finally {
    revokingId.value = null
  }
}

const loadProducts = async () => {
  loading.value = true
  try {
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
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
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
  status.value = ''
  page.value = 1
  loadProducts()
}

const handlePageChange = (nextPage, nextSize) => {
  page.value = nextPage
  size.value = nextSize
  loadProducts()
}

const getStatusType = (value) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[value] || 'info')
const getStatusText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' }[value] || value)

const goAdd = () => router.push('/supply/product-add')

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

const goEdit = (id) => router.push(`/supply/product-edit/${id}`)
</script>

<style scoped>
.products-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.dialog-hint { margin: 0 0 12px; color: #6b7c72; font-size: 13px; line-height: 1.6; }
</style>
