<template>
  <div class="credit-profile-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">💰</div>
        <div class="logo-text">农链金服</div>
      </div>
      <nav class="nav">
        <router-link to="/borrower/home" class="nav-item">首页</router-link>
        <router-link to="/borrower/credit" class="nav-item">信用中心</router-link>
        <router-link to="/borrower/credit-profile" class="nav-item active">信用档案</router-link>
        <router-link to="/borrower/loan-apply" class="nav-item">融资申请</router-link>
        <router-link to="/borrower/loan-management" class="nav-item">借款管理</router-link>
        <router-link to="/borrower/pledge" class="nav-item">质押管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>信用档案</h1>
        <p>管理您的信用信息和档案资料</p>
      </div>
      <div class="profile-section">
        <h2>基本信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">企业名称</span>
            <span class="info-value">{{ profileInfo.companyName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">统一信用代码</span>
            <span class="info-value">{{ profileInfo.creditCode }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">法定代表人</span>
            <span class="info-value">{{ profileInfo.legalRep }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">注册资本</span>
            <span class="info-value">{{ profileInfo.registeredCapital }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">成立年限</span>
            <span class="info-value">{{ profileInfo.establishedYears }}年</span>
          </div>
          <div class="info-item">
            <span class="info-label">经营范围</span>
            <span class="info-value">{{ profileInfo.businessScope }}</span>
          </div>
        </div>
        <el-button type="primary" style="margin-top: 20px;">编辑信息</el-button>
      </div>
      <div class="documents-section">
        <h2>资质文件</h2>
        <div class="documents-grid">
          <div class="document-card" v-for="doc in documents" :key="doc.id">
            <div class="document-icon">{{ doc.icon }}</div>
            <div class="document-info">
              <div class="document-name">{{ doc.name }}</div>
              <div class="document-status" :class="doc.status">
                {{ doc.status === 'verified' ? '已认证' : doc.status === 'pending' ? '审核中' : '未上传' }}
              </div>
            </div>
            <div class="document-actions">
              <el-button size="small" v-if="doc.status !== 'verified'" @click="uploadDoc(doc)">上传</el-button>
              <el-button size="small" v-if="doc.status === 'verified'" @click="viewDoc(doc)">查看</el-button>
            </div>
          </div>
        </div>
      </div>
      <div class="history-section">
        <h2>信用历史</h2>
        <div class="timeline">
          <div class="timeline-item" v-for="(item, index) in creditHistory" :key="index">
            <div class="timeline-dot" :class="item.type"></div>
            <div class="timeline-content">
              <div class="timeline-date">{{ item.date }}</div>
              <div class="timeline-title">{{ item.title }}</div>
              <div class="timeline-desc">{{ item.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const profileInfo = reactive({
  companyName: '黑龙江省丰收农业发展有限公司',
  creditCode: '91230100MA1C1234567',
  legalRep: '张三',
  registeredCapital: '500万元',
  establishedYears: 8,
  businessScope: '农作物种植、农产品加工、销售；农业技术服务'
})

const documents = [
  { id: 1, name: '营业执照', icon: '📄', status: 'verified' },
  { id: 2, name: '税务登记证', icon: '📋', status: 'verified' },
  { id: 3, name: '组织机构代码证', icon: '📊', status: 'verified' },
  { id: 4, name: '开户许可证', icon: '🏦', status: 'pending' },
  { id: 5, name: '财务报表', icon: '📈', status: 'verified' },
  { id: 6, name: '信用承诺书', icon: '✍️', status: 'verified' }
]

const creditHistory = [
  { date: '2024-01-15', title: '信用评分更新', description: '综合评分提升至820分', type: 'positive' },
  { date: '2024-01-10', title: '还款完成', description: '按期归还贷款本金180,000元', type: 'positive' },
  { date: '2024-01-05', title: '数据更新', description: '新增经营收入记录', type: 'neutral' },
  { date: '2023-12-20', title: '质押登记', description: '新增库存质押，质押物价值200,000元', type: 'positive' },
  { date: '2023-12-15', title: '信用评估', description: '系统定期信用评估', type: 'neutral' },
  { date: '2023-11-20', title: '贷款发放', description: '成功申请农业收购贷500,000元', type: 'neutral' },
  { date: '2023-11-15', title: '账户注册', description: '完成平台账户注册', type: 'neutral' }
]

const uploadDoc = (doc) => {
  alert(`上传文件: ${doc.name}`)
}

const viewDoc = (doc) => {
  alert(`查看文件: ${doc.name}`)
}
</script>

<style scoped>
.credit-profile-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  height: 60px;
  background: linear-gradient(180deg, #0d2818 0%, #04471c 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 20px;
  font-weight: bold;
}

.nav {
  display: flex;
  gap: 30px;
}

.nav-item {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.3s;
}

.nav-item:hover,
.nav-item.active {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.main-content {
  padding: 30px;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 24px;
  color: #333;
  margin-bottom: 5px;
}

.page-header p {
  font-size: 14px;
  color: #666;
}

.profile-section,
.documents-section,
.history-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 25px;
  margin-bottom: 30px;
}

.profile-section h2,
.documents-section h2,
.history-section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.info-label {
  font-size: 14px;
  color: #666;
}

.info-value {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.document-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 10px;
}

.document-icon {
  font-size: 32px;
}

.document-info {
  flex: 1;
}

.document-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
}

.document-status {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
}

.document-status.verified {
  background: #d1fae5;
  color: #065f46;
}

.document-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.document-status.unuploaded {
  background: #f3f4f6;
  color: #6b7280;
}

.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.timeline-item {
  position: relative;
  margin-bottom: 30px;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -26px;
  top: 5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid white;
}

.timeline-dot.positive {
  background: #10b981;
  box-shadow: 0 0 0 2px #d1fae5;
}

.timeline-dot.neutral {
  background: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
}

.timeline-content {
  padding-left: 10px;
}

.timeline-date {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 5px;
}

.timeline-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 3px;
}

.timeline-desc {
  font-size: 13px;
  color: #666;
}
</style>