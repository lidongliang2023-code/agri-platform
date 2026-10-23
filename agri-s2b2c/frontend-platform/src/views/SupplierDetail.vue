<template>
  <div class="supplier-detail-page">
    <el-button @click="goBack">返回</el-button>
    <div class="detail-card" v-if="supplier">
      <h2>供应商详情</h2>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="公司名称">{{ supplier.companyName }}</el-descriptions-item>
        <el-descriptions-item label="信用代码">{{ supplier.creditCode }}</el-descriptions-item>
        <el-descriptions-item label="所属行业">{{ supplier.industry }}</el-descriptions-item>
        <el-descriptions-item label="法定代表人">{{ supplier.legalName }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ supplier.legalIdCard }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ supplier.contactPhone }}</el-descriptions-item>
        <el-descriptions-item label="省份">{{ supplier.province }}</el-descriptions-item>
        <el-descriptions-item label="城市">{{ supplier.city }}</el-descriptions-item>
        <el-descriptions-item label="区县">{{ supplier.district }}</el-descriptions-item>
        <el-descriptions-item label="详细地址">{{ supplier.address }}</el-descriptions-item>
        <el-descriptions-item label="银行名称">{{ supplier.bankName }}</el-descriptions-item>
        <el-descriptions-item label="银行账号">{{ supplier.bankAccount }}</el-descriptions-item>
        <el-descriptions-item label="开户支行">{{ supplier.bankBranch }}</el-descriptions-item>
        <el-descriptions-item label="店铺名称">{{ supplier.shopName }}</el-descriptions-item>
        <el-descriptions-item label="店铺描述">{{ supplier.shopDesc }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">
          <el-tag :type="getAuditType(supplier.auditStatus)">{{ getAuditText(supplier.auditStatus) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审核意见">{{ supplier.auditOpinion || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ supplier.auditTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ supplier.createTime }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions" v-if="supplier.auditStatus === 'PENDING'">
        <el-button type="primary" @click="audit('APPROVED')">通过</el-button>
        <el-button type="danger" @click="audit('REJECTED')">拒绝</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { platformApi } from '../api'

const router = useRouter()
const route = useRoute()
const supplier = ref(null)

onMounted(() => {
  loadSupplier()
})

const loadSupplier = async () => {
  const res = await platformApi.getSupplierDetail(route.params.id)
  supplier.value = res
}

const getAuditType = (status) => {
  const types = { 'PENDING': 'warning', 'APPROVED': 'success', 'REJECTED': 'danger' }
  return types[status] || 'default'
}

const getAuditText = (status) => {
  const texts = { 'PENDING': '待审核', 'APPROVED': '已通过', 'REJECTED': '已拒绝' }
  return texts[status] || status
}

const goBack = () => {
  router.push('/suppliers')
}

const audit = async (status) => {
  const opinion = status === 'REJECTED' ? prompt('请输入审核意见') : ''
  const res = await platformApi.auditSupplier({
    id: route.params.id,
    auditStatus: status,
    auditOpinion: opinion
  })
  if (res.success) {
    alert('审核成功')
    loadSupplier()
  }
}
</script>

<style scoped>
.supplier-detail-page {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.detail-card h2 {
  margin-bottom: 30px;
}

.actions {
  margin-top: 30px;
  display: flex;
  gap: 15px;
}
</style>