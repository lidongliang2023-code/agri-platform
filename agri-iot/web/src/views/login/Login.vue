<template>
  <div class="login-container">
    <div class="login-wrapper">
      <div class="login-left">
        <div class="brand-section">
          <div class="brand-icon">📦</div>
          <h1 class="brand-title">IoT管理平台</h1>
          <p class="brand-desc">智慧农业物联网解决方案</p>
        </div>
        <div class="feature-list">
          <div class="feature-item">📊 实时监控</div>
          <div class="feature-item">🔔 智能告警</div>
          <div class="feature-item">⚙️ 自动化控制</div>
          <div class="feature-item">📈 数据分析</div>
        </div>
      </div>
      <div class="login-right">
        <div class="login-card">
          <div class="card-header">
            <h2>欢迎登录</h2>
            <p>请输入账号密码进行登录</p>
          </div>
          <form class="login-form" @submit.prevent="handleLogin">
            <div class="form-group">
              <label>用户名</label>
              <input v-model="form.username" type="text" placeholder="请输入用户名" />
            </div>
            <div class="form-group">
              <label>密码</label>
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" />
              <button type="button" class="toggle-pwd" @click="showPassword = !showPassword">
                {{ showPassword ? '👁️' : '🙈' }}
              </button>
            </div>
            <div class="form-options">
              <label class="checkbox">
                <input type="checkbox" v-model="form.remember" />
                <span>记住我</span>
              </label>
              <a href="#" class="forgot-pwd">忘记密码?</a>
            </div>
            <button type="submit" class="login-btn">登录</button>
          </form>
          <div class="card-footer">
            <span>还没有账号?</span>
            <a href="#" class="register-link">立即注册</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const showPassword = ref(false)

const form = reactive({
  username: '',
  password: '',
  remember: false
})

const handleLogin = () => {
  if (!form.username || !form.password) {
    uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
    return
  }
  localStorage.setItem('token', 'mock-token')
  router.push('/dashboard')
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-wrapper {
  display: flex;
  width: 100%;
  max-width: 900px;
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.login-left {
  width: 45%;
  background: linear-gradient(135deg, #ff7d00 0%, #ff9533 100%);
  padding: 50px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: white;
}

.brand-section {
  text-align: center;
  margin-bottom: 50px;
}

.brand-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.brand-desc {
  font-size: 13px;
  opacity: 0.9;
  margin: 0;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature-item {
  background: rgba(255, 255, 255, 0.15);
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
}

.login-right {
  width: 55%;
  padding: 50px 40px;
}

.login-card {
  max-width: 350px;
  margin: 0 auto;
}

.card-header {
  text-align: center;
  margin-bottom: 30px;
}

.card-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.card-header p {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  position: relative;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  transition: all 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.toggle-pwd {
  position: absolute;
  right: 12px;
  bottom: 12px;
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.checkbox input {
  width: 14px;
  height: 14px;
  accent-color: var(--primary-color);
}

.forgot-pwd {
  font-size: 12px;
  color: var(--primary-color);
  text-decoration: none;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.login-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.card-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-muted);
}

.register-link {
  color: var(--primary-color);
  text-decoration: none;
  margin-left: 4px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .login-wrapper {
    flex-direction: column;
  }
  .login-left {
    width: 100%;
    padding: 30px 20px;
  }
  .login-right {
    width: 100%;
    padding: 30px 20px;
  }
}
</style>