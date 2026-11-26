<template>
  <div class="products-page">
    <div class="page-head">
      <div>
        <h2>商品审核</h2>
        <p>只做 S2B2C 分销准入审核：待审核商品可通过或拒绝（拒绝必填原因）；审核动作留痕，商品主数据不改。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="products"
      row-key="id"
      :loading="loading"
      :row-selectable="(row) => row.status === 'PENDING'"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:products-audit"
      empty-text="当前筛选下没有商品"
      @selection-change="selection = $event"
      @page-change="handlePageChange"
      @refresh="loadProducts"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>商品名称</label>
            <el-input v-model="keyword" placeholder="搜索商品名称" clearable @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
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
        <el-button type="primary" :disabled="!selection.length" @click="openBatch">批量通过（{{ selection.length }}）</el-button>
      </template>

      <template #cell-price="{ row }">¥{{ money(row.price) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="rowActions(row)" />
      </template>
    </AgriElementListTable>

    <el-dialog v-model="showAudit" title="商品审核" width="520px">
      <el-form label-width="90px">
        <el-form-item label="商品"><span>{{ auditForm.name }}</span></el-form-item>
        <el-form-item label="审核结果">
          <el-radio-group v-model="auditForm.status">
            <el-radio value="APPROVED">通过</el-radio>
            <el-radio value="REJECTED">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审核意见" :required="auditForm.status === 'REJECTED'">
          <el-input
            v-model="auditForm.opinion"
            type="textarea"
            :rows="3"
            :placeholder="auditForm.status === 'REJECTED' ? '拒绝必须填写原因' : '选填'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAudit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmAudit">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showBatch" title="批量通过商品" width="520px">
      <p class="muted">将批量通过 {{ selection.length }} 个待审核商品；已审核商品会被自动跳过。</p>
      <el-form label-width="90px">
        <el-form-item label="审核意见"><el-input v-model="batchOpinion" placeholder="选填" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatch = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmBatch">确认通过</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="showLogs" title="审核记录" size="480px">
      <el-table :data="logs" border size="small">
        <el-table-column label="动作" width="100">
          <template #default="{ row }">
            <el-tag :type="row.action === 'APPROVED' ? 'success' : 'danger'">{{ row.action === 'APPROVED' ? '通过' : '拒绝' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="opinion" label="意见" min-width="160" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="createTime" label="时间" width="180" />
      </el-table>
      <el-empty v-if="!logs.length" description="暂无审核记录" :image-size="70" />
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const router = useRouter()
const keyword = ref('')
const status = ref('')
const products = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const selection = ref([])
const showAudit = ref(false)
const showBatch = ref(false)
const showLogs = ref(false)
const saving = ref(false)
const logs = ref([])
const batchOpinion = ref('')
const auditForm = reactive({ id: '', name: '', status: 'APPROVED', opinion: '' })

const columns = [
  { key: 'name', prop: 'name', label: '商品名称', minWidth: 200 },
  { key: 'categoryName', prop: 'categoryName', label: '分类', width: 120 },
  { key: 'supplierName', prop: 'supplierName', label: '供应商', minWidth: 150 },
  { key: 'price', prop: 'price', label: '供货价', width: 110 },
  { key: 'stock', prop: 'stock', label: '库存', width: 90 },
  { key: 'sales', prop: 'sales', label: '销量', width: 90 },
  { key: 'status', prop: 'status', label: '审核状态', width: 110 },
  { key: 'auditTime', prop: 'auditTime', label: '审核时间', width: 180 },
  { key: 'actions', label: '操作', width: 150 },
]

function rowActions(row) {
  const list = []
  if (row.status === 'PENDING') {
    list.push({ key: 'audit', label: '审核', onClick: () => openAudit(row) })
  }
  list.push({ key: 'logs', label: '审核记录', onClick: () => openLogs(row) })
  list.push({ key: 'detail', label: '查看', onClick: () => router.push(`/product-detail/${row.id}`) })
  return list
}

onMounted(loadProducts)

async function loadProducts() {
  loading.value = true
  try {
    const res = await platformApi.getProducts({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      status: status.value || undefined,
    })
    products.value = res.records || []
    total.value = Number(res.total || 0)
  } catch (e) {
    products.value = []
    total.value = 0
    ElMessage.error(e?.message || '商品列表读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  loadProducts()
}

function reset() {
  keyword.value = ''
  status.value = ''
  page.value = 1
  loadProducts()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  loadProducts()
}

function openAudit(row) {
  auditForm.id = row.id
  auditForm.name = row.name
  auditForm.status = 'APPROVED'
  auditForm.opinion = ''
  showAudit.value = true
}

async function confirmAudit() {
  if (auditForm.status === 'REJECTED' && !auditForm.opinion.trim()) {
    ElMessage.warning('拒绝商品必须填写原因')
    return
  }
  saving.value = true
  try {
    const res = await platformApi.auditProduct({ id: auditForm.id, status: auditForm.status, opinion: auditForm.opinion })
    if (res?.success === false) return ElMessage.error(res.message || '审核失败')
    ElMessage.success(res?.message || '审核成功')
    showAudit.value = false
    await loadProducts()
  } catch (e) {
    ElMessage.error(e?.message || '审核失败')
  } finally {
    saving.value = false
  }
}

function openBatch() {
  batchOpinion.value = ''
  showBatch.value = true
}

async function confirmBatch() {
  saving.value = true
  try {
    const res = await platformApi.batchAuditProducts({
      ids: selection.value.map((row) => row.id),
      status: 'APPROVED',
      opinion: batchOpinion.value,
    })
    if (res?.success === false) return ElMessage.error(res.message || '批量审核失败')
    ElMessage.success(res?.message || '批量审核完成')
    showBatch.value = false
    await loadProducts()
  } catch (e) {
    ElMessage.error(e?.message || '批量审核失败')
  } finally {
    saving.value = false
  }
}

async function openLogs(row) {
  try {
    logs.value = (await platformApi.getProductAuditLogs(row.id)) || []
    showLogs.value = true
  } catch (e) {
    ElMessage.error(e?.message || '审核记录读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const getStatusType = (value) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[value] || 'info')
const getStatusText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' }[value] || value)
</script>

<style scoped>
.products-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.muted { color: #84938a; font-size: 12px; }
</style>
