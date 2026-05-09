<template>
  <div class="tenant-detail">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
        <span>返回</span>
      </button>
      <div class="header-left">
        <h1>租户详情</h1>
        <p>查看租户详细信息</p>
      </div>
    </div>

    <div class="detail-card" v-if="tenantData">
      <div class="detail-section">
        <h3 class="section-title">基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">租户编码</span>
            <span class="value">{{ tenantData.tenantCode }}</span>
          </div>
          <div class="info-item">
            <span class="label">租户名称</span>
            <span class="value">{{ tenantData.tenantName }}</span>
          </div>
          <div class="info-item">
            <span class="label">租户类型</span>
            <span class="value">{{ tenantData.tenantType === 'enterprise' ? '企业' : '个人' }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系人</span>
            <span class="value">{{ tenantData.contactName }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系电话</span>
            <span class="value">{{ tenantData.phone }}</span>
          </div>
          <div class="info-item">
            <span class="label">邮箱</span>
            <span class="value">{{ tenantData.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">地址</span>
            <span class="value">{{ tenantData.address }}</span>
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <span class="status-badge" :class="tenantData.status === 0 ? 'active' : 'inactive'">
              {{ tenantData.status === 0 ? '正常' : '禁用' }}
            </span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">配额信息</h3>
        <div v-if="tenantData.quotaInfo" class="quota-grid">
          <div class="quota-item">
            <div class="quota-header">
              <span>用户配额</span>
              <span class="quota-value">{{ tenantData.quotaInfo.usedUsers }} / {{ tenantData.quotaInfo.userLimit }}</span>
            </div>
            <div class="quota-progress">
              <div class="progress-fill" :style="{ width: (tenantData.quotaInfo.usedUsers / tenantData.quotaInfo.userLimit * 100).toFixed(0) + '%' }"></div>
            </div>
          </div>
          <div class="quota-item">
            <div class="quota-header">
              <span>组织配额</span>
              <span class="quota-value">{{ tenantData.quotaInfo.usedOrgs }} / {{ tenantData.quotaInfo.orgLimit }}</span>
            </div>
            <div class="quota-progress">
              <div class="progress-fill" :style="{ width: (tenantData.quotaInfo.usedOrgs / tenantData.quotaInfo.orgLimit * 100).toFixed(0) + '%' }"></div>
            </div>
          </div>
          <div class="quota-item">
            <div class="quota-header">
              <span>商品配额</span>
              <span class="quota-value">{{ tenantData.quotaInfo.usedProducts }} / {{ tenantData.quotaInfo.productLimit }}</span>
            </div>
            <div class="quota-progress">
              <div class="progress-fill" :style="{ width: (tenantData.quotaInfo.usedProducts / tenantData.quotaInfo.productLimit * 100).toFixed(0) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">质量评分</h3>
        <div v-if="tenantData.qualityScore" class="quality-score">
          <div class="score-circle">
            <span class="score-value">{{ tenantData.qualityScore.overallScore }}</span>
            <span class="score-label">综合评分</span>
          </div>
          <div class="score-details">
            <div class="score-item">
              <span>用户主数据</span>
              <span>{{ tenantData.qualityScore.userMasterData }}</span>
            </div>
            <div class="score-item">
              <span>组织主数据</span>
              <span>{{ tenantData.qualityScore.orgMasterData }}</span>
            </div>
            <div class="score-item">
              <span>商品主数据</span>
              <span>{{ tenantData.qualityScore.productMasterData }}</span>
            </div>
            <div class="score-item">
              <span>权限主数据</span>
              <span>{{ tenantData.qualityScore.permissionMasterData }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTenantDetail } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const tenantData = ref(null)

const goBack = () => {
  router.push('/tenant/list')
}

const loadDetail = async () => {
  const id = route.params.id
  try {
    const response = await getTenantDetail(id)
    if (response.code === 200) {
      tenantData.value = response.data
    }
  } catch (error) {
    console.error('加载租户详情失败', error)
    tenantData.value = mockTenantData
  }
}

const mockTenantData = {
  tenantCode: 'TENANT001',
  tenantName: '阳光农场',
  tenantType: 'enterprise',
  contactName: '张三',
  phone: '13800138001',
  email: 'zhang@sunfarm.com',
  address: '北京市朝阳区农业科技园',
  status: 0,
  quotaInfo: {
    usedUsers: 25,
    userLimit: 100,
    usedOrgs: 5,
    orgLimit: 20,
    usedProducts: 150,
    productLimit: 500
  },
  qualityScore: {
    overallScore: 85,
    userMasterData: 90,
    orgMasterData: 82,
    productMasterData: 88,
    permissionMasterData: 80
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.tenant-detail {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #f8fafc;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.header-left p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.detail-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

.detail-section {
  margin-bottom: 30px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.label {
  font-size: 13px;
  color: #a0aec0;
  margin-bottom: 6px;
}

.value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.quota-item {
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.quota-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.quota-value {
  font-weight: 600;
  color: #238636;
}

.quota-progress {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636 0%, #2ea043 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.quality-score {
  display: flex;
  align-items: center;
  gap: 60px;
}

.score-circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.score-value {
  font-size: 36px;
  font-weight: 700;
}

.score-label {
  font-size: 12px;
  opacity: 0.9;
}

.score-details {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
}

.score-item span:first-child {
  color: #a0aec0;
}

.score-item span:last-child {
  font-weight: 500;
  color: #2d3748;
}
</style>