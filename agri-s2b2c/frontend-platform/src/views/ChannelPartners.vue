<template>
  <div class="channel-partners-page">
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索公司/联系人" style="width: 300px" @keyup.enter="loadPartners" />
      <el-select v-model="auditStatus" placeholder="审核状态" style="width: 150px" @change="loadPartners">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已拒绝" value="REJECTED" />
      </el-select>
    </div>
    <el-table :data="partners" border>
      <el-table-column prop="registerType" label="注册类型">
        <template #default="{ row }">
          {{ row.registerType === 'PERSONAL' ? '个人' : '企业' }}
        </template>
      </el-table-column>
      <el-table-column prop="companyName" label="公司名称" />
      <el-table-column prop="contactName" label="联系人" />
      <el-table-column prop="contactPhone" label="联系电话" />
      <el-table-column prop="shopName" label="店铺名称" />
      <el-table-column prop="grade" label="等级">
        <template #default="{ row }">
          <el-tag>{{ getGradeText(row.grade) }}</el-tag>
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
    <el-dialog v-model="showAudit" title="渠道商审核">
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
const partners = ref([])
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
  loadPartners()
})

const loadPartners = async () => {
  const res = await platformApi.getChannelPartners({
    page: page.value,
    size: size.value,
    keyword: keyword.value,
    auditStatus: auditStatus.value
  })
  partners.value = res.records || []
  total.value = res.total || 0
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadPartners()
}

const getGradeText = (grade) => {
  const texts = { 'LEVEL_1': '一级', 'LEVEL_2': '二级', 'LEVEL_3': '三级' }
  return texts[grade] || grade
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
  router.push(`/channel-partner-detail/${id}`)
}

const audit = (id) => {
  currentId.value = id
  showAudit.value = true
}

const confirmAudit = async () => {
  const res = await platformApi.auditChannelPartner({
    id: currentId.value,
    auditStatus: auditForm.status,
    auditOpinion: auditForm.opinion
  })
  if (res.success) {
    alert('审核成功')
    showAudit.value = false
    loadPartners()
  }
}
</script>

<style scoped>
.channel-partners-page {
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