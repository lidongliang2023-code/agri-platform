<template>
  <div class="user-profile">
    <div class="page-header">
      <h1>个人中心</h1>
      <p>管理您的个人信息</p>
    </div>

    <div class="profile-content">
      <div class="profile-card">
        <div class="profile-header">
          <div class="avatar">
            <span class="avatar-icon">👤</span>
          </div>
          <div class="user-info">
            <h2>{{ userProfile.nickname }}</h2>
            <p class="user-email">{{ userProfile.email }}</p>
            <p class="user-role">{{ userProfile.role }}</p>
          </div>
          <button class="edit-btn" @click="editProfile">编辑资料</button>
        </div>

        <div class="profile-stats">
          <div class="stat-item">
            <span class="stat-value">{{ profileStats.queries }}</span>
            <span class="stat-label">查询次数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ profileStats.exports }}</span>
            <span class="stat-label">导出次数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ profileStats.reports }}</span>
            <span class="stat-label">生成报表</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ profileStats.days }}</span>
            <span class="stat-label">使用天数</span>
          </div>
        </div>
      </div>

      <div class="info-section">
        <div class="section-card">
          <h3>基本信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ userProfile.username }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">昵称</span>
              <span class="info-value">{{ userProfile.nickname }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">邮箱</span>
              <span class="info-value">{{ userProfile.email }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">手机号</span>
              <span class="info-value">{{ userProfile.phone }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">所属组织</span>
              <span class="info-value">{{ userProfile.organization }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">角色</span>
              <span class="info-value">{{ userProfile.role }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ userProfile.createTime }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">最后登录</span>
              <span class="info-value">{{ userProfile.lastLogin }}</span>
            </div>
          </div>
        </div>

        <div class="section-card">
          <h3>最近活动</h3>
          <div class="activity-list">
            <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
              <span class="activity-icon">{{ activity.icon }}</span>
              <div class="activity-content">
                <span class="activity-title">{{ activity.title }}</span>
                <span class="activity-time">{{ activity.time }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="modalVisible = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>编辑个人资料</h3>
          <button class="close-btn" @click="modalVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>昵称</label>
            <input type="text" v-model="editForm.nickname" class="form-input" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="editForm.email" class="form-input" />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input type="tel" v-model="editForm.phone" class="form-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="modalVisible = false">取消</button>
          <button class="btn btn-primary" @click="saveProfile">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const modalVisible = ref(false)

const userProfile = ref({
  username: 'zhangsan',
  nickname: '张三',
  email: 'zhangsan@example.com',
  phone: '13800138001',
  organization: '研发部',
  role: '普通用户',
  createTime: '2026-01-15 10:30:00',
  lastLogin: '2026-05-09 09:15:00'
})

const profileStats = ref({
  queries: 2847,
  exports: 328,
  reports: 156,
  days: 114
})

const recentActivities = ref([
  { id: 1, icon: '🔍', title: '查询用户数据', time: '10分钟前' },
  { id: 2, icon: '📊', title: '生成数据质量报告', time: '30分钟前' },
  { id: 3, icon: '📥', title: '导出商品数据', time: '1小时前' },
  { id: 4, icon: '🔍', title: '查询组织架构', time: '2小时前' },
  { id: 5, icon: '📊', title: '查看使用统计报表', time: '3小时前' }
])

const editForm = reactive({
  nickname: '',
  email: '',
  phone: ''
})

const editProfile = () => {
  editForm.nickname = userProfile.value.nickname
  editForm.email = userProfile.value.email
  editForm.phone = userProfile.value.phone
  modalVisible.value = true
}

const saveProfile = () => {
  userProfile.value.nickname = editForm.nickname
  userProfile.value.email = editForm.email
  userProfile.value.phone = editForm.phone
  modalVisible.value = false
  alert('个人资料已更新')
}

onMounted(() => {})
</script>

<style scoped>
.user-profile {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.page-header p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.profile-content {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

.profile-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.profile-header {
  padding: 24px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  text-align: center;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.avatar-icon {
  font-size: 40px;
}

.user-info h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
}

.user-email {
  font-size: 14px;
  opacity: 0.9;
  margin: 0 0 4px;
}

.user-role {
  font-size: 13px;
  opacity: 0.8;
  margin: 0 0 16px;
}

.edit-btn {
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 20px;
}

.stat-item {
  text-align: center;
  padding: 12px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #a0aec0;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.section-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.info-label {
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.activity-icon {
  font-size: 18px;
}

.activity-content {
  flex: 1;
}

.activity-title {
  display: block;
  font-size: 14px;
  color: #2d3748;
  margin-bottom: 2px;
}

.activity-time {
  font-size: 12px;
  color: #a0aec0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 450px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #a0aec0;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-primary {
  background: #238636;
  color: #fff;
}
</style>