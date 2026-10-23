<template>
  <div class="suppliers-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索公司名称" style="width: 300px" @keyup.enter="loadSuppliers" />
      <el-select v-model="auditStatus" placeholder="审核状态" style="width: 150px" @change="loadSuppliers">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已拒绝" value="REJECTED" />
      </el-select>
    </div>
    <el-table :data="suppliers" border>
      <el-table-column prop="companyName" label="公司名称" />
      <el-table-column prop="creditCode" label="信用代码" />
      <el-table-column prop="industry" label="所属行业" />
      <el-table-column prop="legalName" label="法定代表人" />
      <el-table-column prop="contactPhone" label="联系电话" />
      <el-table-column prop="shopName" label="店铺名称" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ row.status === 'ACTIVE' ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="auditStatus" label="审核状态">
        <template #default="{ row }">
          <el-tag :type="getAuditType(row.auditStatus)">{{ getAuditText(row.auditStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="申请时间" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button type="text" @click="goDetail(row.id)">查看</el-button>
          <el-button type="primary" size="small" v-if="row.auditStatus === 'PENDING'" @click="audit(row.id)">审核</el-button>
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
    <el-dialog v-model="showAudit" title="供应商审核">
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
const auditStatus = ref('')
const suppliers = ref([])
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
  loadSuppliers()
})

const loadSuppliers = async () => {
  const res = await platformApi.getSuppliers({
    page: page.value,
    size: size.value,
    keyword: keyword.value,
    auditStatus: auditStatus.value
  })
  suppliers.value = res.records || []
  total.value = res.total || 0
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadSuppliers()
}

const getStatusType = (status) => {
  return status === 'ACTIVE' ? 'success' : 'danger'
}

const getAuditType = (status) => {
  const types = { 'PENDING': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger' }
  return types[status] || 'default'
}

const getAuditText = (status) => {
  const texts = { 'PENDING': '待审核', 'APPROVED': '已通过', 'REJECTED': '已拒绝' }
  return texts[status] || status
}

const goDetail = (id) => {
  router.push(`/supplier-detail/${id}`)
}

const audit = (id) => {
  currentId.value = id
  showAudit.value = true
}

const confirmAudit = async () => {
  const res = await platformApi.auditSupplier({
    id: currentId.value,
    auditStatus: auditForm.status,
    auditOpinion: auditForm.opinion
  })
  if (res.success) {
    alert('审核成功')
    showAudit.value = false
    loadSuppliers()
  }
}
</script>

<style scoped>
.suppliers-page {
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