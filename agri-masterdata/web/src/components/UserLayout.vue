<template>
  <div class="user-layout">
    <header class="user-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">🌾</span>
          <span class="logo-text">主数据平台</span>
        </div>
      </div>
      <nav class="header-nav">
        <a 
          v-for="item in navItems" 
          :key="item.path" 
          :href="item.path" 
          @click.prevent="handleNavClick(item.path)"
          :class="{ active: currentPath === item.path }"
        >{{ item.label }}</a>
      </nav>
      <div class="header-right">
        <button class="notification-btn" @click="toggleNotifications">🔔</button>
        <div class="user-menu">
          <span class="user-name">{{ userInfo.nickname || '用户' }}</span>
          <div class="dropdown-menu" v-if="showDropdown">
            <a href="/user/profile" @click.prevent="handleNavClick('/user/profile')">个人中心</a>
            <a href="/user/settings" @click.prevent="handleNavClick('/user/settings')">账号设置</a>
            <hr />
            <a href="#" @click.prevent="handleLogout">退出登录</a>
          </div>
        </div>
      </div>
    </header>
    
    <div class="notification-panel" v-if="showNotifications">
      <div class="panel-header">
        <h3>通知消息</h3>
        <button class="close-btn" @click="showNotifications = false">×</button>
      </div>
      <div class="notification-list">
        <div v-for="notif in notifications" :key="notif.id" class="notification-item">
          <span class="notif-icon">{{ notif.icon }}</span>
          <div class="notif-content">
            <span class="notif-title">{{ notif.title }}</span>
            <span class="notif-time">{{ notif.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <main class="user-main">
      <router-view />
    </main>

    <footer class="user-footer">
      <p>© 2026 主数据管理系统 - 用户端</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const currentPath = ref('/user/home')
const showDropdown = ref(false)
const showNotifications = ref(false)
const userInfo = ref({ nickname: '张三' })

const navItems = [
  { path: '/user/home', label: '首页' },
  { path: '/user/data', label: '数据查询' },
  { path: '/user/report', label: '数据报表' },
  { path: '/user/help', label: '帮助中心' }
]

const notifications = [
  { id: 1, icon: '📢', title: '您的数据审核已通过', time: '5分钟前' },
  { id: 2, icon: '🔔', title: '系统维护通知', time: '30分钟前' },
  { id: 3, icon: '📊', title: '数据质量报告已生成', time: '1小时前' }
]

const handleNavClick = (path) => {
  currentPath.value = path
  router.push(path)
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userType')
  router.push('/user/login')
}

onMounted(() => {
  currentPath.value = router.currentRoute.value.path
})
</script>

<style scoped>
.user-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.user-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  height: 60px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left .logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #238636;
}

.header-nav {
  display: flex;
  gap: 30px;
}

.header-nav a {
  text-decoration: none;
  color: #4a5568;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.header-nav a:hover {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.header-nav a.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.notification-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  position: relative;
}

.notification-btn::after {
  content: '3';
  position: absolute;
  top: 2px;
  right: 2px;
  background: #dc2626;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 10px;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  font-size: 14px;
  position: relative;
}

.user-menu:hover {
  background: rgba(35, 134, 54, 0.15);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 160px;
  overflow: hidden;
}

.dropdown-menu a {
  display: block;
  padding: 10px 16px;
  text-decoration: none;
  color: #4a5568;
  font-size: 13px;
  transition: background 0.2s;
}

.dropdown-menu a:hover {
  background: #f8fafc;
}

.dropdown-menu hr {
  border: none;
  border-top: 1px solid #f0f0f0;
  margin: 4px 0;
}

.notification-panel {
  position: fixed;
  top: 70px;
  right: 30px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 360px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 200;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #a0aec0;
  cursor: pointer;
}

.notification-list {
  padding: 8px;
}

.notification-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.notification-item:hover {
  background: #f8fafc;
}

.notif-icon {
  font-size: 20px;
}

.notif-content {
  flex: 1;
}

.notif-title {
  display: block;
  font-size: 13px;
  color: #2d3748;
  margin-bottom: 4px;
}

.notif-time {
  font-size: 11px;
  color: #a0aec0;
}

.user-main {
  flex: 1;
  padding: 24px;
}

.user-footer {
  text-align: center;
  padding: 20px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.user-footer p {
  margin: 0;
  font-size: 13px;
  color: #a0aec0;
}
</style>