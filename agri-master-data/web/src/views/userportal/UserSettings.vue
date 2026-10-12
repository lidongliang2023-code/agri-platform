<template>
  <div class="user-settings">
    <div class="page-header">
      <h1>账号设置</h1>
      <p>管理您的账号安全和系统偏好</p>
    </div>

    <div class="settings-content">
      <div class="settings-sidebar">
        <ul class="menu-list">
          <li 
            v-for="menu in menuItems" 
            :key="menu.key"
            :class="{ active: activeMenu === menu.key }"
            @click="activeMenu = menu.key"
          >
            <span class="menu-icon">{{ menu.icon }}</span>
            <span>{{ menu.label }}</span>
          </li>
        </ul>
      </div>

      <div class="settings-main">
        <div v-if="activeMenu === 'password'" class="setting-section">
          <h3>修改密码</h3>
          <form @submit.prevent="changePassword" class="setting-form">
            <div class="form-group">
              <label>当前密码</label>
              <input type="password" v-model="passwordForm.currentPassword" class="form-input" placeholder="请输入当前密码" />
            </div>
            <div class="form-group">
              <label>新密码</label>
              <input type="password" v-model="passwordForm.newPassword" class="form-input" placeholder="请输入新密码" />
              <span class="form-hint">密码长度至少8位，包含字母和数字</span>
            </div>
            <div class="form-group">
              <label>确认新密码</label>
              <input type="password" v-model="passwordForm.confirmPassword" class="form-input" placeholder="请再次输入新密码" />
            </div>
            <button type="submit" class="submit-btn">修改密码</button>
          </form>
        </div>

        <div v-else-if="activeMenu === 'security'" class="setting-section">
          <h3>安全设置</h3>
          <div class="security-options">
            <div class="option-item">
              <div class="option-info">
                <h4>登录提醒</h4>
                <p>登录时发送邮件或短信提醒</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: securitySettings.loginAlert }" 
                  @click="securitySettings.loginAlert = !securitySettings.loginAlert"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
            <div class="option-item">
              <div class="option-info">
                <h4>双重认证</h4>
                <p>登录时需要额外的验证码验证</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: securitySettings.twoFactor }" 
                  @click="securitySettings.twoFactor = !securitySettings.twoFactor"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
            <div class="option-item">
              <div class="option-info">
                <h4>会话超时</h4>
                <p>无操作自动退出登录的时间</p>
              </div>
              <select v-model="securitySettings.sessionTimeout" class="option-select">
                <option value="15">15分钟</option>
                <option value="30">30分钟</option>
                <option value="60">1小时</option>
                <option value="120">2小时</option>
              </select>
            </div>
          </div>
          <button class="save-btn" @click="saveSecuritySettings">保存设置</button>
        </div>

        <div v-else-if="activeMenu === 'notifications'" class="setting-section">
          <h3>通知设置</h3>
          <div class="notification-options">
            <div class="option-item">
              <div class="option-info">
                <h4>系统通知</h4>
                <p>接收系统重要通知和公告</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: notificationSettings.system }" 
                  @click="notificationSettings.system = !notificationSettings.system"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
            <div class="option-item">
              <div class="option-info">
                <h4>邮件通知</h4>
                <p>通过邮件接收通知消息</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: notificationSettings.email }" 
                  @click="notificationSettings.email = !notificationSettings.email"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
            <div class="option-item">
              <div class="option-info">
                <h4>数据更新提醒</h4>
                <p>关注的数据发生变化时提醒</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: notificationSettings.dataUpdate }" 
                  @click="notificationSettings.dataUpdate = !notificationSettings.dataUpdate"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
            <div class="option-item">
              <div class="option-info">
                <h4>周报订阅</h4>
                <p>每周接收数据使用周报</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: notificationSettings.weeklyReport }" 
                  @click="notificationSettings.weeklyReport = !notificationSettings.weeklyReport"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
          </div>
          <button class="save-btn" @click="saveNotificationSettings">保存设置</button>
        </div>

        <div v-else-if="activeMenu === 'privacy'" class="setting-section">
          <h3>隐私设置</h3>
          <div class="privacy-options">
            <div class="option-item">
              <div class="option-info">
                <h4>数据浏览记录</h4>
                <p>记录您浏览过的数据</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: privacySettings.browseHistory }" 
                  @click="privacySettings.browseHistory = !privacySettings.browseHistory"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
            <div class="option-item">
              <div class="option-info">
                <h4>搜索历史</h4>
                <p>保存您的搜索关键词</p>
              </div>
              <div class="option-toggle">
                <button 
                  :class="{ active: privacySettings.searchHistory }" 
                  @click="privacySettings.searchHistory = !privacySettings.searchHistory"
                >
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>
          </div>
          <button class="save-btn" @click="savePrivacySettings">保存设置</button>
          <div class="clear-history">
            <button class="clear-btn" @click="clearHistory">清除浏览历史</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const activeMenu = ref('password')

const menuItems = [
  { key: 'password', label: '修改密码', icon: '🔐' },
  { key: 'security', label: '安全设置', icon: '🛡️' },
  { key: 'notifications', label: '通知设置', icon: '🔔' },
  { key: 'privacy', label: '隐私设置', icon: '🔒' }
]

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const securitySettings = reactive({
  loginAlert: true,
  twoFactor: false,
  sessionTimeout: '30'
})

const notificationSettings = reactive({
  system: true,
  email: true,
  dataUpdate: true,
  weeklyReport: false
})

const privacySettings = reactive({
  browseHistory: true,
  searchHistory: true
})

const changePassword = () => {
  if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    alert('请填写所有字段')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    alert('两次输入的密码不一致')
    return
  }
  if (passwordForm.newPassword.length < 8) {
    alert('密码长度至少8位')
    return
  }
  alert('密码修改成功')
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}

const saveSecuritySettings = () => {
  alert('安全设置已保存')
}

const saveNotificationSettings = () => {
  alert('通知设置已保存')
}

const savePrivacySettings = () => {
  alert('隐私设置已保存')
}

const clearHistory = () => {
  if (confirm('确定要清除所有浏览历史吗？')) {
    alert('浏览历史已清除')
  }
}

onMounted(() => {})
</script>

<style scoped>
.user-settings {
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

.settings-content {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;
}

.settings-sidebar {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
  color: #4a5568;
}

.menu-list li:hover {
  background: #f8fafc;
}

.menu-list li.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.menu-icon {
  font-size: 16px;
}

.settings-main {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.setting-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 20px;
}

.setting-form {
  max-width: 400px;
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

.form-hint {
  display: block;
  font-size: 12px;
  color: #a0aec0;
  margin-top: 4px;
}

.submit-btn {
  padding: 12px 30px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.security-options,
.notification-options,
.privacy-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.option-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 4px;
}

.option-info p {
  font-size: 13px;
  color: #a0aec0;
  margin: 0;
}

.option-toggle button {
  width: 50px;
  height: 28px;
  background: #e2e8f0;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.option-toggle button.active {
  background: #238636;
}

.toggle-dot {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.2s;
}

.option-toggle button.active .toggle-dot {
  left: 26px;
}

.option-select {
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.save-btn {
  margin-top: 24px;
  padding: 12px 30px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.clear-history {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.clear-btn {
  padding: 10px 20px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
</style>