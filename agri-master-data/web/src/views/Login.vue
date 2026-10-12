<!--
  运营端登录页 —— **委托平台统一认证中心**（V2.0 第 5.1 / 5.2 节）。

  这个页面**不收集密码**，也**不碰任何凭证**：它的唯一职责是把浏览器送到认证中心，
  并把"回来后要去哪"记下来。子系统前端与后端都不接触用户密码。

  为什么原来那版必须删掉：它自带一份"后端调不通就本地放行 admin/admin123"的兜底，
  等于把"接口挂了"静默变成"登录成功、进去看演示数据"。这比报错更难发现，
  因为它看起来是通的。现在后端不可达就直接把失败原因显示出来。
-->
<template>
  <div class="login-container">
    <div class="login-bg"></div>
    <div class="login-box">
      <div class="login-header">
        <div class="logo-section">
          <div class="logo-icon">🌾</div>
          <div class="logo-text">
            <h2>主数据管理运营系统</h2>
            <p>Master Data Management System</p>
          </div>
        </div>
      </div>

      <div class="delegate">
        <p class="delegate-title">使用平台账号登录</p>
        <p class="delegate-desc">
          账号由平台统一认证中心管理，本系统不保存你的密码与登录凭证。
        </p>
        <a-button
          type="primary"
          size="large"
          block
          :loading="redirecting"
          class="login-btn"
          @click="startLogin"
        >
          前往统一认证中心
        </a-button>
        <p v-if="error" class="delegate-error">{{ error }}</p>
      </div>

      <div class="login-footer">
        <span>© 2024 主数据管理系统</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { redirectToSso } from '@/utils/sso'

const route = useRoute()
const redirecting = ref(false)
const error = ref('')

/** 去认证中心。带回跳目标，登录后能回到用户原本想去的页面。 */
async function startLogin(): Promise<void> {
  redirecting.value = true
  error.value = ''
  try {
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : undefined
    await redirectToSso(target)
  } catch (cause) {
    redirecting.value = false
    error.value = cause instanceof Error ? cause.message : '无法跳转到统一认证中心'
  }
}

onMounted(() => {
  // 带 ?local=1 时不自动跳转：那是从失败的回跳页回来的，自动跳会变成无限来回
  if (route.query.local === '1') {
    return
  }
  void startLogin()
})
</script>

<style scoped>
.delegate {
  padding: 0 8px;
}

.delegate-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.delegate-desc {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.6;
  color: #667085;
}

.delegate-error {
  margin: 14px 0 0;
  font-size: 13px;
  color: #da3633;
}

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #238636 0%, #2ea043 50%, #3fb950 100%);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.login-bg::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.login-box {
  position: relative;
  z-index: 10;
  width: 420px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.logo-icon {
  font-size: 36px;
}

.logo-text {
  text-align: left;
}

.logo-text h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.logo-text p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #999;
}

.login-form {
  padding: 0 8px;
}

.input-field {
  height: 44px;
  border-radius: 8px;
}

.login-btn-wrap {
  margin-bottom: 0;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  border: none;
  transition: all 0.3s ease;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(35, 134, 54, 0.3);
}

.login-btn:active {
  transform: translateY(0);
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.login-footer span {
  font-size: 12px;
  color: #999;
}
</style>
