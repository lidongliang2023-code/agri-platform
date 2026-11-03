<template>
  <div class="products-page">
    <div class="page-head">
      <div>
        <h2>商品审核</h2>
        <p>只做 S2B2C 分销准入审核：待审核商品可通过或拒绝（拒绝必填原因）；审核动作留痕，商品主数据不改。</p>
      </div>
      <div class="head-actions">
        <el-button :disabled="!selection.length" @click="openBatch">批量通过（{{ selection.length }}）</el-button>
        <el-button @click="loadProducts">刷新</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索商品名称" style="width: 280px" clearable @keyup.enter="search" @clear="search" />
      <el-select v-model="status" placeholder="审核状态" style="width: 150px" @change="search">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已拒绝" value="REJECTED" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table :data="products" border @selection-change="selection = $event">
      <el-table-column type="selection" width="46" :selectable="(row) => row.status === 'PENDING'" />
      <el-table-column prop="name" label="商品名称" min-width="200" />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column prop="supplierName" label="供应商" min-width="150" />
      <el-table-column label="供货价" width="110">
        <template #default="{ row }">¥{{ money(row.price) }}</template>
      </el-table-column>
      <el-table-column prop="stock" label="库存" width="90" />
      <el-table-column prop="sales" label="销量" width="90" />
      <el-table-column label="审核状态" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="auditTime" label="审核时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'PENDING'" link type="primary" @click="openAudit(row)">审核</el-button>
          <el-button link type="primary" @click="openLogs(row)">审核记录</el-button>
          <el-button link type="primary" @click="$router.push(`/product-detail/${row.id}`)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!products.length" description="当前筛选下没有商品" />
    <el-pagination
      v-model:current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
      @current-change="loadProducts"
    />

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
          <el-input v-model="auditForm.opinion" type="textarea" :rows="3"
            :placeholder="auditForm.status === 'REJECTED' ? '拒绝必须填写原因' : '选填'" />
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
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const keyword = ref('')
const status = ref('')
const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const selection = ref([])
const showAudit = ref(false)
const showBatch = ref(false)
const showLogs = ref(false)
const saving = ref(false)
const logs = ref([])
const batchOpinion = ref('')
const auditForm = reactive({ id: '', name: '', status: 'APPROVED', opinion: '' })

onMounted(loadProducts)

async function loadProducts() {
  try {
    const res = await platformApi.getProducts({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      status: status.value || undefined,
    })
    products.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    products.value = []
    total.value = 0
    ElMessage.error(e?.message || '商品列表读取失败')
  }
}

function search() {
  page.value = 1
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
.head-actions { display: flex; gap: 8px; }
.filter-bar { display: flex; gap: 10px; align-items: center; }
.muted { color: #84938a; font-size: 12px; }
</style>
