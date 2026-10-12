<template>
  <div class="user-login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="card-header">
          <div class="logo-section">
            <span class="logo-icon">🌾</span>
            <h1>主数据平台</h1>
            <p>用户端系统</p>
          </div>
        </div>
        
        <div class="card-body">
          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="username">用户名</label>
              <input 
                type="text" 
                id="username" 
                v-model="form.username" 
                placeholder="请输入用户名"
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label for="password">密码</label>
              <input 
                type="password" 
                id="password" 
                v-model="form.password" 
                placeholder="请输入密码"
                class="form-input"
              />
            </div>
            
            <div class="form-group remember">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.remember" />
                <span>记住我</span>
              </label>
              <a href="#" class="forgot-link">忘记密码?</a>
            </div>
            
            <button type="submit" class="login-btn" :disabled="isLoading">
              <span v-if="isLoading">登录中...</span>
              <span v-else>登录</span>
            </button>
          </form>
          
          <div class="login-tips">
            <p>测试账号：</p>
            <p>用户名：user</p>
            <p>密码：user123</p>
          </div>
        </div>
        
        <div class="card-footer">
          <p>还没有账号？<a href="#" class="register-link">联系管理员注册</a></p>
        </div>
      </div>
      
      <div class="login-side">
        <div class="side-content">
          <div class="feature-card">
            <span class="feature-icon">📊</span>
            <h3>数据查询</h3>
            <p>快速查询各类主数据信息</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">📈</span>
            <h3>数据报表</h3>
            <p>查看数据统计与分析报表</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🔔</span>
            <h3>实时通知</h3>
            <p>接收数据变更与系统通知</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoading = ref(false)

const form = reactive({
  username: '',
  password: '',
  remember: false
})

const handleLogin = async () => {
  if (!form.username || !form.password) {
    alert('请输入用户名和密码')
    return
  }
  
  isLoading.value = true
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  if (form.username === 'user' && form.password === 'user123') {
    localStorage.setItem('token', 'user_token_' + Date.now())
    localStorage.setItem('userType', 'user')
    router.push('/user/home')
  } else {
    alert('用户名或密码错误')
  }
  
  isLoading.value = false
}
</script>

<style scoped>
.user-login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
  display: flex;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  width: 900px;
  max-width: 100%;
}

.login-card {
  flex: 1;
  padding: 40px;
}

.card-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.card-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #238636;
  margin: 0 0 6px;
}

.card-header p {
  font-size: 14px;
  color: #a0aec0;
  margin: 0;
}

.card-body {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.form-group.remember {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
}

.forgot-link {
  font-size: 13px;
  color: #238636;
  text-decoration: none;
}

.forgot-link:hover {
  text-decoration: underline;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(35, 134, 54, 0.3);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-tips {
  margin-top: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
}

.login-tips p {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0;
}

.login-tips p:first-child {
  margin-top: 0;
  font-weight: 600;
  color: #4a5568;
}

.card-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.card-footer p {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.register-link {
  color: #238636;
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}

.login-side {
  flex: 1;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.side-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  padding: 24px;
  border-radius: 16px;
  text-align: center;
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.feature-card h3 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
}

.feature-card p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}
</style>