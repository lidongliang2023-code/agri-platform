<template>
  <div class="user-detail">
    <div class="page-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
        <span>返回</span>
      </button>
      <div class="header-left">
        <h1>用户详情</h1>
        <p>查看用户详细信息</p>
      </div>
    </div>

    <div class="detail-card" v-if="userData">
      <div class="detail-section">
        <h3 class="section-title">基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">用户编码</span>
            <span class="value">{{ userData.userCode }}</span>
          </div>
          <div class="info-item">
            <span class="label">用户名</span>
            <span class="value">{{ userData.username }}</span>
          </div>
          <div class="info-item">
            <span class="label">真实姓名</span>
            <span class="value">{{ userData.realName }}</span>
          </div>
          <div class="info-item">
            <span class="label">用户类型</span>
            <span class="value">{{ userData.userType === 'enterprise' ? '企业用户' : '个人用户' }}</span>
          </div>
          <div class="info-item">
            <span class="label">手机号</span>
            <span class="value">{{ userData.phone }}</span>
          </div>
          <div class="info-item">
            <span class="label">邮箱</span>
            <span class="value">{{ userData.email }}</span>
          </div>
          <div class="info-item">
            <span class="label">实名状态</span>
            <span class="status-badge" :class="userData.realNameStatus">
              {{ getStatusLabel(userData.realNameStatus) }}
            </span>
          </div>
          <div class="info-item">
            <span class="label">状态</span>
            <span class="status-badge" :class="userData.userStatus">
              {{ userData.userStatus === 'active' ? '正常' : '禁用' }}
            </span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">认证信息</h3>
        <div v-if="userData.certInfo" class="cert-info">
          <div class="cert-item">
            <span class="label">证件类型</span>
            <span class="value">{{ userData.certInfo.idCardType }}</span>
          </div>
          <div class="cert-item">
            <span class="label">证件号码</span>
            <span class="value">{{ userData.certInfo.idCardNo }}</span>
          </div>
        </div>
        <div v-else class="no-data">
          <p>暂无认证信息</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserDetail } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const userData = ref(null)

const goBack = () => {
  router.push('/user/list')
}

const getStatusLabel = (status) => {
  const labels = { verified: '已认证', unverified: '未认证', pending: '审核中' }
  return labels[status] || status
}

const loadDetail = async () => {
  const id = route.params.id
  try {
    const response = await getUserDetail(id)
    if (response.code === 200) {
      userData.value = response.data
    }
  } catch (error) {
    console.error('加载用户详情失败', error)
    userData.value = mockUserData
  }
}

const mockUserData = {
  userCode: 'USER001',
  username: 'user001',
  realName: '张三',
  userType: 'individual',
  phone: '13800138001',
  email: 'zhang@example.com',
  realNameStatus: 'verified',
  userStatus: 'active',
  certInfo: {
    idCardType: '身份证',
    idCardNo: '110101199001011234'
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.user-detail {
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

.status-badge.verified {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.unverified {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.pending {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
}

.cert-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.cert-item {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.no-data {
  color: #a0aec0;
  text-align: center;
  padding: 40px;
  background: #f8fafc;
  border-radius: 8px;
}
</style>