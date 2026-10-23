<template>
  <div class="partner-detail-page">
    <el-button @click="goBack">返回</el-button>
    <div class="detail-card" v-if="partner">
      <h2>渠道商详情</h2>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="注册类型">{{ partner.registerType === 'PERSONAL' ? '个人' : '企业' }}</el-descriptions-item>
        <el-descriptions-item label="公司名称">{{ partner.companyName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="信用代码">{{ partner.creditCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ partner.contactName }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ partner.contactPhone }}</el-descriptions-item>
        <el-descriptions-item label="省份">{{ partner.province }}</el-descriptions-item>
        <el-descriptions-item label="城市">{{ partner.city }}</el-descriptions-item>
        <el-descriptions-item label="区县">{{ partner.district }}</el-descriptions-item>
        <el-descriptions-item label="详细地址">{{ partner.address }}</el-descriptions-item>
        <el-descriptions-item label="店铺名称">{{ partner.shopName }}</el-descriptions-item>
        <el-descriptions-item label="店铺描述">{{ partner.shopDesc || '-' }}</el-descriptions-item>
        <el-descriptions-item label="等级">{{ getGradeText(partner.grade) }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">
          <el-tag :type="getAuditType(partner.auditStatus)">{{ getAuditText(partner.auditStatus) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审核意见">{{ partner.auditOpinion || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审核时间">{{ partner.auditTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ partner.createTime }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions" v-if="partner.auditStatus === 'PENDING'">
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
const partner = ref(null)

onMounted(() => {
  loadPartner()
})

const loadPartner = async () => {
  const res = await platformApi.getChannelPartnerDetail(route.params.id)
  partner.value = res
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

const goBack = () => {
  router.push('/channel-partners')
}

const audit = async (status) => {
  const opinion = status === 'REJECTED' ? prompt('请输入审核意见') : ''
  const res = await platformApi.auditChannelPartner({
    id: route.params.id,
    auditStatus: status,
    auditOpinion: opinion
  })
  if (res.success) {
    alert('审核成功')
    loadPartner()
  }
}
</script>

<style scoped>
.partner-detail-page {
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