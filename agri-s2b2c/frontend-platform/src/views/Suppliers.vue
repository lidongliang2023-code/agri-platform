<template>
  <div class="suppliers-page">
    <div class="page-head">
      <div>
        <h2>货源档案管理</h2>
        <p>统一管理平台合作货源企业与店铺档案，支持按公司名称与审核状态检索和业务审核。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="suppliers"
      row-key="id"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:suppliers"
      empty-text="暂无符合条件的货源档案"
      @page-change="handlePageChange"
      @refresh="loadSuppliers"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>公司名称</label>
            <el-input v-model="keyword" placeholder="搜索公司名称" clearable @keyup.enter="search" />
          </div>
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
            <el-select v-model="auditStatus" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过" value="APPROVED" />
              <el-option label="已拒绝" value="REJECTED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-status="{ row }">
        <el-tag :type="getStatusType(row.status)">{{ row.status === 'ACTIVE' ? '正常' : '禁用' }}</el-tag>
      </template>
      <template #cell-auditStatus="{ row }">
        <el-tag :type="getAuditType(row.auditStatus)">{{ getAuditText(row.auditStatus) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="rowActions(row)" />
      </template>
    </AgriElementListTable>

    <el-dialog v-model="showAudit" title="供应商审核">
      <el-form :model="auditForm" label-width="80px">
        <el-form-item label="审核结果">
          <el-radio-group v-model="auditForm.status">
            <el-radio label="APPROVED">通过</el-radio>
            <el-radio label="REJECTED">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="auditForm.status === 'REJECTED'" label="审核意见">
          <el-input v-model="auditForm.opinion" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAudit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmAudit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const router = useRouter()
const keyword = ref('')
const auditStatus = ref('')
const suppliers = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const showAudit = ref(false)
const currentId = ref(null)
const saving = ref(false)

const columns = [
  { key: 'companyName', prop: 'companyName', label: '公司名称', minWidth: 180 },
  { key: 'creditCode', prop: 'creditCode', label: '信用代码', width: 170 },
  { key: 'industry', prop: 'industry', label: '所属行业', width: 120 },
  { key: 'legalName', prop: 'legalName', label: '法定代表人', width: 110 },
  { key: 'contactPhone', prop: 'contactPhone', label: '联系电话', width: 130 },
  { key: 'shopName', prop: 'shopName', label: '店铺名称', minWidth: 140 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'auditStatus', prop: 'auditStatus', label: '审核状态', width: 110 },
  { key: 'auditOpinion', prop: 'auditOpinion', label: '审核意见', minWidth: 160 },
  { key: 'createTime', prop: 'createTime', label: '申请时间', width: 170 },
  { key: 'actions', label: '操作', width: 130 },
]

const auditForm = reactive({
  status: 'APPROVED',
  opinion: '',
})

function rowActions(row) {
  const list = [{ key: 'detail', label: '查看', onClick: () => goDetail(row.id) }]
  if (row.auditStatus === 'PENDING') {
    list.push({ key: 'audit', label: '审核', onClick: () => audit(row.id) })
  }
  return list
}

async function loadSuppliers() {
  loading.value = true
  try {
    const res = await platformApi.getSuppliers({
      page: page.value,
      size: size.value,
      keyword: keyword.value.trim() || undefined,
      auditStatus: auditStatus.value || undefined,
    })
    suppliers.value = res.records || []
    total.value = Number(res.total || 0)
  } finally {
    loading.value = false
  }
}

onMounted(loadSuppliers)

const search = () => {
  page.value = 1
  loadSuppliers()
}

const reset = () => {
  keyword.value = ''
  auditStatus.value = ''
  page.value = 1
  loadSuppliers()
}

const handlePageChange = (nextPage, nextSize) => {
  page.value = nextPage
  size.value = nextSize
  loadSuppliers()
}

const getStatusType = (status) => (status === 'ACTIVE' ? 'success' : 'danger')
const getAuditType = (status) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[status] || 'info')
const getAuditText = (status) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' }[status] || status)

const goDetail = (id) => {
  router.push(`/supplier-detail/${id}`)
}

const audit = (id) => {
  currentId.value = id
  auditForm.status = 'APPROVED'
  auditForm.opinion = ''
  showAudit.value = true
}

const confirmAudit = async () => {
  if (auditForm.status === 'REJECTED' && !auditForm.opinion.trim()) {
    ElMessage.warning('拒绝时请填写审核意见')
    return
  }
  saving.value = true
  try {
    const res = await platformApi.auditSupplier({
      id: currentId.value,
      auditStatus: auditForm.status,
      auditOpinion: auditForm.opinion,
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '审核失败')
      return
    }
    ElMessage.success('审核已提交')
    showAudit.value = false
    await loadSuppliers()
  } catch (e) {
    ElMessage.error(e?.message || '审核失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.suppliers-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
</style>
