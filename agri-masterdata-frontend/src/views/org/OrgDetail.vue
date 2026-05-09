<template>
  <div class="org-detail">
    <div class="page-header">
      <el-button @click="goBack">← 返回</el-button>
      <h1 class="page-title">组织详情</h1>
    </div>

    <el-card v-if="orgData">
      <div class="detail-section">
        <h3 class="section-title">基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">组织编码</span>
            <span class="value">{{ orgData.orgCode }}</span>
          </div>
          <div class="info-item">
            <span class="label">组织名称</span>
            <span class="value">{{ orgData.orgName }}</span>
          </div>
          <div class="info-item">
            <span class="label">组织类型</span>
            <span class="value">{{ getOrgTypeLabel(orgData.orgType) }}</span>
          </div>
          <div class="info-item">
            <span class="label">法人</span>
            <span class="value">{{ orgData.legalPerson }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系人</span>
            <span class="value">{{ orgData.contactPerson }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系电话</span>
            <span class="value">{{ orgData.contactPhone }}</span>
          </div>
          <div class="info-item">
            <span class="label">地址</span>
            <span class="value">{{ orgData.address }}</span>
          </div>
          <div class="info-item">
            <span class="label">认证状态</span>
            <el-tag :type="getStatusType(orgData.authStatus)">
              {{ getStatusLabel(orgData.authStatus) }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrgDetail } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const orgData = ref(null)

const goBack = () => {
  router.push('/org/list')
}

const getOrgTypeLabel = (type) => {
  const labels = { enterprise: '企业', cooperative: '合作社', farmer: '农户' }
  return labels[type] || type
}

const getStatusType = (status) => {
  const types = { verified: 'success', unverified: 'warning', pending: 'info' }
  return types[status] || 'default'
}

const getStatusLabel = (status) => {
  const labels = { verified: '已认证', unverified: '未认证', pending: '审核中' }
  return labels[status] || status
}

const loadDetail = async () => {
  const id = route.params.id
  try {
    const response = await getOrgDetail(id)
    if (response.code === 200) {
      orgData.value = response.data
    }
  } catch (error) {
    console.error('加载组织详情失败', error)
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.org-detail {
  padding: 20px;
}

.detail-section {
  margin-bottom: 30px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 14px;
  color: #999;
  margin-bottom: 5px;
}

.value {
  font-size: 14px;
  color: #1f1f1f;
}
</style>
